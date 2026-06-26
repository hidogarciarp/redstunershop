import React, { useState } from "react";

export default function PontoPage({
  styles,
  theme,
  pontoAtivo,
  formatarCronometro,
  tempoSegundos,
  registrarPonto,
  solicitacoesPendentes,
  usuarioLogado,
  formatarHorario,
  historicoPonto,
  formatarData,
  formatarDataHora,
  calcularDuracao,
  editandoPontoId,
  setEditandoPontoId,
  novaSaidaDataInput,
  setNovaSaidaDataInput,
  novaSaidaInput,
  setNovaSaidaInput,
  novaSaidaJustificativa,
  setNovaSaidaJustificativa,
  userIsRespPonto,
  solicitarEdicaoSaida,
  emServico,
  isAdminOuDono,
  userIsAdmin,
  fecharPontoAdmin,
  alternarVisibilidadePonto,
  apagarPonto,
  buscarHistoricoPonto,
  listaFuncionarios = [],
}) {
  const [filtroNome, setFiltroNome] = useState("");
  const [filtroInicio, setFiltroInicio] = useState("");
  const [filtroFim, setFiltroFim] = useState("");

  const obterLabelSemana = (dataStr) => {
    if (!dataStr) return { key: "", label: "" };
    const date = new Date(`${dataStr}T12:00:00`);
    const day = date.getDay();
    const diffParaSegunda = day === 0 ? -6 : 1 - day;
    const segunda = new Date(date);
    segunda.setDate(date.getDate() + diffParaSegunda);
    const domingo = new Date(segunda);
    domingo.setDate(segunda.getDate() + 6);

    const fmt = (d) => {
      const dia = String(d.getDate()).padStart(2, "0");
      const mes = String(d.getMonth() + 1).padStart(2, "0");
      const ano = d.getFullYear();
      return `${dia}/${mes}/${ano}`;
    };

    return {
      key: segunda.toLocaleDateString("en-CA"),
      label: `Semana ${fmt(segunda)} a ${fmt(domingo)}`
    };
  };

  const resumosSemanais = React.useMemo(() => {
    const semanas = {};

    historicoPonto.forEach((reg) => {
      if (!reg.entrada || !reg.saida) return;
      const { key, label } = obterLabelSemana(reg.data);
      if (!key) return;

      const diffMin = (new Date(reg.saida) - new Date(reg.entrada)) / 60000;
      if (diffMin > 0) {
        if (!semanas[key]) {
          semanas[key] = { key, label, totalMinutos: 0 };
        }
        semanas[key].totalMinutos += diffMin;
      }
    });

    return Object.values(semanas).sort((a, b) => b.key.localeCompare(a.key));
  }, [historicoPonto]);

  const aplicarFiltros = () => {
    buscarHistoricoPonto({ nome: filtroNome, dataInicio: filtroInicio, dataFim: filtroFim });
  };

  const filtrarSemanaAtual = () => {
    const agora = new Date();
    const diaSemana = agora.getDay();
    const diffParaSegunda = diaSemana === 0 ? -6 : 1 - diaSemana;
    const segunda = new Date(agora);
    segunda.setDate(agora.getDate() + diffParaSegunda);
    const domingo = new Date(segunda);
    domingo.setDate(segunda.getDate() + 6);

    const inicio = segunda.toLocaleDateString("en-CA");
    const fim = domingo.toLocaleDateString("en-CA");
    
    setFiltroInicio(inicio);
    setFiltroFim(fim);
    buscarHistoricoPonto({ nome: filtroNome, dataInicio: inicio, dataFim: fim });
  };

  const limparFiltros = () => {
    setFiltroNome("");
    setFiltroInicio("");
    setFiltroFim("");
    buscarHistoricoPonto();
  };
  return (
    <div style={{ padding: "30px 40px", maxWidth: "1000px", margin: "0 auto" }}>
      <div style={{ ...styles.whiteCard, display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <div style={{ fontSize: "12px", color: theme.subtext }}>Status Atual</div>
          <div style={{ fontWeight: "700" }}>{pontoAtivo ? "🟢 Em serviço" : "⏸ Pausado"}</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "12px", color: theme.subtext }}>Tempo em andamento</div>
          <div style={{ fontSize: "28px", fontWeight: "800", color: "#22c55e" }}>{formatarCronometro(tempoSegundos)}</div>
        </div>
        <button
          onClick={registrarPonto}
          style={{
            background: pontoAtivo ? "#ff3b3b" : "#22c55e",
            color: "#fff",
            border: "none",
            padding: "8px 16px",
            borderRadius: "8px",
            fontWeight: "600",
            cursor: "pointer",
            transition: "0.2s",
          }}
        >
          {pontoAtivo ? "⏹ Encerrar Ponto" : "▶ Iniciar Ponto"}
        </button>
      </div>

      {solicitacoesPendentes.filter((s) => s.usuario_id === usuarioLogado.id).length > 0 && (
        <div style={{ ...styles.whiteCard, marginBottom: "20px", borderLeft: "3px solid #facc15" }}>
          <div style={{ ...styles.cardHeader, color: "#facc15" }}>
            <span style={{ ...styles.dot, background: "#facc15" }}></span> Minhas Solicitações Pendentes
          </div>
          {solicitacoesPendentes
            .filter((s) => s.usuario_id === usuarioLogado.id)
            .map((s) => (
              <div key={s.id} style={{ padding: "10px 0", borderBottom: `1px solid ${theme.border}`, fontSize: "13px" }}>
                <span style={{ color: theme.subtext }}>📅 {s.data_ponto}</span>
                {" · "}Nova saída: <b style={{ color: "#facc15" }}>{formatarHorario(s.nova_saida)}</b>
                {s.justificativa && <div style={{ fontSize: "11px", color: theme.subtext, marginTop: "2px" }}>Motivo: {s.justificativa}</div>}
                {" · "}<span style={{ background: "#facc1520", color: "#facc15", padding: "2px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: "700" }}>⏳ Aguardando aprovação</span>
              </div>
            ))}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "20px" }}>
        <div style={styles.whiteCard}>
          <div style={{ ...styles.cardHeader, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <span style={styles.dot}></span> {userIsRespPonto ? "Histórico Geral" : "Meu Histórico"}
            </div>
            {userIsRespPonto && (
              <button
                onClick={limparFiltros}
                style={{ background: "transparent", border: "none", color: "#60a5fa", cursor: "pointer", fontSize: "11px", fontWeight: "700" }}
              >
                🔄 Ver Todos
              </button>
            )}
          </div>

          {userIsRespPonto && (
            <div style={{ marginBottom: "16px", padding: "12px", background: theme.card2, borderRadius: "10px", border: `1px solid ${theme.border}` }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontSize: "10px", color: theme.subtext, textTransform: "uppercase", fontWeight: "700" }}>Filtrar Funcionário</span>
                  <input
                    style={{ ...styles.input, padding: "6px 10px", fontSize: "13px" }}
                    placeholder="Nome do funcionário..."
                    value={filtroNome}
                    onChange={(e) => setFiltroNome(e.target.value)}
                    list="lista-funcionarios-ponto"
                  />
                  <datalist id="lista-funcionarios-ponto">
                    {listaFuncionarios.map((f) => (
                      <option key={f.id} value={f.nome} />
                    ))}
                  </datalist>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontSize: "10px", color: theme.subtext, textTransform: "uppercase", fontWeight: "700" }}>Período</span>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <input type="date" value={filtroInicio} onChange={(e) => setFiltroInicio(e.target.value)} style={{ ...styles.input, padding: "6px 10px", fontSize: "12px" }} />
                    <input type="date" value={filtroFim} onChange={(e) => setFiltroFim(e.target.value)} style={{ ...styles.input, padding: "6px 10px", fontSize: "12px" }} />
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={aplicarFiltros}
                  style={{ background: "#2563eb", color: "#fff", border: "none", padding: "6px 12px", borderRadius: "7px", cursor: "pointer", fontSize: "12px", fontWeight: "700" }}
                >
                  🔍 Filtrar
                </button>
                <button
                  onClick={filtrarSemanaAtual}
                  style={{ background: "#16a34a", color: "#fff", border: "none", padding: "6px 12px", borderRadius: "7px", cursor: "pointer", fontSize: "12px", fontWeight: "700" }}
                >
                  📅 Esta Semana
                </button>
                <button
                  onClick={limparFiltros}
                  style={{ background: "#4b5563", color: "#fff", border: "none", padding: "6px 12px", borderRadius: "7px", cursor: "pointer", fontSize: "12px", fontWeight: "700" }}
                >
                  🧹 Limpar
                </button>
              </div>
            </div>
          )}
          
          {resumosSemanais.length > 0 && (
            <div style={{ marginBottom: "16px", padding: "12px", background: "rgba(255, 255, 255, 0.02)", borderRadius: "10px", border: `1px solid ${theme.border}44` }}>
              <div style={{ fontSize: "11px", fontWeight: "800", color: theme.subtext, textTransform: "uppercase", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                📊 Resumo de Horas por Semana
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {resumosSemanais.map((sem, idx) => {
                  const h = Math.floor(sem.totalMinutos / 60);
                  const m = Math.round(sem.totalMinutos % 60);
                  const totalStr = `${h}h ${String(m).padStart(2, "0")}min`;
                  return (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: theme.text }}>
                      <span>{sem.label}</span>
                      <b style={{ color: theme.accent }}>{totalStr} total</b>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {historicoPonto.map((reg) => (
            <div key={reg.id} style={{ padding: "10px 0", borderBottom: `1px solid ${theme.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <b>{reg.nome || "Não informado"}</b>
                  <div style={{ fontSize: "12px", color: theme.subtext }}>
                    {formatarData(reg.data)} · {formatarHorario(reg.entrada)} → {reg.saida ? formatarDataHora(reg.saida) : "..."}
                  </div>
                  {reg.verificado && (
                    <div style={{ fontSize: "11px", color: "#22c55e", marginTop: "2px", fontWeight: "600" }}>✅ Verificado pela gestão</div>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ color: theme.accent, fontWeight: "700" }}>{calcularDuracao(reg.entrada, reg.saida) || "—"}</span>
                  {editandoPontoId !== reg.id && (
                    <button
                      onClick={() => {
                        setEditandoPontoId(reg.id);
                        setNovaSaidaDataInput(reg.data);
                        setNovaSaidaInput(reg.saida ? new Date(reg.saida).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }) : "");
                        setNovaSaidaJustificativa("");
                      }}
                      style={{ background: "#1e40af20", color: "#60a5fa", border: "1px solid #1e40af", padding: "3px 9px", borderRadius: "6px", cursor: "pointer", fontSize: "11px", fontWeight: "700" }}
                    >
                      ✏️ Editar Saída
                    </button>
                  )}
                </div>
              </div>
              {editandoPontoId === reg.id && (
                <div style={{ marginTop: "10px", background: theme.card2, borderRadius: "10px", padding: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                  <span style={{ fontSize: "12px", color: theme.subtext, fontWeight: "600" }}>
                    ✏️ Editar saída — <span style={{ color: "#60a5fa" }}>Entrada: {formatarData(reg.data)} às {formatarHorario(reg.entrada)}</span>
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                      <span style={{ fontSize: "10px", color: theme.subtext, textTransform: "uppercase", fontWeight: "700" }}>Data da saída</span>
                      <input type="date" value={novaSaidaDataInput} onChange={(e) => setNovaSaidaDataInput(e.target.value)} style={{ ...styles.input, width: "145px", padding: "6px 10px", fontSize: "13px" }} />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                      <span style={{ fontSize: "10px", color: theme.subtext, textTransform: "uppercase", fontWeight: "700" }}>Hora da saída</span>
                      <input type="time" value={novaSaidaInput} onChange={(e) => setNovaSaidaInput(e.target.value)} style={{ ...styles.input, width: "120px", padding: "6px 10px", fontSize: "13px" }} />
                    </div>
                  </div>
                  {!userIsRespPonto && (
                    <div>
                      <span style={{ fontSize: "10px", color: "#facc15", textTransform: "uppercase", fontWeight: "700" }}>Motivo da solicitação *</span>
                      <textarea
                        style={{ ...styles.textarea, minHeight: "60px", marginTop: "4px", fontSize: "12px" }}
                        placeholder="Ex: Jogo crashou, cidade reiniciou, luz piscou, internet caiu..."
                        value={novaSaidaJustificativa}
                        onChange={(e) => setNovaSaidaJustificativa(e.target.value)}
                      />
                    </div>
                  )}
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      onClick={() => solicitarEdicaoSaida(reg)}
                      style={{ background: "#16a34a", color: "#fff", border: "none", padding: "6px 13px", borderRadius: "7px", cursor: "pointer", fontSize: "12px", fontWeight: "700" }}
                    >
                      {userIsRespPonto ? "✅ Salvar" : "📨 Solicitar"}
                    </button>
                    <button
                      onClick={() => {
                        setEditandoPontoId(null);
                        setNovaSaidaInput("");
                        setNovaSaidaDataInput("");
                        setNovaSaidaJustificativa("");
                      }}
                      style={{ background: "#7f1d1d", color: "#fff", border: "none", padding: "6px 13px", borderRadius: "7px", cursor: "pointer", fontSize: "12px", fontWeight: "700" }}
                    >
                      Cancelar
                    </button>
                  </div>
                  {!userIsRespPonto && <span style={{ fontSize: "11px", color: theme.subtext }}>* Requer aprovação</span>}
                  <span style={{ fontSize: "11px", color: "#facc15" }}>💡 Se o ponto foi aberto antes da meia-noite e fechado depois, altere a data para o dia seguinte.</span>
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={styles.whiteCard}>
          <div style={styles.cardHeader}>
            <span style={styles.dot}></span> Pontos em Aberto
          </div>
          {emServico.filter((p) => !p.oculto || isAdminOuDono(usuarioLogado?.role || "")).length > 0 ? (
            emServico
              .filter((p) => !p.oculto || isAdminOuDono(usuarioLogado?.role || ""))
              .map((p) => (
                <div key={p.id} style={{ background: "rgba(255,0,0,0.08)", padding: "10px", borderRadius: "10px", marginBottom: "10px", opacity: p.oculto ? 0.6 : 1 }}>
                  <b>
                    {p.nome} {p.oculto && <span style={{ fontSize: "11px", color: theme.accent }}>(Oculto)</span>}
                  </b>
                  <div style={{ fontSize: "12px", color: theme.subtext }}>Desde: {formatarHorario(p.entrada)}</div>
                  <div style={{ color: theme.accent, fontWeight: "700" }}>Em andamento</div>
                  {(userIsAdmin || userIsRespPonto || isAdminOuDono(usuarioLogado?.role || "")) && (
                    <div style={{ display: "flex", gap: "6px", marginTop: "8px", flexWrap: "wrap" }}>
                      <button
                        onClick={() => fecharPontoAdmin(p.id)}
                        style={{ background: "#16a34a", color: "#fff", border: "none", padding: "5px 10px", borderRadius: "7px", cursor: "pointer", fontSize: "12px", fontWeight: "700" }}
                      >
                        ✅ Fechar
                      </button>
                      {isAdminOuDono(usuarioLogado?.role || "") && (
                        <button
                          onClick={() => alternarVisibilidadePonto(p)}
                          style={{
                            background: p.oculto ? "#10b981" : "#6b7280",
                            color: "#fff",
                            border: "none",
                            padding: "5px 10px",
                            borderRadius: "7px",
                            cursor: "pointer",
                            fontSize: "12px",
                            fontWeight: "700",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {p.oculto ? "👁️ Desocultar" : "🙈 Ocultar"}
                        </button>
                      )}
                      {userIsAdmin && (
                        <button
                          onClick={() => apagarPonto(p.id)}
                          style={{ background: "#7f1d1d", color: "#fff", border: "none", padding: "5px 10px", borderRadius: "7px", cursor: "pointer", fontSize: "12px", fontWeight: "700" }}
                        >
                          🗑️ Apagar
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))
          ) : (
            <p style={{ color: "#888", textAlign: "center" }}>Ninguém em serviço</p>
          )}
        </div>
      </div>
    </div>
  );
}
