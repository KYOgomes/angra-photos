import { type EntradaIndice, type MediaItem, type ParteConcluida, type TipoMidia } from "../../shared/types";
import { api, ErroApi, urls } from "./api";
import type { ErroEnvioInfo, EtapaPreparo } from "./i18n";
import { lerDataCaptura, type InfoCaptura } from "./data-captura";
import { sha256Arquivo } from "./hash";
import { gerarMiniaturas, type Miniaturas } from "./miniaturas";
import { acharParecida, dhashDaUrl } from "./parecidas";

export type StatusEnvio =
  | "fila"
  | "preparando"
  | "pronto"
  | "enviando"
  | "finalizando"
  | "concluido"
  | "duplicado"
  | "parecida" // parece já estar no álbum: espera a pessoa decidir
  | "erro";

export interface ItemEnvio {
  chave: string;
  arquivo: File;
  tipo: TipoMidia;
  status: StatusEnvio;
  /** 0..1 da etapa atual */
  progresso: number;
  etapa?: EtapaPreparo;
  erro?: ErroEnvioInfo;
  miniaturaUrl?: string;
  aproximada?: boolean;
  /** foto do álbum (ou deste envio) com que esta parece; enviadoPor null = deste mesmo envio */
  parecida?: { thumbSrc: string; enviadoPor: string | null };
}

interface Preparado {
  hash: string;
  mime: string;
  ext: string;
  captura: InfoCaptura;
  mini: Miniaturas;
}

interface EstadoMultipart {
  mediaId: string;
  uploadId: string;
  partSize: number;
  totalPartes: number;
  concluidas: Map<number, string>;
}

const PREPARACOES_SIMULTANEAS = 2; // hash + data + miniatura (pesado; 2 cabe na memória do celular)
const PREPARAR_A_FRENTE = 6; // quantos arquivos ficam prontos esperando envio (limita memória)
const ENVIOS_SIMULTANEOS = 4;
const PARTES_SIMULTANEAS = 3;
const INTERVALO_TELA_MS = 150; // progresso atualiza a tela no máximo ~7x/s

const MIME_POR_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  heic: "image/heic",
  heif: "image/heif",
  webp: "image/webp",
  gif: "image/gif",
  dng: "image/x-adobe-dng",
  mp4: "video/mp4",
  m4v: "video/x-m4v",
  mov: "video/quicktime",
  "3gp": "video/3gpp",
  webm: "video/webm",
};
const EXT_POR_MIME = Object.fromEntries(Object.entries(MIME_POR_EXT).map(([e, m]) => [m, e]));

function tipoDoArquivo(f: File): { mime: string; ext: string } | null {
  const extNome = f.name.match(/\.([a-z0-9]{1,5})$/i)?.[1]?.toLowerCase();
  const mime = f.type || (extNome ? MIME_POR_EXT[extNome] : "") || "";
  if (!/^(image|video)\//.test(mime)) return null;
  const ext = extNome ?? EXT_POR_MIME[mime] ?? (mime.startsWith("video/") ? "mp4" : "jpg");
  return { mime, ext };
}

class ErroEnvio extends Error {
  status: number;
  constructor(msg: string, status = 0) {
    super(msg);
    this.status = status;
  }
}

/** PUT direto no R2 (URL assinada) com progresso. Devolve o ETag. */
function put(
  url: string,
  corpo: Blob,
  contentType: string | null,
  signal: AbortSignal,
  onProgresso?: (bytes: number) => void,
): Promise<string | null> {
  return new Promise((ok, falha) => {
    if (signal.aborted) return falha(signal.reason);
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    if (contentType) xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (e) => onProgresso?.(e.loaded);
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? ok(xhr.getResponseHeader("ETag"))
        : falha(new ErroEnvio(`HTTP ${xhr.status}`, xhr.status));
    xhr.onerror = () => falha(new ErroEnvio("rede"));
    xhr.ontimeout = () => falha(new ErroEnvio("rede"));
    const abortar = () => {
      xhr.abort();
      falha(signal.reason);
    };
    signal.addEventListener("abort", abortar, { once: true });
    xhr.onloadend = () => signal.removeEventListener("abort", abortar);
    xhr.send(corpo);
  });
}

/** Repete em falha de rede/5xx com espera crescente (sinal do 4G oscila). */
async function comRetry<T>(fn: () => Promise<T>, signal: AbortSignal, tentativas = 4): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e) {
      const recuperavel = e instanceof ErroEnvio && (e.status === 0 || e.status >= 500 || e.status === 408);
      if (!recuperavel || i >= tentativas - 1 || signal.aborted) throw e;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
    }
  }
}

