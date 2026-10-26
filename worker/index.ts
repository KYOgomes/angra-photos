import { Hono } from "hono";
import { exigirSessao, login, logout } from "./auth";
import type { AppEnv, Env } from "./env";
import { files } from "./files";
import { media } from "./media";
import { limparPendentes, upload } from "./upload";

const app = new Hono<AppEnv>();

app.use("/api/*", exigirSessao);
app.use("/api/*", async (c, next) => {
  await next();
  if (!c.res.headers.has("cache-control")) c.res.headers.set("cache-control", "no-store");
});

app.post("/api/login", login);
app.post("/api/logout", logout);
app.get("/api/sessao", (c) => c.json({ ok: true }));

app.route("/api", media);
app.route("/api", upload);
app.route("/api", files);

app.all("/api/*", (c) => c.json({ erro: "nao_encontrado" }, 404));
// Fora de /api/* quem responde são os assets estáticos (ver wrangler.toml).
app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

app.onError((err, c) => {
  console.error(err);
  return c.json({ erro: "erro_interno" }, 500);
});

export default {
  fetch: app.fetch,
  async scheduled(_evento, env, ctx) {
    ctx.waitUntil(limparPendentes(env));
  },
} satisfies ExportedHandler<Env>;
