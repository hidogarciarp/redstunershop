"use client";

import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/lib/toast";

export function usePonto() {
  const { toast } = useToast();
  const [historicoPonto, setHistoricoPonto] = useState([]);
  const [carregandoHistorico, setCarregandoHistorico] = useState(false);
  const [totalMinutosTrabalhados, setTotalMinutosTrabalhados] = useState(0);
  const [editandoPontoId, setEditandoPontoId] = useState(null);
  const [novaSaidaInput, setNovaSaidaInput] = useState("");
  const [novaSaidaDataInput, setNovaSaidaDataInput] = useState("");
  const [novaSaidaJustificativa, setNovaSaidaJustificativa] = useState("");
  const [solicitacoesPendentes, setSolicitacoesPendentes] = useState([]);

  const buscarHistoricoPonto = useCallback(async (usuarioId, filtros = {}) => {
    if (!usuarioId) return;
    setCarregandoHistorico(true);
    let query = supabase
      .from("ponto_horas")
      .select("*")
      .order("data", { ascending: false })
      .order("entrada", { ascending: false })
      .limit(100);

    if (filtros.nome) {
      query = query.ilike("nome", `%${filtros.nome}%`);
    }
    if (filtros.status === "ocultos") {
      query = query.eq("oculto", true);
    } else if (filtros.status === "visiveis") {
      query = query.or("oculto.is.null,oculto.eq.false");
    }
    if (filtros.dataIni) {
      query = query.gte("data", filtros.dataIni);
    }
    if (filtros.dataFim) {
      query = query.lte("data", filtros.dataFim);
    }
    if (filtros.usuarioId) {
      query = query.eq("usuario_id", filtros.usuarioId);
    }

    const { data } = await query;
    if (data) {
      setHistoricoPonto(data);
      const totalMin = data.reduce((acc, r) => {
        if (r.entrada && r.saida) {
          return acc + (new Date(r.saida) - new Date(r.entrada)) / 60000;
        }
        return acc;
      }, 0);
      setTotalMinutosTrabalhados(totalMin);
    }
    setCarregandoHistorico(false);
  }, []);

  const solicitarEdicaoSaida = useCallback(async (pontoId, novaSaida, novaData) => {
    if (!window.confirm("Solicitar alteração da saída?")) return;
    const { error } = await supabase.from("solicitacoes_ponto").insert([{
      ponto_id: pontoId,
      data_ponto: novaData,
      nova_saida: novaSaida,
      status: "pendente",
    }]);
    if (error) { toast("Erro ao solicitar: " + error.message, "error"); return; }
    toast("Solicitação enviada para aprovação!", "success");
  }, [toast]);

  const buscarSolicitacoesPendentes = useCallback(async () => {
    const { data } = await supabase
      .from("solicitacoes_ponto")
      .select("*")
      .eq("status", "pendente")
      .order("criado_em", { ascending: false });
    if (data) setSolicitacoesPendentes(data);
  }, []);

  const aprovarSolicitacao = useCallback(async (solicitacaoId, pontoId, novaSaida, aprovadoPor) => {
    const { error: updateError } = await supabase
      .from("ponto_horas")
      .update({ saida: novaSaida, verificado: true, verificado_por: aprovadoPor })
      .eq("id", pontoId);
    if (updateError) { toast("Erro ao atualizar ponto: " + updateError.message, "error"); return; }

    await supabase
      .from("solicitacoes_ponto")
      .update({ status: "aprovado", aprovado_por: aprovadoPor })
      .eq("id", solicitacaoId);

    toast("Solicitação aprovada!", "success");
    buscarSolicitacoesPendentes();
  }, [toast, buscarSolicitacoesPendentes]);

  const rejeitarSolicitacao = useCallback(async (solicitacaoId) => {
    await supabase.from("solicitacoes_ponto").update({ status: "rejeitado" }).eq("id", solicitacaoId);
    toast("Solicitação rejeitada.", "warning");
    buscarSolicitacoesPendentes();
  }, [toast, buscarSolicitacoesPendentes]);

  return {
    historicoPonto, setHistoricoPonto,
    carregandoHistorico, totalMinutosTrabalhados,
    editandoPontoId, setEditandoPontoId,
    novaSaidaInput, setNovaSaidaInput,
    novaSaidaDataInput, setNovaSaidaDataInput,
    novaSaidaJustificativa, setNovaSaidaJustificativa,
    solicitacoesPendentes, setSolicitacoesPendentes,
    buscarHistoricoPonto, solicitarEdicaoSaida,
    buscarSolicitacoesPendentes, aprovarSolicitacao, rejeitarSolicitacao,
  };
}
