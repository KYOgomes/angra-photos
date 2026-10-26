import { useEffect, useState, type FormEvent } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SeletorIdioma } from "@/components/SeletorIdioma";
import { useT } from "@/lib/i18n";
import { salvarNome } from "@/lib/nome";

interface Props {
  aberto: boolean;
  nomeAtual: string;
  /** Primeiro acesso: não dá para fechar sem informar o nome. */
  obrigatorio: boolean;
  onFechar: () => void;
  onSair?: () => void;
}

export function DialogoNome({ aberto, nomeAtual, obrigatorio, onFechar, onSair }: Props) {
  const t = useT();
  const [nome, setNome] = useState(nomeAtual);
  useEffect(() => setNome(nomeAtual), [nomeAtual, aberto]);

  function salvar(e: FormEvent) {
    e.preventDefault();
    const limpo = nome.trim().replace(/\s+/g, " ");
    if (!limpo) return;
    salvarNome(limpo.slice(0, 40));
    onFechar();
  }

  const mudou = !obrigatorio && nome.trim() !== nomeAtual;

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && !obrigatorio && onFechar()}>
      <DialogContent
        showCloseButton={!obrigatorio}
        closeLabel={t.fechar}
        onInteractOutside={(e) => obrigatorio && e.preventDefault()}
        onEscapeKeyDown={(e) => obrigatorio && e.preventDefault()}
      >
        {obrigatorio && (
          <div className="-mb-1">
            <SeletorIdioma sobreFoto={false} />
          </div>
        )}
        <DialogHeader>
          <DialogTitle>{obrigatorio ? t.nomeTituloPrimeiro : t.nomeTitulo}</DialogTitle>
          <DialogDescription>{t.nomeDescricao}</DialogDescription>
        </DialogHeader>
        <form onSubmit={salvar} className="grid gap-3">
          <Input
            autoFocus
            value={nome}
            maxLength={40}
            autoComplete="given-name"
            enterKeyHint="done"
            placeholder={t.nomeExemplo}
            onChange={(e) => setNome(e.target.value)}
          />
          {mudou && nomeAtual && (
            <p className="rounded-xl bg-coral-soft px-3 py-2 text-xs text-[#8a2e20]">{t.nomeAvisoTroca(nomeAtual)}</p>
          )}
          <Button type="submit" size="lg" disabled={!nome.trim()}>
            {obrigatorio ? t.comecar : t.salvar}
          </Button>
          {!obrigatorio && onSair && (
            <Button type="button" variant="ghost" onClick={onSair} className="text-muted-foreground">
              <LogOut /> {t.sairAparelho}
            </Button>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
