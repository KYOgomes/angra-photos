import { useSyncExternalStore } from "react";

// Nome de quem está usando este aparelho (sem cadastro). Fica só no localStorage.

const CHAVE = "album:nome";
const EVENTO = "album:nome-mudou";

let memoria = "";

function ler(): string {
  try {
    return localStorage.getItem(CHAVE) ?? "";
  } catch {
    return memoria;
  }
}

export function salvarNome(nome: string) {
  memoria = nome.trim();
  try {
    localStorage.setItem(CHAVE, memoria);
  } catch {
    // modo privado: fica só em memória nesta aba
  }
  window.dispatchEvent(new Event(EVENTO));
}

function assinar(cb: () => void) {
  window.addEventListener(EVENTO, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENTO, cb);
    window.removeEventListener("storage", cb);
  };
}

export function useNome(): string {
  return useSyncExternalStore(assinar, ler, () => "");
}
