import type { EntradaIndice } from "../../shared/types";

// "Impressão digital visual" (dHash): a foto reduzida a 9×8 em tons de cinza; cada bit diz se
// um pixel é mais claro que o vizinho. A mesma foto reduzida/recomprimida (WhatsApp) dá quase
// o mesmo hash; fotos diferentes dão hashes bem diferentes.

const LIMIAR = 6; // bits diferentes (de 64) para considerar a mesma foto

/** Reduz em etapas (Safari amostra mal numa redução direta de 480 → 9 px). */
export function dhash(fonte: CanvasImageSource, w: number, h: number): string {
  let atual: CanvasImageSource = fonte;
  let [cw, ch] = [w, h];
  for (const [lw, lh] of [
    [144, 128],
    [36, 32],
    [9, 8],
  ]) {
    const c = document.createElement("canvas");
    c.width = lw;
    c.height = lh;
    const ctx = c.getContext("2d", { willReadFrequently: lw === 9 })!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(atual, 0, 0, cw, ch, 0, 0, lw, lh);
    atual = c;
    [cw, ch] = [lw, lh];
  }
  const d = (atual as HTMLCanvasElement).getContext("2d")!.getImageData(0, 0, 9, 8).data;
  const luz = (x: number, y: number) => {
    const i = (y * 9 + x) * 4;
    return 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  };
  let hex = "";
  for (let y = 0; y < 8; y++) {
    let byte = 0;
    for (let x = 0; x < 8; x++) byte = (byte << 1) | (luz(x, y) < luz(x + 1, y) ? 1 : 0);
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}

const BITS = Array.from({ length: 16 }, (_, n) => (n & 1) + ((n >> 1) & 1) + ((n >> 2) & 1) + ((n >> 3) & 1));

function distancia(a: string, b: string): number {
  let d = 0;
  for (let i = 0; i < 16; i++) d += BITS[parseInt(a[i], 16) ^ parseInt(b[i], 16)];
  return d;
}

/**
 * Procura no índice a foto mais parecida. Duas fotos com data de câmera confiável e horários
 * diferentes nunca são "a mesma" (ex.: três cliques seguidos da mesma pose).
 */
export function acharParecida(
  novo: { phash: string; capturedAtUtc: string; aproximada: boolean },
  indice: Iterable<EntradaIndice>,
): EntradaIndice | null {
  const t = Date.parse(novo.capturedAtUtc);
  let melhor: EntradaIndice | null = null;
  let melhorDist = LIMIAR + 1;
  for (const e of indice) {
    if (!e.phash) continue;
    const dist = distancia(novo.phash, e.phash);
    if (dist >= melhorDist) continue;
    if (!novo.aproximada && !e.aproximada && Math.abs(t - Date.parse(e.capturedAtUtc)) > 2000) continue;
    melhor = e;
    melhorDist = dist;
  }
  return melhor;
}

/** phash de uma foto antiga a partir da miniatura já publicada (fotos de antes desta função). */
export async function dhashDaUrl(url: string): Promise<string | null> {
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return dhash(img, img.naturalWidth, img.naturalHeight);
  } catch {
    return null;
  }
}
