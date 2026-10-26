import { Hono } from "hono";
import {
  LIMITE_MULTIPART,
  type EntradaIndice,
  type IniciarUploadBody,
  type IniciarUploadResposta,
  type ParteConcluida,
} from "../shared/types";
import { buscarMidia, normalizarData, paraItem, type MediaRow } from "./db";
import type { AppEnv, Env } from "./env";
import { abortarMultipart, concluirMultipart, criarMultipart, urlAssinada } from "./s3";

export const upload = new Hono<AppEnv>();

const EXPIRA_PUT_S = 60 * 60;
const MB = 1024 * 1024;

/** Deduplicação: o cliente calcula o SHA-256 e pergunta antes de enviar. */
upload.post("/upload/verificar", async (c) => {
  const { hash } = await c.req.json<{ hash?: string }>().catch(() => ({}) as { hash?: string });
  if (!hash || !/^[0-9a-f]{64}$/.test(hash)) return c.json({ erro: "hash_invalido" }, 400);
  const row = await c.env.DB.prepare("SELECT status FROM media WHERE hash = ?").bind(hash).first<{ status: string }>();
  return c.json({ existe: row?.status === "completo" });
});

function validar(b: Partial<IniciarUploadBody>): IniciarUploadBody | string {
  if (!b.hash || !/^[0-9a-f]{64}$/.test(b.hash)) return "hash_invalido";
  if (b.tipo !== "foto" && b.tipo !== "video") return "tipo_invalido";
  if (!b.mime || !/^(image|video)\/[\w.+-]{1,60}$/.test(b.mime)) return "mime_invalido";
  if (!b.ext || !/^[a-z0-9]{1,5}$/.test(b.ext)) return "ext_invalida";
  if (!Number.isSafeInteger(b.tamanhoBytes) || b.tamanhoBytes! <= 0) return "tamanho_invalido";
  const nome = (b.enviadoPor ?? "").trim();
  if (!nome || nome.length > 40) return "nome_invalido";
  const data = normalizarData(b.capturedAtUtc);
  if (!data) return "data_invalida";
  const fontes = ["exif", "quicktime", "mvhd", "lastModified"];
  if (!b.fonteData || !fontes.includes(b.fonteData)) return "fonte_invalida";
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);
  return {
    hash: b.hash,
    tipo: b.tipo,
    mime: b.mime,
    ext: b.ext,
    nomeOriginal: String(b.nomeOriginal ?? "").slice(0, 200),
    tamanhoBytes: b.tamanhoBytes!,
    largura: num(b.largura),
    altura: num(b.altura),
    duracaoS: num(b.duracaoS),
    capturedAtUtc: data,
    dataAproximada: !!b.dataAproximada,
    fonteData: b.fonteData,
    enviadoPor: nome,
    temPreview: !!b.temPreview && b.tipo === "foto",
    phash: b.tipo === "foto" && typeof b.phash === "string" && /^[0-9a-f]{16}$/.test(b.phash) ? b.phash : null,
  };
}

/**
 * Registra a mídia como 'pendente' e devolve URLs assinadas para o navegador enviar
 * miniatura, preview e original direto ao R2. Só aparece na galeria depois de /concluir.
 */
upload.post("/upload/iniciar", async (c) => {
  const corpo = validar(await c.req.json<Partial<IniciarUploadBody>>().catch(() => ({})));
  if (typeof corpo === "string") return c.json({ erro: corpo }, 400);

  const db = c.env.DB;
  const existente = await db.prepare("SELECT id, status FROM media WHERE hash = ?").bind(corpo.hash).first<{
    id: string;
    status: string;
  }>();
  if (existente?.status === "completo") return c.json({ erro: "duplicado", id: existente.id }, 409);

  const id = existente?.id ?? crypto.randomUUID();
  const r2Key = `originals/${corpo.hash}.${corpo.ext}`;
  const thumbKey = `thumbs/${corpo.hash}.jpg`;
  const previewKey = corpo.temPreview ? `previews/${corpo.hash}.jpg` : null;

  let original: IniciarUploadResposta["original"];
  let uploadId: string | null = null;
  if (corpo.tamanhoBytes > LIMITE_MULTIPART) {
    // Partes de no mínimo 10 MB (o S3/R2 aceita até 10.000 partes).
    const partSize = Math.max(10 * MB, Math.ceil(corpo.tamanhoBytes / 9_000 / MB) * MB);
    uploadId = await criarMultipart(c.env, r2Key, corpo.mime);
    original = { modo: "multipart", uploadId, partSize, totalPartes: Math.ceil(corpo.tamanhoBytes / partSize) };
  } else {
    original = { modo: "simples", url: await urlAssinada(c.env, "PUT", r2Key, EXPIRA_PUT_S) };
  }

  // Se já havia um pendente com o mesmo hash (tentativa anterior), substitui mantendo o id.
  await db.batch([
    db.prepare("DELETE FROM media WHERE hash = ? AND status = 'pendente'").bind(corpo.hash),
    db
      .prepare(
        `INSERT INTO media (id, r2_key, thumb_key, preview_key, hash, tipo, mime, ext, nome_original, tamanho_bytes,
           largura, altura, duracao_s, captured_at_utc, data_aproximada, fonte_data, enviado_por, enviado_em, status, upload_id, phash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendente', ?, ?)`,
      )
      .bind(
        id, r2Key, thumbKey, previewKey, corpo.hash, corpo.tipo, corpo.mime, corpo.ext, corpo.nomeOriginal,
        corpo.tamanhoBytes, corpo.largura, corpo.altura, corpo.duracaoS, corpo.capturedAtUtc,
        corpo.dataAproximada ? 1 : 0, corpo.fonteData, corpo.enviadoPor, new Date().toISOString(), uploadId,
        corpo.phash,
      ),
  ]);

  const resposta: IniciarUploadResposta = {
    id,
    thumbUrl: await urlAssinada(c.env, "PUT", thumbKey, EXPIRA_PUT_S),
    previewUrl: previewKey ? await urlAssinada(c.env, "PUT", previewKey, EXPIRA_PUT_S) : null,
    original,
  };
  return c.json(resposta);
});

