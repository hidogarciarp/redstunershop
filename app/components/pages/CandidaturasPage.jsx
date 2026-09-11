import React, { useState } from "react";

export default function CandidaturasPage({
  styles,
  theme,
  usuarioLogado,
  isAdminOuDono,
  candidaturas,
  buscarCandidaturas,
  enviarCandidatura,
  analisarCandidatura,
  candidaturasCarregando,
  formatarDataHora,
  vagasAtivas = {},
  toggleVaga,
  userIsAdmin,
  AppHeaderBar,
  AppModalNotificacao,
}) {
  const [abaAtiva, setAbaAtiva] = useState("vagas");
  const [vagaSelecionada, setVagaSelecionada] = useState(null);
  const [cartaApresentacao, setCartaApresentacao] = useState("");
  const [justificativa, setJustificativa] = useState("");
  const [enviando, setEnviando] = useState(false);

  const AREAS_DESCRICAO = {
    gerente_rh: {
      titulo: "Gerente RH",
      atribuicoes: [
        "Supervisionar toda a equipe e garantir o bom funcionamento da mecânica",
        "Definir e ajustar cargos, funções e responsabilidades",
        "Tomar decisões finais em conflitos internos",
        "Acompanhar desempenho geral da equipe (produtividade, presença, postura)",
        "Validar promoções, advertências e desligamentos"
      ]
    },
    resp_rh: {
      titulo: "Resp. RH",
      atribuicoes: [
        "Apoiar na gestão de pessoas e clima da equipe",
        "Acompanhar comportamento dos funcionários no dia a dia",
        "Aplicar feedbacks e orientar melhorias",
        "Auxiliar em processos de recrutamento e integração de novos membros",
        "Reportar ao Gerente RH situações relevantes"
      ]
    },
    resp_ponto: {
      titulo: "Resp. Ponto",
      atribuicoes: [
        "Registrar e lançar os logs de ponto no sistema/site",
        "Verificar se os funcionários estão cumprindo o tempo mínimo de 30 minutos ao abrir ponto",
        "Acompanhar notificações de ausência e justificativas",
        "Monitorar frequência e pontualidade da equipe",
        "Reportar irregularidades ao RH"
      ]
    },
    resp_eventos: {
      titulo: "Resp. Eventos",
      atribuicoes: [
        "Planejar e organizar os eventos da mecânica",
        "Definir regras, formato e funcionamento de cada evento",
        "Buscar e alinhar parcerias com estabelecimentos",
        "Coordenar equipe durante os eventos",
        "Acompanhar resultados e feedbacks pós-evento"
      ]
    },
    resp_tunagem: {
      titulo: "Resp. Tunagem",
      atribuicoes: [
        "Acompanhar registros de tunagem, estética e guincho",
        "Verificar se os serviços estão sendo registrados corretamente",
        "Garantir padrão de qualidade nos serviços prestados",
        "Identificar possíveis inconsistências ou abusos",
        "Reportar movimentações fora do padrão"
      ]
    },
    resp_parcerias: {
      titulo: "Resp. Parcerias",
      atribuicoes: [
        "Buscar novos estabelecimentos para parcerias",
        "Negociar benefícios e contrapartidas",
        "Manter relacionamento com parceiros ativos",
        "Apoiar eventos em conjunto com parceiros",
        "Registrar e organizar acordos firmados"
      ]
    },
    resp_financas: {
      titulo: "Resp. Finanças",
      atribuicoes: [
        "Acompanhar pagamentos semanais dos mecânicos",
        "Realizar a liberação do sistema de pagamentos",
        "Registrar custos de eventos (prêmios, estrutura, etc.)",
        "Controlar gastos com equipamentos (rádio, tablet, celular, etc.)",
        "Monitorar entradas e saídas relacionadas à mecânica",
        "Reportar saldo e movimentações para a gestão"
      ]
    }
  };

  const handleEnviar = async () => {
    if (!cartaApresentacao.trim() || !justificativa.trim()) {
      return alert("Por favor, preencha todos os campos.");
    }

    // Bloqueio de segurança no envio
    if (vagasAtivas[vagaSelecionada] === false && !userPodeControlarVagas) {
      return alert("Esta vaga não está mais aceitando candidaturas.");
    }

    setEnviando(true);
    const sucesso = await enviarCandidatura({
      area: vagaSelecionada,
      area_titulo: AREAS_DESCRICAO[vagaSelecionada].titulo,
      carta: cartaApresentacao,
      justificativa: justificativa
    });
    setEnviando(false);
    if (sucesso) {
      setVagaSelecionada(null);
      setCartaApresentacao("");
      setJustificativa("");
      setAbaAtiva("minhas");
    }
  };

  const minhasCandidaturas = candidaturas.filter(c => c.usuario_id === usuarioLogado?.id);
  const primaryRole = usuarioLogado?.role ? usuarioLogado.role.split("|")[0] : "";
  const isGerenteGeral = primaryRole === "gerente_geral";
  const userPodeGerenciar = isAdminOuDono(usuarioLogado?.role) || isGerenteGeral || usuarioLogado?.atribuicoes?.includes("gerente_rh") || usuarioLogado?.atribuicoes?.includes("resp_rh");
  const userPodeControlarVagas = userIsAdmin || isGerenteGeral;

  return (
    <div style={styles.dashContainer}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .tab-btn { padding: 10px 20px; cursor: pointer; border: none; background: transparent; color: ${theme.subtext}; font-weight: 600; border-bottom: 2px solid transparent; transition: 0.3s; }
        .tab-btn.active { color: #3b82f6; border-bottom-2px-solid: #3b82f6; }
        .card-vaga { background: ${theme.card2}; border: 1px solid ${theme.border}; padding: 20px; border-radius: 12px; transition: 0.3s; cursor: pointer; }
        .card-vaga:hover { border-color: #3b82f6; transform: translateY(-3px); box-shadow: 0 10px 20px -10px rgba(59, 130, 246, 0.3); }
      `}</style>
      <AppModalNotificacao />
      <AppHeaderBar />

      <div style={{ padding: "30px 40px", maxWidth: "1200px", margin: "0 auto", animation: "fadeIn 0.5s ease-out" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px" }}>
          <div>
            <h2 style={{ color: theme.text, margin: 0, fontWeight: "800", fontSize: "28px" }}>📢 Candidaturas</h2>
            <p style={{ color: theme.subtext, margin: "5px 0 0", fontSize: "14px" }}>Candidate-se para as funções de liderança da mecânica</p>
          </div>
          <button
            onClick={buscarCandidaturas}
            style={{ ...styles.btnPrimary, width: "auto", marginTop: 0, padding: "10px 20px" }}
          >
            🔄 Atualizar
          </button>
        </div>

        <div style={{ display: "flex", gap: "20px", borderBottom: `1px solid ${theme.border}`, marginBottom: "30px" }}>
          <button className={`tab-btn ${abaAtiva === "vagas" ? "active" : ""}`} onClick={() => setAbaAtiva("vagas")}>Vagas Disponíveis</button>
          <button className={`tab-btn ${abaAtiva === "minhas" ? "active" : ""}`} onClick={() => setAbaAtiva("minhas")}>Minhas Solicitações</button>
          {userPodeGerenciar && (
            <button className={`tab-btn ${abaAtiva === "gerenciar" ? "active" : ""}`} onClick={() => setAbaAtiva("gerenciar")}>Gerenciar ({candidaturas.filter(c => c.status === "pendente").length})</button>
          )}
        </div>

        {abaAtiva === "vagas" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))", gap: "20px" }}>
            {Object.entries(AREAS_DESCRICAO)
              .filter(([key]) => userPodeControlarVagas || vagasAtivas[key] !== false)
              .map(([key, info]) => (
                <div key={key} className="card-vaga" onClick={() => vagasAtivas[key] !== false ? setVagaSelecionada(key) : null} style={{ opacity: vagasAtivas[key] === false ? 0.6 : 1, cursor: vagasAtivas[key] === false ? "not-allowed" : "pointer" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
                    <h3 style={{ margin: 0, color: theme.text, fontSize: "18px" }}>{info.titulo}</h3>
                    {vagasAtivas[key] === false ? (
                      <span style={{ background: "#ef444420", color: "#ef4444", padding: "4px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: "700" }}>INDISPONÍVEL</span>
                    ) : (
                      <span style={{ background: "#22c55e20", color: "#22c55e", padding: "4px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: "700" }}>DISPONÍVEL</span>
                    )}
                  </div>
                  <ul style={{ paddingLeft: "20px", color: theme.subtext, fontSize: "13px", lineHeight: "1.6" }}>
                    {info.atribuicoes.slice(0, 3).map((at, i) => (
                      <li key={i} style={{ marginBottom: "5px" }}>{at}</li>
                    ))}
                    {vagasAtivas[key] !== false ? (
                      <li style={{ listStyle: "none", color: "#3b82f6", fontWeight: "600", marginTop: "10px" }}>Ver todas as atribuições e candidatar-se →</li>
                    ) : (
                      <li style={{ listStyle: "none", color: "#ef4444", fontWeight: "600", marginTop: "10px" }}>Vaga temporariamente fechada</li>
                    )}
                  </ul>
                </div>
              ))}
          </div>
        )}

        {abaAtiva === "minhas" && (
          <div style={styles.whiteCard}>
            <div style={styles.cardHeader}><span style={styles.dot}></span> Meu Histórico de Candidaturas</div>
            {minhasCandidaturas.length === 0 ? (
              <p style={{ textAlign: "center", padding: "40px", color: theme.subtext }}>Você ainda não se candidatou a nenhuma vaga.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ textAlign: "left", background: theme.card2 }}>
                      <th style={{ padding: "12px", color: theme.subtext, fontSize: "12px" }}>ÁREA</th>
                      <th style={{ padding: "12px", color: theme.subtext, fontSize: "12px" }}>DATA</th>
                      <th style={{ padding: "12px", color: theme.subtext, fontSize: "12px" }}>STATUS</th>
                      <th style={{ padding: "12px", color: theme.subtext, fontSize: "12px" }}>FEEDBACK</th>
                    </tr>
                  </thead>
                  <tbody>
                    {minhasCandidaturas.map(c => (
                      <tr key={c.id} style={{ borderBottom: `1px solid ${theme.border}` }}>
                        <td style={{ padding: "12px", color: theme.text, fontWeight: "600" }}>{c.area_titulo}</td>
                        <td style={{ padding: "12px", color: theme.subtext, fontSize: "13px" }}>{formatarDataHora(c.criado_em)}</td>
                        <td style={{ padding: "12px" }}>
                          <span style={{
                            padding: "4px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: "700",
                            background: c.status === "aprovada" ? "#22c55e20" : c.status === "rejeitada" ? "#ef444420" : "#facc1520",
                            color: c.status === "aprovada" ? "#22c55e" : c.status === "rejeitada" ? "#ef4444" : "#facc15"
                          }}>
                            {c.status.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ padding: "12px", color: theme.subtext, fontSize: "13px" }}>{c.feedback_admin || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {abaAtiva === "gerenciar" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "25px" }}>
            
            {/* CONTROLE DE VAGAS */}
            {userPodeControlarVagas && (
              <div style={styles.whiteCard}>
                <div style={styles.cardHeader}><span style={{ ...styles.dot, background: "#facc15" }}></span> Disponibilidade de Vagas (Site)</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "15px" }}>
                  {Object.entries(AREAS_DESCRICAO).map(([key, info]) => (
                    <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: theme.card2, padding: "12px", borderRadius: "12px", border: `1px solid ${theme.border}` }}>
                      <span style={{ fontSize: "13px", fontWeight: "700", color: theme.text }}>{info.titulo}</span>
                      <button 
                        onClick={() => toggleVaga(key)}
                        style={{ 
                          padding: "6px 14px", 
                          borderRadius: "8px", 
                          border: "none", 
                          fontSize: "11px", 
                          fontWeight: "800", 
                          cursor: "pointer",
                          background: vagasAtivas[key] === false ? "#ef4444" : "#22c55e",
                          color: "#fff",
                          transition: "all 0.2s"
                        }}
                      >
                        {vagasAtivas[key] === false ? "OCULTA" : "ABERTA"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* PENDENTES */}
            <div style={styles.whiteCard}>
              <div style={styles.cardHeader}><span style={styles.dot}></span> Candidaturas Pendentes</div>
              {candidaturas.filter(c => c.status === "pendente").length === 0 ? (
                <p style={{ textAlign: "center", padding: "40px", color: theme.subtext }}>Nenhuma candidatura pendente no momento.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                  {candidaturas.filter(c => c.status === "pendente").map(c => (
                    <div key={c.id} style={{ background: theme.card2, padding: "20px", borderRadius: "12px", border: `1px solid ${theme.border}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "15px" }}>
                        <div>
                          <div style={{ fontSize: "18px", fontWeight: "700", color: theme.text }}>{c.usuario_nome}</div>
                          <div style={{ fontSize: "12px", color: "#3b82f6", fontWeight: "600" }}>SOLICITANDO: {c.area_titulo}</div>
                        </div>
                        <div style={{ fontSize: "12px", color: theme.subtext }}>{formatarDataHora(c.criado_em)}</div>
                      </div>
                      <div style={{ marginBottom: "15px" }}>
                        <div style={{ fontSize: "11px", fontWeight: "700", color: theme.subtext, textTransform: "uppercase", marginBottom: "5px" }}>Carta de Apresentação</div>
                        <div style={{ fontSize: "13px", color: theme.text, background: theme.bg, padding: "12px", borderRadius: "8px", whiteSpace: "pre-wrap" }}>{c.carta_apresentacao}</div>
                      </div>
                      <div style={{ marginBottom: "20px" }}>
                        <div style={{ fontSize: "11px", fontWeight: "700", color: theme.subtext, textTransform: "uppercase", marginBottom: "5px" }}>Justificativa</div>
                        <div style={{ fontSize: "13px", color: theme.text, background: theme.bg, padding: "12px", borderRadius: "8px", whiteSpace: "pre-wrap" }}>{c.justificativa}</div>
                      </div>
                      <div style={{ display: "flex", gap: "10px" }}>
                        <button
                          onClick={() => {
                            const feedback = prompt("Deseja deixar um feedback ou observação?");
                            analisarCandidatura(c.id, "aprovada", feedback);
                          }}
                          style={{ ...styles.btnPrimary, background: "#22c55e", width: "auto", margin: 0, padding: "8px 20px" }}
                        >
                          ✅ Aprovar
                        </button>
                        <button
                          onClick={() => {
                            const feedback = prompt("Motivo da rejeição:");
                            if (feedback) analisarCandidatura(c.id, "rejeitada", feedback);
                          }}
                          style={{ ...styles.btnPrimary, background: "#ef4444", width: "auto", margin: 0, padding: "8px 20px" }}
                        >
                          ❌ Rejeitar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* HISTÓRICO */}
            <div style={styles.whiteCard}>
              <div style={styles.cardHeader}><span style={{ ...styles.dot, background: "#3b82f6" }}></span> Histórico de Análises</div>
              {candidaturas.filter(c => c.status !== "pendente").length === 0 ? (
                <p style={{ textAlign: "center", padding: "40px", color: theme.subtext }}>Nenhum histórico de análise encontrado.</p>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: `2px solid ${theme.border}`, textAlign: "left" }}>
                        <th style={{ padding: "12px", color: theme.subtext, fontSize: "12px" }}>FUNCIONÁRIO</th>
                        <th style={{ padding: "12px", color: theme.subtext, fontSize: "12px" }}>VAGA</th>
                        <th style={{ padding: "12px", color: theme.subtext, fontSize: "12px" }}>STATUS</th>
                        <th style={{ padding: "12px", color: theme.subtext, fontSize: "12px" }}>FEEDBACK</th>
                        <th style={{ padding: "12px", color: theme.subtext, fontSize: "12px" }}>DATA DECISÃO</th>
                      </tr>
                    </thead>
                    <tbody>
                      {candidaturas.filter(c => c.status !== "pendente").map(c => (
                        <tr key={c.id} style={{ borderBottom: `1px solid ${theme.border}` }}>
                          <td style={{ padding: "12px", color: theme.text, fontWeight: "600" }}>{c.usuario_nome}</td>
                          <td style={{ padding: "12px", color: theme.text }}>{c.area_titulo}</td>
                          <td style={{ padding: "12px" }}>
                            <span style={{
                              padding: "4px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: "700",
                              background: c.status === "aprovada" ? "#22c55e20" : "#ef444420",
                              color: c.status === "aprovada" ? "#22c55e" : "#ef4444"
                            }}>
                              {c.status.toUpperCase()}
                            </span>
                          </td>
                          <td style={{ padding: "12px", color: theme.subtext, fontSize: "13px" }}>{c.feedback_admin || "—"}</td>
                          <td style={{ padding: "12px", color: theme.subtext, fontSize: "13px" }}>{formatarDataHora(c.analisado_em || c.criado_em)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* MODAL DE FORMULÁRIO */}
      {vagaSelecionada && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.8)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, padding: "20px" }}>
          <div style={{ background: theme.card, width: "100%", maxWidth: "700px", borderRadius: "16px", overflow: "hidden", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "20px", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", background: "#3b82f6" }}>
              <h3 style={{ margin: 0, color: "#fff" }}>Candidatura: {AREAS_DESCRICAO[vagaSelecionada].titulo}</h3>
              <button onClick={() => setVagaSelecionada(null)} style={{ background: "transparent", border: "none", color: "#fff", fontSize: "24px", cursor: "pointer" }}>&times;</button>
            </div>
            <div style={{ padding: "24px", overflowY: "auto", flex: 1 }}>
              <div style={{ marginBottom: "20px", background: theme.card2, padding: "15px", borderRadius: "10px" }}>
                <div style={{ fontWeight: "700", color: theme.text, marginBottom: "10px", fontSize: "14px" }}>📋 Atribuições da Função:</div>
                <ul style={{ paddingLeft: "20px", margin: 0, fontSize: "13px", color: theme.subtext }}>
                  {AREAS_DESCRICAO[vagaSelecionada].atribuicoes.map((at, i) => (
                    <li key={i} style={{ marginBottom: "5px" }}>{at}</li>
                  ))}
                </ul>
              </div>

              <label style={styles.miniLabel}>CARTA DE APRESENTAÇÃO</label>
              <textarea
                style={{ ...styles.input, height: "120px", padding: "12px", resize: "none", marginBottom: "15px" }}
                placeholder="Fale um pouco sobre você e sua trajetória na mecânica..."
                value={cartaApresentacao}
                onChange={(e) => setCartaApresentacao(e.target.value)}
              />

              <label style={styles.miniLabel}>POR QUE VOCÊ DEVE SER ESCOLHIDO PARA ESTA ÁREA?</label>
              <textarea
                style={{ ...styles.input, height: "120px", padding: "12px", resize: "none", marginBottom: "15px" }}
                placeholder="Justifique por que você é a melhor pessoa para assumir estas responsabilidades..."
                value={justificativa}
                onChange={(e) => setJustificativa(e.target.value)}
              />

              <button
                disabled={enviando || (vagasAtivas[vagaSelecionada] === false && !userPodeControlarVagas)}
                onClick={handleEnviar}
                style={{ 
                  ...styles.btnPrimary, 
                  margin: "10px 0 0",
                  background: (vagasAtivas[vagaSelecionada] === false && !userPodeControlarVagas) ? "#666" : styles.btnPrimary.background,
                  cursor: (vagasAtivas[vagaSelecionada] === false && !userPodeControlarVagas) ? "not-allowed" : "pointer"
                }}
              >
                {enviando ? "ENVIANDO..." : (vagasAtivas[vagaSelecionada] === false && !userPodeControlarVagas) ? "VAGA INDISPONÍVEL" : "ENVIAR MINHA CANDIDATURA"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
