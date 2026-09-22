"use client";

import React, { useEffect, useState } from "react";
import MainSite from "../MainSite";

export default function V2ClonePage() {
  const [autorizado, setAutorizado] = useState(false);
  const [verificando, setVerificando] = useState(true);

  const checarPermissao = () => {
    try {
      const salvo = typeof window !== "undefined" ? localStorage.getItem("reds_session_user") : null;
      if (salvo) {
        const u = JSON.parse(salvo);
        const role = String(u?.role || "").toLowerCase();
        const primary = role.split("|")[0];
        const isDonoAdmin =
          primary === "admin" ||
          primary === "dono" ||
          role.includes("admin") ||
          role.includes("dono");
        setAutorizado(Boolean(isDonoAdmin));
      } else {
        // Não logado: estritamente bloqueado no V2
        setAutorizado(false);
      }
    } catch {
      setAutorizado(false);
    } finally {
      setVerificando(false);
    }
  };

  useEffect(() => {
    checarPermissao();

    // Ouve alterações no storage caso o usuário faça login/logout em outra aba ou ação
    const handleStorage = (e) => {
      if (e.key === "reds_session_user") {
        checarPermissao();
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  if (verificando) {
    return (
      <div
        style={{
          minHeight: "100vh",
          backgroundColor: "#0b0b0b",
          display: "grid",
          placeItems: "center",
          color: "#fff",
          fontFamily: "'Inter', sans-serif"
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "28px", marginBottom: "12px", animation: "spin 1s linear infinite" }}>🔄</div>
          <div style={{ fontSize: "14px", color: "#94a3b8" }}>Carregando Versão 2 (Tabelas Centralizadas)...</div>
        </div>
      </div>
    );
  }

  if (!autorizado) {
    return (
      <div
        style={{
          minHeight: "100vh",
          backgroundColor: "#0b0b0b",
          backgroundImage: "radial-gradient(circle at top, #2b0b0d 0%, #0b0b0b 70%)",
          display: "grid",
          placeItems: "center",
          padding: "20px",
          color: "#fff",
          fontFamily: "'Inter', sans-serif"
        }}
      >
        <div
          style={{
            maxWidth: "480px",
            width: "100%",
            background: "#161618",
            border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: "16px",
            padding: "36px 28px",
            textAlign: "center",
            boxShadow: "0 20px 50px rgba(0,0,0,0.6)"
          }}
        >
          <div style={{ fontSize: "44px", marginBottom: "16px" }}>🔒</div>
          <h2 style={{ fontSize: "20px", fontWeight: "800", color: "#ef4444", marginBottom: "12px" }}>
            Acesso Restrito ao Clone V2
          </h2>
          <p style={{ fontSize: "13.5px", color: "#cbd5e1", lineHeight: 1.6, marginBottom: "24px" }}>
            A Versão 2 opera diretamente sobre a nova base de dados centralizada do Supabase e está liberada <strong>exclusivamente para Donos e Administradores</strong>.
            <br /><br />
            Faça login com uma conta administrativa no site principal para prosseguir.
          </p>
          <button
            onClick={() => {
              window.location.href = "/";
            }}
            style={{
              background: "#ef4444",
              color: "#fff",
              border: "none",
              borderRadius: "10px",
              padding: "12px 24px",
              fontSize: "13px",
              fontWeight: "700",
              cursor: "pointer"
            }}
          >
            ⬅ Fazer Login / Site Principal
          </button>
        </div>
      </div>
    );
  }

  return <MainSite isV2={true} />;
}
