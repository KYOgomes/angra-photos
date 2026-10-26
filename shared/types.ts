// Tipos trocados entre o front e o Worker.

export type TipoMidia = "foto" | "video";

export type FonteData = "exif" | "quicktime" | "mvhd" | "lastModified" | "manual";

export interface MediaItem {
  id: string;
  hash: string;
  tipo: TipoMidia;
  mime: string;
  ext: string;
  nomeOriginal: string | null;
  tamanhoBytes: number;
  largura: number | null;
  altura: number | null;
  duracaoS: number | null;
  capturedAtUtc: string;
  dataAproximada: boolean;
  fonteData: FonteData;
  enviadoPor: string;
  enviadoEm: string;
  temPreview: boolean;
}

export interface ResumoDia {
  /** YYYY-MM-DD no fuso de São Paulo */
  dia: string;
  total: number;
  bytes: number;
}

export interface ResumoAutor {
  nome: string;
  total: number;
}

export interface Resumo {
  total: number;
  dias: ResumoDia[];
  autores: ResumoAutor[];
}

export interface ListaMidia {
  items: MediaItem[];
  cursor: string | null;
}

export interface IniciarUploadBody {
  hash: string;
  tipo: TipoMidia;
  mime: string;
  ext: string;
  nomeOriginal: string;
  tamanhoBytes: number;
  largura: number | null;
  altura: number | null;
  duracaoS: number | null;
  capturedAtUtc: string;
  dataAproximada: boolean;
  fonteData: FonteData;
  enviadoPor: string;
  temPreview: boolean;
  /** dHash da miniatura (16 hex) — só fotos */
  phash: string | null;
}

/** Entrada do índice usado para achar fotos parecidas no cliente. */
export interface EntradaIndice {
  id: string;
  hash: string;
  phash: string | null;
  capturedAtUtc: string;
  aproximada: boolean;
  enviadoPor: string;
}

export type UploadOriginal =
  | { modo: "simples"; url: string }
  | { modo: "multipart"; uploadId: string; partSize: number; totalPartes: number };

export interface IniciarUploadResposta {
  id: string;
  thumbUrl: string;
  previewUrl: string | null;
  original: UploadOriginal;
}

export interface ParteConcluida {
  partNumber: number;
  etag: string;
}

/** Acima disso o original vai em multipart (partes enviadas em paralelo, com retry por parte). */
export const LIMITE_MULTIPART = 100 * 1024 * 1024;

/** São Paulo não tem horário de verão desde 2019: UTC−3 fixo. */
export const FUSO = "America/Sao_Paulo";
export const OFFSET_SP = "-03:00";

/** Normaliza o nome para comparar "quem enviou" (regra de exclusão). */
export function normalizarNome(nome: string): string {
  return nome.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
}
