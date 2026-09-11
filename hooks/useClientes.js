"use client";

import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/lib/toast";

export function useClientes() {
  const { toast } = useToast();
  const [clientesLista, setClientesLista] = useState([]);
  const [editandoId, setEditandoId] = useState(null);
  const [novoNomeCliente, setNovoNomeCliente] = useState("");
  const [buscaId, setBuscaId] = useState("");
  const [historicoClienteId, setHistoricoClienteId] = useState(null);
  const [historicoClienteDados, setHistoricoClienteDados] = useState([]);
  const [paginaClientes, setPaginaClientes] = useState(0);
  const [temMaisClientes, setTemMaisClientes] = useState(true);
  const [ordemClientesStr, setOrdemClientesStr] = useState("id_asc");
  const [paginaHistorico, setPaginaHistorico] = useState(0);
  const [temMaisHistorico, setTemMaisHistorico] = useState(true);

  const buscarClientes = useCallback(async (limparFlag, ordemForcada = null) => {
    const isLimpando = limparFlag === true || typeof limparFlag !== "boolean";
    const paginaAlvo = isLimpando ? 0 : paginaClientes;
    const ordemAtual = ordemForcada || ordemClientesStr;

    let query = supabase.from("clientes").select("*");

    if (ordemAtual === "nome_asc") {
      query = query.order("nome", { ascending: true });
    } else if (ordemAtual === "recentes") {
      query = query.order("data_ultimo_servico", { ascending: false, nullsFirst: false }).order("id", { ascending: false });
    } else {
      query = query.order("id", { ascending: true });
    }

    const { data } = await query.range(paginaAlvo * 30, (paginaAlvo + 1) * 30 - 1);

    if (data) {
      if (isLimpando) {
        setClientesLista(data);
        setPaginaClientes(1);
      } else {
        setClientesLista(prev => [...prev, ...data]);
        setPaginaClientes(prev => prev + 1);
      }
      setTemMaisClientes(data.length === 30);
    }
  }, [paginaClientes, ordemClientesStr]);

  const buscarClientePorId = useCallback(async () => {
    if (!buscaId) return buscarClientes();

    if (isNaN(Number(buscaId))) {
      const { data } = await supabase.from("clientes").select("*").ilike("nome", `%${buscaId}%`);
      if (data) setClientesLista(data);
    } else {
      const idNum = Number(buscaId);
      const { data } = await supabase.from("clientes").select("*").eq("id", idNum);
      if (data && data.length > 0) {
        setClientesLista(data);
      } else {
        const { data: dataLike } = await supabase.from("clientes").select("*").gte("id", idNum).lt("id", idNum + 1000000);
        if (dataLike) setClientesLista(dataLike);
      }
    }
  }, [buscaId, buscarClientes]);

  const buscarServicosCliente = useCallback(async (clienteId) => {
    if (historicoClienteId === clienteId) {
      setHistoricoClienteId(null);
      setHistoricoClienteDados([]);
      return;
    }
    setHistoricoClienteId(clienteId);
    setHistoricoClienteDados([]);
    const { data } = await supabase.from("servicos").select("*").eq("cliente_id", clienteId).order("data", { ascending: false }).limit(20);
    if (data) setHistoricoClienteDados(data);
  }, [historicoClienteId]);

  const atualizarNomeCliente = useCallback(async (clienteId) => {
    const nome = prompt("Novo nome:", clientesLista.find(c => c.id === clienteId)?.nome || "");
    if (!nome) return;
    const { error } = await supabase.from("clientes").update({ nome, ultima_alteracao: new Date().toISOString() }).eq("id", clienteId);
    if (error) { toast("Erro: " + error.message, "error"); return; }
    toast("Nome atualizado!", "success");
    await buscarClientes();
  }, [clientesLista, buscarClientes, toast]);

  const deletarCliente = useCallback(async (clienteId) => {
    if (!window.confirm(`Deletar cliente #${clienteId}?`)) return;
    const { error } = await supabase.from("clientes").delete().eq("id", clienteId);
    if (error) { toast("Erro: " + error.message, "error"); return; }
    toast("Cliente deletado!", "success");
    await buscarClientes();
  }, [buscarClientes, toast]);

  return {
    clientesLista, editandoId, setEditandoId,
    novoNomeCliente, setNovoNomeCliente,
    buscaId, setBuscaId,
    historicoClienteId, historicoClienteDados,
    paginaClientes, temMaisClientes,
    ordemClientesStr, setOrdemClientesStr,
    paginaHistorico, setPaginaHistorico,
    temMaisHistorico, setTemMaisHistorico,
    buscarClientes, buscarClientePorId,
    buscarServicosCliente, atualizarNomeCliente, deletarCliente,
  };
}
