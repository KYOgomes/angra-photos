import { useSyncExternalStore, type ReactNode } from "react";

// Idiomas do site: português (principal) e inglês. A escolha fica no localStorage.

export type Idioma = "pt" | "en";

const CHAVE = "album:idioma";
const EVENTO = "album:idioma-mudou";

let memoria: Idioma = "pt";

function ler(): Idioma {
  try {
    return localStorage.getItem(CHAVE) === "en" ? "en" : "pt";
  } catch {
    return memoria;
  }
}

export function definirIdioma(idioma: Idioma) {
  memoria = idioma;
  try {
    localStorage.setItem(CHAVE, idioma);
  } catch {
    // modo privado: fica só nesta aba
  }
  document.documentElement.lang = idioma === "en" ? "en" : "pt-BR";
  window.dispatchEvent(new Event(EVENTO));
}

function assinar(cb: () => void) {
  window.addEventListener(EVENTO, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENTO, cb);
    window.removeEventListener("storage", cb);
  };
}

export function useIdioma(): Idioma {
  return useSyncExternalStore(assinar, ler, () => "pt");
}

export function useT(): Textos {
  return TEXTOS[useIdioma()];
}

/** Códigos de erro da fila de envio (a fila roda fora do React e não conhece o idioma). */
export type ErroEnvioInfo =
  | { tipo: "sessao" | "conexao" | "expirou" | "sem_conexao" | "etag" }
  | { tipo: "servidor" | "falha" | "desconhecido"; detalhe: string };

export type EtapaPreparo = "lendo" | "data" | "miniatura";

const nPt = (n: number) => n.toLocaleString("pt-BR");
const nEn = (n: number) => n.toLocaleString("en-US");

