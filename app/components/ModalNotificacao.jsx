export default function ModalNotificacao({
  notificacaoPendente,
  isDarkMode,
  theme,
  formatarDataHora,
  renderMensagemComLinks,
  confirmarLeituraNotificacao
}) {
  if (!notificacaoPendente) return null;
  
  const remetenteExibido = notificacaoPendente.anonimo ? "Anônimo" : notificacaoPendente.admin_nome;
  
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", backdropFilter: "blur(6px)" }}>
      <div style={{ background: isDarkMode ? "#1a1a1a" : "#fff", border: "2px solid #f97316", borderRadius: "20px", padding: "36px 40px", maxWidth: "520px", width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.6)", animation: "fadeLogin 0.3s ease" }}>
        <div style={{ textAlign: "center", marginBottom: "20px" }}>
          <div style={{ fontSize: "40px", marginBottom: "8px" }}>🔔</div>
          <h2 style={{ color: "#f97316", fontWeight: "800", margin: "0 0 4px", fontSize: "20px" }}>Notificação Importante</h2>
          <p style={{ color: theme.subtext, fontSize: "12px", margin: 0 }}>
            Enviado por <b style={{ color: theme.text }}>{remetenteExibido}</b>
            {" · "}{formatarDataHora(notificacaoPendente.criado_em)}
          </p>
        </div>
        <div style={{ background: isDarkMode ? "#2a2a2a" : "#f8f8f8", border: `1px solid ${theme.border}`, borderRadius: "12px", padding: "20px", marginBottom: "24px", fontSize: "15px", lineHeight: "1.7", color: theme.text, whiteSpace: "pre-wrap" }}>
          {renderMensagemComLinks(notificacaoPendente.mensagem)}
        </div>
        <p style={{ color: theme.subtext, fontSize: "12px", textAlign: "center", marginBottom: "16px" }}>
          ⚠️ Leia a mensagem com atenção. Você deve confirmar a leitura para continuar usando o sistema.
        </p>
        <button onClick={confirmarLeituraNotificacao} style={{ background: "linear-gradient(135deg, #ea580c, #f97316)", color: "#fff", border: "none", padding: "14px", borderRadius: "12px", width: "100%", fontWeight: "800", cursor: "pointer", fontSize: "15px", letterSpacing: "0.5px", boxShadow: "0 4px 15px rgba(249,115,22,0.35)" }}>
          ✅ Li e entendi a mensagem
        </button>
      </div>
    </div>
  );
}
