import type {
  EntradaIndice,
  IniciarUploadBody,
  IniciarUploadResposta,
  ListaMidia,
  MediaItem,
  ParteConcluida,
  Resumo,
} from "../../shared/types";

export class ErroApi extends Error {
  status: number;
  codigo: string;
  dados: Record<string, unknown> | null;
  constructor(status: number, codigo: string, dados: Record<string, unknown> | null) {
    super(codigo);
    this.status = status;
    this.codigo = codigo;
    this.dados = dados;
  }
}

async function req<T>(method: string, caminho: string, corpo?: unknown, headers: Record<string, string> = {}): Promise<T> {
  const res = await fetch(caminho, {
    method,
    credentials: "same-origin",
    headers: { ...(corpo !== undefined ? { "content-type": "application/json" } : {}), ...headers },
    body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
  });
  const dados = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok) {
    if (res.status === 401 && caminho !== "/api/login") window.dispatchEvent(new Event("sessao-expirada"));
    throw new ErroApi(res.status, String(dados?.erro ?? "erro"), dados);
  }
  return dados as T;
}

const qs = (p: Record<string, string | number | null | undefined>) => {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) if (v !== undefined && v !== null && v !== "") s.set(k, String(v));
  const t = s.toString();
  return t ? `?${t}` : "";
};

const autorHeader = (autor: string) => ({ "x-autor": encodeURIComponent(autor) });

export const api = {
  sessao: () => req<{ ok: true }>("GET", "/api/sessao"),
  login: (senha: string) => req<{ ok: true }>("POST", "/api/login", { senha }),
  logout: () => req<{ ok: true }>("POST", "/api/logout"),

  resumo: (autor?: string | null) => req<Resumo>("GET", `/api/resumo${qs({ autor })}`),
  listar: (p: { dia?: string; autor?: string | null; cursor?: string | null; limite?: number }) =>
    req<ListaMidia>("GET", `/api/media${qs(p)}`),
  destaques: () => req<{ hashes: string[] }>("GET", "/api/destaques"),

  indice: () => req<{ indice: EntradaIndice[] }>("GET", "/api/upload/indice"),
  completarPhash: (itens: { id: string; phash: string }[]) => req<{ ok: true }>("POST", "/api/upload/phash", { itens }),
  verificar: (hash: string) => req<{ existe: boolean }>("POST", "/api/upload/verificar", { hash }),
  iniciar: (corpo: IniciarUploadBody) => req<IniciarUploadResposta>("POST", "/api/upload/iniciar", corpo),
  partes: (id: string, uploadId: string, numeros: number[]) =>
    req<{ urls: Record<number, string> }>("POST", `/api/upload/${id}/partes`, { uploadId, numeros }),
  concluir: (id: string, corpo: { uploadId?: string; partes?: ParteConcluida[] } = {}) =>
    req<MediaItem>("POST", `/api/upload/${id}/concluir`, corpo),
  cancelar: (id: string) => req<{ ok: true }>("POST", `/api/upload/${id}/cancelar`, {}),

  corrigirData: (id: string, capturedAtUtc: string, autor: string) =>
    req<MediaItem>("PATCH", `/api/media/${id}`, { capturedAtUtc }, autorHeader(autor)),
  excluir: (id: string, autor: string) => req<{ ok: true }>("DELETE", `/api/media/${id}`, undefined, autorHeader(autor)),
};

export const urls = {
  thumb: (hash: string) => `/api/arquivo/t/${hash}`,
  preview: (hash: string) => `/api/arquivo/p/${hash}`,
  original: (id: string, download = false) => `/api/media/${id}/original${download ? "?download=1" : ""}`,
};
