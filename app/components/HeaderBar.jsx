"use client";
import React, { memo, useEffect, useRef, useState } from "react";

function usePontoElapsed(pontoAtivo) {
  const [segundos, setSegundos] = useState(0);

  useEffect(() => {
    const entrada = pontoAtivo?.entrada;
    if (!entrada) {
      const limpar = window.setTimeout(() => setSegundos(0), 0);
      return () => window.clearTimeout(limpar);
    }

    const inicio = new Date(entrada).getTime();
    const atualizar = () => setSegundos(Math.max(0, Math.floor((Date.now() - inicio) / 1000)));
    const inicial = window.setTimeout(atualizar, 0);
    const intervalo = window.setInterval(atualizar, 1000);
    return () => {
      window.clearTimeout(inicial);
      window.clearInterval(intervalo);
    };
  }, [pontoAtivo?.entrada]);

  return segundos;
}

const buildMenuItems = ({ userPodeNotificar, userPodeFinancas, userIsAdmin, userRole }) => {
  const userPodeNitro = userRole && (
    userRole.includes("admin") ||
    userRole.includes("dono") ||
    userRole.includes("gerente_geral") ||
    userRole.includes("financeiro")
  );
  const userPodeAdmin = userIsAdmin || (userRole && (
    userRole.includes("gerente_geral") ||
    userRole.includes("gerente") ||
    userRole.includes("gerente_rh") ||
    userRole.includes("resp_rh")
  ));
  const userIsDono = (userRole || "").split("|").includes("dono") || (userRole || "").includes("admin");

  return [
    { id: "dashboard", label: "Dashboard" },
    { id: "ponto", label: "Ponto" },
    { id: "hierarquia", label: "Hierarquia" },
    { id: "minha-conta", label: "Minha Conta" },
    { id: "avisos", label: "Quadro de Avisos" },
    { id: "tunagens", label: "Tunagens" },
    ...(userPodeNotificar ? [{ id: "notificacoes", label: "Notificações" }] : []),
    ...(userIsAdmin ? [{ id: "clientes", label: "Clientes" }] : []),
    ...(userPodeAdmin ? [{ id: "admin", label: "Admin" }] : []),
    ...((userIsAdmin || (userRole && (userRole.includes("gerente_geral") || userRole.includes("resp_ponto") || userRole.includes("dono"))))
      ? [
        { id: "monitor-ponto", label: "⚡ Monitor ao Vivo" },
        { id: "atividades", label: "📋 Registro de Atividades" },
        { id: "ponto-admin", label: "Ponto Admin" },
        { id: "db-admin", label: "Banco de Dados" },
        { id: "bonificacao", label: "Bonificação" },
      ] : []),
    ...(userIsAdmin ? [
      { id: "relatorio", label: "Relatório" },
    ] : []),
    ...((userRole && (userRole.includes("gerente") || userRole.includes("dono") || userRole.includes("admin")))
      ? [
        { id: "blacklist", label: "Blacklist" },
      ] : []),
    { id: "candidaturas", label: "Candidaturas" },
  ];
};

