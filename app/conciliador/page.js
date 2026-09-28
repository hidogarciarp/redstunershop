"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
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

function formatarTempoXHXM(minutos) {
  const m = Math.max(0, Math.round(minutos || 0));
  const h = Math.floor(m / 60);
  const restM = m % 60;
  return `+${h}H${String(restM).padStart(2, "0")}M`;
}

function isLogSaidaDiscord(saida, entrada) {
  if (!saida) return false;
  if (saida.geradoPorLog) return false;
  const uuid = String(saida.uuid || "");
  if (uuid.startsWith("CRASH_") || uuid.startsWith("AUTO_") || uuid.startsWith("concil-sai-")) {
    return false;
  }
  const origem = String(saida.origem || "").toLowerCase();
  if (origem.includes("crash") || origem.includes("âncora") || origem.includes("ancora") || origem.includes("1 minuto")) {
    return false;
  }
  if (origem === "sessão gravada em banco" || origem === "validado por responsável" || origem === "âncora de atividade / crash") {
    return false;
  }
  const idStr = String(saida.id || "");
  if (idStr.startsWith("sai-rec-") && !origem.includes("discord")) {
    return false;
  }
  const raw = String(saida.raw || "");
  if (origem.includes("discord") || raw.includes("SAIU DE SERVIÇO")) {
    return true;
  }
  return false;
}

function isAncoraAutomatica(saida) {
  if (!saida) return false;
  if (saida.geradoPorLog) return true;
  const idStr = String(saida.id || "");
  if (idStr.startsWith("sai-auto-") || idStr.startsWith("sai-1min-") || idStr.startsWith("concil-sai-")) {
    return true;
  }
  const tipoFechamento = String(saida.tipoFechamento || "");
  if (tipoFechamento.includes("CRASH")) return true;
  const origem = String(saida.origem || "").toLowerCase();
  if (origem.includes("crash") || origem.includes("âncora") || origem.includes("ancora") || origem.includes("1 minuto")) {
    return true;
  }
  return !isLogSaidaDiscord(saida);
}

function getRealDate(item, fallbackDate = "") {
  if (item?.dataOriginal) return item.dataOriginal;
  if (item?.timestampz) {
    const d = new Date(item.timestampz);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    }
  }
  const baseData = item?.data || fallbackDate;
  if (baseData && item?.hora && item.hora < "09:00:00") {
    const [a, m, d] = baseData.split("-").map(Number);
    const dProx = new Date(a, m - 1, d + 1);
    return `${dProx.getFullYear()}-${String(dProx.getMonth() + 1).padStart(2, "0")}-${String(dProx.getDate()).padStart(2, "0")}`;
  }
  return baseData;
}

