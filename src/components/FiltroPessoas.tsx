import type { ResumoAutor } from "../../shared/types";
import { numero } from "@/lib/formato";
import { useIdioma, useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface Props {
  autores: ResumoAutor[];
  total: number;
  selecionado: string | null;
  onSelecionar: (nome: string | null) => void;
}

function Chip({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={ativo}
      className={cn(
        "shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold whitespace-nowrap transition-all active:scale-95",
        ativo ? "bg-teal text-white shadow-sm shadow-teal/30" : "bg-card text-ocean ring-1 ring-border hover:bg-accent",
      )}
    >
      {children}
    </button>
  );
}

/** Filtro opcional por quem enviou. */
export function FiltroPessoas({ autores, total, selecionado, onSelecionar }: Props) {
  const t = useT();
  const idioma = useIdioma();
  if (autores.length < 2 && !selecionado) return null;
  return (
    <div className="sem-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-1">
      <Chip ativo={!selecionado} onClick={() => onSelecionar(null)}>
        {t.todos} <span className="opacity-70">{numero(total, idioma)}</span>
      </Chip>
      {autores.map((a) => (
        <Chip key={a.nome} ativo={selecionado === a.nome} onClick={() => onSelecionar(a.nome)}>
          {a.nome} <span className="opacity-70">{numero(a.total, idioma)}</span>
        </Chip>
      ))}
    </div>
  );
}
