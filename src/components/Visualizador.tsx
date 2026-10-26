import { useEffect, useMemo, useRef, useState } from "react";
import Lightbox, { type Slide } from "yet-another-react-lightbox";
import Video from "yet-another-react-lightbox/plugins/video";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import "yet-another-react-lightbox/styles.css";
import { Check, Download, Loader2, Trash2 } from "lucide-react";
import { normalizarNome, type MediaItem } from "../../shared/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DialogoCorrigirData } from "@/components/DialogoCorrigirData";
import { modoSalvarNoCelular } from "@/components/DialogoSalvarDia";
import { mostrarAviso } from "@/components/Aviso";
import { api, urls } from "@/lib/api";
import { marcarBaixados, useBaixados } from "@/lib/baixados";
import { dataHora } from "@/lib/formato";
import { useIdioma, useT } from "@/lib/i18n";

// Acima disso o arquivo não passa pela folha de compartilhar (memória do Safari) e vai por download.
const MAX_COMPARTILHAR = 500 * 1024 * 1024;
const toque = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

/** Foto: preview leve (1600px). Sem preview, HEIC usa a miniatura (o Chrome não abre HEIC). */
function srcFoto(m: MediaItem) {
  if (m.temPreview) return urls.preview(m.hash);
  return /heic|heif/.test(m.mime) ? urls.thumb(m.hash) : urls.original(m.id);
}

function paraSlide(m: MediaItem): Slide {
  if (m.tipo === "video") {
    return {
      type: "video",
      poster: urls.thumb(m.hash),
      width: m.largura ?? undefined,
      height: m.altura ?? undefined,
      // MOV com H.264/HEVC toca como MP4 onde o codec é suportado.
      sources: [{ src: urls.original(m.id), type: m.mime === "video/quicktime" ? "video/mp4" : m.mime }],
    };
  }
  return { src: srcFoto(m), width: m.largura ?? undefined, height: m.altura ?? undefined, alt: "" };
}

const nomeArquivo = (m: MediaItem) => m.nomeOriginal || `${m.hash.slice(0, 12)}.${m.ext}`;

/**
 * Um botão "Salvar no celular" que se adapta ao aparelho:
 * - iPhone: baixa o original e abre a folha de compartilhar ("Salvar Imagem/Vídeo" → Fotos).
 *   Se o Safari perder o gesto enquanto baixa, o botão pulsa e um segundo toque abre a folha.
 * - Android e computador: baixa o original direto (no Android aparece na Galeria, em Downloads).
 */
function BotaoSalvar({ item }: { item: MediaItem }) {
  const t = useT();
  const [estado, setEstado] = useState<"ocioso" | "baixando" | "pronto">("ocioso");
  const arquivo = useRef<File | null>(null);
  useEffect(() => {
    setEstado("ocioso");
    arquivo.current = null;
  }, [item.id]);

  const compartilhar = modoSalvarNoCelular() === "compartilhar" && item.tamanhoBytes <= MAX_COMPARTILHAR;
  const rotulo = toque ? t.salvarCelular : t.baixarOriginal;

  if (!compartilhar) {
    return (
      <a
        className="yarl__button"
        href={urls.original(item.id, true)}
        onClick={() => {
          marcarBaixados([item.id]);
          if (toque) mostrarAviso(t.salvoAndroid);
        }}
        aria-label={rotulo}
        title={rotulo}
      >
        <Download className="size-6" />
      </a>
    );
  }

  async function abrirFolha(f: File) {
    try {
      await navigator.share({ files: [f] });
      marcarBaixados([item.id]);
      setEstado("ocioso");
    } catch (e) {
      const nome = e instanceof DOMException ? e.name : "";
      if (nome === "NotAllowedError") setEstado("pronto");
      else if (nome === "AbortError") setEstado("ocioso");
      else window.location.href = urls.original(item.id, true);
    }
  }

  async function aoTocar() {
    if (estado === "pronto" && arquivo.current) return abrirFolha(arquivo.current);
    if (estado === "baixando") return;
    setEstado("baixando");
    try {
      const res = await fetch(urls.original(item.id));
      if (!res.ok) throw new Error(String(res.status));
      const f = new File([await res.blob()], nomeArquivo(item), { type: item.mime });
      if (!navigator.canShare?.({ files: [f] })) {
        window.location.href = urls.original(item.id, true);
        marcarBaixados([item.id]);
        setEstado("ocioso");
        return;
      }
      arquivo.current = f;
      await abrirFolha(f);
    } catch {
      setEstado("ocioso");
      window.location.href = urls.original(item.id, true);
    }
  }

  return (
    <button
      type="button"
      className={`yarl__button ${estado === "pronto" ? "animate-pulse text-aqua" : ""}`}
      onClick={aoTocar}
      aria-label={estado === "pronto" ? t.toqueSalvar : rotulo}
      title={rotulo}
    >
      {estado === "baixando" ? <Loader2 className="size-6 animate-spin" /> : <Download className="size-6" />}
    </button>
  );
}