class ErroEtag extends Error {}

/** Erro → código; o texto é escolhido na tela, no idioma de quem está usando. */
function infoErro(e: unknown): ErroEnvioInfo {
  if (e instanceof ErroApi) {
    if (e.status === 401) return { tipo: "sessao" };
    return { tipo: "servidor", detalhe: e.codigo };
  }
  if (e instanceof ErroEnvio) {
    if (e.status === 0) return { tipo: "conexao" };
    if (e.status === 403) return { tipo: "expirou" };
    return { tipo: "falha", detalhe: e.message };
  }
  if (e instanceof ErroEtag) return { tipo: "etag" };
  if (e instanceof TypeError) return { tipo: "sem_conexao" };
  return { tipo: "desconhecido", detalhe: e instanceof Error ? e.message : "" };
}

/** Promise.all que, se um envio falhar de vez, cancela os outros da mesma tentativa. */
async function todosOuNenhum(signal: AbortSignal, tarefas: ((s: AbortSignal) => Promise<unknown>)[]) {
  const local = new AbortController();
  const repassar = () => local.abort(signal.reason);
  signal.addEventListener("abort", repassar, { once: true });
  try {
    await Promise.all(
      tarefas.map((t) =>
        t(local.signal).catch((e) => {
          local.abort(e);
          throw e;
        }),
      ),
    );
  } finally {
    signal.removeEventListener("abort", repassar);
  }
}

const ehAbort = (e: unknown) => e instanceof DOMException && e.name === "AbortError";

/**
 * Fila de envio, fora do React (sobrevive ao fechar a gaveta de upload).
 * Prepara 2 arquivos por vez (hash, data, miniaturas — pesado para o celular) e envia
 * até 4 em paralelo. O que já foi enviado nunca é perdido: o retry recomeça só o que falhou
 * (no multipart, só as partes que faltam).
 */
export class FilaUpload {
  private itens: ItemEnvio[] = [];
  private ouvintes = new Set<() => void>();
  private preparados = new Map<string, Preparado>();
  private multiparts = new Map<string, EstadoMultipart>();
  private controladores = new Map<string, AbortController>();
  private preparando = 0;
  private ativos = 0;
  private emissaoAgendada: ReturnType<typeof setTimeout> | null = null;
  /** índice das fotos do álbum, carregado uma vez por rodada de envio */
  private indice: Promise<Map<string, EntradaIndice>> | null = null;

  autor = "";
  onConcluido?: (m: MediaItem) => void;

  snapshot = () => this.itens;

  assinar = (fn: () => void) => {
    this.ouvintes.add(fn);
    return () => this.ouvintes.delete(fn);
  };

  get ocupada() {
    return this.itens.some((i) => ["fila", "preparando", "pronto", "enviando", "finalizando"].includes(i.status));
  }

