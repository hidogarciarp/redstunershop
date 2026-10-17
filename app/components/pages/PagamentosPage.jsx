import React, { useState, useEffect } from "react";

export default function PagamentosPage({
  styles,
  theme,
  usuarioLogado,
  valorPagamentoRegistro,
  setValorPagamentoRegistro,
  observacaoPagamento,
  setObservacaoPagamento,
  handlePastePagamento,
  handleFilePagamento,
  previewPagamento,
  enviarRegistroPagamento,
  meusPagamentos = [],
  buscarMeusPagamentos,
  setPaginaAtual,
  AppHeaderBar,
  AppModalNotificacao,
}) {
  const [semanaSelecionada, setSemanaSelecionada] = useState("");
  const [semanasDisponiveis, setSemanasDisponiveis] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const vencimento = usuarioLogado?.data_vencimento;

  useEffect(() => {
    const semanas = [];
    const hoje = new Date();
    const diaSemana = hoje.getDay();
    const diffParaSegunda = diaSemana === 0 ? -6 : 1 - diaSemana;

    const segundaAtual = new Date(hoje);
    segundaAtual.setDate(hoje.getDate() + diffParaSegunda);
    segundaAtual.setHours(12, 0, 0, 0);

    const dataInauguracao = new Date("2026-04-06T12:00:00");

    for (let i = 0; i < 15; i++) {
      const s = new Date(segundaAtual);
      s.setDate(segundaAtual.getDate() - (i * 7));
      if (s < dataInauguracao) break;

      const dom = new Date(s);
      dom.setDate(s.getDate() + 6);

      const fD = (d) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = `Semana de ${fD(s)} até ${fD(dom)}`;

      const domStr = dom.toISOString().split("T")[0];
      const cobertoPeloVencimento = vencimento && domStr <= vencimento;
      const jaPago = meusPagamentos?.some(
        (pag) => pag.observacao?.includes(label) && (pag.confirmado || pag.comprovante_link)
      );

      // Filtrar por data de admissão
      if (usuarioLogado?.data_admissao) {
        let admStr = usuarioLogado.data_admissao;
        if (admStr.includes("/")) {
          const [d, m, y] = admStr.split("/");
          admStr = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
        }
        if (domStr < admStr) break;
      }

      const temCobrancaPendenteSemComprovante = meusPagamentos?.some(
        (pag) => pag.observacao?.includes(label) && !pag.confirmado && !pag.comprovante_link
      );

      if (temCobrancaPendenteSemComprovante || (!jaPago && !cobertoPeloVencimento)) {
        semanas.push({ label, isAtual: i === 0 });
      }
    }
    setSemanasDisponiveis(semanas);
    if (semanas.length > 0) setSemanaSelecionada(semanas[0].label);
  }, [meusPagamentos, usuarioLogado, vencimento]);

  const handleSubmit = async () => {
    try {
      setEnviando(true);
      await enviarRegistroPagamento(semanaSelecionada === "Outra" ? "" : semanaSelecionada);
      if (buscarMeusPagamentos && usuarioLogado?.id) {
        await buscarMeusPagamentos(usuarioLogado.id);
      }
    } finally {
      setEnviando(false);
    }
  };

  const calcularStatusVencimento = () => {
    if (!vencimento) return { label: "Não definido", color: "#94a3b8", bg: "rgba(148,163,184,0.12)" };
    const hojeStr = new Date().toISOString().split("T")[0];
    if (vencimento >= hojeStr) {
      return { label: `Em dia até ${vencimento.split("-").reverse().join("/")}`, color: "#22c55e", bg: "rgba(34,197,94,0.15)" };
    }
    return { label: `Vencido desde ${vencimento.split("-").reverse().join("/")}`, color: "#ef4444", bg: "rgba(239,68,68,0.15)" };
  };

  const statusVenc = calcularStatusVencimento();

  return (
    <div style={styles.dashContainer}>
      <style>{`
        @keyframes fadeLogin {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <AppModalNotificacao />
      <AppHeaderBar />

      <div style={{ padding: "26px 20px 60px", maxWidth: "960px", margin: "0 auto", animation: "fadeLogin 0.3s ease" }}>
        {/* TOPO: NAVEGAÇÃO E TÍTULO */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "22px", flexWrap: "wrap", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {setPaginaAtual && (
              <button
                type="button"
                onClick={() => setPaginaAtual("dashboard")}
                style={{
                  background: theme.card2 || "rgba(255,255,255,0.06)",
                  border: `1px solid ${theme.border}`,
                  color: theme.text,
                  padding: "8px 14px",
                  borderRadius: "10px",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: "700",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  transition: "background 0.2s",
                }}
              >
                ← Voltar
              </button>
            )}
            <div>
              <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "800", color: theme.text, letterSpacing: "-0.5px" }}>
                💸 Pagamentos & Comprovantes
              </h1>
              <p style={{ margin: "2px 0 0", fontSize: "12px", color: theme.subtext }}>
                Envie o comprovante da sua taxa semanal da Red&apos;s Tunershop
              </p>
            </div>
          </div>

          {/* BADGE DE SITUAÇÃO DO VENCIMENTO */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "7px 14px",
              borderRadius: "12px",
              background: statusVenc.bg,
              border: `1px solid ${statusVenc.color}40`,
              fontSize: "12px",
              fontWeight: "700",
              color: statusVenc.color,
            }}
          >
            <span>📅 Vencimento:</span>
            <span>{statusVenc.label}</span>
          </div>
        </div>

        {/* CARD PRINCIPAL DO FORMULÁRIO */}
        <div style={{ ...styles.whiteCard, maxWidth: "100%", padding: "24px", borderRadius: "16px", marginBottom: "28px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${theme.border}`, paddingBottom: "14px", marginBottom: "18px", flexWrap: "wrap", gap: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "15px", fontWeight: "800", color: theme.text }}>
              <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#22c55e", display: "inline-block", boxShadow: "0 0 8px #22c55e" }}></span>
              Registrar Pagamento de Taxa Semanal
            </div>
            <div style={{ background: "rgba(234,179,8,0.12)", border: "1px solid rgba(234,179,8,0.3)", padding: "5px 12px", borderRadius: "8px", fontSize: "12px", fontWeight: "800", color: "#facc15" }}>
              🔑 Chave Pix: <strong style={{ letterSpacing: "1px", color: "#fff" }}>RED</strong>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px", marginBottom: "16px" }}>
            <div>
              <label style={styles.miniLabel}>VALOR PAGO ($)</label>
              <div style={{ position: "relative" }}>
                <input
                  style={{ ...styles.input, paddingLeft: "14px", fontWeight: "700", fontSize: "15px" }}
                  placeholder="Ex: 100.000"
                  value={valorPagamentoRegistro}
                  onChange={(e) =>
                    setValorPagamentoRegistro(
                      Number(String(e.target.value).replace(/\D/g, "") || 0).toLocaleString("pt-BR")
                    )
                  }
                />
              </div>
              <div style={{ display: "flex", gap: "6px", marginTop: "6px" }}>
                <button
                  type="button"
                  onClick={() => setValorPagamentoRegistro("100.000")}
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: `1px solid ${theme.border}`,
                    color: theme.subtext,
                    fontSize: "10px",
                    fontWeight: "700",
                    padding: "3px 8px",
                    borderRadius: "6px",
                    cursor: "pointer",
                  }}
                >
                  $100.000 (Padrão)
                </button>
              </div>
            </div>

            <div>
              <label style={styles.miniLabel}>PERÍODO SEMANAL REFERENTE</label>
              <select
                style={{ ...styles.select, fontSize: "13px" }}
                value={semanaSelecionada}
                onChange={(e) => setSemanaSelecionada(e.target.value)}
              >
                {semanasDisponiveis.map((s, i) => (
                  <option key={i} value={s.label}>
                    {s.label} {i === 0 ? "🌟 (Atual)" : ""}
                  </option>
                ))}
                <option value="Outra">Outra / Pendência Anterior</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={styles.miniLabel}>OBSERVAÇÃO (OPCIONAL)</label>
            <textarea
              style={{ ...styles.textarea, minHeight: "65px", fontSize: "13px" }}
              placeholder="Ex: Pagamento referente à semana adiantada ou acerto..."
              value={observacaoPagamento}
              onChange={(e) => setObservacaoPagamento(e.target.value)}
            />
          </div>

          <div onPaste={handlePastePagamento} style={{ marginBottom: "20px" }}>
            <label style={styles.miniLabel}>COMPROVANTE / FOTO DO PAGAMENTO (PRINT)</label>
            <div
              style={{
                ...styles.uploadArea,
                background: previewPagamento ? "rgba(34,197,94,0.04)" : styles.uploadArea.background,
                border: previewPagamento ? "2px dashed rgba(34,197,94,0.4)" : styles.uploadArea.border,
                padding: "24px 18px",
                borderRadius: "14px",
              }}
            >
              <label style={styles.uploadBtnLabel}>
                📎 Selecionar Imagem do Dispositivo
                <input type="file" accept="image/*" onChange={handleFilePagamento} style={{ display: "none" }} />
              </label>
              <p style={{ margin: "8px 0 0", fontSize: "12px", color: theme.subtext }}>
                💡 Você também pode <strong>colar com Ctrl + V</strong> aqui diretamente!
              </p>
              {previewPagamento && (
                <div style={{ marginTop: "16px", display: "inline-block", position: "relative" }}>
                  <img
                    src={previewPagamento}
                    alt="Prévia do Comprovante"
                    style={{
                      width: "100%",
                      maxWidth: "320px",
                      borderRadius: "12px",
                      border: "2px solid rgba(34,197,94,0.5)",
                      boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
                      display: "block",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      bottom: "8px",
                      right: "8px",
                      background: "rgba(0,0,0,0.75)",
                      color: "#22c55e",
                      padding: "3px 8px",
                      borderRadius: "6px",
                      fontSize: "11px",
                      fontWeight: "800",
                    }}
                  >
                    ✓ Anexado
                  </div>
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            disabled={enviando}
            style={{
              ...styles.btnPrimary,
              marginTop: 0,
              background: "linear-gradient(135deg, #15803d 0%, #16a34a 100%)",
              boxShadow: "0 4px 16px rgba(22,163,74,0.35)",
              color: "#fff",
              padding: "14px",
              fontSize: "14px",
              fontWeight: "800",
              letterSpacing: "0.5px",
              opacity: enviando ? 0.7 : 1,
              cursor: enviando ? "not-allowed" : "pointer",
            }}
            onClick={handleSubmit}
          >
            {enviando ? "ENVIANDO COMPROVANTE..." : "📤 ENVIAR COMPROVANTE DE PAGAMENTO"}
          </button>
        </div>

        {/* HISTÓRICO DE COMPROVANTES DO USUÁRIO */}
        <div style={{ ...styles.whiteCard, maxWidth: "100%", padding: "22px", borderRadius: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div style={{ fontSize: "15px", fontWeight: "800", color: theme.text, display: "flex", alignItems: "center", gap: "8px" }}>
              <span>📜</span> Meu Histórico de Pagamentos
            </div>
            {buscarMeusPagamentos && (
              <button
                type="button"
                onClick={() => buscarMeusPagamentos(usuarioLogado?.id)}
                style={{
                  background: "transparent",
                  border: `1px solid ${theme.border}`,
                  color: theme.subtext,
                  padding: "4px 10px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "11px",
                  fontWeight: "700",
                }}
              >
                🔄 Atualizar Lista
              </button>
            )}
          </div>

          {!meusPagamentos || meusPagamentos.length === 0 ? (
            <div style={{ textAlign: "center", padding: "30px 10px", color: theme.subtext, fontSize: "13px" }}>
              Nenhum pagamento registrado até o momento.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", textAlign: "left" }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${theme.border}`, color: theme.subtext }}>
                    <th style={{ padding: "10px 8px", fontWeight: "700" }}>Data de Envio</th>
                    <th style={{ padding: "10px 8px", fontWeight: "700" }}>Semana / Detalhes</th>
                    <th style={{ padding: "10px 8px", fontWeight: "700" }}>Valor</th>
                    <th style={{ padding: "10px 8px", fontWeight: "700" }}>Status</th>
                    <th style={{ padding: "10px 8px", fontWeight: "700", textAlign: "right" }}>Comprovante</th>
                  </tr>
                </thead>
                <tbody>
                  {meusPagamentos.map((pag) => {
                    const dataFormatada = pag.criado_em
                      ? new Date(pag.criado_em).toLocaleDateString("pt-BR")
                      : "-";
                    return (
                      <tr key={pag.id} style={{ borderBottom: `1px solid ${theme.border}25` }}>
                        <td style={{ padding: "12px 8px", color: theme.subtext, whiteSpace: "nowrap" }}>
                          {dataFormatada}
                        </td>
                        <td style={{ padding: "12px 8px", color: theme.text, fontWeight: "600" }}>
                          {pag.observacao || "Pagamento Semanal"}
                        </td>
                        <td style={{ padding: "12px 8px", color: "#22c55e", fontWeight: "800", whiteSpace: "nowrap" }}>
                          ${Number(pag.valor || 0).toLocaleString("pt-BR")}
                        </td>
                        <td style={{ padding: "12px 8px", whiteSpace: "nowrap" }}>
                          {pag.confirmado ? (
                            <span
                              style={{
                                background: "rgba(34,197,94,0.14)",
                                color: "#22c55e",
                                border: "1px solid rgba(34,197,94,0.3)",
                                padding: "3px 8px",
                                borderRadius: "6px",
                                fontSize: "11px",
                                fontWeight: "800",
                              }}
                            >
                              ✅ Confirmado
                            </span>
                          ) : (
                            <span
                              style={{
                                background: "rgba(234,179,8,0.14)",
                                color: "#facc15",
                                border: "1px solid rgba(234,179,8,0.3)",
                                padding: "3px 8px",
                                borderRadius: "6px",
                                fontSize: "11px",
                                fontWeight: "800",
                              }}
                            >
                              ⏳ Em Análise
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "12px 8px", textAlign: "right" }}>
                          {pag.comprovante_link ? (
                            <a
                              href={pag.comprovante_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                color: "#38bdf8",
                                textDecoration: "none",
                                fontWeight: "700",
                                fontSize: "11px",
                                background: "rgba(56,189,248,0.1)",
                                border: "1px solid rgba(56,189,248,0.25)",
                                padding: "4px 8px",
                                borderRadius: "6px",
                                display: "inline-block",
                              }}
                            >
                              🔗 Ver Comprovante
                            </a>
                          ) : (
                            <span style={{ color: theme.subtext, fontSize: "11px" }}>-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