const pt = {
  locale: "pt-BR",

  // login
  albumFamilia: "Álbum da família",
  senhaFamilia: "Senha",
  digiteSenha: "Digite a senha",
  entrarAlbum: "Entrar no álbum",
  muitasTentativas: (min: number) => `Muitas tentativas. Tente de novo em ${min} min.`,
  senhaIncorreta: (restantes: number) =>
    restantes > 0 ? `Senha incorreta. Restam ${restantes} tentativas.` : "Senha incorreta.",
  semConexao: "Sem conexão. Tente de novo.",
  dicaSenha: "A senha está no grupo do Zap",
  ondeSenha: "Onde está a senha?",

  // idioma
  idioma: "Idioma",

  // nome
  nomeTituloPrimeiro: "Oi! Como você se chama?",
  nomeTitulo: "Seu nome",
  nomeDescricao: "Seu nome aparece nas fotos e vídeos que você enviar. Só quem enviou consegue apagar.",
  nomeExemplo: "Ex.: Geraldin",
  nomeAvisoTroca: (nome: string) => `Ao trocar o nome você deixa de poder apagar o que enviou como “${nome}”.`,
  comecar: "Começar",
  salvar: "Salvar",
  sairAparelho: "Sair do álbum neste aparelho",
  fechar: "Fechar",

  // hero e álbum
  lembrancas: (n: number) => `${nPt(n)} ${n === 1 ? "lembrança" : "lembranças"}`,
  dias: (n: number) => `${nPt(n)} ${n === 1 ? "dia" : "dias"}`,
  pessoas: (n: number) => `${nPt(n)} ${n === 1 ? "pessoa" : "pessoas"}`,
  enviarFotosVideos: "Enviar fotos e vídeos",
  erroCarregar: "Não foi possível carregar o álbum. Verifique a internet.",
  tentarDeNovo: "Tentar de novo",
  vazioTitulo: "O álbum está esperando",
  vazioTexto: "Seja a primeira pessoa a enviar as fotos e vídeos da viagem. Elas aparecem aqui organizadas por dia.",
  enviarAgora: "Enviar agora",
  enviar: "Enviar",
  todos: "Todos",

  // galeria
  abrirMidia: (video: boolean, nome: string) => `Abrir ${video ? "vídeo" : "foto"} de ${nome}`,
  dataAproximada: "Data aproximada",
  fotos: (n: number) => `${nPt(n)} ${n === 1 ? "foto" : "fotos"}`,
  videos: (n: number) => `${nPt(n)} ${n === 1 ? "vídeo" : "vídeos"}`,
  itens: (n: number) => `${nPt(n)} ${n === 1 ? "item" : "itens"}`,
  baixarDia: "Baixar o dia",
  baixarDosOutros: (n: number) => `Baixar ${nPt(n)} dos outros`,
  salvarDia: "Salvar o dia",
  selecionar: "Selecionar",
  selecionadas: (n: number) => (n === 0 ? "Toque para escolher" : `${nPt(n)} ${n === 1 ? "selecionada" : "selecionadas"}`),
  selecionarDia: "Selecionar dia",
  desmarcarDia: "Desmarcar dia",
  selecaoTitulo: (n: number) => `${nPt(n)} ${n === 1 ? "selecionada" : "selecionadas"}`,
  salvoAndroid: "Baixada! Ela aparece na Galeria, no álbum Download.",
  aguardandoEnvio: "Aguardando envio…",
  enviandoDe: (feitos: number, total: number) => `${nPt(feitos)} de ${nPt(total)} prontos`,
  aguardandoTexto: "Quando terminar, você pode escolher mais fotos.",
  salvarDosOutros: (n: number) => `Salvar ${nPt(n)} dos outros`,
  salvarNovas: (n: number) => `Salvar ${nPt(n)} ${n === 1 ? "nova" : "novas"}`,
  tudoJaSalvo: "Tudo já salvo",
  semOsJaSalvos: "Vem só o que você ainda não salvou neste aparelho (nem o que você mesmo enviou).",
  tudoSeu: "Tudo enviado por você",
  semOsSeus: "Vem sem o que você enviou — isso você já tem no seu aparelho.",
  salvarDiaTitulo: (n: number) => `Salvar ${nPt(n)} ${n === 1 ? "arquivo" : "fotos e vídeos"} no celular`,
  parteDe: (a: number, b: number) => `Parte ${a} de ${b}`,
  preparandoN: (n: number, total: number) => `Preparando ${nPt(n)} de ${nPt(total)}…`,
  baixandoN: (n: number, total: number) => `Baixando ${nPt(n)} de ${nPt(total)}…`,
  salvarNoCelularN: (n: number) => `Salvar ${nPt(n)} no celular`,
  dicaIosSalvar: (n: number) =>
    `Na tela seguinte, toque em “Salvar ${n === 1 ? "Imagem" : `${n} itens`}” para ir direto para o app Fotos, no tamanho original.`,
  baixarNArquivos: (n: number) => `Baixar ${nPt(n)} ${n === 1 ? "arquivo" : "arquivos"}`,
  dicaAndroid:
    "Os originais vão para a pasta Downloads e aparecem na Galeria. Se o navegador perguntar, permita baixar vários arquivos.",
  prefereZip: "Prefere um arquivo ZIP?",
  dicaComputador: "Os originais vão para a pasta Downloads do computador. Se o navegador perguntar, permita baixar vários arquivos.",
  baixadosComputador: (n: number) => `${nPt(n)} ${n === 1 ? "arquivo baixado" : "arquivos baixados"} na pasta Downloads.`,
  pronto: "Pronto!",
  salvosTexto: (n: number) => `${nPt(n)} ${n === 1 ? "arquivo salvo" : "arquivos salvos"} no seu celular.`,
  baixadosTexto: (n: number) =>
    `${nPt(n)} ${n === 1 ? "arquivo baixado" : "arquivos baixados"}. Eles aparecem na Galeria, no álbum Downloads.`,
  erroSalvarDia: "Não foi possível preparar alguns arquivos. Verifique a internet e tente de novo.",
  erroZip: (msg: string) => `Não foi possível gerar o ZIP: ${msg}`,
  diasViagem: "Dias da viagem",

  // lightbox
  salvarCelular: "Salvar no celular",
  toqueSalvar: "Toque para salvar",
  jaSalvo: "Já salvo neste aparelho",
  baixarOriginal: "Baixar original",
  excluir: "Excluir",
  enviadoPor: (nome: string) => `Enviado por ${nome}`,
  seloAproximada: "≈ data aproximada",
  corrigirData: "Corrigir data",
  editarData: "Editar data",
  excluirTitulo: (video: boolean) => (video ? "Excluir este vídeo?" : "Excluir esta foto?"),
  excluirTexto: "Ela some do álbum para todo mundo. Não dá para desfazer.",
  cancelar: "Cancelar",
  erroExcluir: "Não foi possível excluir. Tente de novo.",
  rotulosLightbox: {
    Previous: "Anterior",
    Next: "Próxima",
    Close: "Fechar",
    "Zoom in": "Aproximar",
    "Zoom out": "Afastar",
    Lightbox: "Visualizador",
    Carousel: "Carrossel",
    Slide: "Item",
    Photo: "Foto",
    Video: "Vídeo",
  } as Record<string, string>,

  // corrigir data
  corrigirDataTexto:
    "Este arquivo chegou sem a data original (comum em fotos do WhatsApp e prints). Informe quando foi tirado, no horário de Brasília.",
  dataInvalida: "Data inválida.",
  erroSalvar: "Não foi possível salvar. Tente de novo.",
  salvarData: "Salvar data",

  // envio
  enviarSub: "Direto da galeria do celular, no tamanho original.",
  escolherGaleria: "Escolher da galeria",
  variasDeUmaVez: "Pode selecionar várias de uma vez",
  dicaIphone: (
    <>
      <b>iPhone:</b> no seletor de fotos, toque em <b>Opções</b> (no topo) e escolha <b>Atual</b>. Assim vai o original,
      com a data certa, sem o iPhone converter.
    </>
  ) as ReactNode,
  ignorados: (n: number) => `${n} arquivo(s) ignorado(s): só fotos e vídeos.`,
  enviadosDe: (c: number, total: number) => `${nPt(c)} de ${nPt(total)} enviados`,
  comErro: (n: number) => `${nPt(n)} com erro`,
  tentarTodos: "Tentar todos",
  limpar: "Limpar",
  mantenhaAberto: "Mantenha o app aberto até terminar. Pode fechar esta janela.",
  removerFila: "Remover da fila",
  dataAproximadaCurta: "data aproximada",
  status: {
    fila: "Na fila",
    lendo: (pct: number) => `Lendo arquivo ${pct}%`,
    data: "Lendo data…",
    miniatura: "Gerando miniatura…",
    pronto: "Aguardando vez",
    enviando: (pct: number) => `Enviando ${pct}%`,
    finalizando: "Finalizando…",
    concluido: "Enviado",
    duplicado: "Já estava no álbum",
    parecida: "Parece repetida",
    erro: "Falhou",
  },
  pareceCom: (nome: string | null) => (nome ? `Parece com uma foto de ${nome}` : "Parece com outra foto deste envio"),
  avisoRepetidasTitulo: (n: number) =>
    n === 1 ? "1 foto parece já estar no álbum" : `${nPt(n)} fotos parecem já estar no álbum`,
  avisoRepetidasTexto: "Pode ser a mesma foto recebida pelo WhatsApp. Compare ao lado e escolha:",
  ignorarRepetidas: "Ignorar repetidas",
  enviarMesmoAssim: "Enviar mesmo assim",
  revisar: "Revisar",
  noAlbum: "no álbum",
  erroEnvio: (e: ErroEnvioInfo): string => {
    switch (e.tipo) {
      case "sessao":
        return "Sessão expirada. Entre de novo.";
      case "conexao":
        return "Conexão caiu. Tente de novo.";
      case "expirou":
        return "Link expirou. Tente de novo.";
      case "sem_conexao":
        return "Sem conexão. Tente de novo.";
      case "etag":
        return "O R2 não devolveu o ETag. Confira o CORS do bucket.";
      case "servidor":
        return `O servidor recusou (${e.detalhe}).`;
      case "falha":
        return `Falha no envio (${e.detalhe}).`;
      case "desconhecido":
        return e.detalhe || "Erro desconhecido.";
    }
  },
  rodapeLugar: "Ilha Grande · Angra dos Reis",
  rodapeData: "Outubro de 2026",
  rodapeTexto:
    "Dias de mar azul-turquesa com os amigos. Ficamos hospedados na Pousada do Preto, no Bananal, e saímos de barco para o Aventureiro, a Ilha da Gipoia, as Botinas, a Lagoa Azul e muito mais. Momentos incríveis, guardados aqui para sempre.",
  rodapeCredito: "criado por",
  finalizado: "Finalizado!",
  finalizadoTexto: (enviados: number, duplicados: number) =>
    [
      enviados > 0 && `${nPt(enviados)} ${enviados === 1 ? "arquivo enviado" : "arquivos enviados"}`,
      duplicados > 0 && `${nPt(duplicados)} já ${duplicados === 1 ? "estava" : "estavam"} no álbum`,
    ]
      .filter(Boolean)
      .join(" · "),
  finalizadoSub: "Já está tudo no álbum para a família ver.",
  ok: "OK",
};

