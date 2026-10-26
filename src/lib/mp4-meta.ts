// Leitor mínimo de MP4/MOV (ISO BMFF / QuickTime) para a data de criação do vídeo.
//
// Lê só os cabeçalhos das caixas de topo e a caixa `moov` (alguns KB, mesmo em vídeos
// de vários GB), sem carregar o `mdat`. Fontes, em ordem de preferência:
//  1. moov/meta (keys + ilst) → "com.apple.quicktime.creationdate": iPhone, já com fuso
//     (ex.: "2026-01-03T14:22:10-0300").
//  2. moov/mvhd → creation_time: segundos desde 1904-01-01, em UTC.

export interface MetaVideo {
  criacaoUtc?: string;
  fonte?: "quicktime" | "mvhd";
  duracaoS?: number;
}

interface Caixa {
  tipo: string;
  inicio: number;
  tamanho: number;
  cabecalho: number;
}

const EPOCA_1904 = 2_082_844_800;
const MAX_MOOV = 64 * 1024 * 1024;
const utf8 = new TextDecoder();

function fourcc(dv: DataView, o: number): string {
  return String.fromCharCode(dv.getUint8(o), dv.getUint8(o + 1), dv.getUint8(o + 2), dv.getUint8(o + 3));
}

async function ler(arquivo: Blob, inicio: number, fim: number): Promise<DataView> {
  return new DataView(await arquivo.slice(inicio, fim).arrayBuffer());
}

/** Procura uma caixa de topo pulando de cabeçalho em cabeçalho (16 bytes por leitura). */
async function caixaTopo(arquivo: Blob, tipo: string): Promise<Caixa | null> {
  let pos = 0;
  for (let i = 0; i < 2000 && pos + 8 <= arquivo.size; i++) {
    const dv = await ler(arquivo, pos, pos + 16);
    let tamanho = dv.getUint32(0);
    const t = fourcc(dv, 4);
    let cabecalho = 8;
    if (tamanho === 1) {
      if (dv.byteLength < 16) return null;
      tamanho = Number(dv.getBigUint64(8));
      cabecalho = 16;
    } else if (tamanho === 0) {
      tamanho = arquivo.size - pos;
    }
    if (tamanho < cabecalho) return null;
    if (t === tipo) return { tipo: t, inicio: pos, tamanho, cabecalho };
    pos += tamanho;
  }
  return null;
}

/** Caixas filhas dentro de um buffer já carregado. */
function filhas(dv: DataView, inicio: number, fim: number): Caixa[] {
  const lista: Caixa[] = [];
  let pos = inicio;
  while (pos + 8 <= fim) {
    let tamanho = dv.getUint32(pos);
    let cabecalho = 8;
    if (tamanho === 1 && pos + 16 <= fim) {
      tamanho = Number(dv.getBigUint64(pos + 8));
      cabecalho = 16;
    } else if (tamanho === 0) {
      tamanho = fim - pos;
    }
    if (tamanho < cabecalho || pos + tamanho > fim) break;
    lista.push({ tipo: fourcc(dv, pos + 4), inicio: pos, tamanho, cabecalho });
    pos += tamanho;
  }
  return lista;
}

const plausivel = (ms: number) => ms > Date.UTC(2000, 0, 1) && ms < Date.now() + 86_400_000;

function lerMvhd(dv: DataView, c: Caixa): { criacaoMs?: number; duracaoS?: number } {
  const o = c.inicio + c.cabecalho;
  const versao = dv.getUint8(o);
  let criacao: number, escala: number, duracao: number;
  if (versao === 1) {
    criacao = Number(dv.getBigUint64(o + 4));
    escala = dv.getUint32(o + 20);
    duracao = Number(dv.getBigUint64(o + 24));
  } else {
    criacao = dv.getUint32(o + 4);
    escala = dv.getUint32(o + 12);
    duracao = dv.getUint32(o + 16);
  }
  const ms = (criacao - EPOCA_1904) * 1000;
  return {
    criacaoMs: criacao > 0 && plausivel(ms) ? ms : undefined,
    duracaoS: escala > 0 ? duracao / escala : undefined,
  };
}

