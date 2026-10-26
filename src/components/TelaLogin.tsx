import { useEffect, useState, type FormEvent } from "react";
import { Lightbulb, Loader2, LockKeyhole, UserRound, Waves } from "lucide-react";
import { ImageStreamHero } from "@/components/ui/image-stream-hero";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FOTOS_EXEMPLO } from "@/components/fotos-exemplo";
import { SeletorIdioma } from "@/components/SeletorIdioma";
import { api, ErroApi } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { salvarNome, useNome } from "@/lib/nome";
import { cn } from "@/lib/utils";

type Erro = { tipo: "bloqueado"; min: number } | { tipo: "senha"; restantes: number } | { tipo: "rede" };

/** Entrada única: nome em cima, senha embaixo. A lâmpada lembra onde está a senha. */
export function TelaLogin({ onEntrar }: { onEntrar: () => void }) {
  const t = useT();
  const nomeSalvo = useNome();
  const [nome, setNome] = useState(nomeSalvo);
  const [senha, setSenha] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<Erro | null>(null);
  const [dica, setDica] = useState(false);

  useEffect(() => {
    if (nomeSalvo && !nome) setNome(nomeSalvo);
  }, [nomeSalvo, nome]);

  const nomeLimpo = nome.trim().replace(/\s+/g, " ").slice(0, 40);
  const pronto = !!nomeLimpo && !!senha;

  async function entrar(e: FormEvent) {
    e.preventDefault();
    if (!pronto) return;
    setEnviando(true);
    setErro(null);
    try {
      await api.login(senha);
      salvarNome(nomeLimpo);
      onEntrar();
    } catch (err) {
      if (err instanceof ErroApi && err.status === 429) {
        setErro({ tipo: "bloqueado", min: Math.ceil(Number(err.dados?.esperaS ?? 900) / 60) });
      } else if (err instanceof ErroApi && err.status === 401) {
        setErro({ tipo: "senha", restantes: Number(err.dados?.restantes ?? 0) });
        setDica(true); // errou a senha: lembra onde ela está
      } else {
        setErro({ tipo: "rede" });
      }
      setSenha("");
    } finally {
      setEnviando(false);
    }
  }

  // O texto do erro acompanha o idioma, mesmo se a pessoa trocar depois do erro.
  const mensagem =
    erro?.tipo === "bloqueado"
      ? t.muitasTentativas(erro.min)
      : erro?.tipo === "senha"
        ? t.senhaIncorreta(erro.restantes)
        : erro?.tipo === "rede"
          ? t.semConexao
          : null;

  return (
    <ImageStreamHero
      images={FOTOS_EXEMPLO}
      cards={9}
      speed={22}
      axis={40}
      className="h-dvh w-full bg-[radial-gradient(120%_80%_at_50%_35%,#0e6b80_0%,var(--ocean)_45%,var(--ocean-deep)_100%)]"
    >
      {/* véu para dar leitura ao texto sobre as fotos em movimento */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_45%_at_50%_40%,rgba(6,47,66,0.55),transparent_70%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-ocean-deep via-ocean-deep/75 to-transparent" />

      <div className="absolute top-[max(1rem,env(safe-area-inset-top))] left-4 z-20">
        <SeletorIdioma sobreFoto />
      </div>

      <div className="relative z-10 mx-auto flex h-full max-w-md flex-col items-center justify-between px-5 pt-[max(4.5rem,calc(env(safe-area-inset-top)+3.5rem))] pb-[max(5.5rem,calc(env(safe-area-inset-bottom)+5rem))] text-center">
        <div className="flex flex-col items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tracking-wider text-aqua uppercase ring-1 ring-white/20 backdrop-blur-md">
            <Waves className="size-3.5" /> {t.albumFamilia}
          </span>
          <h1 className="font-display text-5xl leading-[0.95] font-semibold text-balance text-white drop-shadow-[0_2px_16px_rgba(0,0,0,0.45)] sm:text-6xl">
            Ilha Grande
            <span className="block text-aqua italic">2026</span>
          </h1>
        </div>

        <form
          onSubmit={entrar}
          className="flex w-full flex-col gap-4 rounded-[1.75rem] bg-white/12 p-5 text-left shadow-2xl ring-1 ring-white/20 backdrop-blur-xl"
        >
          <div>
            <label htmlFor="nome" className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
              <UserRound className="size-4 text-aqua" /> {t.nomeTitulo}
            </label>
            <Input
              id="nome"
              autoComplete="given-name"
              enterKeyHint="next"
              maxLength={40}
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder={t.nomeExemplo}
              className="border-white/30 bg-white/90 text-ocean-deep"
            />
          </div>

          <div>
            <label htmlFor="senha" className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
              <LockKeyhole className="size-4 text-aqua" /> {t.senhaFamilia}
            </label>
            <Input
              id="senha"
              type="password"
              autoComplete="current-password"
              enterKeyHint="go"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder={t.digiteSenha}
              aria-invalid={!!erro}
              className="border-white/30 bg-white/90 text-ocean-deep"
            />
            {mensagem && (
              <p role="alert" className="mt-2 text-sm font-medium text-coral-soft">
                {mensagem}
              </p>
            )}
          </div>

          <Button type="submit" variant="coral" size="lg" className="w-full" disabled={enviando || !pronto}>
            {enviando ? <Loader2 className="animate-spin" /> : null}
            {t.entrarAlbum}
          </Button>
        </form>
      </div>

      {/* Lâmpada: "A senha está no grupo do Zap" — o balão abre ao lado, sem cobrir o botão Entrar */}
      <div className="absolute right-4 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-20 flex items-center gap-3">
        {dica && (
          <div
            role="status"
            className="relative max-w-[calc(100vw-6.5rem)] rounded-2xl bg-white px-4 py-2.5 text-left text-sm leading-snug font-semibold text-ocean shadow-2xl duration-300 animate-in fade-in zoom-in-95 slide-in-from-right-2"
          >
            💬 {t.dicaSenha}
            {/* rabinho do balão apontando para a lâmpada */}
            <span className="absolute top-1/2 -right-1.5 size-3 -translate-y-1/2 rotate-45 bg-white" aria-hidden />
          </div>
        )}
        <button
          type="button"
          onClick={() => setDica((v) => !v)}
          aria-label={t.ondeSenha}
          aria-expanded={dica}
          className={cn(
            "grid size-12 shrink-0 place-items-center rounded-full ring-1 backdrop-blur-md transition-all active:scale-95",
            dica
              ? "bg-amber-300 text-ocean-deep shadow-[0_0_24px_rgba(252,211,77,0.6)] ring-amber-200"
              : "animate-pulse bg-white/15 text-amber-200 ring-white/25 hover:bg-white/25",
          )}
        >
          <Lightbulb className="size-6" />
        </button>
      </div>
    </ImageStreamHero>
  );
}
