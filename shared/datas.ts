import { FUSO, OFFSET_SP } from "./types";

// Datas: tudo é guardado em UTC e exibido em America/Sao_Paulo.

const fmtDia = new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" });
const fmtHora = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit" });
const fmtHoraArquivo = new Intl.DateTimeFormat("en-GB", {
  timeZone: FUSO,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/** "2026-01-03" — o dia da captura no fuso de São Paulo. */
export function diaSP(iso: string): string {
  return fmtDia.format(new Date(iso));
}

/** "14:22" */
export function horaSP(iso: string): string {
  return fmtHora.format(new Date(iso));
}

/** Nome de arquivo ordenável: "2026-01-03_14-22-10" (horário de São Paulo). */
export function carimboArquivo(iso: string): string {
  return `${diaSP(iso)}_${fmtHoraArquivo.format(new Date(iso)).replace(/:/g, "-")}`;
}

/**
 * Data local "de parede" (sem fuso) + offset → ISO UTC.
 * Sem offset, assume São Paulo — a viagem é aqui e a maioria das fotos também.
 */
export function localParaUtc(
  partes: { ano: number; mes: number; dia: number; hora: number; min: number; seg: number },
  offset?: string | null,
): string | null {
  const off = offset && /^[+-]\d{2}:\d{2}$/.test(offset) ? offset : OFFSET_SP;
  const p = (n: number, t = 2) => String(n).padStart(t, "0");
  const t = Date.parse(
    `${p(partes.ano, 4)}-${p(partes.mes)}-${p(partes.dia)}T${p(partes.hora)}:${p(partes.min)}:${p(partes.seg)}${off}`,
  );
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}
