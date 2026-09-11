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
  AppHeaderBar,
  AppModalNotificacao,
}) {
  const [semanaSelecionada, setSemanaSelecionada] = useState("");
  const [semanasDisponiveis, setSemanasDisponiveis] = useState([]);
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
      
      const fD = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = `Semana de ${fD(s)} até ${fD(dom)}`;

      const domStr = dom.toISOString().split("T")[0];
      const cobertoPeloVencimento = vencimento && domStr <= vencimento;
      const jaPago = meusPagamentos?.some(pag => pag.observacao?.includes(label) && (pag.confirmado || pag.comprovante_link));
      
      // Filtrar por data de admissão
      if (usuarioLogado?.data_admissao) {
        let admStr = usuarioLogado.data_admissao;
        if (admStr.includes("/")) {
          const [d, m, y] = admStr.split("/");
          admStr = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        }
        if (domStr < admStr) break;
      }

      const temCobrancaPendenteSemComprovante = meusPagamentos?.some(pag => pag.observacao?.includes(label) && !pag.confirmado && !pag.comprovante_link);

      if (temCobrancaPendenteSemComprovante || (!jaPago && !cobertoPeloVencimento)) {
        semanas.push({ label, isAtual: i === 0 });
      }
    }
    setSemanasDisponiveis(semanas);
    if (semanas.length > 0) setSemanaSelecionada(semanas[0].label);
  }, [meusPagamentos, usuarioLogado, vencimento]);
  return (
    <div style={styles.dashContainer}>
      <style>{`@keyframes fadeLogin { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      <AppModalNotificacao />
      <AppHeaderBar />
      <div style={{ padding: "30px 40px", maxWidth: "1000px", margin: "0 auto" }}>
        <div style={{ ...styles.whiteCard, maxWidth: "1000px" }}>
          <div style={styles.cardHeader}>
            <span style={styles.dot}></span> Registrar Pagamento | Pix Para Pagamentos: RED
          </div>
          <div style={{ marginBottom: "18px", fontSize: "13px", color: theme.subtext }}>
            <b style={{ color: theme.text }}>Funcionário:</b> {usuarioLogado?.nome}
            <br />
            <b style={{ color: theme.text }}>ID:</b> {usuarioLogado?.id}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <label style={styles.miniLabel}>VALOR PAGO</label>
              <input
                style={styles.input}
                placeholder="Ex: $100.000"
                value={valorPagamentoRegistro}
                onChange={(e) =>
                  setValorPagamentoRegistro(Number(String(e.target.value).replace(/\D/g, "") || 0).toLocaleString("pt-BR"))
                }
              />
            </div>
            <div>
              <label style={styles.miniLabel}>PERÍODO SEMANAL</label>
              <select
                style={{ ...styles.select, fontSize: "14px" }}
                value={semanaSelecionada}
                onChange={(e) => setSemanaSelecionada(e.target.value)}
              >
                {semanasDisponiveis.map((s, i) => (
                  <option key={i} value={s.label}>{s.label} {i === 0 ? "(Atual)" : ""}</option>
                ))}
                <option value="Outra">Outra / Pendência</option>
              </select>
            </div>
            <div>
              <label style={styles.miniLabel}>OBSERVAÇÃO (OPCIONAL)</label>
              <textarea
                style={{ ...styles.textarea, minHeight: "60px" }}
                placeholder="Ex: Pagamento referente a ..."
                value={observacaoPagamento}
                onChange={(e) => setObservacaoPagamento(e.target.value)}
              />
            </div>
            <div onPaste={handlePastePagamento}>
              <label style={styles.miniLabel}>COMPROVANTE / FOTO DO PAGAMENTO</label>
              <div style={styles.uploadArea}>
                <label style={styles.uploadBtnLabel}>
                  Selecionar imagem
                  <input type="file" accept="image/*" onChange={handleFilePagamento} style={{ display: "none" }} />
                </label>
                <p style={{ marginTop: "0px", fontSize: "12px", color: theme.subtext }}>
                  Você também pode colar a imagem com Ctrl + V
                </p>
                {previewPagamento && (
                  <div style={{ marginTop: "14px" }}>
                    <img
                      src={previewPagamento}
                      alt="Prévia"
                      style={{ width: "100%", maxWidth: "260px", borderRadius: "12px", border: `1px solid ${theme.border}` }}
                    />
                  </div>
                )}
              </div>
            </div>
            <button
              style={{
                ...styles.btnPrimary,
                marginTop: "0px",
                background: "linear-gradient(135deg, #043300, #168600)",
              }}
              onClick={() => enviarRegistroPagamento(semanaSelecionada === "Outra" ? "" : semanaSelecionada)}
            >
              ENVIAR COMPROVANTE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
