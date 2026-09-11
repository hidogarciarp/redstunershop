"use client";

import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/lib/toast";

export function useMissao(usuarioLogado) {
  const { toast } = useToast();
  const [missoes, setMissoes] = useState([]);
  const [missaoParticipacoes, setMissaoParticipacoes] = useState([]);

  const buscarMissoes = useCallback(async (incluirInativas = false) => {
    let query = supabase.from("missoes").select("*").order("criado_em", { ascending: false });
    if (!incluirInativas) query = query.eq("ativa", true);
    const { data } = await query;
    if (data) setMissoes(data);
  }, []);

  const buscarParticipacoesMissao = useCallback(async (missaoId) => {
    const { data } = await supabase
      .from("missao_participacoes")
      .select("*")
      .eq("missao_id", missaoId)
      .order("criado_em", { ascending: false });
    if (data) setMissaoParticipacoes(data);
  }, []);

  const registrarParticipacao = useCallback(async (missaoId, fotoBase64, observacao) => {
    const { error } = await supabase.from("missao_participacoes").insert({
      missao_id: missaoId,
      usuario_id: usuarioLogado?.id,
      nome_usuario: usuarioLogado?.nome,
      observacao: observacao || null,
      foto_base64: fotoBase64 || null,
    });
    if (error) { toast("Erro ao registrar: " + error.message, "error"); return; }
    toast("Participação registrada!", "success");
  }, [usuarioLogado, toast]);

  const aprovarParticipacao = useCallback(async (id, aprovado) => {
    const { data: part } = await supabase
      .from("missao_participacoes")
      .select("missao_id, aprovado")
      .eq("id", id)
      .maybeSingle();

    const { error } = await supabase.from("missao_participacoes").update({
      aprovado, aprovado_por: usuarioLogado?.id, aprovado_em: new Date().toISOString(),
    }).eq("id", id);
    if (error) { toast("Erro ao aprovar: " + error.message, "error"); return; }

    if (part?.missao_id) {
      const { data: missao } = await supabase.from("missoes").select("progresso, meta").eq("id", part.missao_id).maybeSingle();
      if (missao) {
        let delta = 0;
        if (aprovado && !part.aprovado) delta = 1;
        else if (!aprovado && part.aprovado) delta = -1;
        if (delta !== 0) {
          const novoProgresso = Math.min(missao.meta, Math.max(0, missao.progresso + delta));
          await supabase.from("missoes").update({ progresso: novoProgresso }).eq("id", part.missao_id);
        }
      }
    }
    toast(aprovado ? "Aprovada!" : "Rejeitada!", "success");
  }, [usuarioLogado, toast]);

  const criarMissao = useCallback(async (dados) => {
    const { error } = await supabase.from("missoes").insert({
      ...dados,
      meta: parseInt(dados.meta) || 100,
      pontos_recompensa: parseInt(dados.pontos_recompensa) || 150,
      data_expiracao: dados.data_expiracao ? new Date(dados.data_expiracao).toISOString() : null,
      criado_por: usuarioLogado?.id,
    });
    if (error) { toast("Erro ao criar: " + error.message, "error"); return; }
    toast("Missão criada!", "success");
    buscarMissoes();
  }, [usuarioLogado, toast, buscarMissoes]);

  const editarMissao = useCallback(async (id, dados) => {
    const { error } = await supabase.from("missoes").update({
      titulo: dados.titulo, descricao: dados.descricao || null,
      meta: parseInt(dados.meta) || 100, pontos_recompensa: parseInt(dados.pontos_recompensa) || 150,
      data_expiracao: dados.data_expiracao ? new Date(dados.data_expiracao).toISOString() : null,
    }).eq("id", id);
    if (error) { toast("Erro ao editar: " + error.message, "error"); return; }
    toast("Missão atualizada!", "success");
    buscarMissoes();
  }, [toast, buscarMissoes]);

  const deletarParticipacao = useCallback(async (id) => {
    if (!window.confirm("Tem certeza que deseja apagar este registro?")) return;
    const { data: part } = await supabase.from("missao_participacoes").select("missao_id, aprovado").eq("id", id).maybeSingle();
    if (part?.aprovado && part?.missao_id) {
      const { data: missao } = await supabase.from("missoes").select("progresso").eq("id", part.missao_id).maybeSingle();
      if (missao) {
        const novoProgresso = Math.max(0, missao.progresso - 1);
        await supabase.from("missoes").update({ progresso: novoProgresso }).eq("id", part.missao_id);
      }
    }
    const { error } = await supabase.from("missao_participacoes").delete().eq("id", id);
    if (error) { toast("Erro ao apagar: " + error.message, "error"); return; }
    toast("Registro apagado!", "success");
  }, [toast]);

  const finalizarMissao = useCallback(async (id) => {
    if (!confirm("Tem certeza que deseja ENCERRAR esta missão?")) return;
    const { error } = await supabase.from("missoes").update({ ativa: false }).eq("id", id);
    if (error) { toast("Erro: " + error.message, "error"); return; }
    toast("Missão encerrada!", "success");
    buscarMissoes();
  }, [toast, buscarMissoes]);

  const atualizarProgressoMissao = useCallback(async (id, progresso) => {
    const { error } = await supabase.from("missoes").update({ progresso }).eq("id", id);
    if (error) toast("Erro: " + error.message, "error");
  }, [toast]);

  return {
    missoes, setMissoes, missaoParticipacoes, setMissaoParticipacoes,
    buscarMissoes, buscarParticipacoesMissao, registrarParticipacao,
    aprovarParticipacao, criarMissao, editarMissao, deletarParticipacao,
    finalizarMissao, atualizarProgressoMissao,
  };
}