  /** Adiciona arquivos; devolve quantos foram ignorados por não serem foto/vídeo. */
  adicionar(arquivos: File[]): number {
    // Nova rodada: recarrega o índice (outras pessoas podem ter enviado fotos nesse meio tempo).
    if (!this.ocupada) this.indice = null;
    const conhecidas = new Set(this.itens.map((i) => i.chave));
    let ignorados = 0;
    const novos: ItemEnvio[] = [];
    for (const arquivo of arquivos) {
      const t = tipoDoArquivo(arquivo);
      if (!t) {
        ignorados++;
        continue;
      }
      const chave = `${arquivo.name}:${arquivo.size}:${arquivo.lastModified}`;
      if (conhecidas.has(chave)) continue;
      conhecidas.add(chave);
      novos.push({
        chave,
        arquivo,
        tipo: t.mime.startsWith("video/") ? "video" : "foto",
        status: "fila",
        progresso: 0,
      });
    }
    this.itens = [...this.itens, ...novos];
    this.emitir();
    this.bombear();
    return ignorados;
  }

  tentarDeNovo(chave?: string) {
    this.itens = this.itens.map((i) =>
      i.status === "erro" && (!chave || i.chave === chave)
        ? { ...i, status: this.preparados.has(i.chave) ? "pronto" : "fila", erro: undefined, progresso: 0 }
        : i,
    );
    this.emitir();
    this.bombear();
  }

  remover(chave: string) {
    this.controladores.get(chave)?.abort(new DOMException("Cancelado", "AbortError"));
    const mp = this.multiparts.get(chave);
    if (mp) api.cancelar(mp.mediaId).catch(() => undefined);
    this.descartar(chave);
    this.itens = this.itens.filter((i) => i.chave !== chave);
    this.emitir();
    this.bombear();
  }

  /** Aviso de repetidas: "Ignorar repetidas". */
  ignorarParecidas() {
    for (const i of this.itens) if (i.status === "parecida") this.preparados.delete(i.chave);
    this.itens = this.itens.map((i) => (i.status === "parecida" ? { ...i, status: "duplicado", progresso: 1 } : i));
    this.emitir();
  }

  /** Aviso de repetidas: "Enviar mesmo assim". */
  enviarParecidas() {
    for (const i of this.itens) if (i.status === "parecida") this.registrarNoIndice(i);
    this.itens = this.itens.map((i) =>
      i.status === "parecida" ? { ...i, status: "pronto", parecida: undefined, progresso: 0 } : i,
    );
    this.emitir();
    this.bombear();
  }

  private carregarIndice(): Promise<Map<string, EntradaIndice>> {
    this.indice ??= (async () => {
      const mapa = new Map<string, EntradaIndice>();
      try {
        const { indice } = await api.indice();
        for (const e of indice) mapa.set(e.id, e);
        // Fotos enviadas antes desta função não têm phash: calcula pela miniatura e grava.
        const faltando = indice.filter((e) => !e.phash).slice(0, 300);
        const calculados: { id: string; phash: string }[] = [];
        for (const e of faltando) {
          const ph = await dhashDaUrl(urls.thumb(e.hash));
          if (ph) {
            e.phash = ph;
            calculados.push({ id: e.id, phash: ph });
          }
        }
        for (let i = 0; i < calculados.length; i += 100) {
          api.completarPhash(calculados.slice(i, i + 100)).catch(() => undefined);
        }
      } catch (e) {
        console.warn("Sem índice de fotos; a checagem de parecidas fica desligada nesta rodada.", e);
      }
      return mapa;
    })();
    return this.indice;
  }

  /** Inclui uma foto deste envio no índice (pega a mesma foto escolhida duas vezes no lote). */
  private registrarNoIndice(item: ItemEnvio) {
    const prep = this.preparados.get(item.chave);
    if (!prep?.mini.phash || !this.indice) return;
    void this.indice.then((m) =>
      m.set(`local:${item.chave}`, {
        id: `local:${item.chave}`,
        hash: prep.hash,
        phash: prep.mini.phash,
        capturedAtUtc: prep.captura.capturedAtUtc,
        aproximada: prep.captura.aproximada,
        enviadoPor: "",
      }),
    );
  }

