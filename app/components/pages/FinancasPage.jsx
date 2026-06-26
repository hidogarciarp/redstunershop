import React, { useState, useEffect } from "react";
import { supabase } from "../../utils/supabaseClient";

export default function FinancasPage({
  styles,
  theme,
  userPodeFinancas,
  setPaginaAtual,
  buscarFinancas,
  buscarPagamentosSemanais,
  financasCarregando,
  pagamentosSemanais,
  formatarDataHora,
  confirmarPagamentoSemanal,
  financasFuncionarios,
  getLabelCargo,
  editandoFinancaId,
  editFinancaValor,
  setEditFinancaValor,
  editFinancaVencimento,
  setEditFinancaVencimento,
  editFinancaRenovacao,
  setEditFinancaRenovacao,
  salvarFinancaFuncionario,
  setEditandoFinancaId,
  formatarData,
  iniciarEdicaoFinanca,
  desbloquearFuncionario,
  isAdminOuDono,
  usuarioLogado,
  apagarPagamento,
  AppHeaderBar,
  AppModalNotificacao,
  registrarPagamentoManual,
  atualizarVencimentoManual,
  enviarNotificacao,
}) {
  const [funcSelecionado, setFuncSelecionado] = useState(null);
  const [linksTemporarios, setLinksTemporarios] = useState({}); // { [rowKey]: "link" }
  const [rowsEmEdicao, setRowsEmEdicao] = useState({}); // { [rowKey]: true }
  const [subAba, setSubAba] = useState("geral"); // geral, devedores
  const [modalContratacoesSemCobranca, setModalContratacoesSemCobranca] = useState(false);

  const calcularVencimentoPrimeiraCobranca = (dataAdmissao) => {
    if (!dataAdmissao) return "";
    const admDate = new Date(dataAdmissao + "T12:00:00");
    const day = admDate.getDay();
    const diffParaSegunda = day === 0 ? -6 : 1 - day;
    const segundaAdm = new Date(admDate);
    segundaAdm.setDate(admDate.getDate() + diffParaSegunda);

    const domingoSeguinte = new Date(segundaAdm);
    domingoSeguinte.setDate(segundaAdm.getDate() + 13);
    return domingoSeguinte.toLocaleDateString("en-CA"); // YYYY-MM-DD
  };

  const sugerirCobrancaPadraoInline = (func) => {
    setEditFinancaValor("100000");
    setEditFinancaRenovacao(true);
    if (func.data_admissao) {
      setEditFinancaVencimento(calcularVencimentoPrimeiraCobranca(func.data_admissao));
    } else {
      const hojeDate = new Date();
      const day = hojeDate.getDay();
      const diffParaDomingo = day === 0 ? 0 : 7 - day;
      const proximoDom = new Date(hojeDate);
      proximoDom.setDate(hojeDate.getDate() + diffParaDomingo);
      setEditFinancaVencimento(proximoDom.toLocaleDateString("en-CA"));
    }
  };

  const obterContratacoesSemCobranca = () => {
    return financasFuncionarios.filter(func => {
      const r = func.role?.split("|")[0].toLowerCase().trim();
      const ehFunc = r !== "user" && r !== "admin";
      const semCobranca = !func.data_vencimento || !func.valor_semanal || Number(func.valor_semanal) === 0;
      return ehFunc && semCobranca;
    });
  };

  const renderModalContratacoesSemCobranca = () => {
    if (!modalContratacoesSemCobranca) return null;
    const listaPendentes = obterContratacoesSemCobranca();

    return (
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.9)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(15px)", padding: "20px" }}>
        <div style={{ background: theme.card, width: "100%", maxWidth: "800px", borderRadius: "28px", overflow: "hidden", border: `1px solid ${theme.border}`, boxShadow: "0 40px 80px -15px rgba(0,0,0,0.8)", display: "flex", flexDirection: "column", maxHeight: "85vh" }}>
          
          <div style={{ padding: "24px 32px", background: theme.card2, borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2 style={{ margin: 0, color: theme.text, fontSize: "20px", fontWeight: "900", letterSpacing: "-0.5px" }}>🔍 Contratações Sem Cobrança</h2>
              <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: theme.subtext }}>Funcionários ativos que ainda não possuem cobrança configurada.</p>
            </div>
            <button onClick={() => setModalContratacoesSemCobranca(false)} style={{ background: "#dc2626", border: "none", color: "#fff", padding: "10px 24px", borderRadius: "14px", cursor: "pointer", fontWeight: "900", fontSize: "12px", boxShadow: "0 4px 12px rgba(220,38,38,0.3)" }}>FECHAR</button>
          </div>

          <div style={{ padding: "24px 32px", flex: 1, overflowY: "auto" }}>
            {listaPendentes.length === 0 ? (
              <div style={{ padding: "40px", textAlign: "center", color: theme.subtext }}>
                <div style={{ fontSize: "36px", marginBottom: "12px" }}>🎉</div>
                <div style={{ fontWeight: "700", color: "#22c55e", fontSize: "16px" }}>Tudo em dia!</div>
                <p style={{ fontSize: "13px", marginTop: "4px" }}>Nenhum funcionário ativo está sem cobrança cadastrada.</p>
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ textTransform: "uppercase", fontSize: "11px", color: theme.subtext, borderBottom: `1px solid ${theme.border}`, textAlign: "left" }}>
                    <th style={{ padding: "12px 10px" }}>Funcionário</th>
                    <th style={{ padding: "12px 10px" }}>Admissão</th>
                    <th style={{ padding: "12px 10px" }}>Vencimento Sugerido</th>
                    <th style={{ padding: "12px 10px", textAlign: "right" }}>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {listaPendentes.map(func => {
                    const vencSugerido = func.data_admissao ? calcularVencimentoPrimeiraCobranca(func.data_admissao) : null;
                    return (
                      <tr key={func.id} style={{ borderBottom: `1px solid ${theme.border}44` }}>
                        <td style={{ padding: "14px 10px" }}>
                          <div style={{ fontWeight: "700", color: theme.text }}>{func.nome}</div>
                          <div style={{ fontSize: "11px", color: theme.subtext }}>ID: {func.id} · {getLabelCargo(func.role)}</div>
                        </td>
                        <td style={{ padding: "14px 10px", color: theme.text }}>
                          {func.data_admissao ? formatarData(func.data_admissao) : <span style={{ color: "#ef4444", fontWeight: "700" }}>⚠️ Sem Data</span>}
                        </td>
                        <td style={{ padding: "14px 10px", color: theme.accent, fontWeight: "700" }}>
                          {vencSugerido ? formatarData(vencSugerido) : "—"}
                        </td>
                        <td style={{ padding: "14px 10px", textAlign: "right" }}>
                          <button
                            disabled={!func.data_admissao}
                            onClick={async () => {
                              if (!vencSugerido) return;
                              const { error } = await supabase
                                .from("usuarios")
                                .update({
                                  valor_semanal: 100000,
                                  data_vencimento: vencSugerido,
                                  renovacao_auto: true
                                })
                                .eq("id", func.id);
                              
                              if (error) {
                                alert("❌ Erro ao ativar cobrança: " + error.message);
                              } else {
                                alert(`✅ Cobrança padrão ativada para ${func.nome}!`);
                                buscarFinancas();
                              }
                            }}
                            style={{ 
                              background: func.data_admissao ? theme.accent : "rgba(255,255,255,0.05)",
                              color: func.data_admissao ? "#000" : theme.subtext,
                              border: "none", padding: "8px 14px", borderRadius: "8px", cursor: func.data_admissao ? "pointer" : "not-allowed", fontWeight: "800", fontSize: "11px"
                            }}
                          >
                            🚀 Cobrança Padrão
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (!userPodeFinancas()) {
    return (
      <div style={styles.dashContainer}>
        <style>{`@keyframes fadeLogin { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }`}</style>
        <AppModalNotificacao />
        <AppHeaderBar />
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
          <div style={styles.whiteCard}>
            <h2>🚫 Acesso Negado</h2>
            <p style={{ color: theme.subtext }}>Apenas Admin, Dono e Gerente Geral podem acessar o módulo de Finanças.</p>
            <button style={styles.btnPrimary} onClick={() => setPaginaAtual("dashboard")}>
              Voltar
            </button>
          </div>
        </div>
      </div>
    );
  }

  const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const pendentesConfirmacao = pagamentosSemanais.filter((p) => !p.confirmado);

  const handleUpdateLink = (rowKey, val) => {
    setLinksTemporarios(prev => ({ ...prev, [rowKey]: val }));
  };

  const handleSalvarPagamento = async (pagId, funcId, funcNome, linkExistente = "", rowKey, semanaLabel = "", valorSemanal = 0, dataDomingo = null) => {
    const link = linksTemporarios[rowKey] || linkExistente;
    if (!link || !link.trim()) {
      alert("❌ Por favor, cole o link do comprovante antes de salvar.");
      return;
    }

    if (pagId) {
      // Atualizar registro existente
      await confirmarPagamentoSemanal(pagId, funcId, funcNome, link, dataDomingo);
    } else {
      // Criar registro manual novo
      await registrarPagamentoManual(funcId, funcNome, valorSemanal, semanaLabel, link, dataDomingo);
    }

    setLinksTemporarios(prev => { const n = {...prev}; delete n[rowKey]; return n; });
    setRowsEmEdicao(prev => { const n = {...prev}; delete n[rowKey]; return n; });
  };

  const handleNotificarCobranca = async (funcId, funcNome, semanaLabel) => {
    const msgPadrao = `⚠️ **COBRANÇA FINANCEIRA**\nOlá ${funcNome.split(" ")[0]}, notamos que a **${semanaLabel}** ainda consta como pendente em seu dossiê. Por favor, realize o pagamento e envie o comprovante para regularizar seu acesso.`;
    const novaMsg = window.prompt(`Edite a mensagem de cobrança para ${funcNome}:`, msgPadrao);
    
    if (novaMsg !== null && novaMsg.trim() !== "") {
      const sucesso = await enviarNotificacao(funcId, novaMsg, false);
      if (sucesso) alert("✅ Cobrança enviada com sucesso!");
    }
  };

  // Gerar semanas para o dossiê (últimas 15 semanas)
  const gerarSemanasDossie = (func) => {
    const semanas = [];
    const hoje = new Date();
    const diaSemana = hoje.getDay();
    const diffParaSegunda = diaSemana === 0 ? -6 : 1 - diaSemana;
    
    const segundaBase = new Date(hoje);
    segundaBase.setDate(hoje.getDate() + diffParaSegunda);
    segundaBase.setHours(12, 0, 0, 0);

    const dataInauguracao = new Date("2026-04-06T12:00:00");

    for (let i = 0; i < 15; i++) { // Aumentei o range mas o 'break' vai limitar
      const s = new Date(segundaBase);
      s.setDate(segundaBase.getDate() - (i * 7));
      
      if (s < dataInauguracao) break; // Para aqui!
      
      const dom = new Date(s);
      dom.setDate(s.getDate() + 6);

      // Filtrar por data de admissão (semana da admissão não cobra)
      if (func?.data_admissao) {
        const adm = new Date(func.data_admissao + "T12:00:00");
        const diaS = adm.getDay();
        const diffS = diaS === 0 ? -6 : 1 - diaS;
        const segAdm = new Date(adm); segAdm.setDate(adm.getDate() + diffS);
        const domAdm = new Date(segAdm); domAdm.setDate(segAdm.getDate() + 6);
        
        if (dom <= domAdm) break; // Se chegamos na semana de admissão ou anterior, para de gerar
      }
      
      const fD = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = `Semana de ${fD(s)} até ${fD(dom)}`;
      semanas.push({ label, inicio: s.toISOString().split("T")[0], fim: dom.toISOString().split("T")[0] });
    }
    return semanas;
  };

  const renderModalHistorico = () => {
    if (!funcSelecionado) return null;
    const semanas = gerarSemanasDossie(funcSelecionado);
    const historicoFunc = pagamentosSemanais.filter(p => p.funcionario_id === funcSelecionado.id);

    return (
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.95)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(15px)", padding: "20px" }}>
        <div style={{ background: theme.card, width: "100%", maxWidth: "1100px", borderRadius: "28px", overflow: "hidden", border: `1px solid ${theme.border}`, boxShadow: "0 40px 80px -15px rgba(0,0,0,0.8)" }}>
          
          <div style={{ padding: "28px 40px", background: theme.card2, borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "30px" }}>
              <div>
                <h2 style={{ margin: 0, color: theme.text, fontSize: "22px", fontWeight: "900", letterSpacing: "-0.5px" }}>Calendário de Pagamentos</h2>
                <div style={{ color: theme.accent, fontWeight: "700", fontSize: "14px", marginTop: "4px" }}>
                  {funcSelecionado.nome} (ID: {funcSelecionado.id})
                  {funcSelecionado.data_admissao && (
                    <span style={{ marginLeft: "15px", color: theme.subtext, fontSize: "12px", fontWeight: "400" }}>
                      📅 Admissão: <b style={{ color: "#fff" }}>{formatarData(funcSelecionado.data_admissao)}</b>
                    </span>
                  )}
                </div>
              </div>
              <button 
                onClick={() => {
                  const ultimaSemanaPaga = semanas.find(sem => {
                    return pagamentosSemanais.some(p => p.funcionario_id === funcSelecionado.id && p.confirmado && p.observacao?.includes(sem.label));
                  });
                  if (ultimaSemanaPaga) {
                    const dataV = new Date(ultimaSemanaPaga.fim + "T12:00:00");
                    dataV.setDate(dataV.getDate() + 7);
                    const novaDataStr = dataV.toLocaleDateString("en-CA");

                    if (window.confirm(`Deseja sincronizar o vencimento do funcionário com a última semana paga (${ultimaSemanaPaga.label})?\nAo pagar até dia ${ultimaSemanaPaga.fim}, o novo vencimento será ${novaDataStr}.`)) {
                      atualizarVencimentoManual(funcSelecionado.id, novaDataStr);
                    }
                  } else {
                    alert("⚠️ Nenhuma semana paga encontrada no dossiê atual para sincronizar.");
                  }
                }}
                style={{ background: "rgba(34,197,94,0.1)", border: "1px solid #22c55e", color: "#22c55e", padding: "10px 20px", borderRadius: "14px", cursor: "pointer", fontWeight: "800", fontSize: "12px", display: "flex", alignItems: "center", gap: "8px" }}
              >
                🔄 SINCRONIZAR VENCIMENTO
              </button>
            </div>
            <button onClick={() => setFuncSelecionado(null)} style={{ background: "#dc2626", border: "none", color: "#fff", padding: "10px 24px", borderRadius: "14px", cursor: "pointer", fontWeight: "900", fontSize: "12px", boxShadow: "0 4px 12px rgba(220,38,38,0.3)" }}>FECHAR DOSSIÊ</button>
          </div>

          <div style={{ padding: "30px 40px", maxHeight: "75vh", overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 10px" }}>
              <thead>
                <tr style={{ textAlign: "left" }}>
                  <th style={{ padding: "10px 15px", color: theme.subtext, fontSize: "11px", textTransform: "uppercase", letterSpacing: "1px" }}>Período Semanal</th>
                  <th style={{ padding: "10px 15px", color: theme.subtext, fontSize: "11px", textTransform: "uppercase", letterSpacing: "1px" }}>Valor</th>
                  <th style={{ padding: "10px 15px", color: theme.subtext, fontSize: "11px", textTransform: "uppercase", letterSpacing: "1px" }}>Comprovante Discord</th>
                  <th style={{ padding: "10px 15px", color: theme.subtext, fontSize: "11px", textTransform: "uppercase", letterSpacing: "1px", textAlign: "center" }}>Status / Auditoria</th>
                </tr>
              </thead>
              <tbody>
                {semanas.map((sem, idx) => {
                  // Busca rigorosa: 
                  // 1. Primeiro tenta achar pelo label exato na observação
                  // 2. Se não achar nada com label, tenta pela data, mas APENAS se o registro não tiver outro label de semana
                  const pag = historicoFunc.find(p => p.observacao?.includes(sem.label)) || 
                              historicoFunc.find(p => {
                                const temOutroLabel = semanas.some(s => s.label !== sem.label && p.observacao?.includes(s.label));
                                if (temOutroLabel) return false;
                                return p.criado_em >= sem.inicio && p.criado_em <= sem.fim + "T23:59:59";
                              });
                  
                  const rowKey = `row-${funcSelecionado.id}-${idx}`;
                  const isConfirmado = pag?.confirmado;
                  const emEdicao = rowsEmEdicao[rowKey] || (!isConfirmado && pag);
                  const linkAtual = linksTemporarios[rowKey] || pag?.comprovante_link || "";
                  const valorDaSemana = pag?.valor || funcSelecionado.valor_semanal || 0;

                  return (
                    <tr key={idx} style={{ background: isConfirmado && !rowsEmEdicao[rowKey] ? "rgba(34,197,94,0.04)" : "rgba(255,255,255,0.02)", transition: "all 0.2s" }}>
                      <td style={{ padding: "18px 20px", borderTopLeftRadius: "16px", borderBottomLeftRadius: "16px", border: `1px solid ${theme.border}`, borderRight: "none" }}>
                        <div style={{ color: theme.text, fontWeight: "700", fontSize: "14px" }}>{sem.label}</div>
                        <div style={{ fontSize: "10px", color: theme.subtext, marginTop: "4px" }}>{idx === 0 ? "📍 SEMANA ATUAL" : "🕒 SEMANA PASSADA"}</div>
                      </td>
                      
                      <td style={{ padding: "18px 20px", border: `1px solid ${theme.border}`, borderLeft: "none", borderRight: "none", color: "#facc15", fontWeight: "900", fontSize: "15px" }}>
                        R$ {Number(valorDaSemana).toLocaleString("pt-BR")}
                      </td>

                      <td style={{ padding: "18px 20px", border: `1px solid ${theme.border}`, borderLeft: "none", borderRight: "none" }}>
                        {!isConfirmado || emEdicao ? (
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <input 
                              placeholder="Cole o link do Discord..."
                              value={linkAtual}
                              onChange={(e) => handleUpdateLink(rowKey, e.target.value)}
                              style={{ ...styles.input, flex: 1, padding: "10px 14px", fontSize: "12px", margin: 0, borderRadius: "10px" }}
                            />
                            {linkAtual && (
                              <a href={linkAtual} target="_blank" rel="noreferrer" style={{ background: theme.accent, color: "#000", padding: "10px", borderRadius: "10px", display: "flex", alignItems: "center" }} title="Ver imagem">
                                🔗
                              </a>
                            )}
                          </div>
                        ) : (
                          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                            <a href={pag.comprovante_link} target="_blank" rel="noreferrer" style={{ color: theme.accent, fontSize: "12px", fontWeight: "800", textDecoration: "none", borderBottom: `1px solid ${theme.accent}` }}>
                              📎 VER COMPROVANTE
                            </a>
                          </div>
                        )}
                      </td>

                      <td style={{ padding: "18px 20px", borderTopRightRadius: "16px", borderBottomRightRadius: "16px", border: `1px solid ${theme.border}`, borderLeft: "none", textAlign: "center" }}>
                        {(!isConfirmado || emEdicao) ? (
                          <div style={{ display: "flex", gap: "8px" }}>
                            <button 
                              onClick={() => handleSalvarPagamento(pag?.id, funcSelecionado.id, funcSelecionado.nome, pag?.comprovante_link, rowKey, sem.label, valorDaSemana, sem.fim)}
                              style={{ background: "#22c55e", color: "#fff", border: "none", padding: "10px 20px", borderRadius: "12px", fontWeight: "900", cursor: "pointer", fontSize: "11px", flex: 1 }}
                            >
                              💾 SALVAR
                            </button>
                            {!isConfirmado && (
                              <button 
                                onClick={() => handleNotificarCobranca(funcSelecionado.id, funcSelecionado.nome, sem.label)}
                                style={{ background: "rgba(249,115,22,0.1)", border: "1px solid #f97316", color: "#f97316", padding: "10px", borderRadius: "12px", fontWeight: "900", cursor: "pointer", fontSize: "11px" }}
                                title="Notificar funcionário sobre esta pendência"
                              >
                                🔔 NOTIFICAR
                              </button>
                            )}
                          </div>
                        ) : (
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                            <span style={{ color: "#22c55e", fontWeight: "900", fontSize: "14px" }}>✅ OK</span>
                            <button 
                              onClick={() => setRowsEmEdicao(prev => ({...prev, [rowKey]: true}))}
                              style={{ background: "none", border: `1px solid ${theme.border}`, color: theme.subtext, padding: "6px 12px", borderRadius: "8px", fontSize: "10px", cursor: "pointer", fontWeight: "700" }}
                            >
                              ✏️ EDITAR
                            </button>
                            <button 
                              onClick={() => apagarPagamento(pag.id)}
                              style={{ background: "rgba(220,38,38,0.1)", border: "1px solid #dc2626", color: "#dc2626", padding: "6px 10px", borderRadius: "8px", fontSize: "10px", cursor: "pointer", fontWeight: "700" }}
                              title="Apagar registro (marcar como em aberto)"
                            >
                              🗑️
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderResumoAtrasos = () => {
    const devedoresMap = {};

    financasFuncionarios.forEach(func => {
      const r = func.role?.split("|")[0].toLowerCase().trim();
      if (r === "user" || r === "admin") return;

      const semanasEsperadas = gerarSemanasDossie(func);
      const historicoFunc = pagamentosSemanais.filter(p => p.funcionario_id === func.id);

      const pendencias = [];
      let totalDevido = 0;

      semanasEsperadas.forEach((sem, idx) => {
        if (idx === 0) return; // Ignora a semana atual do relatório de atrasos

        const pag = historicoFunc.find(p => p.observacao?.includes(sem.label)) || 
                    historicoFunc.find(p => {
                      const temOutroLabel = semanasEsperadas.some(s => s.label !== sem.label && p.observacao?.includes(s.label));
                      if (temOutroLabel) return false;
                      return p.criado_em >= sem.inicio && p.criado_em <= sem.fim + "T23:59:59";
                    });

        if (!pag || !pag.confirmado) {
          pendencias.push({
            label: sem.label,
            valor: pag?.valor || func.valor_semanal || 0,
            comprovante: pag?.comprovante_link || null
          });
          totalDevido += Number(pag?.valor || func.valor_semanal || 0);
        }
      });

      if (pendencias.length > 0) {
        devedoresMap[func.id] = {
          id: func.id,
          nome: func.nome,
          total: totalDevido,
          semanas: pendencias
        };
      }
    });

    const listaDevedores = Object.values(devedoresMap).sort((a, b) => b.total - a.total);

    return (
      <div style={{ ...styles.whiteCard, animation: "fadeLogin 0.5s ease" }}>
        <div style={styles.cardHeader}>
          <span style={{ ...styles.dot, background: "#ef4444" }}></span> <span style={{ color: "#ef4444" }}>Relatório de Funcionários com Débitos Pendentes</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ background: theme.card2, textAlign: "left" }}>
                <th style={{ padding: "12px", borderBottom: `1px solid ${theme.border}`, fontSize: "11px", textTransform: "uppercase", fontWeight: "700", color: theme.subtext }}>Funcionário</th>
                <th style={{ padding: "12px", borderBottom: `1px solid ${theme.border}`, fontSize: "11px", textTransform: "uppercase", fontWeight: "700", color: theme.subtext }}>Qtd Pendente</th>
                <th style={{ padding: "12px", borderBottom: `1px solid ${theme.border}`, fontSize: "11px", textTransform: "uppercase", fontWeight: "700", color: theme.subtext }}>Total Devido</th>
                <th style={{ padding: "12px", borderBottom: `1px solid ${theme.border}`, fontSize: "11px", textTransform: "uppercase", fontWeight: "700", color: theme.subtext }}>Detalhes das Pendências</th>
                <th style={{ padding: "12px", borderBottom: `1px solid ${theme.border}`, fontSize: "11px", textTransform: "uppercase", fontWeight: "700", color: theme.subtext }}>Ação</th>
              </tr>
            </thead>
            <tbody>
              {listaDevedores.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ padding: "40px", textAlign: "center", color: theme.subtext }}>
                    <div style={{ fontSize: "24px", marginBottom: "10px" }}>🚀</div>
                    <div style={{ fontWeight: "700", color: "#22c55e" }}>Tudo em dia!</div>
                    <div style={{ fontSize: "12px" }}>Nenhum funcionário possui pendências financeiras no momento.</div>
                  </td>
                </tr>
              ) : (
                listaDevedores.map(dev => (
                  <tr key={dev.id} style={{ borderBottom: `1px solid ${theme.border}`, transition: "background 0.2s" }}>
                    <td style={{ padding: "15px 12px", color: theme.text }}>
                      <div style={{ fontWeight: "700" }}>{dev.nome}</div>
                      <div style={{ fontSize: "10px", color: theme.subtext }}>ID: {dev.id}</div>
                    </td>
                    <td style={{ padding: "15px 12px", color: theme.text }}>
                      <span style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", padding: "4px 10px", borderRadius: "12px", fontWeight: "700" }}>
                        {dev.semanas.length} {dev.semanas.length === 1 ? "semana" : "semanas"}
                      </span>
                    </td>
                    <td style={{ padding: "15px 12px", color: "#ef4444", fontWeight: "900", fontSize: "15px" }}>
                      R$ {dev.total.toLocaleString("pt-BR")}
                    </td>
                    <td style={{ padding: "15px 12px", fontSize: "11px", color: theme.subtext, maxWidth: "350px" }}>
                      {dev.semanas.map((s, idx) => (
                        <div key={idx} style={{ marginBottom: "3px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          • {(s.label || "").replace("Cobrança automática - ", "")} {s.comprovante && <span style={{ color: "#facc15" }}>(Comprovante enviado)</span>}
                        </div>
                      ))}
                    </td>
                    <td style={{ padding: "15px 12px" }}>
                      <button 
                        onClick={() => {
                          const f = financasFuncionarios.find(x => x.id === dev.id);
                          if (f) setFuncSelecionado(f);
                          else alert("⚠️ Funcionário não encontrado na lista atual.");
                        }}
                        style={{ background: theme.accent, color: "#000", border: "none", padding: "8px 16px", borderRadius: "8px", cursor: "pointer", fontWeight: "900", fontSize: "11px" }}
                      >
                        📜 VER DOSSIÊ
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div style={styles.dashContainer}>
      <style>{`@keyframes fadeLogin { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      <AppModalNotificacao />
      <AppHeaderBar />
      {renderModalHistorico()}
      {renderModalContratacoesSemCobranca()}

      <div style={{ padding: "30px 40px", maxWidth: "1300px", margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <h2 style={{ color: theme.text, margin: 0, fontWeight: "800" }}>💰 Módulo Financeiro — Cobranças Semanais</h2>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={() => setModalContratacoesSemCobranca(true)}
              style={{ ...styles.btnPrimary, width: "auto", marginTop: 0, padding: "9px 18px", fontSize: "12px", background: "rgba(245,158,11,0.1)", border: "1px solid #f59e0b", color: "#f59e0b" }}
            >
              🔍 Verificar Contratações
            </button>
            <button
              onClick={() => {
                buscarFinancas();
                buscarPagamentosSemanais();
              }}
              style={{ ...styles.btnPrimary, width: "auto", marginTop: 0, padding: "9px 18px", fontSize: "12px" }}
            >
              🔄 Atualizar
            </button>
          </div>
        </div>

        {/* SUB-ABAS DE NAVEGAÇÃO */}
        <div style={{ display: "flex", gap: "10px", marginBottom: "25px", background: "rgba(0,0,0,0.2)", padding: "6px", borderRadius: "14px", alignSelf: "flex-start", width: "fit-content" }}>
          <button 
            onClick={() => setSubAba("geral")}
            style={{ 
              background: subAba === "geral" ? theme.accent : "transparent", 
              color: subAba === "geral" ? "#000" : theme.subtext,
              border: "none", padding: "10px 24px", borderRadius: "10px", cursor: "pointer", fontWeight: "800", fontSize: "12px", transition: "all 0.2s"
            }}
          >
            📊 Visão Geral
          </button>
          <button 
            onClick={() => setSubAba("devedores")}
            style={{ 
              background: subAba === "devedores" ? "#ef4444" : "transparent", 
              color: subAba === "devedores" ? "#fff" : theme.subtext,
              border: "none", padding: "10px 24px", borderRadius: "10px", cursor: "pointer", fontWeight: "800", fontSize: "12px", transition: "all 0.2s"
            }}
          >
            ⚠️ Resumo de Atrasos
          </button>
        </div>

        {subAba === "geral" ? (
          <>
            {financasCarregando && <div style={{ textAlign: "center", padding: "20px", color: theme.subtext }}>⏳ Verificando vencimentos...</div>}




        {/* TABELA DE FUNCIONÁRIOS */}
        <div style={styles.whiteCard}>
          <div style={styles.cardHeader}>
            <span style={styles.dot}></span> Controle de Cobranças por Funcionário
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ background: theme.card2, textAlign: "left" }}>
                  <th style={{ padding: "10px 12px", borderBottom: `1px solid ${theme.border}`, fontSize: "11px", textTransform: "uppercase", fontWeight: "700", color: theme.subtext }}>Funcionário</th>
                  <th style={{ padding: "10px 12px", borderBottom: `1px solid ${theme.border}`, fontSize: "11px", textTransform: "uppercase", fontWeight: "700", color: theme.subtext }}>Cargo</th>
                  <th style={{ padding: "10px 12px", borderBottom: `1px solid ${theme.border}`, fontSize: "11px", textTransform: "uppercase", fontWeight: "700", color: theme.subtext }}>Valor Semanal</th>
                  <th style={{ padding: "10px 12px", borderBottom: `1px solid ${theme.border}`, fontSize: "11px", textTransform: "uppercase", fontWeight: "700", color: theme.subtext }}>Vencimento</th>
                  <th style={{ padding: "10px 12px", borderBottom: `1px solid ${theme.border}`, fontSize: "11px", textTransform: "uppercase", fontWeight: "700", color: theme.subtext }}>Renovação Auto</th>
                  <th style={{ padding: "10px 12px", borderBottom: `1px solid ${theme.border}`, fontSize: "11px", textTransform: "uppercase", fontWeight: "700", color: theme.subtext }}>Status</th>
                  <th style={{ padding: "10px 12px", borderBottom: `1px solid ${theme.border}`, fontSize: "11px", textTransform: "uppercase", fontWeight: "700", color: theme.subtext }}>Crédito 24h</th>
                  <th style={{ padding: "10px 12px", borderBottom: `1px solid ${theme.border}`, fontSize: "11px", textTransform: "uppercase", fontWeight: "700", color: theme.subtext }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {[...financasFuncionarios]
                  .filter((f) => {
                    const r = f.role?.split("|")[0].toLowerCase().trim();
                    return r !== "user" && r !== "admin";
                  })
                  .sort((a, b) => (a.nome || "").localeCompare(b.nome || ""))
                  .map((func) => {
                  const vencido = func.data_vencimento && func.data_vencimento < hoje;
                  const isIsento = !func.valor_semanal || func.valor_semanal === 0;
                  const statusColor = func.bloqueado_financeiro ? "#ef4444" : isIsento ? theme.subtext : vencido ? "#f97316" : "#22c55e";
                  const statusLabel = func.bloqueado_financeiro ? "🔒 Bloqueado" : isIsento ? "⚪ Isento" : vencido ? "⚠️ Vencido" : "✅ Em dia";
                  const estandoEditando = editandoFinancaId === func.id;

                  return (
                    <tr key={func.id} style={{ borderBottom: `1px solid ${theme.border}`, background: func.bloqueado_financeiro ? "#ef444408" : "transparent" }}>
                      <td style={{ padding: "10px 12px", fontWeight: "600", color: theme.text }}>
                        <button onClick={() => setFuncSelecionado(func)} style={{ background: "none", border: "none", color: theme.text, fontWeight: "600", cursor: "pointer", padding: 0, textAlign: "left" }}>{func.nome}</button>
                        <div style={{ fontSize: "11px", color: theme.subtext }}>ID: {func.id}</div>
                      </td>
                      <td style={{ padding: "10px 12px", fontSize: "12px", color: "#f97316" }}>{getLabelCargo(func.role)}</td>

                      {estandoEditando ? (
                        <>
                          <td style={{ padding: "10px 12px" }}>
                            <input
                              style={{ ...styles.input, width: "120px", padding: "6px 10px", fontSize: "12px" }}
                              placeholder="Ex: 100000"
                              value={editFinancaValor}
                              onChange={(e) => setEditFinancaValor(e.target.value.replace(/\D/g, ""))}
                            />
                          </td>
                          <td style={{ padding: "10px 12px" }}>
                            <input type="date" style={{ ...styles.input, width: "150px", padding: "6px 10px", fontSize: "12px" }} value={editFinancaVencimento} onChange={(e) => setEditFinancaVencimento(e.target.value)} />
                          </td>
                          <td style={{ padding: "10px 12px" }}>
                            <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "12px", color: theme.text }}>
                              <input type="checkbox" checked={editFinancaRenovacao} onChange={(e) => setEditFinancaRenovacao(e.target.checked)} />
                              +7 dias
                            </label>
                          </td>
                          <td colSpan={3} style={{ padding: "10px 12px" }}>
                            <div style={{ display: "flex", gap: "6px" }}>
                              <button onClick={() => salvarFinancaFuncionario(func.id)} style={{ background: "#16a34a", color: "#fff", border: "none", padding: "6px 14px", borderRadius: "7px", cursor: "pointer", fontSize: "12px", fontWeight: "700" }}>✅ Salvar</button>
                              <button 
                                onClick={() => sugerirCobrancaPadraoInline(func)} 
                                style={{ background: "rgba(250,204,21,0.1)", border: "1px solid #eab308", color: "#facc15", padding: "6px 14px", borderRadius: "7px", cursor: "pointer", fontSize: "12px", fontWeight: "700" }}
                              >
                                💡 Sugerir Padrão
                              </button>
                              <button onClick={() => setEditandoFinancaId(null)} style={{ background: "#444", color: "#fff", border: "none", padding: "6px 14px", borderRadius: "7px", cursor: "pointer", fontSize: "12px", fontWeight: "700" }}>✕ Cancelar</button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td style={{ padding: "10px 12px", color: "#facc15", fontWeight: "700" }}>
                            {func.valor_semanal > 0 ? `R$ ${Number(func.valor_semanal).toLocaleString("pt-BR")}` : <span style={{ color: theme.border }}>—</span>}
                          </td>
                          <td style={{ padding: "10px 12px", color: vencido ? "#f97316" : theme.text, fontWeight: vencido ? "700" : "400" }}>
                            {func.data_vencimento ? formatarData(func.data_vencimento) : <span style={{ color: theme.border }}>—</span>}
                          </td>
                          <td style={{ padding: "10px 12px" }}>
                            {func.renovacao_auto ? (
                              <span style={{ background: "#14532d30", color: "#22c55e", padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: "700" }}>✅ Ativado</span>
                            ) : (
                              <span style={{ background: "#1a1a1a", color: theme.subtext, padding: "3px 10px", borderRadius: "20px", fontSize: "11px" }}>Desativado</span>
                            )}
                          </td>
                          <td style={{ padding: "10px 12px" }}>
                            <span style={{ background: `${statusColor}20`, color: statusColor, padding: "4px 12px", borderRadius: "20px", fontSize: "11px", fontWeight: "700", whiteSpace: "nowrap" }}>{statusLabel}</span>
                          </td>
                          <td style={{ padding: "10px 12px" }}>
                            {func.credito_24h_disponivel ? (
                              <span style={{ background: "#78350f20", color: "#fbbf24", padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: "700" }}>⚡ Disponível</span>
                            ) : (
                              <span style={{ background: "#1a1a1a", color: theme.subtext, padding: "3px 10px", borderRadius: "20px", fontSize: "11px" }}>Usado</span>
                            )}
                          </td>
                          <td style={{ padding: "10px 12px" }}>
                            <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
                              <button
                                onClick={() => iniciarEdicaoFinanca(func)}
                                style={{ background: "#1e40af20", color: "#60a5fa", border: "1px solid #1e40af", padding: "5px 10px", borderRadius: "7px", cursor: "pointer", fontSize: "11px", fontWeight: "700", whiteSpace: "nowrap" }}
                              >
                                ✏️ Config
                              </button>
                              <button
                                onClick={() => setFuncSelecionado(func)}
                                style={{ background: "#4ade8020", color: "#4ade80", border: "1px solid #4ade8033", padding: "5px 10px", borderRadius: "7px", cursor: "pointer", fontSize: "11px", fontWeight: "700", whiteSpace: "nowrap" }}
                              >
                                📜 Dossiê
                              </button>
                              {func.bloqueado_financeiro && (
                                <button
                                  onClick={() => desbloquearFuncionario(func.id, func.nome)}
                                  style={{ background: "#16a34a20", color: "#22c55e", border: "1px solid #16a34a", padding: "5px 10px", borderRadius: "7px", cursor: "pointer", fontSize: "11px", fontWeight: "700", whiteSpace: "nowrap" }}
                                >
                                  🔓 Forçar Liberar
                                </button>
                              )}
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        
        {/* AGUARDANDO CONFIRMAÇÃO (Comprovantes enviados) */}
        {pagamentosSemanais.filter((p) => !p.confirmado && p.comprovante_link).length > 0 && (
          <div style={{ ...styles.whiteCard, marginTop: "24px", border: "1px solid #facc1550" }}>
            <div style={styles.cardHeader}>
              <span style={{ ...styles.dot, background: "#facc15" }}></span> <span style={{ color: "#facc15" }}>Aguardando Confirmação (Comprovantes Enviados)</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ background: theme.card2, textAlign: "left" }}>
                    <th style={{ padding: "10px 12px", borderBottom: `1px solid ${theme.border}`, fontSize: "11px", textTransform: "uppercase", fontWeight: "700", color: theme.subtext }}>Funcionário</th>
                    <th style={{ padding: "10px 12px", borderBottom: `1px solid ${theme.border}`, fontSize: "11px", textTransform: "uppercase", fontWeight: "700", color: theme.subtext }}>Período / Obs</th>
                    <th style={{ padding: "10px 12px", borderBottom: `1px solid ${theme.border}`, fontSize: "11px", textTransform: "uppercase", fontWeight: "700", color: theme.subtext }}>Valor</th>
                    <th style={{ padding: "10px 12px", borderBottom: `1px solid ${theme.border}`, fontSize: "11px", textTransform: "uppercase", fontWeight: "700", color: theme.subtext }}>Comprovante</th>
                    <th style={{ padding: "10px 12px", borderBottom: `1px solid ${theme.border}`, fontSize: "11px", textTransform: "uppercase", fontWeight: "700", color: theme.subtext }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {pagamentosSemanais
                    .filter((p) => !p.confirmado && p.comprovante_link)
                    .map((pag) => (
                      <tr key={pag.id} style={{ borderBottom: `1px solid ${theme.border}` }}>
                        <td style={{ padding: "10px 12px", color: theme.text }}>
                          <div style={{ fontWeight: "700" }}>{pag.funcionario_nome}</div>
                          <div style={{ fontSize: "10px", color: theme.subtext }}>ID: {pag.funcionario_id}</div>
                        </td>
                        <td style={{ padding: "10px 12px", color: theme.subtext }}>{(pag.observacao || "").replace("Cobrança automática - ", "") || "—"}</td>
                        <td style={{ padding: "10px 12px", color: "#facc15", fontWeight: "700" }}>R$ {Number(pag.valor).toLocaleString("pt-BR")}</td>
                        <td style={{ padding: "10px 12px" }}>
                          <a href={pag.comprovante_link} target="_blank" rel="noreferrer" style={{ background: "#3b82f620", color: "#60a5fa", border: "1px solid #3b82f6", padding: "6px 12px", borderRadius: "8px", fontSize: "11px", fontWeight: "800", textDecoration: "none", display: "inline-block" }}>🔗 VER LINK</a>
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          <div style={{ display: "flex", gap: "8px" }}>
                            <button 
                              onClick={() => {
                                let dataDom = null;
                                if (pag.observacao?.includes("até ")) {
                                   const partes = pag.observacao.split("até ");
                                   if (partes[1]) {
                                     const dataBR = partes[1].split("]")[0].trim();
                                     if (dataBR.includes("/")) {
                                       const [d, m] = dataBR.split("/");
                                       const ano = new Date().getFullYear();
                                       dataDom = `${ano}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
                                     }
                                   }
                                }
                                confirmarPagamentoSemanal(pag.id, pag.funcionario_id, pag.funcionario_nome, pag.comprovante_link, dataDom);
                              }}
                              style={{ background: "#22c55e", color: "#fff", border: "none", padding: "8px 16px", borderRadius: "8px", cursor: "pointer", fontWeight: "900", fontSize: "11px", boxShadow: "0 4px 10px rgba(34,197,94,0.2)" }}
                            >
                              ✅ APROVAR
                            </button>
                            <button onClick={() => apagarPagamento(pag.id)} style={{ background: "none", color: "#ef4444", border: `1px solid ${theme.border}`, padding: "8px", borderRadius: "8px", cursor: "pointer" }} title="Recusar/Apagar">
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* HISTÓRICO DE PAGAMENTOS CONFIRMADOS (Geral) */}
        {pagamentosSemanais.filter((p) => p.confirmado).length > 0 && (
          <div style={{ ...styles.whiteCard, marginTop: "24px" }}>
            <div style={styles.cardHeader}>
              <span style={{ ...styles.dot, background: "#4ade80" }}></span> <span style={{ color: "#4ade80" }}>Histórico Geral de Pagamentos Confirmados</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ background: theme.card2, textAlign: "left" }}>
                    <th style={{ padding: "8px 12px", borderBottom: `1px solid ${theme.border}`, fontSize: "11px", textTransform: "uppercase", fontWeight: "700", color: theme.subtext }}>Funcionário</th>
                    <th style={{ padding: "8px 12px", borderBottom: `1px solid ${theme.border}`, fontSize: "11px", textTransform: "uppercase", fontWeight: "700", color: theme.subtext }}>Valor</th>
                    <th style={{ padding: "8px 12px", borderBottom: `1px solid ${theme.border}`, fontSize: "11px", textTransform: "uppercase", fontWeight: "700", color: theme.subtext }}>Comprovante</th>
                    <th style={{ padding: "8px 12px", borderBottom: `1px solid ${theme.border}`, fontSize: "11px", textTransform: "uppercase", fontWeight: "700", color: theme.subtext }}>Confirmado em</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {pagamentosSemanais
                    .filter((p) => p.confirmado)
                    .slice(0, 30)
                    .map((pag) => (
                      <tr key={pag.id} style={{ borderBottom: `1px solid ${theme.border}` }}>
                        <td style={{ padding: "8px 12px", color: theme.text }}>
                          <button onClick={() => setFuncSelecionado({id: pag.funcionario_id, nome: pag.funcionario_nome})} style={{ background: "none", border: "none", color: theme.text, cursor: "pointer", padding: 0 }}>{pag.funcionario_nome}</button>
                        </td>
                        <td style={{ padding: "8px 12px", color: "#22c55e", fontWeight: "700" }}>R$ {Number(pag.valor).toLocaleString("pt-BR")}</td>
                        <td style={{ padding: "8px 12px" }}>
                          {pag.comprovante_link ? (
                            <a href={pag.comprovante_link} target="_blank" rel="noreferrer" style={{ color: theme.accent, fontSize: "11px", fontWeight: "800", textDecoration: "none" }}>🔗 Ver Link</a>
                          ) : "—"}
                        </td>
                        <td style={{ padding: "8px 12px", color: theme.subtext, fontSize: "12px" }}>{formatarDataHora(pag.confirmado_em)}</td>
                        {isAdminOuDono(usuarioLogado?.role) && (
                          <td>
                            <button onClick={() => apagarPagamento(pag.id)} style={{ background: "#dc2626", color: "#fff", border: "none", padding: "6px 10px", borderRadius: "6px", cursor: "pointer" }}>
                              🗑️
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </>
        ) : (
          renderResumoAtrasos()
        )}
      </div>
    </div>
  );
}
