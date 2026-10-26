import { useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import type { MediaItem } from "../../shared/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { deInputLocal, paraInputLocal } from "@/lib/formato";
import { useT } from "@/lib/i18n";

interface Props {
  item: MediaItem | null;
  autor: string;
  onFechar: () => void;
  onSalvo: (antigo: MediaItem, novo: MediaItem) => void;
}

export function DialogoCorrigirData({ item, autor, onFechar, onSalvo }: Props) {
  const t = useT();
  const [valor, setValor] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (item) setValor(paraInputLocal(item.capturedAtUtc));
    setErro(null);
  }, [item]);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!item) return;
    const iso = deInputLocal(valor);
    if (!iso) return setErro(t.dataInvalida);
    setSalvando(true);
    try {
      onSalvo(item, await api.corrigirData(item.id, iso, autor));
      onFechar();
    } catch {
      setErro(t.erroSalvar);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={!!item} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent closeLabel={t.fechar}>
        <DialogHeader>
          <DialogTitle>{t.corrigirData}</DialogTitle>
          <DialogDescription>{t.corrigirDataTexto}</DialogDescription>
        </DialogHeader>
        <form onSubmit={salvar} className="grid gap-3">
          <Input type="datetime-local" value={valor} onChange={(e) => setValor(e.target.value)} required />
          {erro && <p className="text-sm text-destructive">{erro}</p>}
          <Button type="submit" size="lg" disabled={salvando}>
            {salvando && <Loader2 className="animate-spin" />} {t.salvarData}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