  limparFinalizados() {
    for (const i of this.itens) if (i.status === "concluido" || i.status === "duplicado") this.descartar(i.chave);
    this.itens = this.itens.filter((i) => i.status !== "concluido" && i.status !== "duplicado");
    this.emitir();
  }

  private descartar(chave: string) {
    const item = this.itens.find((i) => i.chave === chave);
    if (item?.miniaturaUrl) URL.revokeObjectURL(item.miniaturaUrl);
    this.preparados.delete(chave);
    this.multiparts.delete(chave);
    this.controladores.delete(chave);
  }

  private emitir() {
    if (this.emissaoAgendada) {
      clearTimeout(this.emissaoAgendada);
      this.emissaoAgendada = null;
    }
    for (const fn of this.ouvintes) fn();
  }

  /** Mudança de status avisa a tela na hora; progresso é agrupado para não travar o celular. */
  private atualizar(chave: string, parcial: Partial<ItemEnvio>, soProgresso = false) {
    this.itens = this.itens.map((i) => (i.chave === chave ? { ...i, ...parcial } : i));
    if (!soProgresso) this.emitir();
    else this.emissaoAgendada ??= setTimeout(() => this.emitir(), INTERVALO_TELA_MS);
  }

  private bombear() {
    while (this.preparando < PREPARACOES_SIMULTANEAS) {
      const prontos = this.itens.filter((i) => i.status === "pronto").length;
      if (prontos + this.preparando >= PREPARAR_A_FRENTE) break;
      const proximo = this.itens.find((i) => i.status === "fila");
      if (!proximo) break;
      this.preparando++;
      // marca já como "preparando" para o laço não pegar o mesmo arquivo de novo
      this.atualizar(proximo.chave, { status: "preparando", etapa: "lendo", progresso: 0 });
      void this.preparar(proximo).finally(() => {
        this.preparando--;
        this.bombear();
      });
    }
    while (this.ativos < ENVIOS_SIMULTANEOS) {
      const proximo = this.itens.find((i) => i.status === "pronto");
      if (!proximo) break;
      this.ativos++;
      this.atualizar(proximo.chave, { status: "enviando", progresso: 0, etapa: undefined });
      void this.enviar(proximo).finally(() => {
        this.ativos--;
        this.bombear();
      });
    }
  }

  private controlador(chave: string) {
    const c = new AbortController();
    this.controladores.set(chave, c);
    return c.signal;
  }

  private async preparar(item: ItemEnvio) {
    const { chave, arquivo, tipo } = item;
    const signal = this.controlador(chave);
    try {
      const t = tipoDoArquivo(arquivo)!;
      const hash = await sha256Arquivo(arquivo, (p) => this.atualizar(chave, { progresso: p }, true), signal);

      // A checagem de duplicado vai ao servidor enquanto a data e a miniatura são lidas aqui.
      const verificacao = api.verificar(hash);
      verificacao.catch(() => undefined);
      this.atualizar(chave, { etapa: "data", progresso: 1 });
      const captura = await lerDataCaptura(arquivo, tipo);
      signal.throwIfAborted();
      if ((await verificacao).existe) {
        this.atualizar(chave, { status: "duplicado", progresso: 1, etapa: undefined });
        return;
      }

      this.atualizar(chave, { etapa: "miniatura" });
      const mini = await gerarMiniaturas(arquivo, tipo);
      signal.throwIfAborted();

      this.preparados.set(chave, { hash, mime: t.mime, ext: t.ext, captura, mini });
      const miniaturaUrl = URL.createObjectURL(mini.thumb);

      // Mesma foto já no álbum (ex.: cópia recomprimida pelo WhatsApp)? Segura e pergunta.
      if (mini.phash) {
        const indice = await this.carregarIndice();
        signal.throwIfAborted();
        const igual = acharParecida(
          { phash: mini.phash, capturedAtUtc: captura.capturedAtUtc, aproximada: captura.aproximada },
          indice.values(),
        );
        if (igual) {
          const local = igual.id.startsWith("local:")
            ? this.itens.find((i) => `local:${i.chave}` === igual.id)?.miniaturaUrl
            : undefined;
          this.atualizar(chave, {
            status: "parecida",
            etapa: undefined,
            progresso: 0,
            aproximada: captura.aproximada,
            miniaturaUrl,
            parecida: {
              thumbSrc: local ?? urls.thumb(igual.hash),
              enviadoPor: igual.id.startsWith("local:") ? null : igual.enviadoPor,
            },
          });
          return;
        }
      }

      this.atualizar(chave, {
        status: "pronto",
        etapa: undefined,
        progresso: 0,
        aproximada: captura.aproximada,
        miniaturaUrl,
      });
      this.registrarNoIndice({ ...item, chave });
    } catch (e) {
      if (ehAbort(e)) return;
      console.error(e);
      this.atualizar(chave, { status: "erro", erro: infoErro(e), etapa: undefined });
    }
  }

