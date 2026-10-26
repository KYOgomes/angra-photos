/// <reference lib="webworker" />
import { respostaZipDoDia } from "../shared/zip";

// Service worker com uma única função: gerar o ZIP de um dia em streaming.
// A página navega para /zip/AAAA-MM-DD e o navegador salva direto no disco,
// sem segurar gigabytes de vídeo na memória do celular. Nada mais é interceptado.

declare const self: ServiceWorkerGlobalScope;

self.addEventListener("install", () => void self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

// A página manda "ping" enquanto o download corre, para o navegador não encerrar o SW.
self.addEventListener("message", (e) => {
  if (e.data === "ping") e.waitUntil(new Promise((r) => setTimeout(r, 25_000)));
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  const m = url.pathname.match(/^\/zip\/(\d{4}-\d{2}-\d{2})$/);
  if (e.request.method !== "GET" || url.origin !== self.location.origin || !m) return;
  e.respondWith(
    respostaZipDoDia(m[1], url.searchParams.get("autor"), url.searchParams.get("excluir")).catch(
      (err) => new Response(`Não foi possível gerar o ZIP / Could not create the ZIP: ${err}`, { status: 500 }),
    ),
  );
});