type Textos = {
  [K in keyof typeof pt]: (typeof pt)[K] extends (...a: infer A) => infer R
    ? (...a: A) => R extends string ? string : R
    : (typeof pt)[K] extends Record<string, unknown>
      ? { [S in keyof (typeof pt)[K]]: (typeof pt)[K][S] extends (...a: infer A) => string ? (...a: A) => string : string }
      : (typeof pt)[K];
};

const en: Textos = {
  locale: "en-US",

  albumFamilia: "Family album",
  senhaFamilia: "Password",
  digiteSenha: "Enter the password",
  entrarAlbum: "Open the album",
  muitasTentativas: (min) => `Too many attempts. Try again in ${min} min.`,
  senhaIncorreta: (restantes) =>
    restantes > 0 ? `Wrong password. ${restantes} ${restantes === 1 ? "attempt" : "attempts"} left.` : "Wrong password.",
  semConexao: "No connection. Please try again.",
  dicaSenha: "The password is in the WhatsApp group",
  ondeSenha: "Where's the password?",

  idioma: "Language",

  nomeTituloPrimeiro: "Hi! What's your name?",
  nomeTitulo: "Your name",
  nomeDescricao: "Your name shows on the photos and videos you upload. Only the person who uploaded can delete them.",
  nomeExemplo: "e.g. John",
  nomeAvisoTroca: (nome) => `If you change your name, you can no longer delete what you uploaded as “${nome}”.`,
  comecar: "Start",
  salvar: "Save",
  sairAparelho: "Log out on this device",
  fechar: "Close",

  lembrancas: (n) => `${nEn(n)} ${n === 1 ? "memory" : "memories"}`,
  dias: (n) => `${nEn(n)} ${n === 1 ? "day" : "days"}`,
  pessoas: (n) => `${nEn(n)} ${n === 1 ? "person" : "people"}`,
  enviarFotosVideos: "Upload photos & videos",
  erroCarregar: "Couldn't load the album. Check your connection.",
  tentarDeNovo: "Try again",
  vazioTitulo: "The album is waiting",
  vazioTexto: "Be the first to upload the trip's photos and videos. They'll show up here, organized by day.",
  enviarAgora: "Upload now",
  enviar: "Upload",
  todos: "Everyone",

  abrirMidia: (video, nome) => `Open ${video ? "video" : "photo"} by ${nome}`,
  dataAproximada: "Approximate date",
  fotos: (n) => `${nEn(n)} ${n === 1 ? "photo" : "photos"}`,
  videos: (n) => `${nEn(n)} ${n === 1 ? "video" : "videos"}`,
  itens: (n) => `${nEn(n)} ${n === 1 ? "item" : "items"}`,
  baixarDia: "Download day",
  baixarDosOutros: (n) => `Download ${nEn(n)} from others`,
  salvarDia: "Save day",
  selecionar: "Select",
  selecionadas: (n) => (n === 0 ? "Tap to choose" : `${nEn(n)} selected`),
  selecionarDia: "Select day",
  desmarcarDia: "Deselect day",
  selecaoTitulo: (n) => `${nEn(n)} selected`,
  salvoAndroid: "Downloaded! It shows up in your Gallery, in the Download album.",
  aguardandoEnvio: "Waiting to upload…",
  enviandoDe: (feitos, total) => `${nEn(feitos)} of ${nEn(total)} done`,
  aguardandoTexto: "When it's done, you can pick more photos.",
  salvarDosOutros: (n) => `Save ${nEn(n)} from others`,
  salvarNovas: (n) => `Save ${nEn(n)} new`,
  tudoJaSalvo: "All saved",
  semOsJaSalvos: "Only what you haven't saved on this device yet (and nothing you uploaded yourself).",
  tudoSeu: "All uploaded by you",
  semOsSeus: "Skips what you uploaded — you already have those on your device.",
  salvarDiaTitulo: (n) => `Save ${nEn(n)} ${n === 1 ? "file" : "photos & videos"} to your phone`,
  parteDe: (a, b) => `Part ${a} of ${b}`,
  preparandoN: (n, total) => `Preparing ${nEn(n)} of ${nEn(total)}…`,
  baixandoN: (n, total) => `Downloading ${nEn(n)} of ${nEn(total)}…`,
  salvarNoCelularN: (n) => `Save ${nEn(n)} to phone`,
  dicaIosSalvar: (n) =>
    `On the next screen, tap “Save ${n === 1 ? "Image" : `${n} Items`}” to send them straight to Photos, in original quality.`,
  baixarNArquivos: (n) => `Download ${nEn(n)} ${n === 1 ? "file" : "files"}`,
  dicaAndroid:
    "The originals go to your Downloads folder and show up in your Gallery. If the browser asks, allow multiple downloads.",
  prefereZip: "Prefer a ZIP file?",
  dicaComputador: "The originals go to your computer's Downloads folder. If the browser asks, allow multiple downloads.",
  baixadosComputador: (n) => `${nEn(n)} ${n === 1 ? "file" : "files"} downloaded to your Downloads folder.`,
  pronto: "Done!",
  salvosTexto: (n) => `${nEn(n)} ${n === 1 ? "file" : "files"} saved to your phone.`,
  baixadosTexto: (n) => `${nEn(n)} ${n === 1 ? "file" : "files"} downloaded. They show up in your Gallery, in the Downloads album.`,
  erroSalvarDia: "Couldn't prepare some files. Check your connection and try again.",
  erroZip: (msg) => `Couldn't create the ZIP: ${msg}`,
  diasViagem: "Trip days",

  salvarCelular: "Save to phone",
  toqueSalvar: "Tap to save",
  jaSalvo: "Already saved on this device",
  baixarOriginal: "Download original",
  excluir: "Delete",
  enviadoPor: (nome) => `Uploaded by ${nome}`,
  seloAproximada: "≈ approximate date",
  corrigirData: "Fix date",
  editarData: "Edit date",
  excluirTitulo: (video) => (video ? "Delete this video?" : "Delete this photo?"),
  excluirTexto: "It will be removed from the album for everyone. This can't be undone.",
  cancelar: "Cancel",
  erroExcluir: "Couldn't delete. Please try again.",
  rotulosLightbox: {
    Previous: "Previous",
    Next: "Next",
    Close: "Close",
    "Zoom in": "Zoom in",
    "Zoom out": "Zoom out",
    Lightbox: "Lightbox",
    Carousel: "Carousel",
    Slide: "Slide",
    Photo: "Photo",
    Video: "Video",
  },

  corrigirDataTexto:
    "This file has no original date (common with WhatsApp photos and screenshots). Enter when it was taken, in Brazil time (UTC−3).",
  dataInvalida: "Invalid date.",
  erroSalvar: "Couldn't save. Please try again.",
  salvarData: "Save date",

  enviarSub: "Straight from your phone's gallery, in original quality.",
  escolherGaleria: "Choose from gallery",
  variasDeUmaVez: "You can select many at once",
  dicaIphone: (
    <>
      <b>iPhone:</b> in the photo picker, tap <b>Options</b> (at the top) and choose <b>Current</b>. That sends the
      original file, with the right date, without the iPhone converting it.
    </>
  ),
  ignorados: (n) => `${n} file(s) skipped: photos and videos only.`,
  enviadosDe: (c, total) => `${nEn(c)} of ${nEn(total)} uploaded`,
  comErro: (n) => `${nEn(n)} failed`,
  tentarTodos: "Retry all",
  limpar: "Clear",
  mantenhaAberto: "Keep the app open until it finishes. You can close this panel.",
  removerFila: "Remove from queue",
  dataAproximadaCurta: "approximate date",
  status: {
    fila: "Queued",
    lendo: (pct) => `Reading file ${pct}%`,
    data: "Reading date…",
    miniatura: "Creating thumbnail…",
    pronto: "Waiting",
    enviando: (pct) => `Uploading ${pct}%`,
    finalizando: "Finishing…",
    concluido: "Uploaded",
    duplicado: "Already in the album",
    parecida: "Looks like a duplicate",
    erro: "Failed",
  },
  pareceCom: (nome) => (nome ? `Looks like a photo by ${nome}` : "Looks like another photo in this upload"),
  avisoRepetidasTitulo: (n) =>
    n === 1 ? "1 photo seems to be in the album already" : `${nEn(n)} photos seem to be in the album already`,
  avisoRepetidasTexto: "It may be the same photo received via WhatsApp. Compare them and choose:",
  ignorarRepetidas: "Skip duplicates",
  enviarMesmoAssim: "Upload anyway",
  revisar: "Review",
  noAlbum: "in album",
  erroEnvio: (e) => {
    switch (e.tipo) {
      case "sessao":
        return "Session expired. Please log in again.";
      case "conexao":
        return "Connection lost. Try again.";
      case "expirou":
        return "Upload link expired. Try again.";
      case "sem_conexao":
        return "No connection. Try again.";
      case "etag":
        return "R2 didn't return the ETag. Check the bucket CORS.";
      case "servidor":
        return `The server refused (${e.detalhe}).`;
      case "falha":
        return `Upload failed (${e.detalhe}).`;
      case "desconhecido":
        return e.detalhe || "Unknown error.";
    }
  },
  rodapeLugar: "Ilha Grande · Angra dos Reis",
  rodapeData: "October 2026",
  rodapeTexto:
    "Turquoise-water days with friends. We stayed at Pousada do Preto, in Bananal, and took boat trips to Aventureiro, Ilha da Gipoia, Botinas, Lagoa Azul and much more. Incredible moments, kept here forever.",
  rodapeCredito: "created by",
  finalizado: "All done!",
  finalizadoTexto: (enviados, duplicados) =>
    [
      enviados > 0 && `${nEn(enviados)} ${enviados === 1 ? "file uploaded" : "files uploaded"}`,
      duplicados > 0 && `${nEn(duplicados)} ${duplicados === 1 ? "was" : "were"} already in the album`,
    ]
      .filter(Boolean)
      .join(" · "),
  finalizadoSub: "Everything is in the album for the family to see.",
  ok: "OK",
};

const TEXTOS: Record<Idioma, Textos> = { pt: pt as Textos, en };

// Aplica o idioma salvo no <html lang> já na carga.
if (typeof document !== "undefined") document.documentElement.lang = ler() === "en" ? "en" : "pt-BR";
