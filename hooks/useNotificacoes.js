"use client";

import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/lib/toast";

export function useNotificacoes(usuarioLogado) {
  const { toast } = useToast();
  const [historicoNotificacoes, setHistoricoNotificacoes] = useState([]);
  const [notifIdFuncionario, setNotifIdFuncionario] = useState("");
  const [notifMensagem, setNotifMensagem] = useState("");
  const [notifFuncionarioInfo, setNotifFuncionarioInfo] = useState(null);
  const [notifBuscando, setNotifBuscando] = useState(false);
  const [notifAnonimo, setNotifAnonimo] = useState(false);
  const [notifModoMassa, setNotifModoMassa] = useState(false);
  const [notifMassaMensagem, setNotifMassaMensagem] = useState("");
  const [notifMassaNiveis, setNotifMassaNiveis] = useState([]);
  const [notifMassaTodos, setNotifMassaTodos] = useState(false);
  const [notifMassaAnonimo, setNotifMassaAnonimo] = useState(false);
  const [notifMassaEnviando, setNotifMassaEnviando] = useState(false);
  const [usuariosRoleMapa, setUsuariosRoleMapa] = useState({});

  const buscarFuncionarioParaNotif = useCallback(async (id) => {
    if (!id) { setNotifFuncionarioInfo(null); return; }
    setNotifBuscando(true);
    const { data } = await supabase.from("usuarios").select("*").eq("id", parseInt(id)).maybeSingle();
    setNotifFuncionarioInfo(data || null);
    setNotifBuscando(false);
  }, []);

  const enviarNotificacao = useCallback(async () => {
    if (!notifIdFuncionario || !notifMensagem) { toast("Preencha ID e mensagem", "warning"); return; }
    const remetenteNome = notifAnonimo ? "Anônimo" : usuarioLogado?.nome || "Sistema";
    const { error } = await supabase.from("notificacoes").insert([{
      admin_id: usuarioLogado?.id,
      admin_nome: remetenteNome,
      admin_id_real: notifAnonimo ? usuarioLogado?.id : null,
      anonimo: notifAnonimo,
      funcionario_id: parseInt(notifIdFuncionario),
      funcionario_nome: notifFuncionarioInfo?.nome || "",
      mensagem: notifMensagem,
    }]);
    if (error) { toast("Erro: " + error.message, "error"); return; }
    toast("Notificação enviada!", "success");
    setNotifMensagem("");
    setNotifIdFuncionario("");
    setNotifFuncionarioInfo(null);
    setNotifAnonimo(false);
  }, [notifIdFuncionario, notifMensagem, notifAnonimo, notifFuncionarioInfo, usuarioLogado, toast]);

  const enviarNotificacaoMassa = useCallback(async () => {
    if ((!notifMassaTodos && notifMassaNiveis.length === 0) || !notifMassaMensagem) {
      toast("Selecione destinatários e escreva a mensagem", "warning");
      return;
    }
    setNotifMassaEnviando(true);
    let query = supabase.from("usuarios").select("id, nome, role");
    if (!notifMassaTodos) {
      query = query.in("role", notifMassaNiveis.map(n => `%${n}%`));
    }
    const { data: usuarios } = await query;
    if (!usuarios) { setNotifMassaEnviando(false); return; }

    const remetenteNome = notifMassaAnonimo ? "Anônimo" : usuarioLogado?.nome || "Sistema";
    const inserts = usuarios.map((u) => ({
      admin_id: usuarioLogado?.id,
      admin_nome: remetenteNome,
      admin_id_real: notifMassaAnonimo ? usuarioLogado?.id : null,
      anonimo: notifMassaAnonimo,
      funcionario_id: u.id,
      funcionario_nome: u.nome,
      mensagem: notifMassaMensagem,
    }));

    const { error } = await supabase.from("notificacoes").insert(inserts);
    if (error) { toast("Erro em massa: " + error.message, "error"); }
    else { toast(`Notificação em massa enviada para ${inserts.length} funcionários!`, "success"); }
    setNotifMassaEnviando(false);
    setNotifMassaMensagem("");
    setNotifMassaNiveis([]);
    setNotifMassaTodos(false);
    setNotifMassaAnonimo(false);
    setNotifModoMassa(false);
  }, [notifMassaTodos, notifMassaNiveis, notifMassaMensagem, notifMassaAnonimo, usuarioLogado, toast]);

  const buscarHistoricoNotificacoes = useCallback(async () => {
    const { data } = await supabase.from("notificacoes").select("*").order("criado_em", { ascending: false }).limit(200);
    if (data) setHistoricoNotificacoes(data);
  }, []);

  const buscarUsuariosComRole = useCallback(async () => {
    const { data } = await supabase.from("usuarios").select("id, nome, role");
    if (data) {
      const mapa = {};
      data.forEach((u) => { mapa[u.id] = { nome: u.nome, role: u.role }; });
      setUsuariosRoleMapa(mapa);
    }
  }, []);

  const apagarNotificacao = useCallback(async (id) => {
    if (!window.confirm("Apagar notificação?")) return;
    const { error } = await supabase.from("notificacoes").delete().eq("id", id);
    if (error) { toast("Erro: " + error.message, "error"); return; }
    toast("Notificação apagada!", "success");
    buscarHistoricoNotificacoes();
  }, [toast, buscarHistoricoNotificacoes]);

  return {
    historicoNotificacoes, notifIdFuncionario, setNotifIdFuncionario,
    notifMensagem, setNotifMensagem, notifFuncionarioInfo, setNotifFuncionarioInfo,
    notifBuscando, notifAnonimo, setNotifAnonimo,
    notifModoMassa, setNotifModoMassa, notifMassaMensagem, setNotifMassaMensagem,
    notifMassaNiveis, setNotifMassaNiveis, notifMassaTodos, setNotifMassaTodos,
    notifMassaAnonimo, setNotifMassaAnonimo, notifMassaEnviando,
    usuariosRoleMapa,
    buscarFuncionarioParaNotif, enviarNotificacao, enviarNotificacaoMassa,
    buscarHistoricoNotificacoes, buscarUsuariosComRole, apagarNotificacao,
  };
}
