"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";

const GlobalContext = createContext({});

const isErroColunaAusente = (error) => {
  const msg = error?.message || "";
  return error?.code === "42703" || msg.toLowerCase().includes("column") || msg.toLowerCase().includes("coluna");
};

export function GlobalProvider({ children }) {
  const { usuarioLogado } = useAuth();

  const [isDarkMode, setIsDarkMode] = useState(true);
  const [pontoAtivo, setPontoAtivo] = useState(null);
  const [tempoSegundos, setTempoSegundos] = useState(0);
  const [notificacaoPendente, setNotificacaoPendente] = useState(null);

  // Sync Ponto Activity
  const verificarPontoAtivo = async () => {
    if (!usuarioLogado) {
      setPontoAtivo(null);
      setTempoSegundos(0);
      return;
    }
    const { data } = await supabase
      .from("ponto_horas")
      .select("*")
      .eq("usuario_id", usuarioLogado.id)
      .is("saida", null)
      .maybeSingle();

    if (data) {
      setPontoAtivo(data);
    } else {
      setPontoAtivo(null);
      setTempoSegundos(0);
    }
  };

  useEffect(() => {
    verificarPontoAtivo();
  }, [usuarioLogado]);

  // Sync Ponto Timer
  useEffect(() => {
    if (!pontoAtivo?.entrada) return;
    const inicio = new Date(pontoAtivo.entrada).getTime();
    const interval = setInterval(() => {
      const diff = Math.floor((Date.now() - inicio) / 1000);
      setTempoSegundos(diff);
    }, 1000);
    return () => clearInterval(interval);
  }, [pontoAtivo]);

  // Sync Notifications
  useEffect(() => {
    if (!usuarioLogado) return;
    const canal = supabase.channel("notificacoes-realtime-global")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notificacoes", filter: `funcionario_id=eq.${usuarioLogado.id}` },
        (payload) => {
          setNotificacaoPendente((prev) => prev ? prev : payload.new);
        }
      )
      .subscribe();
    return () => supabase.removeChannel(canal);
  }, [usuarioLogado]);

  const buscarNotificacaoPendente = async () => {
    if (!usuarioLogado) return;
    const { data, error } = await supabase
      .from("notificacoes")
      .select("*")
      .eq("funcionario_id", usuarioLogado.id)
      .order("criado_em", { ascending: true })
      .limit(50);

    if (error) {
      console.error("Erro ao buscar notificação pendente:", error.message);
      return;
    }

    const pendente = (data || []).find((n) => !n.lido_em && n.lida !== true);
    setNotificacaoPendente(pendente || null);
  };

  useEffect(() => {
    buscarNotificacaoPendente();
  }, [usuarioLogado]);

  const registrarPonto = async (onSuccess) => {
    if (!usuarioLogado) return alert("Faça login primeiro!");
    const agora = new Date();
    const hoje = agora.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    try {
      const { data: pontoAberto, error } = await supabase
        .from("ponto_horas")
        .select("*")
        .eq("usuario_id", usuarioLogado.id)
        .is("saida", null)
        .maybeSingle();

      if (error) throw error;
      
      if (!pontoAberto) {
        const { error: insertError } = await supabase.from("ponto_horas").insert([{ usuario_id: usuarioLogado.id, nome: usuarioLogado.nome, entrada: agora.toISOString(), data: hoje }]);
        if (insertError) throw insertError;
        alert("✅ Ponto de ENTRADA registrado!");
      } else {
        const { error: updateError } = await supabase.from("ponto_horas").update({ saida: agora.toISOString() }).eq("id", pontoAberto.id);
        if (updateError) throw updateError;
        alert("🛑 Ponto de SAÍDA registrado!");
      }

      await verificarPontoAtivo();
      await buscarNotificacaoPendente();

      // Trigger re-fetch for Dashboard if needed
      if(onSuccess) onSuccess();

    } catch (err) {
      console.error("Erro no ponto:", err);
      alert("Erro ao salvar ponto.");
    }
  };

  const confirmarLeituraNotificacao = async () => {
    if (!notificacaoPendente) return;
    const agora = new Date().toISOString();
    let { error } = await supabase
      .from("notificacoes")
      .update({ lido_em: agora, lida: true })
      .eq("id", notificacaoPendente.id)
      .eq("funcionario_id", usuarioLogado.id);

    if (error && isErroColunaAusente(error)) {
      const updateData = error.message?.includes("lido_em")
        ? { lida: true }
        : { lido_em: agora };
      ({ error } = await supabase
        .from("notificacoes")
        .update(updateData)
        .eq("id", notificacaoPendente.id)
        .eq("funcionario_id", usuarioLogado.id));
    }

    if (!error) setNotificacaoPendente(null);
  };

  return (
    <GlobalContext.Provider value={{ 
      isDarkMode, setIsDarkMode, 
      pontoAtivo, tempoSegundos, registrarPonto,
      notificacaoPendente, confirmarLeituraNotificacao
    }}>
      {children}
    </GlobalContext.Provider>
  );
}

export function useGlobal() {
  return useContext(GlobalContext);
}
