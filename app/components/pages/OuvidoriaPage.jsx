"use client";

import React, { useState, useEffect, useMemo } from "react";

const CATEGORIAS = [
  {
    id: "dificuldades",
    label: "Dificuldades do Dia a Dia",
    sublabel: "Bugs, FiveM, comandos ou regras que atrapalham",
    icon: "🔧",
    cor: "#ef4444",
    bg: "rgba(239, 68, 68, 0.12)",
    border: "rgba(239, 68, 68, 0.35)",
  },
  {
    id: "estoque",
    label: "Estoque & Recursos",
    sublabel: "Falta de peças, bancada, baú, ferramentas ou oficina",
    icon: "📦",
    cor: "#f59e0b",
    bg: "rgba(245, 158, 11, 0.12)",
    border: "rgba(245, 158, 11, 0.35)",
  },
  {
    id: "atendimento",
    label: "Atendimento & Clientes",
    sublabel: "Concorrência com outras oficinas, preços e movimento",
    icon: "🏪",
    cor: "#3b82f6",
    bg: "rgba(59, 130, 246, 0.12)",
    border: "rgba(59, 130, 246, 0.35)",
  },
  {
    id: "interno",
    label: "Problemas Internos & Gestão",
    sublabel: "Atritos, escalas, convivência ou condutas da equipe",
    icon: "📌",
    cor: "#a855f7",
    bg: "rgba(168, 85, 247, 0.12)",
    border: "rgba(168, 85, 247, 0.35)",
  },
  {
    id: "sugestoes",
    label: "Sugestões de Melhoria",
    sublabel: "Ideias novas, eventos, melhorias no sistema ou oficina",
    icon: "💡",
    cor: "#10b981",
    bg: "rgba(16, 185, 129, 0.12)",
    border: "rgba(16, 185, 129, 0.35)",
  },
  {
    id: "outros",
    label: "Outros Assuntos",
    sublabel: "Qualquer outro relato importante para a liderança",
    icon: "💬",
    cor: "#94a3b8",
    bg: "rgba(148, 163, 184, 0.12)",
    border: "rgba(148, 163, 184, 0.35)",
  },
];

