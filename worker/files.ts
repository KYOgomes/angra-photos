import { Hono } from "hono";
import type { AppEnv } from "./env";

export const files = new Hono<AppEnv>();

/**
 * Miniaturas (t) e previews (p) passam pelo Worker, com sessão. A chave é o hash do
 * original, então o conteúdo nunca muda: o navegador guarda em cache para sempre.
 */
files.get("/arquivo/:tipo/:hash", async (c) => {
  const { tipo, hash } = c.req.param();
  if ((tipo !== "t" && tipo !== "p") || !/^[0-9a-f]{64}$/.test(hash)) return c.json({ erro: "nao_encontrado" }, 404);

  const key = `${tipo === "t" ? "thumbs" : "previews"}/${hash}.jpg`;
  const obj = await c.env.BUCKET.get(key, { onlyIf: c.req.raw.headers });
  if (!obj) return c.json({ erro: "nao_encontrado" }, 404);

  const headers = new Headers({
    "content-type": "image/jpeg",
    etag: obj.httpEtag,
    "cache-control": "private, max-age=31536000, immutable",
  });
  if (!("body" in obj)) return new Response(null, { status: 304, headers });
  return new Response(obj.body, { headers });
});