const ProfileControls = ({ isDarkMode, setIsDarkMode, layoutPreferido, setLayoutPreferido, podeVisualizarComo, cargoVisualizacao, onVisualizarComo, cargosVisualizacao = [] }) => {
  const [aberto, setAberto] = useState(false);
  const opcaoStyle = (ativo) => ({ width: "100%", border: `1px solid ${ativo ? "rgba(220,38,38,.65)" : "rgba(255,255,255,.08)"}`, background: ativo ? "rgba(185,28,28,.22)" : "rgba(255,255,255,.035)", color: ativo ? "#fff" : "#cbd5e1", padding: "9px 10px", borderRadius: "8px", cursor: "pointer", fontSize: "11px", fontWeight: 800, textAlign: "left" });
  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
      <button
        type="button"
        onClick={() => setAberto((valor) => !valor)}
        title="Acessibilidade e aparência"
        aria-expanded={aberto}
        aria-label="Acessibilidade e aparência"
        style={{ width: "34px", height: "34px", background: aberto ? "rgba(185,28,28,.28)" : "rgba(255,255,255,.055)", border: `1px solid ${aberto ? "rgba(239,68,68,.55)" : "rgba(255,255,255,.12)"}`, color: "#fff", padding: 0, borderRadius: "9px", cursor: "pointer", fontWeight: 850, fontSize: "16px", display: "grid", placeItems: "center" }}
      >
        <span aria-hidden="true">♿</span>
      </button>
      {aberto && (
        <div style={{ position: "absolute", top: "calc(100% + 9px)", right: 0, zIndex: 10050, width: "235px", padding: "12px", borderRadius: "12px", border: "1px solid rgba(255,255,255,.12)", background: "rgba(15,15,17,.98)", boxShadow: "0 18px 50px rgba(0,0,0,.6)", backdropFilter: "blur(18px)" }}>
          <div style={{ color: "#fff", fontSize: "12px", fontWeight: 900, marginBottom: "10px" }}>Acessibilidade e aparência</div>
          <div style={{ color: "#94a3b8", fontSize: "9px", fontWeight: 800, letterSpacing: ".8px", textTransform: "uppercase", marginBottom: "6px" }}>Tema</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginBottom: "12px" }}>
            <button type="button" style={opcaoStyle(!isDarkMode)} onClick={() => setIsDarkMode?.(false)}>☀️ Claro</button>
            <button type="button" style={opcaoStyle(isDarkMode)} onClick={() => setIsDarkMode?.(true)}>🌙 Escuro</button>
          </div>
          <div style={{ color: "#94a3b8", fontSize: "9px", fontWeight: 800, letterSpacing: ".8px", textTransform: "uppercase", marginBottom: "6px" }}>Posição do menu</div>
          <div style={{ display: "grid", gap: "6px" }}>
            <button type="button" style={opcaoStyle(layoutPreferido === "lateral")} onClick={() => setLayoutPreferido?.("lateral")}>☰ Menu lateral</button>
            <button type="button" style={opcaoStyle(layoutPreferido === "topo")} onClick={() => setLayoutPreferido?.("topo")}>▰ Menu superior</button>
          </div>
          {podeVisualizarComo && (
            <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid rgba(255,255,255,.09)" }}>
              <div style={{ color: "#94a3b8", fontSize: "9px", fontWeight: 800, letterSpacing: ".8px", textTransform: "uppercase", marginBottom: "6px" }}>Visualizar como</div>
              <select value={cargoVisualizacao || ""} onChange={(e) => onVisualizarComo?.(e.target.value)} aria-label="Visualizar o site como outro cargo" style={{ width: "100%", border: "1px solid rgba(255,255,255,.12)", background: "#19191c", color: "#fff", padding: "9px 10px", borderRadius: "8px", cursor: "pointer", fontSize: "11px", fontWeight: 800 }}>
                <option value="">Visão de Dono</option>
                {cargosVisualizacao.filter((cargo) => cargo.value !== "dono" && cargo.value !== "admin").map((cargo) => <option key={cargo.value} value={cargo.value}>{cargo.label}</option>)}
              </select>
              <div style={{ color: "#64748b", fontSize: "9px", lineHeight: 1.4, marginTop: "6px" }}>Simula menus e páginas sem alterar seu cargo real.</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// =============================================
// SIDEBAR COMPONENT — Memoizado para NÃO
// re-renderizar a cada tick do cronômetro,
// evitando o bug de reset de scroll.
// =============================================
const getMenuIcon = (id) => {
  const icons = {
    dashboard: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /></svg>,
    ponto: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
    hierarquia: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM6 16a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm12 0a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 8v4M6 12h12v4" /></svg>,
    "minha-conta": <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2m8-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" /></svg>,
    notificacoes: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9zm-4.27 13a2 2 0 0 1-3.46 0" /></svg>,
    avisos: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>,
    cursos: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5z" /><path d="M8 7h8M8 11h6" /></svg>,
    financas: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /><circle cx="18" cy="14" r="1.5" /></svg>,
    clientes: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2m8-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm14-2a4 4 0 0 0-3-3.87m0 7.75A4 4 0 0 0 21 12m-3 9v-2a4 4 0 0 0-3-3.87" /></svg>,
    admin: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68h.09A1.65 1.65 0 0 0 9.68 3V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>,
    "monitor-ponto": <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>,
    "ponto-admin": <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="15" rx="2" /><line x1="9" y1="9" x2="15" y2="9" /><line x1="9" y1="13" x2="15" y2="13" /><line x1="5" y1="9" x2="6" y2="9" /><line x1="5" y1="13" x2="6" y2="13" /></svg>,
    "db-admin": <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v7c0 1.7 4 3 9 3s9-1.3 9-3V5M3 12v7c0 1.7 4 3 9 3s9-1.3 9-3v-7"/></svg>,
    tunagens: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M14.7 6.3a4 4 0 0 0-5-5L7 4l3 3-2.5 2.5-3-3L2 9a4 4 0 0 0 5.7 5.7L15 22l7-7-7.3-7.3Z"/></svg>,
    bonificacao: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="3" y="8" width="18" height="13" rx="2"/><path d="M12 8v13M3 12h18M7.5 8C5 8 4 6.8 4 5.5S5 3 6.5 3C9 3 12 8 12 8s3-5 5.5-5C19 3 20 4.2 20 5.5S19 8 16.5 8"/></svg>,
    relatorio: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>,
    "outras-mecanicas": <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68h.09A1.65 1.65 0 0 0 9.68 3V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>,
    blacklist: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><line x1="8" y1="11" x2="16" y2="11" /></svg>,
    "nitro-admin": <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>,
    recrutamento: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2m8-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm11 1v6m-3-3h6" /></svg>,
    "evento-derby": <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7" /></svg>,
    "evento-triathlon": <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="5" r="3" /><path d="M5 22l3-8 4 3 4-3 3 8" /><path d="M12 8v6" /></svg>,
    candidaturas: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>,
    missoes: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>,
    pagamentos: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>,
    bot: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8.01" y2="16"/><line x1="16" y1="16" x2="16.01" y2="16"/></svg>,
  };
  return icons[id] || <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="10" /></svg>;
};

const Sidebar = memo(function Sidebar({
  paginaAtual,
  setPaginaAtual,
  setUsuarioLogado,
  userPodeNotificar,
  userPodeFinancas,
  userIsAdmin,
  userRole,
  isOpen,
}) {
  const scrollRef = useRef(null);

  const menuItems = buildMenuItems({ userPodeNotificar, userPodeFinancas, userIsAdmin, userRole });


  return (
    <aside style={{
      width: "270px",
      height: "100vh",
      position: "fixed",
      top: 0,
      left: 0,
      transform: isOpen ? "translateX(0)" : "translateX(-100%)",
      background: "linear-gradient(180deg, #3d070b 0%, #150204 100%)",
      borderRight: "1px solid rgba(255,255,255,0.05)",
      display: "flex",
      flexDirection: "column",
      padding: "20px 16px",
      zIndex: 1000,
      boxShadow: "10px 0 30px rgba(0,0,0,0.5)",
      overflow: "hidden",
      transition: "transform 0.22s ease",
    }}>
      {/* LOGO */}
      <button
        type="button"
        onClick={() => setPaginaAtual("dashboard")}
        title="Dashboard"
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          marginBottom: "22px",
          border: "none",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          padding: "0 0 14px",
          flexShrink: 0,
          background: "transparent",
          cursor: "pointer",
        }}
      >
        <img
          src="/logo_reds.png"
          alt="Red's Tunershop"
          style={{ width: "195px", maxHeight: "90px", objectFit: "contain" }}
          onError={(e) => { e.target.src = "/logo-reds3.png"; }}
        />
      </button>

      {/* NAVIGATION — ref mantém scroll position independente de re-renders */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: "auto",
          paddingRight: "4px",
          scrollbarWidth: "thin",
          scrollbarColor: "rgba(255,255,255,0.1) transparent",
        }}
      >
        {menuItems.map((item) => {
          const ativo = paginaAtual === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                if (item.id === "monitor-ponto") {
                  window.dispatchEvent(new Event("abrir-monitor-ponto"));
                  return;
                }
                setPaginaAtual(item.id);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                width: "100%",
                padding: "9px 13px",
                borderRadius: "8px",
                color: ativo ? "#ffffff" : "rgba(255,255,255,0.6)",
                textDecoration: "none",
                background: ativo ? "rgba(255,255,255,0.08)" : "transparent",
                border: "none",
                cursor: "pointer",
                fontSize: "13px",
                fontWeight: ativo ? "700" : "500",
                textAlign: "left",
                transition: "color 0.15s, background 0.15s",
                marginBottom: "2px",
                boxShadow: ativo ? "inset 3px 0 0 #8b181e" : "none",
                fontFamily: "'Inter', sans-serif",
              }}
              onMouseEnter={(e) => {
                if (!ativo) {
                  e.currentTarget.style.color = "#ffffff";
                  e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                }
              }}
              onMouseLeave={(e) => {
                if (!ativo) {
                  e.currentTarget.style.color = "rgba(255,255,255,0.6)";
                  e.currentTarget.style.background = "transparent";
                }
              }}
            >
              <span style={{ opacity: ativo ? 1 : 0.6, flexShrink: 0, display: "flex" }}>
                {getMenuIcon(item.id)}
              </span>
              {item.label}
            </button>
          );
        })}
      </div>

      {/* LOGOUT */}
      <div style={{ paddingTop: "12px", borderTop: "1px solid rgba(255,255,255,0.06)", marginTop: "8px", flexShrink: 0 }}>
        <button
          onClick={() => { setUsuarioLogado(null); setPaginaAtual("login"); }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            width: "100%",
            padding: "9px 13px",
            borderRadius: "8px",
            background: "rgba(239,68,68,0.06)",
            border: "1px solid rgba(239,68,68,0.18)",
            color: "#ef4444",
            cursor: "pointer",
            fontSize: "13px",
            fontWeight: "700",
            fontFamily: "'Inter', sans-serif",
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.14)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.06)"; }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m4 16 5-5-5-5m5 5H9" />
          </svg>
          Sair
        </button>
      </div>
    </aside>
  );
});

