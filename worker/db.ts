import type { FonteData, MediaItem, TipoMidia } from "../shared/types";

export interface MediaRow {
  id: string;
  r2_key: string;
  thumb_key: string;
  preview_key: string | null;
  hash: string;
  tipo: TipoMidia;
  mime: string;
  ext: string;
  nome_original: string | null;
  tamanho_bytes: number;
  largura: number | null;
  altura: number | null;
  duracao_s: number | null;
  captured_at_utc: string;
  data_aproximada: number;
  fonte_data: FonteData;
  enviado_por: string;
  enviado_em: string;
  status: "pendente" | "completo";
  upload_id: string | null;
  phash: string | null;
}

export function paraItem(r: MediaRow): MediaItem {
  return {
    id: r.id,
    hash: r.hash,
    tipo: r.tipo,
    mime: r.mime,
    ext: r.ext,
    nomeOriginal: r.nome_original,
    tamanhoBytes: r.tamanho_bytes,
    largura: r.largura,
    altura: r.altura,
    duracaoS: r.duracao_s,
    capturedAtUtc: r.captured_at_utc,
    dataAproximada: r.data_aproximada === 1,
    fonteData: r.fonte_data,
    enviadoPor: r.enviado_por,
    enviadoEm: r.enviado_em,
    temPreview: r.preview_key !== null,
  };
}

export function buscarMidia(db: D1Database, id: string) {
  return db.prepare("SELECT * FROM media WHERE id = ?").bind(id).first<MediaRow>();
}

/** Dia (YYYY-MM-DD) em São Paulo, calculado no SQLite. SP é UTC−3 fixo. */
export const DIA_SP = "date(captured_at_utc, '-3 hours')";

/** Valida e normaliza uma data vinda do cliente para ISO UTC. */
export function normalizarData(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const t = Date.parse(valor);
  if (Number.isNaN(t)) return null;
  if (t < Date.UTC(1990, 0, 1) || t > Date.now() + 2 * 86_400_000) return null;
  return new Date(t).toISOString();
}

/** Nome de quem está agindo, enviado no header X-Autor (codificado). */
export function autorDoHeader(valor: string | undefined): string {
  if (!valor) return "";
  try {
    return decodeURIComponent(valor);
  } catch {
    return "";
  }
}