function getTimestampMs(item, fallbackDate = "") {
  if (!item) return 0;
  const d = getRealDate(item, fallbackDate);
  let baseMs = 0;
  if (d && item.hora) {
    const t = new Date(`${d}T${item.hora}-03:00`).getTime();
    if (!isNaN(t)) baseMs = t;
  }
  if (!baseMs && item.timestampz) {
    const t = new Date(item.timestampz).getTime();
    if (!isNaN(t)) baseMs = t;
  }
  if (baseMs && item.timestampz) {
    const ms = new Date(item.timestampz).getMilliseconds();
    if (!isNaN(ms)) baseMs += ms;
  }
  return baseMs;
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

  const [mensagem, setMensagem] = useState(null);
  const [entradaSelecionadaId, setEntradaSelecionadaId] = useState(null);
  const [janelaOperacional, setJanelaOperacional] = useState(null);
  const [saidaDetalhesModal, setSaidaDetalhesModal] = useState(null);
  const [copiadoUuid, setCopiadoUuid] = useState(false);
  const [equipePeriodo, setEquipePeriodo] = useState([]);
  const [filtroStatusEquipe, setFiltroStatusEquipe] = useState("todos"); // "todos" | "pendente" | "avaliado"
  const [buscaEquipe, setBuscaEquipe] = useState("");

  const copiarParaClipboard = (texto) => {
    if (!texto) return;
    navigator.clipboard?.writeText(texto);
    setCopiadoUuid(true);
    setTimeout(() => setCopiadoUuid(false), 2000);
  };

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
        if (json.equipePeriodo) {
          setEquipePeriodo(json.equipePeriodo);
        }
        setDiasDaSemana(json.diasDaSemana || []);
        setResumoSemanal(json.resumoSemanal || null);
        setSessoesExistentes(json.sessoesExistentes || []);
        setAtividadesGerais(json.atividades || []);
        setJanelaOperacional(json.janelaOperacional || null);

        if (md === "semana") {
          const todasEnts = (json.diasDaSemana || []).flatMap((d) => d.entradas || []);
          const rawSais = (json.diasDaSemana || []).flatMap((d) => d.saidas || []);
          const saisMap = new Map();
          rawSais.forEach((s) => {
            const key = (s.uuid && !s.uuid.startsWith("CRASH_") && !s.uuid.startsWith("AUTO_")) ? s.uuid : s.id;
            if (!saisMap.has(key)) {
              saisMap.set(key, s);
            } else {
              const existente = saisMap.get(key);
              if (!existente.pareadoCom && s.pareadoCom) {
                saisMap.set(key, s);
              }
            }
          });
          setEntradas(todasEnts.sort((a, b) => getTimestampMs(a) - getTimestampMs(b)));
          setSaidas(Array.from(saisMap.values()).sort((a, b) => getTimestampMs(a) - getTimestampMs(b)));
        } else {
          setEntradas((json.entradas || []).sort((a, b) => getTimestampMs(a) - getTimestampMs(b)));
          setSaidas((json.saidas || []).sort((a, b) => getTimestampMs(a) - getTimestampMs(b)));
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
    const ent = entradas.find((e) => e.id === entradaId);
    const saidaAnteriorId = ent?.saidaId;

    setEntradas((prev) =>
      prev.map((e) => {
        if (e.id === entradaId) return { ...e, saidaId, auditado: false };
        if (e.saidaId === saidaId) return { ...e, saidaId: null, auditado: false };
        return e;
      })
    );
    setSaidas((prev) => {
      let filtradas = prev;
      // Se a entrada já possuía uma âncora automática e estamos casando com outra saída, a âncora antiga some!
      if (saidaAnteriorId && saidaAnteriorId !== saidaId) {
        filtradas = filtradas.filter((s) => s.id !== saidaAnteriorId || !isAncoraAutomatica(s));
      }
      return filtradas.map((s) => {
        if (s.id === saidaId) return { ...s, pareadoCom: entradaId };
        if (s.pareadoCom === entradaId) return { ...s, pareadoCom: null };
        return s;
      });
    });
    mostrarAviso("🔗 Sessão casada! Lembre-se de gravar para homologar.");
  };

  const descasarPonto = (entradaId) => {
    const ent = entradas.find((e) => e.id === entradaId);
    if (!ent) return;
    const saidaId = ent.saidaId || saidas.find((s) => s.pareadoCom === entradaId)?.id;
    const saidaAlvo = saidas.find((s) => s.id === saidaId);
    const ehAncora = isAncoraAutomatica(saidaAlvo);

    setEntradas((prev) =>
      prev.map((e) =>
        e.id === entradaId || (saidaId && e.saidaId === saidaId)
          ? { ...e, saidaId: null, auditado: false, tipoFechamento: null }
          : e
      )
    );
    setSaidas((prev) => {
      if (ehAncora) {
        // Ao descartar / descasar a âncora automática, ela deve sumir completamente!
        return prev.filter((s) => s.id !== saidaId);
      }
      // Se for saída oficial do Discord, ela volta para o banco de saídas livres
      return prev.map((s) => (s.id === saidaId || s.pareadoCom === entradaId ? { ...s, pareadoCom: null } : s));
    });
    mostrarAviso(
      ehAncora
        ? "🗑️ Âncora automática descartada e removida!"
        : "✂️ Pareamento desfeito. Saída retornou para o banco de saídas livres."
    );
  };

  const descasarSaida = (saidaId) => {
    const sai = saidas.find((s) => s.id === saidaId);
    if (!sai) return;
    const ehAncora = isAncoraAutomatica(sai);
    const entradaId = sai.pareadoCom;

    setEntradas((prev) =>
      prev.map((e) =>
        e.id === entradaId || e.saidaId === saidaId
          ? { ...e, saidaId: null, auditado: false, tipoFechamento: null }
          : e
      )
    );
    setSaidas((prev) => {
      if (ehAncora) {
        return prev.filter((s) => s.id !== saidaId);
      }
      return prev.map((s) => (s.id === saidaId ? { ...s, pareadoCom: null } : s));
    });
    mostrarAviso(
      ehAncora
        ? "🗑️ Âncora automática descartada e removida!"
        : "✂️ Pareamento desfeito. Saída retornou para o banco de saídas livres."
    );
  };

  const descasarTodosPares = () => {
    if (entradasVisiveis.length === 0) return;
    const sessoesCasadasCount = entradasVisiveis.filter((e) => e.saidaId).length;
    if (sessoesCasadasCount === 0) {
      mostrarAviso("ℹ️ Não há sessões casadas para descasar.", "info");
      return;
    }

    if (!window.confirm(`Deseja realmente descasar todos os ${sessoesCasadasCount} turnos em exibição para verificação manual?`)) {
      return;
    }

    const idsEntradasVisiveis = new Set(entradasVisiveis.map((e) => e.id));
    const idsSaidasCasadas = new Set(
      entradasVisiveis.map((e) => e.saidaId).filter(Boolean)
    );

    setEntradas((prev) =>
      prev.map((e) =>
        idsEntradasVisiveis.has(e.id)
          ? { ...e, saidaId: null, auditado: false, tipoFechamento: null }
          : e
      )
    );

    setSaidas((prev) =>
      prev
        .filter((s) => !idsSaidasCasadas.has(s.id) || !isAncoraAutomatica(s))
        .map((s) =>
          idsSaidasCasadas.has(s.id) || (s.pareadoCom && idsEntradasVisiveis.has(s.pareadoCom))
            ? { ...s, pareadoCom: null }
            : s
        )
    );

    mostrarAviso(`✂️ Todos os ${sessoesCasadasCount} turnos em exibição foram descasados para auditoria manual!`);
  };

  const descartarAncora = (saidaId) => {
    setSaidas((prev) => prev.filter((s) => s.id !== saidaId));
    setEntradas((prev) =>
      prev.map((e) => (e.saidaId === saidaId ? { ...e, saidaId: null, auditado: false, tipoFechamento: null } : e))
    );
    mostrarAviso("🗑️ Âncora descartada e removida!");
  };

  const gerarSaidaPorAtividade = (entradaId, atividade) => {
    const ent = entradas.find((e) => e.id === entradaId);
    const dataRef = atividade.data || ent?.data || dataFiltro;
    const dataOriginal = atividade.dataOriginal || getRealDate(atividade, dataRef) || getRealDate(ent, dataRef);
    const novaSaidaId = `sai-auto-${Date.now()}`;
    const novaSaida = {
      id: novaSaidaId,
      uuid: novaSaidaId,
      data: dataRef,
      dataOriginal,
      hora: atividade.hora,
      timestampz: atividade.timestampz || (dataOriginal && atividade.hora ? new Date(`${dataOriginal}T${atividade.hora}-03:00`).toISOString() : null),
      tipo: "saida",
      origem: `Âncora Automática (${atividade.tipo === "tunagem" ? "Tunagem" : "Bancada"})`,
      pareadoCom: entradaId,
      geradoPorLog: true,
      tipoFechamento: "CRASH_COM_ATIVIDADE",
      atividadeRef: atividade.desc,
    };

    const saidaAnteriorId = ent?.saidaId;

    setSaidas((prev) => {
      const filtradas = saidaAnteriorId
        ? prev.filter((s) => s.id !== saidaAnteriorId || !isAncoraAutomatica(s))
        : prev;
      return [novaSaida, ...filtradas];
    });
    setEntradas((prev) =>
      prev.map((e) => (e.id === entradaId ? { ...e, saidaId: novaSaidaId, auditado: false, tipoFechamento: "CRASH_COM_ATIVIDADE" } : e))
    );
    mostrarAviso(`⚡ Saída criada no horário do serviço (${atividade.hora})! Clique em Gravar para homologar.`);
  };

  const criarSaida1Minuto = (entradaId, horaEntrada) => {
    const ent = entradas.find((e) => e.id === entradaId);
    const dataRef = ent?.data || dataFiltro;

    // Garante que a data de calendário real da saída seja idêntica à da entrada (ou D+1 caso vire meia-noite)
    const dataCalEntrada = getRealDate(ent, dataRef);
    const [h, m, s] = (horaEntrada || "00:00:00").split(":").map(Number);
    let totalS = h * 3600 + (m + 1) * 60 + (s || 0);

    let dataCalSaida = dataCalEntrada;
    if (totalS >= 24 * 3600) {
      totalS -= 24 * 3600;
      const [a, mo, d] = dataCalEntrada.split("-").map(Number);
      const dProx = new Date(a, mo - 1, d + 1);
      dataCalSaida = `${dProx.getFullYear()}-${String(dProx.getMonth() + 1).padStart(2, "0")}-${String(dProx.getDate()).padStart(2, "0")}`;
    }

    const nH = String(Math.floor(totalS / 3600)).padStart(2, "0");
    const nM = String(Math.floor((totalS % 3600) / 60)).padStart(2, "0");
    const nS = String(totalS % 60).padStart(2, "0");
    const horaCalculada = `${nH}:${nM}:${nS}`;

    const novaSaidaId = `sai-1min-${Date.now()}`;
    const isoCalculado = new Date(`${dataCalSaida}T${horaCalculada}-03:00`).toISOString();

    const novaSaida = {
      id: novaSaidaId,
      uuid: novaSaidaId,
      data: dataRef,
      dataOriginal: dataCalSaida,
      timestampz: isoCalculado,
      hora: horaCalculada,
      tipo: "saida",
      origem: "Crash sem atividade (1 Minuto)",
      pareadoCom: entradaId,
      geradoPorLog: true,
      tipoFechamento: "CRASH_SEM_ATIVIDADE",
    };

    const saidaAnteriorId = ent?.saidaId;

    setSaidas((prev) => {
      const filtradas = saidaAnteriorId
        ? prev.filter((s) => s.id !== saidaAnteriorId || !isAncoraAutomatica(s))
        : prev;
      return [novaSaida, ...filtradas];
    });
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
      let qtdTunagens = 0;
      let qtdBancada = 0;
      if (sai) {
        const tIni = e.timestampz ? new Date(e.timestampz).getTime() : new Date(`${e.data || dataFiltro}T${e.hora}-03:00`).getTime();
        const tSai = sai.timestampz ? new Date(sai.timestampz).getTime() : new Date(`${sai.dataOriginal || sai.data || dataFiltro}T${sai.hora}-03:00`).getTime();
        const atvs = atividadesDoPeriodo.filter((atv) => {
          const tAtv = atv.timestampz ? new Date(atv.timestampz).getTime() : new Date(`${atv.data || dataFiltro}T${atv.hora}-03:00`).getTime();
          return tAtv >= tIni - 5 * 60 * 1000 && tAtv <= tSai + 10 * 60 * 1000;
        });
        qtdTunagens = atvs.filter((a) => a.tipo === "tunagem").length;
        qtdBancada = atvs.filter((a) => a.tipo === "bancada").length;
      }

      return {
        data: e.data || dataFiltro,
        horaEntrada: e.hora,
        horaSaida: sai?.hora || e.hora,
        uuidEntrada: e.uuid,
        uuidSaida: sai?.uuid || sai?.id,
        qtdTunagens,
        qtdBancada,
        totalAtividades: qtdTunagens + qtdBancada,
        tipoFechamento: isLogSaidaDiscord(sai, e)
          ? (sai?.tipoFechamento && !sai.tipoFechamento.includes("CRASH") ? sai.tipoFechamento : "NORMAL")
          : (sai?.tipoFechamento || (sai?.geradoPorLog ? "CRASH_COM_ATIVIDADE" : "VALIDADO_CONCILIADOR")),
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

  // Filtragem de entradas e saídas ativas conforme o foco de visualização
  const entradasVisiveis = entradas.filter((e) => {
    if (modo === "semana" && diaAtivoNaSemana !== "todos") {
      return e.data === diaAtivoNaSemana;
    }
    return true;
  });

  const saidasDoPeriodo = saidas.filter((s) => {
    // Âncoras automáticas só existem enquanto estiverem atreladas a uma sessão. Se foi descartada/descasada, ela some!
    if (isAncoraAutomatica(s) && !s.pareadoCom) {
      return false;
    }
    if (modo === "semana" && diaAtivoNaSemana !== "todos") {
      return s.data === diaAtivoNaSemana;
    }
    return true;
  });

  const atividadesDoPeriodo = useMemo(() => {
    return atividadesGerais.filter((a) => {
      if (modo === "semana" && diaAtivoNaSemana !== "todos") {
        return a.data === diaAtivoNaSemana;
      }
      return true;
    });
  }, [atividadesGerais, modo, diaAtivoNaSemana]);

  const sessoesCasadasLista = useMemo(() => {
    const sessoes = [];
    entradasVisiveis.forEach((ent, idx) => {
      if (ent.saidaId) {
        const sai = saidas.find((s) => s.id === ent.saidaId);
        if (sai) {
          const tIni = ent.timestampz ? new Date(ent.timestampz).getTime() : new Date(`${ent.data || dataFiltro}T${ent.hora}-03:00`).getTime();
          const tFim = sai.timestampz ? new Date(sai.timestampz).getTime() : new Date(`${sai.dataOriginal || sai.data || dataFiltro}T${sai.hora}-03:00`).getTime();
          const duracaoMin = calcularDuracao(ent.hora, sai.hora);

          const atvsSessao = atividadesDoPeriodo.filter((atv) => {
            const tAtv = atv.timestampz ? new Date(atv.timestampz).getTime() : new Date(`${atv.data || dataFiltro}T${atv.hora}-03:00`).getTime();
            return tAtv >= tIni - 5 * 60 * 1000 && tAtv <= tFim + 10 * 60 * 1000;
          });
          const qtdServicos = atvsSessao.length;
          const isDiscord = isLogSaidaDiscord(sai, ent);
          const isMenor30 = duracaoMin < 30;
          // Destacar em vermelho apenas quando a saída for por log do Discord! Se for por crash, não deixa em vermelho.
          const isIrregularGrave = isMenor30 && qtdServicos > 0 && isDiscord;
          const isIrregularCurto = isMenor30 && qtdServicos === 0 && isDiscord;

          sessoes.push({
            sessaoNumero: idx + 1,
            entradaId: ent.id,
            saidaId: sai.id,
            tIni,
            tFim,
            duracaoMin,
            qtdServicos,
            isMenor30,
            isIrregularGrave,
            isIrregularCurto,
            isDiscord,
          });
        }
      }
    });
    return sessoes;
  }, [entradasVisiveis, saidas, dataFiltro, atividadesDoPeriodo]);

  const eventosLinhaDoTempo = useMemo(() => {
    const lista = [];

    // 1. Entradas (Coluna 0)
    entradasVisiveis.forEach((ent) => {
      const realData = getRealDate(ent, dataFiltro);
      lista.push({
        id: `tl-ent-${ent.id}`,
        tipo: "entrada",
        coluna: 0,
        hora: ent.hora,
        data: realData,
        timestampMs: getTimestampMs(ent, dataFiltro),
        obj: ent,
      });
    });

    // 2. Bancadas (Coluna 1)
    atividadesDoPeriodo
      .filter((a) => a.tipo === "bancada")
      .forEach((b) => {
        const realData = getRealDate(b, dataFiltro);
        lista.push({
          id: `tl-banc-${b.id || Math.random()}`,
          tipo: "bancada",
          coluna: 1,
          hora: b.hora,
          data: realData,
          timestampMs: getTimestampMs(b, dataFiltro),
          obj: b,
        });
      });

    // 3. Tunagens (Coluna 2)
    atividadesDoPeriodo
      .filter((a) => a.tipo === "tunagem")
      .forEach((t) => {
        const realData = getRealDate(t, dataFiltro);
        lista.push({
          id: `tl-tun-${t.id || Math.random()}`,
          tipo: "tunagem",
          coluna: 2,
          hora: t.hora,
          data: realData,
          timestampMs: getTimestampMs(t, dataFiltro),
          obj: t,
        });
      });

    // 4. Saídas (Coluna 3)
    saidasDoPeriodo.forEach((sai) => {
      const realData = getRealDate(sai, dataFiltro);
      lista.push({
        id: `tl-sai-${sai.id}`,
        tipo: "saida",
        coluna: 3,
        hora: sai.hora,
        data: realData,
        timestampMs: getTimestampMs(sai, dataFiltro),
        obj: sai,
      });
    });

    const PRIORIDADE_TIPO = {
      entrada: 1,
      bancada: 2,
      tunagem: 3,
      saida: 4,
    };

    return lista.sort((a, b) => {
      // Invariante de sessão casada: dentro do mesmo turno, a entrada sempre precede a saída
      if ((a.tipo === "entrada" && b.tipo === "saida") || (a.tipo === "saida" && b.tipo === "entrada")) {
        const entEv = a.tipo === "entrada" ? a : b;
        const saiEv = a.tipo === "saida" ? a : b;
        const ehMesmaSessao = sessoesCasadasLista.some(
          (s) => s.entradaId === entEv.obj.id && s.saidaId === saiEv.obj.id
        );
        if (ehMesmaSessao) {
          return a.tipo === "entrada" ? -1 : 1;
        }
      }

      // 1. Comparar pelo segundo do evento
      const segA = Math.floor(a.timestampMs / 1000);
      const segB = Math.floor(b.timestampMs / 1000);
      if (segA !== segB) {
        return segA - segB;
      }

      // 2. No mesmo segundo:
      // Exceção: quando uma saída encerra um turno anterior (iniciado em momento anterior)
      // e uma entrada inicia um novo turno neste mesmo segundo, a saída anterior vem antes da nova entrada.
      if ((a.tipo === "saida" && b.tipo === "entrada") || (a.tipo === "entrada" && b.tipo === "saida")) {
        const saiEv = a.tipo === "saida" ? a : b;
        const entEv = a.tipo === "entrada" ? a : b;
        const sessaoDaSaida = sessoesCasadasLista.find((s) => s.saidaId === saiEv.obj.id);

        if (sessaoDaSaida && sessaoDaSaida.tIni < saiEv.timestampMs - 1000 && sessaoDaSaida.entradaId !== entEv.obj.id) {
          return a.tipo === "saida" ? -1 : 1;
        }
      }

      // Ordem padrão de cima para baixo: Entrada (1) -> Bancada (2) -> Tunagem (3) -> Saída (4)
      const pA = PRIORIDADE_TIPO[a.tipo] || 0;
      const pB = PRIORIDADE_TIPO[b.tipo] || 0;
      if (pA !== pB) {
        return pA - pB;
      }

      return a.timestampMs - b.timestampMs;
    });
  }, [entradasVisiveis, atividadesDoPeriodo, saidasDoPeriodo, dataFiltro, sessoesCasadasLista]);

  // Vincula cada linha do tempo à sua sessão sequencialmente, eliminando lacunas por milissegundos
  const eventosLinhaDoTempoComSessao = useMemo(() => {
    let sessaoCorrente = null;

    return eventosLinhaDoTempo.map((ev) => {
      // 1. Entrada que inicia uma sessão casada
      const sessaoIniciando = sessoesCasadasLista.find(
        (s) => ev.tipo === "entrada" && ev.obj.id === s.entradaId
      );

      if (sessaoIniciando) {
        sessaoCorrente = sessaoIniciando;
        return {
          ...ev,
          sessaoAtiva: sessaoIniciando,
          isInicioSessao: true,
          isFimSessao: false,
        };
      }

      // 2. Saída que encerra uma sessão casada
      const sessaoFechando = sessoesCasadasLista.find(
        (s) => ev.tipo === "saida" && ev.obj.id === s.saidaId
      );
      if (sessaoFechando) {
        sessaoCorrente = null;
        return {
          ...ev,
          sessaoAtiva: sessaoFechando,
          isInicioSessao: false,
          isFimSessao: true,
        };
      }

      // 3. Atividades (bancadas, tunagens) dentro do período da sessão corrente
      if (sessaoCorrente) {
        return {
          ...ev,
          sessaoAtiva: sessaoCorrente,
          isInicioSessao: false,
          isFimSessao: false,
        };
      }

      // 4. Fora de qualquer sessão
      return {
        ...ev,
        sessaoAtiva: null,
        isInicioSessao: false,
        isFimSessao: false,
      };
    });
  }, [eventosLinhaDoTempo, sessoesCasadasLista]);

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

  const renderTrilha4Colunas = () => {
    const turnosResumo = entradasVisiveis.map((ent, idx) => {
      const tNum = idx + 1;
      const sai = ent.saidaId ? saidas.find((s) => s.id === ent.saidaId) : null;
      const isCasada = Boolean(sai);
      const duracaoMin = sai ? calcularDuracao(ent.hora, sai.hora) : null;
      const isDiscord = sai ? isLogSaidaDiscord(sai, ent) : false;
      const isAncora = sai ? isAncoraAutomatica(sai) : false;

      let atvsDoTurno = [];
      if (sai) {
        const tIni = ent.timestampz ? new Date(ent.timestampz).getTime() : new Date(`${ent.data || dataFiltro}T${ent.hora}-03:00`).getTime();
        const tSai = sai.timestampz ? new Date(sai.timestampz).getTime() : new Date(`${sai.dataOriginal || sai.data || dataFiltro}T${sai.hora}-03:00`).getTime();
        atvsDoTurno = atividadesDoPeriodo.filter((atv) => {
          const tAtv = atv.timestampz ? new Date(atv.timestampz).getTime() : new Date(`${atv.data || dataFiltro}T${atv.hora}-03:00`).getTime();
          return tAtv >= tIni - 5 * 60 * 1000 && tAtv <= tSai + 10 * 60 * 1000;
        });
      }
      const qtdServicos = atvsDoTurno.length;
      const isMenor30 = isCasada && duracaoMin !== null && duracaoMin < 30;
      // Irregularidade (<30m) só se aplica quando a saída foi deliberada via log do Discord, nunca por crash
      const isIrregularGrave = isMenor30 && qtdServicos > 0 && isDiscord;
      const isIrregularCurto = isMenor30 && qtdServicos === 0 && isDiscord;

      return {
        tNum,
        entradaId: ent.id,
        saidaId: sai?.id,
        horaEntrada: ent.hora,
        horaSaida: sai?.hora,
        duracaoMin,
        duracaoTexto: duracaoMin !== null ? formatarTempoXHXM(duracaoMin) : "Sem Saída",
        isCasada,
        isDiscord,
        isAncora,
        auditado: Boolean(ent.auditado),
        qtdServicos,
        isMenor30,
        isIrregularGrave,
        isIrregularCurto,
      };
    });

    const totalMinutosTurnos = turnosResumo.reduce((acc, t) => acc + (t.duracaoMin || 0), 0);
    const totalFormatado = formatarTempoXHXM(totalMinutosTurnos);

    const irregularesCount = equipePeriodo.filter((m) => {
      const isSelected = String(m.id) === String(usuarioId);
      const temGrave = isSelected ? turnosResumo.some((t) => t.isIrregularGrave) : Boolean(m.temTurnoCurtoComServico);
      const temCurto = isSelected ? turnosResumo.some((t) => t.isIrregularCurto) : Boolean(m.temTurnoCurtoSemServico);
      return temGrave || temCurto;
    }).length;

    // Filtragem dos funcionários para a coluna esquerda
    const equipeFiltrada = equipePeriodo.filter((m) => {
      const isSelected = String(m.id) === String(usuarioId);
      const temGrave = isSelected ? turnosResumo.some((t) => t.isIrregularGrave) : Boolean(m.temTurnoCurtoComServico);
      const temCurto = isSelected ? turnosResumo.some((t) => t.isIrregularCurto) : Boolean(m.temTurnoCurtoSemServico);

      if (filtroStatusEquipe === "irregulares") {
        if (!temGrave && !temCurto) return false;
      } else if (filtroStatusEquipe !== "todos" && m.status !== filtroStatusEquipe) {
        return false;
      }
      if (buscaEquipe.trim()) {
        const termo = buscaEquipe.toLowerCase().trim();
        return m.nome.toLowerCase().includes(termo) || (m.cargoLabel && m.cargoLabel.toLowerCase().includes(termo));
      }
      return true;
    });

    const totalEquipe = equipePeriodo.length;
    const pendentesCount = equipePeriodo.filter((m) => m.status === "pendente").length;
    const avaliadosCount = equipePeriodo.filter((m) => m.status === "avaliado").length;

    return (
      <div style={{
        maxWidth: "1680px",
        margin: "0 auto",
        display: "grid",
        gridTemplateColumns: "260px 1fr 280px",
        gap: "18px",
        alignItems: "start"
      }}>
        {/* COLUNA ESQUERDA: Equipe no Ciclo (Sticky) */}
        <div style={{
          position: "sticky",
          top: "16px",
          maxHeight: "calc(100vh - 32px)",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          background: "linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.9) 100%)",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          borderRadius: "16px",
          padding: "14px",
          boxShadow: "0 12px 36px rgba(0,0,0,0.6)",
          backdropFilter: "blur(12px)",
          zIndex: 35
        }}>
          {/* Header da Equipe */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "16px" }}>🧑‍🔧</span>
              <span style={{ fontSize: "12.5px", fontWeight: "900", color: "#fff", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Equipe ({totalEquipe})
              </span>
            </div>
            <span style={{
              fontSize: "10.5px",
              fontWeight: "800",
              color: pendentesCount === 0 ? "#34d399" : "#fbbf24",
              background: pendentesCount === 0 ? "rgba(16,185,129,0.18)" : "rgba(245,158,11,0.18)",
              padding: "2px 7px",
              borderRadius: "8px"
            }}>
              {avaliadosCount}/{totalEquipe} Fechados
            </span>
          </div>

          {/* Campo de Busca Rápida */}
          <div style={{ position: "relative" }}>
            <input
              type="text"
              placeholder="🔍 Buscar mecânico..."
              value={buscaEquipe}
              onChange={(e) => setBuscaEquipe(e.target.value)}
              style={{
                width: "100%",
                background: "rgba(15, 23, 42, 0.7)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: "8px",
                padding: "6px 10px",
                fontSize: "11.5px",
                color: "#fff",
                outline: "none"
              }}
            />
            {buscaEquipe && (
              <button
                onClick={() => setBuscaEquipe("")}
                style={{
                  position: "absolute",
                  right: "8px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: "none",
                  color: "#94a3b8",
                  cursor: "pointer",
                  fontSize: "12px"
                }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Filtros por Status */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px", background: "rgba(10,15,29,0.6)", padding: "4px", borderRadius: "8px" }}>
            <button
              onClick={() => setFiltroStatusEquipe("todos")}
              style={{
                padding: "5px 3px",
                borderRadius: "6px",
                border: "none",
                fontSize: "10px",
                fontWeight: "800",
                cursor: "pointer",
                background: filtroStatusEquipe === "todos" ? "linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)" : "transparent",
                color: filtroStatusEquipe === "todos" ? "#fff" : "#94a3b8"
              }}
            >
              Todos ({totalEquipe})
            </button>
            <button
              onClick={() => setFiltroStatusEquipe("pendente")}
              style={{
                padding: "5px 3px",
                borderRadius: "6px",
                border: "none",
                fontSize: "10px",
                fontWeight: "800",
                cursor: "pointer",
                background: filtroStatusEquipe === "pendente" ? "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)" : "transparent",
                color: filtroStatusEquipe === "pendente" ? "#fff" : "#fbbf24"
              }}
            >
              ⚠️ Pendentes ({pendentesCount})
            </button>
            <button
              onClick={() => setFiltroStatusEquipe("avaliado")}
              style={{
                padding: "5px 3px",
                borderRadius: "6px",
                border: "none",
                fontSize: "10px",
                fontWeight: "800",
                cursor: "pointer",
                background: filtroStatusEquipe === "avaliado" ? "linear-gradient(135deg, #10b981 0%, #059669 100%)" : "transparent",
                color: filtroStatusEquipe === "avaliado" ? "#fff" : "#34d399"
              }}
            >
              ✅ Fechados ({avaliadosCount})
            </button>
            <button
              onClick={() => setFiltroStatusEquipe("irregulares")}
              style={{
                padding: "5px 3px",
                borderRadius: "6px",
                border: "none",
                fontSize: "10px",
                fontWeight: "800",
                cursor: "pointer",
                background: filtroStatusEquipe === "irregulares" ? "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)" : "transparent",
                color: filtroStatusEquipe === "irregulares" ? "#fff" : "#fbbf24"
              }}
            >
              ⚠️ &lt;30m ({irregularesCount})
            </button>
          </div>

          {/* Lista de Mecânicos */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", overflowY: "auto", maxHeight: "calc(100vh - 240px)", paddingRight: "2px" }}>
            {equipeFiltrada.length === 0 ? (
              <div style={{ fontSize: "11px", color: "#64748b", textAlign: "center", padding: "16px 8px" }}>
                Nenhum mecânico encontrado neste filtro.
              </div>
            ) : (
              equipeFiltrada.map((m) => {
                const isSelected = String(m.id) === String(usuarioId);
                const isAvaliado = m.status === "avaliado";
                const temGrave = isSelected ? turnosResumo.some(t => t.isIrregularGrave) : Boolean(m.temTurnoCurtoComServico);
                const temCurto = isSelected ? turnosResumo.some(t => t.isIrregularCurto) : Boolean(m.temTurnoCurtoSemServico);

                return (
                  <div
                    key={m.id}
                    onClick={() => {
                      if (String(m.id) !== String(usuarioId)) {
                        setUsuarioId(String(m.id));
                        carregarDadosReais(String(m.id), dataFiltro, modo, semanaOffset);
                      }
                    }}
                    style={{
                      background: isSelected
                        ? "linear-gradient(135deg, rgba(168,85,247,0.25) 0%, rgba(126,34,206,0.18) 100%)"
                        : "rgba(15, 23, 42, 0.65)",
                      border: isSelected
                        ? "1.5px solid #a855f7"
                        : "1px solid rgba(255, 255, 255, 0.08)",
                      borderRadius: "10px",
                      padding: "8px 10px",
                      cursor: "pointer",
                      boxShadow: isSelected
                        ? "0 0 16px rgba(168,85,247,0.35)"
                        : "none",
                      transition: "all 0.15s"
                    }}
                    title={temGrave ? `⚠️ ${m.nome}: Turno < 30m com serviços realizados (avaliar punição)` : temCurto ? `⚠️ ${m.nome}: Turno < 30m sem serviços` : `Clique para auditar a linha do tempo de ${m.nome}`}
                  >
                    {/* Linha 1: Nome + Cargo + Ícone discreto de Alerta */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "4px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "5px", overflow: "hidden" }}>
                        {temGrave ? (
                          <span title="Turno < 30m com serviços realizados (avaliar punição)" style={{ fontSize: "12px", cursor: "help" }}>⚠️</span>
                        ) : temCurto ? (
                          <span title="Turno < 30m sem serviços" style={{ fontSize: "11px", color: "#94a3b8", cursor: "help" }}>⚠️</span>
                        ) : null}
                        <span style={{
                          fontSize: "12px",
                          fontWeight: isSelected ? "900" : "800",
                          color: isSelected ? "#c084fc" : "#fff",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap"
                        }}>
                          {m.nome}
                        </span>
                      </div>
                      {m.cargoLabel && (
                        <span style={{
                          fontSize: "8.5px",
                          fontWeight: "800",
                          color: "#94a3b8",
                          background: "rgba(255,255,255,0.06)",
                          padding: "1px 5px",
                          borderRadius: "4px",
                          whiteSpace: "nowrap"
                        }}>
                          {m.cargoLabel}
                        </span>
                      )}
                    </div>

                    {/* Linha 2: Status Pill + Horas */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "5px", gap: "4px" }}>
                      <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                        <span style={{
                          fontSize: "9px",
                          fontWeight: "900",
                          color: isAvaliado ? "#34d399" : "#fbbf24",
                          background: isAvaliado ? "rgba(16,185,129,0.18)" : "rgba(245,158,11,0.18)",
                          border: `1px solid ${isAvaliado ? "rgba(16,185,129,0.35)" : "rgba(245,158,11,0.35)"}`,
                          padding: "1px 6px",
                          borderRadius: "6px"
                        }}>
                          {isAvaliado ? "✅ Avaliado" : "⚠️ Pendente"}
                        </span>
                      </div>

                      <span style={{
                        fontSize: "12px",
                        fontWeight: "900",
                        fontFamily: "monospace",
                        color: isAvaliado ? "#34d399" : "#cbd5e1"
                      }}>
                        {m.horasFormatadas}
                      </span>
                    </div>

                    {/* Linha 3: Detalhes pequenos */}
                    <div style={{ display: "flex", gap: "6px", fontSize: "9.5px", color: "#64748b", marginTop: "4px" }}>
                      <span>{m.sessoesBanco} sessões</span>
                      {(m.qtdTunagens > 0 || m.qtdBancada > 0) && (
                        <span>• {m.qtdTunagens} tun • {m.qtdBancada} craft</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* COLUNA CENTRAL: Trilha Temporal (4 Colunas) */}
        <div style={{ minWidth: 0 }}>
        {/* Banner Informativo do Ciclo Operacional 09h às 09h */}
        <div style={{
          background: "linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.7) 100%)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: "14px",
          padding: "14px 18px",
          marginBottom: "16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "22px" }}>🌅</span>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "14px", fontWeight: "900", color: "#fff" }}>
                  Ciclo Operacional: {janelaOperacional?.label || `09:00 de ${dataFiltro.slice(8, 10)}/${dataFiltro.slice(5, 7)} até 09:00 do dia seguinte`}
                </span>
                <span style={{ fontSize: "10px", fontWeight: "800", color: "#34d399", background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)", padding: "1px 6px", borderRadius: "10px" }}>
                  24 HORAS OPERACIONAIS
                </span>
              </div>
              <div style={{ fontSize: "11.5px", color: "#94a3b8", marginTop: "2px" }}>
                Trilha cronológica em 4 colunas. O tempo corre de cima para baixo. Clique em uma Entrada para casar com uma Saída ou Âncora.
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {entradaSelecionadaId ? (
              <button
                onClick={() => setEntradaSelecionadaId(null)}
                style={{
                  background: "rgba(239,68,68,0.2)",
                  border: "1px solid rgba(239,68,68,0.4)",
                  color: "#f87171",
                  padding: "6px 12px",
                  borderRadius: "8px",
                  fontSize: "11.5px",
                  fontWeight: "800",
                  cursor: "pointer"
                }}
              >
                ✕ Cancelar Seleção da Entrada
              </button>
            ) : (
              <span style={{ fontSize: "11px", color: "#64748b" }}>
                💡 Clique em &quot;Casar Saída&quot; na Coluna 1 para vincular
              </span>
            )}
          </div>
        </div>

        {/* Header Fixo das 4 Colunas Swimlane */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "100px 1fr 1fr 1fr 1fr",
          gap: "14px",
          position: "sticky",
          top: "12px",
          zIndex: 40,
          background: "rgba(10, 15, 29, 0.95)",
          backdropFilter: "blur(12px)",
          padding: "12px 16px",
          borderRadius: "14px",
          border: "1px solid rgba(255,255,255,0.12)",
          boxShadow: "0 10px 30px rgba(0,0,0,0.6)"
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "900", fontSize: "11px", color: "#64748b", textTransform: "uppercase" }}>
            ⏱️ Horário
          </div>

          {/* Coluna 1: Entrada */}
          <div style={{
            background: "rgba(16, 185, 129, 0.12)",
            border: "1px solid rgba(16, 185, 129, 0.35)",
            borderRadius: "10px",
            padding: "8px 12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "14px" }}>🟢</span>
              <span style={{ fontWeight: "900", fontSize: "12px", color: "#34d399", textTransform: "uppercase" }}>
                1. Entrada (Discord)
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              {sessoesCasadas > 0 && (
                <button
                  onClick={descasarTodosPares}
                  title="Descasar todos os pares em exibição para verificação manual"
                  style={{
                    background: "rgba(239, 68, 68, 0.18)",
                    border: "1px solid rgba(239, 68, 68, 0.4)",
                    color: "#f87171",
                    padding: "2px 7px",
                    borderRadius: "6px",
                    fontSize: "10px",
                    fontWeight: "800",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px"
                  }}
                >
                  <span>✂️</span>
                  <span>Descasar Todos</span>
                </button>
              )}
              <span style={{ fontSize: "11px", fontWeight: "800", color: "#34d399", background: "rgba(16, 185, 129, 0.2)", padding: "2px 7px", borderRadius: "10px" }}>
                {entradasVisiveis.length}
              </span>
            </div>
          </div>

          {/* Coluna 2: Bancada */}
          <div style={{
            background: "rgba(245, 158, 11, 0.12)",
            border: "1px solid rgba(245, 158, 11, 0.35)",
            borderRadius: "10px",
            padding: "8px 12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "14px" }}>🔨</span>
              <span style={{ fontWeight: "900", fontSize: "12px", color: "#fbbf24", textTransform: "uppercase" }}>
                2. Bancada (Craft)
              </span>
            </div>
            <span style={{ fontSize: "11px", fontWeight: "800", color: "#fbbf24", background: "rgba(245, 158, 11, 0.2)", padding: "2px 7px", borderRadius: "10px" }}>
              {atividadesDoPeriodo.filter((a) => a.tipo === "bancada").length}
            </span>
          </div>

          {/* Coluna 3: Tunagem */}
          <div style={{
            background: "rgba(56, 189, 248, 0.12)",
            border: "1px solid rgba(56, 189, 248, 0.35)",
            borderRadius: "10px",
            padding: "8px 12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "14px" }}>🚗</span>
              <span style={{ fontWeight: "900", fontSize: "12px", color: "#38bdf8", textTransform: "uppercase" }}>
                3. Tunagem (Veículos)
              </span>
            </div>
            <span style={{ fontSize: "11px", fontWeight: "800", color: "#38bdf8", background: "rgba(56, 189, 248, 0.2)", padding: "2px 7px", borderRadius: "10px" }}>
              {atividadesDoPeriodo.filter((a) => a.tipo === "tunagem").length}
            </span>
          </div>

          {/* Coluna 4: Saída */}
          <div style={{
            background: "rgba(168, 85, 247, 0.12)",
            border: "1px solid rgba(168, 85, 247, 0.35)",
            borderRadius: "10px",
            padding: "8px 12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "14px" }}>🏁</span>
              <span style={{ fontWeight: "900", fontSize: "12px", color: "#c084fc", textTransform: "uppercase" }}>
                4. Saída Oficial (Discord)
              </span>
            </div>
            <span style={{ fontSize: "11px", fontWeight: "800", color: "#c084fc", background: "rgba(168, 85, 247, 0.2)", padding: "2px 7px", borderRadius: "10px" }}>
              {saidasDoPeriodo.length}
            </span>
          </div>
        </div>

        {/* Lista de Linhas do Tempo */}
        {eventosLinhaDoTempo.length === 0 ? (
          <div style={{
            marginTop: "16px",
            background: "rgba(15, 23, 42, 0.5)",
            border: "1px dashed rgba(255,255,255,0.15)",
            borderRadius: "16px",
            padding: "48px 24px",
            textAlign: "center",
            color: "#94a3b8"
          }}>
            <span style={{ fontSize: "36px" }}>📭</span>
            <div style={{ fontSize: "16px", fontWeight: "800", color: "#fff", marginTop: "8px" }}>
              Nenhum registro de ponto, bancada ou tunagem encontrado para este mecânico neste ciclo.
            </div>
          </div>
        ) : (
          <div style={{ marginTop: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
            {eventosLinhaDoTempoComSessao.map((ev) => {
              const sessaoAtiva = ev.sessaoAtiva;
              const isInicioSessao = ev.isInicioSessao;
              const isFimSessao = ev.isFimSessao;
              const isDiscordSession = Boolean(sessaoAtiva?.isDiscord);
              const isSessaoIrregularGrave = Boolean(sessaoAtiva?.isIrregularGrave);
              const isSessaoIrregularCurto = Boolean(sessaoAtiva?.isIrregularCurto);
              const isSessaoIrregular = isSessaoIrregularGrave || isSessaoIrregularCurto;

              // Cores e destaque para o fundo do período conectado:
              // Saída por crash = âmbar (não fica em vermelho).
              // Saída por Discord < 30m = vermelho destacado.
              // Saída por Discord normal = esmeralda suave.
              const sessionBg = sessaoAtiva
                ? isSessaoIrregular
                  ? "linear-gradient(90deg, rgba(239, 68, 68, 0.12) 0%, rgba(239, 68, 68, 0.05) 50%, rgba(239, 68, 68, 0.12) 100%)"
                  : isDiscordSession
                  ? "linear-gradient(90deg, rgba(16, 185, 129, 0.09) 0%, rgba(16, 185, 129, 0.04) 50%, rgba(16, 185, 129, 0.09) 100%)"
                  : "linear-gradient(90deg, rgba(245, 158, 11, 0.09) 0%, rgba(245, 158, 11, 0.04) 50%, rgba(245, 158, 11, 0.09) 100%)"
                : "transparent";
              const sessionBorderColor = isSessaoIrregular
                ? "rgba(239, 68, 68, 0.35)"
                : isDiscordSession
                ? "rgba(16, 185, 129, 0.25)"
                : "rgba(245, 158, 11, 0.25)";
              const sessionAccentColor = isSessaoIrregular ? "#ef4444" : isDiscordSession ? "#10b981" : "#f59e0b";

              return (
                <div
                  id={ev.id}
                  key={ev.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "100px 1fr 1fr 1fr 1fr",
                    gap: "14px",
                    alignItems: "stretch",
                    position: "relative",
                    background: sessionBg,
                    borderLeft: sessaoAtiva ? `4px solid ${sessionAccentColor}` : "4px solid transparent",
                    borderRight: sessaoAtiva ? `1px solid ${sessionBorderColor}` : "1px solid transparent",
                    borderTop: isInicioSessao ? `1.5px solid ${sessionBorderColor}` : sessaoAtiva ? "1px dashed rgba(255,255,255,0.03)" : "none",
                    borderBottom: isFimSessao ? `1.5px solid ${sessionBorderColor}` : "none",
                    borderTopLeftRadius: isInicioSessao ? "14px" : "0",
                    borderTopRightRadius: isInicioSessao ? "14px" : "0",
                    borderBottomLeftRadius: isFimSessao ? "14px" : "0",
                    borderBottomRightRadius: isFimSessao ? "14px" : "0",
                    padding: sessaoAtiva ? "8px 12px" : "4px 12px",
                    marginTop: isInicioSessao ? "10px" : "0",
                    marginBottom: isFimSessao ? "18px" : "2px",
                    boxShadow: sessaoAtiva
                      ? isSessaoIrregular
                        ? "0 4px 20px rgba(239, 68, 68, 0.15)"
                        : isDiscordSession
                        ? "0 4px 20px rgba(16,185,129,0.04)"
                        : "0 4px 20px rgba(245,158,11,0.04)"
                      : "none",
                    transition: "all 0.2s"
                  }}
                >
                  {/* Coluna 0: Horário */}
                  <div style={{
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    alignItems: "center",
                    background: sessaoAtiva
                      ? isSessaoIrregular
                        ? "rgba(239, 68, 68, 0.18)"
                        : isDiscordSession
                        ? "rgba(16, 185, 129, 0.14)"
                        : "rgba(245, 158, 11, 0.14)"
                      : "rgba(15, 23, 42, 0.6)",
                    border: `1px solid ${
                      sessaoAtiva
                        ? isSessaoIrregular
                          ? "rgba(239, 68, 68, 0.55)"
                          : isDiscordSession
                          ? "rgba(16, 185, 129, 0.4)"
                          : "rgba(245, 158, 11, 0.4)"
                        : "rgba(255, 255, 255, 0.06)"
                    }`,
                    borderRadius: "10px",
                    padding: "6px 8px"
                  }}>
                    <span style={{ fontSize: "13px", fontWeight: "900", color: "#fff", fontFamily: "monospace" }}>
                      {ev.hora}
                    </span>
                    {ev.data !== dataFiltro && (
                      <span style={{ fontSize: "9px", fontWeight: "800", color: "#c084fc", background: "rgba(168,85,247,0.2)", padding: "1px 4px", borderRadius: "4px", marginTop: "2px" }}>
                        +{ev.data.slice(8, 10)}/{ev.data.slice(5, 7)}
                      </span>
                    )}
                    {sessaoAtiva && (
                      <span style={{
                        fontSize: "9px",
                        fontWeight: "900",
                        color: isSessaoIrregular ? "#fca5a5" : isDiscordSession ? "#34d399" : "#fbbf24",
                        background: isSessaoIrregular ? "rgba(239, 68, 68, 0.28)" : isDiscordSession ? "rgba(16,185,129,0.22)" : "rgba(245,158,11,0.22)",
                        padding: "1px 5px",
                        borderRadius: "4px",
                        marginTop: "4px",
                        whiteSpace: "nowrap"
                      }}>
                        {isInicioSessao
                          ? `${isSessaoIrregular ? "🚨" : "🟢"} Início T#${sessaoAtiva.sessaoNumero}`
                          : isFimSessao
                          ? `${isSessaoIrregular ? "🚨" : "🏁"} Fim T#${sessaoAtiva.sessaoNumero}`
                          : `T#${sessaoAtiva.sessaoNumero}`}
                      </span>
                    )}
                  </div>

                  {/* Coluna 1: Entrada */}
                  {ev.coluna === 0 ? (
                    (() => {
                      const ent = ev.obj;
                      const saidaCasada = ent.saidaId ? saidas.find((s) => s.id === ent.saidaId) : null;
                      const isCasada = Boolean(saidaCasada);
                      const duracaoMin = saidaCasada ? calcularDuracao(ent.hora, saidaCasada.hora) : null;
                      const isSelected = entradaSelecionadaId === ent.id;
                      const isIrregularGrave = Boolean(ev.sessaoAtiva?.isIrregularGrave);
                      const isIrregularCurto = Boolean(ev.sessaoAtiva?.isIrregularCurto);

                      return (
                        <div style={{
                          background: isSelected
                            ? "linear-gradient(135deg, rgba(168,85,247,0.3) 0%, rgba(126,34,206,0.25) 100%)"
                            : isIrregularGrave || isIrregularCurto
                            ? "linear-gradient(135deg, rgba(239, 68, 68, 0.16) 0%, rgba(185, 28, 28, 0.1) 100%)"
                            : isCasada
                            ? "rgba(16, 185, 129, 0.12)"
                            : "rgba(239, 68, 68, 0.12)",
                          border: `1.5px solid ${
                            isSelected
                              ? "#a855f7"
                              : isIrregularGrave || isIrregularCurto
                              ? "#ef4444"
                              : isCasada
                              ? "rgba(16, 185, 129, 0.45)"
                              : "rgba(239, 68, 68, 0.45)"
                          }`,
                          borderRadius: "12px",
                          padding: "10px 12px",
                          boxShadow: isSelected
                            ? "0 0 16px rgba(168,85,247,0.4)"
                            : isIrregularGrave || isIrregularCurto
                            ? "0 0 12px rgba(239, 68, 68, 0.25)"
                            : "none",
                          transition: "all 0.2s"
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: "10px", fontWeight: "900", color: isIrregularGrave || isIrregularCurto ? "#fca5a5" : isCasada ? "#34d399" : "#f87171", textTransform: "uppercase" }}>
                              {isIrregularGrave ? "🚨 Entrada (<30m)" : isIrregularCurto ? "⚠️ Entrada (<30m)" : "🟢 Entrada"}
                            </span>
                            {isCasada ? (
                              <span style={{
                                fontSize: "10.5px",
                                fontWeight: "900",
                                color: isIrregularGrave || isIrregularCurto ? "#fff" : "#34d399",
                                background: isIrregularGrave || isIrregularCurto
                                  ? "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)"
                                  : "rgba(16,185,129,0.2)",
                                border: isIrregularGrave || isIrregularCurto ? "1px solid #f87171" : "none",
                                padding: "1px 6px",
                                borderRadius: "6px"
                              }}>
                                {isIrregularGrave || isIrregularCurto ? "🚨 " : "⏱️ "}{formatarMinutos(duracaoMin)}
                              </span>
                            ) : (
                              <span style={{ fontSize: "10px", fontWeight: "900", color: "#f87171", background: "rgba(239,68,68,0.2)", padding: "1px 6px", borderRadius: "6px" }}>
                                ⚠️ Sem Saída
                              </span>
                            )}
                          </div>

                          <div style={{ fontSize: "16px", fontWeight: "900", color: "#fff", marginTop: "2px" }}>
                            {ent.hora}
                          </div>

                          <div style={{ fontSize: "10.5px", color: "#94a3b8", marginTop: "2px" }}>
                            {ent.origem || "Discord"}
                          </div>

                          <div style={{ marginTop: "8px", display: "flex", gap: "6px", flexWrap: "wrap" }}>
                            {isCasada ? (
                              <button
                                onClick={() => descasarPonto(ent.id)}
                                style={{
                                  background: "rgba(239,68,68,0.15)",
                                  border: "1px solid rgba(239,68,68,0.35)",
                                  color: "#f87171",
                                  padding: "3px 8px",
                                  borderRadius: "6px",
                                  fontSize: "10.5px",
                                  fontWeight: "800",
                                  cursor: "pointer"
                                }}
                                title={saidaCasada && isAncoraAutomatica(saidaCasada) ? "Descartar e remover esta âncora automática" : "Descasar esta sessão"}
                              >
                                {saidaCasada && isAncoraAutomatica(saidaCasada) ? "🗑️ Descartar Âncora" : "✂️ Descasar"}
                              </button>
                            ) : (
                              <>
                                <button
                                  onClick={() => setEntradaSelecionadaId(isSelected ? null : ent.id)}
                                  style={{
                                    background: isSelected ? "#a855f7" : "rgba(168,85,247,0.2)",
                                    border: `1px solid ${isSelected ? "#c084fc" : "rgba(168,85,247,0.4)"}`,
                                    color: "#fff",
                                    padding: "4px 8px",
                                    borderRadius: "6px",
                                    fontSize: "10.5px",
                                    fontWeight: "900",
                                    cursor: "pointer"
                                  }}
                                >
                                  {isSelected ? "✕ Cancelar" : "🎯 Casar Saída"}
                                </button>

                                <button
                                  onClick={() => criarSaida1Minuto(ent.id, ent.hora)}
                                  style={{
                                    background: "rgba(245,158,11,0.15)",
                                    border: "1px solid rgba(245,158,11,0.35)",
                                    color: "#fbbf24",
                                    padding: "4px 8px",
                                    borderRadius: "6px",
                                    fontSize: "10.5px",
                                    fontWeight: "800",
                                    cursor: "pointer"
                                  }}
                                  title="Criar saída estimada de 1 minuto para crash sem atividade"
                                >
                                  ⏱️ 1 Minuto
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "44px", position: "relative" }}>
                      <div style={{ position: "absolute", top: 0, bottom: 0, width: "2px", background: sessaoAtiva ? (isDiscordSession ? "rgba(16, 185, 129, 0.35)" : "rgba(245, 158, 11, 0.35)") : "rgba(255,255,255,0.04)" }} />
                    </div>
                  )}

                  {/* Coluna 2: Bancada */}
                  {ev.coluna === 1 ? (
                    (() => {
                      const b = ev.obj;
                      const evTimestamp = ev.timestampMs || getTimestampMs(b, dataFiltro);
                      const entradasCandidatas = entradasVisiveis
                        .filter((e) => !e.saidaId && getTimestampMs(e, dataFiltro) <= evTimestamp)
                        .sort((x, y) => getTimestampMs(x, dataFiltro) - getTimestampMs(y, dataFiltro));
                      const entradaAbertaAnterior = !sessaoAtiva
                        ? entradasCandidatas[entradasCandidatas.length - 1] || null
                        : null;
                      const alvoEntrada = entradaSelecionadaId
                        ? entradas.find((e) => e.id === entradaSelecionadaId)
                        : entradaAbertaAnterior;
                      const podeUsarComoAncora = Boolean(alvoEntrada && !sessaoAtiva);

                      return (
                        <div style={{
                          background: sessaoAtiva ? "rgba(245, 158, 11, 0.08)" : "rgba(30, 41, 59, 0.4)",
                          border: `1px solid ${sessaoAtiva ? "rgba(245, 158, 11, 0.3)" : "rgba(255,255,255,0.08)"}`,
                          borderRadius: "12px",
                          padding: "8px 12px",
                          transition: "all 0.2s"
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: "10px", fontWeight: "900", color: "#fbbf24", textTransform: "uppercase" }}>
                              🔨 Bancada
                            </span>
                            {sessaoAtiva ? (
                              <span style={{ fontSize: "9.5px", fontWeight: "800", color: "#34d399", background: "rgba(16,185,129,0.18)", padding: "1px 5px", borderRadius: "4px" }}>
                                Turno #{sessaoAtiva.sessaoNumero}
                              </span>
                            ) : (
                              <span style={{ fontSize: "9.5px", color: "#94a3b8" }}>{b.hora}</span>
                            )}
                          </div>

                          <div style={{ fontSize: "13px", fontWeight: "800", color: "#fff", marginTop: "2px" }}>
                            {b.item || b.desc || "Item de Bancada"}
                          </div>

                          {b.quantidade && (
                            <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "1px" }}>
                              Qtd: <strong style={{ color: "#fbbf24" }}>{b.quantidade}x</strong>
                            </div>
                          )}

                          {podeUsarComoAncora && (
                            <button
                              onClick={() => {
                                gerarSaidaPorAtividade(alvoEntrada.id, b);
                                setEntradaSelecionadaId(null);
                              }}
                              style={{
                                marginTop: "6px",
                                width: "100%",
                                background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                                border: "none",
                                color: "#fff",
                                padding: "4px 8px",
                                borderRadius: "6px",
                                fontSize: "10.5px",
                                fontWeight: "900",
                                cursor: "pointer",
                                boxShadow: "0 2px 8px rgba(245,158,11,0.3)"
                              }}
                            >
                              ⚡ {entradaSelecionadaId ? "Usar p/ Entrada Selecionada" : `Ancorar p/ Entr. ${alvoEntrada.hora}`}
                            </button>
                          )}
                        </div>
                      );
                    })()
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "44px", position: "relative" }}>
                      <div style={{ position: "absolute", top: 0, bottom: 0, width: "2px", background: sessaoAtiva ? (isDiscordSession ? "rgba(16, 185, 129, 0.35)" : "rgba(245, 158, 11, 0.35)") : "rgba(255,255,255,0.04)" }} />
                    </div>
                  )}

                  {/* Coluna 3: Tunagem */}
                  {ev.coluna === 2 ? (
                    (() => {
                      const t = ev.obj;
                      const evTimestamp = ev.timestampMs || getTimestampMs(t, dataFiltro);
                      const entradasCandidatas = entradasVisiveis
                        .filter((e) => !e.saidaId && getTimestampMs(e, dataFiltro) <= evTimestamp)
                        .sort((x, y) => getTimestampMs(x, dataFiltro) - getTimestampMs(y, dataFiltro));
                      const entradaAbertaAnterior = !sessaoAtiva
                        ? entradasCandidatas[entradasCandidatas.length - 1] || null
                        : null;
                      const alvoEntrada = entradaSelecionadaId
                        ? entradas.find((e) => e.id === entradaSelecionadaId)
                        : entradaAbertaAnterior;
                      const podeUsarComoAncora = Boolean(alvoEntrada && !sessaoAtiva);

                      return (
                        <div style={{
                          background: sessaoAtiva ? "rgba(56, 189, 248, 0.08)" : "rgba(30, 41, 59, 0.4)",
                          border: `1px solid ${sessaoAtiva ? "rgba(56, 189, 248, 0.3)" : "rgba(255,255,255,0.08)"}`,
                          borderRadius: "12px",
                          padding: "8px 12px",
                          transition: "all 0.2s"
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: "10px", fontWeight: "900", color: "#38bdf8", textTransform: "uppercase" }}>
                              🚗 Tunagem
                            </span>
                            {sessaoAtiva ? (
                              <span style={{ fontSize: "9.5px", fontWeight: "800", color: "#34d399", background: "rgba(16,185,129,0.18)", padding: "1px 5px", borderRadius: "4px" }}>
                                Turno #{sessaoAtiva.sessaoNumero}
                              </span>
                            ) : (
                              <span style={{ fontSize: "9.5px", color: "#94a3b8" }}>{t.hora}</span>
                            )}
                          </div>

                          <div style={{ fontSize: "13px", fontWeight: "800", color: "#fff", marginTop: "2px" }}>
                            {t.veiculo || "Veículo"}
                          </div>

                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "2px" }}>
                            <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                              Placa: <strong style={{ color: "#cbd5e1" }}>{t.placa || "S/ Placa"}</strong>
                            </span>
                            {t.valor && (
                              <span style={{ fontSize: "11px", fontWeight: "800", color: "#34d399" }}>
                                R$ {Number(t.valor).toLocaleString("pt-BR")}
                              </span>
                            )}
                          </div>

                          {podeUsarComoAncora && (
                            <button
                              onClick={() => {
                                gerarSaidaPorAtividade(alvoEntrada.id, t);
                                setEntradaSelecionadaId(null);
                              }}
                              style={{
                                marginTop: "6px",
                                width: "100%",
                                background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                                border: "none",
                                color: "#fff",
                                padding: "4px 8px",
                                borderRadius: "6px",
                                fontSize: "10.5px",
                                fontWeight: "900",
                                cursor: "pointer",
                                boxShadow: "0 2px 8px rgba(2,132,199,0.3)"
                              }}
                            >
                              ⚡ {entradaSelecionadaId ? "Usar p/ Entrada Selecionada" : `Ancorar p/ Entr. ${alvoEntrada.hora}`}
                            </button>
                          )}
                        </div>
                      );
                    })()
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "44px", position: "relative" }}>
                      <div style={{ position: "absolute", top: 0, bottom: 0, width: "2px", background: sessaoAtiva ? (isDiscordSession ? "rgba(16, 185, 129, 0.35)" : "rgba(245, 158, 11, 0.35)") : "rgba(255,255,255,0.04)" }} />
                    </div>
                  )}

                  {/* Coluna 4: Saída */}
                  {ev.coluna === 3 ? (
                    (() => {
                      const s = ev.obj;
                      const isDiscord = isLogSaidaDiscord(s);
                      const entradaCasada = s.pareadoCom ? entradas.find((e) => e.id === s.pareadoCom) : null;
                      const isCasada = Boolean(entradaCasada);
                      const sTimestamp = ev.timestampMs || getTimestampMs(s, dataFiltro);
                      const entradasCandidatas = entradasVisiveis
                        .filter((e) => !e.saidaId && getTimestampMs(e, dataFiltro) <= sTimestamp)
                        .sort((x, y) => getTimestampMs(x, dataFiltro) - getTimestampMs(y, dataFiltro));
                      const entradaAbertaAnterior = !isCasada
                        ? entradasCandidatas[entradasCandidatas.length - 1] || null
                        : null;
                      const alvoEntrada = entradaSelecionadaId
                        ? entradas.find((e) => e.id === entradaSelecionadaId)
                        : entradaAbertaAnterior;
                      const podeCasar = Boolean(alvoEntrada && !isCasada);
                      const isIrregularGrave = Boolean(ev.sessaoAtiva?.isIrregularGrave);
                      const isIrregularCurto = Boolean(ev.sessaoAtiva?.isIrregularCurto);
                      const isSessaoIrregular = isIrregularGrave || isIrregularCurto;

                      return (
                        <div style={{
                          background: podeCasar
                            ? "linear-gradient(135deg, rgba(16,185,129,0.2) 0%, rgba(5,150,105,0.2) 100%)"
                            : isSessaoIrregular
                            ? "linear-gradient(135deg, rgba(239, 68, 68, 0.16) 0%, rgba(185, 28, 28, 0.1) 100%)"
                            : isCasada
                            ? isDiscord
                              ? "rgba(16, 185, 129, 0.12)"
                              : "rgba(245, 158, 11, 0.12)"
                            : isDiscord
                            ? "rgba(239, 68, 68, 0.1)"
                            : "rgba(245, 158, 11, 0.12)",
                          border: `1.5px solid ${
                            podeCasar
                              ? "#10b981"
                              : isSessaoIrregular
                              ? "#ef4444"
                              : isCasada
                              ? isDiscord
                                ? "rgba(16, 185, 129, 0.45)"
                                : "rgba(245, 158, 11, 0.45)"
                              : isDiscord
                              ? "rgba(239, 68, 68, 0.35)"
                              : "rgba(245, 158, 11, 0.45)"
                          }`,
                          borderRadius: "12px",
                          padding: "10px 12px",
                          boxShadow: podeCasar
                            ? "0 0 16px rgba(16,185,129,0.4)"
                            : isSessaoIrregular
                            ? "0 0 12px rgba(239, 68, 68, 0.25)"
                            : "none",
                          transition: "all 0.2s"
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{
                              fontSize: "10px",
                              fontWeight: "900",
                              color: isSessaoIrregular ? "#fca5a5" : isDiscord ? "#34d399" : "#fbbf24",
                              textTransform: "uppercase"
                            }}>
                              {isIrregularGrave
                                ? "🚨 Saída Discord (<30m)"
                                : isIrregularCurto
                                ? "⚠️ Saída Discord (<30m)"
                                : isDiscord
                                ? "🟢 Saída Discord"
                                : "⚠️ Âncora / Crash"}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSaidaDetalhesModal(s);
                              }}
                              style={{
                                background: "rgba(255,255,255,0.08)",
                                border: "none",
                                color: "#94a3b8",
                                borderRadius: "4px",
                                padding: "2px 6px",
                                fontSize: "10px",
                                cursor: "pointer"
                              }}
                              title="Ver detalhes brutos do log"
                            >
                              🔍
                            </button>
                          </div>

                          <div style={{ fontSize: "16px", fontWeight: "900", color: "#fff", marginTop: "2px" }}>
                            {s.hora}
                          </div>

                          <div style={{ fontSize: "10.5px", color: isDiscord ? "#94a3b8" : "#fbbf24", marginTop: "2px" }}>
                            {s.origem}
                          </div>

                          <div style={{ marginTop: "8px" }}>
                            {isCasada ? (
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontSize: "10px", fontWeight: "800", color: isDiscord ? "#34d399" : "#fbbf24" }}>
                                  {isDiscord ? "🔒 Casada c/ " : "⚓ Casada c/ "} {entradaCasada?.hora || "Entrada"}
                                </span>
                                <button
                                  onClick={() => descasarSaida(s.id)}
                                  style={{
                                    background: isAncoraAutomatica(s) ? "rgba(245,158,11,0.15)" : "rgba(239,68,68,0.15)",
                                    border: `1px solid ${isAncoraAutomatica(s) ? "rgba(245,158,11,0.35)" : "rgba(239,68,68,0.35)"}`,
                                    color: isAncoraAutomatica(s) ? "#fbbf24" : "#f87171",
                                    padding: "3px 8px",
                                    borderRadius: "6px",
                                    fontSize: "10px",
                                    fontWeight: "800",
                                    cursor: "pointer"
                                  }}
                                  title={isAncoraAutomatica(s) ? "Descartar e remover esta âncora automática" : "Descasar saída"}
                                >
                                  {isAncoraAutomatica(s) ? "🗑️ Descartar Âncora" : "✂️ Descasar"}
                                </button>
                              </div>
                            ) : isAncoraAutomatica(s) ? (
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "6px" }}>
                                {podeCasar && (
                                  <button
                                    onClick={() => {
                                      casarPonto(alvoEntrada.id, s.id);
                                      setEntradaSelecionadaId(null);
                                    }}
                                    style={{
                                      flex: 1,
                                      background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                                      border: "none",
                                      color: "#fff",
                                      padding: "5px 8px",
                                      borderRadius: "6px",
                                      fontSize: "11px",
                                      fontWeight: "900",
                                      cursor: "pointer",
                                      boxShadow: "0 2px 8px rgba(16,185,129,0.4)"
                                    }}
                                  >
                                    🔗 {entradaSelecionadaId ? "Casar" : `Casar c/ ${alvoEntrada.hora}`}
                                  </button>
                                )}
                                <button
                                  onClick={() => descartarAncora(s.id)}
                                  style={{
                                    background: "rgba(245,158,11,0.15)",
                                    border: "1px solid rgba(245,158,11,0.4)",
                                    color: "#fbbf24",
                                    padding: "5px 10px",
                                    borderRadius: "6px",
                                    fontSize: "11px",
                                    fontWeight: "900",
                                    cursor: "pointer"
                                  }}
                                  title="Descartar e remover esta âncora"
                                >
                                  🗑️ Descartar
                                </button>
                              </div>
                            ) : podeCasar ? (
                              <button
                                onClick={() => {
                                  casarPonto(alvoEntrada.id, s.id);
                                  setEntradaSelecionadaId(null);
                                }}
                                style={{
                                  width: "100%",
                                  background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                                  border: "none",
                                  color: "#fff",
                                  padding: "5px 10px",
                                  borderRadius: "6px",
                                  fontSize: "11px",
                                  fontWeight: "900",
                                  cursor: "pointer",
                                  boxShadow: "0 2px 8px rgba(16,185,129,0.4)"
                                }}
                              >
                                🔗 {entradaSelecionadaId ? "Casar c/ Entrada Selecionada" : `Casar c/ Entr. ${alvoEntrada.hora}`}
                              </button>
                            ) : (
                              <span style={{ fontSize: "10.5px", color: isDiscord ? "#34d399" : "#fbbf24", fontWeight: "700" }}>
                                ✋ Disponível (Livre)
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "44px", position: "relative" }}>
                      <div style={{ position: "absolute", top: 0, bottom: 0, width: "2px", background: sessaoAtiva ? (isDiscordSession ? "rgba(16, 185, 129, 0.35)" : "rgba(245, 158, 11, 0.35)") : "rgba(255,255,255,0.04)" }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Toast Flutuante quando Entrada estiver selecionada */}
        {entradaSelecionadaId && (
          <div style={{
            position: "fixed",
            bottom: "24px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 9999,
            background: "linear-gradient(135deg, rgba(30,27,75,0.95) 0%, rgba(15,23,42,0.95) 100%)",
            border: "2px solid #a855f7",
            boxShadow: "0 10px 40px rgba(168,85,247,0.5)",
            borderRadius: "16px",
            padding: "12px 24px",
            display: "flex",
            alignItems: "center",
            gap: "16px",
            backdropFilter: "blur(12px)"
          }}>
            <span style={{ fontSize: "22px" }}>🎯</span>
            <div>
              <div style={{ fontSize: "13.5px", fontWeight: "900", color: "#fff" }}>
                Entrada das {entradas.find((e) => e.id === entradaSelecionadaId)?.hora} selecionada!
              </div>
              <div style={{ fontSize: "11.5px", color: "#c084fc" }}>
                Agora clique em qualquer Saída na Coluna 4 ou em uma Atividade (Colunas 2/3) para fechar o turno.
              </div>
            </div>
            <button
              onClick={() => setEntradaSelecionadaId(null)}
              style={{
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.2)",
                color: "#fff",
                padding: "6px 12px",
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: "800",
                cursor: "pointer"
              }}
            >
              Cancelar
            </button>
          </div>
        )}
        </div>

        {/* COLUNA DIREITA: Painel Flutuante Acompanhando a Tela (Sticky) */}
        <div style={{
          position: "sticky",
          top: "16px",
          maxHeight: "calc(100vh - 32px)",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          background: "linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.9) 100%)",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          borderRadius: "16px",
          padding: "16px",
          boxShadow: "0 12px 36px rgba(0,0,0,0.6)",
          backdropFilter: "blur(12px)",
          zIndex: 35
        }}>
          {/* Header do Painel */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "16px" }}>⏱️</span>
              <span style={{ fontSize: "12.5px", fontWeight: "900", color: "#fff", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Tempos do Ciclo
              </span>
            </div>
            <span style={{
              fontSize: "10.5px",
              fontWeight: "800",
              color: sessoesPendentesSaida === 0 ? "#34d399" : "#fbbf24",
              background: sessoesPendentesSaida === 0 ? "rgba(16,185,129,0.18)" : "rgba(245,158,11,0.18)",
              padding: "2px 7px",
              borderRadius: "8px"
            }}>
              {sessoesCasadas}/{totalSessoesVisiveis} Fechados
            </span>
          </div>

          {/* Lista de Turnos: T#1, T#2, T#3... */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", overflowY: "auto", maxHeight: "calc(100vh - 240px)", paddingRight: "2px" }}>
            {turnosResumo.length === 0 ? (
              <div style={{ fontSize: "11.5px", color: "#64748b", textAlign: "center", padding: "16px 8px" }}>
                Nenhum turno registrado neste ciclo.
              </div>
            ) : (
              turnosResumo.map((t) => {
                const isIrreg = t.isIrregularGrave || t.isIrregularCurto;

                return (
                  <div
                    key={t.tNum}
                    onClick={() => {
                      const el = document.getElementById(`tl-ent-${t.entradaId}`);
                      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                    }}
                    style={{
                      background: isIrreg
                        ? "linear-gradient(135deg, rgba(239, 68, 68, 0.16) 0%, rgba(185, 28, 28, 0.1) 100%)"
                        : t.isCasada
                        ? t.isDiscord
                          ? "rgba(16, 185, 129, 0.08)"
                          : "rgba(245, 158, 11, 0.08)"
                        : "rgba(239, 68, 68, 0.1)",
                      border: `1.5px solid ${
                        isIrreg
                          ? "#ef4444"
                          : t.isCasada
                          ? t.isDiscord
                            ? "rgba(16, 185, 129, 0.3)"
                            : "rgba(245, 158, 11, 0.35)"
                          : "rgba(239, 68, 68, 0.35)"
                      }`,
                      borderRadius: "10px",
                      padding: "9px 12px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      cursor: "pointer",
                      boxShadow: isIrreg ? "0 0 10px rgba(239, 68, 68, 0.2)" : "none",
                      transition: "all 0.15s"
                    }}
                    title="Clique para localizar este turno na linha do tempo"
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontSize: "12px", fontWeight: "900", color: "#cbd5e1" }}>
                          T#{t.tNum}:
                        </span>
                        <span style={{
                          fontSize: "13px",
                          fontWeight: "900",
                          color: isIrreg ? "#fca5a5" : t.isCasada ? (t.isDiscord ? "#34d399" : "#fbbf24") : "#f87171",
                          fontFamily: "monospace"
                        }}>
                          {t.duracaoTexto}
                        </span>
                      </div>
                      <div style={{ fontSize: "10.5px", color: "#94a3b8", marginTop: "2px" }}>
                        {t.horaEntrada} ➔ {t.horaSaida || "Sem Saída"}
                      </div>
                    </div>

                    {isIrreg ? (
                      <span style={{
                        fontSize: "9px",
                        fontWeight: "900",
                        color: "#fff",
                        background: "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)",
                        border: "1px solid #f87171",
                        padding: "2px 6px",
                        borderRadius: "6px"
                      }}>
                        {t.isIrregularGrave ? "🚨 <30m Discord" : "⚠️ <30m Discord"}
                      </span>
                    ) : (
                      <span style={{
                        fontSize: "9.5px",
                        fontWeight: "900",
                        color: t.isCasada ? (t.isDiscord ? "#34d399" : "#fbbf24") : "#f87171",
                        background: t.isCasada ? (t.isDiscord ? "rgba(16,185,129,0.18)" : "rgba(245,158,11,0.18)") : "rgba(239,68,68,0.18)",
                        padding: "2px 6px",
                        borderRadius: "6px"
                      }}>
                        {t.isCasada ? (t.isDiscord ? "🟢 Discord" : "⚠️ Âncora") : "⚠️ Pendente"}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Divisor */}
          <div style={{ borderTop: "1px dashed rgba(255, 255, 255, 0.15)", margin: "2px 0" }} />

          {/* Card de Total Acumulado */}
          <div style={{
            background: "linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(5, 150, 105, 0.12) 100%)",
            border: "1px solid rgba(16, 185, 129, 0.35)",
            borderRadius: "12px",
            padding: "10px 14px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}>
            <div>
              <span style={{ fontSize: "11px", fontWeight: "900", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Total:
              </span>
              <div style={{ fontSize: "18px", fontWeight: "900", color: "#34d399", fontFamily: "monospace", marginTop: "1px" }}>
                {totalFormatado.replace("+", "")}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <span style={{ fontSize: "11px", color: "#cbd5e1", fontWeight: "700" }}>
                {totalMinutosTurnos} min
              </span>
              <div style={{ fontSize: "9.5px", color: sessoesPendentesSaida === 0 ? "#34d399" : "#fbbf24", fontWeight: "800", marginTop: "2px" }}>
                {sessoesPendentesSaida === 0 ? "✅ 100% Fechado" : `⚠️ ${sessoesPendentesSaida} aberto(s)`}
              </div>
            </div>
          </div>

          {/* Botão de Descasar Todos os Pares em Exibição */}
          {sessoesCasadas > 0 && (
            <button
              onClick={descasarTodosPares}
              disabled={salvando}
              style={{
                width: "100%",
                background: "rgba(239, 68, 68, 0.12)",
                border: "1px solid rgba(239, 68, 68, 0.35)",
                color: "#f87171",
                padding: "8px 12px",
                borderRadius: "10px",
                fontSize: "11.5px",
                fontWeight: "900",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                transition: "all 0.2s"
              }}
              title="Desfaz o casamento de todas as sessões em exibição para verificação manual"
            >
              <span>✂️</span>
              <span>Descasar Todos ({sessoesCasadas})</span>
            </button>
          )}

          {/* Botão de Gravar Integrado ao Painel */}
          <button
            onClick={gravarSessoesNoBanco}
            disabled={salvando || sessoesCasadas === 0}
            style={{
              width: "100%",
              background: sessoesPendentesGravacao > 0
                ? "linear-gradient(135deg, #10b981 0%, #059669 100%)"
                : "rgba(255,255,255,0.08)",
              border: `1px solid ${sessoesPendentesGravacao > 0 ? "#10b981" : "rgba(255,255,255,0.15)"}`,
              color: sessoesPendentesGravacao > 0 ? "#fff" : "#94a3b8",
              padding: "10px 14px",
              borderRadius: "10px",
              fontSize: "12px",
              fontWeight: "900",
              cursor: salvando || sessoesCasadas === 0 ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              boxShadow: sessoesPendentesGravacao > 0 ? "0 4px 15px rgba(16,185,129,0.35)" : "none",
              transition: "all 0.2s"
            }}
          >
            <span>💾</span>
            <span>{salvando ? "Gravando..." : sessoesPendentesGravacao > 0 ? `Gravar (${sessoesPendentesGravacao} pendente${sessoesPendentesGravacao > 1 ? "s" : ""})` : "Homologado em Banco"}</span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#090d16",
      color: "#e2e8f0",
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      padding: "24px 20px"
    }}>
      {/* Topo / Header com Filtros Reais */}
      <div style={{ maxWidth: "1540px", margin: "0 auto 20px" }}>
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
                  🧑‍🔧 Mecânico ({usuarios.length} ativos na hierarquia)
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
                    minWidth: "280px"
                  }}
                >
                  {usuarios.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.cargoLabel ? `[${u.cargoLabel}] ` : ""}{u.nome} (ID: #{u.id})
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

      {/* Grid Principal: Trilha 4 Colunas */}
      {renderTrilha4Colunas()}

      {/* MODAL DE DETALHES DO LOG DE SAÍDA */}
      {saidaDetalhesModal && (
        <div
          onClick={() => setSaidaDetalhesModal(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(6px)",
            zIndex: 999999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px"
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#0f172a",
              border: "1.5px solid rgba(168, 85, 247, 0.4)",
              borderRadius: "18px",
              maxWidth: "560px",
              width: "100%",
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.8)",
              overflow: "hidden"
            }}
          >
            {/* Header do Modal */}
            <div style={{
              padding: "16px 20px",
              background: "linear-gradient(135deg, rgba(30,27,75,0.8) 0%, rgba(15,23,42,0.9) 100%)",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "22px" }}>{isLogSaidaDiscord(saidaDetalhesModal) ? "🟢" : "⚠️"}</span>
                <div>
                  <div style={{ fontSize: "15px", fontWeight: "900", color: "#fff" }}>
                    Informações do Registro de Saída
                  </div>
                  <div style={{ fontSize: "11.5px", color: "#94a3b8" }}>
                    Horário: <strong style={{ color: isLogSaidaDiscord(saidaDetalhesModal) ? "#34d399" : "#fbbf24" }}>{saidaDetalhesModal.hora}</strong> • Data: <strong>{saidaDetalhesModal.dataOriginal || saidaDetalhesModal.data}</strong>
                    {saidaDetalhesModal.dataOriginal && saidaDetalhesModal.dataOriginal !== saidaDetalhesModal.data && (
                      <span style={{ marginLeft: "6px", fontSize: "10px", color: "#c084fc", fontWeight: "700" }}>
                        (🌙 Turno iniciado em {saidaDetalhesModal.data.slice(8, 10)}/{saidaDetalhesModal.data.slice(5, 7)})
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSaidaDetalhesModal(null)}
                style={{
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  color: "#fff",
                  borderRadius: "8px",
                  width: "32px",
                  height: "32px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  fontWeight: "900"
                }}
              >
                ✕
              </button>
            </div>

            {/* Conteúdo do Modal */}
            <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
              {/* Grid de Informações Básicas */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div style={{ background: "rgba(255,255,255,0.03)", padding: "10px 14px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <span style={{ fontSize: "10.5px", color: "#94a3b8", fontWeight: "800", textTransform: "uppercase" }}>
                    📌 Tipo de Fechamento
                  </span>
                  <div style={{ fontSize: "13px", fontWeight: "900", color: "#c084fc", marginTop: "4px" }}>
                    {isLogSaidaDiscord(saidaDetalhesModal)
                      ? (saidaDetalhesModal.tipoFechamento && !saidaDetalhesModal.tipoFechamento.includes("CRASH") ? saidaDetalhesModal.tipoFechamento : "NORMAL (DISCORD)")
                      : (saidaDetalhesModal.tipoFechamento || "CRASH_COM_ATIVIDADE")}
                  </div>
                </div>

                <div style={{ background: "rgba(255,255,255,0.03)", padding: "10px 14px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <span style={{ fontSize: "10.5px", color: "#94a3b8", fontWeight: "800", textTransform: "uppercase" }}>
                    📡 Origem do Dado
                  </span>
                  <div style={{ fontSize: "13px", fontWeight: "900", color: isLogSaidaDiscord(saidaDetalhesModal) ? "#38bdf8" : "#fbbf24", marginTop: "4px" }}>
                    {saidaDetalhesModal.origem || "Discord / Sistema"}
                  </div>
                </div>
              </div>

              {/* UUID com botão de copiar */}
              <div style={{ background: "rgba(255,255,255,0.03)", padding: "12px 14px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <span style={{ fontSize: "10.5px", color: "#94a3b8", fontWeight: "800", textTransform: "uppercase" }}>
                    🔑 UUID do Registro
                  </span>
                  {saidaDetalhesModal.uuid && (
                    <button
                      onClick={() => copiarParaClipboard(saidaDetalhesModal.uuid)}
                      style={{
                        background: copiadoUuid ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.08)",
                        border: `1px solid ${copiadoUuid ? "#10b981" : "rgba(255,255,255,0.15)"}`,
                        color: copiadoUuid ? "#34d399" : "#cbd5e1",
                        borderRadius: "6px",
                        padding: "2px 8px",
                        fontSize: "10.5px",
                        fontWeight: "800",
                        cursor: "pointer"
                      }}
                    >
                      {copiadoUuid ? "✅ Copiado!" : "📋 Copiar UUID"}
                    </button>
                  )}
                </div>
                <code style={{ fontSize: "12px", color: "#e2e8f0", wordBreak: "break-all", background: "rgba(0,0,0,0.3)", padding: "6px 8px", borderRadius: "6px", display: "block" }}>
                  {saidaDetalhesModal.uuid || "Não possui UUID dedicado"}
                </code>
              </div>

              {/* Status de Pareamento */}
              <div style={{ background: "rgba(255,255,255,0.03)", padding: "10px 14px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.06)" }}>
                <span style={{ fontSize: "10.5px", color: "#94a3b8", fontWeight: "800", textTransform: "uppercase" }}>
                  🔗 Status de Vinculação
                </span>
                <div style={{ fontSize: "12.5px", fontWeight: "800", color: saidaDetalhesModal.pareadoCom ? (isLogSaidaDiscord(saidaDetalhesModal) ? "#34d399" : "#fbbf24") : "#fbbf24", marginTop: "4px" }}>
                  {saidaDetalhesModal.pareadoCom
                    ? (isLogSaidaDiscord(saidaDetalhesModal)
                      ? `🔒 Casada com Entrada (${saidaDetalhesModal.pareadoCom})`
                      : `⚠️ Casada via Âncora/Crash (${saidaDetalhesModal.pareadoCom})`)
                    : "✋ Disponível no Banco de Saídas (Livre para Parear)"}
                </div>
              </div>

              {/* Timestamp ISO */}
              {saidaDetalhesModal.timestampz && (
                <div style={{ fontSize: "11px", color: "#64748b" }}>
                  Timestamp ISO: <code>{saidaDetalhesModal.timestampz}</code>
                </div>
              )}

              {/* Mensagem Bruta do Discord / Observação */}
              {(saidaDetalhesModal.raw || saidaDetalhesModal.observacao) && (
                <div>
                  <span style={{ fontSize: "10.5px", color: "#94a3b8", fontWeight: "800", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>
                    📄 Log Bruto / Informações Originais:
                  </span>
                  <pre style={{
                    background: "#090d16",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "8px",
                    padding: "10px 12px",
                    fontSize: "11px",
                    color: "#94a3b8",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    maxHeight: "150px",
                    overflowY: "auto",
                    fontFamily: "monospace"
                  }}>
                    {saidaDetalhesModal.raw || saidaDetalhesModal.observacao}
                  </pre>
                </div>
              )}
            </div>

            {/* Footer do Modal */}
            <div style={{
              padding: "12px 20px",
              background: "rgba(0,0,0,0.3)",
              borderTop: "1px solid rgba(255,255,255,0.06)",
              textAlign: "right"
            }}>
              <button
                onClick={() => setSaidaDetalhesModal(null)}
                style={{
                  background: "linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)",
                  border: "none",
                  color: "#fff",
                  padding: "8px 18px",
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontWeight: "800",
                  cursor: "pointer"
                }}
              >
                Entendido / Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
