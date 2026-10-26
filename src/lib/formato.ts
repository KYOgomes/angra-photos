import { diaSP, horaSP } from "../../shared/datas";
import { OFFSET_SP } from "../../shared/types";
import type { Idioma } from "./i18n";

export { diaSP, horaSP };

const LOCALE: Record<Idioma, string> = { pt: "pt-BR", en: "en-US" };

/** Dia da semana curto e número do dia ("Sáb" / "Sat", "18"). */
export function partesDia(dia: string, idioma: Idioma) {
  const d = new Date(`${dia}T12:00:00Z`);
  const semana = new Intl.DateTimeFormat(LOCALE[idioma], { weekday: "short", timeZone: "UTC" })
    .format(d)
    .replace(".", "");
  return { semana: semana.charAt(0).toUpperCase() + semana.slice(1), numero: String(d.getUTCDate()) };
}

/** "Sáb, 18 de outubro" / "Sat, October 18" a partir de "2026-10-18". */
export function tituloDia(dia: string, idioma: Idioma): string {
  const d = new Date(`${dia}T12:00:00Z`);
  const resto = new Intl.DateTimeFormat(LOCALE[idioma], { day: "numeric", month: "long", timeZone: "UTC" }).format(d);
  return `${partesDia(dia, idioma).semana}, ${resto}`;
}

/** "Sáb, 18 de outubro · 14:22" / "Sat, October 18 · 2:22 PM" (sempre no horário de Brasília). */
export function dataHora(iso: string, idioma: Idioma): string {
  const hora =
    idioma === "en"
      ? new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", hour: "numeric", minute: "2-digit" }).format(
          new Date(iso),
        )
      : horaSP(iso);
  return `${tituloDia(diaSP(iso), idioma)} · ${hora}`;
}

/** Valor para <input type="datetime-local"> no horário de São Paulo (UTC−3 fixo). */
export function paraInputLocal(iso: string): string {
  return new Date(Date.parse(iso) - 3 * 3600_000).toISOString().slice(0, 16);
}

export function deInputLocal(valor: string): string | null {
  const t = Date.parse(`${valor}:00${OFFSET_SP}`);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

/** "0:42", "12:05", "1:02:33" */
export function duracao(s: number | null | undefined): string {
  if (!s || !Number.isFinite(s)) return "";
  const total = Math.round(s);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const seg = String(total % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${seg}` : `${m}:${seg}`;
}

export function tamanho(bytes: number, idioma: Idioma): string {
  const un = ["B", "KB", "MB", "GB", "TB"];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < un.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toLocaleString(LOCALE[idioma], { maximumFractionDigits: v < 10 && i > 0 ? 1 : 0 })} ${un[i]}`;
}

export function numero(n: number, idioma: Idioma): string {
  return n.toLocaleString(LOCALE[idioma]);
}
