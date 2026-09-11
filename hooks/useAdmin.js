"use client";

import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/lib/toast";

export function useAdmin() {
  const { toast } = useToast();
  const [novoIdAdmin, setNovoIdAdmin] = useState("");
  const [novoNomeAdmin, setNovoNomeAdmin] = useState("");
  const [novoCargoAdmin, setNovoCargoAdmin] = useState("estagiario");
  const [novoCargoAtribuicoes, setNovoCargoAtribuicoes] = useState([]);
  const [listaFuncionarios, setListaFuncionarios] = useState([]);
  const [editandoFuncionarioId, setEditandoFuncionarioId] = useState(null);
  const [editFuncNovoId, setEditFuncNovoId] = useState("");
  const [editFuncNome, setEditFuncNome] = useState("");
  const [editFuncCargo, setEditFuncCargo] = useState("estagiario");
  const [editFuncAtribuicoes, setEditFuncAtribuicoes] = useState([]);
  const [editFuncTelefone, setEditFuncTelefone] = useState("");
  const [editFuncStatus, setEditFuncStatus] = useState("ativo");
  const [editFuncAdmissao, setEditFuncAdmissao] = useState("");
  const [buscaFuncionario, setBuscaFuncionario] = useState("");
  const [hierarquiaFuncionarios, setHierarquiaFuncionarios] = useState([]);

  const cadastrarMecanico = useCallback(async () => {
    if (!novoIdAdmin || !novoNomeAdmin) {
      toast("Preencha ID e nome", "warning");
      return;
    }
    const roleStr = [novoCargoAdmin, ...novoCargoAtribuicoes].join("|");
    const { error } = await supabase.from("usuarios").insert([{
      id: parseInt(novoIdAdmin),
      nome: novoNomeAdmin,
      senha: novoIdAdmin,
      role: roleStr,
      status: "ativo",
    }]);
    if (error) { toast("Erro: " + error.message, "error"); return; }
    toast("Funcionário cadastrado!", "success");
    setNovoIdAdmin("");
    setNovoNomeAdmin("");
    setNovoCargoAdmin("estagiario");
    setNovoCargoAtribuicoes([]);
  }, [novoIdAdmin, novoNomeAdmin, novoCargoAdmin, novoCargoAtribuicoes, toast]);

  const buscarListaFuncionarios = useCallback(async () => {
    const { data } = await supabase.from("usuarios").select("*").order("id", { ascending: true });
    if (data) setListaFuncionarios(data);
  }, []);

  const buscarHierarquia = useCallback(async () => {
    const { data } = await supabase.from("usuarios").select("*").order("role", { ascending: true });
    if (data) setHierarquiaFuncionarios(data);
  }, []);

  const iniciarEdicaoFuncionario = useCallback((func) => {
    const parts = (func.role || "").split("|");
    setEditandoFuncionarioId(func.id);
    setEditFuncNovoId(String(func.id));
    setEditFuncNome(func.nome || "");
    setEditFuncCargo(parts[0] || "estagiario");
    setEditFuncAtribuicoes(parts.slice(1));
    setEditFuncTelefone(func.telefone || "");
    setEditFuncStatus(func.status || "ativo");
    setEditFuncAdmissao(func.data_admissao?.split("T")[0] || "");
  }, []);

  const atualizarFuncionario = useCallback(async () => {
    const roleStr = [editFuncCargo, ...editFuncAtribuicoes].join("|");
    const updateData = {
      nome: editFuncNome,
      role: roleStr,
      telefone: editFuncTelefone,
      status: editFuncStatus,
    };
    if (editFuncAdmissao) updateData.data_admissao = editFuncAdmissao;
    if (editFuncNovoId && parseInt(editFuncNovoId) !== editandoFuncionarioId) {
      const { error: idError } = await supabase.from("usuarios").update({ id: parseInt(editFuncNovoId) }).eq("id", editandoFuncionarioId);
      if (idError) { toast("Erro ao alterar ID: " + idError.message, "error"); return; }
    }
    const { error } = await supabase.from("usuarios").update(updateData).eq("id", editandoFuncionarioId);
    if (error) { toast("Erro: " + error.message, "error"); return; }
    toast("Funcionário atualizado!", "success");
    setEditandoFuncionarioId(null);
    buscarListaFuncionarios();
  }, [editFuncCargo, editFuncAtribuicoes, editFuncNome, editFuncTelefone, editFuncStatus, editFuncAdmissao, editFuncNovoId, editandoFuncionarioId, toast, buscarListaFuncionarios]);

  return {
    novoIdAdmin, setNovoIdAdmin, novoNomeAdmin, setNovoNomeAdmin,
    novoCargoAdmin, setNovoCargoAdmin, novoCargoAtribuicoes, setNovoCargoAtribuicoes,
    listaFuncionarios, editandoFuncionarioId, setEditandoFuncionarioId,
    editFuncNovoId, setEditFuncNovoId, editFuncNome, setEditFuncNome,
    editFuncCargo, setEditFuncCargo, editFuncAtribuicoes, setEditFuncAtribuicoes,
    editFuncTelefone, setEditFuncTelefone, editFuncStatus, setEditFuncStatus,
    editFuncAdmissao, setEditFuncAdmissao, buscaFuncionario, setBuscaFuncionario,
    hierarquiaFuncionarios,
    cadastrarMecanico, buscarListaFuncionarios, buscarHierarquia,
    iniciarEdicaoFuncionario, atualizarFuncionario,
  };
}