export default function OuvidoriaPage({ theme, styles, usuarioLogado }) {
  const isDonoAdmin = useMemo(() => {
    const role = String(usuarioLogado?.role || "").toLowerCase();
    const primary = role.split("|")[0];
    return (
      primary === "dono" ||
      primary === "admin" ||
      primary === "gerente_geral" ||
      role.includes("dono") ||
      role.includes("admin")
    );
  }, [usuarioLogado?.role]);

  const [abaAtiva, setAbaAtiva] = useState("enviar"); // 'enviar' | 'gerenciar'

  // Formulário
  const [categoria, setCategoria] = useState("dificuldades");
  const [mensagem, setMensagem] = useState("");
  const [anonimo, setAnonimo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [sucessoMsg, setSucessoMsg] = useState(false);
  const [erroMsg, setErroMsg] = useState("");

  // Painel de Gestão (Donos)
  const [feedbacks, setFeedbacks] = useState([]);
  const [carregandoFeedbacks, setCarregandoFeedbacks] = useState(false);
  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [buscaTexto, setBuscaTexto] = useState("");
  const [copiadoSucesso, setCopiadoSucesso] = useState(false);

  // Carregar feedbacks para o dono
  const carregarFeedbacks = async () => {
    if (!isDonoAdmin) return;
    setCarregandoFeedbacks(true);
    try {
      const res = await fetch("/api/feedback?limite=200");
      const json = await res.json();
      if (json.ok && Array.isArray(json.data)) {
        setFeedbacks(json.data);
      }
    } catch (err) {
      console.error("Erro ao carregar feedbacks:", err);
    } finally {
      setCarregandoFeedbacks(false);
    }
  };

  useEffect(() => {
    if (isDonoAdmin) {
      carregarFeedbacks();
    }
  }, [isDonoAdmin]);

  // Enviar feedback
  const handleEnviar = async (e) => {
    e.preventDefault();
    if (!mensagem.trim()) {
      setErroMsg("Por favor, digite a sua mensagem antes de enviar.");
      return;
    }

    setEnviando(true);
    setErroMsg("");
    setSucessoMsg(false);

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoria,
          mensagem: mensagem.trim(),
          anonimo,
          usuarioId: usuarioLogado?.id || null,
          usuarioNome: usuarioLogado?.nome || null,
          usuarioCargo: usuarioLogado?.cargo || usuarioLogado?.role || null,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Erro ao registrar feedback");
      }

      setSucessoMsg(true);
      setMensagem("");
      if (isDonoAdmin) {
        carregarFeedbacks();
      }
    } catch (err) {
      console.error(err);
      setErroMsg("Falha ao enviar: " + err.message);
    } finally {
      setEnviando(false);
    }
  };

  // Alterar status de feedback
  const atualizarStatus = async (id, novoStatus) => {
    try {
      const res = await fetch("/api/feedback", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          status: novoStatus,
          respondidoPor: usuarioLogado?.nome || "Admin",
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setFeedbacks((prev) =>
          prev.map((f) => (f.id === id ? { ...f, status: novoStatus } : f))
        );
      }
    } catch (err) {
      console.error("Erro ao atualizar status:", err);
    }
  };

  // Feedbacks filtrados
  const feedbacksFiltrados = useMemo(() => {
    return feedbacks.filter((f) => {
      if (filtroCategoria !== "todas" && f.categoria !== filtroCategoria) return false;
      if (filtroStatus !== "todos" && f.status !== filtroStatus) return false;
      if (buscaTexto.trim()) {
        const q = buscaTexto.toLowerCase();
        const bateTexto = f.mensagem && f.mensagem.toLowerCase().includes(q);
        const bateNome = f.usuario_nome && f.usuario_nome.toLowerCase().includes(q);
        if (!bateTexto && !bateNome) return false;
      }
      return true;
    });
  }, [feedbacks, filtroCategoria, filtroStatus, buscaTexto]);

  // Gerador de Resumo para a Reunião de Quinta
  const copiarResumoReuniao = () => {
    if (feedbacks.length === 0) {
      alert("Nenhum feedback registrado ainda para gerar o resumo.");
      return;
    }

    const agora = new Date().toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

    let texto = `📊 **PAUTA DE FEEDBACKS DA EQUIPE - RED'S TUNERSHOP**\n`;
    texto += `📅 *Compilado em: ${agora} | Total de Relatos: ${feedbacks.length}*\n\n`;

    CATEGORIAS.forEach((cat) => {
      const doTipo = feedbacks.filter((f) => f.categoria === cat.id);
      if (doTipo.length > 0) {
        texto += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        texto += `${cat.icon} **${cat.label.toUpperCase()}** (${doTipo.length} relato${doTipo.length > 1 ? "s" : ""}):\n`;
        doTipo.forEach((item, idx) => {
          const autor = item.anonimo ? "Anônimo" : `${item.usuario_nome || "Mecânico"}`;
          texto += `${idx + 1}. "${item.mensagem.replace(/\n/g, " ")}" — *[${autor}]*\n`;
        });
        texto += `\n`;
      }
    });

    texto += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    texto += `📋 *Relatório gerado automaticamente pelo Sistema Interno da RED'S.*`;

    navigator.clipboard
      .writeText(texto)
      .then(() => {
        setCopiadoSucesso(true);
        setTimeout(() => setCopiadoSucesso(false), 3500);
      })
      .catch(() => alert("Erro ao copiar para a área de transferência."));
  };

  return (
    <div style={{ padding: "20px clamp(12px, 3vw, 40px)", maxWidth: "1200px", margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
      {/* ─── BANNER SUPERIOR INFORMATIVO ─── */}
      <div
        style={{
          background: "linear-gradient(135deg, rgba(139,24,30,0.3) 0%, rgba(15,23,42,0.65) 100%)",
          border: "1px solid rgba(239,68,68,0.35)",
          borderRadius: "16px",
          padding: "24px 28px",
          marginBottom: "24px",
          boxShadow: "0 12px 35px rgba(0,0,0,0.4)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "20px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ maxWidth: "750px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
            <span style={{ fontSize: "28px" }}>📢</span>
            <h1 style={{ fontSize: "22px", fontWeight: "900", color: "#fff", margin: 0 }}>
              Ouvidoria & Coleta de Feedbacks da Equipe
            </h1>
          </div>
          <p style={{ fontSize: "13.5px", color: "#cbd5e1", lineHeight: 1.6, margin: 0 }}>
            Nesta <strong>quinta-feira às 18h</strong> teremos a reunião oficial dos donos de mecânicas com a administração da cidade. Queremos ouvir a sua voz! Relate dificuldades, falta de peças, ideias de melhoria ou situações internas.
          </p>
          <div style={{ display: "flex", gap: "14px", marginTop: "12px", flexWrap: "wrap", fontSize: "12px", color: "#94a3b8" }}>
            <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              🛡️ <strong>Totalmente Sigiloso:</strong> Opção de envio 100% anônimo
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              ⚡ <strong>Direto aos Donos:</strong> Chega em tempo real na liderança
            </span>
          </div>
        </div>

        {isDonoAdmin && (
          <button
            onClick={copiarResumoReuniao}
            style={{
              background: copiadoSucesso
                ? "linear-gradient(135deg, #10b981, #059669)"
                : "linear-gradient(135deg, #ef4444, #b91c1c)",
              border: "none",
              color: "#fff",
              padding: "12px 20px",
              borderRadius: "12px",
              fontSize: "13px",
              fontWeight: "800",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              boxShadow: "0 6px 20px rgba(239,68,68,0.3)",
              transition: "all 0.2s ease",
            }}
          >
            {copiadoSucesso ? "✅ Resumo Copiado!" : "📋 Copiar Resumo da Reunião"}
          </button>
        )}
      </div>

      {/* ─── ABAS (SE FOR DONO/ADMIN) ─── */}
      {isDonoAdmin && (
        <div style={{ display: "flex", gap: "10px", marginBottom: "20px", borderBottom: `1px solid ${theme.border}44`, paddingBottom: "10px" }}>
          <button
            onClick={() => setAbaAtiva("enviar")}
            style={{
              background: abaAtiva === "enviar" ? "rgba(239,68,68,0.15)" : "transparent",
              border: abaAtiva === "enviar" ? "1px solid #ef4444" : "1px solid transparent",
              color: abaAtiva === "enviar" ? "#fff" : theme.subtext,
              padding: "9px 18px",
              borderRadius: "10px",
              fontWeight: "800",
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            ✍️ Enviar Novo Feedback
          </button>
          <button
            onClick={() => {
              setAbaAtiva("gerenciar");
              carregarFeedbacks();
            }}
            style={{
              background: abaAtiva === "gerenciar" ? "rgba(239,68,68,0.15)" : "transparent",
              border: abaAtiva === "gerenciar" ? "1px solid #ef4444" : "1px solid transparent",
              color: abaAtiva === "gerenciar" ? "#fff" : theme.subtext,
              padding: "9px 18px",
              borderRadius: "10px",
              fontWeight: "800",
              fontSize: "13px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span>👑 Painel de Gestão (Donos)</span>
            <span
              style={{
                background: "#ef4444",
                color: "#fff",
                fontSize: "11px",
                padding: "1px 7px",
                borderRadius: "12px",
                fontWeight: "900",
              }}
            >
              {feedbacks.length}
            </span>
          </button>
        </div>
      )}

      {/* ─── ABA 1: ENVIAR FEEDBACK ─── */}
      {abaAtiva === "enviar" && (
        <div
          style={{
            background: "#121214",
            border: `1px solid ${theme.border}44`,
            borderRadius: "16px",
            padding: "24px 28px",
            boxShadow: "0 8px 30px rgba(0,0,0,0.3)",
          }}
        >
          <form onSubmit={handleEnviar}>
            {/* Escolha da Categoria */}
            <div style={{ marginBottom: "22px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "800", color: "#f8fafc", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "12px" }}>
                1. Sobre o que você deseja falar?
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px" }}>
                {CATEGORIAS.map((cat) => {
                  const selecionada = categoria === cat.id;
                  return (
                    <div
                      key={cat.id}
                      onClick={() => setCategoria(cat.id)}
                      style={{
                        background: selecionada ? cat.bg : "rgba(255,255,255,0.02)",
                        border: `1.5px solid ${selecionada ? cat.cor : `${theme.border}33`}`,
                        borderRadius: "12px",
                        padding: "14px 16px",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                        <span style={{ fontSize: "18px" }}>{cat.icon}</span>
                        <strong style={{ fontSize: "13px", color: selecionada ? "#fff" : theme.text }}>
                          {cat.label}
                        </strong>
                      </div>
                      <div style={{ fontSize: "11px", color: theme.subtext, lineHeight: 1.4 }}>
                        {cat.sublabel}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Alternador de Anonimato */}
            <div style={{ marginBottom: "22px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "800", color: "#f8fafc", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "10px" }}>
                2. Como você prefere se identificar?
              </label>
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => setAnonimo(true)}
                  style={{
                    flex: "1 1 200px",
                    background: anonimo ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.02)",
                    border: `1.5px solid ${anonimo ? "#10b981" : `${theme.border}44`}`,
                    borderRadius: "12px",
                    padding: "14px 18px",
                    textAlign: "left",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", color: anonimo ? "#34d399" : "#fff", fontWeight: "800", fontSize: "13px" }}>
                    <span>🕵️‍♂️ Enviar 100% Anônimo</span>
                  </div>
                  <div style={{ fontSize: "11px", color: theme.subtext, marginTop: "4px" }}>
                    Nenhum dado seu (nome, ID ou cargo) será registrado. Sinta-se 100% seguro.
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setAnonimo(false)}
                  style={{
                    flex: "1 1 200px",
                    background: !anonimo ? "rgba(59,130,246,0.15)" : "rgba(255,255,255,0.02)",
                    border: `1.5px solid ${!anonimo ? "#3b82f6" : `${theme.border}44`}`,
                    borderRadius: "12px",
                    padding: "14px 18px",
                    textAlign: "left",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", color: !anonimo ? "#60a5fa" : "#fff", fontWeight: "800", fontSize: "13px" }}>
                    <span>👤 Enviar Identificado</span>
                  </div>
                  <div style={{ fontSize: "11px", color: theme.subtext, marginTop: "4px" }}>
                    Identificado como: <strong>{usuarioLogado?.nome || "Você"}</strong> ({usuarioLogado?.cargo || "Mecânico"})
                  </div>
                </button>
              </div>
            </div>

            {/* Mensagem */}
            <div style={{ marginBottom: "22px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "800", color: "#f8fafc", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>
                3. Descreva a situação ou ideia em detalhes
              </label>
              <textarea
                rows={6}
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                placeholder="Exemplo: Notei que tem faltado peças de motor nível 4 com frequência na bancada, e os clientes estão reclamando da espera..."
                style={{
                  width: "100%",
                  background: "#18181c",
                  border: `1px solid ${theme.border}55`,
                  borderRadius: "12px",
                  padding: "14px",
                  color: "#fff",
                  fontSize: "13.5px",
                  lineHeight: 1.6,
                  fontFamily: "inherit",
                  boxSizing: "border-box",
                  outline: "none",
                  resize: "vertical",
                }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: theme.subtext, marginTop: "6px" }}>
                <span>Quanto mais detalhes você incluir, mais fácil será solucionar na reunião.</span>
                <span>{mensagem.length} caracteres</span>
              </div>
            </div>

            {/* Avisos de Sucesso ou Erro */}
            {sucessoMsg && (
              <div style={{ padding: "14px 18px", background: "rgba(16,185,129,0.15)", border: "1px solid #10b981", borderRadius: "10px", color: "#34d399", fontSize: "13px", fontWeight: "700", marginBottom: "16px" }}>
                🎉 Feedback enviado com sucesso para a liderança! Muito obrigado por colaborar com a nossa equipe.
              </div>
            )}
            {erroMsg && (
              <div style={{ padding: "14px 18px", background: "rgba(239,68,68,0.15)", border: "1px solid #ef4444", borderRadius: "10px", color: "#f87171", fontSize: "13px", fontWeight: "700", marginBottom: "16px" }}>
                ❌ {erroMsg}
              </div>
            )}

            {/* Botão de Enviar */}
            <button
              type="submit"
              disabled={enviando}
              style={{
                background: "linear-gradient(135deg, #ef4444, #dc2626)",
                border: "none",
                color: "#fff",
                padding: "14px 32px",
                borderRadius: "12px",
                fontSize: "14px",
                fontWeight: "800",
                cursor: enviando ? "not-allowed" : "pointer",
                opacity: enviando ? 0.7 : 1,
                boxShadow: "0 6px 20px rgba(239,68,68,0.35)",
              }}
            >
              {enviando ? "⏳ Enviando..." : "🚀 Enviar Feedback para os Donos"}
            </button>
          </form>
        </div>
      )}

      {/* ─── ABA 2: PAINEL DE GESTÃO (EXCLUSIVO DONOS) ─── */}
      {isDonoAdmin && abaAtiva === "gerenciar" && (
        <div>
          {/* Barra de Filtros */}
          <div
            style={{
              background: "#121214",
              border: `1px solid ${theme.border}33`,
              borderRadius: "12px",
              padding: "14px 18px",
              marginBottom: "18px",
              display: "flex",
              gap: "12px",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: "11px", color: theme.subtext, fontWeight: "700", textTransform: "uppercase" }}>
                Categoria:
              </span>
              <select
                value={filtroCategoria}
                onChange={(e) => setFiltroCategoria(e.target.value)}
                style={{
                  background: "#18181c",
                  border: `1px solid ${theme.border}55`,
                  color: "#fff",
                  padding: "7px 12px",
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontWeight: "700",
                }}
              >
                <option value="todas">Todas as Categorias</option>
                {CATEGORIAS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {c.label}
                  </option>
                ))}
              </select>

              <span style={{ fontSize: "11px", color: theme.subtext, fontWeight: "700", textTransform: "uppercase" }}>
                Status:
              </span>
              <select
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value)}
                style={{
                  background: "#18181c",
                  border: `1px solid ${theme.border}55`,
                  color: "#fff",
                  padding: "7px 12px",
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontWeight: "700",
                }}
              >
                <option value="todos">Todos</option>
                <option value="pendente">⏳ Pendentes</option>
                <option value="em_analise">🔍 Em Análise</option>
                <option value="resolvido">✅ Resolvidos</option>
              </select>

              <input
                type="text"
                placeholder="Buscar palavra ou nome..."
                value={buscaTexto}
                onChange={(e) => setBuscaTexto(e.target.value)}
                style={{
                  background: "#18181c",
                  border: `1px solid ${theme.border}55`,
                  color: "#fff",
                  padding: "7px 12px",
                  borderRadius: "8px",
                  fontSize: "12px",
                  width: "180px",
                }}
              />
            </div>

            <button
              onClick={carregarFeedbacks}
              disabled={carregandoFeedbacks}
              style={{
                background: "rgba(255,255,255,0.06)",
                border: `1px solid ${theme.border}55`,
                color: "#fff",
                padding: "8px 14px",
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: "700",
                cursor: "pointer",
              }}
            >
              {carregandoFeedbacks ? "Carregando..." : "🔄 Atualizar"}
            </button>
          </div>

          {/* Lista de Feedbacks */}
          {feedbacksFiltrados.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: theme.subtext, background: "#121214", borderRadius: "16px", border: `1px solid ${theme.border}33` }}>
              <div style={{ fontSize: "36px", marginBottom: "12px" }}>📭</div>
              <div style={{ fontSize: "16px", fontWeight: "700", color: "#fff", marginBottom: "6px" }}>
                Nenhum feedback encontrado
              </div>
              <div style={{ fontSize: "13px" }}>
                {feedbacks.length === 0
                  ? "Assim que os mecânicos enviarem relatos pelo formulário, eles aparecerão organizados aqui."
                  : "Nenhum relato coincide com os filtros selecionados acima."}
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gap: "14px" }}>
              {feedbacksFiltrados.map((fb) => {
                const catObj = CATEGORIAS.find((c) => c.id === fb.categoria) || CATEGORIAS[CATEGORIAS.length - 1];
                const dataFormatada = fb.criado_em
                  ? new Date(fb.criado_em).toLocaleString("pt-BR", {
                      timeZone: "America/Sao_Paulo",
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "—";

                return (
                  <div
                    key={fb.id || Math.random()}
                    style={{
                      background: "#16161a",
                      border: `1px solid ${theme.border}44`,
                      borderRadius: "14px",
                      padding: "18px 22px",
                      boxShadow: "0 4px 15px rgba(0,0,0,0.25)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "14px", marginBottom: "12px", flexWrap: "wrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                        <span
                          style={{
                            background: catObj.bg,
                            border: `1px solid ${catObj.border}`,
                            color: catObj.cor,
                            fontSize: "11px",
                            fontWeight: "800",
                            padding: "3px 10px",
                            borderRadius: "20px",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                          }}
                        >
                          {catObj.icon} {catObj.label}
                        </span>

                        {fb.anonimo ? (
                          <span style={{ fontSize: "11px", background: "rgba(100,116,139,0.2)", color: "#cbd5e1", padding: "3px 9px", borderRadius: "20px", fontWeight: "700" }}>
                            🕵️‍♂️ Anônimo
                          </span>
                        ) : (
                          <span style={{ fontSize: "11px", background: "rgba(59,130,246,0.2)", color: "#60a5fa", padding: "3px 9px", borderRadius: "20px", fontWeight: "700" }}>
                            👤 {fb.usuario_nome || "Mecânico"} {fb.usuario_id ? `(ID: ${fb.usuario_id})` : ""}
                          </span>
                        )}

                        <span style={{ fontSize: "11px", color: theme.subtext }}>
                          📅 {dataFormatada}
                        </span>
                      </div>

                      {/* Controle de Status */}
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <select
                          value={fb.status || "pendente"}
                          onChange={(e) => atualizarStatus(fb.id, e.target.value)}
                          style={{
                            background:
                              fb.status === "resolvido"
                                ? "rgba(16,185,129,0.2)"
                                : fb.status === "em_analise"
                                ? "rgba(245,158,11,0.2)"
                                : "rgba(239,68,68,0.2)",
                            border: `1px solid ${
                              fb.status === "resolvido"
                                ? "#10b981"
                                : fb.status === "em_analise"
                                ? "#f59e0b"
                                : "#ef4444"
                            }`,
                            color: "#fff",
                            padding: "4px 8px",
                            borderRadius: "6px",
                            fontSize: "11px",
                            fontWeight: "800",
                            cursor: "pointer",
                          }}
                        >
                          <option value="pendente">⏳ Pendente</option>
                          <option value="em_analise">🔍 Em Análise</option>
                          <option value="resolvido">✅ Resolvido</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ fontSize: "13.5px", color: "#f8fafc", lineHeight: 1.6, whiteSpace: "pre-wrap", background: "rgba(0,0,0,0.2)", padding: "12px 14px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.04)" }}>
                      {fb.mensagem}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
