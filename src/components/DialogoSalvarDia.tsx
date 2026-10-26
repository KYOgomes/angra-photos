import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Download, Loader2, Share } from "lucide-react";
import type { MediaItem } from "../../shared/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { urls } from "@/lib/api";
import { marcarBaixados } from "@/lib/baixados";
import { useT } from "@/lib/i18n";
import { ehIOS } from "@/lib/plataforma";

// Salvar o dia no celular sem ZIP.
// iPhone: baixa os originais e abre a folha de compartilhar com todos ("Salvar X itens" → Fotos),
//   em lotes para não estourar a memória do Safari.
// Android: baixa cada original direto (vão para Downloads e aparecem na Galeria).

const MAX_ARQUIVOS_LOTE = 25;
const MAX_BYTES_LOTE = 200 * 1024 * 1024;

export type ModoSalvar = "compartilhar" | "baixar";

/** Qual modo usar neste aparelho; null = computador (fica o ZIP). */
export function modoSalvarNoCelular(): ModoSalvar | null {
  if (typeof window === "undefined" || !window.matchMedia("(pointer: coarse)").matches) return null;
  if (ehIOS && typeof navigator.canShare === "function") return "compartilhar";
  return "baixar";
}

function emLotes(itens: MediaItem[]): MediaItem[][] {
  const lotes: MediaItem[][] = [];
  let atual: MediaItem[] = [];
  let bytes = 0;
  for (const m of itens) {
    if (atual.length && (atual.length >= MAX_ARQUIVOS_LOTE || bytes + m.tamanhoBytes > MAX_BYTES_LOTE)) {
      lotes.push(atual);
      atual = [];
      bytes = 0;
    }
    atual.push(m);
    bytes += m.tamanhoBytes;
  }
  if (atual.length) lotes.push(atual);
  return lotes;
}

const nomeArquivo = (m: MediaItem) => m.nomeOriginal || `${m.hash.slice(0, 12)}.${m.ext}`;
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Fase = "inicio" | "preparando" | "pronto" | "baixando" | "concluido" | "erro";

interface Props {
  aberto: boolean;
  modo: ModoSalvar;
  titulo: string;
  itens: MediaItem[];
  onFechar: () => void;
  /** chamado no OK depois de salvar tudo */
  onConcluido?: () => void;
  onZip: () => void;
}

const noCelular = () => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