/** Lê um item da metadata QuickTime (moov/meta com hdlr 'mdta', keys e ilst). */
function lerChaveQuickTime(dv: DataView, meta: Caixa, chave: string): string | null {
  let ini = meta.inicio + meta.cabecalho;
  const fim = meta.inicio + meta.tamanho;
  // No MOV da Apple o `meta` não tem version/flags; no estilo MP4 (FullBox) tem 4 bytes a mais.
  if (ini + 8 <= fim && fourcc(dv, ini + 4) !== "hdlr") ini += 4;
  const caixas = filhas(dv, ini, fim);

  const keys = caixas.find((c) => c.tipo === "keys");
  const ilst = caixas.find((c) => c.tipo === "ilst");
  if (!keys || !ilst) return null;

  let indice = -1;
  let p = keys.inicio + keys.cabecalho + 4; // pula version/flags
  const total = dv.getUint32(p);
  p += 4;
  for (let i = 1; i <= total && p + 8 <= keys.inicio + keys.tamanho; i++) {
    const tam = dv.getUint32(p);
    if (tam < 8) break;
    const nome = utf8.decode(new Uint8Array(dv.buffer, dv.byteOffset + p + 8, tam - 8));
    if (nome === chave) indice = i;
    p += tam;
  }
  if (indice < 0) return null;

  for (const item of filhas(dv, ilst.inicio + ilst.cabecalho, ilst.inicio + ilst.tamanho)) {
    if (dv.getUint32(item.inicio + 4) !== indice) continue;
    const data = filhas(dv, item.inicio + item.cabecalho, item.inicio + item.tamanho).find((c) => c.tipo === "data");
    if (!data) return null;
    const o = data.inicio + data.cabecalho;
    const tipoValor = dv.getUint32(o) & 0xffffff; // 1 = UTF-8
    if (tipoValor !== 1) return null;
    return utf8.decode(new Uint8Array(dv.buffer, dv.byteOffset + o + 8, data.inicio + data.tamanho - o - 8));
  }
  return null;
}

/** "2026-01-03T14:22:10-0300" → ISO UTC (aceita também "-03:00" e "Z"). */
function dataApple(valor: string): number | null {
  const normal = valor.trim().replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
  const t = Date.parse(normal);
  return Number.isNaN(t) || !plausivel(t) ? null : t;
}

export async function lerMetaVideo(arquivo: Blob): Promise<MetaVideo> {
  const moov = await caixaTopo(arquivo, "moov");
  if (!moov || moov.tamanho > MAX_MOOV) return {};
  const dv = await ler(arquivo, moov.inicio, moov.inicio + moov.tamanho);
  const caixas = filhas(dv, moov.cabecalho, dv.byteLength);
  const resultado: MetaVideo = {};

  const mvhd = caixas.find((c) => c.tipo === "mvhd");
  if (mvhd) {
    const { criacaoMs, duracaoS } = lerMvhd(dv, mvhd);
    resultado.duracaoS = duracaoS;
    if (criacaoMs) {
      resultado.criacaoUtc = new Date(criacaoMs).toISOString();
      resultado.fonte = "mvhd";
    }
  }

  const metas = [
    ...caixas.filter((c) => c.tipo === "meta"),
    ...caixas
      .filter((c) => c.tipo === "udta")
      .flatMap((u) => filhas(dv, u.inicio + u.cabecalho, u.inicio + u.tamanho).filter((c) => c.tipo === "meta")),
  ];
  for (const meta of metas) {
    const valor = lerChaveQuickTime(dv, meta, "com.apple.quicktime.creationdate");
    const t = valor ? dataApple(valor) : null;
    if (t) {
      resultado.criacaoUtc = new Date(t).toISOString();
      resultado.fonte = "quicktime";
      break;
    }
  }
  return resultado;
}