  private async enviar(item: ItemEnvio) {
    const { chave, arquivo } = item;
    const prep = this.preparados.get(chave)!;
    const signal = this.controlador(chave);
    const { mini, captura } = prep;
    const totalBytes = arquivo.size + mini.thumb.size + (mini.preview?.size ?? 0);
    const enviado = { thumb: 0, preview: 0, original: 0 };
    const reportar = () =>
      this.atualizar(
        chave,
        { progresso: Math.min(1, (enviado.thumb + enviado.preview + enviado.original) / totalBytes) },
        true,
      );
    const progresso = (bytesOriginal: number) => {
      enviado.original = bytesOriginal;
      reportar();
    };

    try {
      let mp = this.multiparts.get(chave);
      let midia: MediaItem | null = null;

      if (!mp) {
        const resp = await api.iniciar({
          hash: prep.hash,
          tipo: item.tipo,
          mime: prep.mime,
          ext: prep.ext,
          nomeOriginal: arquivo.name,
          tamanhoBytes: arquivo.size,
          largura: mini.largura,
          altura: mini.altura,
          duracaoS: mini.duracaoS ?? captura.duracaoS ?? null,
          capturedAtUtc: captura.capturedAtUtc,
          dataAproximada: captura.aproximada,
          fonteData: captura.fonte,
          enviadoPor: this.autor,
          temPreview: !!mini.preview,
          phash: mini.phash,
        });

        const tarefaThumb = (s: AbortSignal) =>
          comRetry(
            () =>
              put(resp.thumbUrl, mini.thumb, "image/jpeg", s, (b) => {
                enviado.thumb = b;
                reportar();
              }),
            s,
          );
        const tarefas = [tarefaThumb];
        if (resp.previewUrl && mini.preview) {
          const preview = mini.preview;
          const url = resp.previewUrl;
          tarefas.push((s) =>
            comRetry(
              () =>
                put(url, preview, "image/jpeg", s, (b) => {
                  enviado.preview = b;
                  reportar();
                }),
              s,
            ),
          );
        }

        if (resp.original.modo === "simples") {
          // Miniatura, preview e original sobem ao mesmo tempo.
          const url = resp.original.url;
          tarefas.push((s) => comRetry(() => put(url, arquivo, prep.mime, s, progresso), s));
          await todosOuNenhum(signal, tarefas);
          this.atualizar(chave, { status: "finalizando", progresso: 1 });
          midia = await api.concluir(resp.id);
        } else {
          // Vídeo grande: miniaturas primeiro (pequenas), depois as partes — o retry
          // do multipart pressupõe que as miniaturas já subiram.
          await todosOuNenhum(signal, tarefas);
          mp = { ...resp.original, mediaId: resp.id, concluidas: new Map() };
          this.multiparts.set(chave, mp);
        }
      } else {
        enviado.thumb = mini.thumb.size;
        enviado.preview = mini.preview?.size ?? 0;
      }

      if (mp) {
        await this.enviarPartes(mp, arquivo, signal, progresso);
        this.atualizar(chave, { status: "finalizando", progresso: 1 });
        const partes: ParteConcluida[] = [...mp.concluidas].map(([partNumber, etag]) => ({ partNumber, etag }));
        midia = await api.concluir(mp.mediaId, { uploadId: mp.uploadId, partes });
      }

      this.preparados.delete(chave);
      this.multiparts.delete(chave);
      this.atualizar(chave, { status: "concluido", progresso: 1, etapa: undefined });
      if (midia) this.onConcluido?.(midia);
    } catch (e) {
      if (ehAbort(e)) return;
      console.error(e);
      if (e instanceof ErroApi && e.codigo === "duplicado") {
        this.preparados.delete(chave);
        this.atualizar(chave, { status: "duplicado", progresso: 1 });
        return;
      }
      // Multipart perdido no servidor (expirou/limpo): o próximo retry recomeça do zero.
      if (e instanceof ErroApi && (e.status === 404 || e.status === 409)) this.multiparts.delete(chave);
      if (e instanceof ErroEnvio && e.status === 404) this.multiparts.delete(chave);
      this.atualizar(chave, { status: "erro", erro: infoErro(e) });
    }
  }

