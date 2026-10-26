import { AwsClient } from "aws4fetch";
import type { ParteConcluida } from "../shared/types";
import type { Env } from "./env";

// O bucket é privado. O navegador só fala com o R2 por URLs assinadas (SigV4) de curta
// duração, geradas aqui com o token S3 do R2 — assim os arquivos não passam pelo Worker.

function cliente(env: Env) {
  return new AwsClient({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    service: "s3",
    region: "auto",
  });
}

function urlObjeto(env: Env, key: string, query: Record<string, string> = {}): URL {
  const caminho = key.split("/").map(encodeURIComponent).join("/");
  const url = new URL(`https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_BUCKET_NAME}/${caminho}`);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  return url;
}

export async function urlAssinada(
  env: Env,
  method: "GET" | "PUT",
  key: string,
  expiraS: number,
  query: Record<string, string> = {},
): Promise<string> {
  const url = urlObjeto(env, key, query);
  url.searchParams.set("X-Amz-Expires", String(expiraS));
  const assinado = await cliente(env).sign(new Request(url, { method }), { aws: { signQuery: true } });
  return assinado.url;
}

export async function criarMultipart(env: Env, key: string, contentType: string): Promise<string> {
  const res = await cliente(env).fetch(urlObjeto(env, key, { uploads: "" }).toString(), {
    method: "POST",
    headers: { "content-type": contentType },
  });
  const xml = await res.text();
  const uploadId = xml.match(/<UploadId>([^<]+)<\/UploadId>/)?.[1];
  if (!res.ok || !uploadId) throw new Error(`Falha ao iniciar multipart: ${res.status} ${xml.slice(0, 200)}`);
  return uploadId;
}

const escaparXml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export async function concluirMultipart(env: Env, key: string, uploadId: string, partes: ParteConcluida[]) {
  const corpo =
    "<CompleteMultipartUpload>" +
    [...partes]
      .sort((a, b) => a.partNumber - b.partNumber)
      .map((p) => `<Part><PartNumber>${p.partNumber}</PartNumber><ETag>${escaparXml(p.etag)}</ETag></Part>`)
      .join("") +
    "</CompleteMultipartUpload>";
  const res = await cliente(env).fetch(urlObjeto(env, key, { uploadId }).toString(), {
    method: "POST",
    headers: { "content-type": "application/xml" },
    body: corpo,
  });
  const xml = await res.text();
  // O S3 pode responder 200 com <Error> no corpo.
  if (!res.ok || xml.includes("<Error>")) {
    throw new Error(`Falha ao concluir multipart: ${res.status} ${xml.slice(0, 300)}`);
  }
}

export async function abortarMultipart(env: Env, key: string, uploadId: string) {
  await cliente(env)
    .fetch(urlObjeto(env, key, { uploadId }).toString(), { method: "DELETE" })
    .catch(() => undefined);
}
