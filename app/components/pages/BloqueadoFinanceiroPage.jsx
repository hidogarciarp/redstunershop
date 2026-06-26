import React, { useState, useEffect } from "react";

export default function BloqueadoFinanceiroPage({
  styles,
  usuarioLogado,
  formatarData,
  reportValorSemanal,
  setReportValorSemanal,
  reportObsSemanal,
  setReportObsSemanal,
  reportLinkSemanal,
  setReportLinkSemanal,
  reportarPagamentoSemanal,
  usarCredito24h,
  setUsuarioLogado,
  setPaginaAtual,
  meusPagamentos,
  buscarMeusPagamentos,
}) {
  const creditoDisponivel = usuarioLogado?.credito_24h_disponivel;
  const usadoEm = usuarioLogado?.credito_24h_usado_em;
  const dentroJanela = usadoEm && Date.now() - new Date(usadoEm).getTime() < 24 * 3600 * 1000;

  const [semanaSelecionada, setSemanaSelecionada] = useState("");
  const [semanasDisponiveis, setSemanasDisponiveis] = useState([]);

  useEffect(() => {
    const semanas = [];
    const hoje = new Date();
    const diaSemana = hoje.getDay();
    const diffParaSegunda = diaSemana === 0 ? -6 : 1 - diaSemana;
    
    const segundaAtual = new Date(hoje);
    segundaAtual.setDate(hoje.getDate() + diffParaSegunda);
    segundaAtual.setHours(12, 0, 0, 0);

    for (let i = 0; i < 5; i++) {
      const s = new Date(segundaAtual);
      s.setDate(segundaAtual.getDate() - (i * 7));
      const dom = new Date(s);
      dom.setDate(s.getDate() + 6);
      
      const label = `Semana de ${s.toLocaleDateString("pt-BR").slice(0, 5)} até ${dom.toLocaleDateString("pt-BR").slice(0, 5)}`;
      
      // Filtrar se já está pago (confirmado)
      const jaPago = meusPagamentos?.some(pag => pag.confirmado && pag.observacao?.includes(label));
      
      // Filtrar por data de admissão (semana da admissão não cobra)
      let isentoPorAdmissao = false;
      if (usuarioLogado?.data_admissao) {
        const adm = new Date(usuarioLogado.data_admissao + "T12:00:00");
        const diaS = adm.getDay();
        const diffS = diaS === 0 ? -6 : 1 - diaS;
        const segAdm = new Date(adm); segAdm.setDate(adm.getDate() + diffS);
        const domAdm = new Date(segAdm); domAdm.setDate(segAdm.getDate() + 6);
        
        if (dom <= domAdm) isentoPorAdmissao = true;
      }

      if (!jaPago && !isentoPorAdmissao) {
        semanas.push({ label, isAtual: i === 0 });
      }
    }
    setSemanasDisponiveis(semanas);
    if (semanas.length > 0) setSemanaSelecionada(semanas[0].label);
  }, [meusPagamentos]);

  useEffect(() => {
    if (usuarioLogado?.id && (!meusPagamentos || meusPagamentos.length === 0)) {
      buscarMeusPagamentos(usuarioLogado.id);
    }
  }, [usuarioLogado?.id]);

  return (
    <>
      <style>{`@keyframes fadeLogin { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      <div style={{ ...styles.loginCentral, backgroundColor: "#050505" }}>
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.8)" }} />
        <div style={{ position: "relative", zIndex: 2, width: "100%", maxWidth: "520px", padding: "20px" }}>
          <div style={{ background: "#0e0e0e", border: "2px solid #7f1d1d", borderRadius: "24px", padding: "40px 36px", textAlign: "center", animation: "fadeLogin 0.4s ease", boxShadow: "0 20px 60px rgba(127,29,29,0.4)" }}>
            <div style={{ fontSize: "56px", marginBottom: "12px" }}>🔒</div>
            <h2 style={{ color: "#ef4444", fontWeight: "800", fontSize: "24px", margin: "0 0 8px" }}>Acesso Bloqueado</h2>
            <p style={{ color: "#aaa", fontSize: "14px", margin: "0 0 24px", lineHeight: "1.6" }}>
              Seu acesso ao sistema foi bloqueado por <b style={{ color: "#fff" }}>inadimplência na taxa semanal</b>.
              <br />
              Entre em contato com um administrador ou use sua liberação temporária abaixo.
            </p>

            {/* Info do usuário */}
            <div style={{ background: "#1a1a1a", border: "1px solid #2e2e2e", borderRadius: "12px", padding: "16px", marginBottom: "24px", textAlign: "left" }}>
              <div style={{ fontSize: "13px", color: "#aaa", marginBottom: "6px" }}>
                Funcionário: <b style={{ color: "#fff" }}>{usuarioLogado?.nome}</b>
              </div>
              <div style={{ fontSize: "13px", color: "#aaa", marginBottom: "6px" }}>
                ID: <b style={{ color: "#fff" }}>{usuarioLogado?.id}</b>
              </div>
              {usuarioLogado?.data_vencimento && (
                <div style={{ fontSize: "13px", color: "#ef4444" }}>
                  Vencimento: <b>{formatarData(usuarioLogado.data_vencimento)}</b>
                </div>
              )}
              {usuarioLogado?.valor_semanal > 0 && (
                <div style={{ fontSize: "13px", color: "#facc15", marginTop: "4px" }}>
                  Valor semanal: <b>R$ {Number(usuarioLogado.valor_semanal).toLocaleString("pt-BR")}</b>
                </div>
              )}
            </div>

            {/* Reportar pagamento (Automático) */}
            <div style={{ background: "#1a1a1a", border: "1px solid #2e2e2e", borderRadius: "12px", padding: "16px", marginBottom: "20px", textAlign: "left" }}>
              <div style={{ fontSize: "13px", fontWeight: "700", color: "#22c55e", marginBottom: "10px" }}>💰 Reportar Pagamento (Automático)</div>
              
              <div style={{ marginBottom: "12px" }}>
                <label style={{ fontSize: "11px", color: "#aaa", display: "block", marginBottom: "4px", textTransform: "uppercase" }}>Valor Pago</label>
                <input
                  style={{ ...styles.input, marginBottom: 0 }}
                  placeholder="Ex: 100000"
                  value={valorPagamentoRegistro}
                  onChange={(e) => setValorPagamentoRegistro(Number(String(e.target.value).replace(/\D/g, "") || 0).toLocaleString("pt-BR"))}
                />
              </div>

              <div style={{ marginBottom: "12px" }}>
                <label style={{ fontSize: "11px", color: "#aaa", display: "block", marginBottom: "4px", textTransform: "uppercase" }}>Período Semanal</label>
                <select
                  style={{ ...styles.select, marginBottom: 0, background: "#050505", border: "1px solid #333" }}
                  value={semanaSelecionada}
                  onChange={(e) => setSemanaSelecionada(e.target.value)}
                >
                  {semanasDisponiveis.map((s, i) => (
                    <option key={i} value={s.label}>{s.label} {s.isAtual ? "(Atual)" : ""}</option>
                  ))}
                  <option value="Outra">Outra / Pendência</option>
                </select>
              </div>

              <div style={{ marginBottom: "12px" }}>
                <label style={{ fontSize: "11px", color: "#aaa", display: "block", marginBottom: "4px", textTransform: "uppercase" }}>Observação (Opcional)</label>
                <input
                  style={{ ...styles.input, marginBottom: 0 }}
                  placeholder="Ex: Pago via Pix..."
                  value={observacaoPagamento}
                  onChange={(e) => setObservacaoPagamento(e.target.value)}
                />
              </div>

              <div onPaste={handlePastePagamento} style={{ marginBottom: "12px" }}>
                <label style={{ fontSize: "11px", color: "#aaa", display: "block", marginBottom: "4px", textTransform: "uppercase" }}>Comprovante / Foto</label>
                <div style={{ ...styles.uploadArea, padding: "15px", background: "#0a0a0a", border: "1px dashed #333" }}>
                  <label style={{ ...styles.uploadBtnLabel, padding: "8px 12px", fontSize: "12px" }}>
                    Selecionar imagem
                    <input type="file" accept="image/*" onChange={handleFilePagamento} style={{ display: "none" }} />
                  </label>
                  {previewPagamento && (
                    <div style={{ marginTop: "10px" }}>
                      <img src={previewPagamento} alt="Preview" style={{ width: "100%", maxWidth: "120px", borderRadius: "8px" }} />
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={() => enviarRegistroPagamento(semanaSelecionada === "Outra" ? "" : semanaSelecionada)}
                style={{
                  background: "linear-gradient(135deg, #14532d, #22c55e)",
                  color: "#fff",
                  border: "none",
                  padding: "12px",
                  borderRadius: "10px",
                  width: "100%",
                  marginTop: "10px",
                  fontWeight: "700",
                  cursor: "pointer",
                  fontSize: "14px",
                }}
              >
                📨 Enviar Comprovante e Liberar
              </button>
            </div>

            {/* Reportar pagamento (Manual - Legado) */}
            <details style={{ textAlign: "left", marginBottom: "20px" }}>
              <summary style={{ color: "#666", fontSize: "11px", cursor: "pointer", outline: "none" }}>Opções manuais (caso o upload falhe)</summary>
              <div style={{ background: "#1a1a1a", border: "1px solid #2e2e2e", borderRadius: "12px", padding: "16px", marginTop: "8px" }}>
                <input
                  style={{ ...styles.input, marginBottom: "8px" }}
                  placeholder="Valor pago"
                  value={reportValorSemanal}
                  onChange={(e) => setReportValorSemanal(e.target.value.replace(/\D/g, ""))}
                />
                <input
                  style={{ ...styles.input, marginBottom: "8px" }}
                  placeholder="Link do Comprovante manual"
                  value={reportLinkSemanal}
                  onChange={(e) => setReportLinkSemanal(e.target.value)}
                />
                <button
                  onClick={() => reportarPagamentoSemanal(semanaSelecionada === "Outra" ? "" : semanaSelecionada)}
                  style={{ background: "transparent", border: "1px solid #333", color: "#aaa", padding: "8px", borderRadius: "8px", width: "100%", cursor: "pointer", fontSize: "12px" }}
                >
                  Enviar link manual
                </button>
              </div>
            </details>

            {/* Crédito 24h */}
            {creditoDisponivel && !dentroJanela && (
              <div style={{ background: "#1a1a1a", border: "1px solid #854d0e", borderRadius: "12px", padding: "16px", marginBottom: "20px" }}>
                <div style={{ fontSize: "13px", color: "#fbbf24", fontWeight: "700", marginBottom: "8px" }}>⚡ Liberação Temporária Disponível</div>
                <p style={{ fontSize: "12px", color: "#888", margin: "0 0 12px", lineHeight: "1.5" }}>
                  Você possui <b style={{ color: "#fbbf24" }}>1 crédito de liberação</b> por 24 horas. Após usá-lo, ele só será renovado quando o administrador confirmar seu pagamento.
                </p>
                <button
                  onClick={usarCredito24h}
                  style={{
                    background: "linear-gradient(135deg, #78350f, #d97706)",
                    color: "#fff",
                    border: "none",
                    padding: "12px",
                    borderRadius: "10px",
                    width: "100%",
                    fontWeight: "700",
                    cursor: "pointer",
                    fontSize: "14px",
                  }}
                >
                  ⚡ Usar Liberação Temporária (24h)
                </button>
              </div>
            )}

            {!creditoDisponivel && !dentroJanela && (
              <div style={{ background: "#1a1a1a", border: "1px solid #374151", borderRadius: "12px", padding: "14px", marginBottom: "20px" }}>
                <p style={{ fontSize: "12px", color: "#6b7280", margin: 0, lineHeight: "1.5" }}>
                  ❌ Seu crédito de liberação temporária já foi utilizado neste ciclo. Aguarde um administrador confirmar seu pagamento.
                </p>
              </div>
            )}

            <button
              onClick={() => {
                setUsuarioLogado(null);
                setPaginaAtual("login");
              }}
              style={{ background: "transparent", border: "1px solid #333", color: "#666", padding: "10px 24px", borderRadius: "10px", cursor: "pointer", fontSize: "13px" }}
            >
              ← Voltar ao Login
            </button>
          </div>
          
          {/* DOSSIÊ FINANCEIRO (Compacto para Bloqueio) */}
          {meusPagamentos && meusPagamentos.length > 0 && (
            <div style={{ marginTop: "24px", background: "#0e0e0e", border: "1px solid #333", borderRadius: "20px", padding: "20px", animation: "fadeLogin 0.5s ease" }}>
              <div style={{ fontSize: "14px", fontWeight: "800", color: "#fff", marginBottom: "12px", textAlign: "left", display: "flex", alignItems: "center", gap: "8px" }}>
                📜 Meu Histórico de Pagamentos
              </div>
              <div style={{ maxHeight: "200px", overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
                  <thead style={{ position: "sticky", top: 0, background: "#0e0e0e" }}>
                    <tr style={{ textAlign: "left" }}>
                      <th style={{ padding: "8px 4px", borderBottom: "1px solid #333", color: "#666" }}>Semana/Obs</th>
                      <th style={{ padding: "8px 4px", borderBottom: "1px solid #333", color: "#666" }}>Valor</th>
                      <th style={{ padding: "8px 4px", borderBottom: "1px solid #333", color: "#666" }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {meusPagamentos.map(pag => (
                      <tr key={pag.id} style={{ borderBottom: "1px solid #1a1a1a" }}>
                        <td style={{ padding: "8px 4px", color: "#aaa" }}>
                          {pag.observacao || "Pagamento"}
                          {pag.comprovante_link && (
                            <a href={pag.comprovante_link} target="_blank" rel="noopener noreferrer" style={{ color: "#3b82f6", display: "block", fontSize: "9px", marginTop: "2px", textDecoration: "none" }}>🔗 Ver Link</a>
                          )}
                        </td>
                        <td style={{ padding: "8px 4px", color: "#22c55e", fontWeight: "700" }}>R$ {Number(pag.valor).toLocaleString("pt-BR")}</td>
                        <td style={{ padding: "8px 4px" }}>
                          {pag.confirmado ? <span style={{ color: "#22c55e" }}>✅ OK</span> : <span style={{ color: "#facc15" }}>⏳ Aguardando</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
