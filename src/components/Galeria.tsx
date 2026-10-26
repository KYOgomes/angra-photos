import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Check, CheckCheck, Download, Loader2, Play } from "lucide-react";
import { normalizarNome, type MediaItem, type ResumoDia } from "../../shared/types";
import { urls } from "@/lib/api";
import { duracao, partesDia, tamanho, tituloDia } from "@/lib/formato";
import { useIdioma, useT } from "@/lib/i18n";
import { baixarDia } from "@/lib/zip";
import { useBaixados } from "@/lib/baixados";
import { DialogoSalvarDia, modoSalvarNoCelular } from "@/components/DialogoSalvarDia";
import { cn } from "@/lib/utils";

/** Estado da seleção múltipla (modo "Selecionar", como na galeria do celular). */
export interface Selecao {
  ativa: boolean;
  ids: Set<string>;
  alternar: (id: string) => void;
  iniciar: (id: string) => void;
  marcarVarios: (ids: string[], marcar: boolean) => void;
}

interface MiniaturaProps {
  item: MediaItem;
  selecionando: boolean;
  selecionado: boolean;
  onAbrir: (m: MediaItem) => void;
  onAlternar: (id: string) => void;
  onIniciarSelecao: (id: string) => void;
}

const SEGURAR_MS = 450;

const Miniatura = memo(function Miniatura({
  item,
  selecionando,
  selecionado,
  onAbrir,
  onAlternar,
  onIniciarSelecao,
}: MiniaturaProps) {
  const t = useT();
  const [carregou, setCarregou] = useState(false);
  // Segurar o dedo na foto entra no modo de seleção (igual à galeria do celular).
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const segurou = useRef(false);
  const inicio = useRef<{ x: number; y: number } | null>(null);
  const cancelarToque = () => {
    clearTimeout(timer.current);
    inicio.current = null;
  };

  return (
    <button
      onPointerDown={(e) => {
        segurou.current = false;
        if (selecionando) return;
        inicio.current = { x: e.clientX, y: e.clientY };
        timer.current = setTimeout(() => {
          segurou.current = true;
          navigator.vibrate?.(25);
          onIniciarSelecao(item.id);
        }, SEGURAR_MS);
      }}
      onPointerMove={(e) => {
        // rolando a página: não é "segurar"
        if (inicio.current && Math.hypot(e.clientX - inicio.current.x, e.clientY - inicio.current.y) > 10) cancelarToque();
      }}
      onPointerUp={cancelarToque}
      onPointerLeave={cancelarToque}
      onPointerCancel={cancelarToque}
      onContextMenu={(e) => e.preventDefault()}
      onClick={() => {
        if (segurou.current) {
          segurou.current = false;
          return;
        }
        if (selecionando) onAlternar(item.id);
        else onAbrir(item);
      }}
      aria-pressed={selecionando ? selecionado : undefined}
      className="group relative aspect-square touch-manipulation overflow-hidden bg-muted outline-none select-none [-webkit-touch-callout:none] focus-visible:ring-4 focus-visible:ring-ring focus-visible:ring-inset"
      aria-label={t.abrirMidia(item.tipo === "video", item.enviadoPor)}
    >
      <img
        src={urls.thumb(item.hash)}
        alt=""
        loading="lazy"
        decoding="async"
        draggable={false}
        onLoad={() => setCarregou(true)}
        className={cn(
          "h-full w-full object-cover transition-[opacity,transform,border-radius] duration-300",
          carregou ? "opacity-100" : "opacity-0",
          selecionado ? "scale-[0.86] rounded-xl" : !selecionando && "group-hover:scale-[1.04]",
        )}
      />
      {item.tipo === "video" && (
        <span className="absolute right-1.5 bottom-1.5 flex items-center gap-1 rounded-full bg-ocean-deep/70 px-2 py-0.5 text-[11px] font-bold text-white backdrop-blur-sm">
          <Play className="size-3 fill-current" />
          {duracao(item.duracaoS)}
        </span>
      )}
      {item.dataAproximada && !selecionando && (
        <span
          title={t.dataAproximada}
          className="absolute top-1.5 left-1.5 grid size-5 place-items-center rounded-full bg-coral text-[13px] leading-none font-bold text-white shadow"
        >
          ≈
        </span>
      )}
      {selecionando && (
        <span
          aria-hidden
          className={cn(
            "absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-full transition-all duration-200",
            selecionado
              ? "bg-aqua text-white shadow-md ring-2 ring-white"
              : "bg-black/15 ring-2 ring-white/90 backdrop-blur-[1px]",
          )}
        >
          {selecionado && <Check className="size-4" strokeWidth={3} />}
        </span>
      )}
    </button>
  );
});