  /** Envia só as partes que faltam, 3 por vez, pedindo URLs assinadas em lotes. */
  private async enviarPartes(
    mp: EstadoMultipart,
    arquivo: File,
    signal: AbortSignal,
    progresso: (bytes: number) => void,
  ) {
    const tamanhoParte = (n: number) => Math.min(mp.partSize, arquivo.size - (n - 1) * mp.partSize);
    const faltando: number[] = [];
    for (let n = 1; n <= mp.totalPartes; n++) if (!mp.concluidas.has(n)) faltando.push(n);

    const emAndamento = new Map<number, number>();
    const reportar = () => {
      let bytes = 0;
      for (const n of mp.concluidas.keys()) bytes += tamanhoParte(n);
      for (const b of emAndamento.values()) bytes += b;
      progresso(bytes);
    };

    const urls = new Map<number, string>();
    let urlsEm = 0;
    const urlDa = async (n: number) => {
      // URLs valem 1h; renova o lote se ficou velho (vídeo enorme em 4G lento).
      if (!urls.has(n) || Date.now() - urlsEm > 45 * 60_000) {
        const lote = faltando.filter((x) => !mp.concluidas.has(x) && x >= n).slice(0, 30);
        const resp = await api.partes(mp.mediaId, mp.uploadId, lote);
        urlsEm = Date.now();
        for (const [k, v] of Object.entries(resp.urls)) urls.set(Number(k), v);
      }
      return urls.get(n)!;
    };

    // Se uma parte falha de vez, as outras param também (o retry retoma de onde parou).
    const local = new AbortController();
    const repassar = () => local.abort(signal.reason);
    signal.addEventListener("abort", repassar, { once: true });

    let cursor = 0;
    const trabalhador = async () => {
      while (cursor < faltando.length) {
        local.signal.throwIfAborted();
        const n = faltando[cursor++];
        const inicio = (n - 1) * mp.partSize;
        const pedaco = arquivo.slice(inicio, inicio + tamanhoParte(n));
        const etag = await comRetry(async () => {
          const url = await urlDa(n);
          return put(url, pedaco, null, local.signal, (b) => {
            emAndamento.set(n, b);
            reportar();
          });
        }, local.signal);
        emAndamento.delete(n);
        if (!etag) throw new ErroEtag("ETag ausente: confira o CORS do bucket (ExposeHeaders: ETag)");
        mp.concluidas.set(n, etag);
        reportar();
      }
    };
    try {
      await Promise.all(
        Array.from({ length: PARTES_SIMULTANEAS }, () =>
          trabalhador().catch((e) => {
            local.abort(e);
            throw e;
          }),
        ),
      );
    } finally {
      signal.removeEventListener("abort", repassar);
    }
  }
}
