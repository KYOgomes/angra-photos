import { definirIdioma, useIdioma, useT, type Idioma } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const OPCOES: { valor: Idioma; rotulo: string; nome: string }[] = [
  { valor: "pt", rotulo: "PT", nome: "Português" },
  { valor: "en", rotulo: "EN", nome: "English" },
];

/** Alternador PT/EN. `sobreFoto` = versão de vidro para fundos escuros (hero, login). */
export function SeletorIdioma({ sobreFoto }: { sobreFoto: boolean }) {
  const idioma = useIdioma();
  const t = useT();
  return (
    <div
      role="group"
      aria-label={t.idioma}
      className={cn(
        "flex shrink-0 rounded-full p-0.5 text-xs font-bold",
        sobreFoto ? "bg-white/15 ring-1 ring-white/25 backdrop-blur-md" : "bg-card ring-1 ring-border",
      )}
    >
      {OPCOES.map((o) => {
        const ativo = idioma === o.valor;
        return (
          <button
            key={o.valor}
            type="button"
            lang={o.valor}
            title={o.nome}
            aria-pressed={ativo}
            onClick={() => definirIdioma(o.valor)}
            className={cn(
              "min-w-9 rounded-full px-2.5 py-1.5 transition-colors",
              ativo
                ? sobreFoto
                  ? "bg-white text-ocean shadow-sm"
                  : "bg-teal text-white shadow-sm"
                : sobreFoto
                  ? "text-white/80 hover:text-white"
                  : "text-ocean/70 hover:text-ocean",
            )}
          >
            {o.rotulo}
          </button>
        );
      })}
    </div>
  );
}
