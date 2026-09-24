"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";

function calcularDuracao(hIni, hFim) {
  if (!hIni || !hFim) return 0;
  const [h1, m1, s1] = hIni.split(":").map(Number);
  const [h2, m2, s2] = hFim.split(":").map(Number);
  const totalS1 = h1 * 3600 + m1 * 60 + (s1 || 0);
  const totalS2 = h2 * 3600 + m2 * 60 + (s2 || 0);
  let diff = totalS2 - totalS1;
  if (diff < 0) diff += 24 * 3600;
  return Math.round(diff / 60);
}

function formatarMinutos(totalMin) {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function calcularSemanaOffset(offset = 0) {
  const agora = new Date();
  const spDate = new Date(agora.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const diaSemana = spDate.getDay();
  const diasDesdeSegunda = diaSemana === 0 ? 6 : diaSemana - 1;

  const seg = new Date(spDate);
  seg.setDate(spDate.getDate() - diasDesdeSegunda + offset * 7);
  const dom = new Date(seg);
  dom.setDate(seg.getDate() + 6);

  const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const fmtBR = (d) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;

  return {
    segunda: fmt(seg),
    domingo: fmt(dom),
    label: `${fmtBR(seg)} a ${fmtBR(dom)}`,
    labelCompleto: `Semana de ${fmtBR(seg)} a ${fmtBR(dom)}/${dom.getFullYear()}`,
  };
}

export default function ConciliadorPontoPage() {
  const [usuarios, setUsuarios] = useState([]);
  const [usuarioId, setUsuarioId] = useState("643"); // Padrão Hido Garcia
  
  // Controle de Modo: 'semana' (padrão) ou 'dia'
  const [modo, setModo] = useState("semana");
  const [semanaOffset, setSemanaOffset] = useState(0); // 0 = Semana Atual, -1 = Passada
  const [diaAtivoNaSemana, setDiaAtivoNaSemana] = useState("todos"); // 'todos' ou 'YYYY-MM-DD'
  
  const [dataFiltro, setDataFiltro] = useState("2026-09-24");
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const [entradas, setEntradas] = useState([]);
  const [saidas, setSaidas] = useState([]);
  const [diasDaSemana, setDiasDaSemana] = useState([]);
  const [resumoSemanal, setResumoSemanal] = useState(null);
  const [atividadesGerais, setAtividadesGerais] = useState([]);
  const [sessoesExistentes, setSessoesExistentes] = useState([]);

  const [draggedSaidaId, setDraggedSaidaId] = useState(null);
  const [dragOverEntradaId, setDragOverEntradaId] = useState(null);
  const [mensagem, setMensagem] = useState(null);

  const semanaInfo = calcularSemanaOffset(semanaOffset);

  const carregarDadosReais = useCallback(async (
    uId = usuarioId,
    dt = dataFiltro,
    md = modo,
    offset = semanaOffset
  ) => {
    setCarregando(true);
    try {
      const sem = calcularSemanaOffset(offset);
      const url = md === "semana"
        ? `/api/ponto/conciliador?usuario_id=${uId}&modo=semana&data_inicio=${sem.segunda}&data_fim=${sem.domingo}&data=${sem.segunda}`
        : `/api/ponto/conciliador?usuario_id=${uId}&modo=dia&data=${dt}`;

      const res = await fetch(url);
      const json = await res.json();
      if (json.ok) {
        setUsuarios(json.usuarios || []);
        setDiasDaSemana(json.diasDaSemana || []);
        setResumoSemanal(json.resumoSemanal || null);
        setSessoesExistentes(json.sessoesExistentes || []);

        if (md === "semana") {
          const todasEnts = (json.diasDaSemana || []).flatMap((d) => d.entradas || []);
          const todasSais = (json.diasDaSemana || []).flatMap((d) => d.saidas || []);
          setEntradas(todasEnts);
          setSaidas(todasSais);
        } else {
          setEntradas(json.entradas || []);
          setSaidas(json.saidas || []);
        }
      } else {
        mostrarAviso("⚠️ Erro ao carregar dados: " + json.error, "erro");
      }
    } catch (err) {
      mostrarAviso("❌ Falha de conexão: " + err.message, "erro");
    } finally {
      setCarregando(false);
    }
  }, [usuarioId, dataFiltro, modo, semanaOffset]);

  useEffect(() => {
    carregarDadosReais();
  }, [carregarDadosReais]);

  const casarPonto = (entradaId, saidaId) => {
    setEntradas((prev) =>
      prev.map((e) => {
        if (e.id === entradaId) return { ...e, saidaId, auditado: false };
        if (e.saidaId === saidaId) return { ...e, saidaId: null, auditado: false };
        return e;
      })
    );
    setSaidas((prev) =>
      prev.map((s) => {
        if (s.id === saidaId) return { ...s, pareadoCom: entradaId };
        if (s.pareadoCom === entradaId) return { ...s, pareadoCom: null };
        return s;
      })
    );
    mostrarAviso("🔗 Sessão casada! Lembre-se de gravar para homologar.");
  };

  const descasarPonto = (entradaId) => {
    const ent = entradas.find((e) => e.id === entradaId);
    if (!ent || !ent.saidaId) return;
    const saidaId = ent.saidaId;

    setEntradas((prev) =>
      prev.map((e) => (e.id === entradaId ? { ...e, saidaId: null, auditado: false } : e))
    );
    setSaidas((prev) =>
      prev.map((s) => (s.id === saidaId ? { ...s, pareadoCom: null } : s))
    );
    mostrarAviso("✂️ Pareamento desfeito. Pronto para re-casar ou gravar.");
  };

  const gerarSaidaPorAtividade = (entradaId, atividade) => {
    const ent = entradas.find((e) => e.id === entradaId);
    const dataRef = atividade.data || ent?.data || dataFiltro;
    const novaSaidaId = `sai-auto-${Date.now()}`;
    const novaSaida = {
      id: novaSaidaId,
      data: dataRef,
      hora: atividade.hora,
      tipo: "saida",
      origem: `Âncora Automática (${atividade.tipo === "tunagem" ? "Tunagem" : "Bancada"})`,
      pareadoCom: entradaId,
      geradoPorLog: true,
      tipoFechamento: "CRASH_COM_ATIVIDADE",
      atividadeRef: atividade.desc,
    };

    setSaidas((prev) => [novaSaida, ...prev]);
    setEntradas((prev) =>
      prev.map((e) => (e.id === entradaId ? { ...e, saidaId: novaSaidaId, auditado: false, tipoFechamento: "CRASH_COM_ATIVIDADE" } : e))
    );
    mostrarAviso(`⚡ Saída criada no horário do serviço (${atividade.hora})! Clique em Gravar para homologar.`);
  };

  const criarSaida1Minuto = (entradaId, horaEntrada) => {
    const ent = entradas.find((e) => e.id === entradaId);
    const dataRef = ent?.data || dataFiltro;
    const [h, m, s] = (horaEntrada || "00:00:00").split(":").map(Number);
    let totalS = h * 3600 + (m + 1) * 60 + (s || 0);
    const nH = String(Math.floor(totalS / 3600) % 24).padStart(2, "0");
    const nM = String(Math.floor((totalS % 3600) / 60)).padStart(2, "0");
    const nS = String(totalS % 60).padStart(2, "0");
    const horaCalculada = `${nH}:${nM}:${nS}`;

    const novaSaidaId = `sai-1min-${Date.now()}`;
    const novaSaida = {
      id: novaSaidaId,
      data: dataRef,
      hora: horaCalculada,
      tipo: "saida",
      origem: "Crash sem atividade (1 Minuto)",
      pareadoCom: entradaId,
      geradoPorLog: true,
      tipoFechamento: "CRASH_SEM_ATIVIDADE",
    };

    setSaidas((prev) => [novaSaida, ...prev]);
    setEntradas((prev) =>
      prev.map((e) => (e.id === entradaId ? { ...e, saidaId: novaSaidaId, auditado: false, tipoFechamento: "CRASH_SEM_ATIVIDADE" } : e))
    );
    mostrarAviso(`⏱️ Saída de 1 minuto criada (${horaCalculada})! Clique em Gravar para homologar.`);
  };

  const gravarSessoesNoBanco = async () => {
    const entradasParaGravar = entradas.filter((e) => {
      if (!e.saidaId) return false;
      if (modo === "semana" && diaAtivoNaSemana !== "todos") {
        return e.data === diaAtivoNaSemana;
      }
      return true;
    });

    if (entradasParaGravar.length === 0) {
      return alert("⚠️ Nenhuma sessão casada para gravar!");
    }

    const sessoesValidadas = entradasParaGravar.map((e) => {
      const sai = saidas.find((s) => s.id === e.saidaId);
      return {
        data: e.data || dataFiltro,
        horaEntrada: e.hora,
        horaSaida: sai?.hora || e.hora,
        uuidEntrada: e.uuid,
        uuidSaida: sai?.uuid,
        tipoFechamento: sai?.tipoFechamento || (sai?.geradoPorLog ? "CRASH_COM_ATIVIDADE" : "VALIDADO_CONCILIADOR"),
      };
    });

    const mecanicoAtual = usuarios.find((u) => String(u.id) === String(usuarioId));
    const labelPeriodo = modo === "semana" && diaAtivoNaSemana === "todos"
      ? `na semana (${semanaInfo.label})`
      : `em ${diaAtivoNaSemana !== "todos" ? diaAtivoNaSemana : dataFiltro}`;

    if (!confirm(`🚀 Deseja gravar ${sessoesValidadas.length} sessões validadas para ${mecanicoAtual?.nome || "Mecânico"} ${labelPeriodo}?`)) {
      return;
    }

    setSalvando(true);
    try {
      const res = await fetch("/api/ponto/conciliador", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usuario_id: usuarioId,
          nome: mecanicoAtual?.nome || "Mecânico",
          data: dataFiltro,
          sessoesValidadas,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        mostrarAviso("💾 " + json.mensagem, "sucesso");
        carregarDadosReais();
      } else {
        mostrarAviso("❌ Erro ao gravar: " + json.error, "erro");
      }
    } catch (err) {
      mostrarAviso("❌ Erro na gravação: " + err.message, "erro");
    } finally {
      setSalvando(false);
    }
  };

  const mostrarAviso = (msg, tipo = "info") => {
    setMensagem({ text: msg, tipo });
    setTimeout(() => setMensagem(null), 3500);
  };

  // Drag and Drop
  const handleDragStart = (e, saidaId) => {
    e.dataTransfer.setData("text/plain", saidaId);
    setDraggedSaidaId(saidaId);
  };

  const handleDragOver = (e, entradaId) => {
    e.preventDefault();
    setDragOverEntradaId(entradaId);
  };

  const handleDragLeave = () => {
    setDragOverEntradaId(null);
  };

  const handleDrop = (e, entradaId) => {
    e.preventDefault();
    setDragOverEntradaId(null);
    const saidaId = e.dataTransfer.getData("text/plain") || draggedSaidaId;
    if (saidaId && entradaId) {
      casarPonto(entradaId, saidaId);
    }
    setDraggedSaidaId(null);
  };

  // Filtragem de entradas e saídas ativas conforme o foco de visualização
  const entradasVisiveis = entradas.filter((e) => {
    if (modo === "semana" && diaAtivoNaSemana !== "todos") {
      return e.data === diaAtivoNaSemana;
    }
    return true;
  });

  const saidasVisiveis = saidas.filter((s) => {
    if (modo === "semana" && diaAtivoNaSemana !== "todos") {
      return s.data === diaAtivoNaSemana;
    }
    return true;
  });

  const sessoesExistentesVisiveis = sessoesExistentes.filter((s) => {
    if (modo === "semana" && diaAtivoNaSemana !== "todos") {
      const sData = s.data ? String(s.data).slice(0, 10) : "";
      return sData === diaAtivoNaSemana;
    }
    return true;
  });

  // Cálculos dinâmicos
  const totalMinutosCasados = entradasVisiveis.reduce((acc, ent) => {
    if (!ent.saidaId) return acc;
    const sai = saidas.find((s) => s.id === ent.saidaId);
    if (!sai) return acc;
    return acc + calcularDuracao(ent.hora, sai.hora);
  }, 0);

  const totalSessoesVisiveis = entradasVisiveis.length;
  const sessoesCasadas = entradasVisiveis.filter((e) => e.saidaId).length;
  const sessoesAuditadas = entradasVisiveis.filter((e) => e.saidaId && e.auditado).length;
  const sessoesPendentesGravacao = entradasVisiveis.filter((e) => e.saidaId && !e.auditado).length;
  const sessoesPendentesSaida = totalSessoesVisiveis - sessoesCasadas;
  const mecanicoSelecionado = usuarios.find((u) => String(u.id) === String(usuarioId));

  return (
    <div style={{
      minHeight: "100vh",
      background: "#090d16",
      color: "#e2e8f0",
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      padding: "24px 20px"
    }}>
      {/* Topo / Header com Filtros Reais */}
      <div style={{ maxWidth: "1340px", margin: "0 auto 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "32px" }}>🎯</span>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <h1 style={{ fontSize: "22px", fontWeight: "900", color: "#fff", margin: 0 }}>
                  Conciliador Visual de Pontos
                </h1>
                <span style={{
                  background: modo === "semana" ? "rgba(168,85,247,0.15)" : "rgba(16,185,129,0.15)",
                  border: `1px solid ${modo === "semana" ? "rgba(168,85,247,0.4)" : "rgba(16,185,129,0.4)"}`,
                  color: modo === "semana" ? "#c084fc" : "#34d399",
                  fontSize: "10.5px",
                  fontWeight: "800",
                  padding: "2px 8px",
                  borderRadius: "20px"
                }}>
                  {modo === "semana" ? "📆 FILTRO SEMANAL ATIVO" : "📅 VISÃO DIÁRIA"}
                </span>
              </div>
              <p style={{ color: "#94a3b8", fontSize: "12.5px", marginTop: "3px" }}>
                Mesa de auditoria cirúrgica para casar entradas, saídas e âncoras de tunagem do FiveM.
              </p>
            </div>
          </div>

          <Link href="/" style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.12)",
            color: "#cbd5e1",
            padding: "8px 16px",
            borderRadius: "10px",
            textDecoration: "none",
            fontSize: "12.5px",
            fontWeight: "700",
            transition: "all 0.2s"
          }}>
            ← Voltar para o Sistema
          </Link>
        </div>

        {/* Barra de Filtros Principal */}
        <div style={{
          background: "rgba(15, 23, 42, 0.9)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "14px",
          padding: "16px 20px",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
          marginBottom: "16px"
        }}>
          {/* Linha 1: Mecânico + Alternador de Modo (Diário / Semanal) + Controles */}
          <div style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "14px"
          }}>
            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "14px" }}>
              {/* Seletor de Mecânico */}
              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: "800", color: "#94a3b8", marginBottom: "4px", textTransform: "uppercase" }}>
                  🧑‍🔧 Mecânico ({usuarios.length} disponíveis)
                </label>
                <select
                  value={usuarioId}
                  onChange={(e) => {
                    setUsuarioId(e.target.value);
                    carregarDadosReais(e.target.value, dataFiltro, modo, semanaOffset);
                  }}
                  style={{
                    background: "#1e293b",
                    border: "1px solid rgba(255,255,255,0.15)",
                    color: "#fff",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: "700",
                    outline: "none",
                    cursor: "pointer",
                    minWidth: "250px"
                  }}
                >
                  {usuarios.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nome} (ID: #{u.id})
                    </option>
                  ))}
                </select>
              </div>

              {/* Toggle de Modo: Diário vs Semanal */}
              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: "800", color: "#94a3b8", marginBottom: "4px", textTransform: "uppercase" }}>
                  ⚙️ Modo de Visualização
                </label>
                <div style={{
                  display: "flex",
                  background: "#0f172a",
                  padding: "3px",
                  borderRadius: "9px",
                  border: "1px solid rgba(255,255,255,0.12)"
                }}>
                  <button
                    onClick={() => {
                      setModo("semana");
                      setDiaAtivoNaSemana("todos");
                      carregarDadosReais(usuarioId, dataFiltro, "semana", semanaOffset);
                    }}
                    style={{
                      background: modo === "semana" ? "linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)" : "transparent",
                      color: modo === "semana" ? "#fff" : "#94a3b8",
                      border: "none",
                      padding: "6px 14px",
                      borderRadius: "7px",
                      fontSize: "12px",
                      fontWeight: "800",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                      transition: "all 0.2s"
                    }}
                  >
                    <span>📆</span> Visão Semanal
                  </button>
                  <button
                    onClick={() => {
                      setModo("dia");
                      carregarDadosReais(usuarioId, dataFiltro, "dia", semanaOffset);
                    }}
                    style={{
                      background: modo === "dia" ? "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)" : "transparent",
                      color: modo === "dia" ? "#fff" : "#94a3b8",
                      border: "none",
                      padding: "6px 14px",
                      borderRadius: "7px",
                      fontSize: "12px",
                      fontWeight: "800",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                      transition: "all 0.2s"
                    }}
                  >
                    <span>📅</span> Visão Diária
                  </button>
                </div>
              </div>

              {/* Controles de Semana (quando modo === 'semana') */}
              {modo === "semana" ? (
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: "800", color: "#94a3b8", marginBottom: "4px", textTransform: "uppercase" }}>
                    📆 Semana Selecionada
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <button
                      onClick={() => {
                        const novoOffset = semanaOffset - 1;
                        setSemanaOffset(novoOffset);
                        carregarDadosReais(usuarioId, dataFiltro, "semana", novoOffset);
                      }}
                      style={{
                        background: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.12)",
                        color: "#fff",
                        padding: "7px 10px",
                        borderRadius: "8px",
                        fontSize: "12px",
                        fontWeight: "800",
                        cursor: "pointer"
                      }}
                      title="Semana Anterior"
                    >
                      ◀
                    </button>

                    <div style={{
                      background: "#1e293b",
                      border: "1px solid rgba(168,85,247,0.4)",
                      padding: "7px 14px",
                      borderRadius: "8px",
                      fontSize: "12.5px",
                      fontWeight: "800",
                      color: "#c084fc",
                      minWidth: "180px",
                      textAlign: "center"
                    }}>
                      {semanaOffset === 0 ? "🌟 Semana Atual" : semanaOffset === -1 ? "⏮️ Semana Passada" : `Semana (${semanaOffset})`}
                      <span style={{ display: "block", fontSize: "10.5px", color: "#94a3b8", fontWeight: "600", marginTop: "1px" }}>
                        {semanaInfo.label}
                      </span>
                    </div>

                    <button
                      onClick={() => {
                        const novoOffset = semanaOffset + 1;
                        setSemanaOffset(novoOffset);
                        carregarDadosReais(usuarioId, dataFiltro, "semana", novoOffset);
                      }}
                      style={{
                        background: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.12)",
                        color: "#fff",
                        padding: "7px 10px",
                        borderRadius: "8px",
                        fontSize: "12px",
                        fontWeight: "800",
                        cursor: "pointer"
                      }}
                      title="Próxima Semana"
                    >
                      ▶
                    </button>

                    {semanaOffset !== 0 && (
                      <button
                        onClick={() => {
                          setSemanaOffset(0);
                          carregarDadosReais(usuarioId, dataFiltro, "semana", 0);
                        }}
                        style={{
                          background: "rgba(168,85,247,0.15)",
                          border: "1px solid rgba(168,85,247,0.3)",
                          color: "#c084fc",
                          padding: "7px 10px",
                          borderRadius: "8px",
                          fontSize: "11px",
                          fontWeight: "800",
                          cursor: "pointer"
                        }}
                      >
                        Semana Atual
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                /* Controles de Data Diária (quando modo === 'dia') */
                <div style={{ display: "flex", gap: "10px", alignItems: "flex-end" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: "800", color: "#94a3b8", marginBottom: "4px", textTransform: "uppercase" }}>
                      📅 Data em Análise
                    </label>
                    <input
                      type="date"
                      value={dataFiltro}
                      onChange={(e) => {
                        setDataFiltro(e.target.value);
                        carregarDadosReais(usuarioId, e.target.value, "dia", semanaOffset);
                      }}
                      style={{
                        background: "#1e293b",
                        border: "1px solid rgba(255,255,255,0.15)",
                        color: "#fff",
                        padding: "7px 12px",
                        borderRadius: "8px",
                        fontSize: "13px",
                        fontWeight: "700",
                        outline: "none"
                      }}
                    />
                  </div>

                  <div style={{ display: "flex", gap: "6px" }}>
                    {[
                      { label: "Ontem (23/09)", val: "2026-09-23" },
                      { label: "Anteontem (22/09)", val: "2026-09-22" },
                      { label: "Hoje (24/09)", val: "2026-09-24" },
                    ].map((b) => (
                      <button
                        key={b.val}
                        onClick={() => {
                          setDataFiltro(b.val);
                          carregarDadosReais(usuarioId, b.val, "dia", semanaOffset);
                        }}
                        style={{
                          background: dataFiltro === b.val ? "rgba(168,85,247,0.3)" : "rgba(255,255,255,0.05)",
                          border: `1px solid ${dataFiltro === b.val ? "#c084fc" : "rgba(255,255,255,0.1)"}`,
                          color: dataFiltro === b.val ? "#fff" : "#94a3b8",
                          padding: "7px 11px",
                          borderRadius: "8px",
                          fontSize: "11.5px",
                          fontWeight: "700",
                          cursor: "pointer",
                          height: "36px"
                        }}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => carregarDadosReais(usuarioId, dataFiltro, modo, semanaOffset)}
              disabled={carregando}
              style={{
                background: "rgba(56,189,248,0.15)",
                border: "1px solid rgba(56,189,248,0.4)",
                color: "#38bdf8",
                padding: "9px 16px",
                borderRadius: "8px",
                fontSize: "12.5px",
                fontWeight: "800",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px"
              }}
            >
              <span>{carregando ? "🔄 Carregando..." : "🔍 Recarregar Dados"}</span>
            </button>
          </div>

          {/* Linha 2: Pílulas dos 7 Dias da Semana para Navegação Rápida com 1 Clique */}
          {diasDaSemana.length > 0 && (
            <div style={{
              paddingTop: "12px",
              borderTop: "1px solid rgba(255,255,255,0.06)",
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "8px"
            }}>
              <span style={{ fontSize: "11px", fontWeight: "800", color: "#94a3b8", textTransform: "uppercase", marginRight: "4px" }}>
                🗓️ Dias da Semana:
              </span>

              {/* Botão Toda a Semana (se no modo semanal) */}
              {modo === "semana" && (
                <button
                  onClick={() => setDiaAtivoNaSemana("todos")}
                  style={{
                    background: diaAtivoNaSemana === "todos" ? "linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)" : "rgba(255,255,255,0.05)",
                    border: `1.5px solid ${diaAtivoNaSemana === "todos" ? "#c084fc" : "rgba(255,255,255,0.1)"}`,
                    color: diaAtivoNaSemana === "todos" ? "#fff" : "#94a3b8",
                    padding: "6px 12px",
                    borderRadius: "8px",
                    fontSize: "11.5px",
                    fontWeight: "800",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px"
                  }}
                >
                  <span>🌐 Toda a Semana</span>
                  <span style={{
                    background: "rgba(0,0,0,0.3)",
                    padding: "1px 6px",
                    borderRadius: "10px",
                    fontSize: "10px"
                  }}>
                    {resumoSemanal?.totalSessoes || 0}
                  </span>
                </button>
              )}

              {/* Pílulas de Cada Dia */}
              {diasDaSemana.map((d) => {
                const isSelected = modo === "semana" ? diaAtivoNaSemana === d.data : dataFiltro === d.data;
                const temSessoes = d.totalSessoes > 0;
                const temPendentes = d.sessoesPendentes > 0;

                return (
                  <button
                    key={d.data}
                    onClick={() => {
                      if (modo === "semana") {
                        setDiaAtivoNaSemana(d.data);
                      } else {
                        setDataFiltro(d.data);
                        carregarDadosReais(usuarioId, d.data, "dia", semanaOffset);
                      }
                    }}
                    style={{
                      background: isSelected
                        ? "rgba(168, 85, 247, 0.25)"
                        : temSessoes
                        ? "rgba(255,255,255,0.05)"
                        : "rgba(255,255,255,0.02)",
                      border: `1.5px solid ${
                        isSelected
                          ? "#c084fc"
                          : temPendentes
                          ? "rgba(245, 158, 11, 0.4)"
                          : temSessoes
                          ? "rgba(16, 185, 129, 0.35)"
                          : "rgba(255,255,255,0.08)"
                      }`,
                      color: isSelected ? "#fff" : temSessoes ? "#e2e8f0" : "#64748b",
                      padding: "6px 11px",
                      borderRadius: "8px",
                      fontSize: "11.5px",
                      fontWeight: isSelected ? "800" : "700",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      transition: "all 0.15s"
                    }}
                  >
                    <span>{d.curtoApenas} {d.diaMes}</span>
                    {temSessoes ? (
                      <span style={{
                        background: temPendentes ? "rgba(245,158,11,0.2)" : "rgba(16,185,129,0.2)",
                        color: temPendentes ? "#fbbf24" : "#34d399",
                        padding: "1px 5px",
                        borderRadius: "10px",
                        fontSize: "10px",
                        fontWeight: "900"
                      }}>
                        {d.totalSessoes} {temPendentes ? "⚠️" : "✅"}
                      </span>
                    ) : (
                      <span style={{ fontSize: "10px", color: "#64748b" }}>0</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Card do Mecânico & Resumo Dinâmico */}
        <div style={{
          background: "linear-gradient(135deg, rgba(30,27,75,0.65) 0%, rgba(15,23,42,0.85) 100%)",
          border: "1px solid rgba(139,92,246,0.35)",
          borderRadius: "16px",
          padding: "18px 24px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          gap: "16px",
          alignItems: "center"
        }}>
          <div>
            <div style={{ fontSize: "10.5px", color: "#a855f7", fontWeight: "900", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Mecânico Selecionado
            </div>
            <div style={{ fontSize: "17px", fontWeight: "900", color: "#fff", marginTop: "2px" }}>
              🧑‍🔧 {mecanicoSelecionado?.nome || "Carregando..."}
            </div>
            <div style={{ fontSize: "12px", color: "#94a3b8" }}>
              ID: #{usuarioId} • {modo === "semana" ? `Semana: ${semanaInfo.label}` : `Data: ${dataFiltro}`}
            </div>
          </div>

          <div>
            <div style={{ fontSize: "10.5px", color: "#10b981", fontWeight: "900", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              {modo === "semana" && diaAtivoNaSemana === "todos" ? "Horas Totais da Semana" : "Horas Validadas"}
            </div>
            <div style={{ fontSize: "22px", fontWeight: "900", color: "#34d399", marginTop: "2px" }}>
              ⏱️ {formatarMinutos(totalMinutosCasados)}
            </div>
            <div style={{ fontSize: "12px", color: "#94a3b8" }}>
              {sessoesCasadas} de {totalSessoesVisiveis} sessões casadas
              {modo === "semana" && diaAtivoNaSemana === "todos" && resumoSemanal && (
                <span> • {resumoSemanal.diasTrabalhados} dias c/ atividade</span>
              )}
            </div>
          </div>

          <div>
            <div style={{
              fontSize: "10.5px",
              color: sessoesPendentesSaida > 0 ? "#f59e0b" : sessoesPendentesGravacao > 0 ? "#38bdf8" : "#10b981",
              fontWeight: "900",
              textTransform: "uppercase",
              letterSpacing: "0.5px"
            }}>
              Status dos Pareamentos
            </div>
            <div style={{
              fontSize: "15px",
              fontWeight: "900",
              color: sessoesPendentesSaida > 0 ? "#fbbf24" : sessoesPendentesGravacao > 0 ? "#38bdf8" : "#34d399",
              marginTop: "4px"
            }}>
              {sessoesPendentesSaida > 0
                ? `⚠️ ${sessoesPendentesSaida} Entrada(s) sem Saída`
                : sessoesPendentesGravacao > 0
                ? `💾 ${sessoesPendentesGravacao} Alteração(ões) a Gravar`
                : totalSessoesVisiveis === 0
                ? "ℹ️ Sem registros neste período"
                : `🛡️ 100% Homologado (${sessoesAuditadas} sessões)`}
            </div>
            <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "2px" }}>
              {sessoesAuditadas > 0 ? `🛡️ ${sessoesAuditadas} salvas em banco` : "Nenhuma salva ainda"}
              {sessoesPendentesGravacao > 0 ? ` • ⚠️ ${sessoesPendentesGravacao} pendente(s)` : ""}
            </div>
          </div>

          <div style={{ textAlign: "right" }}>
            <button
              onClick={gravarSessoesNoBanco}
              disabled={salvando || totalSessoesVisiveis === 0}
              style={{
                background: sessoesPendentesGravacao > 0
                  ? "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
                  : "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                border: "none",
                color: "#fff",
                padding: "11px 22px",
                borderRadius: "12px",
                fontWeight: "900",
                fontSize: "13.5px",
                cursor: "pointer",
                boxShadow: sessoesPendentesGravacao > 0 ? "0 4px 15px rgba(245,158,11,0.4)" : "0 4px 15px rgba(16,185,129,0.35)",
                opacity: totalSessoesVisiveis === 0 ? 0.5 : 1,
              }}
            >
              {salvando
                ? "Gravando..."
                : sessoesPendentesGravacao > 0
                ? `💾 Gravar Alterações (${sessoesPendentesGravacao})`
                : sessoesAuditadas > 0
                ? "🛡️ Re-Gravar Sessões Homologadas"
                : "💾 Gravar Sessões no Banco"}
            </button>
          </div>
        </div>
      </div>

      {mensagem && (
        <div style={{
          position: "fixed",
          top: "20px",
          right: "20px",
          zIndex: 99999,
          background: mensagem.tipo === "erro" ? "#ef4444" : "#10b981",
          color: "#fff",
          padding: "12px 20px",
          borderRadius: "12px",
          fontWeight: "800",
          fontSize: "13.5px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.5)"
        }}>
          {mensagem.text}
        </div>
      )}

      {/* Grid Principal: Duas Colunas com Pareamento */}
      <div style={{
        maxWidth: "1340px",
        margin: "0 auto",
        display: "grid",
        gridTemplateColumns: "1fr 340px",
        gap: "24px"
      }}>
        {/* COLUNA ESQUERDA: Trilhas de Entrada e Casamento */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
            <h2 style={{ fontSize: "15px", fontWeight: "800", color: "#cbd5e1", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#10b981" }} />
              Sessões de Entrada ({entradasVisiveis.length} encontradas)
            </h2>
            <span style={{ fontSize: "12px", color: "#64748b" }}>
              Arraste uma saída da direita ou use as âncoras de atividade
            </span>
          </div>

          {entradasVisiveis.length === 0 ? (
            <div style={{
              background: "rgba(15, 23, 42, 0.5)",
              border: "1px dashed rgba(255,255,255,0.15)",
              borderRadius: "16px",
              padding: "48px 24px",
              textAlign: "center",
              color: "#94a3b8"
            }}>
              <span style={{ fontSize: "36px" }}>📭</span>
              <div style={{ fontSize: "16px", fontWeight: "800", color: "#fff", marginTop: "8px" }}>
                Nenhum registro de ponto encontrado para este mecânico neste período.
              </div>
              <p style={{ fontSize: "13px", marginTop: "4px" }}>
                Tente selecionar outro dia na barra acima, outra semana ou outro mecânico.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {entradasVisiveis.map((ent, idx) => {
                const isAuditado = Boolean(ent.auditado);
                const saidaCasada = saidas.find((s) => s.id === ent.saidaId);
                const duracaoMin = saidaCasada ? calcularDuracao(ent.hora, saidaCasada.hora) : null;
                const isOver = dragOverEntradaId === ent.id;

                return (
                  <div
                    key={ent.id}
                    style={{
                      background: isAuditado
                        ? "rgba(15, 23, 42, 0.85)"
                        : saidaCasada
                        ? "rgba(15, 23, 42, 0.75)"
                        : "rgba(30, 41, 59, 0.4)",
                      border: `1.5px solid ${
                        isOver
                          ? "#a855f7"
                          : isAuditado
                          ? "rgba(16, 185, 129, 0.45)"
                          : saidaCasada
                          ? "rgba(245, 158, 11, 0.4)"
                          : "rgba(239, 68, 68, 0.35)"
                      }`,
                      borderRadius: "16px",
                      padding: "18px 20px",
                      transition: "all 0.2s",
                      boxShadow: isOver
                        ? "0 0 20px rgba(168,85,247,0.3)"
                        : isAuditado
                        ? "0 4px 18px rgba(16, 185, 129, 0.08)"
                        : "none"
                    }}
                  >
                    {/* Header de Status de Auditoria do Par */}
                    <div style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "14px",
                      paddingBottom: "10px",
                      borderBottom: isAuditado
                        ? "1px solid rgba(16, 185, 129, 0.25)"
                        : saidaCasada
                        ? "1px dashed rgba(245, 158, 11, 0.3)"
                        : "1px dashed rgba(239, 68, 68, 0.25)",
                      flexWrap: "wrap",
                      gap: "8px"
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                        {isAuditado ? (
                          <>
                            <span style={{
                              background: "rgba(16, 185, 129, 0.2)",
                              border: "1px solid rgba(16, 185, 129, 0.5)",
                              color: "#34d399",
                              fontSize: "11px",
                              fontWeight: "900",
                              padding: "3px 10px",
                              borderRadius: "20px",
                              display: "flex",
                              alignItems: "center",
                              gap: "5px"
                            }}>
                              🛡️ SESSÃO AUDITADA POR RESPONSÁVEL
                            </span>
                            <span style={{
                              background: "rgba(168, 85, 247, 0.15)",
                              border: "1px solid rgba(168, 85, 247, 0.4)",
                              color: "#c084fc",
                              fontSize: "11px",
                              fontWeight: "800",
                              padding: "2px 8px",
                              borderRadius: "6px"
                            }}>
                              {ent.tipoFechamento || "VALIDADO_CONCILIADOR"}
                            </span>
                          </>
                        ) : saidaCasada ? (
                          <>
                            <span style={{
                              background: "rgba(245, 158, 11, 0.18)",
                              border: "1px solid rgba(245, 158, 11, 0.45)",
                              color: "#fbbf24",
                              fontSize: "11px",
                              fontWeight: "900",
                              padding: "3px 10px",
                              borderRadius: "20px",
                              display: "flex",
                              alignItems: "center",
                              gap: "5px"
                            }}>
                              ⚠️ CASADO (PENDENTE DE GRAVAÇÃO)
                            </span>
                            <span style={{ fontSize: "11px", color: "#f59e0b" }}>
                              Clique em &quot;Gravar Alterações&quot; no topo para persistir
                            </span>
                          </>
                        ) : (
                          <span style={{
                            background: "rgba(239, 68, 68, 0.15)",
                            border: "1px solid rgba(239, 68, 68, 0.4)",
                            color: "#f87171",
                            fontSize: "11px",
                            fontWeight: "800",
                            padding: "3px 10px",
                            borderRadius: "20px",
                            display: "flex",
                            alignItems: "center",
                            gap: "5px"
                          }}>
                            🚨 PENDENTE DE AUDITORIA (SEM SAÍDA)
                          </span>
                        )}
                      </div>

                      {isAuditado && (
                        <span style={{ fontSize: "11px", color: "#6ee7b7", fontWeight: "700", display: "flex", alignItems: "center", gap: "4px" }}>
                          <span>🔒</span> Gravado no banco (`log_ponto`)
                        </span>
                      )}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "220px 140px 1fr", gap: "16px", alignItems: "center" }}>
                      {/* Bloco de Entrada */}
                      <div style={{
                        background: "rgba(16, 185, 129, 0.12)",
                        border: "1px solid rgba(16, 185, 129, 0.35)",
                        borderRadius: "12px",
                        padding: "12px 14px"
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: "10px", fontWeight: "900", color: "#34d399", textTransform: "uppercase" }}>
                            🟢 Entrada #{idx + 1}
                          </span>
                          {ent.data && (
                            <span style={{ fontSize: "10px", fontWeight: "800", color: "#c084fc", background: "rgba(168,85,247,0.18)", padding: "1px 6px", borderRadius: "4px" }}>
                              📅 {ent.data.slice(8, 10)}/{ent.data.slice(5, 7)}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: "20px", fontWeight: "900", color: "#fff", marginTop: "2px" }}>
                          {ent.hora}
                        </div>
                        <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>
                          {ent.origem}
                        </div>
                      </div>

                      {/* Linha Conectora de Duração */}
                      <div style={{ textAlign: "center" }}>
                        {isAuditado ? (
                          <div>
                            <div style={{ fontSize: "15px", fontWeight: "900", color: "#34d399" }}>
                              {formatarMinutos(duracaoMin)}
                            </div>
                            <div style={{
                              height: "3px",
                              background: "#10b981",
                              borderRadius: "2px",
                              margin: "4px 0",
                              boxShadow: "0 0 8px rgba(16, 185, 129, 0.4)"
                            }} />
                            <div style={{
                              fontSize: "10px",
                              color: "#34d399",
                              fontWeight: "900",
                              letterSpacing: "0.5px"
                            }}>
                              🛡️ AUDITADO
                            </div>
                          </div>
                        ) : saidaCasada ? (
                          <div>
                            <div style={{ fontSize: "14px", fontWeight: "900", color: "#fbbf24" }}>
                              {formatarMinutos(duracaoMin)}
                            </div>
                            <div style={{
                              height: "2px",
                              background: "linear-gradient(90deg, #f59e0b, #ec4899)",
                              margin: "4px 0"
                            }} />
                            <div style={{ fontSize: "10px", color: "#fbbf24", fontWeight: "800" }}>
                              🔗 NOVO PAR
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div style={{ fontSize: "13px", fontWeight: "900", color: "#f87171" }}>
                              Sem Saída
                            </div>
                            <div style={{ height: "2px", borderTop: "2px dashed #f87171", margin: "4px 0" }} />
                            <div style={{ fontSize: "10px", color: "#ef4444", fontWeight: "800" }}>⚠️ ÓRFÃO</div>
                          </div>
                        )}
                      </div>

                      {/* Bloco da Saída (ou Dropzone) */}
                      <div>
                        {saidaCasada ? (
                          <div style={{
                            background: isAuditado
                              ? "rgba(16, 185, 129, 0.12)"
                              : saidaCasada.geradoPorLog
                              ? "rgba(56, 189, 248, 0.12)"
                              : "rgba(239, 68, 68, 0.12)",
                            border: `1px solid ${
                              isAuditado
                                ? "rgba(16, 185, 129, 0.35)"
                                : saidaCasada.geradoPorLog
                                ? "rgba(56, 189, 248, 0.4)"
                                : "rgba(239, 68, 68, 0.35)"
                            }`,
                            borderRadius: "12px",
                            padding: "12px 14px",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center"
                          }}>
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <span style={{
                                  fontSize: "10px",
                                  fontWeight: "900",
                                  color: isAuditado
                                    ? "#34d399"
                                    : saidaCasada.geradoPorLog
                                    ? "#38bdf8"
                                    : "#f87171",
                                  textTransform: "uppercase"
                                }}>
                                  🔴 Saída {isAuditado ? "(Homologada)" : saidaCasada.geradoPorLog ? "(Criada por Âncora)" : "Registrada"}
                                </span>
                                {saidaCasada.data && (
                                  <span style={{ fontSize: "10px", fontWeight: "800", color: "#c084fc", background: "rgba(168,85,247,0.18)", padding: "1px 6px", borderRadius: "4px" }}>
                                    📅 {saidaCasada.data.slice(8, 10)}/{saidaCasada.data.slice(5, 7)}
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: "20px", fontWeight: "900", color: "#fff", marginTop: "2px" }}>
                                {saidaCasada.hora}
                              </div>
                              <div style={{ fontSize: "11px", color: "#94a3b8" }}>
                                {saidaCasada.origem}
                              </div>
                            </div>

                            <button
                              onClick={() => descasarPonto(ent.id)}
                              style={{
                                background: "rgba(255,255,255,0.08)",
                                border: "1px solid rgba(255,255,255,0.15)",
                                color: isAuditado ? "#cbd5e1" : "#f87171",
                                borderRadius: "8px",
                                padding: "6px 10px",
                                fontSize: "11px",
                                fontWeight: "800",
                                cursor: "pointer"
                              }}
                              title={isAuditado ? "Reabrir par para reauditoria" : "Desfazer Casamento"}
                            >
                              {isAuditado ? "✂️ Reabrir Par" : "✂️ Descasar"}
                            </button>
                          </div>
                        ) : (
                          <div
                            onDragOver={(e) => handleDragOver(e, ent.id)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, ent.id)}
                            style={{
                              border: `2px dashed ${isOver ? "#c084fc" : "rgba(255, 255, 255, 0.2)"}`,
                              background: isOver ? "rgba(168, 85, 247, 0.15)" : "rgba(0, 0, 0, 0.2)",
                              borderRadius: "12px",
                              padding: "16px",
                              textAlign: "center",
                              color: isOver ? "#c084fc" : "#94a3b8",
                              fontSize: "12px",
                              fontWeight: "700",
                              transition: "all 0.2s"
                            }}
                          >
                            {isOver ? "🎯 Solte a Saída Aqui para Casar!" : "📥 Arraste uma saída da direita e solte aqui"}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* GAVETA DE EVIDÊNCIAS INTERMEDIÁRIAS (Se não tem saída casada) */}
                    {!saidaCasada && (
                      <div style={{
                        marginTop: "16px",
                        paddingTop: "14px",
                        borderTop: "1px solid rgba(255,255,255,0.08)"
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", flexWrap: "wrap", gap: "8px" }}>
                          <span style={{ fontSize: "12px", fontWeight: "800", color: "#38bdf8", display: "flex", alignItems: "center", gap: "6px" }}>
                            🔍 Âncoras de Atividade Detectadas no Intervalo
                          </span>
                          <button
                            onClick={() => criarSaida1Minuto(ent.id, ent.hora)}
                            style={{
                              background: "rgba(239,68,68,0.12)",
                              border: "1px solid rgba(239,68,68,0.3)",
                              color: "#f87171",
                              padding: "3px 8px",
                              borderRadius: "6px",
                              fontSize: "11px",
                              fontWeight: "700",
                              cursor: "pointer"
                            }}
                          >
                            ⏱️ Fechar com 1 Minuto (Crash sem trampo)
                          </button>
                        </div>

                        {ent.atividades && ent.atividades.length > 0 ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            {ent.atividades.map((atv) => (
                              <div
                                key={atv.id}
                                style={{
                                  background: atv.isUltima ? "rgba(56, 189, 248, 0.1)" : "rgba(255,255,255,0.03)",
                                  border: `1px solid ${atv.isUltima ? "rgba(56, 189, 248, 0.35)" : "rgba(255,255,255,0.06)"}`,
                                  padding: "8px 12px",
                                  borderRadius: "8px",
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  flexWrap: "wrap",
                                  gap: "8px"
                                }}
                              >
                                <span style={{ fontSize: "12px", color: "#e2e8f0" }}>
                                  <strong style={{ color: "#38bdf8" }}>[{atv.hora}]</strong> {atv.desc}
                                </span>

                                <button
                                  onClick={() => gerarSaidaPorAtividade(ent.id, atv)}
                                  style={{
                                    background: atv.isUltima
                                      ? "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)"
                                      : "rgba(255,255,255,0.08)",
                                    border: "none",
                                    color: "#fff",
                                    padding: "5px 12px",
                                    borderRadius: "6px",
                                    fontSize: "11px",
                                    fontWeight: "800",
                                    cursor: "pointer",
                                    boxShadow: atv.isUltima ? "0 2px 8px rgba(2,132,199,0.3)" : "none"
                                  }}
                                >
                                  {atv.isUltima ? `⚡ Criar Saída no Último Serviço (${atv.hora})` : `Usar este (${atv.hora})`}
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ fontSize: "12px", color: "#64748b", fontStyle: "italic", padding: "4px 0" }}>
                            Nenhuma tunagem ou compra de bancada registrada por este mecânico no intervalo.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Sessões já homologadas em log_ponto */}
          {sessoesExistentesVisiveis.length > 0 && (
            <div style={{
              marginTop: "24px",
              background: "rgba(15,23,42,0.6)",
              border: "1px solid rgba(16,185,129,0.25)",
              borderRadius: "14px",
              padding: "18px 22px"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
                <div style={{ fontSize: "13.5px", fontWeight: "800", color: "#34d399", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>🛡️</span> Sessões Homologadas Atualmente no Banco de Dados (`log_ponto`):
                </div>
                <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                  Total: {sessoesExistentesVisiveis.length} sessão(ões) persistidas
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {sessoesExistentesVisiveis.map((s, i) => (
                  <div
                    key={s.id || i}
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: "10px",
                      padding: "10px 14px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "10px"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                      <span style={{ fontWeight: "900", color: "#a855f7", fontSize: "12px" }}>
                        #{i + 1}
                      </span>
                      {s.data && (
                        <span style={{ fontSize: "10.5px", fontWeight: "800", color: "#c084fc", background: "rgba(168,85,247,0.18)", padding: "1px 6px", borderRadius: "4px" }}>
                          📅 {String(s.data).slice(8, 10)}/{String(s.data).slice(5, 7)}
                        </span>
                      )}
                      <span style={{ color: "#e2e8f0", fontSize: "13px", fontWeight: "700" }}>
                        🟢 {s.horaEntradaFormatada || s.entrada?.slice(11, 19) || "—"} ➔ 🔴 {s.horaSaidaFormatada || s.saida?.slice(11, 19) || "—"}
                      </span>
                      <span style={{ background: "rgba(16,185,129,0.15)", color: "#34d399", fontSize: "11.5px", fontWeight: "800", padding: "2px 8px", borderRadius: "6px" }}>
                        ⏱️ {s.total_minutos} min
                      </span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <code style={{
                        background: "rgba(168,85,247,0.12)",
                        color: "#c084fc",
                        padding: "2px 8px",
                        borderRadius: "6px",
                        fontSize: "11px",
                        fontWeight: "700"
                      }}>
                        {s.tipo_fechamento}
                      </code>
                      <span style={{
                        background: "rgba(16,185,129,0.15)",
                        border: "1px solid rgba(16,185,129,0.3)",
                        color: "#34d399",
                        fontSize: "10.5px",
                        fontWeight: "800",
                        padding: "2px 8px",
                        borderRadius: "12px"
                      }}>
                        ✅ Gravado
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* COLUNA DIREITA: Banco de Saídas Disponíveis */}
        <div>
          <div style={{ marginBottom: "14px" }}>
            <h2 style={{ fontSize: "15px", fontWeight: "800", color: "#cbd5e1", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#ef4444" }} />
              Banco de Saídas ({saidasVisiveis.length})
            </h2>
            <span style={{ fontSize: "12px", color: "#64748b" }}>
              Arraste para os slots da esquerda
            </span>
          </div>

          {saidasVisiveis.length === 0 ? (
            <div style={{
              background: "rgba(15, 23, 42, 0.4)",
              border: "1px dashed rgba(255,255,255,0.1)",
              borderRadius: "14px",
              padding: "24px 16px",
              textAlign: "center",
              fontSize: "12px",
              color: "#64748b"
            }}>
              Nenhuma saída encontrada neste período.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {saidasVisiveis.map((sai) => {
                const estaCasada = Boolean(sai.pareadoCom);
                const entradaPareada = sai.pareadoCom ? entradas.find((e) => e.id === sai.pareadoCom) : null;
                const foiAuditada = Boolean(entradaPareada?.auditado || sai.auditado);

                return (
                  <div
                    key={sai.id}
                    draggable={!estaCasada}
                    onDragStart={(e) => handleDragStart(e, sai.id)}
                    style={{
                      background: foiAuditada
                        ? "rgba(16, 185, 129, 0.08)"
                        : estaCasada
                        ? "rgba(245, 158, 11, 0.08)"
                        : "rgba(239, 68, 68, 0.12)",
                      border: `1.5px solid ${
                        foiAuditada
                          ? "rgba(16, 185, 129, 0.35)"
                          : estaCasada
                          ? "rgba(245, 158, 11, 0.35)"
                          : "rgba(239, 68, 68, 0.4)"
                      }`,
                      borderRadius: "14px",
                      padding: "14px 16px",
                      cursor: estaCasada ? "default" : "grab",
                      opacity: estaCasada ? 0.75 : 1,
                      transition: "all 0.2s",
                      boxShadow: estaCasada ? "none" : "0 4px 12px rgba(239,68,68,0.15)"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{
                        fontSize: "11px",
                        fontWeight: "900",
                        color: foiAuditada ? "#34d399" : estaCasada ? "#fbbf24" : "#f87171"
                      }}>
                        {foiAuditada ? "🛡️ Homologada em Banco" : estaCasada ? "🔒 Casada (Pendente)" : "✋ Disponível (Arraste)"}
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        {sai.data && (
                          <span style={{ fontSize: "10px", fontWeight: "800", color: "#c084fc", background: "rgba(168,85,247,0.18)", padding: "1px 6px", borderRadius: "4px" }}>
                            📅 {sai.data.slice(8, 10)}/{sai.data.slice(5, 7)}
                          </span>
                        )}
                        <span style={{ fontSize: "10px", color: "#64748b" }}>
                          {sai.id}
                        </span>
                      </div>
                    </div>

                    <div style={{ fontSize: "22px", fontWeight: "900", color: "#fff", marginTop: "4px" }}>
                      {sai.hora}
                    </div>

                    <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "4px" }}>
                      {sai.origem}
                    </div>

                    {!estaCasada && (
                      <div style={{ marginTop: "10px", paddingTop: "8px", borderTop: "1px dashed rgba(239,68,68,0.25)", fontSize: "11px", color: "#fca5a5", display: "flex", alignItems: "center", gap: "6px" }}>
                        <span>↔️</span> Arraste para o card de entrada órfão
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Dicas da Ferramenta */}
          <div style={{
            marginTop: "20px",
            background: "rgba(255, 255, 255, 0.03)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "12px",
            padding: "14px",
            fontSize: "12px",
            color: "#94a3b8",
            lineHeight: "1.5"
          }}>
            <strong style={{ color: "#fff", display: "block", marginBottom: "6px" }}>💡 Recursos da Ferramenta:</strong>
            • <strong>Drag & Drop:</strong> Arraste saídas soltas para conectar a qualquer entrada.<br/>
            • <strong>Âncoras de Trabalho:</strong> Em caso de crash, use o botão azul para fechar o ponto no segundo exato em que o mecânico tunou um veículo.<br/>
            • <strong>Gravação Segura:</strong> Clicar em &quot;Gravar Sessões&quot; salva o resultado validado em <code>log_ponto</code>.
          </div>
        </div>
      </div>
    </div>
  );
}