/**
 * Índice das fotos do álbum para o cliente achar parecidas (mesma foto vinda do WhatsApp).
 * Uma leitura por sessão de envio, em vez de uma consulta por foto.
 */
upload.get("/upload/indice", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT id, hash, phash, captured_at_utc, data_aproximada, enviado_por FROM media
     WHERE status = 'completo' AND tipo = 'foto'`,
  ).all<{ id: string; hash: string; phash: string | null; captured_at_utc: string; data_aproximada: number; enviado_por: string }>();
  const indice: EntradaIndice[] = results.map((r) => ({
    id: r.id,
    hash: r.hash,
    phash: r.phash,
    capturedAtUtc: r.captured_at_utc,
    aproximada: r.data_aproximada === 1,
    enviadoPor: r.enviado_por,
  }));
  return c.json({ indice });
});

/** Completa o phash de fotos antigas (calculado no navegador a partir da miniatura). */
upload.post("/upload/phash", async (c) => {
  const { itens } = await c.req
    .json<{ itens?: { id: string; phash: string }[] }>()
    .catch(() => ({}) as { itens?: { id: string; phash: string }[] });
  const validos = (itens ?? []).filter((i) => typeof i.id === "string" && /^[0-9a-f]{16}$/.test(i.phash ?? "")).slice(0, 200);
  if (validos.length) {
    await c.env.DB.batch(
      validos.map((i) =>
        c.env.DB.prepare("UPDATE media SET phash = ? WHERE id = ? AND tipo = 'foto' AND phash IS NULL").bind(i.phash, i.id),
      ),
    );
  }
  return c.json({ ok: true, atualizados: validos.length });
});

/** URLs assinadas para um lote de partes do multipart (pedidas aos poucos, porque expiram). */
upload.post("/upload/:id/partes", async (c) => {
  const row = await buscarMidia(c.env.DB, c.req.param("id"));
  if (!row || row.status !== "pendente") return c.json({ erro: "nao_encontrado" }, 404);
  const { uploadId, numeros } = await c.req
    .json<{ uploadId?: string; numeros?: number[] }>()
    .catch(() => ({}) as { uploadId?: string; numeros?: number[] });
  if (!uploadId || !Array.isArray(numeros) || numeros.length === 0 || numeros.length > 50) {
    return c.json({ erro: "pedido_invalido" }, 400);
  }
  if (!numeros.every((n) => Number.isInteger(n) && n >= 1 && n <= 10_000)) return c.json({ erro: "parte_invalida" }, 400);

  const urls: Record<number, string> = {};
  for (const n of numeros) {
    urls[n] = await urlAssinada(c.env, "PUT", row.r2_key, EXPIRA_PUT_S, { partNumber: String(n), uploadId });
  }
  return c.json({ urls });
});

/** Confere no R2 que tudo chegou inteiro e libera a mídia na galeria. */
upload.post("/upload/:id/concluir", async (c) => {
  const row = await buscarMidia(c.env.DB, c.req.param("id"));
  if (!row) return c.json({ erro: "nao_encontrado" }, 404);
  if (row.status === "completo") return c.json(paraItem(row));

  const { uploadId, partes } = await c.req
    .json<{ uploadId?: string; partes?: ParteConcluida[] }>()
    .catch(() => ({}) as { uploadId?: string; partes?: ParteConcluida[] });
  if (uploadId && Array.isArray(partes) && partes.length > 0) {
    await concluirMultipart(c.env, row.r2_key, uploadId, partes);
  }

  const [original, thumb] = await Promise.all([c.env.BUCKET.head(row.r2_key), c.env.BUCKET.head(row.thumb_key)]);
  if (!original || original.size !== row.tamanho_bytes) return c.json({ erro: "original_incompleto" }, 409);
  if (!thumb) return c.json({ erro: "miniatura_ausente" }, 409);

  await c.env.DB.prepare("UPDATE media SET status = 'completo', upload_id = NULL WHERE id = ?").bind(row.id).run();
  return c.json(paraItem({ ...row, status: "completo", upload_id: null }));
});

/** Cancelado pelo usuário: aborta o multipart e apaga o que ficou pela metade. */
upload.post("/upload/:id/cancelar", async (c) => {
  const row = await buscarMidia(c.env.DB, c.req.param("id"));
  if (!row || row.status !== "pendente") return c.json({ ok: true });
  await descartarPendente(c.env, row);
  return c.json({ ok: true });
});

async function descartarPendente(env: Env, row: MediaRow) {
  if (row.upload_id) await abortarMultipart(env, row.r2_key, row.upload_id);
  await env.BUCKET.delete([row.r2_key, row.thumb_key, ...(row.preview_key ? [row.preview_key] : [])]);
  await env.DB.prepare("DELETE FROM media WHERE id = ? AND status = 'pendente'").bind(row.id).run();
}

/** Cron diário: remove uploads abandonados há mais de 24h. */
export async function limparPendentes(env: Env) {
  const limite = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { results } = await env.DB.prepare(
    "SELECT * FROM media WHERE status = 'pendente' AND enviado_em < ? LIMIT 200",
  )
    .bind(limite)
    .all<MediaRow>();
  for (const row of results) await descartarPendente(env, row);
}
