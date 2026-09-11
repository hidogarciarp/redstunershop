"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [usuarioLogado, setUsuarioLogado] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Load from local storage on mount
  useEffect(() => {
    const salvo = localStorage.getItem("reds_session_user");
    if (salvo) {
      try {
        const parsed = JSON.parse(salvo);
        setUsuarioLogado(parsed);
      } catch (e) {
        localStorage.removeItem("reds_session_user");
      }
    }
    setAuthLoading(false);
  }, []);

  // Keep local storage in sync
  useEffect(() => {
    if (usuarioLogado) {
      localStorage.setItem("reds_session_user", JSON.stringify(usuarioLogado));
    } else {
      localStorage.removeItem("reds_session_user");
    }
  }, [usuarioLogado]);

  // Keep user "online" if logged in (Moved from page.js line ~1724)
  useEffect(() => {
    if (!usuarioLogado) return;
    
    const ficarOnline = async () => {
      await supabase.from("usuarios_online").upsert({
        usuario_id: usuarioLogado.id,
        nome: usuarioLogado.nome,
        role: usuarioLogado.role,
        ultima_atividade: new Date().toISOString()
      }, { onConflict: "usuario_id" });
    };

    ficarOnline();
    const interval = setInterval(() => ficarOnline(), 10000);
    
    return () => clearInterval(interval);
  }, [usuarioLogado]);

  // Clear online status on close
  useEffect(() => {
    const handleClose = async () => {
      if (!usuarioLogado) return;
      await supabase.from("usuarios_online").delete().eq("usuario_id", usuarioLogado.id);
    };
    window.addEventListener("beforeunload", handleClose);
    return () => window.removeEventListener("beforeunload", handleClose);
  }, [usuarioLogado]);

  return (
    <AuthContext.Provider value={{ usuarioLogado, setUsuarioLogado, authLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
