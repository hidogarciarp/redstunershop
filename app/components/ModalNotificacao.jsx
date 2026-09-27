import React, { useState } from "react";

export default function ModalNotificacao({
  notificacaoPendente,
  isDarkMode = true,
  theme,
  formatarDataHora,
  renderMensagemComLinks,
  confirmarLeituraNotificacao,
  onEnviarFeedback,
  onNaoAutorizei,
  onFechar
}) {
  const [modoFeedback, setModoFeedback] = useState(false);
  const [textoFeedback, setTextoFeedback] = useState("");
  const [enviandoAcao, setEnviandoAcao] = useState(false);
  const [fotoAmpliada, setFotoAmpliada] = useState(false);
  const [imgError, setImgError] = useState(false);

  if (!notificacaoPendente) return null;

  const msg = notificacaoPendente.mensagem || "";
  const isAuditoria = msg.startsWith("[AUDITORIA_ESTAGIARIO]");
  const isFeedbackAuditoria = msg.startsWith("[FEEDBACK_AUDITORIA]");

  let auditData = null;
  if (isAuditoria) {
    try {
      const jsonStr = msg.replace("[AUDITORIA_ESTAGIARIO]", "").trim();
      auditData = JSON.parse(jsonStr);
    } catch (e) {
      console.warn("Erro ao fazer parse da auditoria:", e);
    }
  }

  let feedbackData = null;
  if (isFeedbackAuditoria) {
    try {
      const jsonStr = msg.replace("[FEEDBACK_AUDITORIA]", "").trim();
      feedbackData = JSON.parse(jsonStr);
    } catch (e) {
      console.warn("Erro ao fazer parse do feedback de auditoria:", e);
    }
  }

  const remetenteExibido = notificacaoPendente.anonimo ? "Anônimo" : notificacaoPendente.admin_nome;

  const defaultRenderLinks = (texto) => {
    if (!texto) return "";
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return texto.split(urlRegex).map((parte, index) => {
      if (parte.match(urlRegex)) {
        return (
          <a key={index} href={parte} target="_blank" rel="noopener noreferrer"
            style={{ display: "inline-block", background: "#2563eb", color: "#fff", padding: "4px 10px", borderRadius: "8px", fontSize: "12px", fontWeight: "600", textDecoration: "none", marginLeft: "6px", marginTop: "4px" }}>
            🔗 LINK
          </a>
        );
      }
      return parte;
    });
  };
  const renderLinks = renderMensagemComLinks || defaultRenderLinks;

  const handleFeedback = async () => {
    if (!textoFeedback.trim()) {
      alert("⚠️ Digite uma mensagem de orientação para o estagiário.");
      return;
    }
    setEnviandoAcao(true);
    if (typeof onEnviarFeedback === "function") {
      await onEnviarFeedback(auditData?.estagiario_id, auditData?.estagiario_nome, textoFeedback, auditData);
    }
    setEnviandoAcao(false);
    if (typeof confirmarLeituraNotificacao === "function") {
      confirmarLeituraNotificacao();
    }
  };

  const handleNaoAutorizei = async () => {
    if (!window.confirm("⚠️ Tem certeza que NÃO autorizou este serviço?\n\nIsso enviará um alerta de uso indevido de autorização diretamente para os Donos da mecânica.")) {
      return;
    }
    setEnviandoAcao(true);
    if (typeof onNaoAutorizei === "function") {
      await onNaoAutorizei(auditData);
    }
    setEnviandoAcao(false);
    if (typeof confirmarLeituraNotificacao === "function") {
      confirmarLeituraNotificacao();
    }
  };

  // ==========================================
  // CASO 1: FEEDBACK DE AUDITORIA (ESTAGIÁRIO RECEBE DO AUTORIZADOR)
  // ==========================================
  if (isFeedbackAuditoria && feedbackData) {
    const servico = feedbackData.servico || {};
    const isDirectImage = servico.foto_url && !servico.foto_url.includes("discord.com/channels/") && !imgError;
    const discordUrl = servico.link_discord || (servico.foto_url?.includes("discord.com/channels/") ? servico.foto_url : null);
    const remetente = feedbackData.autorizador_nome || remetenteExibido;

    return (
      <div
        onClick={(e) => {
          if (e.target === e.currentTarget && typeof onFechar === "function") onFechar();
        }}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", backdropFilter: "blur(8px)" }}
      >
        <div style={{ background: isDarkMode ? "#161618" : "#fff", border: "2px solid #0284c7", borderRadius: "20px", padding: "30px 34px", maxWidth: "620px", width: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 25px 70px rgba(0,0,0,0.7)", position: "relative" }}>
          
          {/* BOTÃO FECHAR */}
          {typeof onFechar === "function" && (
            <button
              onClick={onFechar}
              style={{
                position: "absolute", top: "16px", right: "18px", background: "rgba(255,255,255,0.08)", border: "none", color: theme?.subtext || "#888", fontSize: "16px", width: "32px", height: "32px", borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center"
              }}
              title="Fechar"
            >
              ✕
            </button>
          )}

          {/* CABEÇALHO */}
          <div style={{ textAlign: "center", marginBottom: "18px" }}>
            <span style={{ background: "rgba(2, 132, 199, 0.15)", border: "1px solid #0284c7", color: "#38bdf8", padding: "4px 14px", borderRadius: "20px", fontSize: "11px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              💬 Orientação de Tunagem
            </span>
            <h2 style={{ color: "#38bdf8", fontWeight: "800", margin: "12px 0 4px", fontSize: "20px" }}>
              Feedback do Autorizador
            </h2>
            <p style={{ color: theme?.subtext, fontSize: "12.5px", margin: 0 }}>
              Orientação enviada por <b>{remetente}</b>
              {notificacaoPendente.criado_em && ` · ${formatarDataHora(notificacaoPendente.criado_em)}`}
            </p>
          </div>

          {/* MENSAGEM DE ORIENTAÇÃO (DESTAQUE) */}
          <div style={{ background: isDarkMode ? "#0c1e2e" : "#f0f9ff", border: "1px solid rgba(2, 132, 199, 0.4)", borderRadius: "14px", padding: "16px 18px", marginBottom: "18px" }}>
            <div style={{ fontSize: "11.5px", fontWeight: "800", color: "#38bdf8", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              📢 Mensagem do Autorizador:
            </div>
            <div style={{ color: theme?.text, fontSize: "14.5px", lineHeight: "1.6", whiteSpace: "pre-wrap", fontWeight: "500" }}>
              "{feedbackData.feedback}"
            </div>
          </div>

          {/* DADOS DO SERVIÇO AUDITADO (REFERÊNCIA CLARA PARA O ESTAGIÁRIO) */}
          <div style={{ background: isDarkMode ? "#222" : "#f8f9fa", border: `1px solid ${theme?.border}`, borderRadius: "14px", padding: "16px", marginBottom: "18px", fontSize: "13.5px", display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ fontSize: "11.5px", color: theme?.subtext, fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "2px" }}>
              🚗 Serviço Referenciado:
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <div>
                <span style={{ color: theme?.subtext, fontSize: "11.5px", display: "block" }}>🚗 Veículo / Placa</span>
                <strong style={{ color: theme?.text }}>{servico.veiculo || "Veículo de Cliente"}</strong>
              </div>
              <div>
                <span style={{ color: theme?.subtext, fontSize: "11.5px", display: "block" }}>👤 Cliente</span>
                <strong style={{ color: theme?.text }}>{servico.cliente_nome || "Cliente"} {servico.cliente_id ? `(ID: ${servico.cliente_id})` : ""}</strong>
              </div>
            </div>
            
            <div style={{ borderTop: `1px solid ${theme?.border}`, paddingTop: "8px" }}>
              <span style={{ color: theme?.subtext, fontSize: "11.5px", display: "block" }}>⚙️ Peças Instaladas</span>
              <div style={{ color: theme?.text, fontWeight: "600", marginTop: "2px" }}>{servico.pecas || "Performance / Motor"}</div>
            </div>

            <div style={{ borderTop: `1px solid ${theme?.border}`, paddingTop: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: theme?.subtext, fontSize: "12px" }}>💰 Valor Total Cobrado:</span>
              <strong style={{ color: "#22c55e", fontSize: "16px" }}>
                R$ {Number(servico.valor_total || 0).toLocaleString("pt-BR")}
              </strong>
            </div>
          </div>

          {/* FOTO COMPROVANTE */}
          {isDirectImage ? (
            <div style={{ marginBottom: "18px", background: isDarkMode ? "#1c1c1e" : "#f1f5f9", padding: "12px", borderRadius: "14px", border: `1px solid ${theme?.border}`, textAlign: "center" }}>
              <div style={{ fontSize: "11.5px", color: theme?.subtext, marginBottom: "8px", fontWeight: "700" }}>
                📸 Foto do Comprovante Registrada pelo Estagiário:
              </div>
              <a href={servico.foto_url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block" }}>
                <img
                  src={servico.foto_url}
                  alt="Comprovante de Tunagem"
                  onError={() => setImgError(true)}
                  style={{
                    maxHeight: "220px",
                    maxWidth: "100%",
                    borderRadius: "10px",
                    border: "1px solid rgba(2, 132, 199, 0.4)",
                    boxShadow: "0 6px 18px rgba(0,0,0,0.3)",
                    cursor: "pointer",
                    display: "block",
                    margin: "0 auto"
                  }}
                />
              </a>
              <div style={{ fontSize: "11px", color: "#38bdf8", marginTop: "6px" }}>
                🔗 Clique na imagem para abrir em alta resolução
              </div>
              {discordUrl && (
                <div style={{ marginTop: "8px" }}>
                  <a href={discordUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: "12px", color: "#5865F2", textDecoration: "none", fontWeight: "600", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    💬 Ver registro no canal do Discord
                  </a>
                </div>
              )}
            </div>
          ) : discordUrl ? (
            <div style={{ marginBottom: "18px", background: isDarkMode ? "#1c1c1e" : "#f1f5f9", padding: "16px", borderRadius: "14px", border: `1px solid ${theme?.border}`, textAlign: "center" }}>
              <div style={{ fontSize: "12.5px", color: theme?.text, fontWeight: "600", marginBottom: "8px" }}>
                📸 Comprovante de Registro no Discord
              </div>
              <a
                href={discordUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  background: "#5865F2",
                  color: "#fff",
                  padding: "9px 18px",
                  borderRadius: "10px",
                  textDecoration: "none",
                  fontWeight: "700",
                  fontSize: "13px",
                  boxShadow: "0 4px 14px rgba(88, 101, 242, 0.35)"
                }}
              >
                💬 Abrir Comprovante no Discord
              </a>
            </div>
          ) : null}

          {/* BOTÃO DE CONFIRMAÇÃO OU FECHAR */}
          {notificacaoPendente.lido_em ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ textAlign: "center", fontSize: "12px", color: "#22c55e", fontWeight: "600" }}>
                ✅ Notificação lida em {formatarDataHora(notificacaoPendente.lido_em)}
              </div>
              <button
                onClick={onFechar || confirmarLeituraNotificacao}
                style={{
                  background: isDarkMode ? "#222" : "#e5e7eb",
                  color: theme?.text,
                  border: `1px solid ${theme?.border}`,
                  padding: "12px",
                  borderRadius: "12px",
                  width: "100%",
                  fontWeight: "700",
                  cursor: "pointer",
                  fontSize: "14px"
                }}
              >
                Fechar
              </button>
            </div>
          ) : (
            <button
              onClick={confirmarLeituraNotificacao}
              style={{
                background: "linear-gradient(135deg, #0284c7, #38bdf8)",
                color: "#fff",
                border: "none",
                padding: "14px",
                borderRadius: "12px",
                width: "100%",
                fontWeight: "800",
                cursor: "pointer",
                fontSize: "15px",
                boxShadow: "0 4px 15px rgba(2, 132, 199, 0.35)"
              }}
            >
              ✅ Li e compreendi a orientação
            </button>
          )}
        </div>
      </div>
    );
  }

  // Se for notificação de auditoria estruturada
  if (isAuditoria && auditData) {
    const isDirectImage = auditData.foto_url && !auditData.foto_url.includes("discord.com/channels/") && !imgError;
    const discordUrl = auditData.link_discord || (auditData.foto_url?.includes("discord.com/channels/") ? auditData.foto_url : null);

    return (
      <div
        onClick={(e) => {
          if (e.target === e.currentTarget && typeof onFechar === "function") onFechar();
        }}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", backdropFilter: "blur(8px)" }}
      >
        <div style={{ background: isDarkMode ? "#161618" : "#fff", border: "2px solid #f59e0b", borderRadius: "20px", padding: "30px 34px", maxWidth: "620px", width: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 25px 70px rgba(0,0,0,0.7)", position: "relative" }}>
          
          {/* BOTÃO FECHAR */}
          {typeof onFechar === "function" && (
            <button
              onClick={onFechar}
              style={{
                position: "absolute", top: "16px", right: "18px", background: "rgba(255,255,255,0.08)", border: "none", color: theme?.subtext || "#888", fontSize: "16px", width: "32px", height: "32px", borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center"
              }}
              title="Fechar"
            >
              ✕
            </button>
          )}

          {/* CABEÇALHO */}
          <div style={{ textAlign: "center", marginBottom: "18px" }}>
            <span style={{ background: "rgba(245, 158, 11, 0.15)", border: "1px solid #f59e0b", color: "#f59e0b", padding: "4px 14px", borderRadius: "20px", fontSize: "11px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              📋 Ficha de Auditoria de Estagiário
            </span>
            <h2 style={{ color: "#f59e0b", fontWeight: "800", margin: "12px 0 4px", fontSize: "20px" }}>
              {notificacaoPendente.lido_em ? "Ficha de Auditoria Registrada" : "Você foi apontado como Autorizador!"}
            </h2>
            <p style={{ color: theme?.subtext, fontSize: "12.5px", margin: 0 }}>
              O estagiário <b>{auditData.estagiario_nome} (ID: {auditData.estagiario_id})</b> realizou este serviço de performance.
            </p>
          </div>

          {/* DADOS DO SERVIÇO */}
          <div style={{ background: isDarkMode ? "#222" : "#f8f9fa", border: `1px solid ${theme.border}`, borderRadius: "14px", padding: "16px", marginBottom: "18px", fontSize: "13.5px", display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <div>
                <span style={{ color: theme.subtext, fontSize: "11.5px", display: "block" }}>🚗 Veículo / Placa</span>
                <strong style={{ color: theme.text }}>{auditData.veiculo || "Veículo de Cliente"}</strong>
              </div>
              <div>
                <span style={{ color: theme.subtext, fontSize: "11.5px", display: "block" }}>👤 Cliente</span>
                <strong style={{ color: theme.text }}>{auditData.cliente_nome || "Cliente"} {auditData.cliente_id ? `(ID: ${auditData.cliente_id})` : ""}</strong>
              </div>
            </div>
            
            <div style={{ borderTop: `1px solid ${theme.border}`, paddingTop: "8px" }}>
              <span style={{ color: theme.subtext, fontSize: "11.5px", display: "block" }}>⚙️ Peças Instaladas</span>
              <div style={{ color: theme.text, fontWeight: "600", marginTop: "2px" }}>{auditData.pecas || "Performance / Motor"}</div>
            </div>

            <div style={{ borderTop: `1px solid ${theme.border}`, paddingTop: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: theme.subtext, fontSize: "12px" }}>💰 Valor Total Cobrado:</span>
              <strong style={{ color: "#22c55e", fontSize: "16px" }}>
                R$ {Number(auditData.valor_total || 0).toLocaleString("pt-BR")}
              </strong>
            </div>
          </div>

          {/* FOTO COMPROVANTE */}
          {isDirectImage ? (
            <div style={{ marginBottom: "18px", background: isDarkMode ? "#1c1c1e" : "#f1f5f9", padding: "12px", borderRadius: "14px", border: `1px solid ${theme.border}`, textAlign: "center" }}>
              <div style={{ fontSize: "11.5px", color: theme.subtext, marginBottom: "8px", fontWeight: "700" }}>
                📸 Foto do Comprovante Anexada pelo Estagiário (Clique para ampliar):
              </div>
              <a href={auditData.foto_url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block" }}>
                <img
                  src={auditData.foto_url}
                  alt="Comprovante de Tunagem"
                  onError={() => setImgError(true)}
                  style={{
                    maxHeight: "220px",
                    maxWidth: "100%",
                    borderRadius: "10px",
                    border: "1px solid rgba(245, 158, 11, 0.4)",
                    boxShadow: "0 6px 18px rgba(0,0,0,0.3)",
                    cursor: "pointer",
                    display: "block",
                    margin: "0 auto"
                  }}
                />
              </a>
              <div style={{ fontSize: "11px", color: "#f59e0b", marginTop: "6px" }}>
                🔗 Clique na imagem para abrir em alta resolução
              </div>
              {discordUrl && (
                <div style={{ marginTop: "8px" }}>
                  <a href={discordUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: "12px", color: "#5865F2", textDecoration: "none", fontWeight: "600", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    💬 Ver registro no canal do Discord
                  </a>
                </div>
              )}
            </div>
          ) : discordUrl ? (
            <div style={{ marginBottom: "18px", background: isDarkMode ? "#1c1c1e" : "#f1f5f9", padding: "16px", borderRadius: "14px", border: `1px solid ${theme.border}`, textAlign: "center" }}>
              <div style={{ fontSize: "12.5px", color: theme.text, fontWeight: "600", marginBottom: "8px" }}>
                📸 Comprovante de Registro no Discord
              </div>
              <p style={{ color: theme.subtext, fontSize: "12px", margin: "0 0 12px 0" }}>
                A foto deste serviço foi anexada e enviada para o canal de logs:
              </p>
              <a
                href={discordUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  background: "#5865F2",
                  color: "#fff",
                  padding: "9px 18px",
                  borderRadius: "10px",
                  textDecoration: "none",
                  fontWeight: "700",
                  fontSize: "13px",
                  boxShadow: "0 4px 14px rgba(88, 101, 242, 0.35)"
                }}
              >
                💬 Abrir Comprovante no Discord
              </a>
            </div>
          ) : (
            <div style={{ marginBottom: "18px", padding: "12px", borderRadius: "10px", background: "rgba(239, 68, 68, 0.1)", border: "1px solid #ef4444", color: "#ef4444", fontSize: "12px", textAlign: "center" }}>
              ⚠️ Nenhuma foto foi anexada neste registro!
            </div>
          )}

          {/* MODO FEEDBACK EXPANDIDO */}
          {modoFeedback ? (
            <div style={{ background: isDarkMode ? "#1f1f23" : "#f4f4f5", padding: "14px", borderRadius: "12px", border: `1px solid ${theme.border}`, marginBottom: "16px" }}>
              <label style={{ fontSize: "12px", fontWeight: "700", color: "#38bdf8", display: "block", marginBottom: "6px" }}>
                💬 Orientação para o Estagiário {auditData.estagiario_nome}:
              </label>
              <textarea
                value={textoFeedback}
                onChange={(e) => setTextoFeedback(e.target.value)}
                placeholder="Ex: Atenção: você calculou a fumaça de pneu com valor incorreto. Na próxima, confira a tabela..."
                style={{ width: "100%", minHeight: "80px", padding: "10px", borderRadius: "8px", border: `1px solid ${theme.border}`, background: isDarkMode ? "#111" : "#fff", color: theme.text, fontSize: "13px", boxSizing: "border-box" }}
              />
              <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                <button
                  onClick={handleFeedback}
                  disabled={enviandoAcao}
                  style={{ flex: 1, padding: "10px", borderRadius: "8px", background: "linear-gradient(135deg, #0284c7, #38bdf8)", color: "#fff", fontWeight: "800", border: "none", cursor: "pointer", fontSize: "13px" }}
                >
                  {enviandoAcao ? "Enviando..." : "🚀 Enviar Orientação e Concluir"}
                </button>
                <button
                  onClick={() => setModoFeedback(false)}
                  style={{ padding: "10px 16px", borderRadius: "8px", background: theme.card2, color: theme.subtext, border: `1px solid ${theme.border}`, cursor: "pointer", fontSize: "13px" }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : notificacaoPendente.lido_em ? (
            /* SE JÁ LIDA / MODO HISTÓRICO */
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ textAlign: "center", fontSize: "12px", color: "#22c55e", fontWeight: "600" }}>
                ✅ Auditoria já processada em {formatarDataHora(notificacaoPendente.lido_em)}
              </div>
              <button
                onClick={onFechar || confirmarLeituraNotificacao}
                style={{
                  background: isDarkMode ? "#222" : "#e5e7eb",
                  color: theme?.text,
                  border: `1px solid ${theme?.border}`,
                  padding: "12px",
                  borderRadius: "12px",
                  width: "100%",
                  fontWeight: "700",
                  cursor: "pointer",
                  fontSize: "14px"
                }}
              >
                Fechar
              </button>
            </div>
          ) : (
            /* BOTÕES DE AÇÃO PRINCIPAIS */
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <button
                  onClick={confirmarLeituraNotificacao}
                  disabled={enviandoAcao}
                  style={{
                    background: "linear-gradient(135deg, #15803d, #22c55e)",
                    color: "#fff",
                    border: "none",
                    padding: "12px",
                    borderRadius: "12px",
                    fontWeight: "800",
                    cursor: "pointer",
                    fontSize: "14px",
                    boxShadow: "0 4px 14px rgba(34, 197, 94, 0.3)"
                  }}
                >
                  🟢 Validar / Ciente
                </button>
                <button
                  onClick={() => setModoFeedback(true)}
                  disabled={enviandoAcao}
                  style={{
                    background: "linear-gradient(135deg, #0284c7, #38bdf8)",
                    color: "#fff",
                    border: "none",
                    padding: "12px",
                    borderRadius: "12px",
                    fontWeight: "800",
                    cursor: "pointer",
                    fontSize: "14px",
                    boxShadow: "0 4px 14px rgba(56, 189, 248, 0.3)"
                  }}
                >
                  💬 Dar Feedback
                </button>
              </div>

              <button
                onClick={handleNaoAutorizei}
                disabled={enviandoAcao}
                style={{
                  background: "transparent",
                  color: "#ef4444",
                  border: "1px solid rgba(239, 68, 68, 0.4)",
                  padding: "10px",
                  borderRadius: "10px",
                  fontWeight: "700",
                  cursor: "pointer",
                  fontSize: "12px",
                  transition: "all 0.2s ease"
                }}
              >
                🚨 Eu NÃO autorizei este serviço (Alertar Donos)
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ==========================================
  // CASO 3: NOTIFICAÇÃO PADRÃO DO SISTEMA / ALERTA DE SEGURANÇA
  // ==========================================
  const msgLimpa = (notificacaoPendente.mensagem || "").replace(/\[ALERTA_GRUPO:[^\]]+\]\s*/g, "");
  const isAlertaSeguranca = msgLimpa.includes("🚨 ALERTA DE SEGURANÇA");

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget && typeof onFechar === "function") onFechar();
      }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", backdropFilter: "blur(6px)" }}
    >
      <div style={{
        background: isDarkMode ? "#1a1a1a" : "#fff",
        border: isAlertaSeguranca ? "2px solid #ef4444" : "2px solid #f97316",
        borderRadius: "20px",
        padding: "36px 40px",
        maxWidth: "540px",
        width: "100%",
        boxShadow: isAlertaSeguranca ? "0 20px 60px rgba(239, 68, 68, 0.25)" : "0 20px 60px rgba(0,0,0,0.6)",
        position: "relative"
      }}>
        
        {/* BOTÃO FECHAR */}
        {typeof onFechar === "function" && (
          <button
            onClick={onFechar}
            style={{
              position: "absolute", top: "16px", right: "18px", background: "rgba(255,255,255,0.08)", border: "none", color: theme?.subtext || "#888", fontSize: "16px", width: "32px", height: "32px", borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center"
            }}
            title="Fechar"
          >
            ✕
          </button>
        )}

        <div style={{ textAlign: "center", marginBottom: "20px" }}>
          <div style={{ fontSize: "40px", marginBottom: "8px" }}>{isAlertaSeguranca ? "🚨" : "🔔"}</div>
          <h2 style={{ color: isAlertaSeguranca ? "#ef4444" : "#f97316", fontWeight: "800", margin: "0 0 4px", fontSize: "20px" }}>
            {isAlertaSeguranca ? "Alerta de Segurança Urgente" : "Notificação Importante"}
          </h2>
          <p style={{ color: theme?.subtext, fontSize: "12px", margin: 0 }}>
            Enviado por <b style={{ color: theme?.text }}>{remetenteExibido}</b>
            {notificacaoPendente.criado_em && ` · ${formatarDataHora(notificacaoPendente.criado_em)}`}
          </p>
        </div>
        <div style={{
          background: isDarkMode ? (isAlertaSeguranca ? "rgba(239, 68, 68, 0.08)" : "#2a2a2a") : (isAlertaSeguranca ? "#fef2f2" : "#f8f8f8"),
          border: isAlertaSeguranca ? "1px solid rgba(239, 68, 68, 0.3)" : `1px solid ${theme?.border}`,
          borderRadius: "12px",
          padding: "20px",
          marginBottom: "24px",
          fontSize: "14px",
          lineHeight: "1.7",
          color: theme?.text,
          whiteSpace: "pre-wrap"
        }}>
          {renderLinks(msgLimpa)}
        </div>

        {notificacaoPendente.lido_em ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ textAlign: "center", fontSize: "12px", color: "#22c55e", fontWeight: "600" }}>
              ✅ Notificação lida em {formatarDataHora(notificacaoPendente.lido_em)}
            </div>
            <button
              onClick={onFechar || confirmarLeituraNotificacao}
              style={{
                background: isDarkMode ? "#222" : "#e5e7eb",
                color: theme?.text,
                border: `1px solid ${theme?.border}`,
                padding: "12px",
                borderRadius: "12px",
                width: "100%",
                fontWeight: "700",
                cursor: "pointer",
                fontSize: "14px"
              }}
            >
              Fechar
            </button>
          </div>
        ) : (
          <>
            <p style={{ color: theme?.subtext, fontSize: "12px", textAlign: "center", marginBottom: "16px" }}>
              {isAlertaSeguranca
                ? "⚠️ Este alerta foi enviado aos donos. Ao confirmar, o alerta será encerrado para a equipe."
                : "⚠️ Leia a mensagem com atenção. Você deve confirmar a leitura para continuar usando o sistema."}
            </p>
            <button
              onClick={confirmarLeituraNotificacao}
              style={{
                background: isAlertaSeguranca ? "linear-gradient(135deg, #dc2626, #ef4444)" : "linear-gradient(135deg, #ea580c, #f97316)",
                color: "#fff",
                border: "none",
                padding: "14px",
                borderRadius: "12px",
                width: "100%",
                fontWeight: "800",
                cursor: "pointer",
                fontSize: "15px",
                letterSpacing: "0.5px",
                boxShadow: isAlertaSeguranca ? "0 4px 15px rgba(239,68,68,0.35)" : "0 4px 15px rgba(249,115,22,0.35)"
              }}
            >
              {isAlertaSeguranca ? "🚨 Confirmar ciência do alerta" : "✅ Li e entendi a mensagem"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
