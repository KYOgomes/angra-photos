import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MediaItem, Resumo } from "../../shared/types";
import { api } from "@/lib/api";
import { diaSP } from "@/lib/formato";

/**
 * Estado da galeria. O resumo traz a lista de dias (com contagem); cada dia carrega seus
 * itens só quando chega perto da tela. Isso dá "pular para o dia" e scroll leve no 4G.
 */
export function useAlbum(autor: string | null) {
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [erro, setErro] = useState(false);
  const [porDia, setPorDia] = useState<Record<string, MediaItem[]>>({});
  const porDiaRef = useRef(porDia);
  porDiaRef.current = porDia;
  const carregando = useRef(new Set<string>());
  const versao = useRef(0);

  const carregarResumo = useCallback(async () => {
    const v = versao.current;
    try {
      const r = await api.resumo(autor);
      if (v === versao.current) {
        setResumo(r);
        setErro(false);
      }
    } catch {
      if (v === versao.current) setErro(true);
    }
  }, [autor]);

  const carregarDia = useCallback(
    async (dia: string, forcar = false) => {
      if (!forcar && (porDiaRef.current[dia] || carregando.current.has(dia))) return;
      carregando.current.add(dia);
      const v = versao.current;
      try {
        const itens: MediaItem[] = [];
        let cursor: string | null = null;
        do {
          const pagina = await api.listar({ dia, autor, cursor, limite: 300 });
          itens.push(...pagina.items);
          cursor = pagina.cursor;
        } while (cursor);
        if (v === versao.current) setPorDia((prev) => ({ ...prev, [dia]: itens }));
      } catch (e) {
        console.error(e);
      } finally {
        carregando.current.delete(dia);
      }
    },
    [autor],
  );

  useEffect(() => {
    versao.current++;
    carregando.current.clear();
    setPorDia({});
    setResumo(null);
    void carregarResumo();
  }, [carregarResumo]);

  // Uploads concluídos chegam em rajadas: junta os dias afetados e recarrega uma vez só.
  const pendentes = useRef(new Set<string>());
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const recarregarDias = useCallback(
    (dias: string[]) => {
      for (const d of dias) pendentes.current.add(d);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        const lista = [...pendentes.current];
        pendentes.current.clear();
        void carregarResumo();
        for (const d of lista) if (porDiaRef.current[d]) void carregarDia(d, true);
      }, 1200);
    },
    [carregarResumo, carregarDia],
  );

  const novoItem = useCallback((m: MediaItem) => recarregarDias([diaSP(m.capturedAtUtc)]), [recarregarDias]);

  const removerItem = useCallback(
    (m: MediaItem) => {
      const dia = diaSP(m.capturedAtUtc);
      setPorDia((prev) => ({ ...prev, [dia]: (prev[dia] ?? []).filter((i) => i.id !== m.id) }));
      void carregarResumo();
    },
    [carregarResumo],
  );

  const substituirItem = useCallback(
    (antigo: MediaItem, novo: MediaItem) => {
      const diaAntigo = diaSP(antigo.capturedAtUtc);
      const diaNovo = diaSP(novo.capturedAtUtc);
      setPorDia((prev) => {
        const proximo = { ...prev, [diaAntigo]: (prev[diaAntigo] ?? []).filter((i) => i.id !== antigo.id) };
        if (proximo[diaNovo]) {
          proximo[diaNovo] = [...proximo[diaNovo], novo].sort(
            (a, b) => a.capturedAtUtc.localeCompare(b.capturedAtUtc) || a.id.localeCompare(b.id),
          );
        }
        return proximo;
      });
      recarregarDias([diaNovo]);
    },
    [recarregarDias],
  );

  const itens = useMemo(() => (resumo?.dias ?? []).flatMap((d) => porDia[d.dia] ?? []), [resumo, porDia]);

  return { resumo, erro, porDia, itens, carregarDia, carregarResumo, novoItem, removerItem, substituirItem };
}
