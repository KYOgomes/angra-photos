import { Hono } from "hono";
import { normalizarNome, type ListaMidia, type Resumo } from "../shared/types";
import { autorDoHeader, buscarMidia, DIA_SP, normalizarData, paraItem, type MediaRow } from "./db";
import type { AppEnv } from "./env";
import { urlAssinada } from "./s3";

export const media = new Hono<AppEnv>();

function codificarCursor(r: MediaRow) {
  return btoa(`${r.captured_at_utc}|${r.id}`);
}

function decodificarCursor(c: string | undefined): [string, string] | null {
  if (!c) return null;
  try {
    const [data, id] = atob(c).split("|");
    return data && id ? [data, id] : null;
  } catch {
    return null;
  }
}

/** Lista paginada, em ordem de captura. Filtros opcionais: dia (YYYY-MM-DD) e autor. */
media.get("/media", async (c) => {
  const { dia, autor, cursor } = c.req.query();
  const limite = Math.min(Math.max(Number(c.req.query("limite")) || 120, 1), 300);

  const where = ["status = 'completo'"];
  const params: unknown[] = [];
  if (dia && /^\d{4}-\d{2}-\d{2}$/.test(dia)) {
    where.push(`${DIA_SP} = ?`);
    params.push(dia);
  }
  if (autor) {
    where.push("enviado_por = ?");
    params.push(autor);
  }
  const pos = decodificarCursor(cursor);
  if (pos) {
    where.push("(captured_at_utc > ? OR (captured_at_utc = ? AND id > ?))");
    params.push(pos[0], pos[0], pos[1]);
  }

  const { results } = await c.env.DB.prepare(
    `SELECT * FROM media WHERE ${where.join(" AND ")} ORDER BY captured_at_utc, id LIMIT ?`,
  )
    .bind(...params, limite + 1)
    .all<MediaRow>();

  const temMais = results.length > limite;
  const pagina = temMais ? results.slice(0, limite) : results;
  const resposta: ListaMidia = {
    items: pagina.map(paraItem),
    cursor: temMais ? codificarCursor(pagina[pagina.length - 1]) : null,
  };
  return c.json(resposta);
});

/** Dias com contagem (para montar a galeria) e lista de quem enviou (para o filtro). */
media.get("/resumo", async (c) => {
  const autor = c.req.query("autor");
  const filtroAutor = autor ? " AND enviado_por = ?" : "";
  const [dias, autores] = await c.env.DB.batch([
    c.env.DB.prepare(
      `SELECT ${DIA_SP} AS dia, COUNT(*) AS total, SUM(tamanho_bytes) AS bytes
       FROM media WHERE status = 'completo'${filtroAutor} GROUP BY dia ORDER BY dia`,
    ).bind(...(autor ? [autor] : [])),
    c.env.DB.prepare(
      `SELECT enviado_por AS nome, COUNT(*) AS total FROM media
       WHERE status = 'completo' GROUP BY enviado_por ORDER BY total DESC, nome`,
    ),
  ]);
  const resumo: Resumo = {
    dias: dias.results as Resumo["dias"],
    autores: autores.results as Resumo["autores"],
    total: (dias.results as Resumo["dias"]).reduce((s, d) => s + d.total, 0),
  };
  return c.json(resumo);
});

/** Algumas fotos aleatórias para o hero do topo. */
media.get("/destaques", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT hash FROM media WHERE status = 'completo' AND tipo = 'foto' ORDER BY RANDOM() LIMIT 14",
  ).all<{ hash: string }>();
  return c.json({ hashes: results.map((r) => r.hash) });
});

/**
 * Original: redireciona para uma URL assinada do R2 (10 min). O R2 entrega direto,
 * com suporte a Range (vídeo avança/retrocede) e sem passar bytes pelo Worker.
 * ?download=1 força o download com o nome original; ?json=1 devolve a URL em JSON.
 */
media.get("/media/:id/original", async (c) => {
  const row = await buscarMidia(c.env.DB, c.req.param("id"));
  if (!row || row.status !== "completo") return c.json({ erro: "nao_encontrado" }, 404);

  const query: Record<string, string> = {};
  if (c.req.query("download")) {
    const nome = (row.nome_original || `${row.hash.slice(0, 12)}.${row.ext}`).replace(/["\\\r\n]/g, "_");
    // Sem espaços: o URLSearchParams viraria "+" e a assinatura S3 poderia não bater.
    const ascii = nome.replace(/[^\x21-\x7e]/g, "_");
    query["response-content-disposition"] = `attachment;filename="${ascii}";filename*=UTF-8''${encodeURIComponent(nome)}`;
  }
  const url = await urlAssinada(c.env, "GET", row.r2_key, 600, query);
  if (c.req.query("json")) return c.json({ url });
  return c.redirect(url, 302);
});

/** Corrigir data: só para mídia com data aproximada (ou já corrigida), e só por quem enviou. */
media.patch("/media/:id", async (c) => {
  const row = await buscarMidia(c.env.DB, c.req.param("id"));
  if (!row || row.status !== "completo") return c.json({ erro: "nao_encontrado" }, 404);
  if (normalizarNome(autorDoHeader(c.req.header("x-autor"))) !== normalizarNome(row.enviado_por)) {
    return c.json({ erro: "nao_autorizado" }, 403);
  }
  if (row.data_aproximada !== 1 && row.fonte_data !== "manual") {
    return c.json({ erro: "data_ja_confiavel" }, 400);
  }
  const body = await c.req.json<{ capturedAtUtc?: unknown }>().catch(() => ({}) as { capturedAtUtc?: unknown });
  const data = normalizarData(body.capturedAtUtc);
  if (!data) return c.json({ erro: "data_invalida" }, 400);

  await c.env.DB.prepare(
    "UPDATE media SET captured_at_utc = ?, data_aproximada = 0, fonte_data = 'manual' WHERE id = ?",
  )
    .bind(data, row.id)
    .run();
  return c.json(paraItem({ ...row, captured_at_utc: data, data_aproximada: 0, fonte_data: "manual" }));
});

/**
 * Excluir: só quem enviou (mesmo nome salvo no aparelho). Com senha compartilhada isso
 * é proteção contra acidente, não segurança de verdade — combinado com a família.
 */
media.delete("/media/:id", async (c) => {
  const row = await buscarMidia(c.env.DB, c.req.param("id"));
  if (!row) return c.json({ erro: "nao_encontrado" }, 404);
  if (normalizarNome(autorDoHeader(c.req.header("x-autor"))) !== normalizarNome(row.enviado_por)) {
    return c.json({ erro: "nao_autorizado" }, 403);
  }
  await c.env.BUCKET.delete([row.r2_key, row.thumb_key, ...(row.preview_key ? [row.preview_key] : [])]);
  await c.env.DB.prepare("DELETE FROM media WHERE id = ?").bind(row.id).run();
  return c.json({ ok: true });
});
