import { useSyncExternalStore } from "react";

// Quais mídias já foram salvas neste aparelho (só para mostrar o ✓ no visualizador).
// Fica no localStorage; não é sincronizado entre aparelhos.

const CHAVE = "album:baixados";
const EVENTO = "album:baixados-mudou";
const LIMITE = 20_000;

let cache: Set<string> | null = null;

function carregar(): Set<string> {
  if (cache) return cache;
  try {
    cache = new Set(JSON.parse(localStorage.getItem(CHAVE) ?? "[]") as string[]);
  } catch {
    cache = new Set();
  }
  return cache;
}

export function marcarBaixados(ids: string[]) {
  const atual = carregar();
  const novo = new Set(atual);
  for (const id of ids) novo.add(id);
  if (novo.size === atual.size) return;
  cache = novo;
  try {
    localStorage.setItem(CHAVE, JSON.stringify([...novo].slice(-LIMITE)));
  } catch {
    // sem espaço / modo privado: vale só nesta aba
  }
  window.dispatchEvent(new Event(EVENTO));
}

function assinar(cb: () => void) {
  const aoMudarOutraAba = (e: StorageEvent) => {
    if (e.key === CHAVE) {
      cache = null;
      cb();
    }
  };
  window.addEventListener(EVENTO, cb);
  window.addEventListener("storage", aoMudarOutraAba);
  return () => {
    window.removeEventListener(EVENTO, cb);
    window.removeEventListener("storage", aoMudarOutraAba);
  };
}

export function useBaixados(): Set<string> {
  return useSyncExternalStore(assinar, carregar, carregar);
}
