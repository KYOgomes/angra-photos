import type { TipoMidia } from "../../shared/types";
import { dhash } from "./parecidas";

export interface Miniaturas {
  thumb: Blob;
  preview: Blob | null;
  largura: number | null;
  altura: number | null;
  duracaoS: number | null;
  /** impressão digital visual (só fotos) */
  phash: string | null;
}

const LADO_THUMB = 480;
const LADO_PREVIEW = 1600;

function paraBlob(canvas: HTMLCanvasElement, qualidade: number): Promise<Blob> {
  return new Promise((ok, falha) =>
    canvas.toBlob((b) => (b ? ok(b) : falha(new Error("Falha ao gerar JPEG"))), "image/jpeg", qualidade),
  );
}

function desenhar(fonte: CanvasImageSource, w: number, h: number, ladoMax: number): HTMLCanvasElement {
  const escala = Math.min(1, ladoMax / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * escala));
  canvas.height = Math.max(1, Math.round(h * escala));
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(fonte, 0, 0, canvas.width, canvas.height);
  return canvas;
}

async function carregarImg(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.decoding = "async";
  img.src = url;
  try {
    await img.decode();
    if (!img.naturalWidth) throw new Error("Imagem vazia");
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

const ehHeic = (f: File) => /heic|heif/i.test(f.type) || /\.(heic|heif)$/i.test(f.name);

/**
 * Decodifica a foto. O <img> respeita a orientação EXIF. HEIC: o Safari abre nativamente;
 * Chrome/Android não, então convertemos com heic2any (carregado só quando precisa).
 * O original continua HEIC — isso é só para miniatura e preview.
 */
async function decodificar(arquivo: File): Promise<HTMLImageElement> {
  try {
    return await carregarImg(arquivo);
  } catch (e) {
    if (!ehHeic(arquivo)) throw e;
    const { default: heic2any } = await import("heic2any");
    const jpg = await heic2any({ blob: arquivo, toType: "image/jpeg", quality: 0.9 });
    return carregarImg(Array.isArray(jpg) ? jpg[0] : jpg);
  }
}

async function miniaturasFoto(arquivo: File): Promise<Miniaturas> {
  const img = await decodificar(arquivo);
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const preview = desenhar(img, w, h, LADO_PREVIEW);
  img.src = "";
  // A miniatura sai do preview: mais rápido e com menos memória do que redesenhar o original.
  const thumb = desenhar(preview, preview.width, preview.height, LADO_THUMB);
  return {
    preview: await paraBlob(preview, 0.82),
    thumb: await paraBlob(thumb, 0.75),
    largura: w,
    altura: h,
    duracaoS: null,
    phash: dhash(thumb, thumb.width, thumb.height),
  };
}

function esperar(alvo: EventTarget, evento: string, ms: number): Promise<void> {
  return new Promise((ok, falha) => {
    const t = setTimeout(() => falha(new Error(`timeout: ${evento}`)), ms);
    alvo.addEventListener(evento, () => (clearTimeout(t), ok()), { once: true });
    alvo.addEventListener("error", () => (clearTimeout(t), falha(new Error("erro no vídeo"))), { once: true });
  });
}

async function miniaturasVideo(arquivo: File): Promise<Miniaturas> {
  const url = URL.createObjectURL(arquivo);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;
  try {
    await esperar(video, "loadedmetadata", 15_000);
    const duracaoS = Number.isFinite(video.duration) ? video.duration : null;
    const w = video.videoWidth;
    const h = video.videoHeight;
    // O iOS só carrega quadros depois de um play() (permitido porque está mudo).
    await video.play().catch(() => undefined);
    video.pause();
    const seeked = esperar(video, "seeked", 10_000);
    video.currentTime = Math.min(1, (duracaoS ?? 0) * 0.1);
    await seeked;
    const canvas = desenhar(video, w, h, LADO_THUMB);
    return {
      thumb: await paraBlob(canvas, 0.75),
      preview: null,
      largura: w || null,
      altura: h || null,
      duracaoS,
      phash: null,
    };
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}

/** Miniatura genérica quando o navegador não consegue decodificar a mídia. */
async function miniaturaGenerica(tipo: TipoMidia): Promise<Blob> {
  const c = document.createElement("canvas");
  c.width = c.height = LADO_THUMB;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, LADO_THUMB, LADO_THUMB);
  g.addColorStop(0, "#0B4F6C");
  g.addColorStop(1, "#14B8A6");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, LADO_THUMB, LADO_THUMB);
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.beginPath();
  if (tipo === "video") {
    ctx.moveTo(200, 170);
    ctx.lineTo(200, 310);
    ctx.lineTo(310, 240);
  } else {
    ctx.arc(240, 240, 60, 0, Math.PI * 2);
  }
  ctx.fill();
  return paraBlob(c, 0.8);
}

export async function gerarMiniaturas(arquivo: File, tipo: TipoMidia): Promise<Miniaturas> {
  try {
    return tipo === "foto" ? await miniaturasFoto(arquivo) : await miniaturasVideo(arquivo);
  } catch (e) {
    console.warn("Não foi possível gerar miniatura de", arquivo.name, e);
    return {
      thumb: await miniaturaGenerica(tipo),
      preview: null,
      largura: null,
      altura: null,
      duracaoS: null,
      phash: null,
    };
  }
}
