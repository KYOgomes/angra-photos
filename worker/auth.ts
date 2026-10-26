import type { Context, MiddlewareHandler } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { AppEnv } from "./env";

const COOKIE = "sess";
const VALIDADE_S = 30 * 24 * 60 * 60;
const MAX_TENTATIVAS = 5;
const JANELA_MS = 15 * 60 * 1000;

const enc = new TextEncoder();

function chaveHmac(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function paraBase64Url(buf: ArrayBuffer): string {
  let s = "";
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function deBase64Url(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/** Token = "<expiração em s>.<HMAC-SHA256(v1.<expiração>)>". Sem estado no servidor. */
async function criarToken(secret: string, expS: number): Promise<string> {
  const sig = await crypto.subtle.sign("HMAC", await chaveHmac(secret), enc.encode(`v1.${expS}`));
  return `${expS}.${paraBase64Url(sig)}`;
}

async function tokenValido(secret: string, token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig || !/^\d+$/.test(exp)) return false;
  if (Number(exp) < Date.now() / 1000) return false;
  try {
    // subtle.verify compara em tempo constante.
    return await crypto.subtle.verify("HMAC", await chaveHmac(secret), deBase64Url(sig), enc.encode(`v1.${exp}`));
  } catch {
    return false;
  }
}

async function senhaConfere(correta: string, tentativa: string): Promise<boolean> {
  // Compara os hashes (mesmo tamanho) em tempo constante.
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(correta)),
    crypto.subtle.digest("SHA-256", enc.encode(tentativa)),
  ]);
  return crypto.subtle.timingSafeEqual(a, b);
}

export async function login(c: Context<AppEnv>) {
  if (!c.env.SHARED_PASSWORD || !c.env.SESSION_SECRET) return c.json({ erro: "nao_configurado" }, 500);
  const db = c.env.DB;
  const ip = c.req.header("cf-connecting-ip") ?? "local";
  const agora = Date.now();

  const row = await db
    .prepare("SELECT tentativas, janela_inicio FROM login_attempts WHERE ip = ?")
    .bind(ip)
    .first<{ tentativas: number; janela_inicio: number }>();
  const naJanela = !!row && agora - row.janela_inicio < JANELA_MS;

  if (row && naJanela && row.tentativas >= MAX_TENTATIVAS) {
    const esperaS = Math.ceil((row.janela_inicio + JANELA_MS - agora) / 1000);
    c.header("Retry-After", String(esperaS));
    return c.json({ erro: "muitas_tentativas", esperaS }, 429);
  }

  const body = await c.req.json<{ senha?: unknown }>().catch(() => ({}) as { senha?: unknown });
  const senha = typeof body.senha === "string" ? body.senha : "";

  if (!senha || !(await senhaConfere(c.env.SHARED_PASSWORD, senha))) {
    const tentativas = naJanela ? row!.tentativas + 1 : 1;
    await db
      .prepare("INSERT OR REPLACE INTO login_attempts (ip, tentativas, janela_inicio) VALUES (?, ?, ?)")
      .bind(ip, tentativas, naJanela ? row!.janela_inicio : agora)
      .run();
    return c.json({ erro: "senha_incorreta", restantes: Math.max(0, MAX_TENTATIVAS - tentativas) }, 401);
  }

  await db.prepare("DELETE FROM login_attempts WHERE ip = ?").bind(ip).run();
  const token = await criarToken(c.env.SESSION_SECRET, Math.floor(agora / 1000) + VALIDADE_S);
  setCookie(c, COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: VALIDADE_S,
  });
  return c.json({ ok: true });
}

export function logout(c: Context<AppEnv>) {
  deleteCookie(c, COOKIE, { path: "/", secure: true });
  return c.json({ ok: true });
}

/** Toda rota /api/* exige sessão, exceto o login. */
export const exigirSessao: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (c.req.path === "/api/login") return next();
  if (!(await tokenValido(c.env.SESSION_SECRET, getCookie(c, COOKIE)))) {
    return c.json({ erro: "sessao_invalida" }, 401);
  }
  return next();
};
