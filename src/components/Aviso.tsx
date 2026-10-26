import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";

// Aviso rápido no rodapé da tela (ex.: "Baixada! Ela aparece na Galeria…").
// Fica acima de tudo, inclusive do visualizador de fotos.

const EVENTO = "album:aviso";

export function mostrarAviso(texto: string) {
  window.dispatchEvent(new CustomEvent(EVENTO, { detail: texto }));
}

export function Aviso() {
  const [texto, setTexto] = useState<string | null>(null);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const aoAvisar = (e: Event) => {
      setTexto((e as CustomEvent<string>).detail);
      clearTimeout(t);
      t = setTimeout(() => setTexto(null), 3500);
    };
    window.addEventListener(EVENTO, aoAvisar);
    return () => {
      window.removeEventListener(EVENTO, aoAvisar);
      clearTimeout(t);
    };
  }, []);
  if (!texto) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-[max(1.5rem,calc(env(safe-area-inset-bottom)+0.75rem))] z-[120] mx-auto flex max-w-md items-center gap-2.5 rounded-2xl bg-ocean-deep/95 px-4 py-3 text-sm font-medium text-white shadow-2xl ring-1 ring-white/10 backdrop-blur-md duration-300 animate-in fade-in slide-in-from-bottom-3"
    >
      <CheckCircle2 className="size-5 shrink-0 text-aqua" />
      {texto}
    </div>
  );
}
