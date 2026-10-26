import { useEffect, useMemo, useState } from "react";
import { ImagePlus } from "lucide-react";
import { ImageStreamHero, type StreamImage } from "@/components/ui/image-stream-hero";
import { Button } from "@/components/ui/button";
import { FOTOS_EXEMPLO } from "@/components/fotos-exemplo";
import { Onda } from "@/components/Onda";
import { api, urls } from "@/lib/api";
import { useT } from "@/lib/i18n";
import type { Resumo } from "../../shared/types";

const telaLarga = () => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;

/** Topo da galeria: o corredor de fotos com as fotos reais da viagem. */
export function HeroAlbum({ resumo, onEnviar }: { resumo: Resumo | null; onEnviar: () => void }) {
  const t = useT();
  const [hashes, setHashes] = useState<string[]>([]);
  const temFotos = (resumo?.total ?? 0) > 0;

  useEffect(() => {
    if (!temFotos) return;
    api
      .destaques()
      .then((r) => setHashes(r.hashes))
      .catch(() => undefined);
  }, [temFotos]);

  const imagens: StreamImage[] = useMemo(() => {
    // Com poucas fotos reais o corredor fica repetitivo: completa com as de exemplo.
    if (hashes.length < 6) return FOTOS_EXEMPLO;
    // Miniatura (≈30 KB) no celular; preview só em tela grande, onde os cards ficam enormes.
    return hashes.map((h) => ({ src: telaLarga() ? urls.preview(h) : urls.thumb(h) }));
  }, [hashes]);

  const pessoas = resumo?.autores.length ?? 0;
  const dias = resumo?.dias.length ?? 0;

  return (
    <ImageStreamHero
      images={imagens}
      cards={8}
      speed={24}
      axis={50}
      className="h-[min(78svh,560px)] w-full bg-[radial-gradient(120%_90%_at_50%_45%,#0e6b80_0%,var(--ocean)_50%,var(--ocean-deep)_100%)] sm:h-[600px]"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(55%_40%_at_50%_30%,rgba(6,47,66,0.55),transparent_75%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-ocean-deep/85 to-transparent" />

      <div className="relative z-10 flex h-full flex-col items-center justify-between px-5 pt-24 pb-14 text-center sm:pb-20">
        <h1 className="font-display text-[3.25rem] leading-[0.92] font-semibold text-balance text-white drop-shadow-[0_2px_18px_rgba(0,0,0,0.5)] sm:text-7xl">
          Ilha Grande
          <span className="block text-aqua italic">2026</span>
        </h1>

        <div className="flex flex-col items-center gap-4">
          {resumo && temFotos && (
            <p className="rounded-full bg-ocean-deep/40 px-4 py-1.5 text-sm font-medium text-white/90 ring-1 ring-white/15 backdrop-blur-md">
              {t.lembrancas(resumo.total)} · {t.dias(dias)} · {t.pessoas(pessoas)}
            </p>
          )}
          <Button variant="coral" size="lg" onClick={onEnviar} className="pointer-events-auto">
            <ImagePlus className="size-5" /> {t.enviarFotosVideos}
          </Button>
        </div>
      </div>

      <Onda className="absolute inset-x-0 -bottom-px z-10" />
    </ImageStreamHero>
  );
}
