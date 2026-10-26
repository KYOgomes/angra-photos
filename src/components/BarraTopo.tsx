import { useEffect, useState } from "react";
import { UserRound, Waves } from "lucide-react";
import { SeletorIdioma } from "@/components/SeletorIdioma";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Barra fixa: transparente sobre o hero, vira "areia com vidro" ao rolar. Idioma no canto esquerdo. */
export function BarraTopo({ nome, onNome }: { nome: string; onNome: () => void }) {
  const t = useT();
  const [rolou, setRolou] = useState(false);
  useEffect(() => {
    const aoRolar = () => setRolou(window.scrollY > 360);
    aoRolar();
    window.addEventListener("scroll", aoRolar, { passive: true });
    return () => window.removeEventListener("scroll", aoRolar);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 pt-[env(safe-area-inset-top)] transition-colors duration-300",
        rolou ? "border-b border-border/60 bg-sand/85 backdrop-blur-lg" : "bg-transparent",
      )}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <SeletorIdioma sobreFoto={!rolou} />
          <a
            href="#topo"
            className={cn(
              "flex min-w-0 items-center gap-2 font-display text-lg font-semibold transition-colors",
              rolou ? "text-ocean" : "text-white",
            )}
          >
            <span
              className={cn(
                "grid size-8 shrink-0 place-items-center rounded-full",
                rolou ? "bg-teal text-white" : "bg-white/15 text-aqua ring-1 ring-white/25 backdrop-blur-md",
              )}
            >
              <Waves className="size-4" />
            </span>
            <span className="hidden truncate sm:inline">Ilha Grande 2026</span>
          </a>
        </div>
        <button
          onClick={onNome}
          className={cn(
            "flex max-w-[45%] items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors",
            rolou
              ? "bg-card text-ocean ring-1 ring-border hover:bg-accent"
              : "bg-white/15 text-white ring-1 ring-white/25 backdrop-blur-md hover:bg-white/25",
          )}
        >
          <UserRound className="size-4 shrink-0" />
          <span className="truncate">{nome || t.nomeTitulo}</span>
        </button>
      </div>
    </header>
  );
}