interface SecaoProps {
  dia: ResumoDia;
  itens: MediaItem[] | undefined;
  autor: string | null;
  /** quem está usando o aparelho: o que essa pessoa enviou não vai no ZIP */
  eu: string;
  selecao: Selecao;
  onVisivel: (dia: string) => void;
  onAbrir: (m: MediaItem) => void;
}

const SecaoDia = memo(function SecaoDia({ dia, itens, autor, eu, selecao, onVisivel, onAbrir }: SecaoProps) {
  const t = useT();
  const idioma = useIdioma();
  const ref = useRef<HTMLElement>(null);
  const [baixando, setBaixando] = useState(false);
  const [salvarAberto, setSalvarAberto] = useState(false);
  const modoCelular = modoSalvarNoCelular();

  // Carrega o dia quando ele chega perto da tela (800px de folga).
  useEffect(() => {
    if (itens || !ref.current) return;
    const obs = new IntersectionObserver(
      (entradas) => entradas.some((e) => e.isIntersecting) && onVisivel(dia.dia),
      { rootMargin: "800px 0px" },
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [itens, dia.dia, onVisivel]);

  function aoTocarBaixar() {
    if (modoCelular) setSalvarAberto(true);
    else void baixarZip();
  }

  async function baixarZip() {
    setSalvarAberto(false);
    setBaixando(true);
    try {
      await baixarDia(dia.dia, autor, excluir);
    } catch (e) {
      alert(t.erroZip(e instanceof Error ? e.message : String(e)));
    } finally {
      setTimeout(() => setBaixando(false), 2500);
    }
  }

  // Filtrando pelas próprias fotos, a intenção é baixá-las: aí não exclui nada.
  const meuNome = normalizarNome(eu);
  const excluir = eu && !(autor && normalizarNome(autor) === meuNome) ? eu : null;
  const semOsMeus = useMemo(
    () => (itens ?? []).filter((i) => !excluir || normalizarNome(i.enviadoPor) !== meuNome),
    [itens, excluir, meuNome],
  );
  // No celular também pula o que já foi salvo neste aparelho (as fotos com o ✓ verde),
  // para não duplicar na galeria quem volta para salvar o dia depois.
  const baixados = useBaixados();
  const listaParaBaixar = useMemo(
    () => (modoCelular ? semOsMeus.filter((i) => !baixados.has(i.id)) : semOsMeus),
    [modoCelular, semOsMeus, baixados],
  );
  const paraBaixar = listaParaBaixar.length;
  const algumMeu = !!itens && semOsMeus.length < itens.length;
  const algumJaSalvo = listaParaBaixar.length < semOsMeus.length;

  const idsDoDia = useMemo(() => (itens ?? []).map((i) => i.id), [itens]);
  const diaTodoMarcado = idsDoDia.length > 0 && idsDoDia.every((id) => selecao.ids.has(id));

  const fotos = itens?.filter((i) => i.tipo === "foto").length ?? 0;
  const videos = (itens?.length ?? 0) - fotos;
  const legenda = itens
    ? [fotos > 0 && t.fotos(fotos), videos > 0 && t.videos(videos)].filter(Boolean).join(" · ")
    : t.itens(dia.total);

  return (
    <section ref={ref} id={`dia-${dia.dia}`} className="scroll-mt-14">
      <header className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 -mx-4 flex items-center justify-between gap-3 bg-sand/90 px-4 py-3 backdrop-blur-lg sm:mx-0 sm:rounded-b-2xl">
        <div className="min-w-0">
          <h2 className="truncate font-display text-xl font-semibold text-ocean sm:text-2xl">{tituloDia(dia.dia, idioma)}</h2>
          <p className="text-xs font-medium text-muted-foreground">
            {legenda} · {tamanho(dia.bytes, idioma)}
          </p>
        </div>
        {selecao.ativa ? (
          <button
            onClick={() => selecao.marcarVarios(idsDoDia, !diaTodoMarcado)}
            disabled={!itens}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold transition-all active:scale-95 disabled:opacity-60",
              diaTodoMarcado ? "bg-aqua text-white shadow-sm" : "bg-card text-teal ring-1 ring-border hover:bg-accent",
            )}
          >
            <CheckCheck className="size-4" />
            {diaTodoMarcado ? t.desmarcarDia : t.selecionarDia}
          </button>
        ) : (
        <button
          onClick={aoTocarBaixar}
          disabled={baixando || !itens || paraBaixar === 0}
          title={algumJaSalvo ? t.semOsJaSalvos : algumMeu ? t.semOsSeus : undefined}
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-card px-3 py-2 text-xs font-bold text-teal ring-1 ring-border transition-all hover:bg-accent active:scale-95 disabled:opacity-60"
        >
          {baixando ? (
            <Loader2 className="size-4 animate-spin" />
          ) : itens && paraBaixar === 0 ? (
            <Check className="size-4" />
          ) : (
            <Download className="size-4" />
          )}
          {itens && paraBaixar === 0
            ? algumJaSalvo
              ? t.tudoJaSalvo
              : t.tudoSeu
            : algumJaSalvo
              ? t.salvarNovas(paraBaixar)
              : algumMeu
              ? (modoCelular ? t.salvarDosOutros : t.baixarDosOutros)(paraBaixar)
              : modoCelular
                ? t.salvarDia
                : t.baixarDia}
        </button>
        )}
      </header>

      <div className="-mx-4 grid grid-cols-3 gap-0.5 sm:mx-0 sm:grid-cols-4 sm:gap-1 sm:overflow-hidden sm:rounded-2xl md:grid-cols-5 lg:grid-cols-6">
        {itens
          ? itens.map((m) => (
              <Miniatura
                key={m.id}
                item={m}
                selecionando={selecao.ativa}
                selecionado={selecao.ids.has(m.id)}
                onAbrir={onAbrir}
                onAlternar={selecao.alternar}
                onIniciarSelecao={selecao.iniciar}
              />
            ))
          : Array.from({ length: Math.min(dia.total, 60) }, (_, i) => (
              <div key={i} className="aspect-square animate-pulse bg-muted" style={{ animationDelay: `${(i % 6) * 80}ms` }} />
            ))}
      </div>

      {modoCelular && (
        <DialogoSalvarDia
          aberto={salvarAberto}
          modo={modoCelular}
          titulo={tituloDia(dia.dia, idioma)}
          itens={listaParaBaixar}
          onFechar={() => setSalvarAberto(false)}
          onZip={() => void baixarZip()}
        />
      )}
    </section>
  );
});

