import { useEffect, useSyncExternalStore } from "react";
import type { FilaUpload } from "@/lib/fila-upload";

/** Assina a fila e, enquanto ela trabalha, mantém a tela acesa e avisa antes de sair. */
export function useFila(fila: FilaUpload) {
  const itens = useSyncExternalStore(fila.assinar, fila.snapshot);
  const ocupada = fila.ocupada;

  useEffect(() => {
    if (!ocupada) return;
    let trava: WakeLockSentinel | null = null;
    const pedir = async () => {
      try {
        if (document.visibilityState === "visible") trava = await navigator.wakeLock?.request("screen");
      } catch {
        // sem suporte ou negado: segue sem
      }
    };
    const aoSair = (e: BeforeUnloadEvent) => e.preventDefault();
    void pedir();
    document.addEventListener("visibilitychange", pedir);
    window.addEventListener("beforeunload", aoSair);
    return () => {
      document.removeEventListener("visibilitychange", pedir);
      window.removeEventListener("beforeunload", aoSair);
      void trava?.release().catch(() => undefined);
    };
  }, [ocupada]);

  return { itens, ocupada };
}
