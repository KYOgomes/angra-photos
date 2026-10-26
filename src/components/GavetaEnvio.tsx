import { memo, useState, type DragEvent } from "react";
import { AlertCircle, Check, CheckCircle2, Copy, Film, ImagePlus, Info, Loader2, RotateCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import type { FilaUpload, ItemEnvio } from "@/lib/fila-upload";
import { tamanho } from "@/lib/formato";
import { useIdioma, useT } from "@/lib/i18n";
import { ehIOS } from "@/lib/plataforma";
import { cn } from "@/lib/utils";

type Textos = ReturnType<typeof useT>;

function textoStatus(i: ItemEnvio, t: Textos): string {
  const pct = Math.round(i.progresso * 100);
  switch (i.status) {
    case "fila":
      return t.status.fila;
    case "preparando":
      return i.etapa === "data" ? t.status.data : i.etapa === "miniatura" ? t.status.miniatura : t.status.lendo(pct);
    case "pronto":
      return t.status.pronto;
    case "enviando":
      return t.status.enviando(pct);
    case "finalizando":
      return t.status.finalizando;
    case "concluido":
      return t.status.concluido;
    case "duplicado":
      return t.status.duplicado;
    case "parecida":
      return t.pareceCom(i.parecida?.enviadoPor ?? null);
    case "erro":
      return i.erro ? t.erroEnvio(i.erro) : t.status.erro;
  }
}

// memo: com centenas de arquivos, só as linhas que mudaram redesenham.
const LinhaEnvio = memo(function LinhaEnvio({ item, fila }: { item: ItemEnvio; fila: FilaUpload }) {
  const t = useT();
  const idioma = useIdioma();
  const ativo = ["preparando", "enviando", "finalizando"].includes(item.status);
  return (
    <li className="flex items-center gap-3 py-2.5">
      <div className="relative size-12 shrink-0 overflow-hidden rounded-xl bg-muted">
        {item.miniaturaUrl ? (
          <img src={item.miniaturaUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center text-muted-foreground">
            {item.tipo === "video" ? <Film className="size-5" /> : <ImagePlus className="size-5" />}
          </div>
        )}
        {item.status === "concluido" && (
          <div className="absolute inset-0 grid place-items-center bg-teal/60">
            <CheckCircle2 className="size-6 text-white" />
          </div>
        )}
      </div>
      {item.status === "parecida" && item.parecida && (
        <>
          <span className="-mx-1.5 text-lg font-bold text-coral" aria-hidden>
            ≈
          </span>
          <div className="relative size-12 shrink-0 overflow-hidden rounded-xl bg-muted ring-2 ring-coral/60">
            <img src={item.parecida.thumbSrc} alt={t.noAlbum} className="h-full w-full object-cover" />
          </div>
        </>
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ocean">{item.arquivo.name}</p>
        <p
          className={cn(
            "truncate text-xs",
            item.status === "erro" ? "font-semibold text-destructive" : "text-muted-foreground",
            item.status === "parecida" && "font-semibold text-coral",
            item.status === "concluido" && "font-semibold text-teal",
          )}
        >
          {item.status === "duplicado" && <Copy className="mr-1 inline size-3" />}
          {textoStatus(item, t)} · {tamanho(item.arquivo.size, idioma)}
          {item.aproximada && item.status !== "erro" && (
            <span className="ml-1 text-coral">· {t.dataAproximadaCurta}</span>
          )}
        </p>
        {(ativo || item.status === "pronto") && (
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-[width] duration-300",
                item.status === "preparando" ? "bg-aqua/70" : "bg-teal",
              )}
              style={{ width: `${Math.max(3, item.progresso * 100)}%` }}
            />
          </div>
        )}
      </div>

      {item.status === "erro" && (
        <Button size="icon" variant="secondary" onClick={() => fila.tentarDeNovo(item.chave)} aria-label={t.tentarDeNovo}>
          <RotateCw />
        </Button>
      )}
      {item.status !== "concluido" && item.status !== "duplicado" && item.status !== "parecida" && (
        <Button
          size="icon"
          variant="ghost"
          onClick={() => fila.remover(item.chave)}
          aria-label={t.removerFila}
          className="text-muted-foreground"
        >
          <X />
        </Button>
      )}
    </li>
  );
});

/** Tela de conclusão: círculo verde-água com ✓ e um OK que fecha a gaveta. */
function Finalizado({ enviados, duplicados, onOk }: { enviados: number; duplicados: number; onOk: () => void }) {
  const t = useT();
  return (
    <div className="flex flex-col items-center gap-5 px-6 pt-6 pb-[max(2rem,env(safe-area-inset-bottom))] text-center">
      <div className="relative grid size-32 place-items-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-aqua/30 [animation-iteration-count:2]" />
        <span className="relative grid size-32 place-items-center rounded-full bg-gradient-to-br from-aqua to-teal shadow-xl shadow-teal/30 duration-500 animate-in zoom-in-50 fade-in">
          <Check className="size-16 text-white" strokeWidth={3} />
        </span>
      </div>
      <div className="flex flex-col gap-1.5 duration-500 animate-in fade-in slide-in-from-bottom-2">
        <SheetTitle className="text-3xl">{t.finalizado}</SheetTitle>
        <SheetDescription className="text-base font-semibold text-teal">
          {t.finalizadoTexto(enviados, duplicados)}
        </SheetDescription>
        <p className="text-sm text-muted-foreground">{t.finalizadoSub}</p>
      </div>
      <Button size="lg" onClick={onOk} className="w-full max-w-xs text-base" autoFocus>
        {t.ok}
      </Button>
    </div>
  );
}

interface Props {
  aberta: boolean;
  onAberta: (v: boolean) => void;
  fila: FilaUpload;
  itens: ItemEnvio[];
}

export function GavetaEnvio({ aberta, onAberta, fila, itens }: Props) {
  const t = useT();
  const [ignorados, setIgnorados] = useState(0);
  const [arrastando, setArrastando] = useState(false);

  function adicionar(lista: FileList | null) {
    if (!lista?.length) return;
    setIgnorados(fila.adicionar([...lista]));
  }

  function soltar(e: DragEvent) {
    e.preventDefault();
    setArrastando(false);
    adicionar(e.dataTransfer.files);
  }

  const enviados = itens.filter((i) => i.status === "concluido").length;
  const duplicados = itens.filter((i) => i.status === "duplicado").length;
  const erros = itens.filter((i) => i.status === "erro").length;
  const parecidas = itens.filter((i) => i.status === "parecida").length;
  const ocupada = fila.ocupada;
  const finalizado = itens.length > 0 && !ocupada && erros === 0 && parecidas === 0;
  // progresso geral: itens prontos contam inteiros, os em andamento pela fração
  const progressoGeral = itens.length
    ? itens.reduce(
        (soma, i) =>
          soma +
          (i.status === "concluido" || i.status === "duplicado" || i.status === "erro" || i.status === "parecida"
            ? 1
            : i.status === "enviando" || i.status === "finalizando"
              ? i.progresso
              : 0),
        0,
      ) / itens.length
    : 0;

  // Fechar depois de tudo enviado (OK, X ou tocar fora) zera a lista para o próximo envio.
  function mudarAberta(v: boolean) {
    if (!v && finalizado) {
      fila.limparFinalizados();
      setIgnorados(0);
    }
    onAberta(v);
  }

  return (
    <Sheet open={aberta} onOpenChange={mudarAberta}>
      <SheetContent closeLabel={t.fechar}>
        {finalizado ? (
          <Finalizado enviados={enviados} duplicados={duplicados} onOk={() => mudarAberta(false)} />
        ) : (
          <>
            <div className="px-5 pt-3 pb-2">
              <SheetTitle>{t.enviarFotosVideos}</SheetTitle>
              <SheetDescription>{t.enviarSub}</SheetDescription>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
              {ocupada ? (
                <div className="flex flex-col items-center gap-2 rounded-3xl border-2 border-teal/25 bg-secondary/60 px-4 py-6 text-center">
                  <span className="grid size-14 place-items-center rounded-full bg-teal/15 text-teal">
                    <Loader2 className="size-7 animate-spin" />
                  </span>
                  <span className="font-display text-lg font-semibold text-ocean">{t.aguardandoEnvio}</span>
                  <span className="text-sm font-semibold text-teal">
                    {t.enviandoDe(enviados + duplicados, itens.length)}
                  </span>
                  <div className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-teal transition-[width] duration-500"
                      style={{ width: `${Math.max(4, progressoGeral * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">{t.aguardandoTexto}</span>
                </div>
              ) : (
              <label
                onDragOver={(e) => {
                  e.preventDefault();
                  setArrastando(true);
                }}
                onDragLeave={() => setArrastando(false)}
                onDrop={soltar}
                className={cn(
                  "flex cursor-pointer flex-col items-center gap-2 rounded-3xl border-2 border-dashed border-teal/40 bg-secondary/60 px-4 py-7 text-center transition-colors hover:bg-secondary active:scale-[0.99]",
                  arrastando && "border-teal bg-accent",
                )}
              >
                <span className="grid size-14 place-items-center rounded-full bg-teal text-white shadow-lg shadow-teal/30">
                  <ImagePlus className="size-7" />
                </span>
                <span className="font-display text-lg font-semibold text-ocean">{t.escolherGaleria}</span>
                <span className="text-xs text-muted-foreground">{t.variasDeUmaVez}</span>
                <input
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  className="sr-only"
                  onChange={(e) => {
                    adicionar(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
              )}

              {ehIOS && !ocupada && (
                <p className="flex gap-2 rounded-2xl bg-coral-soft/70 px-3.5 py-2.5 text-xs leading-relaxed text-[#7a2a1d]">
                  <Info className="mt-0.5 size-4 shrink-0" />
                  <span>{t.dicaIphone}</span>
                </p>
              )}
              {ignorados > 0 && <p className="text-xs font-semibold text-destructive">{t.ignorados(ignorados)}</p>}

              {parecidas > 0 && (
                <div className="flex flex-col gap-3 rounded-3xl bg-coral-soft/80 p-4 ring-1 ring-coral/30 duration-300 animate-in fade-in slide-in-from-top-1">
                  <div className="flex gap-2.5">
                    <Copy className="mt-0.5 size-5 shrink-0 text-coral" />
                    <div>
                      <p className="font-display text-lg leading-snug font-semibold text-ocean">
                        {t.avisoRepetidasTitulo(parecidas)}
                      </p>
                      <p className="text-xs text-[#7a2a1d]">{t.avisoRepetidasTexto}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button onClick={() => fila.ignorarParecidas()}>{t.ignorarRepetidas}</Button>
                    <Button variant="outline" onClick={() => fila.enviarParecidas()}>
                      {t.enviarMesmoAssim}
                    </Button>
                  </div>
                </div>
              )}

              {itens.length > 0 && (
                <>
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <p className="text-sm font-semibold text-ocean">
                      {t.enviadosDe(enviados + duplicados, itens.length)}
                      {erros > 0 && <span className="text-destructive"> · {t.comErro(erros)}</span>}
                    </p>
                    <div className="flex gap-1.5">
                      {erros > 0 && (
                        <Button size="sm" variant="secondary" onClick={() => fila.tentarDeNovo()}>
                          <RotateCw /> {t.tentarTodos}
                        </Button>
                      )}
                      {enviados + duplicados > 0 && (
                        <Button size="sm" variant="ghost" onClick={() => fila.limparFinalizados()}>
                          {t.limpar}
                        </Button>
                      )}
                    </div>
                  </div>
                  {ocupada && (
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <AlertCircle className="size-3.5 shrink-0" /> {t.mantenhaAberto}
                    </p>
                  )}
                  <ul className="divide-y divide-border">
                    {itens.map((i) => (
                      <LinhaEnvio key={i.chave} item={i} fila={fila} />
                    ))}
                  </ul>
                </>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
