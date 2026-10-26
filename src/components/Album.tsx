import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Copy, Download, ImagePlus, Loader2, Plus, RefreshCw, X } from "lucide-react";
import type { MediaItem } from "../../shared/types";
import { BarraTopo } from "@/components/BarraTopo";
import { DialogoNome } from "@/components/DialogoNome";
import { FiltroPessoas } from "@/components/FiltroPessoas";
import { Galeria, NavegacaoDias, type Selecao } from "@/components/Galeria";
import { Aviso } from "@/components/Aviso";
import { DialogoSalvarDia, modoSalvarNoCelular } from "@/components/DialogoSalvarDia";
import { GavetaEnvio } from "@/components/GavetaEnvio";
import { HeroAlbum } from "@/components/HeroAlbum";
import { Rodape } from "@/components/Rodape";
import { Visualizador } from "@/components/Visualizador";
import { Button } from "@/components/ui/button";
import { useAlbum } from "@/hooks/useAlbum";
import { useFila } from "@/hooks/useFila";
import { api } from "@/lib/api";
import { FilaUpload } from "@/lib/fila-upload";
import { diaSP } from "@/lib/formato";
import { useT } from "@/lib/i18n";
import { useNome } from "@/lib/nome";
import { baixarZipDeItens } from "@/lib/zip";

