import { downloadZip } from "client-zip";
import { carimboArquivo } from "./datas";
import { normalizarNome, type ListaMidia, type MediaItem } from "./types";

// Monta o ZIP de um dia em streaming: cada original é baixado do R2 só quando o ZIP
// chega nele, e os bytes vão direto para o arquivo. Usado pelo service worker (e, sem
// ele, pela própria página como plano B).

async function listarDia(dia: string, autor: string | null): Promise<MediaItem[]> {
  const itens: MediaItem[] = [];
  let cursor: string | null = null;
  do {
    const p = new URLSearchParams({ dia, limite: "300" });
    if (autor) p.set("autor", autor);
    if (cursor) p.set("cursor", cursor);
    const res = await fetch(`/api/media?${p}`, { credentials: "same-origin" });
    if (!res.ok) throw new Error(`Falha ao listar o dia (${res.status})`);
    const pagina = (await res.json()) as ListaMidia;
    itens.push(...pagina.items);
    cursor = pagina.cursor;
  } while (cursor);
  return itens;
}

function slug(s: string) {
  return (
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "familia"
  );
}

/** "2026-01-03_14-22-10_ana.heic" — em ordem cronológica no explorador de arquivos. */
function nomesUnicos(itens: MediaItem[]): string[] {
  const usados = new Map<string, number>();
  return itens.map((m) => {
    const base = `${carimboArquivo(m.capturedAtUtc)}_${slug(m.enviadoPor)}`;
    const n = usados.get(base) ?? 0;
    usados.set(base, n + 1);
    return `${base}${n ? `_${n + 1}` : ""}.${m.ext}`;
  });
}

/** ZIP em streaming de uma lista de mídias (originais baixados um a um do R2). */
export function respostaZip(itens: MediaItem[], nomeZip: string): Response {
  const nomes = nomesUnicos(itens);

  async function* arquivos() {
    for (const [i, m] of itens.entries()) {
      const r = await fetch(`/api/media/${m.id}/original?json=1`, { credentials: "same-origin" });
      if (!r.ok) throw new Error(`Falha ao obter ${nomes[i]} (${r.status})`);
      const { url } = (await r.json()) as { url: string };
      const original = await fetch(url);
      if (!original.ok) throw new Error(`Falha ao baixar ${nomes[i]} (${original.status})`);
      yield { input: original, name: nomes[i], lastModified: new Date(m.capturedAtUtc), size: m.tamanhoBytes };
    }
  }

  const zip = downloadZip(arquivos(), {
    metadata: itens.map((m, i) => ({ name: nomes[i], size: m.tamanhoBytes })),
  });
  const headers = new Headers({
    "content-type": "application/zip",
    "content-disposition": `attachment; filename="${nomeZip}"`,
  });
  const tamanho = zip.headers.get("content-length");
  if (tamanho) headers.set("content-length", tamanho);
  return new Response(zip.body, { headers });
}

/**
 * `excluir`: nome de quem está baixando — as mídias que essa pessoa enviou ficam de fora
 * (ela já tem no próprio aparelho).
 */
export async function respostaZipDoDia(dia: string, autor: string | null, excluir: string | null): Promise<Response> {
  const quem = excluir ? normalizarNome(excluir) : "";
  const itens = (await listarDia(dia, autor)).filter((m) => !quem || normalizarNome(m.enviadoPor) !== quem);
  // 204: o navegador continua na página em vez de abrir uma tela de erro.
  if (itens.length === 0) return new Response(null, { status: 204 });
  return respostaZip(itens, `ilha-grande-${dia}.zip`);
}
