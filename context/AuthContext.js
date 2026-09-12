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

  // Status de online gerenciado via Supabase Realtime Presence (0 gravações em disco)

  return (
    <AuthContext.Provider value={{ usuarioLogado, setUsuarioLogado, authLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