export function DialogoSalvarDia({ aberto, modo, titulo, itens, onFechar, onConcluido, onZip }: Props) {
  const t = useT();
  const lotes = useMemo(() => emLotes(itens), [itens]);
  const [lote, setLote] = useState(0);
  const [fase, setFase] = useState<Fase>("inicio");
  const [feitos, setFeitos] = useState(0);
  const arquivos = useRef<File[]>([]);
  const cancelar = useRef<AbortController | null>(null);

  // Ao abrir: zera tudo. No iPhone já começa a preparar o primeiro lote.
  useEffect(() => {
    if (!aberto) {
      cancelar.current?.abort();
      arquivos.current = [];
      return;
    }
    setLote(0);
    setFeitos(0);
    setFase(modo === "compartilhar" ? "preparando" : "inicio");
  }, [aberto, modo]);

  // iPhone: baixa os arquivos do lote atual para a memória (3 por vez).
  useEffect(() => {
    if (!aberto || modo !== "compartilhar" || fase !== "preparando") return;
    const ctrl = new AbortController();
    cancelar.current = ctrl;
    const doLote = lotes[lote] ?? [];
    const prontos: File[] = new Array(doLote.length);
    let feitosNoLote = 0;
    let proximo = 0;
    const trabalhador = async () => {
      while (proximo < doLote.length) {
        const i = proximo++;
        const m = doLote[i];
        const res = await fetch(urls.original(m.id), { signal: ctrl.signal });
        if (!res.ok) throw new Error(String(res.status));
        prontos[i] = new File([await res.blob()], nomeArquivo(m), { type: m.mime });
        feitosNoLote++;
        setFeitos(lotes.slice(0, lote).reduce((s, l) => s + l.length, 0) + feitosNoLote);
      }
    };
    Promise.all([trabalhador(), trabalhador(), trabalhador()])
      .then(() => {
        arquivos.current = prontos;
        setFase("pronto");
      })
      .catch((e) => {
        if (!ctrl.signal.aborted) {
          console.error(e);
          setFase("erro");
        }
      });
    return () => ctrl.abort();
  }, [aberto, modo, fase, lote, lotes]);

  // Chamado direto no toque (o iOS exige o gesto para abrir a folha de compartilhar).
  async function compartilhar() {
    try {
      await navigator.share({ files: arquivos.current });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return; // fechou a folha sem salvar
      console.error(e);
      setFase("erro");
      return;
    }
    arquivos.current = [];
    marcarBaixados((lotes[lote] ?? []).map((m) => m.id));
    if (lote + 1 < lotes.length) {
      setLote(lote + 1);
      setFase("preparando");
    } else {
      setFase("concluido");
    }
  }

  // Android: um download por arquivo, com um respiro entre eles.
  async function baixarTodos() {
    setFase("baixando");
    for (let i = 0; i < itens.length; i++) {
      const a = document.createElement("a");
      a.href = urls.original(itens[i].id, true);
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      marcarBaixados([itens[i].id]);
      setFeitos(i + 1);
      await esperar(900);
    }
    setFase("concluido");
  }

  const total = itens.length;
  const doLoteAtual = lotes[lote]?.length ?? 0;

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent closeLabel={t.fechar}>
        {fase === "concluido" ? (
          <div className="flex flex-col items-center gap-4 py-2 text-center">
            <span className="grid size-24 place-items-center rounded-full bg-gradient-to-br from-aqua to-teal shadow-lg shadow-teal/30 duration-500 animate-in zoom-in-50">
              <Check className="size-12 text-white" strokeWidth={3} />
            </span>
            <DialogTitle>{t.pronto}</DialogTitle>
            <DialogDescription>
              {modo === "compartilhar"
                ? t.salvosTexto(total)
                : noCelular()
                  ? t.baixadosTexto(total)
                  : t.baixadosComputador(total)}
            </DialogDescription>
            <Button
              size="lg"
              className="w-full"
              onClick={() => {
                onConcluido?.();
                onFechar();
              }}
            >
              {t.ok}
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{t.salvarDiaTitulo(total)}</DialogTitle>
              <DialogDescription>{titulo}</DialogDescription>
            </DialogHeader>

            {lotes.length > 1 && modo === "compartilhar" && (
              <p className="text-sm font-semibold text-teal">{t.parteDe(lote + 1, lotes.length)}</p>
            )}

            {(fase === "preparando" || fase === "baixando") && (
              <div className="grid gap-2">
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  {fase === "preparando" ? t.preparandoN(feitos, total) : t.baixandoN(feitos, total)}
                </p>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-teal transition-[width] duration-300"
                    style={{ width: `${Math.max(3, (feitos / Math.max(total, 1)) * 100)}%` }}
                  />
                </div>
              </div>
            )}

            {fase === "erro" && <p className="text-sm text-destructive">{t.erroSalvarDia}</p>}

            {modo === "compartilhar" && fase === "pronto" && (
              <>
                <Button size="lg" variant="coral" onClick={compartilhar}>
                  <Share className="size-5" /> {t.salvarNoCelularN(doLoteAtual)}
                </Button>
                <p className="text-xs text-muted-foreground">{t.dicaIosSalvar(doLoteAtual)}</p>
              </>
            )}

            {modo === "baixar" && (fase === "inicio" || fase === "erro") && (
              <>
                <Button size="lg" variant="coral" onClick={baixarTodos}>
                  <Download className="size-5" /> {t.baixarNArquivos(total)}
                </Button>
                <p className="text-xs text-muted-foreground">{noCelular() ? t.dicaAndroid : t.dicaComputador}</p>
              </>
            )}

            {modo === "compartilhar" && fase === "erro" && (
              <Button size="lg" variant="outline" onClick={() => setFase("preparando")}>
                {t.tentarDeNovo}
              </Button>
            )}

            <button onClick={onZip} className="text-xs font-semibold text-teal underline underline-offset-2">
              {t.prefereZip}
            </button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