function Informacoes({ item, meu, onCorrigir }: { item: MediaItem; meu: boolean; onCorrigir: () => void }) {
  const t = useT();
  const idioma = useIdioma();
  const podeCorrigir = meu && (item.dataAproximada || item.fonteData === "manual");
  return (
    <div className="max-w-xl">
      <p className="font-display text-lg leading-snug font-semibold text-white">{dataHora(item.capturedAtUtc, idioma)}</p>
      <p className="text-sm text-white/75">{t.enviadoPor(item.enviadoPor)}</p>
      {(item.dataAproximada || podeCorrigir) && (
        <div className="pointer-events-auto mt-2 flex flex-wrap items-center gap-2">
          {item.dataAproximada && (
            <span className="rounded-full bg-coral px-2.5 py-0.5 text-xs font-bold text-white">{t.seloAproximada}</span>
          )}
          {podeCorrigir && (
            <button onClick={onCorrigir} className="text-xs font-bold text-aqua underline underline-offset-2">
              {item.dataAproximada ? t.corrigirData : t.editarData}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

interface Props {
  itens: MediaItem[];
  indice: number;
  autor: string;
  onMudar: (i: number) => void;
  onFechar: () => void;
  onPertoDoFim: () => void;
  onExcluido: (m: MediaItem) => void;
  onAtualizado: (antigo: MediaItem, novo: MediaItem) => void;
}

export function Visualizador({ itens, indice, autor, onMudar, onFechar, onPertoDoFim, onExcluido, onAtualizado }: Props) {
  const t = useT();
  const slides = useMemo(() => itens.map(paraSlide), [itens]);
  const itemDoSlide = useMemo(() => new Map(slides.map((s, i) => [s, itens[i]])), [slides, itens]);
  const atual = itens[indice] as MediaItem | undefined;
  const ehMeu = (m: MediaItem) => !!autor && normalizarNome(m.enviadoPor) === normalizarNome(autor);

  const baixados = useBaixados();
  const [corrigindo, setCorrigindo] = useState<MediaItem | null>(null);
  const [excluindo, setExcluindo] = useState<MediaItem | null>(null);
  const [apagando, setApagando] = useState(false);
  const [erroExcluir, setErroExcluir] = useState<string | null>(null);

  async function confirmarExclusao() {
    if (!excluindo) return;
    setApagando(true);
    setErroExcluir(null);
    try {
      await api.excluir(excluindo.id, autor);
      onExcluido(excluindo);
      setExcluindo(null);
    } catch {
      setErroExcluir(t.erroExcluir);
    } finally {
      setApagando(false);
    }
  }

  const botoes: React.ReactNode[] = [];
  if (atual) {
    botoes.push(<BotaoSalvar key="salvar" item={atual} />);
    if (ehMeu(atual)) {
      botoes.push(
        <button
          key="excluir"
          type="button"
          className="yarl__button"
          onClick={() => setExcluindo(atual)}
          aria-label={t.excluir}
          title={t.excluir}
        >
          <Trash2 className="size-6" />
        </button>,
      );
    }
  }
  botoes.push("close");

  return (
    <>
      <Lightbox
        open={indice >= 0 && !!atual}
        index={Math.max(0, indice)}
        close={onFechar}
        slides={slides}
        plugins={[Video, Zoom]}
        carousel={{ finite: true, preload: 1 }}
        controller={{ closeOnPullDown: true, closeOnBackdropClick: false }}
        video={{ controls: true, playsInline: true, preload: "metadata" }}
        zoom={{ maxZoomPixelRatio: 2, scrollToZoom: true }}
        toolbar={{ buttons: botoes }}
        styles={{ container: { backgroundColor: "#031822" } }}
        labels={t.rotulosLightbox}
        on={{
          view: ({ index }) => {
            onMudar(index);
            if (index >= slides.length - 2) onPertoDoFim();
          },
        }}
        render={{
          // No celular: swipe para navegar e pinça para zoom; setas e lupas só atrapalham.
          ...(toque ? { buttonPrev: () => null, buttonNext: () => null, buttonZoom: () => null } : {}),
          // ✓ discreto no canto: esta mídia já foi salva neste aparelho.
          controls: () =>
            atual && baixados.has(atual.id) ? (
              <div
                role="img"
                aria-label={t.jaSalvo}
                title={t.jaSalvo}
                className="pointer-events-auto absolute top-[calc(env(safe-area-inset-top)+0.875rem)] left-4 grid size-8 place-items-center rounded-full bg-aqua/85 text-white shadow-md ring-2 ring-white/30 backdrop-blur-sm duration-300 animate-in zoom-in-50 fade-in"
              >
                <Check className="size-4.5" strokeWidth={3} />
              </div>
            ) : null,
          slideFooter: ({ slide }) => {
            const m = itemDoSlide.get(slide);
            if (!m || m.tipo === "video") return null;
            return (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-4 pt-16 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
                <Informacoes item={m} meu={ehMeu(m)} onCorrigir={() => setCorrigindo(m)} />
              </div>
            );
          },
          // Vídeo: informações no topo, para não cobrir os controles do player.
          slideHeader: ({ slide }) => {
            const m = itemDoSlide.get(slide);
            if (!m || m.tipo !== "video") return null;
            return (
              <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/75 to-transparent px-4 pt-[calc(3.75rem+env(safe-area-inset-top))] pb-10">
                <Informacoes item={m} meu={ehMeu(m)} onCorrigir={() => setCorrigindo(m)} />
              </div>
            );
          },
        }}
      />

      <DialogoCorrigirData item={corrigindo} autor={autor} onFechar={() => setCorrigindo(null)} onSalvo={onAtualizado} />

      <Dialog open={!!excluindo} onOpenChange={(v) => !v && !apagando && setExcluindo(null)}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{t.excluirTitulo(excluindo?.tipo === "video")}</DialogTitle>
            <DialogDescription>{t.excluirTexto}</DialogDescription>
          </DialogHeader>
          {erroExcluir && <p className="text-sm text-destructive">{erroExcluir}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setExcluindo(null)} disabled={apagando}>
              {t.cancelar}
            </Button>
            <Button variant="destructive" onClick={confirmarExclusao} disabled={apagando}>
              {apagando ? <Loader2 className="animate-spin" /> : <Trash2 />} {t.excluir}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
