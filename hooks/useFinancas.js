"use client";

import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/lib/toast";

export function useFinancas() {
  const { toast } = useToast();
  const [financasFuncionarios, setFinancasFuncionarios] = useState([]);
  const [pagamentosSemanais, setPagamentosSemanais] = useState([]);
  const [editandoFinancaId, setEditandoFinancaId] = useState(null);
  const [editFinancaValor, setEditFinancaValor] = useState("");
  const [editFinancaVencimento, setEditFinancaVencimento] = useState("");
  const [editFinancaRenovacao, setEditFinancaRenovacao] = useState(true);
  const [financasCarregando, setFinancasCarregando] = useState(false);

  const buscarFinancas = useCallback(async () => {
    setFinancasCarregando(true);
    const { data } = await supabase.from("usuarios").select("*").order("id");
    if (data) setFinancasFuncionarios(data);
    setFinancasCarregando(false);
  }, []);

  const buscarPagamentosSemanais = useCallback(async () => {
    const { data } = await supabase.from("pagamentos_semanais").select("*").order("criado_em", { ascending: false }).limit(200);
    if (data) setPagamentosSemanais(data);
  }, []);

  const salvarFinancaFuncionario = useCallback(async (funcionarioId) => {
    const updateData = {};
    if (editFinancaValor) updateData.valor_semanal = parseFloat(editFinancaValor);
    if (editFinancaVencimento) updateData.data_vencimento = editFinancaVencimento;
    const { error } = await supabase.from("usuarios").update(updateData).eq("id", funcionarioId);
    if (error) { toast("Erro: " + error.message, "error"); return; }
    toast("Salvo!", "success");
    buscarFinancas();
  }, [editFinancaValor, editFinancaVencimento, toast, buscarFinancas]);

  const registrarPagamentoManual = useCallback(async (funcionarioId, valor, observacao, comprovanteLink) => {
    const { data: func } = await supabase.from("usuarios").select("nome").eq("id", funcionarioId).maybeSingle();
    const { error } = await supabase.from("pagamentos_semanais").insert([{
      funcionario_id: funcionarioId,
      funcionario_nome: func?.nome || "",
      valor: parseFloat(valor),
      observacao: observacao || null,
      comprovante_link: comprovanteLink || null,
    }]);
    if (error) { toast("Erro: " + error.message, "error"); return; }
    toast("Pagamento registrado!", "success");
    buscarPagamentosSemanais();
  }, [toast, buscarPagamentosSemanais]);

  const confirmarPagamentoSemanal = useCallback(async (id) => {
    const { error } = await supabase.from("pagamentos_semanais").update({ confirmado: true }).eq("id", id);
    if (error) { toast("Erro: " + error.message, "error"); return; }
    toast("Pagamento confirmado!", "success");
    buscarPagamentosSemanais();
  }, [toast, buscarPagamentosSemanais]);

  const apagarPagamento = useCallback(async (id) => {
    if (!window.confirm("Apagar pagamento?")) return;
    const { error } = await supabase.from("pagamentos_semanais").delete().eq("id", id);
    if (error) { toast("Erro: " + error.message, "error"); return; }
    toast("Apagado!", "success");
    buscarPagamentosSemanais();
  }, [toast, buscarPagamentosSemanais]);

  const desbloquearFuncionario = useCallback(async (funcionarioId) => {
    await supabase.from("usuarios").update({ bloqueado_financeiro: false }).eq("id", funcionarioId);
    toast("Desbloqueado!", "success");
    buscarFinancas();
  }, [toast, buscarFinancas]);

  const atualizarVencimentoManual = useCallback(async (funcionarioId, novaData) => {
    await supabase.from("usuarios").update({ data_vencimento: novaData }).eq("id", funcionarioId);
    toast("Vencimento atualizado!", "success");
    buscarFinancas();
  }, [toast, buscarFinancas]);

  const iniciarEdicaoFinanca = useCallback((func) => {
    setEditandoFinancaId(func.id);
    setEditFinancaValor(func.valor_semanal || "");
    setEditFinancaVencimento(func.data_vencimento || "");
    setEditFinancaRenovacao(true);
  }, []);

  return {
    financasFuncionarios, pagamentosSemanais,
    editandoFinancaId, setEditandoFinancaId,
    editFinancaValor, setEditFinancaValor,
    editFinancaVencimento, setEditFinancaVencimento,
    editFinancaRenovacao, setEditFinancaRenovacao,
    financasCarregando,
    buscarFinancas, buscarPagamentosSemanais,
    salvarFinancaFuncionario, registrarPagamentoManual,
    confirmarPagamentoSemanal, apagarPagamento,
    desbloquearFuncionario, atualizarVencimentoManual,
    iniciarEdicaoFinanca,
  };
}