export function TopHeaderBar({
  paginaAtual,
  setPaginaAtual,
  pontoAtivo,
  tempoSegundos,
  formatarCronometro,
  registrarPonto,
  usuarioLogado,
  setUsuarioLogado,
  getLabelCargo,
  userPodeNotificar,
  userPodeFinancas,
  userIsAdmin,
  userRole,
  isDarkMode,
  setIsDarkMode,
  layoutPreferido,
  setLayoutPreferido,
  serviceNotificationCount = 0,
  onOpenServiceNotifications,
  podeVisualizarComo,
  cargoVisualizacao,
  onVisualizarComo,
  cargosVisualizacao,
}) {
  const tempoPonto = usePontoElapsed(pontoAtivo);
  const menuItems = buildMenuItems({ userPodeNotificar, userPodeFinancas, userIsAdmin, userRole });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=Inter:wght@300;400;500;600;700;800&display=swap');

        * { box-sizing: border-box; }

        body {
          --reds-sidebar-width: 0px;
          margin: 0 !important;
          padding: 0 !important;
          padding-left: 0 !important;
          padding-top: 0 !important;
          min-height: 100vh;
          font-family: 'Inter', sans-serif !important;
          background-color: #0d0d0d !important;
          background-image:
            linear-gradient(to bottom, rgba(13,13,13,0.4) 0%, rgba(13,13,13,0.55) 50%, rgba(13,13,13,0.7) 100%),
            url('/plano_fundo.png'),
            linear-gradient(to bottom, rgba(13,13,13,0.7) 0%, rgba(13,13,13,0.6) 50%, rgba(13,13,13,0.75) 100%),
            url('/bg-mechanical.jpg') !important;
          background-attachment: fixed !important;
          background-size: auto, cover, auto, cover !important;
          background-position: center center !important;
          color: #ffffff;
        }

        input[type="checkbox"] {
          appearance: none; -webkit-appearance: none;
          width: 17px; height: 17px;
          border: 1.5px solid rgba(255,255,255,0.22);
          border-radius: 4px;
          background-color: rgba(0,0,0,0.38);
          display: inline-grid; place-content: center;
          cursor: pointer; vertical-align: middle;
          transition: all 0.18s; flex-shrink: 0;
        }
        input[type="checkbox"]:checked { background-color: #22c55e !important; border-color: #22c55e !important; box-shadow: 0 0 8px rgba(34,197,94,0.35); }
        input[type="checkbox"]::before { content: ""; width: 9px; height: 9px; transform: scale(0); transition: 100ms transform ease-in-out; box-shadow: inset 1em 1em white; clip-path: polygon(14% 44%, 0 65%, 50% 100%, 100% 16%, 80% 0%, 43% 62%); }
        input[type="checkbox"]:checked::before { transform: scale(1); }
        input[type="checkbox"]:hover { border-color: #8b181e; }

        input:focus, textarea:focus, select:focus { border-color: #8b181e !important; box-shadow: 0 0 0 3px rgba(139,24,30,0.22) !important; outline: none; }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.7); cursor: pointer; }
        select option { background: #161616; color: #ffffff; }

        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 4px; }

        @keyframes fadeLogin { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulseGreen { 0%{box-shadow:0 0 0 0 rgba(34,197,94,0.4)} 70%{box-shadow:0 0 0 10px rgba(34,197,94,0)} 100%{box-shadow:0 0 0 0 rgba(34,197,94,0)} }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        @media (max-width: 780px) {
          body { padding-top: 0 !important; }
        }
      `}</style>

      <header style={{
        position: "sticky",
        top: 0,
        left: 0,
        right: 0,
        background: "rgba(14,14,14,0.88)",
        backdropFilter: "blur(18px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        zIndex: 5000,
        boxShadow: "0 6px 24px rgba(0,0,0,0.28)",
        transform: "translateZ(0)",
      }}>
        <div style={{
          minHeight: "68px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "8px 16px",
          flexWrap: "wrap",
        }}>
          <button
            onClick={() => setPaginaAtual("dashboard")}
            style={{
              background: "transparent",
              border: "none",
              padding: 0,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              flexShrink: 0,
              minHeight: "48px",
            }}
            title="Dashboard"
          >
            <img
              src="/logo_reds.png"
              alt="Red's Tunershop"
          style={{ width: "137px", maxHeight: "80px", objectFit: "contain" }}
              onError={(e) => { e.target.src = "/logo-reds3.png"; }}
            />
          </button>

          <nav style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "6px",
            overflowX: "visible",
            padding: "1px 2px",
            minWidth: "280px",
          }}>
            {menuItems.map((item) => {
              const ativo = paginaAtual === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    if (item.id === "monitor-ponto") {
                      window.dispatchEvent(new Event("abrir-monitor-ponto"));
                      return;
                    }
                    setPaginaAtual(item.id);
                  }}
                  style={{
                    background: ativo ? "rgba(139,24,30,0.32)" : "rgba(255,255,255,0.045)",
                    border: ativo ? "1px solid rgba(139,24,30,0.75)" : "1px solid rgba(255,255,255,0.08)",
                    color: ativo ? "#ffffff" : "rgba(255,255,255,0.68)",
                    padding: "7px 9px",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontSize: "11.5px",
                    fontWeight: ativo ? "800" : "650",
                    whiteSpace: "nowrap",
                    boxShadow: ativo ? "0 0 14px rgba(139,24,30,0.18)" : "none",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  {getMenuIcon(item.id)}
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* CARD DE PERFIL E CONTROLES EM 2 LINHAS COMPACTAS */}
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: "5px",
            flexShrink: 0,
            padding: "8px 12px",
            background: "rgba(255,255,255,0.045)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "14px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
          }}>
            {/* Linha 1: identificação, tema, notificações, avatar e saída */}
            <div style={{ display: "grid", gridTemplateColumns: "34px minmax(105px, 1fr) 42px", alignItems: "center", gap: "8px", width: "100%" }}>
              <button
                onClick={() => onOpenServiceNotifications?.()}
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "8px",
                  cursor: "pointer",
                  color: "rgba(255,255,255,0.75)",
                  position: "relative",
                  display: "grid",
                  placeItems: "center",
                  width: "34px",
                  height: "34px",
                  padding: "0",
                }}
                title="Notificações"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9zm-4.27 13a2 2 0 0 1-3.46 0" /></svg>
                {serviceNotificationCount > 0 && <span style={{ position: "absolute", top: "-5px", right: "-5px", minWidth: "16px", height: "16px", padding: "0 3px", background: "#ef4444", color: "#fff", borderRadius: "10px", border: "1.5px solid #0d0d0d", fontSize: "9px", fontWeight: "900", display: "grid", placeItems: "center" }}>{serviceNotificationCount > 99 ? "99+" : serviceNotificationCount}</span>}
              </button>

              <div style={{ textAlign: "left", lineHeight: 1.15, minWidth: "105px" }}>
                <div style={{ color: "#ffffff", fontWeight: "800", fontSize: "11.5px", whiteSpace: "nowrap" }}>{usuarioLogado?.nome}</div>
                <div style={{ color: "#facc15", fontWeight: "850", fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.5px" }}>{getLabelCargo(userRole)}</div>
              </div>

              {/* Avatar Foto na linha superior */}
              <button
                onClick={() => setPaginaAtual("minha-conta")}
                title="Minha Conta"
                style={{
                  width: "34px",
                  height: "34px",
                  borderRadius: "50%",
                  background: usuarioLogado?.avatar_url ? "transparent" : "linear-gradient(135deg, #8b181e 0%, #facc15 100%)",
                  border: "2px solid rgba(139,24,30,0.6)",
                  color: "#ffffff",
                  cursor: "pointer",
                  overflow: "hidden",
                  fontWeight: "900",
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                  boxShadow: "0 0 6px rgba(139,24,30,0.3)",
                  padding: 0,
                }}
              >
                {usuarioLogado?.avatar_url
                  ? <img src={usuarioLogado.avatar_url} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : (usuarioLogado?.nome ? usuarioLogado.nome[0].toUpperCase() : "M")
                }
              </button>

            </div>

            {/* Linha 2: situação do ponto */}
            <div style={{ display: "grid", gridTemplateColumns: "34px minmax(105px, 1fr) 42px", alignItems: "center", gap: "8px", width: "100%" }}>
              <ProfileControls isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} layoutPreferido={layoutPreferido} setLayoutPreferido={setLayoutPreferido} podeVisualizarComo={podeVisualizarComo} cargoVisualizacao={cargoVisualizacao} onVisualizarComo={onVisualizarComo} cargosVisualizacao={cargosVisualizacao} />
              {/* Timer e Indicador de Ponto Automático */}
              <div 
                title={pontoAtivo ? "🟢 Você está em serviço na cidade (detectado automaticamente)!" : "⚪ Você está fora de serviço na cidade."}
                style={{
                  display: "flex", alignItems: "center", gap: "6px",
                  padding: "3px 8px", borderRadius: "6px",
                  background: pontoAtivo ? "rgba(34,197,94,0.12)" : "rgba(10,10,10,0.85)",
                  border: pontoAtivo ? "1.5px solid #22c55e" : "1px solid rgba(255,255,255,0.08)",
                  boxShadow: pontoAtivo ? "0 0 8px rgba(34,197,94,0.25)" : "none",
                }}
              >
                <span style={{ fontSize: "11px", fontWeight: "850", fontFamily: "'Outfit', monospace", fontVariantNumeric: "tabular-nums", color: pontoAtivo ? "#22c55e" : "rgba(255,255,255,0.45)", whiteSpace: "nowrap" }}>
                  ⏱️ {pontoAtivo ? formatarCronometro(tempoPonto) : "00:00:00"}
                </span>
                <span
                  style={{
                    background: pontoAtivo ? "#22c55e" : "rgba(255,255,255,0.08)",
                    color: pontoAtivo ? "#000000" : "#94a3b8",
                    padding: "2px 6px",
                    borderRadius: "4px", fontSize: "9px", fontWeight: "900",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px"
                  }}
                >
                  {pontoAtivo ? "🟢 Em Serviço" : "⚪ Fora"}
                </span>
              </div>
              <button
                onClick={() => { setUsuarioLogado(null); setPaginaAtual("login"); }}
                title="Sair"
                style={{ width: "42px", height: "28px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#ef4444", borderRadius: "8px", padding: 0, cursor: "pointer", fontSize: "9.5px", fontWeight: "850", display: "grid", placeItems: "center" }}
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}

export default function HeaderBar({
  paginaAtual,
  setPaginaAtual,
  theme,
  styles,
  pontoAtivo,
  isDarkMode,
  setIsDarkMode,
  tempoSegundos,
  formatarCronometro,
  registrarPonto,
  usuarioLogado,
  setUsuarioLogado,
  getLabelCargo,
  userPodeNotificar,
  userPodeFinancas,
  userIsAdmin,
  userRole,
  serviceNotificationCount = 0,
  onOpenServiceNotifications,
  layoutPreferido,
  setLayoutPreferido,
  podeVisualizarComo,
  cargoVisualizacao,
  onVisualizarComo,
  cargosVisualizacao,
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const tempoPonto = usePontoElapsed(pontoAtivo);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=Inter:wght@300;400;500;600;700;800&display=swap');

        * { box-sizing: border-box; }

        body {
          --reds-sidebar-width: ${sidebarOpen ? "270px" : "0px"};
          margin: 0 !important;
          padding: 0 !important;
          padding-left: var(--reds-sidebar-width) !important;
          padding-top: 70px !important;
          min-height: 100vh;
          font-family: 'Inter', sans-serif !important;
          transition: padding-left 0.22s ease;
          /* Fundo escuro base */
          background-color: #0d0d0d !important;
          /* Imagem de fundo sutil + mecânica ao fundo com overlay escuro */
          background-image:
            linear-gradient(to bottom, rgba(13,13,13,0.4) 0%, rgba(13,13,13,0.55) 50%, rgba(13,13,13,0.7) 100%),
            url('/plano_fundo.png'),
            linear-gradient(to bottom, rgba(13,13,13,0.7) 0%, rgba(13,13,13,0.6) 50%, rgba(13,13,13,0.75) 100%),
            url('/bg-mechanical.jpg') !important;
          background-attachment: fixed !important;
          background-size: auto, cover, auto, cover !important;
          background-position: center center !important;
          color: #ffffff;
        }

        input[type="checkbox"] {
          appearance: none; -webkit-appearance: none;
          width: 17px; height: 17px;
          border: 1.5px solid rgba(255,255,255,0.22);
          border-radius: 4px;
          background-color: rgba(0,0,0,0.38);
          display: inline-grid; place-content: center;
          cursor: pointer; vertical-align: middle;
          transition: all 0.18s; flex-shrink: 0;
        }
        input[type="checkbox"]:checked { background-color: #22c55e !important; border-color: #22c55e !important; box-shadow: 0 0 8px rgba(34,197,94,0.35); }
        input[type="checkbox"]::before { content: ""; width: 9px; height: 9px; transform: scale(0); transition: 100ms transform ease-in-out; box-shadow: inset 1em 1em white; clip-path: polygon(14% 44%, 0 65%, 50% 100%, 100% 16%, 80% 0%, 43% 62%); }
        input[type="checkbox"]:checked::before { transform: scale(1); }
        input[type="checkbox"]:hover { border-color: #8b181e; }

        input:focus, textarea:focus, select:focus { border-color: #8b181e !important; box-shadow: 0 0 0 3px rgba(139,24,30,0.22) !important; outline: none; }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.7); cursor: pointer; }
        select option { background: #161616; color: #ffffff; }

        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 4px; }

        @keyframes fadeLogin { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulseGreen { 0%{box-shadow:0 0 0 0 rgba(34,197,94,0.4)} 70%{box-shadow:0 0 0 10px rgba(34,197,94,0)} 100%{box-shadow:0 0 0 0 rgba(34,197,94,0)} }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @media (max-width: 780px) {
          body { --reds-sidebar-width: 0px; }
        }
      `}</style>

      {/* ─── Sidebar (memoizada — não re-renderiza no timer) ─── */}
      <Sidebar
        paginaAtual={paginaAtual}
        setPaginaAtual={setPaginaAtual}
        setUsuarioLogado={setUsuarioLogado}
        userPodeNotificar={userPodeNotificar}
        userPodeFinancas={userPodeFinancas}
        userIsAdmin={userIsAdmin}
        userRole={userRole}
        isOpen={sidebarOpen}
      />

      {/* ─── Top Header bar ─── */}
      <header style={{
        width: "calc(100% - var(--reds-sidebar-width))",
        height: "70px",
        position: "fixed",
        top: 0,
        right: 0,
        background: "rgba(14,14,14,0.82)",
        backdropFilter: "blur(18px)",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 36px",
        zIndex: 999,
        boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
        transition: "width 0.22s ease",
      }}>
        <button
          type="button"
          onClick={() => setSidebarOpen((open) => !open)}
          title={sidebarOpen ? "Esconder menu" : "Mostrar menu"}
          aria-label={sidebarOpen ? "Esconder menu lateral" : "Mostrar menu lateral"}
          aria-pressed={sidebarOpen}
          style={{
            width: "42px",
            height: "42px",
            borderRadius: "10px",
            border: sidebarOpen ? "1px solid rgba(139,24,30,0.65)" : "1px solid rgba(255,255,255,0.1)",
            background: sidebarOpen ? "rgba(139,24,30,0.2)" : "rgba(255,255,255,0.05)",
            color: "#ffffff",
            display: "grid",
            placeItems: "center",
            cursor: "pointer",
            flexShrink: 0,
            transition: "all 0.18s ease",
            boxShadow: sidebarOpen ? "0 0 16px rgba(139,24,30,0.18)" : "none",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(139,24,30,0.28)";
            e.currentTarget.style.borderColor = "rgba(139,24,30,0.75)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = sidebarOpen ? "rgba(139,24,30,0.2)" : "rgba(255,255,255,0.05)";
            e.currentTarget.style.borderColor = sidebarOpen ? "rgba(139,24,30,0.65)" : "rgba(255,255,255,0.1)";
          }}
        >
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <div style={{ flex: 1 }}></div>

        {/* Right side: Timer + Profile */}
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          {/* Timer de Ponto Automático */}
          <div 
            title={pontoAtivo ? "🟢 Você está em serviço na cidade (detectado automaticamente)!" : "⚪ Você está fora de serviço na cidade."}
            style={{
              display: "flex", alignItems: "center", gap: "10px",
              padding: "6px 14px", borderRadius: "10px",
              background: pontoAtivo ? "rgba(34,197,94,0.08)" : "rgba(22,22,22,0.8)",
              border: pontoAtivo ? "1.5px solid #22c55e" : "1.5px solid rgba(255,255,255,0.06)",
              boxShadow: pontoAtivo ? "0 0 16px rgba(34,197,94,0.2)" : "none",
            }}
          >
            <span style={{ fontSize: "14px", fontWeight: "800", fontFamily: "'Outfit', monospace", fontVariantNumeric: "tabular-nums", color: pontoAtivo ? "#22c55e" : "rgba(255,255,255,0.35)", display: "flex", alignItems: "center", justifyContent: "center", gap: "7px", minWidth: "90px", flexShrink: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
              </svg>
              {pontoAtivo ? formatarCronometro(tempoPonto) : "00:00:00"}
            </span>
            <div
              style={{
                background: pontoAtivo ? "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)" : "rgba(255,255,255,0.06)",
                color: pontoAtivo ? "#ffffff" : "#94a3b8",
                padding: "4px 9px",
                borderRadius: "6px", fontSize: "10.5px", fontWeight: "900",
                letterSpacing: "0.5px", textTransform: "uppercase",
                display: "flex", alignItems: "center", gap: "5px",
                userSelect: "none"
              }}
            >
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: pontoAtivo ? "#fff" : "#64748b", display: "inline-block", boxShadow: pontoAtivo ? "0 0 6px #fff" : "none" }}></span>
              {pontoAtivo ? "Em Serviço" : "Fora"}
            </div>
          </div>

          {/* Notifications bell */}
          <button
            onClick={() => onOpenServiceNotifications?.()}
            style={{ width: "40px", minWidth: "40px", height: "40px", flex: "0 0 40px", boxSizing: "border-box", borderRadius: "11px", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", cursor: "pointer", color: "rgba(255,255,255,0.75)", position: "relative", display: "grid", placeItems: "center", padding: 0, lineHeight: 0, transform: "none", transition: "color .15s ease, background .15s ease, border-color .15s ease" }}
            onMouseEnter={(e) => e.currentTarget.style.color = "#ffffff"}
            onMouseLeave={(e) => e.currentTarget.style.color = "rgba(255,255,255,0.6)"}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9zm-4.27 13a2 2 0 0 1-3.46 0" /></svg>
            {serviceNotificationCount > 0 && <span style={{ position: "absolute", top: "-7px", right: "-9px", minWidth: "18px", height: "18px", padding: "0 4px", background: "#ef4444", color: "#fff", borderRadius: "10px", border: "1.5px solid #0d0d0d", fontSize: "10px", fontWeight: "900", display: "grid", placeItems: "center" }}>{serviceNotificationCount > 99 ? "99+" : serviceNotificationCount}</span>}
          </button>

          {/* Divider */}
          <div style={{ width: "1px", height: "32px", background: "rgba(255,255,255,0.08)" }}></div>

          {/* Profile */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "6px 8px 6px 12px", background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", borderRadius: "14px" }}>
            <div style={{ textAlign: "right", lineHeight: 1.3 }}>
              <div style={{ color: "#ffffff", fontWeight: "700", fontSize: "13px", fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap" }}>
                {usuarioLogado?.nome}
              </div>
              <div style={{ color: "#facc15", fontWeight: "800", fontSize: "10px", fontFamily: "'Outfit', sans-serif", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                {getLabelCargo(userRole)}
              </div>
            </div>
            <ProfileControls isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} layoutPreferido={layoutPreferido} setLayoutPreferido={setLayoutPreferido} podeVisualizarComo={podeVisualizarComo} cargoVisualizacao={cargoVisualizacao} onVisualizarComo={onVisualizarComo} cargosVisualizacao={cargosVisualizacao} />
            {/* Avatar clickável */}
            <div
              onClick={() => setPaginaAtual("minha-conta")}
              style={{
                width: "38px", height: "38px", borderRadius: "50%",
                background: usuarioLogado?.avatar_url ? "transparent" : "linear-gradient(135deg, #8b181e 0%, #facc15 100%)",
                border: "2px solid rgba(139,24,30,0.5)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: "800", fontSize: "15px", color: "#ffffff",
                cursor: "pointer",
                overflow: "hidden",
                boxShadow: "0 0 10px rgba(139,24,30,0.3)",
                flexShrink: 0,
              }}
            >
              {usuarioLogado?.avatar_url
                ? <img src={usuarioLogado.avatar_url} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : (usuarioLogado?.nome ? usuarioLogado.nome[0].toUpperCase() : "M")
              }
            </div>
            <button type="button" onClick={() => { localStorage.removeItem("usuarioLogado"); setUsuarioLogado(null); setPaginaAtual("login"); }} title="Sair" style={{ height: "38px", padding: "0 11px", borderRadius: "9px", border: "1px solid rgba(239,68,68,.35)", background: "rgba(127,29,29,.22)", color: "#fca5a5", cursor: "pointer", fontWeight: 800 }}>Sair</button>
          </div>
        </div>
      </header>
    </>
  );
}