export function Album({ onSair }: { onSair: () => void }) {
  const t = useT();
  const nome = useNome();
  const [filtro, setFiltro] = useState<string | null>(null);
  const album = useAlbum(filtro);
  const { resumo, porDia, itens, carregarDia, novoItem } = album;

  const fila = useMemo(() => new FilaUpload(), []);
  fila.autor = nome;
  useEffect(() => {
    fila.onConcluido = novoItem;
  }, [fila, novoItem]);
  const envio = useFila(fila);
  const enviados = envio.itens.filter((i) => i.status === "concluido" || i.status === "duplicado").length;
  const aRevisar = envio.itens.some((i) => i.status === "parecida");

  const [gaveta, setGaveta] = useState(false);
  const [editandoNome, setEditandoNome] = useState(false);
  const [aberto, setAberto] = useState<string | null>(null); // id do item no lightbox
  const indice = aberto ? itens.findIndex((i) => i.id === aberto) : -1;

  const abrir = useCallback((m: MediaItem) => setAberto(m.id), []);

  // Seleção múltipla para salvar várias fotos de uma vez (como na galeria do celular).
  const [selecionando, setSelecionando] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<string>>(() => new Set());
  const [salvandoSelecao, setSalvandoSelecao] = useState(false);
  const alternar = useCallback(
    (id: string) =>
      setSelecionados((prev) => {
        const n = new Set(prev);
        if (n.has(id)) n.delete(id);
        else n.add(id);
        return n;
      }),
    [],
  );
  const iniciarSelecao = useCallback((id: string) => {
    setSelecionando(true);
    setSelecionados(new Set([id]));
  }, []);
  const marcarVarios = useCallback(
    (ids: string[], marcar: boolean) =>
      setSelecionados((prev) => {
        const n = new Set(prev);
        for (const id of ids) {
          if (marcar) n.add(id);
          else n.delete(id);
        }
        return n;
      }),
    [],
  );
  const sairDaSelecao = useCallback(() => {
    setSelecionando(false);
    setSelecionados(new Set());
  }, []);
  const selecao: Selecao = useMemo(
    () => ({ ativa: selecionando, ids: selecionados, alternar, iniciar: iniciarSelecao, marcarVarios }),
    [selecionando, selecionados, alternar, iniciarSelecao, marcarVarios],
  );
  const itensSelecionados = useMemo(() => itens.filter((i) => selecionados.has(i.id)), [itens, selecionados]);
  useEffect(() => {
    if (!selecionando) return;
    const aoTeclar = (e: KeyboardEvent) => e.key === "Escape" && sairDaSelecao();
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [selecionando, sairDaSelecao]);

  // Lightbox chegou ao fim do que está carregado: puxa o próximo dia.
  const carregarProximoDia = useCallback(() => {
    if (!resumo || !itens.length) return;
    const ultimoDia = diaSP(itens[itens.length - 1].capturedAtUtc);
    const pos = resumo.dias.findIndex((d) => d.dia === ultimoDia);
    const proximo = resumo.dias.slice(pos + 1).find((d) => !porDia[d.dia]);
    if (proximo) void carregarDia(proximo.dia);
  }, [resumo, itens, porDia, carregarDia]);

  const aoExcluir = useCallback(
    (m: MediaItem) => {
      const i = itens.findIndex((x) => x.id === m.id);
      const vizinho = itens[i + 1] ?? itens[i - 1];
      setAberto(vizinho && vizinho.id !== m.id ? vizinho.id : null);
      album.removerItem(m);
    },
    [itens, album],
  );

  async function sair() {
    await api.logout().catch(() => undefined);
    onSair();
  }

  const totalGeral = resumo?.autores.reduce((s, a) => s + a.total, 0) ?? 0;

  return (
    <div id="topo" className="min-h-dvh">
      <BarraTopo nome={nome} onNome={() => setEditandoNome(true)} />
      <HeroAlbum resumo={resumo} onEnviar={() => setGaveta(true)} />

      <main className="mx-auto max-w-6xl px-4">
        {album.erro && (
          <div className="my-6 flex flex-col items-center gap-3 rounded-3xl bg-card p-6 text-center ring-1 ring-border">
            <p className="text-sm text-muted-foreground">{t.erroCarregar}</p>
            <Button variant="outline" onClick={() => void album.carregarResumo()}>
              <RefreshCw /> {t.tentarDeNovo}
            </Button>
          </div>
        )}

        {!resumo && !album.erro && (
          <div className="grid place-items-center py-16 text-teal">
            <Loader2 className="size-8 animate-spin" />
          </div>
        )}

        {resumo && totalGeral === 0 && (
          <div className="mx-auto my-8 flex max-w-sm flex-col items-center gap-4 rounded-[2rem] bg-card px-6 py-10 text-center shadow-sm ring-1 ring-border">
            <span className="grid size-16 place-items-center rounded-full bg-secondary text-teal">
              <ImagePlus className="size-8" />
            </span>
            <h2 className="font-display text-2xl font-semibold text-ocean">{t.vazioTitulo}</h2>
            <p className="text-sm text-muted-foreground">{t.vazioTexto}</p>
            <Button variant="coral" size="lg" onClick={() => setGaveta(true)}>
              <ImagePlus className="size-5" /> {t.enviarAgora}
            </Button>
          </div>
        )}

        {resumo && totalGeral > 0 && (
          <>
            <div className="flex flex-col gap-2 pt-2 pb-4">
              <NavegacaoDias dias={resumo.dias} />
              <FiltroPessoas
                autores={resumo.autores}
                total={totalGeral}
                selecionado={filtro}
                onSelecionar={setFiltro}
              />
            </div>
            <Galeria dias={resumo.dias} porDia={porDia} autor={filtro} eu={nome} selecao={selecao} onVisivel={carregarDia} onAbrir={abrir} />
          </>
        )}
      </main>

      {resumo && <Rodape />}

      {/* Seleção: barra embaixo com Cancelar · N selecionadas · Salvar */}
      {selecionando && (
        <div className="fixed inset-x-3 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-lg items-center gap-2 rounded-full bg-ocean-deep/95 p-2 text-white shadow-2xl ring-1 ring-white/10 backdrop-blur-md duration-300 animate-in fade-in slide-in-from-bottom-4">
          <button
            onClick={sairDaSelecao}
            aria-label={t.cancelar}
            className="grid size-11 shrink-0 place-items-center rounded-full bg-white/10 transition-colors hover:bg-white/20 active:scale-95"
          >
            <X className="size-5" />
          </button>
          <p className="min-w-0 flex-1 truncate text-center text-sm font-semibold">
            {t.selecionadas(selecionados.size)}
          </p>
          <button
            onClick={() => setSalvandoSelecao(true)}
            disabled={itensSelecionados.length === 0}
            className="flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-aqua px-5 text-sm font-bold text-ocean-deep transition-all active:scale-95 disabled:opacity-40"
          >
            <Download className="size-4" /> {t.salvar}
          </button>
        </div>
      )}

      {/* Botão flutuante "Selecionar", no canto oposto ao "Enviar" */}
      {!selecionando && totalGeral > 0 && (
        <button
          onClick={() => setSelecionando(true)}
          className="vidro-liquido fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-4 z-30 flex h-14 items-center gap-2 rounded-full pr-5 pl-4 font-bold text-white transition-transform active:scale-95"
        >
          <CheckCircle2 className="size-6 drop-shadow-[0_1px_2px_rgba(6,47,66,0.5)]" />
          <span className="drop-shadow-[0_1px_2px_rgba(6,47,66,0.55)]">{t.selecionar}</span>
        </button>
      )}

      {/* Botão flutuante de envio, com o progresso da fila */}
      {!selecionando && (
      <button
        onClick={() => setGaveta(true)}
        className="fixed right-4 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-30 flex h-14 items-center gap-2 rounded-full bg-coral pr-5 pl-4 font-bold text-white shadow-xl shadow-coral/35 transition-transform active:scale-95"
        aria-label={t.enviarFotosVideos}
      >
        {envio.ocupada ? (
          <Loader2 className="size-6 animate-spin" />
        ) : aRevisar ? (
          <Copy className="size-5" />
        ) : (
          <Plus className="size-6" />
        )}
        {envio.ocupada ? `${enviados}/${envio.itens.length}` : aRevisar ? t.revisar : t.enviar}
      </button>
      )}

      <DialogoSalvarDia
        aberto={salvandoSelecao}
        modo={modoSalvarNoCelular() ?? "baixar"}
        titulo={t.selecaoTitulo(itensSelecionados.length)}
        itens={itensSelecionados}
        onFechar={() => setSalvandoSelecao(false)}
        onConcluido={sairDaSelecao}
        onZip={() => {
          setSalvandoSelecao(false);
          void baixarZipDeItens(itensSelecionados).then(sairDaSelecao);
        }}
      />

      <Aviso />

      <GavetaEnvio aberta={gaveta} onAberta={setGaveta} fila={fila} itens={envio.itens} />

      <DialogoNome
        aberto={!nome || editandoNome}
        obrigatorio={!nome}
        nomeAtual={nome}
        onFechar={() => setEditandoNome(false)}
        onSair={sair}
      />

      <Visualizador
        itens={itens}
        indice={indice}
        autor={nome}
        onMudar={(i) => itens[i] && setAberto(itens[i].id)}
        onFechar={() => setAberto(null)}
        onPertoDoFim={carregarProximoDia}
        onExcluido={aoExcluir}
        onAtualizado={album.substituirItem}
      />
    </div>
  );
}
