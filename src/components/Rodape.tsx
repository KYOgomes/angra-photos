import { MapPin, Ship } from "lucide-react";
import { Onda } from "@/components/Onda";
import { useT } from "@/lib/i18n";

/** Bandeira pirata no mesmo traço dos ícones do lucide, clara para o fundo escuro. */
function BandeiraPirata({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <path d="M5 3v18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-white/70" />
      <path d="M5 4h13l-2.6 4.5L18 13H5z" className="fill-white/90" />
      {/* caveira e ossos */}
      <circle cx="11" cy="7.6" r="2" className="fill-ocean-deep" />
      <rect x="10" y="9" width="2" height="1.2" rx="0.4" className="fill-ocean-deep" />
      <path d="M8 9.9l6 1.6M14 9.9l-6 1.6" stroke="var(--ocean-deep)" strokeWidth="0.9" strokeLinecap="round" />
    </svg>
  );
}

const LUGARES = ["Bananal", "Aventureiro", "Ilha da Gipoia", "Botinas", "Lagoa Azul"];

/** Fim do álbum: a areia volta a virar mar, com a história da viagem e o crédito. */
export function Rodape() {
  const t = useT();
  return (
    <footer className="relative mt-16">
      <Onda cor="var(--ocean-deep)" className="-mb-px" />
      <div className="bg-ocean-deep px-6 pt-8 pb-[max(7.5rem,calc(env(safe-area-inset-bottom)+6.5rem))] text-center text-white">
        <div className="mx-auto flex max-w-xl flex-col items-center gap-5">
          <div className="flex flex-col items-center gap-1.5">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold tracking-[0.18em] text-aqua uppercase">
              <MapPin className="size-3.5" /> {t.rodapeLugar}
            </span>
            <h2 className="font-display text-3xl font-semibold italic sm:text-4xl">{t.rodapeData}</h2>
          </div>

          <p className="text-[15px] leading-relaxed text-pretty text-white/80">{t.rodapeTexto}</p>

          <ul className="flex flex-wrap justify-center gap-2">
            {LUGARES.map((l) => (
              <li
                key={l}
                className="rounded-full bg-white/8 px-3 py-1 text-xs font-semibold text-white/85 ring-1 ring-white/15"
              >
                {l}
              </li>
            ))}
          </ul>

          <div className="mt-6 h-px w-16 bg-gradient-to-r from-transparent via-aqua/60 to-transparent" />

          <p className="flex items-center gap-1.5 text-xs text-white/55">
            {t.rodapeCredito}{" "}
            <span className="font-display text-base font-semibold text-white/90 italic">Caio</span>
            <BandeiraPirata className="size-[18px]" />
            <Ship aria-hidden className="size-4 text-aqua" />
          </p>
        </div>
      </div>
    </footer>
  );
}
