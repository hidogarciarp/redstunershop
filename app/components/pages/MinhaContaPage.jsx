import React, { useState, useEffect } from "react";

export default function MinhaContaPage({
  styles,
  theme,
  formatarDataHora,
  formatarHorario,
  calcularDuracao,
  formatarData,
  formatarHoras,
  usuarioLogado,
  meusServicos,
  historicoPonto,
  minhaContaCarregando,
  setMinhaContaCarregando,
  buscarMeusServicos,
  buscarMinhasNotificacoes,
  buscarMeusTopClientes,
  buscarHistoricoPonto,
  reportValorSemanal,
  setReportValorSemanal,
  reportObsSemanal,
  setReportObsSemanal,
  reportLinkSemanal,
  setReportLinkSemanal,
  reportarPagamentoSemanal,
  buscarDadosUsuario,
  meusTopClientes,
  minhasNotificacoes,
  meusPagamentos,
  atualizarComprovanteDossie,
  AppHeaderBar,
  AppModalNotificacao,
}) {
  const vencimento = usuarioLogado?.data_vencimento;
  const valorSemanal = usuarioLogado?.valor_semanal;
  const bloqueado = usuarioLogado?.bloqueado_financeiro;
  const hojeData = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const vencido = vencimento && vencimento < hojeData;

  const [semanaSelecionada, setSemanaSelecionada] = useState("");
  const [semanasDisponiveis, setSemanasDisponiveis] = useState([]);
  const [editandoDossieId, setEditandoDossieId] = useState(null);
  const [linkDossieTemp, setLinkDossieTemp] = useState("");
  const [showModalPontos, setShowModalPontos] = useState(false);

  useEffect(() => {
    const semanas = [];
    const hoje = new Date();
    // Ajustar para o fuso do Brasil, ou usar as datas locais
    const diaSemana = hoje.getDay();
    const diffParaSegunda = diaSemana === 0 ? -6 : 1 - diaSemana;
    
    const segundaAtual = new Date(hoje);
    segundaAtual.setDate(hoje.getDate() + diffParaSegunda);
    segundaAtual.setHours(12, 0, 0, 0); // Meio dia para evitar bugs de fuso horário

    const dataInauguracao = new Date("2026-04-06T12:00:00");

    for (let i = 0; i < 15; i++) {
      const s = new Date(segundaAtual);
      s.setDate(segundaAtual.getDate() - (i * 7));
      
      if (s < dataInauguracao) break; // Trava de segurança: inauguração da loja

      const dom = new Date(s);
      dom.setDate(s.getDate() + 6);
      
      const fD = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = `Semana de ${fD(s)} até ${fD(dom)}`;
      
      const domStr = dom.toISOString().split("T")[0];
      const cobertoPeloVencimento = vencimento && domStr <= vencimento;
      const jaPago = meusPagamentos?.some(pag => pag.observacao?.includes(label));
      
      // Filtrar por data de admissão (semana da admissão não cobra)
      if (usuarioLogado?.data_admissao) {
        let admStr = usuarioLogado.data_admissao;
        if (admStr.includes("/")) {
          const [d, m, y] = admStr.split("/");
          admStr = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        }
        const domStr = dom.toISOString().split("T")[0];
        
        // Se o domingo da semana for anterior à data de admissão, não mostra nem essa nem as anteriores
        if (domStr < admStr) break;
      }

      if (!jaPago && !cobertoPeloVencimento) {
        semanas.push({ label, isAtual: i === 0 });
      }
    }
    setSemanasDisponiveis(semanas);
    if (semanas.length > 0) setSemanaSelecionada(semanas[0].label);
  }, [meusPagamentos, usuarioLogado, vencimento]);

  const statusFinanceiro = bloqueado
    ? { label: "🔒 Bloqueado", color: "#ef4444" }
    : vencido
    ? { label: "⚠️ Vencido", color: "#f97316" }
    : !vencimento
    ? { label: "⚪ Sem cobrança", color: theme.subtext }
    : { label: "✅ Em dia", color: "#22c55e" };

  const totalServicos = meusServicos.length;
  const totalEstetica = meusServicos.filter((s) => s.tipo === "estetica").length;
  const totalTunagem = meusServicos.filter((s) => s.tipo === "tunagem").length;
  const totalGuincho = meusServicos.filter((s) => s.tipo === "guincho").length;
  const totalVendas = meusServicos.filter((s) => s.tipo === "venda").length;
  const totalMinutosTrabalhados = historicoPonto.reduce((acc, p) => {
    if (p.saida && p.verificado) {
      const diff = (new Date(p.saida) - new Date(p.entrada)) / 60000;
      return acc + (diff > 0 ? diff : 0);
    }
    return acc;
  }, 0);

  const [showModalServicos, setShowModalServicos] = useState(false);
  const [tipoServicoModal, setTipoServicoModal] = useState("");

  const servicosFiltrados = meusServicos.filter(s => tipoServicoModal === "total" || s.tipo === tipoServicoModal);

  return (
    <div style={styles.dashContainer}>
      <style>{`@keyframes fadeLogin { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      <AppModalNotificacao />
      <AppHeaderBar />
      <div style={{ padding: "30px 40px", maxWidth: "1200px", margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <h2 style={{ color: theme.text, margin: 0, fontWeight: "800" }}>👤 Minha Conta — {usuarioLogado?.nome}</h2>
          <button
            onClick={() => {
              setMinhaContaCarregando(true);
              Promise.all([
                buscarMeusServicos(),
                buscarMinhasNotificacoes(),
                buscarMeusTopClientes(),
                buscarHistoricoPonto({ apenasMeus: true }),
                buscarDadosUsuario(),
              ]).finally(() => setMinhaContaCarregando(false));
            }}
            style={{ ...styles.btnPrimary, width: "auto", marginTop: 0, padding: "9px 18px", fontSize: "12px" }}
          >
            🔄 Atualizar
          </button>
        </div>

        {minhaContaCarregando && (
          <div style={{ textAlign: "center", color: theme.subtext, marginBottom: "16px" }}>⏳ Carregando dados...</div>
        )}

        {/* CARDS DE RESUMO */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "24px" }}>
          {[
            { id: "total", label: "Total de Serviços", value: totalServicos, icon: "🛠️", color: "#38bdf8", clickable: true },
            { id: "estetica", label: "Estética", value: totalEstetica, icon: "🎨", color: "#a78bfa", clickable: true },
            { id: "tunagem", label: "Tunagem", value: totalTunagem, icon: "⚙️", color: "#f97316", clickable: true },
            { id: "guincho", label: "Guincho", value: totalGuincho, icon: "🚗", color: "#facc15", clickable: true },
            { id: "venda", label: "Vendas", value: totalVendas, icon: "📦", color: "#22c55e", clickable: true },
            { id: "ponto", label: "Horas Trabalhadas", value: formatarHoras(totalMinutosTrabalhados), icon: "⏱️", color: "#22c55e", clickable: true },
          ].map((card, i) => (
            <div 
              key={i} 
              onClick={() => {
                if (card.id === "ponto") setShowModalPontos(true);
                else {
                  setTipoServicoModal(card.id);
                  setShowModalServicos(true);
                }
              }}
              style={{ 
                ...styles.whiteCard, 
                padding: "18px", 
                textAlign: "center",
                cursor: "pointer",
                transition: "transform 0.2s, box-shadow 0.2s",
                ":hover": { transform: "translateY(-4px)", boxShadow: "0 8px 24px rgba(0,0,0,0.2)" }
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-4px)";
                e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.2)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <div style={{ fontSize: "28px", marginBottom: "6px" }}>{card.icon}</div>
              <div style={{ fontSize: "22px", fontWeight: "800", color: card.color }}>{card.value}</div>
              <div style={{ fontSize: "11px", color: theme.subtext, textTransform: "uppercase", letterSpacing: "0.5px", marginTop: "4px" }}>{card.label}</div>
              <div style={{ fontSize: "10px", color: theme.accent, fontWeight: "700", marginTop: "8px", opacity: 0.8 }}>
                VER HISTÓRICO 🔍
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginBottom: "24px" }}>
          {/* STATUS FINANCEIRO */}
          <div style={{ ...styles.whiteCard, borderLeft: `4px solid ${statusFinanceiro.color}` }}>
            <div style={{ ...styles.cardHeader, color: statusFinanceiro.color }}>
              <span style={{ ...styles.dot, background: statusFinanceiro.color }}></span>
              Meu Status Financeiro
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${theme.border}` }}>
                <span style={{ color: theme.subtext, fontSize: "13px" }}>Status</span>
                <span style={{ color: statusFinanceiro.color, fontWeight: "700", fontSize: "13px" }}>{statusFinanceiro.label}</span>
              </div>
              {valorSemanal > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${theme.border}` }}>
                  <span style={{ color: theme.subtext, fontSize: "13px" }}>Valor Semanal</span>
                  <span style={{ color: "#facc15", fontWeight: "700" }}>R$ {Number(valorSemanal).toLocaleString("pt-BR")}</span>
                </div>
              )}
              {vencimento && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${theme.border}` }}>
                  <span style={{ color: theme.subtext, fontSize: "13px" }}>Vencimento</span>
                  <span style={{ color: vencido ? "#f97316" : theme.text, fontWeight: vencido ? "700" : "400", fontSize: "13px" }}>{formatarData(vencimento)}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${theme.border}` }}>
                <span style={{ color: theme.subtext, fontSize: "13px" }}>Crédito 24h</span>
                <span style={{ color: usuarioLogado?.credito_24h_disponivel ? "#fbbf24" : theme.subtext, fontWeight: "700", fontSize: "13px" }}>
                  {usuarioLogado?.credito_24h_disponivel ? "⚡ Disponível" : "Usado"}
                </span>
              </div>

              {/* Reportar pagamento */}
              <div style={{ marginTop: "8px", padding: "14px", background: theme.card2, borderRadius: "10px", border: `1px solid ${theme.border}` }}>
                <div style={{ fontSize: "12px", fontWeight: "700", color: "#22c55e", marginBottom: "10px" }}>💰 Reportar Pagamento Semanal</div>
                
                <select
                  style={{ ...styles.select, marginBottom: "8px", fontSize: "13px" }}
                  value={semanaSelecionada}
                  onChange={(e) => setSemanaSelecionada(e.target.value)}
                >
                  {semanasDisponiveis.map((s, i) => (
                    <option key={i} value={s.label}>{s.label} {i === 0 ? "(Atual)" : ""}</option>
                  ))}
                  <option value="Outra">Outra / Pendência</option>
                </select>

                <input
                  style={{ ...styles.input, marginBottom: "8px" }}
                  placeholder="Valor pago (apenas números)"
                  value={reportValorSemanal}
                  onChange={(e) => setReportValorSemanal(e.target.value.replace(/\D/g, ""))}
                />
                <input
                  style={{ ...styles.input, marginBottom: "10px" }}
                  placeholder="Observação (opcional)"
                  value={reportObsSemanal}
                  onChange={(e) => setReportObsSemanal(e.target.value)}
                />
                <input
                  style={{ ...styles.input, marginBottom: "10px" }}
                  placeholder="Link do Comprovante (Obrigatório)"
                  value={reportLinkSemanal}
                  onChange={(e) => setReportLinkSemanal(e.target.value)}
                />
                <button
                  onClick={() => reportarPagamentoSemanal(semanaSelecionada === "Outra" ? "" : semanaSelecionada)}
                  style={{ background: "linear-gradient(135deg, #14532d, #22c55e)", color: "#fff", border: "none", padding: "10px", borderRadius: "9px", width: "100%", fontWeight: "700", cursor: "pointer", fontSize: "13px" }}
                >
                  📨 Reportar para o Administrador
                </button>
              </div>
            </div>
          </div>

          {/* PONTOS RECENTES */}
          <div style={{ ...styles.whiteCard, maxHeight: "420px", overflowY: "auto" }}>
            <div style={styles.cardHeader}><span style={styles.dot}></span> Meus Pontos Recentes</div>
            {historicoPonto.length === 0 ? (
              <p style={{ color: theme.subtext, textAlign: "center", padding: "20px 0", fontSize: "13px" }}>Nenhum ponto registrado.</p>
            ) : (
              historicoPonto.map((reg) => (
                <div key={reg.id} style={{ padding: "10px 0", borderBottom: `1px solid ${theme.border}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: "600", color: theme.text }}>{formatarData(reg.data)}</div>
                      <div style={{ fontSize: "12px", color: theme.subtext }}>
                        {formatarHorario(reg.entrada)} → {reg.saida ? formatarDataHora(reg.saida) : <span style={{ color: theme.accent }}>Em aberto</span>}
                      </div>
                      {reg.verificado && <div style={{ fontSize: "11px", color: "#22c55e", fontWeight: "600", marginTop: "2px" }}>✅ Verificado</div>}
                    </div>
                    <div style={{ color: "#22c55e", fontWeight: "700", fontSize: "13px" }}>
                      {reg.saida ? calcularDuracao(reg.entrada, reg.saida) : "—"}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginBottom: "24px" }}>
          {/* SERVIÇOS REALIZADOS */}
          <div style={{ ...styles.whiteCard, maxHeight: "420px", overflowY: "auto" }}>
            <div style={styles.cardHeader}><span style={{ ...styles.dot, background: "#38bdf8" }}></span> <span style={{ color: "#38bdf8" }}>Serviços Realizados (Geral)</span></div>
            {meusServicos.length === 0 ? (
              <p style={{ color: theme.subtext, textAlign: "center", padding: "20px 0", fontSize: "13px" }}>Nenhum serviço registrado.</p>
            ) : (
              meusServicos.map((s) => (
                <div key={s.id} style={{ padding: "10px 0", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: "600", color: theme.text }}>
                      {s.tipo === "estetica" ? "🎨" : s.tipo === "tunagem" ? "⚙️" : s.tipo === "guincho" ? "🚗" : "📦"} {s.tipo.charAt(0).toUpperCase() + s.tipo.slice(1)}
                    </div>
                    <div style={{ fontSize: "12px", color: theme.subtext }}>
                      {s.cliente_nome ? `${s.cliente_nome} (ID: ${s.cliente_id})` : "Cliente não informado"} · {s.data}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ color: "#facc15", fontWeight: "700", fontSize: "13px" }}>
                      R$ {Number(s.valor_total).toLocaleString("pt-BR")}
                    </div>
                    {s.link_imagem && (
                      <a href={s.link_imagem} target="_blank" rel="noopener noreferrer" style={{ fontSize: "10px", color: "#3b82f6", fontWeight: "700", textDecoration: "none" }}>🔗 VER LOG</a>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* TOP CLIENTES */}
          <div style={{ ...styles.whiteCard, maxHeight: "420px", overflowY: "auto" }}>
            <div style={styles.cardHeader}><span style={{ ...styles.dot, background: "#facc15" }}></span> <span style={{ color: "#facc15" }}>Meus Principais Clientes</span></div>
            {meusTopClientes.length === 0 ? (
              <p style={{ color: theme.subtext, textAlign: "center", padding: "20px 0", fontSize: "13px" }}>Nenhum cliente registrado ainda.</p>
            ) : (
              meusTopClientes.map((c, i) => (
                <div key={c.cliente_id} style={{ padding: "10px 0", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontWeight: "800", fontSize: "13px", color: i === 0 ? "#facc15" : i === 1 ? "#94a3b8" : i === 2 ? "#b87333" : theme.subtext, minWidth: "24px" }}>
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                    </span>
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: "600", color: theme.text }}>{c.cliente_nome || "Sem nome"}</div>
                      <div style={{ fontSize: "11px", color: theme.subtext }}>ID: {c.cliente_id} · {c.count} serviço{c.count !== 1 ? "s" : ""}</div>
                    </div>
                  </div>
                  <div style={{ color: "#facc15", fontWeight: "700", fontSize: "13px" }}>R$ {Number(c.total_gasto).toLocaleString("pt-BR")}</div>
                </div>
              ))
            )}
          </div>
        </div>
        
        {/* DOSSIÊ FINANCEIRO */}
        <div style={{ ...styles.whiteCard, marginBottom: "24px" }}>
          <div style={styles.cardHeader}><span style={{ ...styles.dot, background: "#a855f7" }}></span> <span style={{ color: "#a855f7" }}>Meu Dossiê Financeiro</span></div>
          {(!meusPagamentos || meusPagamentos.length === 0) ? (
            <p style={{ color: theme.subtext, textAlign: "center", padding: "20px 0", fontSize: "13px" }}>Nenhum pagamento registrado no seu dossiê.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ background: theme.card2, textAlign: "left" }}>
                    <th style={{ padding: "10px 12px", borderBottom: `1px solid ${theme.border}`, fontSize: "11px", textTransform: "uppercase", fontWeight: "700", color: theme.subtext }}>Semana / Observação</th>
                    <th style={{ padding: "10px 12px", borderBottom: `1px solid ${theme.border}`, fontSize: "11px", textTransform: "uppercase", fontWeight: "700", color: theme.subtext }}>Valor</th>
                    <th style={{ padding: "10px 12px", borderBottom: `1px solid ${theme.border}`, fontSize: "11px", textTransform: "uppercase", fontWeight: "700", color: theme.subtext }}>Comprovante</th>
                    <th style={{ padding: "10px 12px", borderBottom: `1px solid ${theme.border}`, fontSize: "11px", textTransform: "uppercase", fontWeight: "700", color: theme.subtext }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {meusPagamentos.map((pag) => (
                    <tr key={pag.id} style={{ borderBottom: `1px solid ${theme.border}` }}>
                      <td style={{ padding: "10px 12px", fontWeight: "600", color: theme.text }}>{(pag.observacao || "Pagamento Semanal").replace("Cobrança automática - ", "")}</td>
                      <td style={{ padding: "10px 12px", color: "#22c55e", fontWeight: "700" }}>R$ {Number(pag.valor).toLocaleString("pt-BR")}</td>
                      <td style={{ padding: "10px 12px" }}>
                        {pag.comprovante_link ? (
                          <a href={pag.comprovante_link} target="_blank" rel="noopener noreferrer" style={{ background: "#3b82f6", color: "#fff", padding: "4px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: "700", textDecoration: "none" }}>🔗 VER LINK</a>
                        ) : "—"}
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        {pag.confirmado ? (
                          <span style={{ color: "#22c55e", fontWeight: "800" }}>✅ CONFIRMADO</span>
                        ) : editandoDossieId === pag.id ? (
                          <div style={{ display: "flex", gap: "5px", alignItems: "center" }}>
                            <input 
                              style={{ ...styles.input, margin: 0, padding: "4px 8px", fontSize: "11px" }} 
                              placeholder="Cole o link..."
                              value={linkDossieTemp}
                              onChange={(e) => setLinkDossieTemp(e.target.value)}
                            />
                            <button 
                              onClick={() => {
                                atualizarComprovanteDossie(pag.id, linkDossieTemp);
                                setEditandoDossieId(null);
                                setLinkDossieTemp("");
                              }}
                              style={{ background: "#22c55e", border: "none", color: "#fff", padding: "4px 8px", borderRadius: "4px", fontSize: "10px", cursor: "pointer" }}
                            >
                              ENVIAR
                            </button>
                            <button 
                              onClick={() => setEditandoDossieId(null)}
                              style={{ background: "#dc2626", border: "none", color: "#fff", padding: "4px 8px", borderRadius: "4px", fontSize: "10px", cursor: "pointer" }}
                            >
                              X
                            </button>
                          </div>
                        ) : (
                          <span 
                            onClick={() => {
                              setEditandoDossieId(pag.id);
                              setLinkDossieTemp(pag.comprovante_link || "");
                            }}
                            style={{ color: "#facc15", fontWeight: "800", cursor: "pointer", textDecoration: "underline" }}
                            title="Clique para enviar comprovante"
                          >
                            ⏳ PENDENTE
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* HISTÓRICO DE NOTIFICAÇÕES RECEBIDAS */}
        <div style={styles.whiteCard}>
          <div style={styles.cardHeader}><span style={{ ...styles.dot, background: "#f97316" }}></span> <span style={{ color: "#f97316" }}>Histórico de Notificações Recebidas</span></div>
          {minhasNotificacoes.length === 0 ? (
            <p style={{ color: theme.subtext, textAlign: "center", padding: "20px 0", fontSize: "13px" }}>Nenhuma notificação recebida.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ background: theme.card2, textAlign: "left" }}>
                    <th style={{ padding: "8px 12px", borderBottom: `1px solid ${theme.border}`, fontSize: "11px", textTransform: "uppercase", fontWeight: "700", color: theme.subtext }}>Remetente</th>
                    <th style={{ padding: "8px 12px", borderBottom: `1px solid ${theme.border}`, fontSize: "11px", textTransform: "uppercase", fontWeight: "700", color: theme.subtext }}>Mensagem</th>
                    <th style={{ padding: "8px 12px", borderBottom: `1px solid ${theme.border}`, fontSize: "11px", textTransform: "uppercase", fontWeight: "700", color: theme.subtext }}>Recebida em</th>
                    <th style={{ padding: "8px 12px", borderBottom: `1px solid ${theme.border}`, fontSize: "11px", textTransform: "uppercase", fontWeight: "700", color: theme.subtext }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {minhasNotificacoes.map((n) => (
                    <tr key={n.id} style={{ borderBottom: `1px solid ${theme.border}`, background: n.lido_em ? "transparent" : "#f9731608" }}>
                      <td style={{ padding: "8px 12px", fontWeight: "600", color: theme.text }}>
                        {n.anonimo ? <span style={{ color: "#f59e0b" }}>🎭 Anônimo</span> : n.admin_nome}
                      </td>
                      <td style={{ padding: "8px 12px", color: theme.text, maxWidth: "320px" }}>
                        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "320px" }} title={n.mensagem}>{n.mensagem}</div>
                      </td>
                      <td style={{ padding: "8px 12px", color: theme.subtext, fontSize: "12px", whiteSpace: "nowrap" }}>{formatarDataHora(n.criado_em)}</td>
                      <td style={{ padding: "8px 12px" }}>
                        {n.lido_em ? (
                          <span style={{ background: "#16a34a20", color: "#22c55e", padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: "700" }}>✅ Lida</span>
                        ) : (
                          <span style={{ background: "#f9731620", color: "#f97316", padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: "700" }}>⏳ Pendente</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* MODAL DE EXTRATO DE PONTOS */}
      {showModalPontos && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 9999, padding: "20px",
          animation: "fadeLogin 0.3s ease-out"
        }}>
          <div style={{
            ...styles.whiteCard, width: "100%", maxWidth: "700px", maxHeight: "85vh",
            overflow: "hidden", display: "flex", flexDirection: "column",
            boxShadow: "0 24px 48px rgba(0,0,0,0.5)", border: `1px solid ${theme.border}55`
          }}>
            <div style={{
              padding: "20px 24px", borderBottom: `1px solid ${theme.border}`,
              display: "flex", justifyContent: "space-between", alignItems: "center",
              background: `linear-gradient(to right, ${theme.card}, ${theme.card2})`
            }}>
              <div>
                <h3 style={{ margin: 0, color: theme.text, fontSize: "18px", fontWeight: "800" }}>
                  ⏱️ Extrato Detalhado de Horas
                </h3>
                <div style={{ fontSize: "12px", color: theme.subtext, marginTop: "2px" }}>
                  {usuarioLogado?.nome} · Total acumulado: <span style={{ color: "#22c55e", fontWeight: "700" }}>{formatarHoras(totalMinutosTrabalhados)}</span>
                </div>
              </div>
              <button 
                onClick={() => setShowModalPontos(false)}
                style={{ 
                  background: theme.card2, border: `1px solid ${theme.border}`, color: theme.text,
                  width: "32px", height: "32px", borderRadius: "8px", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold"
                }}
              >✕</button>
            </div>

            <div style={{ padding: "0", overflowY: "auto", flex: 1 }}>
              {historicoPonto.length === 0 ? (
                <div style={{ padding: "60px 20px", textAlign: "center", color: theme.subtext }}>
                  <div style={{ fontSize: "40px", marginBottom: "12px" }}>📋</div>
                  Nenhum registro de ponto encontrado.
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                  <thead style={{ position: "sticky", top: 0, background: theme.card2, zIndex: 1 }}>
                    <tr>
                      {["Data", "Entrada", "Saída", "Duração", "Status"].map(col => (
                        <th key={col} style={{ 
                          padding: "12px 16px", textAlign: "left", color: theme.subtext, 
                          fontSize: "10px", textTransform: "uppercase", fontWeight: "700",
                          borderBottom: `1px solid ${theme.border}`
                        }}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {historicoPonto.map((reg, i) => {
                      const diffMin = reg.saida ? (new Date(reg.saida) - new Date(reg.entrada)) / 60000 : 0;
                      return (
                        <tr key={reg.id} style={{ 
                          borderBottom: `1px solid ${theme.border}44`,
                          background: i % 2 === 0 ? "transparent" : `${theme.card2}33`
                        }}>
                          <td style={{ padding: "12px 16px", color: theme.text, fontWeight: "600" }}>{formatarData(reg.data)}</td>
                          <td style={{ padding: "12px 16px", color: "#22c55e", fontWeight: "700" }}>{formatarHorario(reg.entrada)}</td>
                          <td style={{ padding: "12px 16px", color: reg.saida ? "#ef4444" : theme.subtext, fontWeight: "700" }}>
                            {reg.saida ? formatarHorario(reg.saida) : "—"}
                          </td>
                          <td style={{ padding: "12px 16px", color: theme.text, fontWeight: "800" }}>
                            {reg.saida ? calcularDuracao(reg.entrada, reg.saida) : <span style={{ color: theme.accent }}>Em aberto</span>}
                          </td>
                          <td style={{ padding: "12px 16px" }}>
                            {reg.verificado ? (
                              <span style={{ color: "#22c55e", fontSize: "11px", fontWeight: "700" }}>✅ Verificado</span>
                            ) : (
                              <span style={{ color: theme.subtext, fontSize: "11px" }}>⏳ Pendente</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div style={{ padding: "16px 24px", background: theme.card2, borderTop: `1px solid ${theme.border}`, textAlign: "right" }}>
              <button 
                onClick={() => setShowModalPontos(false)}
                style={{ ...styles.btnPrimary, width: "auto", margin: 0, padding: "8px 24px" }}
              >Entendi</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE HISTÓRICO DE SERVIÇOS */}
      {showModalServicos && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 9999, padding: "20px",
          animation: "fadeLogin 0.3s ease-out"
        }}>
          <div style={{
            ...styles.whiteCard, width: "100%", maxWidth: "800px", maxHeight: "85vh",
            overflow: "hidden", display: "flex", flexDirection: "column",
            boxShadow: "0 24px 48px rgba(0,0,0,0.5)", border: `1px solid ${theme.border}55`
          }}>
            <div style={{
              padding: "20px 24px", borderBottom: `1px solid ${theme.border}`,
              display: "flex", justifyContent: "space-between", alignItems: "center",
              background: `linear-gradient(to right, ${theme.card}, ${theme.card2})`
            }}>
              <div>
                <h3 style={{ margin: 0, color: theme.text, fontSize: "18px", fontWeight: "800" }}>
                  📋 Histórico de {tipoServicoModal === "total" ? "Todos os Serviços" : tipoServicoModal.charAt(0).toUpperCase() + tipoServicoModal.slice(1)}
                </h3>
                <div style={{ fontSize: "12px", color: theme.subtext, marginTop: "2px" }}>
                  Visualizando registros de {usuarioLogado?.nome}
                </div>
              </div>
              <button 
                onClick={() => setShowModalServicos(false)}
                style={{ 
                  background: theme.card2, border: `1px solid ${theme.border}`, color: theme.text,
                  width: "32px", height: "32px", borderRadius: "8px", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold"
                }}
              >✕</button>
            </div>

            <div style={{ padding: "0", overflowY: "auto", flex: 1 }}>
              {servicosFiltrados.length === 0 ? (
                <div style={{ padding: "60px 20px", textAlign: "center", color: theme.subtext }}>
                  <div style={{ fontSize: "40px", marginBottom: "12px" }}>📋</div>
                  Nenhum registro de serviço encontrado nesta categoria.
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                  <thead style={{ position: "sticky", top: 0, background: theme.card2, zIndex: 1 }}>
                    <tr>
                      {["Data", "Cliente", "Detalhes", "Valor", "Log"].map(col => (
                        <th key={col} style={{ 
                          padding: "12px 16px", textAlign: "left", color: theme.subtext, 
                          fontSize: "10px", textTransform: "uppercase", fontWeight: "700",
                          borderBottom: `1px solid ${theme.border}`
                        }}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {servicosFiltrados.map((s, i) => (
                      <tr key={s.id} style={{ 
                        borderBottom: `1px solid ${theme.border}44`,
                        background: i % 2 === 0 ? "transparent" : `${theme.card2}33`
                      }}>
                        <td style={{ padding: "12px 16px", color: theme.text, fontWeight: "600", whiteSpace: "nowrap" }}>{s.data}</td>
                        <td style={{ padding: "12px 16px", color: theme.text }}>
                          <div style={{ fontWeight: "700" }}>{s.cliente_nome || "—"}</div>
                          <div style={{ fontSize: "11px", color: theme.subtext }}>ID: {s.cliente_id}</div>
                        </td>
                        <td style={{ padding: "12px 16px", color: theme.subtext, fontSize: "11px", maxWidth: "250px" }}>
                          <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={s.detalhes}>{s.detalhes || "—"}</div>
                        </td>
                        <td style={{ padding: "12px 16px", color: "#facc15", fontWeight: "800" }}>
                          R$ {Number(s.valor_total).toLocaleString("pt-BR")}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          {s.link_imagem ? (
                            <a href={s.link_imagem} target="_blank" rel="noopener noreferrer" style={{ background: "#3b82f6", color: "#fff", padding: "4px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: "700", textDecoration: "none" }}>🔗 VER LOG</a>
                          ) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div style={{ padding: "16px 24px", background: theme.card2, borderTop: `1px solid ${theme.border}`, textAlign: "right" }}>
              <button 
                onClick={() => setShowModalServicos(false)}
                style={{ ...styles.btnPrimary, width: "auto", margin: 0, padding: "8px 24px" }}
              >Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