interface Props {
  dias: ResumoDia[];
  porDia: Record<string, MediaItem[]>;
  autor: string | null;
  eu: string;
  selecao: Selecao;
  onVisivel: (dia: string) => void;
  onAbrir: (m: MediaItem) => void;
}

export function Galeria({ dias, porDia, autor, eu, selecao, onVisivel, onAbrir }: Props) {
  return (
    <div className="flex flex-col gap-6">
      {dias.map((d) => (
        <SecaoDia key={d.dia} dia={d} itens={porDia[d.dia]} autor={autor} eu={eu} selecao={selecao} onVisivel={onVisivel} onAbrir={onAbrir} />
      ))}
    </div>
  );
}

/** Atalhos para pular direto a um dia. */
export function NavegacaoDias({ dias }: { dias: ResumoDia[] }) {
  const t = useT();
  const idioma = useIdioma();
  if (dias.length < 2) return null;
  return (
    <nav className="sem-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-1" aria-label={t.diasViagem}>
      {dias.map((d) => {
        const { semana, numero } = partesDia(d.dia, idioma);
        return (
          <a
            key={d.dia}
            href={`#dia-${d.dia}`}
            className="flex shrink-0 flex-col items-center rounded-2xl bg-secondary px-3.5 py-2 text-ocean transition-all hover:bg-accent active:scale-95"
          >
            <span className="text-[11px] font-bold tracking-wide uppercase opacity-70">{semana}</span>
            <span className="font-display text-lg leading-tight font-semibold">{numero}</span>
          </a>
        );
      })}
    </nav>
  );
}
