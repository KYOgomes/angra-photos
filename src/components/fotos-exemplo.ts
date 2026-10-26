import type { StreamImage } from "@/components/ui/image-stream-hero";

/**
 * Fotos de praia (Unsplash, licença livre) para a tela de entrada — lá ainda não há sessão,
 * então não dá para mostrar as fotos reais. Troque pelos favoritos da viagem em public/hero/.
 */
export const FOTOS_EXEMPLO: StreamImage[] = Array.from({ length: 12 }, (_, i) => ({
  src: `/hero/${String(i + 1).padStart(2, "0")}.jpg`,
  alt: "",
}));
