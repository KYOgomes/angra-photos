import { localParaUtc } from "../../shared/datas";
import type { FonteData, TipoMidia } from "../../shared/types";
import { lerMetaVideo } from "./mp4-meta";

export interface InfoCaptura {
  capturedAtUtc: string;
  aproximada: boolean;
  fonte: FonteData;
  duracaoS?: number;
}

/** "2026:01:03 14:22:10" (EXIF, hora local sem fuso) → partes. */
function partesExif(valor: unknown) {
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    return {
      ano: valor.getFullYear(),
      mes: valor.getMonth() + 1,
      dia: valor.getDate(),
      hora: valor.getHours(),
      min: valor.getMinutes(),
      seg: valor.getSeconds(),
    };
  }
  if (typeof valor !== "string") return null;
  const m = valor.match(/^(\d{4})[:-](\d{2})[:-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m || m[1] === "0000") return null;
  const [ano, mes, dia, hora, min, seg] = m.slice(1).map(Number);
  return { ano, mes, dia, hora, min, seg };
}

async function dataFoto(arquivo: File): Promise<string | null> {
  const { default: exifr } = await import("exifr");
  // reviveValues: false → strings cruas; o exifr converteria usando o fuso do navegador.
  const tags = (await exifr.parse(arquivo, {
    pick: ["DateTimeOriginal", "CreateDate", "OffsetTimeOriginal", "OffsetTimeDigitized", "OffsetTime"],
    reviveValues: false,
  })) as Record<string, unknown> | undefined;
  if (!tags) return null;
  const original = partesExif(tags.DateTimeOriginal);
  const partes = original ?? partesExif(tags.CreateDate);
  if (!partes) return null;
  const offset = (original ? tags.OffsetTimeOriginal : tags.OffsetTimeDigitized) ?? tags.OffsetTime;
  return localParaUtc(partes, typeof offset === "string" ? offset.trim() : null);
}

/**
 * Data/hora em que a mídia foi capturada (não a do upload).
 * Sem metadado (WhatsApp, print, arquivo convertido) → File.lastModified, marcada como aproximada.
 */
export async function lerDataCaptura(arquivo: File, tipo: TipoMidia): Promise<InfoCaptura> {
  let duracaoS: number | undefined;
  try {
    if (tipo === "foto") {
      const iso = await dataFoto(arquivo);
      if (iso) return { capturedAtUtc: iso, aproximada: false, fonte: "exif" };
    } else {
      const meta = await lerMetaVideo(arquivo);
      duracaoS = meta.duracaoS;
      if (meta.criacaoUtc && meta.fonte) {
        return { capturedAtUtc: meta.criacaoUtc, aproximada: false, fonte: meta.fonte, duracaoS };
      }
    }
  } catch (e) {
    console.warn("Sem metadado de data em", arquivo.name, e);
  }
  const ms = arquivo.lastModified && arquivo.lastModified <= Date.now() + 86_400_000 ? arquivo.lastModified : Date.now();
  return { capturedAtUtc: new Date(ms).toISOString(), aproximada: true, fonte: "lastModified", duracaoS };
}
