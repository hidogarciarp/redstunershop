import React, { useState, useMemo } from "react";

export default function ConciliacaoPage({ 
  theme, 
  styles, 
  registrosCidade, 
  registrosSite, 
  listaFuncionarios,
  atualizarPontoCidade,
  buscarPontoCidade,
  buscarHistoricoPonto,
  darEstrelaPonto,
  clonarPontoCidadeParaSite,
  apagarPonto
}) {
  const [carregando, setCarregando] = useState(false);
  const [selecionado, setSelecionado] = useState(null); // { id, nome }

  const fmtMin = (min) => {
    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);
    return `${h}h ${String(m).padStart(2, "0")}m`;
  };

  const getDiffMin = (isoEntrada, isoSaida) => {
    if (!isoEntrada || !isoSaida) return 0;
    return (new Date(isoSaida) - new Date(isoEntrada)) / 60000;
  };

  const formatarHora = (iso) => {
    if (!iso) return "--:--";
    return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
  };

  const formatarDataHora = (iso) => {
    if (!iso) return "--/-- --:--";
    return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
  };

  const formatarDataSimples = (iso) => {
    if (!iso) return "--/--";
    return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
  };

  const diagnosticarAnomalias = (logs) => {
    const anomalias = [];
    const ordenados = [...logs].sort((a, b) => new Date(a.entrada) - new Date(b.entrada));
    const saidasIguais = {};

    for (let i = 0; i < ordenados.length; i++) {
      const atual = ordenados[i];
      const prox = ordenados[i+1];
      if (prox && atual.saida && new Date(atual.saida) > new Date(prox.entrada)) {
        anomalias.push({ tipo: "OVERLAP", id: atual.id, msg: `Sobreposição: Termina ${formatarHora(atual.saida)} mas o próximo começa ${formatarHora(prox.entrada)}`, proxEntrada: prox.entrada });
      }
      if (atual.saida) {
        const key = atual.saida;
        saidasIguais[key] = (saidasIguais[key] || 0) + 1;
      }
      const dur = getDiffMin(atual.entrada, atual.saida);
      if (atual.saida && (dur < 0 || dur > 1440)) {
        anomalias.push({ 
          tipo: "INVALID", 
          id: atual.id, 
          msg: dur < 0 ? "Duração negativa" : "Duração suspeita (+24h)",
          proxEntrada: prox ? prox.entrada : null
        });
      }
    }
    Object.keys(saidasIguais).forEach(saida => {
      if (saidasIguais[saida] > 2) {
        anomalias.push({ tipo: "MASS_CLOSE", saida, msg: `${saidasIguais[saida]} pontos fecharam exatamente às ${formatarHora(saida)}` });
      }
    });
    return anomalias;
  };

  const dadosLista = useMemo(() => {
    const mapa = {};
    const mapaNomes = {};

    // Inicializa mapa com funcionários ativos
    listaFuncionarios.forEach(f => {
      const id = String(f.id);
      mapa[id] = { id, nome: f.nome, minSite: 0, minCidade: 0, discrepancias: 0, estrelas: 0, minEstrela: 0, anomalias: [], logsCidade: [] };
      if (f.nome) mapaNomes[f.nome.toLowerCase().trim()] = id;
    });

    // Somar registros do site (vincular por ID ou fallback por Nome)
    registrosSite.forEach(r => {
      let id = r.usuario_id ? String(r.usuario_id) : null;
      if (!id && r.nome) id = mapaNomes[r.nome.toLowerCase().trim()];

      if (id && mapa[id]) {
        const dur = (r.entrada && r.saida) ? getDiffMin(r.entrada, r.saida) : 0;
        mapa[id].minSite += dur;
        if (r.estrela) {
          mapa[id].estrelas++;
          mapa[id].minEstrela += dur;
        }
      }
    });

    // Somar registros da cidade (vincular por ID ou fallback por Nome)
    registrosCidade.forEach(r => {
      let id = r.usuario_id ? String(r.usuario_id) : null;
      if (!id && r.nome) id = mapaNomes[r.nome.toLowerCase().trim()];

      if (id && mapa[id]) {
        if (r.entrada && r.saida) mapa[id].minCidade += getDiffMin(r.entrada, r.saida);
        if (r.entrada && !r.saida) mapa[id].discrepancias++;
        mapa[id].logsCidade.push(r);
      }
    });

    // Calcular anomalias
    Object.keys(mapa).forEach(id => {
      mapa[id].anomalias = diagnosticarAnomalias(mapa[id].logsCidade);
    });

    return Object.values(mapa).sort((a, b) => {
      const anomDiff = b.anomalias.length - a.anomalias.length;
      if (anomDiff !== 0) return anomDiff;
      if (a.minEstrela !== b.minEstrela) return b.minEstrela - a.minEstrela;
      return Math.abs(b.minSite - b.minCidade) - Math.abs(a.minSite - a.minCidade);
    });
  }, [registrosSite, registrosCidade, listaFuncionarios]);

  const handleToggleEstrela = async (e, pontoId, valorAtual) => {
    e.stopPropagation();
    await darEstrelaPonto(pontoId, !valorAtual);
  };

  const handleSincronizar = async (pCidadeId, isoRef, manual = true, sugestaoProx = null, entradaRef = null) => {
    let novaSaida = isoRef;
    let valorSugerido = formatarDataHora(isoRef);

    if (!manual) {
      const dEntrada = entradaRef ? new Date(entradaRef) : null;
      
      if (sugestaoProx) {
        const dProx = new Date(sugestaoProx);
        const diffMin = dEntrada ? (dProx - dEntrada) / 60000 : 999;

        if (diffMin > 0 && diffMin < 60) {
          // Se a próxima entrada é em menos de 1h, sugerir 1min antes dela
          dProx.setMinutes(dProx.getMinutes() - 1);
        } else if (dEntrada) {
          // Caso contrário, sugerir 1h após a entrada
          dProx.setTime(dEntrada.getTime() + 60 * 60 * 1000);
        }
        
        valorSugerido = dProx.toLocaleString("pt-BR", { 
          day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" 
        });
      } else if (dEntrada) {
        // Sem próxima entrada, sugerir +1h
        const dSug = new Date(dEntrada.getTime() + 60 * 60 * 1000);
        valorSugerido = dSug.toLocaleString("pt-BR", { 
          day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" 
        });
      }

      const input = window.prompt("Digite o novo horário de saída (DD/MM HH:MM):", valorSugerido);
      if (!input) return;
      
      try {
        const [data, hora] = input.split(" ");
        const [dia, mes] = data.split("/");
        const [h, m] = hora.split(":");
        const d = new Date(isoRef);
        d.setMonth(parseInt(mes) - 1, parseInt(dia));
        d.setHours(parseInt(h), parseInt(m), 0);
        novaSaida = d.toISOString();
      } catch (e) {
        alert("Formato inválido! Use DD/MM HH:MM");
        return;
      }
    }

    setCarregando(true);
    const { error } = await atualizarPontoCidade(pCidadeId, { 
      saida: novaSaida,
      data_manual: new Date().toISOString(),
      obs_admin: manual ? "Sincronizado automaticamente via Conciliação" : "Editado manualmente via Conciliação"
    });
    if (!error && buscarPontoCidade) buscarPontoCidade();
    else if (error) alert("Erro: " + error.message);
    setCarregando(false);
  };

  const gerarLinhasPareadas = () => {
    if (!selecionado) return [];
    const selId = String(selecionado.id);
    const selNomeLower = selecionado.nome ? selecionado.nome.toLowerCase().trim() : "";

    const siteLogs = [...registrosSite].filter(r => String(r.usuario_id || r.id) === selId);
    const cidadeLogs = [...registrosCidade].filter(r => {
      const id = r.usuario_id ? String(r.usuario_id) : null;
      if (id === selId) return true;
      if (!id && r.nome && r.nome.toLowerCase().trim() === selNomeLower) return true;
      return false;
    });
    const linhas = [];
    const siteUsados = new Set();
    const cidadeUsados = new Set();
    const paresPossiveis = [];
    cidadeLogs.forEach(c => {
      siteLogs.forEach(s => {
        const diffMin = Math.abs(new Date(s.entrada) - new Date(c.entrada)) / 60000;
        if (diffMin < 150) paresPossiveis.push({ s, c, diffMin });
      });
    });
    paresPossiveis.sort((a, b) => a.diffMin - b.diffMin);
    paresPossiveis.forEach(par => {
      if (!siteUsados.has(par.s.id) && !cidadeUsados.has(par.c.id)) {
        linhas.push({ site: par.s, cidade: par.c });
        siteUsados.add(par.s.id);
        cidadeUsados.add(par.c.id);
      }
    });
    cidadeLogs.forEach(c => { if (!cidadeUsados.has(c.id)) linhas.push({ site: null, cidade: c }); });
    siteLogs.forEach(s => { if (!siteUsados.has(s.id)) linhas.push({ site: s, cidade: null }); });
    return linhas.sort((a, b) => (new Date(a.site?.entrada || a.cidade?.entrada) - new Date(b.site?.entrada || b.cidade?.entrada)));
  };

  const renderDetalhe = () => {
    if (!selecionado) return null;
    const selId = String(selecionado.id);
    const selNomeLower = selecionado.nome ? selecionado.nome.toLowerCase().trim() : "";

    const siteLogs = [...registrosSite].filter(r => {
      const id = r.usuario_id ? String(r.usuario_id) : null;
      if (id === selId) return true;
      if (!id && r.nome && r.nome.toLowerCase().trim() === selNomeLower) return true;
      return false;
    });

    const cidadeLogs = [...registrosCidade].filter(r => {
      const id = r.usuario_id ? String(r.usuario_id) : null;
      if (id === selId) return true;
      if (!id && r.nome && r.nome.toLowerCase().trim() === selNomeLower) return true;
      return false;
    });

    const linhas = gerarLinhasPareadas();
    const funcAnomalias = selecionado.anomalias;

    return (
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.92)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", backdropFilter: "blur(12px)" }}>
        <div style={{ background: theme.card, width: "100%", maxWidth: "1200px", height: "92vh", borderRadius: "28px", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)", border: `1px solid ${theme.border}` }}>
          
          <div style={{ padding: "20px 32px", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", background: theme.card2 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div style={{ background: theme.accent, color: "#fff", width: "42px", height: "42px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "12px", fontSize: "20px" }}>⚖️</div>
              <div>
                <h2 style={{ margin: 0, color: theme.text, fontSize: "20px", fontWeight: "800" }}>{selecionado.nome}</h2>
                <div style={{ color: theme.subtext, fontSize: "10px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "1.5px" }}>Diagnóstico de Pontos Lado a Lado</div>
              </div>
            </div>
            <button onClick={() => setSelecionado(null)} style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${theme.border}`, color: theme.text, padding: "8px 20px", borderRadius: "12px", cursor: "pointer", fontWeight: "800", fontSize: "11px" }}>FECHAR JANELA</button>
          </div>

          {funcAnomalias.length > 0 && (
            <div style={{ background: "#ef444415", padding: "12px 32px", borderBottom: "1px solid #ef444433", display: "flex", gap: "20px", overflowX: "auto" }}>
              <span style={{ color: "#ef4444", fontWeight: "900", fontSize: "11px", whiteSpace: "nowrap" }}>⚠️ ALERTAS DETECTADOS:</span>
              {funcAnomalias.map((an, i) => (
                <span key={i} style={{ color: theme.text, fontSize: "11px", background: "rgba(239,68,68,0.1)", padding: "2px 8px", borderRadius: "6px", whiteSpace: "nowrap" }}>
                  {an.msg}
                </span>
              ))}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", background: theme.card2, borderBottom: `1px solid ${theme.border}` }}>
            <div style={{ padding: "12px 24px", borderRight: `1px solid ${theme.border}` }}>
              <div style={{ color: "#3b82f6", fontWeight: "900", fontSize: "10px", textTransform: "uppercase", letterSpacing: "1px", textAlign: "center", marginBottom: "8px" }}>💻 REGISTROS NO SITE</div>
              {(() => {
                const totalMin = siteLogs.reduce((acc, r) => {
                  if (!r.entrada || !r.saida) return acc;
                  const d = (new Date(r.saida) - new Date(r.entrada)) / 60000;
                  return d > 0 ? acc + d : acc;
                }, 0);
                const totalH = Math.floor(totalMin / 60);
                const totalM = Math.round(totalMin % 60);
                const comSaida = siteLogs.filter(r => r.saida).length;
                const semSaida = siteLogs.length - comSaida;
                return (
                  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "20px", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "center" }}>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: "9px", color: theme.subtext, fontWeight: "700", textTransform: "uppercase" }}>Registros</div>
                        <div style={{ fontWeight: "800", fontSize: "14px", color: theme.text }}>{siteLogs.length}</div>
                      </div>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: "9px", color: theme.subtext, fontWeight: "700", textTransform: "uppercase" }}>Completos</div>
                        <div style={{ fontWeight: "800", fontSize: "14px", color: "#22c55e" }}>{comSaida}</div>
                      </div>
                      {semSaida > 0 && (
                        <div style={{ textAlign: "center" }}>
                          <div style={{ fontSize: "9px", color: theme.subtext, fontWeight: "700", textTransform: "uppercase" }}>Abertos</div>
                          <div style={{ fontWeight: "800", fontSize: "14px", color: "#facc15" }}>{semSaida}</div>
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.3)", borderRadius: "10px", padding: "7px 14px" }}>
                      <span style={{ fontSize: "16px" }}>⏱️</span>
                      <div>
                        <div style={{ fontSize: "9px", color: "#3b82f6", fontWeight: "700", textTransform: "uppercase" }}>Total de Horas</div>
                        <div style={{ fontWeight: "900", fontSize: "20px", color: "#3b82f6", lineHeight: 1 }}>{totalH}h {String(totalM).padStart(2, "0")}min</div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
            <div style={{ padding: "12px 24px" }}>
              <div style={{ color: "#22c55e", fontWeight: "900", fontSize: "10px", textTransform: "uppercase", letterSpacing: "1px", textAlign: "center", marginBottom: "8px" }}>🏢 LOGS NA CIDADE</div>
              {(() => {
                const totalMin = cidadeLogs.reduce((acc, r) => {
                  if (!r.entrada || !r.saida) return acc;
                  const d = (new Date(r.saida) - new Date(r.entrada)) / 60000;
                  return d > 0 ? acc + d : acc;
                }, 0);
                const totalH = Math.floor(totalMin / 60);
                const totalM = Math.round(totalMin % 60);
                const comSaida = cidadeLogs.filter(r => r.saida).length;
                const semSaida = cidadeLogs.length - comSaida;
                return (
                  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "20px", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "center" }}>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: "9px", color: theme.subtext, fontWeight: "700", textTransform: "uppercase" }}>Registros</div>
                        <div style={{ fontWeight: "800", fontSize: "14px", color: theme.text }}>{cidadeLogs.length}</div>
                      </div>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: "9px", color: theme.subtext, fontWeight: "700", textTransform: "uppercase" }}>Completos</div>
                        <div style={{ fontWeight: "800", fontSize: "14px", color: "#22c55e" }}>{comSaida}</div>
                      </div>
                      {semSaida > 0 && (
                        <div style={{ textAlign: "center" }}>
                          <div style={{ fontSize: "9px", color: theme.subtext, fontWeight: "700", textTransform: "uppercase" }}>Abertos</div>
                          <div style={{ fontWeight: "800", fontSize: "14px", color: "#facc15" }}>{semSaida}</div>
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: "10px", padding: "7px 14px" }}>
                      <span style={{ fontSize: "16px" }}>⏱️</span>
                      <div>
                        <div style={{ fontSize: "9px", color: "#22c55e", fontWeight: "700", textTransform: "uppercase" }}>Total de Horas</div>
                        <div style={{ fontWeight: "900", fontSize: "20px", color: "#22c55e", lineHeight: 1 }}>{totalH}h {String(totalM).padStart(2, "0")}min</div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "20px", background: "rgba(0,0,0,0.2)" }}>
            {linhas.map((row, idx) => {
              const { site: s, cidade: c } = row;
              const isManual = c && !!c.data_manual;
              const dataExibicao = formatarDataSimples(s?.entrada || c?.entrada);
              const anomalia = c ? funcAnomalias.find(an => an.id === c.id || (an.tipo === "MASS_CLOSE" && an.saida === c.saida)) : null;
              const temErroOverlap = anomalia?.tipo === "OVERLAP";
              const temErroMass = anomalia?.tipo === "MASS_CLOSE";

              return (
                <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "16px" }}>
                  {s ? (
                    <div style={{ padding: "16px", borderRadius: "18px", background: theme.card, border: `1px solid ${s.estrela ? "#facc15" : theme.border}`, boxShadow: s.estrela ? "0 0 15px rgba(250,204,21,0.15)" : "none", position: "relative" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}><span style={{ fontSize: "12px", fontWeight: "900", color: "#3b82f6" }}>{dataExibicao}</span>{s.estrela && <span style={{ fontSize: "14px" }}>⭐</span>}</div>
                        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                          <button onClick={(e) => handleToggleEstrela(e, s.id, s.estrela)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "16px", padding: 0, opacity: s.estrela ? 1 : 0.2, filter: s.estrela ? "none" : "grayscale(1)" }}>⭐</button>
                          <button 
                            onClick={async (e) => { 
                              e.stopPropagation(); 
                              await apagarPonto(s.id);
                              if (buscarHistoricoPonto) buscarHistoricoPonto();
                            }} 
                            style={{ background: "none", border: "none", cursor: "pointer", fontSize: "14px", padding: 0, opacity: 0.5 }}
                            title="Apagar este registro"
                          >🗑️</button>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div style={{ flex: 1 }}><div style={{ fontSize: "8px", color: theme.subtext }}>ENTRADA</div><div style={{ fontSize: "15px", fontWeight: "800", color: theme.text }}>{formatarHora(s.entrada)}</div></div>
                        <div style={{ opacity: 0.2 }}>➔</div>
                        <div style={{ flex: 1, textAlign: "right" }}><div style={{ fontSize: "8px", color: theme.subtext }}>SAÍDA</div><div style={{ fontSize: "15px", fontWeight: "800", color: s.saida ? theme.text : "#ef4444" }}>{s.saida ? formatarHora(s.saida) : "ABERTO"}</div></div>
                      </div>
                    </div>
                  ) : ( 
                    <div style={{ padding: "16px", borderRadius: "18px", border: `1px dashed ${theme.border}55`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "10px", minHeight: "100px" }}>
                      <span style={{ color: theme.subtext, fontSize: "11px", fontStyle: "italic" }}>Sem ponto no site</span>
                      {c && c.saida && (
                        <button 
                          onClick={() => clonarPontoCidadeParaSite(c)}
                          style={{ background: "#3b82f6", color: "#fff", border: "none", padding: "8px 14px", borderRadius: "10px", fontSize: "10px", fontWeight: "900", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
                        >
                          📥 CLONAR DA CIDADE
                        </button>
                      )}
                    </div>
                  )}

                  {c ? (
                    <div style={{ padding: "16px", borderRadius: "18px", background: theme.card, border: `1px solid ${temErroOverlap || temErroMass ? "#ef4444" : !c.saida ? "#facc15" : isManual ? "#3b82f6" : theme.border}`, position: "relative", boxShadow: temErroOverlap || temErroMass ? "0 0 15px rgba(239,68,68,0.1)" : "none" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                          <span style={{ fontSize: "12px", fontWeight: "900", color: "#22c55e" }}>{dataExibicao}</span>
                          {temErroOverlap && <span style={{ background: "#ef4444", color: "#fff", fontSize: "8px", fontWeight: "900", padding: "1px 5px", borderRadius: "4px" }}>⚠️ SOBREPOSIÇÃO</span>}
                          {temErroMass && <span style={{ background: "#f97316", color: "#fff", fontSize: "8px", fontWeight: "900", padding: "1px 5px", borderRadius: "4px" }}>⚠️ MASSA</span>}
                        </div>
                        {c.saida ? <span style={{ fontSize: "10px", color: theme.subtext }}>{fmtMin(getDiffMin(c.entrada, c.saida))}</span> : <span style={{ background: "#ef4444", color: "#fff", fontSize: "8px", fontWeight: "900", padding: "2px 5px", borderRadius: "4px" }}>ABERTO</span>}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div style={{ flex: 1 }}><div style={{ fontSize: "8px", color: theme.subtext }}>ENTRADA</div><div style={{ fontSize: "15px", fontWeight: "800", color: theme.text }}>{formatarHora(c.entrada)}</div></div>
                        <div style={{ opacity: 0.2 }}>➔</div>
                        <div style={{ flex: 1, textAlign: "right" }}>
                          <div style={{ fontSize: "8px", color: theme.subtext }}>SAÍDA</div>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "6px" }}>
                            <div style={{ fontSize: "15px", fontWeight: "800", color: c.saida ? theme.text : "#ef4444" }}>{c.saida ? formatarHora(c.saida) : "AUSENTE"}</div>
                            {(isManual || anomalia) && c.saida && (
                              <button 
                                onClick={() => handleSincronizar(c.id, c.saida, false, anomalia?.proxEntrada, c.entrada)} 
                                style={{ background: "none", border: "none", color: theme.subtext, cursor: "pointer", fontSize: "14px", padding: "2px" }}
                                title="Corrigir horário"
                              >✏️</button>
                            )}
                          </div>
                        </div>
                      </div>
                      {!c.saida && s && s.saida && (
                        <button disabled={carregando} onClick={() => handleSincronizar(c.id, s.saida, true)} style={{ marginTop: "12px", width: "100%", background: "#facc15", color: "#000", border: "none", padding: "8px", borderRadius: "10px", fontWeight: "900", fontSize: "10px", cursor: "pointer" }}>🔥 SINCRONIZAR SAÍDA</button>
                      )}
                    </div>
                  ) : ( <div style={{ padding: "16px", borderRadius: "18px", border: `1px dashed ${theme.border}55`, display: "flex", alignItems: "center", justifyContent: "center", color: theme.subtext, fontSize: "11px", fontStyle: "italic" }}>Sem log na cidade</div> )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: "24px" }}>
      {renderDetalhe()}
      <div style={{ marginBottom: "24px" }}>
        <h3 style={{ margin: 0, color: theme.text, fontSize: "22px", fontWeight: "800" }}>⚖️ Conciliação & Diagnóstico</h3>
        <p style={{ fontSize: "13px", color: theme.subtext, marginTop: "4px" }}>Análise de sobreposições, fechamentos em massa e discrepâncias de logs.</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: "20px" }}>
        {dadosLista.map(f => {
          const diff = Math.abs(f.minSite - f.minCidade);
          const temDivergencia = diff > 30 || f.discrepancias > 0 || f.anomalias.length > 0;
          const temAnomalia = f.anomalias.length > 0;
          return (
            <div key={f.id} onClick={() => setSelecionado(f)} style={{ ...styles.whiteCard, padding: "20px", cursor: "pointer", transition: "all 0.3s", borderLeft: `6px solid ${temAnomalia ? "#ef4444" : temDivergencia ? "#facc15" : "#22c55e"}`, background: theme.card2 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                <div><div style={{ fontWeight: "800", fontSize: "18px", color: theme.text }}>{f.nome}</div><div style={{ fontSize: "11px", color: theme.subtext, marginTop: "2px", fontWeight: "700" }}>ID: #{f.id}</div></div>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  {temAnomalia && <span style={{ background: "#ef4444", color: "#fff", padding: "4px 10px", borderRadius: "8px", fontSize: "10px", fontWeight: "900" }}>⚠️ {f.anomalias.length} ANOMALIAS</span>}
                  <div style={{ background: "rgba(250,204,21,0.15)", color: "#facc15", padding: "4px 10px", borderRadius: "8px", display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                    <span style={{ fontSize: "11px", fontWeight: "900" }}>⭐ {f.estrelas}</span>
                    <span style={{ fontSize: "9px", fontWeight: "800", opacity: 0.8 }}>{fmtMin(f.minEstrela)}</span>
                  </div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                <div style={{ padding: "10px", background: "rgba(59,130,246,0.05)", borderRadius: "12px", textAlign: "center" }}><div style={{ fontSize: "8px", color: "#3b82f6", fontWeight: "800" }}>SITE</div><div style={{ fontSize: "17px", fontWeight: "900", color: theme.text }}>{fmtMin(f.minSite)}</div></div>
                <div style={{ padding: "10px", background: "rgba(34,197,94,0.05)", borderRadius: "12px", textAlign: "center" }}><div style={{ fontSize: "8px", color: "#22c55e", fontWeight: "800" }}>CIDADE</div><div style={{ fontSize: "17px", fontWeight: "900", color: theme.text }}>{fmtMin(f.minCidade)}</div></div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "11px", color: theme.subtext }}>Diferença: <b style={{ color: temDivergencia ? "#facc15" : theme.text }}>{fmtMin(diff)}</b></span>
                <span style={{ fontSize: "10px", color: theme.accent, fontWeight: "900" }}>ANALISAR ➔</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
