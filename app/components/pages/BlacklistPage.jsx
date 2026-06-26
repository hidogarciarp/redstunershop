import React, { useState } from "react";

export default function BlacklistPage({
  styles,
  theme,
  blacklist,
  blacklistCarregando,
  adicionarBlacklist,
  removerBlacklist,
  userNivel
}) {
  const [novoId, setNovoId] = useState("");
  const [novoMotivo, setNovoMotivo] = useState("");

  // Apenas Gerente (5), Gerente Geral (6), Dono (7) e Admin (8) podem acessar
  if (userNivel < 5) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: theme.text }}>
        <h2 style={{ fontSize: "24px", color: "#b40d0d" }}>🚫 ACESSO RESTRITO</h2>
        <p style={{ opacity: 0.7, marginTop: "10px" }}>Você não tem permissão para visualizar a lista negra de clientes.</p>
      </div>
    );
  }

  const handleAdicionar = async () => {
    if (!novoId || !novoMotivo) return alert("⚠️ Preencha todos os campos!");
    await adicionarBlacklist(novoId, novoMotivo);
    setNovoId("");
    setNovoMotivo("");
  };

  return (
    <div style={{ padding: "24px", maxWidth: "1200px", margin: "0 auto", animation: "fadeIn 0.5s ease" }}>
      
      {/* HEADER DA PÁGINA */}
      <div style={{ marginBottom: "32px", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: "900", color: theme.text, letterSpacing: "-0.5px", margin: 0 }}>
            🚫 BLACKLIST <span style={{ color: "#b40d0d", fontSize: "14px", verticalAlign: "middle", marginLeft: "8px", background: "rgba(180,13,13,0.1)", padding: "4px 12px", borderRadius: "20px" }}>SISTEMA DE BANIMENTO</span>
          </h1>
          <p style={{ color: theme.subtext, marginTop: "8px", fontSize: "14px" }}>Gerencie clientes proibidos de utilizar os serviços da mecânica.</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "350px 1fr", gap: "24px", alignItems: "start" }}>
        
        {/* FORMULÁRIO DE ADIÇÃO */}
        <div style={{ ...styles.card, padding: "24px", border: `1px solid ${theme.border}`, position: "sticky", top: "20px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: "700", color: theme.text, marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
             ➕ Adicionar Restrição
          </h2>
          
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", color: theme.subtext, fontSize: "11px", fontWeight: "700", marginBottom: "8px", textTransform: "uppercase" }}>Passaporte (ID)</label>
            <input 
              style={{ ...styles.input, width: "100%", boxSizing: "border-box" }}
              placeholder="Ex: 1234"
              value={novoId}
              onChange={(e) => setNovoId(e.target.value.replace(/\D/g, ""))}
            />
          </div>

          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", color: theme.subtext, fontSize: "11px", fontWeight: "700", marginBottom: "8px", textTransform: "uppercase" }}>Motivo do Banimento</label>
            <textarea 
              style={{ ...styles.input, width: "100%", height: "100px", resize: "none", boxSizing: "border-box", padding: "12px" }}
              placeholder="Ex: Tentativa de golpe / Desrespeito / Roubo..."
              value={novoMotivo}
              onChange={(e) => setNovoMotivo(e.target.value)}
            />
          </div>

          <button 
            onClick={handleAdicionar}
            style={{ ...styles.btnPrimary, background: "linear-gradient(135deg, #b40d0d, #8a0a0a)", border: "none" }}
          >
            BANIR CLIENTE
          </button>
        </div>

        {/* LISTAGEM */}
        <div style={{ ...styles.card, border: `1px solid ${theme.border}`, overflow: "hidden" }}>
          {blacklistCarregando ? (
            <div style={{ padding: "40px", textAlign: "center", color: theme.subtext }}>Carregando blacklist...</div>
          ) : blacklist.length === 0 ? (
            <div style={{ padding: "60px", textAlign: "center", color: theme.subtext }}>
              <div style={{ fontSize: "40px", marginBottom: "16px" }}>🕊️</div>
              Nenhum cliente em blacklist no momento.
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.02)", borderBottom: `1px solid ${theme.border}` }}>
                  <th style={{ padding: "16px", textAlign: "left", color: theme.subtext }}>ID (PASS)</th>
                  <th style={{ padding: "16px", textAlign: "left", color: theme.subtext }}>MOTIVO</th>
                  <th style={{ padding: "16px", textAlign: "left", color: theme.subtext }}>AUTOR</th>
                  <th style={{ padding: "16px", textAlign: "left", color: theme.subtext }}>DATA</th>
                  <th style={{ padding: "16px", textAlign: "right", color: theme.subtext }}>AÇÕES</th>
                </tr>
              </thead>
              <tbody>
                {blacklist.map((item) => (
                  <tr key={item.id} style={{ borderBottom: `1px solid ${theme.border}`, transition: "background 0.2s" }}>
                    <td style={{ padding: "16px", color: "#b40d0d", fontWeight: "900" }}>#{item.passaporte}</td>
                    <td style={{ padding: "16px", color: theme.text }}>
                      <div style={{ maxWidth: "300px", lineHeight: "1.4" }}>{item.motivo}</div>
                    </td>
                    <td style={{ padding: "16px", color: theme.subtext }}>{item.criado_por}</td>
                    <td style={{ padding: "16px", color: theme.subtext, fontSize: "12px" }}>
                      {new Date(item.criado_em).toLocaleDateString("pt-BR")}
                    </td>
                    <td style={{ padding: "16px", textAlign: "right" }}>
                      <button 
                        onClick={() => window.confirm("Remover este cliente da blacklist?") && removerBlacklist(item.id)}
                        style={{ 
                          background: "rgba(180,13,13,0.1)", 
                          color: "#b40d0d", 
                          border: "1px solid rgba(180,13,13,0.3)", 
                          padding: "6px 12px", 
                          borderRadius: "8px", 
                          cursor: "pointer", 
                          fontSize: "12px", 
                          fontWeight: "700" 
                        }}
                      >
                        REMOVER
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </div>
  );
}
