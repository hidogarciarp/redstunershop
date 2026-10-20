import React, { useState, useEffect } from "react";

export default function BloqueadoFinanceiroPage({
  styles = {},
  theme = {},
  usuarioLogado = null,
  formatarData = (d) => d,
  reportValorSemanal = "",
  setReportValorSemanal = () => {},
  reportObsSemanal = "",
  setReportObsSemanal = () => {},
  reportLinkSemanal = "",
  setReportLinkSemanal = () => {},
  reportarPagamentoSemanal = () => {},
  usarCredito24h = () => {},
  setUsuarioLogado = () => {},
  setPaginaAtual = () => {},
  meusPagamentos = [],
  buscarMeusPagamentos = () => {},
  valorPagamentoRegistro = "",
  setValorPagamentoRegistro = () => {},
  observacaoPagamento = "",
  setObservacaoPagamento = () => {},
  previewPagamento = null,
  handleFilePagamento = () => {},
  handlePastePagamento = () => {},
  enviarRegistroPagamento = () => {},
}) {
  const creditoDisponivel = usuarioLogado?.credito_24h_disponivel;
  const usadoEm = usuarioLogado?.credito_24h_usado_em;
  const dentroJanela = usadoEm && Date.now() - new Date(usadoEm).getTime() < 24 * 3600 * 1000;

  const [semanaSelecionada, setSemanaSelecionada] = useState("");
  const [semanasDisponiveis, setSemanasDisponiveis] = useState([]);
  const [enviando, setEnviando] = useState(false);

  const handleEnviarComprovante = async () => {
    try {
      setEnviando(true);
      await enviarRegistroPagamento(semanaSelecionada === "Outra" ? "" : semanaSelecionada);
      if (usuarioLogado?.id && typeof buscarMeusPagamentos === "function") {
        await buscarMeusPagamentos(usuarioLogado.id);
      }
    } finally {
      setEnviando(false);
    }
  };

  // Pré-preenche o valor semanal caso ainda não esteja preenchido
  useEffect(() => {
    if (usuarioLogado?.valor_semanal && !valorPagamentoRegistro && typeof setValorPagamentoRegistro === "function") {
      setValorPagamentoRegistro(Number(usuarioLogado.valor_semanal).toLocaleString("pt-BR"));
    }
  }, [usuarioLogado?.valor_semanal, valorPagamentoRegistro]);

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
      s.setDate(segundaAtual.getDate() - i * 7);
      const dom = new Date(s);
      dom.setDate(s.getDate() + 6);

      const label = `Semana de ${s.toLocaleDateString("pt-BR").slice(0, 5)} até ${dom.toLocaleDateString("pt-BR").slice(0, 5)}`;

      // Filtrar se já está pago (confirmado)
      const jaPago = meusPagamentos?.some((pag) => pag.confirmado && pag.observacao?.includes(label));

      // Filtrar por data de admissão (semana da admissão não cobra)
      let isentoPorAdmissao = false;
      if (usuarioLogado?.data_admissao) {
        const adm = new Date(usuarioLogado.data_admissao + "T12:00:00");
        const diaS = adm.getDay();
        const diffS = diaS === 0 ? -6 : 1 - diaS;
        const segAdm = new Date(adm);
        segAdm.setDate(adm.getDate() + diffS);
        const domAdm = new Date(segAdm);
        domAdm.setDate(segAdm.getDate() + 6);

        if (dom <= domAdm) isentoPorAdmissao = true;
      }

      if (!jaPago && !isentoPorAdmissao) {
        semanas.push({ label, isAtual: i === 0 });
      }
    }
    setSemanasDisponiveis(semanas);
    if (semanas.length > 0) setSemanaSelecionada(semanas[0].label);
  }, [meusPagamentos, usuarioLogado]);

  useEffect(() => {
    if (usuarioLogado?.id && (!meusPagamentos || meusPagamentos.length === 0) && typeof buscarMeusPagamentos === "function") {
      buscarMeusPagamentos(usuarioLogado.id);
    }
  }, [usuarioLogado?.id]);

  return (
    <>
      <style>{`@keyframes fadeLogin { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      <div style={{ ...styles.loginCentral, backgroundColor: "#050505" }}>
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.85)" }} />
        <div style={{ position: "relative", zIndex: 2, width: "100%", maxWidth: "540px", padding: "20px" }}>
          <div
            style={{
              background: "#0e0e11",
              border: "2px solid #7f1d1d",
              borderRadius: "24px",
              padding: "36px 32px",
              textAlign: "center",
              animation: "fadeLogin 0.35s ease",
              boxShadow: "0 20px 60px rgba(127,29,29,0.45)",
            }}
          >
            {/* Ícone e Título */}
            <div style={{ fontSize: "52px", marginBottom: "10px" }}>🔒</div>
            <h2 style={{ color: "#ef4444", fontWeight: "900", fontSize: "24px", margin: "0 0 8px", letterSpacing: "-0.5px" }}>
              Acesso Bloqueado
            </h2>
            <p style={{ color: "#aaa", fontSize: "14px", margin: "0 0 22px", lineHeight: "1.5" }}>
              Seu acesso ao sistema está bloqueado por <b style={{ color: "#fff" }}>pendência na taxa semanal</b>.
              <br />
              Ative a liberação temporária ou envie o comprovante de pagamento abaixo.
            </p>

            {/* Informações do Funcionário */}
            <div
              style={{
                background: "#16161a",
                border: "1px solid #2a2a30",
                borderRadius: "14px",
                padding: "16px 18px",
                marginBottom: "20px",
                textAlign: "left",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                <span style={{ fontSize: "13px", color: "#888" }}>Funcionário:</span>
                <b style={{ color: "#fff", fontSize: "13px" }}>{usuarioLogado?.nome}</b>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                <span style={{ fontSize: "13px", color: "#888" }}>Passaporte / ID:</span>
                <b style={{ color: "#fff", fontSize: "13px" }}>#{usuarioLogado?.id}</b>
              </div>
              {usuarioLogado?.data_vencimento && (
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                  <span style={{ fontSize: "13px", color: "#ef4444" }}>Vencimento:</span>
                  <b style={{ color: "#ef4444", fontSize: "13px" }}>{formatarData(usuarioLogado.data_vencimento)}</b>
                </div>
              )}
              {usuarioLogado?.valor_semanal > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #25252b", paddingTop: "8px", marginTop: "6px" }}>
                  <span style={{ fontSize: "13px", color: "#facc15", fontWeight: "700" }}>Taxa Semanal:</span>
                  <b style={{ color: "#facc15", fontSize: "14px" }}>
                    ${Number(usuarioLogado.valor_semanal).toLocaleString("pt-BR")}
                  </b>
                </div>
              )}
            </div>

            {/* DESTAQUE PRINCIPAL: DESBLOQUEIO TEMPORÁRIO (CRÉDITO 24H) */}
            {creditoDisponivel && !dentroJanela && (
              <div
                style={{
                  background: "linear-gradient(135deg, rgba(217, 119, 6, 0.16) 0%, rgba(120, 53, 15, 0.28) 100%)",
                  border: "2px solid #f59e0b",
                  borderRadius: "16px",
                  padding: "18px 20px",
                  marginBottom: "22px",
                  textAlign: "left",
                  boxShadow: "0 8px 30px rgba(245, 158, 11, 0.25)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                  <span style={{ fontSize: "20px" }}>⚡</span>
                  <span style={{ fontSize: "14px", color: "#fbbf24", fontWeight: "900", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Desbloqueio Temporário Disponível
                  </span>
                </div>
                <p style={{ fontSize: "12.5px", color: "#e5e7eb", margin: "0 0 14px", lineHeight: "1.5" }}>
                  Você possui <b>1 crédito de emergência</b> para liberar seu acesso por <b>24 horas</b>. Use-o para continuar trabalhando enquanto seu pagamento é conferido pela gerência.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    if (
                      window.confirm(
                        "Deseja ativar seu crédito de liberação temporária de 24 horas agora? Esse crédito só é restabelecido após a confirmação do pagamento semanal."
                      )
                    ) {
                      usarCredito24h();
                    }
                  }}
                  style={{
                    background: "linear-gradient(135deg, #d97706 0%, #b45309 100%)",
                    color: "#fff",
                    border: "none",
                    padding: "13px 18px",
                    borderRadius: "10px",
                    width: "100%",
                    fontWeight: "900",
                    cursor: "pointer",
                    fontSize: "14px",
                    boxShadow: "0 4px 14px rgba(217, 119, 6, 0.4)",
                    transition: "all 0.15s ease",
                  }}
                >
                  ⚡ ATIVAR DESBLOQUEIO TEMPORÁRIO (24 Horas)
                </button>
              </div>
            )}

            {dentroJanela && (
              <div
                style={{
                  background: "rgba(34, 197, 94, 0.12)",
                  border: "1.5px solid #22c55e",
                  borderRadius: "14px",
                  padding: "16px 18px",
                  marginBottom: "22px",
                  textAlign: "left",
                }}
              >
                <div style={{ color: "#22c55e", fontWeight: "800", fontSize: "14px", marginBottom: "4px" }}>
                  ✅ Liberação Temporária Ativa
                </div>
                <p style={{ color: "#aaa", fontSize: "12px", margin: "0 0 10px", lineHeight: "1.4" }}>
                  Você está dentro do período de 24h de liberação temporária.
                </p>
                <button
                  type="button"
                  onClick={() => setPaginaAtual("dashboard")}
                  style={{
                    background: "#22c55e",
                    color: "#000",
                    border: "none",
                    padding: "10px",
                    borderRadius: "8px",
                    fontWeight: "800",
                    cursor: "pointer",
                    fontSize: "13px",
                    width: "100%",
                  }}
                >
                  Ir para o Dashboard →
                </button>
              </div>
            )}

            {!creditoDisponivel && !dentroJanela && (
              <div
                style={{
                  background: "rgba(239, 68, 68, 0.08)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  borderRadius: "12px",
                  padding: "12px 16px",
                  marginBottom: "20px",
                  textAlign: "left",
                }}
              >
                <div style={{ color: "#ef4444", fontWeight: "700", fontSize: "12px", marginBottom: "3px" }}>
                  ⚠️ Liberação de 24h Já Utilizada
                </div>
                <p style={{ fontSize: "12px", color: "#888", margin: 0, lineHeight: "1.4" }}>
                  Seu crédito de 24h já foi gasto neste ciclo. Envie o comprovante abaixo para a gerência analisar e restabelecer seu acesso.
                </p>
              </div>
            )}

            {/* Formulário: Reportar Pagamento (Comprovante / Upload) */}
            <div
              style={{
                background: "#16161a",
                border: "1px solid #2a2a30",
                borderRadius: "14px",
                padding: "18px",
                marginBottom: "20px",
                textAlign: "left",
              }}
            >
              <div style={{ fontSize: "13px", fontWeight: "800", color: "#22c55e", marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
                <span>💰</span> Enviar Comprovante de Pagamento
              </div>

              <div style={{ marginBottom: "12px" }}>
                <label style={{ fontSize: "11px", color: "#aaa", display: "block", marginBottom: "4px", textTransform: "uppercase", fontWeight: "700" }}>
                  Valor Pago ($)
                </label>
                <input
                  style={{ ...styles.input, marginBottom: 0 }}
                  placeholder="Ex: 100000"
                  value={valorPagamentoRegistro}
                  onChange={(e) =>
                    setValorPagamentoRegistro(
                      Number(String(e.target.value).replace(/\D/g, "") || 0).toLocaleString("pt-BR")
                    )
                  }
                />
              </div>

              <div style={{ marginBottom: "12px" }}>
                <label style={{ fontSize: "11px", color: "#aaa", display: "block", marginBottom: "4px", textTransform: "uppercase", fontWeight: "700" }}>
                  Período de Referência
                </label>
                <select
                  style={{ ...styles.select, marginBottom: 0, background: "#050505", border: "1px solid #333" }}
                  value={semanaSelecionada}
                  onChange={(e) => setSemanaSelecionada(e.target.value)}
                >
                  {semanasDisponiveis.map((s, i) => (
                    <option key={i} value={s.label}>
                      {s.label} {s.isAtual ? "(Atual)" : ""}
                    </option>
                  ))}
                  <option value="Outra">Outra / Pendência</option>
                </select>
              </div>

              <div style={{ marginBottom: "12px" }}>
                <label style={{ fontSize: "11px", color: "#aaa", display: "block", marginBottom: "4px", textTransform: "uppercase", fontWeight: "700" }}>
                  Observação (Opcional)
                </label>
                <input
                  style={{ ...styles.input, marginBottom: 0 }}
                  placeholder="Ex: Pago via Pix / Transferência..."
                  value={observacaoPagamento}
                  onChange={(e) => setObservacaoPagamento(e.target.value)}
                />
              </div>

              <div onPaste={handlePastePagamento} style={{ marginBottom: "12px" }}>
                <label style={{ fontSize: "11px", color: "#aaa", display: "block", marginBottom: "4px", textTransform: "uppercase", fontWeight: "700" }}>
                  Comprovante / Print (Cole ou Selecione)
                </label>
                <div style={{ ...styles.uploadArea, padding: "14px", background: "#0a0a0d", border: "1px dashed #3a3a44", borderRadius: "10px", textAlign: "center" }}>
                  <label style={{ ...styles.uploadBtnLabel, padding: "8px 14px", fontSize: "12px", cursor: "pointer", display: "inline-block" }}>
                    📁 Escolher Imagem
                    <input type="file" accept="image/*" onChange={handleFilePagamento} style={{ display: "none" }} />
                  </label>
                  <span style={{ fontSize: "11px", color: "#666", marginLeft: "10px" }}>ou Ctrl+V para colar</span>
                  {previewPagamento && (
                    <div style={{ marginTop: "10px" }}>
                      <img src={previewPagamento} alt="Preview" style={{ width: "100%", maxWidth: "140px", borderRadius: "8px", border: "1px solid #333" }} />
                    </div>
                  )}
                </div>
              </div>

              <button
                type="button"
                disabled={enviando}
                onClick={handleEnviarComprovante}
                style={{
                  background: "linear-gradient(135deg, #15803d 0%, #16a34a 100%)",
                  color: "#fff",
                  border: "none",
                  padding: "13px",
                  borderRadius: "10px",
                  width: "100%",
                  marginTop: "6px",
                  fontWeight: "800",
                  cursor: enviando ? "not-allowed" : "pointer",
                  fontSize: "14px",
                  boxShadow: "0 4px 14px rgba(22, 163, 74, 0.35)",
                  opacity: enviando ? 0.7 : 1,
                }}
              >
                {enviando ? "⏳ Enviando Comprovante..." : "📨 Enviar Comprovante para Análise"}
              </button>
            </div>

            {/* Opções Manuais Legadas (Caso o upload falhe) */}
            <details style={{ textAlign: "left", marginBottom: "20px" }}>
              <summary style={{ color: "#666", fontSize: "11.5px", cursor: "pointer", outline: "none" }}>
                Opções manuais (caso o upload automático falhe)
              </summary>
              <div style={{ background: "#16161a", border: "1px solid #2a2a30", borderRadius: "12px", padding: "14px", marginTop: "8px" }}>
                <input
                  style={{ ...styles.input, marginBottom: "8px" }}
                  placeholder="Valor pago"
                  value={reportValorSemanal}
                  onChange={(e) => setReportValorSemanal(e.target.value.replace(/\D/g, ""))}
                />
                <input
                  style={{ ...styles.input, marginBottom: "8px" }}
                  placeholder="Link do Comprovante manual (Discord/Imgur)"
                  value={reportLinkSemanal}
                  onChange={(e) => setReportLinkSemanal(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => reportarPagamentoSemanal(semanaSelecionada === "Outra" ? "" : semanaSelecionada)}
                  style={{
                    background: "transparent",
                    border: "1px solid #444",
                    color: "#bbb",
                    padding: "8px",
                    borderRadius: "8px",
                    width: "100%",
                    cursor: "pointer",
                    fontSize: "12px",
                  }}
                >
                  Enviar link manual
                </button>
              </div>
            </details>

            {/* Botão Voltar ao Login */}
            <button
              type="button"
              onClick={() => {
                setUsuarioLogado(null);
                setPaginaAtual("login");
              }}
              style={{
                background: "transparent",
                border: "1px solid #333",
                color: "#777",
                padding: "10px 24px",
                borderRadius: "10px",
                cursor: "pointer",
                fontSize: "13px",
                transition: "all 0.15s ease",
              }}
            >
              ← Desconectar e Voltar ao Login
            </button>
          </div>

          {/* HISTÓRICO RECENTE DE PAGAMENTOS */}
          {meusPagamentos && meusPagamentos.length > 0 && (
            <div
              style={{
                marginTop: "20px",
                background: "#0e0e11",
                border: "1px solid #2a2a30",
                borderRadius: "20px",
                padding: "18px 20px",
                animation: "fadeLogin 0.4s ease",
              }}
            >
              <div style={{ fontSize: "13.5px", fontWeight: "800", color: "#fff", marginBottom: "12px", textAlign: "left", display: "flex", alignItems: "center", gap: "8px" }}>
                📜 Meu Histórico de Pagamentos
              </div>
              <div style={{ maxHeight: "200px", overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
                  <thead style={{ position: "sticky", top: 0, background: "#0e0e11" }}>
                    <tr style={{ textAlign: "left" }}>
                      <th style={{ padding: "8px 6px", borderBottom: "1px solid #333", color: "#777" }}>Período</th>
                      <th style={{ padding: "8px 6px", borderBottom: "1px solid #333", color: "#777" }}>Valor</th>
                      <th style={{ padding: "8px 6px", borderBottom: "1px solid #333", color: "#777" }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {meusPagamentos.map((pag) => (
                      <tr key={pag.id} style={{ borderBottom: "1px solid #1a1a20" }}>
                        <td style={{ padding: "8px 6px", color: "#aaa" }}>
                          {pag.observacao || "Pagamento"}
                          {pag.comprovante_link && (
                            <a
                              href={pag.comprovante_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: "#38bdf8", display: "block", fontSize: "10px", marginTop: "2px", textDecoration: "none" }}
                            >
                              🔗 Ver Comprovante
                            </a>
                          )}
                        </td>
                        <td style={{ padding: "8px 6px", color: "#22c55e", fontWeight: "700" }}>
                          ${Number(pag.valor).toLocaleString("pt-BR")}
                        </td>
                        <td style={{ padding: "8px 6px" }}>
                          {pag.confirmado ? (
                            <span style={{ color: "#22c55e", fontWeight: "700" }}>✅ Aprovado</span>
                          ) : (
                            <span style={{ color: "#facc15", fontWeight: "700" }}>⏳ Aguardando Aprovação</span>
                          )}
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
