import type { MediaItem } from "../../shared/types";
export async function registrarServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  try {
    await navigator.serviceWorker.register("/sw.js");
  } catch (e) {
    console.warn("Service worker indisponível; ZIP vai pelo plano B.", e);
  }
}

/**
 * "Baixar o dia inteiro". Com service worker: navegação para /zip/<dia>, e o navegador
 * grava o ZIP em streaming no disco. Sem ele: monta o ZIP na página (fica em memória).
 */
export async function baixarDia(dia: string, autor: string | null, excluir: string | null) {
  const p = new URLSearchParams();
  if (autor) p.set("autor", autor);
  if (excluir) p.set("excluir", excluir);
  const qs = p.toString();
  const caminho = `/zip/${dia}${qs ? `?${qs}` : ""}`;
  const sw = navigator.serviceWorker?.controller;
  if (sw) {
    const a = document.createElement("a");
    a.href = caminho;
    a.click();
    // Mantém o SW acordado por até 1h enquanto o download corre.
    let n = 0;
    const t = setInterval(() => (++n > 180 ? clearInterval(t) : sw.postMessage("ping")), 20_000);
    return;
  }
  const { respostaZipDoDia } = await import("../../shared/zip");
  const res = await respostaZipDoDia(dia, autor, excluir);
  if (res.status === 204) return;
  if (!res.ok) throw new Error(await res.text());
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = `ilha-grande-${dia}.zip`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** ZIP de uma seleção (montado na página; usado no computador). */
export async function baixarZipDeItens(itens: MediaItem[]) {
  const { respostaZip } = await import("../../shared/zip");
  const res = respostaZip(itens, "ilha-grande-selecao.zip");
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = "ilha-grande-selecao.zip";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
