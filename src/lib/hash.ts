import { createSHA256 } from "hash-wasm";

const BLOCO = 4 * 1024 * 1024;

/**
 * SHA-256 em streaming: lê o arquivo em blocos de 4 MB. Com crypto.subtle seria preciso
 * carregar o vídeo inteiro na memória, o que derruba o navegador do celular.
 */
export async function sha256Arquivo(arquivo: Blob, onProgresso?: (p: number) => void, signal?: AbortSignal) {
  const h = await createSHA256();
  h.init();
  for (let pos = 0; pos < arquivo.size; pos += BLOCO) {
    signal?.throwIfAborted();
    h.update(new Uint8Array(await arquivo.slice(pos, pos + BLOCO).arrayBuffer()));
    onProgresso?.(Math.min(1, (pos + BLOCO) / arquivo.size));
  }
  return h.digest("hex");
}
