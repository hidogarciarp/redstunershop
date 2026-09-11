import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "../../utils/supabaseClient";
import { getHorarioObrigatorioParaData } from "../../utils/helpers";

// Configurações dos 4 Turnos para o Rateio por Horas Cheias
export const TURNOS_CONFIG = {
  obrigatorio: {
    id: "obrigatorio",
    titulo: "Horário Obrigatório (18h-23h)",
    subtitulo: "Horário de pico mandatório (18h às 23h a partir de 07/09/2026; 19h às 22h até 06/09/2026) com bônus e rateio proporcional por horas cheias.",
    nomeCurto: "Horário Obrigatório",
    badgeLabel: "⭐ Horário Obrigatório (18h-23h)",
    emoji: "⭐",
    horaInicio: "18:00:00",
    horaFim: "23:00:00",
    cor: "#ec4899",
    corSecundaria: "#8b5cf6",
    gradient: "linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)",
    bgBadge: "rgba(236, 72, 153, 0.15)",
    borderBadge: "rgba(236, 72, 153, 0.35)",
    shadow: "0 4px 14px rgba(236, 72, 153, 0.35)",
    defaultMontante: 10000000,
    storageKey: "reds_montante_obrigatorio",
    labelDiscord: "RELATÓRIO DE HORÁRIO OBRIGATÓRIO (18h às 23h)",
    dica: "Pico mandatório de atendimento (18h às 23h a partir de 07/09/2026; 19h às 22h até 06/09/2026).",
    regraJanela: "18:00 às 23:00 (Pico Obrigatório)",
  },
  manha: {
    id: "manha",
    titulo: "Turno da Manhã (06h-12h)",
    subtitulo: "Turno matutino com rateio proporcional por horas cheias trabalhadas.",
    nomeCurto: "Manhã",
    badgeLabel: "🌅 Manhã (06h-12h)",
    emoji: "🌅",
    horaInicio: "06:00:00",
    horaFim: "12:00:00",
    cor: "#f59e0b",
    corSecundaria: "#d97706",
    gradient: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
    bgBadge: "rgba(245, 158, 11, 0.15)",
    borderBadge: "rgba(245, 158, 11, 0.35)",
    shadow: "0 4px 14px rgba(245, 158, 11, 0.35)",
    defaultMontante: 1000000,
    storageKey: "reds_montante_manha",
    labelDiscord: "RELATÓRIO DO TURNO DA MANHÃ (06h às 12h)",
    dica: "Abertura da oficina e primeiros atendimentos matinais da cidade.",
    regraJanela: "06:00 às 12:00 (Turno da Manhã)",
  },
  tarde: {
    id: "tarde",
    titulo: "Turno da Tarde (12h-18h)",
    subtitulo: "Turno vespertino com rateio proporcional por horas cheias trabalhadas.",
    nomeCurto: "Tarde",
    badgeLabel: "☀️ Tarde (12h-18h)",
    emoji: "☀️",
    horaInicio: "12:00:00",
    horaFim: "18:00:00",
    cor: "#3b82f6",
    corSecundaria: "#2563eb",
    gradient: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
    bgBadge: "rgba(59, 130, 246, 0.15)",
    borderBadge: "rgba(59, 130, 246, 0.35)",
    shadow: "0 4px 14px rgba(59, 130, 246, 0.35)",
    defaultMontante: 1000000,
    storageKey: "reds_montante_tarde",
    labelDiscord: "RELATÓRIO DO TURNO DA TARDE (12h às 18h)",
    dica: "Atendimento vespertino e preparação para o horário de pico.",
    regraJanela: "12:00 às 18:00 (Turno da Tarde)",
  },
  madrugada: {
    id: "madrugada",
    titulo: "Turno da Madrugada (00h-06h)",
    subtitulo: "Turno da madrugada (Turno Chave) com rateio proporcional por horas cheias.",
    nomeCurto: "Madrugada",
    badgeLabel: "🌑 Madrugada (00h-06h)",
    emoji: "🌑",
    horaInicio: "00:00:00",
    horaFim: "06:00:00",
    cor: "#a855f7",
    corSecundaria: "#6366f1",
    gradient: "linear-gradient(135deg, #a855f7 0%, #6366f1 100%)",
    bgBadge: "rgba(168, 85, 247, 0.15)",
    borderBadge: "rgba(168, 85, 247, 0.35)",
    shadow: "0 4px 14px rgba(168, 85, 247, 0.35)",
    defaultMontante: 2000000,
    storageKey: "reds_montante_madrugada",
    labelDiscord: "RELATÓRIO DO TURNO DA MADRUGADA (00h às 06h)",
    dica: "Garantia de oficina 24h aberta na cidade durante a madrugada.",
    regraJanela: "00:00 às 06:00 (Turno da Madrugada)",
  },
};

// Helper para calcular a semana de Segunda a Domingo
function getSemanaSegundaADomingo(offsetSemanas = 0, dataBase = new Date()) {
  const d = new Date(dataBase);
  d.setDate(d.getDate() + offsetSemanas * 7);
  const diaSemana = d.getDay();
  const diffParaSegunda = diaSemana === 0 ? -6 : 1 - diaSemana;

  const segunda = new Date(d);
  segunda.setDate(d.getDate() + diffParaSegunda);
  segunda.setHours(0, 0, 0, 0);

  const domingo = new Date(segunda);
  domingo.setDate(segunda.getDate() + 6);
  domingo.setHours(23, 59, 59, 999);

  const fmt = (dt) => {
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const dia = String(dt.getDate()).padStart(2, "0");
    return `${y}-${m}-${dia}`;
  };

  const fmtBR = (dt) => {
    const dia = String(dt.getDate()).padStart(2, "0");
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const y = dt.getFullYear();
    return `${dia}/${m}/${y}`;
  };

  // Gerar array dos 7 dias
  const dias = [];
  const nomesDias = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
  const siglasDias = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

  for (let i = 0; i < 7; i++) {
    const curr = new Date(segunda);
    curr.setDate(segunda.getDate() + i);
    dias.push({
      dateStr: fmt(curr),
      labelBR: fmtBR(curr),
      nomeDia: nomesDias[i],
      sigla: siglasDias[i],
    });
  }

  return {
    inicio: fmt(segunda),
    fim: fmt(domingo),
    inicioBR: fmtBR(segunda),
    fimBR: fmtBR(domingo),
    dias,
    label: `Semana ${fmtBR(segunda)} a ${fmtBR(domingo)}`,
  };
}

// Classifica o tipo de registro de ponto de acordo com as regras de bonificação
function classificarRegistroPonto(reg, todosRegs = []) {
  if (!reg || !reg.entrada || reg.oculto) {
    return { tipo: "invalido", label: "Inválido / Oculto", elegivel: false, icon: "❌", badgeColor: "#ef4444", bgBadge: "rgba(239,68,68,0.15)" };
  }

  const obs = (reg.observacao || reg.motivo || "").toLowerCase();

  // 1. Log de Bancada (Elegível)
  if (obs.includes("bancada")) {
    return { tipo: "bancada", label: "Log de Bancada", elegivel: true, icon: "🛠️", badgeColor: "#c084fc", bgBadge: "rgba(168,85,247,0.15)" };
  }

  // 2. Log de Tunagem (Elegível)
  if (obs.includes("tunagem")) {
    return { tipo: "tunagem", label: "Log de Tunagem", elegivel: true, icon: "🔧", badgeColor: "#f472b6", bgBadge: "rgba(236,72,153,0.15)" };
  }

  // 3. Auto-Fechado / Crash (Elegível até a última atividade)
  if (obs.includes("auto-fechado") || obs.includes("inatividade") || obs.includes("crash")) {
    return { tipo: "crash_autofechado", label: "Auto-Fechado (Crash)", elegivel: true, icon: "⚠️", badgeColor: "#f59e0b", bgBadge: "rgba(245,158,11,0.15)" };
  }

  // 4. Reconexão / Outra Entrada (Desconsiderar no bônus)
  if (obs.includes("reconex") || obs.includes("outra entrada") || obs.includes("nova entrada")) {
    return { tipo: "outra_entrada", label: "Outra Entrada (Ignorado)", elegivel: false, icon: "🔄", badgeColor: "#38bdf8", bgBadge: "rgba(14,165,233,0.15)" };
  }

  // Detecção se foi fechado automaticamente por proximidade de outra entrada (Ignorado)
  if (reg.saida && todosRegs && todosRegs.length > 0) {
    const tSaida = new Date(reg.saida).getTime();
    const temProximaEntrada = todosRegs.some((outro) => {
      if (outro.uuid_entrada && reg.uuid_entrada && outro.uuid_entrada === reg.uuid_entrada) return false;
      if (outro.entrada === reg.entrada) return false;
      const tOutraEntrada = new Date(outro.entrada).getTime();
      return Math.abs(tOutraEntrada - tSaida) <= 120000;
    });
    if (temProximaEntrada && !reg.uuid_saida) {
      return { tipo: "outra_entrada", label: "Outra Entrada (Ignorado)", elegivel: false, icon: "🔄", badgeColor: "#38bdf8", bgBadge: "rgba(14,165,233,0.15)" };
    }
  }

  // 5. Ponto Padrão Oficial Fechado (Elegível)
  if (reg.uuid_saida || reg.saida) {
    return { tipo: "padrao", label: "Ponto Padrão", elegivel: true, icon: "✅", badgeColor: "#22c55e", bgBadge: "rgba(34,197,94,0.15)" };
  }

  // 6. Sem Saída / Ponto Aberto (Desconsiderar no bônus)
  return { tipo: "sem_saida", label: "Sem Saída (Ignorado)", elegivel: false, icon: "🔓", badgeColor: "#facc15", bgBadge: "rgba(250,204,21,0.15)" };
}

// Retorna a saída válida APENAS para os registros elegíveis ao cálculo do bônus
function obterSaidaObrigatorio(reg, todosRegs = []) {
  const classificacao = classificarRegistroPonto(reg, todosRegs);
  if (!classificacao.elegivel) return null;

  const dEntrada = new Date(reg.entrada);
  if (isNaN(dEntrada.getTime())) return null;

  if (reg.saida) {
    const dSaida = new Date(reg.saida);
    if (!isNaN(dSaida.getTime())) {
      if (dSaida < dEntrada) return null;
      const maxSaida = new Date(dEntrada.getTime() + 12 * 3600000);
      return dSaida > maxSaida ? maxSaida : dSaida;
    }
  }

  if (typeof reg.tempo === "number" && reg.tempo > 0) {
    const dSaidaCalc = new Date(dEntrada.getTime() + reg.tempo * 60000);
    const maxSaida = new Date(dEntrada.getTime() + 12 * 3600000);
    return dSaidaCalc > maxSaida ? maxSaida : dSaidaCalc;
  }

  return null;
}

function calcularMinutosIntervalos(intervalos) {
  if (!intervalos || !intervalos.length) return 0;
  intervalos.sort((a, b) => a[0] - b[0]);
  const merged = [intervalos[0]];
  for (let i = 1; i < intervalos.length; i++) {
    const prev = merged[merged.length - 1];
    const curr = intervalos[i];
    if (curr[0] <= prev[1]) {
      prev[1] = Math.max(prev[1], curr[1]);
    } else {
      merged.push(curr);
    }
  }
  return merged.reduce((acc, [s, e]) => acc + (e - s) / 60000, 0);
}

function formatarMinutos(minutos) {
  if (!minutos || minutos <= 0) return "00:00";
  const h = Math.floor(minutos / 60);
  const m = Math.round(minutos % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function formatarMoeda(val) {
  return Number(val || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatarHoraSimples(dtString) {
  if (!dtString) return "—";
  const d = new Date(dtString);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
}

// Helper para filtrar apenas mecânicos ativos (exclui demitidos, inativos, ocultos e contas de staff/teste)
export function isMecanicoAtivo(func) {
  if (!func) return false;
  const statusLower = (func.status || "").toLowerCase().trim();
  if (statusLower && statusLower !== "ativo") return false;

  if (func.data_demissao) return false;
  if (func.oculto_hierarquia) return false;

  const nomeLower = (func.nome || func.nome_personagem || "").toLowerCase().trim();
  if (
    nomeLower.startsWith("staff ") ||
    nomeLower.startsWith("staff_") ||
    (nomeLower.startsWith("staff") && nomeLower.length <= 6) ||
    nomeLower.startsWith("admin ") ||
    nomeLower.startsWith("teste") ||
    nomeLower === "testes" ||
    nomeLower === "teste login"
  ) {
    return false;
  }

  const roleLower = (func.role || "").toLowerCase().trim();
  if (roleLower === "admin" && (nomeLower.includes("staff") || nomeLower.includes("teste"))) {
    return false;
  }

  return true;
}

// Processador puro do cálculo de rateio de um turno específico
export function calcularDadosTurno(turnoId, montante, pontosCarregados, listaDiasPeriodo, listaFuncionarios) {
  const config = TURNOS_CONFIG[turnoId];
  if (!config) return null;
  const mapaMecanicos = {};

  const mecanicosAtivos = (listaFuncionarios || []).filter(isMecanicoAtivo);

  mecanicosAtivos.forEach((func) => {
    const nome = func.nome || func.nome_personagem || `Mecânico #${func.id}`;
    const idKey = String(func.id || func.id_jogo || nome);
    mapaMecanicos[idKey] = {
      id: idKey,
      nome,
      idJogo: func.id_jogo || func.id,
      avatar: func.avatar_url || null,
      cargo: func.cargo || func.role || "Mecânico",
      dias: {},
      minutosTotal: 0,
      horasCheias: 0,
      sobraMinutos: 0,
      registrosTodos: [],
    };
    (listaDiasPeriodo || []).forEach((d) => {
      mapaMecanicos[idKey].dias[d.dateStr] = [];
    });
  });

  const lookupFunc = new Map();
  (listaFuncionarios || []).forEach((f) => {
    const canonicalId = String(f.id);
    lookupFunc.set(canonicalId, f);
    if (f.id_jogo) lookupFunc.set(String(f.id_jogo), f);
    if (f.nome) {
      lookupFunc.set(f.nome.replace(/\s+/g, " ").trim().toLowerCase(), f);
    }
  });

  (pontosCarregados || []).forEach((reg) => {
    if (reg.oculto) return;
    const dEntrada = new Date(reg.entrada);
    if (isNaN(dEntrada.getTime())) return;

    let nome = (reg.nome || reg.nome_personagem || "").replace(/\s+/g, " ").trim();
    const nomeLower = nome.toLowerCase();
    const pUsuarioId = reg.usuario_id ? String(reg.usuario_id) : "";
    const pIdJogo = reg.id_jogo ? String(reg.id_jogo) : "";

    let funcVinculado = (pUsuarioId && lookupFunc.get(pUsuarioId)) ||
                        (pIdJogo && lookupFunc.get(pIdJogo)) ||
                        (nomeLower && lookupFunc.get(nomeLower));

    if (!funcVinculado && nomeLower) {
      funcVinculado = (listaFuncionarios || []).find((f) => {
        if (!f.nome) return false;
        const fnNorm = f.nome.replace(/\s+/g, " ").trim().toLowerCase();
        return nomeLower.includes(fnNorm) || fnNorm.includes(nomeLower);
      });
    }

    let idKey = "";
    if (funcVinculado) {
      if (!isMecanicoAtivo(funcVinculado)) return;
      nome = funcVinculado.nome;
      idKey = String(funcVinculado.id);
    } else {
      if (nomeLower.startsWith("staff") || nomeLower.startsWith("admin") || nomeLower.startsWith("teste")) {
        return;
      }
      idKey = pUsuarioId || pIdJogo || `nome_${nomeLower}`;
    }

    if (!nome) nome = `Mecânico #${idKey}`;

    if (!mapaMecanicos[idKey]) {
      mapaMecanicos[idKey] = {
        id: idKey,
        nome,
        idJogo: funcVinculado?.id_jogo || reg.id_jogo || idKey,
        avatar: funcVinculado?.avatar_url || null,
        cargo: funcVinculado?.cargo || funcVinculado?.role || "Mecânico",
        dias: {},
        minutosTotal: 0,
        horasCheias: 0,
        sobraMinutos: 0,
        registrosTodos: [],
      };
      (listaDiasPeriodo || []).forEach((d) => {
        mapaMecanicos[idKey].dias[d.dateStr] = [];
      });
    }

    const classificacao = classificarRegistroPonto(reg, pontosCarregados);
    const dSaidaElegivel = obterSaidaObrigatorio(reg, pontosCarregados);

    let minTurnoReg = 0;
    if (dSaidaElegivel) {
      (listaDiasPeriodo || []).forEach((d) => {
        let horaInicio = config.horaInicio;
        let horaFim = config.horaFim;

        if (config.id === "obrigatorio") {
          const infoObr = getHorarioObrigatorioParaData(d.dateStr);
          horaInicio = infoObr.horaInicio;
          horaFim = infoObr.horaFim;
        }

        const limiteInicio = new Date(`${d.dateStr}T${horaInicio}-03:00`).getTime();
        const limiteFim = new Date(`${d.dateStr}T${horaFim}-03:00`).getTime();

        const start = Math.max(dEntrada.getTime(), limiteInicio);
        const end = Math.min(dSaidaElegivel.getTime(), limiteFim);

        if (end > start) {
          minTurnoReg += (end - start) / 60000;
          if (!mapaMecanicos[idKey].dias[d.dateStr]) {
            mapaMecanicos[idKey].dias[d.dateStr] = [];
          }
          mapaMecanicos[idKey].dias[d.dateStr].push([start, end]);
        }
      });
    }

    mapaMecanicos[idKey].registrosTodos.push({
      ...reg,
      dEntrada,
      dSaidaElegivel,
      classificacao,
      minPicoReg: minTurnoReg,
      duracaoTotalMin: dSaidaElegivel ? Math.max(0, (dSaidaElegivel.getTime() - dEntrada.getTime()) / 60000) : (typeof reg.tempo === "number" ? reg.tempo : 0),
    });
  });

  const lista = [];

  Object.values(mapaMecanicos).forEach((m) => {
    let totalMin = 0;
    const minutosPorDia = {};

    (listaDiasPeriodo || []).forEach((d) => {
      const intervalos = m.dias[d.dateStr] || [];
      const minDia = calcularMinutosIntervalos(intervalos);
      minutosPorDia[d.dateStr] = minDia;
      totalMin += minDia;
    });

    const horasCheias = Math.floor(totalMin / 60);
    const sobraMinutos = Math.round(totalMin % 60);

    m.registrosTodos.sort((a, b) => b.dEntrada.getTime() - a.dEntrada.getTime());

    if (totalMin > 0 || mecanicosAtivos.some((f) => String(f.id) === String(m.id))) {
      lista.push({
        ...m,
        minutosPorDia,
        minutosTotal: totalMin,
        horasCheias,
        sobraMinutos,
      });
    }
  });

  lista.sort((a, b) => b.horasCheias - a.horasCheias || b.minutosTotal - a.minutosTotal);

  const totalHorasEquipe = lista.reduce((acc, m) => acc + m.horasCheias, 0);
  const totalMinutosEquipe = lista.reduce((acc, m) => acc + m.minutosTotal, 0);
  const valorPorHoraCompleta = totalHorasEquipe > 0 ? montante / totalHorasEquipe : 0;

  const listaComBonus = lista.map((m, idx) => {
    const bonus = m.horasCheias * valorPorHoraCompleta;
    const pctPool = montante > 0 ? (bonus / montante) * 100 : 0;
    return {
      ...m,
      posicao: idx + 1,
      bonus,
      pctPool,
    };
  });

  const totalBonusPago = listaComBonus.reduce((acc, m) => acc + m.bonus, 0);
  const mecanicosElegiveis = listaComBonus.filter((m) => m.horasCheias > 0).length;

  return {
    config,
    montante,
    mecanicos: listaComBonus,
    totalHorasEquipe,
    totalMinutosEquipe,
    valorPorHoraCompleta,
    totalBonusPago,
    mecanicosElegiveis,
    totalMecanicos: listaComBonus.length,
  };
}

export default function BonificacaoPage({ theme, styles, usuarioLogado, listaFuncionarios = [] }) {
  // Controle de Abas ("obrigatorio" | "manha" | "tarde" | "madrugada" | "consolidado" | "proposta")
  const [abaAtiva, setAbaAtiva] = useState("obrigatorio");

  // ==========================================
  // ESTADOS DO RATEIO POR HORAS CHEIAS (TURNOS)
  // ==========================================
  const [offsetSemana, setOffsetSemana] = useState(0);
  const semanaInfo = useMemo(() => getSemanaSegundaADomingo(offsetSemana), [offsetSemana]);
  const [filtroDataInicio, setFiltroDataInicio] = useState(() => getSemanaSegundaADomingo(0).inicio);
  const [filtroDataFim, setFiltroDataFim] = useState(() => getSemanaSegundaADomingo(0).fim);
  const [modoPeriodo, setModoPeriodo] = useState("semana"); // "semana" | "custom"
  
  // Montante por turno salvo individualmente
  const [montantesPorTurno, setMontantesPorTurno] = useState(() => {
    const initial = {};
    if (typeof window !== "undefined") {
      Object.keys(TURNOS_CONFIG).forEach((k) => {
        const saved = localStorage.getItem(TURNOS_CONFIG[k].storageKey);
        initial[k] = saved ? Number(saved) : TURNOS_CONFIG[k].defaultMontante;
      });
    } else {
      Object.keys(TURNOS_CONFIG).forEach((k) => {
        initial[k] = TURNOS_CONFIG[k].defaultMontante;
      });
    }
    return initial;
  });

  const [buscaMecanico, setBuscaMecanico] = useState("");
  const [pontosCarregados, setPontosCarregados] = useState([]);
  const [carregandoPontos, setCarregandoPontos] = useState(false);

  // Mecânico selecionado para o modal de detalhamento de horas
  const [mecanicoDetalhe, setMecanicoDetalhe] = useState(null);

  // Sincronizar datas ao mudar semana
  useEffect(() => {
    if (modoPeriodo === "semana") {
      setFiltroDataInicio(semanaInfo.inicio);
      setFiltroDataFim(semanaInfo.fim);
    }
  }, [offsetSemana, modoPeriodo, semanaInfo]);

  // Salvar montante no localStorage por turno
  const atualizarMontanteTurno = (turnoId, valor) => {
    setMontantesPorTurno((prev) => ({ ...prev, [turnoId]: valor }));
    if (typeof window !== "undefined" && TURNOS_CONFIG[turnoId]) {
      localStorage.setItem(TURNOS_CONFIG[turnoId].storageKey, String(valor));
    }
  };

  // Buscar pontos do banco para o período
  const carregarPontosTurnos = async () => {
    if (!filtroDataInicio || !filtroDataFim) return;
    setCarregandoPontos(true);
    try {
      const dtF = new Date(`${filtroDataFim}T12:00:00-03:00`);
      dtF.setDate(dtF.getDate() + 1);
      const diaSeg = dtF.toLocaleDateString("en-CA");

      let { data, error } = await supabase
        .from("ponto_cidade_reds")
        .select("*")
        .gte("entrada", `${filtroDataInicio}T00:00:00-03:00`)
        .lte("entrada", `${diaSeg}T09:00:00-03:00`)
        .order("entrada", { ascending: true });

      if (error || !data || data.length === 0) {
        // Fallback para ponto_cidade se ponto_cidade_reds estiver vazio
        const resFallback = await supabase
          .from("ponto_cidade")
          .select("*")
          .gte("entrada", `${filtroDataInicio}T00:00:00-03:00`)
          .lte("entrada", `${diaSeg}T09:00:00-03:00`)
          .order("entrada", { ascending: true });
        if (resFallback.data) data = resFallback.data;
      }

      setPontosCarregados(data || []);
    } catch (e) {
      console.error("Erro ao carregar pontos para turnos:", e);
    } finally {
      setCarregandoPontos(false);
    }
  };

  useEffect(() => {
    carregarPontosTurnos();
  }, [filtroDataInicio, filtroDataFim]);

  // Dias ativos no relatório (7 dias da semana ou range personalizado)
  const listaDiasPeriodo = useMemo(() => {
    if (modoPeriodo === "semana") {
      return semanaInfo.dias;
    }
    // Período customizado
    const arr = [];
    const dtIni = new Date(`${filtroDataInicio}T12:00:00-03:00`);
    const dtFim = new Date(`${filtroDataFim}T12:00:00-03:00`);
    const nomesDias = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
    const siglasDias = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

    for (let d = new Date(dtIni); d <= dtFim; d.setDate(d.getDate() + 1)) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const dia = String(d.getDate()).padStart(2, "0");
      const dateStr = `${y}-${m}-${dia}`;
      const diaSemanaIdx = d.getDay();
      arr.push({
        dateStr,
        labelBR: `${dia}/${m}/${y}`,
        nomeDia: nomesDias[diaSemanaIdx],
        sigla: siglasDias[diaSemanaIdx],
      });
    }
    return arr;
  }, [modoPeriodo, semanaInfo, filtroDataInicio, filtroDataFim]);

  // Processamento Dinâmico do Relatório do Turno Selecionado
  const turnoAtualConfig = TURNOS_CONFIG[abaAtiva] || TURNOS_CONFIG.obrigatorio;
  const montanteAtualTurno = montantesPorTurno[abaAtiva] !== undefined ? montantesPorTurno[abaAtiva] : turnoAtualConfig.defaultMontante;

  const relatorioTurno = useMemo(() => {
    if (!TURNOS_CONFIG[abaAtiva]) return null;
    const montante = montantesPorTurno[abaAtiva] !== undefined ? montantesPorTurno[abaAtiva] : TURNOS_CONFIG[abaAtiva].defaultMontante;
    return calcularDadosTurno(abaAtiva, montante, pontosCarregados, listaDiasPeriodo, listaFuncionarios);
  }, [abaAtiva, montantesPorTurno, pontosCarregados, listaDiasPeriodo, listaFuncionarios]);

  // Relatório Consolidado (Somatória dos 4 Turnos em Ordem Decrescente de Pagamento)
  const relatorioConsolidado = useMemo(() => {
    const turnosIds = ["obrigatorio", "manha", "tarde", "madrugada"];
    const relatorios = {};
    turnosIds.forEach((tId) => {
      const cfg = TURNOS_CONFIG[tId];
      const mnt = montantesPorTurno[tId] !== undefined ? montantesPorTurno[tId] : cfg.defaultMontante;
      relatorios[tId] = calcularDadosTurno(tId, mnt, pontosCarregados, listaDiasPeriodo, listaFuncionarios);
    });

    const mapa = {};
    const lookupMap = new Map();
    const mecanicosAtivos = (listaFuncionarios || []).filter(isMecanicoAtivo);

    mecanicosAtivos.forEach((func) => {
      const canonicalId = String(func.id);
      const nome = func.nome || func.nome_personagem || `Mecânico #${func.id}`;
      const nomeNorm = nome.replace(/\s+/g, " ").trim().toLowerCase();

      lookupMap.set(canonicalId, canonicalId);
      if (func.id_jogo) lookupMap.set(String(func.id_jogo), canonicalId);
      if (nomeNorm) lookupMap.set(nomeNorm, canonicalId);

      mapa[canonicalId] = {
        id: canonicalId,
        idJogo: func.id_jogo || func.id,
        nome,
        avatar: func.avatar_url || null,
        cargo: func.cargo || func.role || "Mecânico",
        bonusTotal: 0,
        horasTotal: 0,
        minutosTotal: 0,
        turnos: {
          obrigatorio: { horas: 0, minutos: 0, bonus: 0, pctDoTotal: 0 },
          manha: { horas: 0, minutos: 0, bonus: 0, pctDoTotal: 0 },
          tarde: { horas: 0, minutos: 0, bonus: 0, pctDoTotal: 0 },
          madrugada: { horas: 0, minutos: 0, bonus: 0, pctDoTotal: 0 },
        },
        registrosTodos: [],
      };
    });

    turnosIds.forEach((tId) => {
      const rel = relatorios[tId];
      if (!rel || !rel.mecanicos) return;
      rel.mecanicos.forEach((m) => {
        const idStr = String(m.id);
        const idJogoStr = m.idJogo ? String(m.idJogo) : "";
        const nomeNorm = (m.nome || "").replace(/\s+/g, " ").trim().toLowerCase();

        let canonicalId = lookupMap.get(idStr) ||
                          (idJogoStr && lookupMap.get(idJogoStr)) ||
                          (nomeNorm && lookupMap.get(nomeNorm));

        if (!canonicalId) {
          for (const [key, val] of lookupMap.entries()) {
            if (nomeNorm && (key.includes(nomeNorm) || nomeNorm.includes(key))) {
              canonicalId = val;
              break;
            }
          }
        }

        if (!canonicalId) {
          canonicalId = idStr || `nome_${nomeNorm}`;
          lookupMap.set(canonicalId, canonicalId);
          if (idJogoStr) lookupMap.set(idJogoStr, canonicalId);
          if (nomeNorm) lookupMap.set(nomeNorm, canonicalId);

          mapa[canonicalId] = {
            id: canonicalId,
            idJogo: m.idJogo || canonicalId,
            nome: m.nome,
            avatar: m.avatar || null,
            cargo: m.cargo || "Mecânico",
            bonusTotal: 0,
            horasTotal: 0,
            minutosTotal: 0,
            turnos: {
              obrigatorio: { horas: 0, minutos: 0, bonus: 0, pctDoTotal: 0 },
              manha: { horas: 0, minutos: 0, bonus: 0, pctDoTotal: 0 },
              tarde: { horas: 0, minutos: 0, bonus: 0, pctDoTotal: 0 },
              madrugada: { horas: 0, minutos: 0, bonus: 0, pctDoTotal: 0 },
            },
            registrosTodos: [],
          };
        }

        mapa[canonicalId].turnos[tId] = {
          horas: m.horasCheias || 0,
          minutos: m.minutosTotal || 0,
          bonus: m.bonus || 0,
          pctDoTotal: 0,
        };
        mapa[canonicalId].bonusTotal += m.bonus || 0;
        mapa[canonicalId].horasTotal += m.horasCheias || 0;
        mapa[canonicalId].minutosTotal += m.minutosTotal || 0;
        if (m.registrosTodos) {
          mapa[canonicalId].registrosTodos.push(...m.registrosTodos);
        }
      });
    });

    // Calcular percentuais do valor total recebido por período (números inteiros sem casas decimais quebradas)
    const todosMecanicos = Object.values(mapa).map((m) => {
      const bt = m.bonusTotal;
      const t = m.turnos;
      return {
        ...m,
        turnos: {
          obrigatorio: { ...t.obrigatorio, pctDoTotal: bt > 0 ? Math.round((t.obrigatorio.bonus / bt) * 100) : 0 },
          manha: { ...t.manha, pctDoTotal: bt > 0 ? Math.round((t.manha.bonus / bt) * 100) : 0 },
          tarde: { ...t.tarde, pctDoTotal: bt > 0 ? Math.round((t.tarde.bonus / bt) * 100) : 0 },
          madrugada: { ...t.madrugada, pctDoTotal: bt > 0 ? Math.round((t.madrugada.bonus / bt) * 100) : 0 },
        },
      };
    });

    // MOSTRAR APENAS MECÂNICOS QUE TEM VALOR A RECEBER (OU HORAS CUMPRIDAS)
    // Isso evita uma lista gigante de dezenas de mecânicos com R$ 0,00
    const listaParaPagar = todosMecanicos.filter((m) => m.bonusTotal > 0 || m.horasTotal > 0);

    // Ordenar do maior para o menor valor a pagar
    listaParaPagar.sort((a, b) => b.bonusTotal - a.bonusTotal || b.horasTotal - a.horasTotal);

    const listaComPosicao = listaParaPagar.map((m, idx) => ({ ...m, posicao: idx + 1 }));

    const totalGeralAPagar = listaComPosicao.reduce((acc, m) => acc + m.bonusTotal, 0);
    const totalMecanicosElegiveis = listaComPosicao.filter((m) => m.bonusTotal > 0).length;
    const montanteTotalPools = turnosIds.reduce((acc, tId) => acc + (relatorios[tId]?.montante || 0), 0);
    const totalHorasGerais = listaComPosicao.reduce((acc, m) => acc + m.horasTotal, 0);
    const maiorBonusIndividual = listaComPosicao.length > 0 ? (listaComPosicao[0].bonusTotal || 0) : 0;

    const totaisPorTurno = {};
    turnosIds.forEach((tId) => {
      const rel = relatorios[tId];
      totaisPorTurno[tId] = {
        bonusTotal: rel?.totalBonusGeral || 0,
        horas: rel?.totalHorasEquipe || 0,
        count: rel?.mecanicosElegiveis || 0,
        montante: rel?.montante || 0,
      };
    });

    return {
      mecanicos: listaComPosicao,
      totalGeralAPagar,
      totalMecanicosElegiveis,
      totalMecanicos: mecanicosAtivos.length,
      montanteTotalPools,
      totalHorasGerais,
      maiorBonusIndividual,
      totaisPorTurno,
      relatoriosTurnos: relatorios,
    };
  }, [montantesPorTurno, pontosCarregados, listaDiasPeriodo, listaFuncionarios]);

  // Filtrar lista por busca de texto
  const mecanicosFiltrados = useMemo(() => {
    if (!relatorioTurno) return [];
    if (!buscaMecanico.trim()) return relatorioTurno.mecanicos;
    const termo = buscaMecanico.toLowerCase();
    return relatorioTurno.mecanicos.filter(
      (m) => m.nome.toLowerCase().includes(termo) || String(m.idJogo).includes(termo)
    );
  }, [relatorioTurno, buscaMecanico]);

  // Filtrar lista consolidada por busca de texto
  const mecanicosConsolidadosFiltrados = useMemo(() => {
    if (!relatorioConsolidado) return [];
    if (!buscaMecanico.trim()) return relatorioConsolidado.mecanicos;
    const termo = buscaMecanico.toLowerCase();
    return relatorioConsolidado.mecanicos.filter(
      (m) => m.nome.toLowerCase().includes(termo) || String(m.idJogo).includes(termo)
    );
  }, [relatorioConsolidado, buscaMecanico]);

  // Função para copiar Folha Consolidada Completa para o Discord
  const copiarConsolidadoDiscord = () => {
    if (!relatorioConsolidado) return;
    const { totalGeralAPagar, totalMecanicosElegiveis, totalHorasGerais, mecanicos } = relatorioConsolidado;
    const elegiveis = mecanicos.filter((m) => m.bonusTotal > 0);

    let texto = `💰 **FOLHA DE BONIFICAÇÃO & RATEIO CONSOLIDADO - RED'S TUNERSHOP**\n`;
    texto += `📅 **Período:** ${semanaInfo.inicioBR} a ${semanaInfo.fimBR}\n`;
    texto += `💵 **Total Geral a Pagar:** R$ ${formatarMoeda(totalGeralAPagar)}\n`;
    texto += `👥 **Mecânicos Bonificados:** ${totalMecanicosElegiveis} de ${mecanicos.length} ativos\n`;
    texto += `⏱️ **Total de Horas Cheias Elegíveis:** ${totalHorasGerais}h somadas nos 4 turnos\n`;
    texto += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    texto += `🏆 **SOMATÓRIA INDIVIDUAL (DO MAIOR PARA O MENOR):**\n\n`;

    if (elegiveis.length === 0) {
      texto += `*Nenhum mecânico atingiu ao menos 1 hora cheia em qualquer turno nesta semana.*\n`;
    } else {
      elegiveis.forEach((m, idx) => {
        const medalha = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `\`${String(idx + 1).padStart(2, "0")}º\``;
        texto += `${medalha} **${m.nome}** (ID: ${m.idJogo}) - 💰 **R$ ${formatarMoeda(m.bonusTotal)}** (${m.horasTotal}h total)\n`;

        const partes = [];
        if (m.turnos.obrigatorio.bonus > 0) {
          partes.push(`⭐ Obrigatório: ${m.turnos.obrigatorio.pctDoTotal}% (R$ ${formatarMoeda(m.turnos.obrigatorio.bonus)})`);
        }
        if (m.turnos.manha.bonus > 0) {
          partes.push(`🌅 Manhã: ${m.turnos.manha.pctDoTotal}% (R$ ${formatarMoeda(m.turnos.manha.bonus)})`);
        }
        if (m.turnos.tarde.bonus > 0) {
          partes.push(`☀️ Tarde: ${m.turnos.tarde.pctDoTotal}% (R$ ${formatarMoeda(m.turnos.tarde.bonus)})`);
        }
        if (m.turnos.madrugada.bonus > 0) {
          partes.push(`🌑 Madrugada: ${m.turnos.madrugada.pctDoTotal}% (R$ ${formatarMoeda(m.turnos.madrugada.bonus)})`);
        }

        if (partes.length > 0) {
          texto += `   └─ ${partes.join(" | ")}\n\n`;
        } else {
          texto += `\n`;
        }
      });
    }

    texto += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    texto += `🔒 *Critério: Somatória unificada dos 4 turnos (Horário Obrigatório 18h-23h, Manhã 06h-12h, Tarde 12h-18h e Madrugada 00h-06h) com rateio proporcional por horas cheias comprovadas.*\n`;

    navigator.clipboard.writeText(texto);
    alert("📋 Folha Consolidada de Pagamentos copiada com sucesso! Pronto para colar no Discord.");
  };

  // Função para copiar Relatório do Turno Ativo para o Discord
  const copiarRelatorioDiscord = () => {
    if (!relatorioTurno) return;
    const { config, montante, totalHorasEquipe, valorPorHoraCompleta, mecanicos } = relatorioTurno;
    const elegiveis = mecanicos.filter((m) => m.horasCheias > 0);

    let texto = `${config.emoji} **${config.labelDiscord} - RED'S TUNERSHOP**\n`;
    texto += `📅 **Período:** ${semanaInfo.inicioBR} a ${semanaInfo.fimBR}\n`;
    texto += `💰 **Montante Total do Rateio:** R$ ${formatarMoeda(montante)}\n`;
    texto += `⏱️ **Total de Horas Cheias da Equipe:** ${totalHorasEquipe}h elegíveis\n`;
    texto += `🏷️ **Valor Pago por Hora Completa:** R$ ${formatarMoeda(valorPorHoraCompleta)} / hora\n`;
    texto += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    texto += `🏆 **RATEIO E PREMIAÇÃO INDIVIDUAL:**\n\n`;

    if (elegiveis.length === 0) {
      texto += `*Nenhum mecânico atingiu ao menos 1 hora cheia dentro do turno nesta semana.*\n`;
    } else {
      elegiveis.forEach((m, idx) => {
        const medalha = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `\`${String(idx + 1).padStart(2, "0")}º\``;
        const tempoFormatado = formatarMinutos(m.minutosTotal);
        texto += `${medalha} **${m.nome}** (ID: ${m.idJogo})\n`;
        texto += `   • Tempo Real no Turno: **${tempoFormatado}** | Horas Elegíveis: **${m.horasCheias}h**\n`;
        texto += `   • 💰 **Bônus a Receber: R$ ${formatarMoeda(m.bonus)}** (${m.pctPool.toFixed(1)}% do pool)\n\n`;
      });
    }

    const zerados = mecanicos.filter((m) => m.minutosTotal > 0 && m.horasCheias === 0);
    if (zerados.length > 0) {
      texto += `⚠️ **Mecânicos com minutos incompletos (< 1h completa no turno):**\n`;
      zerados.forEach((m) => {
        texto += `• ${m.nome}: ${formatarMinutos(m.minutosTotal)} (precisa de 1h cheia para pontuar no bônus)\n`;
      });
      texto += `\n`;
    }

    texto += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    texto += `🔒 *Critério: apenas pontos padrão e saídas válidas dentro do horário oficial do turno são bonificados (18h às 23h a partir de 07/09/2026; 19h às 22h até 06/09/2026).*\n`;

    navigator.clipboard.writeText(texto);
    alert(`📋 Relatório do ${config.nomeCurto} copiado com sucesso! Pronto para colar no Discord.`);
  };

  // ==========================================
  // ESTADOS E CÁLCULOS DA ABA PROPOSTA GERAL
  // ==========================================
  const [montanteProposta, setMontanteProposta] = useState(5000000);
  const [horasTotaisEstimadas, setHorasTotaisEstimadas] = useState(800);
  const [qtdAdmin, setQtdAdmin] = useState(6);

  const [porcentagens, setPorcentagens] = useState({
    horas: 45,
    admin: 15,
    manha: 5,
    tarde: 5,
    noite: 10,
    madrugada: 10,
    obrigatorio: 10,
  });

  const [simCalc, setSimCalc] = useState({
    horasTrabalhadas: 30,
    ehAdmin: false,
    podioMadrugada: 1,
    podioObrigatorio: 0,
    podioManha: 0,
    podioTarde: 0,
    podioNoite: 0,
  });

  const somaPorcentagens = useMemo(() => {
    return (
      (porcentagens.horas || 0) +
      (porcentagens.admin || 0) +
      (porcentagens.manha || 0) +
      (porcentagens.tarde || 0) +
      (porcentagens.noite || 0) +
      (porcentagens.madrugada || 0) +
      (porcentagens.obrigatorio || 0)
    );
  }, [porcentagens]);

  const valoresCalculados = useMemo(() => {
    const totalM = Number(montanteProposta) || 0;
    const hTot = Number(horasTotaisEstimadas) || 1;
    const qAdm = Number(qtdAdmin) || 1;

    const fatiaHoras = totalM * ((porcentagens.horas || 0) / 100);
    const valorPorHora = hTot > 0 ? fatiaHoras / hTot : 0;

    const fatiaAdmin = totalM * ((porcentagens.admin || 0) / 100);
    const valorPorPessoaAdmin = qAdm > 0 ? fatiaAdmin / qAdm : 0;

    const fatiaManha = totalM * ((porcentagens.manha || 0) / 100);
    const fatiaTarde = totalM * ((porcentagens.tarde || 0) / 100);
    const fatiaNoite = totalM * ((porcentagens.noite || 0) / 100);
    const fatiaMadrugada = totalM * ((porcentagens.madrugada || 0) / 100);
    const fatiaObrigatorio = totalM * ((porcentagens.obrigatorio || 0) / 100);

    return {
      horas: { total: fatiaHoras, valorPorHora },
      admin: { total: fatiaAdmin, valorPorPessoa: valorPorPessoaAdmin },
      manha: {
        total: fatiaManha,
        primeiro: fatiaManha * 0.5,
        segundo: fatiaManha * 0.3,
        terceiro: fatiaManha * 0.2,
      },
      tarde: {
        total: fatiaTarde,
        primeiro: fatiaTarde * 0.5,
        segundo: fatiaTarde * 0.3,
        terceiro: fatiaTarde * 0.2,
      },
      noite: {
        total: fatiaNoite,
        primeiro: fatiaNoite * 0.5,
        segundo: fatiaNoite * 0.3,
        terceiro: fatiaNoite * 0.2,
      },
      madrugada: {
        total: fatiaMadrugada,
        primeiro: fatiaMadrugada * 0.5,
        segundo: fatiaMadrugada * 0.3,
        terceiro: fatiaMadrugada * 0.2,
      },
      obrigatorio: {
        total: fatiaObrigatorio,
        primeiro: fatiaObrigatorio * 0.6,
        segundo: fatiaObrigatorio * 0.4,
      },
    };
  }, [montanteProposta, horasTotaisEstimadas, qtdAdmin, porcentagens]);

  const resultadoSimulacaoIndividual = useMemo(() => {
    const ganhoHoras = (Number(simCalc.horasTrabalhadas) || 0) * (valoresCalculados.horas?.valorPorHora || 0);
    const ganhoAdmin = simCalc.ehAdmin ? (valoresCalculados.admin?.valorPorPessoa || 0) : 0;

    let ganhoMadrugada = 0;
    if (simCalc.podioMadrugada === 1) ganhoMadrugada = valoresCalculados.madrugada?.primeiro || 0;
    else if (simCalc.podioMadrugada === 2) ganhoMadrugada = valoresCalculados.madrugada?.segundo || 0;
    else if (simCalc.podioMadrugada === 3) ganhoMadrugada = valoresCalculados.madrugada?.terceiro || 0;

    let ganhoObrigatorio = 0;
    if (simCalc.podioObrigatorio === 1) ganhoObrigatorio = valoresCalculados.obrigatorio?.primeiro || 0;
    else if (simCalc.podioObrigatorio === 2) ganhoObrigatorio = valoresCalculados.obrigatorio?.segundo || 0;

    let ganhoManha = 0;
    if (simCalc.podioManha === 1) ganhoManha = valoresCalculados.manha?.primeiro || 0;
    else if (simCalc.podioManha === 2) ganhoManha = valoresCalculados.manha?.segundo || 0;
    else if (simCalc.podioManha === 3) ganhoManha = valoresCalculados.manha?.terceiro || 0;

    let ganhoTarde = 0;
    if (simCalc.podioTarde === 1) ganhoTarde = valoresCalculados.tarde?.primeiro || 0;
    else if (simCalc.podioTarde === 2) ganhoTarde = valoresCalculados.tarde?.segundo || 0;
    else if (simCalc.podioTarde === 3) ganhoTarde = valoresCalculados.tarde?.terceiro || 0;

    let ganhoNoite = 0;
    if (simCalc.podioNoite === 1) ganhoNoite = valoresCalculados.noite?.primeiro || 0;
    else if (simCalc.podioNoite === 2) ganhoNoite = valoresCalculados.noite?.segundo || 0;
    else if (simCalc.podioNoite === 3) ganhoNoite = valoresCalculados.noite?.terceiro || 0;

    const total = ganhoHoras + ganhoAdmin + ganhoMadrugada + ganhoObrigatorio + ganhoManha + ganhoTarde + ganhoNoite;

    return {
      ganhoHoras,
      ganhoAdmin,
      ganhoMadrugada,
      ganhoObrigatorio,
      ganhoManha,
      ganhoTarde,
      ganhoNoite,
      total,
    };
  }, [simCalc, valoresCalculados]);

  const copiarTextoProposta = () => {
    let texto = `📋 **PROPOSTA DE BONIFICAÇÃO & RATEIO - RED'S TUNERSHOP**\n`;
    texto += `💰 **Montante Semanal Estimado:** R$ ${formatarMoeda(montanteProposta)}\n`;
    texto += `⏱️ **Estimativa de Horas Totais:** ${horasTotaisEstimadas}h | 👔 **Gestores:** ${qtdAdmin}\n`;
    texto += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    texto += `📊 **DISTRIBUIÇÃO DOS PILARES:**\n\n`;
    texto += `⏳ **Horas Gerais (${porcentagens.horas}%):** R$ ${formatarMoeda(valoresCalculados.horas.total)} (R$ ${formatarMoeda(valoresCalculados.horas.valorPorHora)}/h)\n`;
    texto += `👔 **Cargos Administrativos (${porcentagens.admin}%):** R$ ${formatarMoeda(valoresCalculados.admin.total)} (R$ ${formatarMoeda(valoresCalculados.admin.valorPorPessoa)} p/ gestor)\n`;
    texto += `🌅 **Top 3 Manhã (${porcentagens.manha}%):** 🥇 R$ ${formatarMoeda(valoresCalculados.manha.primeiro)} | 🥈 R$ ${formatarMoeda(valoresCalculados.manha.segundo)} | 🥉 R$ ${formatarMoeda(valoresCalculados.manha.terceiro)}\n`;
    texto += `☀️ **Top 3 Tarde (${porcentagens.tarde}%):** 🥇 R$ ${formatarMoeda(valoresCalculados.tarde.primeiro)} | 🥈 R$ ${formatarMoeda(valoresCalculados.tarde.segundo)} | 🥉 R$ ${formatarMoeda(valoresCalculados.tarde.terceiro)}\n`;
    texto += `🌙 **Top 3 Noite (${porcentagens.noite}%):** 🥇 R$ ${formatarMoeda(valoresCalculados.noite.primeiro)} | 🥈 R$ ${formatarMoeda(valoresCalculados.noite.segundo)} | 🥉 R$ ${formatarMoeda(valoresCalculados.noite.terceiro)}\n`;
    texto += `🌌 **Top 3 Madrugada (${porcentagens.madrugada}%):** 🥇 R$ ${formatarMoeda(valoresCalculados.madrugada.primeiro)} | 🥈 R$ ${formatarMoeda(valoresCalculados.madrugada.segundo)} | 🥉 R$ ${formatarMoeda(valoresCalculados.madrugada.terceiro)}\n`;
    texto += `⭐ **Top 2 Horário Obrigatório (${porcentagens.obrigatorio}%):** 🥇 R$ ${formatarMoeda(valoresCalculados.obrigatorio.primeiro)} | 🥈 R$ ${formatarMoeda(valoresCalculados.obrigatorio.segundo)}\n`;
    texto += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

    navigator.clipboard.writeText(texto);
    alert("📋 Proposta formatada copiada com sucesso para a área de transferência!");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Cabeçalho da Central */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        <div style={{ width: "100%", minWidth: 0, color: theme.text }}>
          <h1 style={{ fontSize: "24px", fontWeight: "900", margin: 0, color: "#fff", display: "flex", alignItems: "center", gap: "10px" }}>
            <span>🎁</span> Central de Bonificação & Rateio
          </h1>
          <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: theme.subtext }}>
            Gestão financeira de premiações, rateio proporcional por horas cheias por turnos e proposta geral.
          </p>
        </div>

        {/* Seletor de Abas Principais (Turnos & Proposta) */}
        <div style={{ display: "flex", background: theme.card2, padding: "4px", borderRadius: "14px", border: `1px solid ${theme.border}`, gap: "4px", flexWrap: "wrap" }}>
          {Object.values(TURNOS_CONFIG).map((turno) => {
            const isAtivo = abaAtiva === turno.id;
            return (
              <button
                key={turno.id}
                onClick={() => setAbaAtiva(turno.id)}
                style={{
                  background: isAtivo ? turno.gradient : "transparent",
                  color: isAtivo ? "#fff" : theme.subtext,
                  border: "none",
                  padding: "9px 15px",
                  borderRadius: "10px",
                  fontWeight: "800",
                  fontSize: "12.5px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  boxShadow: isAtivo ? turno.shadow : "none",
                  transition: "all 0.2s ease",
                }}
              >
                <span>{turno.badgeLabel}</span>
              </button>
            );
          })}
          <button
            onClick={() => setAbaAtiva("consolidado")}
            style={{
              background: abaAtiva === "consolidado" ? "linear-gradient(135deg, #10b981 0%, #059669 100%)" : "transparent",
              color: abaAtiva === "consolidado" ? "#fff" : theme.subtext,
              border: "none",
              padding: "9px 15px",
              borderRadius: "10px",
              fontWeight: "800",
              fontSize: "12.5px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              boxShadow: abaAtiva === "consolidado" ? "0 4px 14px rgba(16, 185, 129, 0.4)" : "none",
              transition: "all 0.2s ease",
            }}
          >
            <span>💰 Total a Pagar (Consolidado)</span>
          </button>
          <button
            onClick={() => setAbaAtiva("proposta")}
            style={{
              background: abaAtiva === "proposta" ? "linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)" : "transparent",
              color: abaAtiva === "proposta" ? "#fff" : theme.subtext,
              border: "none",
              padding: "9px 15px",
              borderRadius: "10px",
              fontWeight: "800",
              fontSize: "12.5px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              transition: "all 0.2s ease",
            }}
          >
            <span>📊 Proposta Geral & Turnos</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ABA DE RATEIO DO TURNO SELECIONADO (HORAS CHEIAS) */}
      {/* ========================================================================= */}
      {TURNOS_CONFIG[abaAtiva] && relatorioTurno && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Barra de Filtros e Parâmetros Financeiros */}
          <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: "18px", padding: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
              
              {/* Navegação de Semanas */}
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", background: theme.card2, borderRadius: "12px", border: `1px solid ${theme.border}`, padding: "2px" }}>
                  <button
                    onClick={() => {
                      setModoPeriodo("semana");
                      setOffsetSemana((prev) => prev - 1);
                    }}
                    style={{ background: "transparent", border: "none", color: theme.text, padding: "8px 14px", cursor: "pointer", fontSize: "14px", fontWeight: "800" }}
                    title="Semana Anterior"
                  >
                    ◀
                  </button>
                  <button
                    onClick={() => {
                      setModoPeriodo("semana");
                      setOffsetSemana(0);
                    }}
                    style={{ background: offsetSemana === 0 && modoPeriodo === "semana" ? turnoAtualConfig.bgBadge : "transparent", border: "none", color: offsetSemana === 0 ? turnoAtualConfig.cor : theme.text, padding: "8px 16px", cursor: "pointer", fontSize: "13px", fontWeight: "800" }}
                  >
                    Semana Atual
                  </button>
                  <button
                    onClick={() => {
                      setModoPeriodo("semana");
                      setOffsetSemana((prev) => prev + 1);
                    }}
                    style={{ background: "transparent", border: "none", color: theme.text, padding: "8px 14px", cursor: "pointer", fontSize: "14px", fontWeight: "800" }}
                    title="Próxima Semana"
                  >
                    ▶
                  </button>
                </div>

                <span style={{ fontSize: "14px", fontWeight: "800", color: "#fff", background: "rgba(255,255,255,0.06)", padding: "8px 14px", borderRadius: "10px", border: `1px solid ${theme.border}` }}>
                  📅 {semanaInfo.label}
                </span>

                {/* Filtro de Regra Ativa */}
                <span style={{ fontSize: "11px", fontWeight: "700", color: "#22c55e", background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)", padding: "6px 12px", borderRadius: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span>🔒</span> Filtro Estrito: Padrão + Logs de Tunagem & Bancada ({turnoAtualConfig.id === "obrigatorio" ? "18h-23h (≥ 07/09) / 19h-22h (≤ 06/09)" : `${turnoAtualConfig.horaInicio.slice(0, 2)}h-${turnoAtualConfig.horaFim.slice(0, 2)}h`})
                </span>
              </div>

              {/* Botões de Ação */}
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <button
                  onClick={carregarPontosTurnos}
                  disabled={carregandoPontos}
                  style={{
                    background: theme.card2,
                    border: `1px solid ${theme.border}`,
                    padding: "10px 16px",
                    borderRadius: "12px",
                    color: theme.text,
                    fontWeight: "700",
                    cursor: "pointer",
                    fontSize: "13px",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <span>🔄</span> {carregandoPontos ? "Atualizando..." : "Atualizar"}
                </button>
                <button
                  onClick={copiarRelatorioDiscord}
                  style={{
                    background: turnoAtualConfig.gradient,
                    border: "none",
                    padding: "10px 20px",
                    borderRadius: "12px",
                    color: "#fff",
                    fontWeight: "800",
                    cursor: "pointer",
                    fontSize: "13px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    boxShadow: turnoAtualConfig.shadow,
                  }}
                >
                  <span>📋</span> Copiar para Discord
                </button>
              </div>
            </div>

            <hr style={{ borderColor: theme.border, margin: "16px 0", opacity: 0.5 }} />

            {/* Controle de Montante Total do Rateio deste Turno */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: "800", color: turnoAtualConfig.cor, textTransform: "uppercase", display: "block", marginBottom: "4px" }}>
                    💰 Montante Total do Bônus ({turnoAtualConfig.nomeCurto})
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "18px", fontWeight: "900", color: theme.subtext }}>R$</span>
                    <input
                      type="text"
                      value={montanteAtualTurno ? Number(montanteAtualTurno).toLocaleString("pt-BR") : ""}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, "");
                        atualizarMontanteTurno(abaAtiva, raw ? parseInt(raw, 10) : 0);
                      }}
                      placeholder="0"
                      style={{
                        width: "200px",
                        background: theme.card2,
                        border: `1px solid ${theme.border}`,
                        borderRadius: "10px",
                        padding: "8px 12px",
                        fontSize: "18px",
                        fontWeight: "900",
                        color: "#fff",
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: "flex", gap: "6px", alignItems: "flex-end" }}>
                  {[300000, 500000, 1000000, 2000000, 10000000].map((v) => (
                    <button
                      key={v}
                      onClick={() => atualizarMontanteTurno(abaAtiva, v)}
                      style={{
                        background: montanteAtualTurno === v ? turnoAtualConfig.cor : theme.card2,
                        color: montanteAtualTurno === v ? "#fff" : theme.subtext,
                        border: `1px solid ${theme.border}`,
                        padding: "6px 12px",
                        borderRadius: "8px",
                        fontSize: "12px",
                        fontWeight: "700",
                        cursor: "pointer",
                      }}
                    >
                      {v >= 1000000 ? `R$ ${v / 1000000}M` : `R$ ${v / 1000}k`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Busca de Mecânico */}
              <div style={{ width: "260px" }}>
                <label style={{ fontSize: "11px", fontWeight: "800", color: theme.subtext, textTransform: "uppercase", display: "block", marginBottom: "4px" }}>
                  🔍 Filtrar Mecânico
                </label>
                <input
                  type="text"
                  value={buscaMecanico}
                  onChange={(e) => setBuscaMecanico(e.target.value)}
                  placeholder="Nome ou ID..."
                  style={{
                    width: "100%",
                    background: theme.card2,
                    border: `1px solid ${theme.border}`,
                    borderRadius: "10px",
                    padding: "8px 12px",
                    fontSize: "13px",
                    color: "#fff",
                  }}
                />
              </div>
            </div>
          </div>

          {/* Cards de Métricas Principais */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
            <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: "16px", padding: "18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "12px", fontWeight: "800", color: theme.subtext, textTransform: "uppercase" }}>💰 Montante Total</span>
                <span style={{ fontSize: "20px" }}>💵</span>
              </div>
              <div style={{ fontSize: "22px", fontWeight: "900", color: "#fff", marginTop: "8px" }}>
                R$ {formatarMoeda(relatorioTurno.montante)}
              </div>
              <div style={{ fontSize: "11px", color: theme.subtext, marginTop: "4px" }}>
                Distribuído 100% entre as horas cheias
              </div>
            </div>

            <div style={{ background: theme.card, border: `1.5px solid ${turnoAtualConfig.cor}`, borderRadius: "16px", padding: "18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "12px", fontWeight: "800", color: turnoAtualConfig.cor, textTransform: "uppercase" }}>⏱️ Horas Cheias da Equipe</span>
                <span style={{ fontSize: "20px" }}>{turnoAtualConfig.emoji}</span>
              </div>
              <div style={{ fontSize: "22px", fontWeight: "900", color: turnoAtualConfig.cor, marginTop: "8px" }}>
                {relatorioTurno.totalHorasEquipe} Horas
              </div>
              <div style={{ fontSize: "11px", color: theme.subtext, marginTop: "4px" }}>
                Tempo real total no turno: {formatarMinutos(relatorioTurno.totalMinutosEquipe)}
              </div>
            </div>

            <div style={{ background: theme.card, border: "1px solid #10b981", borderRadius: "16px", padding: "18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "12px", fontWeight: "800", color: "#34d399", textTransform: "uppercase" }}>🏷️ Valor Pago por Hora</span>
                <span style={{ fontSize: "20px" }}>💎</span>
              </div>
              <div style={{ fontSize: "22px", fontWeight: "900", color: "#34d399", marginTop: "8px" }}>
                R$ {formatarMoeda(relatorioTurno.valorPorHoraCompleta)}
              </div>
              <div style={{ fontSize: "11px", color: theme.subtext, marginTop: "4px" }}>
                Para cada 60 minutos completos
              </div>
            </div>

            <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: "16px", padding: "18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "12px", fontWeight: "800", color: theme.subtext, textTransform: "uppercase" }}>👥 Mecânicos Elegíveis</span>
                <span style={{ fontSize: "20px" }}>🎯</span>
              </div>
              <div style={{ fontSize: "22px", fontWeight: "900", color: "#fff", marginTop: "8px" }}>
                {relatorioTurno.mecanicosElegiveis} / {relatorioTurno.totalMecanicos}
              </div>
              <div style={{ fontSize: "11px", color: theme.subtext, marginTop: "4px" }}>
                Mecânicos com pelo menos 1h cheia no turno
              </div>
            </div>
          </div>

          {/* Tabela do Turno com Matriz Semanal (Seg a Dom) */}
          <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: "18px", overflow: "hidden" }}>
            <div style={{ padding: "18px 20px", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#fff" }}>
                  📋 Detalhamento Semanal por Mecânico ({turnoAtualConfig.badgeLabel})
                </h3>
                <span style={{ fontSize: "12px", color: theme.subtext }}>
                  💡 <b>Dica:</b> Clique no nome de qualquer mecânico para ver a relação exata de registros e horários considerados.
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: theme.subtext }}>
                <span style={{ display: "inline-block", width: "10px", height: "10px", borderRadius: "50%", background: "#10b981" }}></span>
                <span>Rateio Ativo ({turnoAtualConfig.id === "obrigatorio" ? "18h às 23h a partir de 07/09" : `${turnoAtualConfig.horaInicio.slice(0, 2)}h às ${turnoAtualConfig.horaFim.slice(0, 2)}h`})</span>
              </div>
            </div>

            <div style={{ overflowX: "auto", width: "100%" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px", minWidth: "980px" }}>
                <thead>
                  <tr style={{ background: theme.card2, borderBottom: `1px solid ${theme.border}`, color: theme.subtext, fontSize: "11px", textTransform: "uppercase" }}>
                    <th style={{ padding: "12px 8px", width: "40px", textAlign: "center", whiteSpace: "nowrap" }}>#</th>
                    <th style={{ padding: "12px 12px", minWidth: "180px", whiteSpace: "nowrap" }}>Mecânico</th>
                    {listaDiasPeriodo.map((d) => (
                      <th key={d.dateStr} style={{ padding: "12px 4px", textAlign: "center", minWidth: "48px", whiteSpace: "nowrap" }}>
                        <div>{d.sigla}</div>
                        <div style={{ fontSize: "9px", opacity: 0.7 }}>{d.labelBR.substring(0, 5)}</div>
                      </th>
                    ))}
                    <th style={{ padding: "12px 10px", textAlign: "center", whiteSpace: "nowrap" }}>Tempo Real</th>
                    <th style={{ padding: "12px 10px", textAlign: "center", color: turnoAtualConfig.cor, whiteSpace: "nowrap" }}>Horas Cheias</th>
                    <th style={{ padding: "12px 10px", textAlign: "center", whiteSpace: "nowrap" }}>% Pool</th>
                    <th style={{ padding: "12px 12px", textAlign: "right", color: "#34d399", whiteSpace: "nowrap", minWidth: "135px" }}>💰 Bônus Total</th>
                    <th style={{ padding: "12px 12px", textAlign: "center", width: "75px", whiteSpace: "nowrap" }}>Extrato</th>
                  </tr>
                </thead>
                <tbody>
                  {mecanicosFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={7 + listaDiasPeriodo.length} style={{ textAlign: "center", padding: "32px", color: theme.subtext }}>
                        {carregandoPontos ? "Carregando registros do banco de dados..." : "Nenhum registro de ponto encontrado para o período selecionado."}
                      </td>
                    </tr>
                  ) : (
                    mecanicosFiltrados.map((m, idx) => {
                      const ehTop1 = idx === 0 && m.horasCheias > 0;
                      const ehTop2 = idx === 1 && m.horasCheias > 0;
                      const ehTop3 = idx === 2 && m.horasCheias > 0;
                      const medalha = ehTop1 ? "🥇" : ehTop2 ? "🥈" : ehTop3 ? "🥉" : `${idx + 1}º`;

                      return (
                        <tr
                          key={m.id}
                          onClick={() => setMecanicoDetalhe(m)}
                          style={{
                            borderBottom: `1px solid ${theme.border}33`,
                            background: m.horasCheias > 0 ? (ehTop1 ? turnoAtualConfig.bgBadge : "transparent") : "rgba(255,255,255,0.01)",
                            transition: "background 0.2s ease",
                            cursor: "pointer",
                          }}
                          title="Clique para ver o extrato completo de horas deste mecânico"
                        >
                          <td style={{ padding: "10px 8px", textAlign: "center", fontWeight: "800", fontSize: "14px", whiteSpace: "nowrap" }}>
                            {medalha}
                          </td>
                          <td style={{ padding: "10px 12px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <div style={{ width: "30px", height: "30px", borderRadius: "50%", background: theme.card2, border: `1px solid ${theme.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "800", fontSize: "11px", color: turnoAtualConfig.cor, flexShrink: 0 }}>
                                {m.avatar ? (
                                  <img src={m.avatar} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                                ) : (
                                  m.nome.charAt(0).toUpperCase()
                                )}
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <b style={{ color: "#fff", fontSize: "13px", display: "flex", alignItems: "center", gap: "4px", whiteSpace: "nowrap" }}>
                                  <span>{m.nome}</span>
                                  <span style={{ fontSize: "11px", opacity: 0.6 }}>🔍</span>
                                </b>
                                <span style={{ fontSize: "10px", color: theme.subtext, whiteSpace: "nowrap", display: "block" }}>
                                  ID: {m.idJogo} • {m.cargo}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Minutos em cada dia da semana */}
                          {listaDiasPeriodo.map((d) => {
                            const minDia = m.minutosPorDia[d.dateStr] || 0;
                            return (
                              <td key={d.dateStr} style={{ padding: "10px 4px", textAlign: "center", whiteSpace: "nowrap" }}>
                                {minDia > 0 ? (
                                  <span style={{
                                    fontSize: "11px",
                                    fontWeight: "700",
                                    background: minDia >= 120 ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.06)",
                                    color: minDia >= 120 ? "#4ade80" : "#fff",
                                    padding: "2px 5px",
                                    borderRadius: "5px",
                                    border: minDia >= 120 ? "1px solid rgba(34,197,94,0.3)" : `1px solid ${theme.border}`,
                                    whiteSpace: "nowrap",
                                    display: "inline-block",
                                  }}>
                                    {formatarMinutos(minDia)}
                                  </span>
                                ) : (
                                  <span style={{ color: theme.subtext, opacity: 0.25 }}>-</span>
                                )}
                              </td>
                            );
                          })}

                          {/* Tempo Real Total */}
                          <td style={{ padding: "10px 10px", textAlign: "center", fontWeight: "700", color: "#fff", whiteSpace: "nowrap" }}>
                            {formatarMinutos(m.minutosTotal)}
                          </td>

                          {/* Horas Cheias Elegíveis */}
                          <td style={{ padding: "10px 10px", textAlign: "center", whiteSpace: "nowrap" }}>
                            {m.horasCheias > 0 ? (
                              <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center" }}>
                                <span style={{ background: turnoAtualConfig.bgBadge, color: turnoAtualConfig.cor, border: `1px solid ${turnoAtualConfig.borderBadge}`, padding: "3px 8px", borderRadius: "6px", fontWeight: "900", fontSize: "12px", whiteSpace: "nowrap" }}>
                                  {m.horasCheias}h
                                </span>
                                {m.sobraMinutos > 0 && (
                                  <span style={{ fontSize: "9px", color: theme.subtext, marginTop: "1px", whiteSpace: "nowrap" }}>
                                    +{m.sobraMinutos}m
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span style={{ fontSize: "11px", color: theme.subtext, opacity: 0.6, whiteSpace: "nowrap" }}>
                                {m.minutosTotal > 0 ? `${m.minutosTotal}m` : "0h"}
                              </span>
                            )}
                          </td>

                          {/* % do Pool */}
                          <td style={{ padding: "10px 10px", textAlign: "center", fontSize: "12px", color: theme.subtext, whiteSpace: "nowrap" }}>
                            {m.pctPool > 0 ? `${m.pctPool.toFixed(1)}%` : "-"}
                          </td>

                          {/* Bônus Calculado */}
                          <td style={{ padding: "10px 12px", textAlign: "right", whiteSpace: "nowrap" }}>
                            {m.bonus > 0 ? (
                              <span style={{ fontSize: "13px", fontWeight: "900", color: "#34d399", background: "rgba(16,185,129,0.1)", padding: "4px 10px", borderRadius: "8px", border: "1px solid rgba(16,185,129,0.2)", whiteSpace: "nowrap", display: "inline-block" }}>
                                R$ {formatarMoeda(m.bonus)}
                              </span>
                            ) : (
                              <span style={{ color: theme.subtext, opacity: 0.5, fontSize: "12px", whiteSpace: "nowrap" }}>R$ 0,00</span>
                            )}
                          </td>

                          {/* Botão de Ver Extrato */}
                          <td style={{ padding: "10px 12px", textAlign: "center", whiteSpace: "nowrap" }}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setMecanicoDetalhe(m);
                              }}
                              style={{
                                background: theme.card2,
                                border: `1px solid ${theme.border}`,
                                color: "#fff",
                                padding: "4px 8px",
                                borderRadius: "6px",
                                fontSize: "11px",
                                fontWeight: "700",
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "3px",
                                whiteSpace: "nowrap",
                              }}
                              title="Ver relação detalhada de pontos"
                            >
                              <span>📋</span> Ver
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Regras e Funcionamento do Rateio */}
          <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: "18px", padding: "24px" }}>
            <h3 style={{ margin: "0 0 12px 0", fontSize: "16px", fontWeight: "800", color: "#fff" }}>
              📖 Regras de Elegibilidade para o Rateio do {turnoAtualConfig.titulo}
            </h3>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px", fontSize: "13px", color: theme.subtext, lineHeight: "1.5" }}>
              <div style={{ background: theme.card2, padding: "16px", borderRadius: "12px", borderLeft: "4px solid #22c55e" }}>
                <b style={{ color: "#4ade80", display: "block", marginBottom: "4px" }}>✅ Tipos Considerados no Cálculo:</b>
                • <b>Ponto Padrão:</b> Registros com entrada e saída fechada normalmente.<br />
                • <b>Log de Tunagem:</b> Saídas confirmadas via log de tunagem realizada.<br />
                • <b>Log de Bancada:</b> Saídas confirmadas via log de compra/uso de bancada.<br />
                • <b>Auto-Fechado (Crash):</b> Ponto encerrado no horário da última bancada/tunagem após 2h de inatividade.
              </div>

              <div style={{ background: theme.card2, padding: "16px", borderRadius: "12px", borderLeft: "4px solid #ef4444" }}>
                <b style={{ color: "#f87171", display: "block", marginBottom: "4px" }}>❌ Tipos Desconsiderados:</b>
                • <b>Outra Entrada / Reconexão:</b> Saídas estimadas por login posterior.<br />
                • <b>Sem Saída:</b> Pontos esquecidos abertos ou sem fechamento oficial.<br />
                • <b>Fora da Janela Oficial:</b> Minutos fora do horário estabelecido para o turno.
              </div>

              <div style={{ background: theme.card2, padding: "16px", borderRadius: "12px", borderLeft: `4px solid ${turnoAtualConfig.cor}` }}>
                <b style={{ color: turnoAtualConfig.cor, display: "block", marginBottom: "4px" }}>{turnoAtualConfig.emoji} Horas Completas de 60 Minutos:</b>
                {turnoAtualConfig.id === "obrigatorio" ? (
                  <span>
                    A partir de <b>07/09/2026</b>, a janela é das <b>18:00 às 23:00 (5h)</b>. Para dias até <b>06/09/2026</b>, o sistema mantém o histórico exato das <b>19:00 às 22:00 (3h)</b>. O rateio divide os minutos reais por 60 (`Math.floor`).
                  </span>
                ) : (
                  <span>
                    O sistema soma os minutos reais elegíveis na semana dentro do intervalo ({turnoAtualConfig.horaInicio.slice(0, 2)}h às {turnoAtualConfig.horaFim.slice(0, 2)}h) e divide por 60 (`Math.floor`).
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL DE DETALHAMENTO / EXTRATO DO MECÂNICO NO TURNO */}
      {/* ========================================================================= */}
      {mecanicoDetalhe && TURNOS_CONFIG[abaAtiva] && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(6px)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
          onClick={() => setMecanicoDetalhe(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: theme.card,
              border: `1px solid ${theme.border}`,
              borderRadius: "20px",
              width: "100%",
              maxWidth: "960px",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
            }}
          >
            {/* Topo do Modal */}
            <div style={{ padding: "20px 24px", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", background: theme.card2 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "42px", height: "42px", borderRadius: "50%", background: turnoAtualConfig.bgBadge, border: `1px solid ${turnoAtualConfig.borderBadge}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "900", fontSize: "16px", color: turnoAtualConfig.cor }}>
                  {mecanicoDetalhe.avatar ? (
                    <img src={mecanicoDetalhe.avatar} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                  ) : (
                    mecanicoDetalhe.nome.charAt(0).toUpperCase()
                  )}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "900", color: "#fff" }}>
                    {mecanicoDetalhe.nome}
                  </h3>
                  <span style={{ fontSize: "12px", color: theme.subtext }}>
                    ID: {mecanicoDetalhe.idJogo} • {mecanicoDetalhe.cargo} • Extrato do {turnoAtualConfig.badgeLabel} ({semanaInfo.inicioBR} a {semanaInfo.fimBR})
                  </span>
                </div>
              </div>

              <button
                onClick={() => setMecanicoDetalhe(null)}
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: `1px solid ${theme.border}`,
                  color: "#fff",
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  cursor: "pointer",
                  fontSize: "16px",
                  fontWeight: "bold",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ✕
              </button>
            </div>

            {/* Resumo de Ganhos do Mecânico */}
            <div style={{ padding: "16px 24px", background: "rgba(255,255,255,0.02)", borderBottom: `1px solid ${theme.border}`, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
              <div style={{ background: theme.card2, padding: "12px 16px", borderRadius: "12px", border: `1px solid ${theme.border}` }}>
                <span style={{ fontSize: "10px", fontWeight: "800", color: theme.subtext, textTransform: "uppercase" }}>Tempo Total no Turno</span>
                <div style={{ fontSize: "18px", fontWeight: "900", color: "#fff", marginTop: "2px" }}>
                  {formatarMinutos(mecanicoDetalhe.minutosTotal)}
                </div>
              </div>

              <div style={{ background: theme.card2, padding: "12px 16px", borderRadius: "12px", border: `1px solid ${turnoAtualConfig.borderBadge}` }}>
                <span style={{ fontSize: "10px", fontWeight: "800", color: turnoAtualConfig.cor, textTransform: "uppercase" }}>Horas Cheias ({turnoAtualConfig.nomeCurto})</span>
                <div style={{ fontSize: "18px", fontWeight: "900", color: turnoAtualConfig.cor, marginTop: "2px" }}>
                  {mecanicoDetalhe.horasCheias}h {mecanicoDetalhe.sobraMinutos > 0 ? `(+ ${mecanicoDetalhe.sobraMinutos}m)` : ""}
                </div>
              </div>

              <div style={{ background: theme.card2, padding: "12px 16px", borderRadius: "12px", border: "1px solid rgba(34,197,94,0.3)" }}>
                <span style={{ fontSize: "10px", fontWeight: "800", color: "#4ade80", textTransform: "uppercase" }}>Bônus a Receber</span>
                <div style={{ fontSize: "18px", fontWeight: "900", color: "#4ade80", marginTop: "2px" }}>
                  R$ {formatarMoeda(mecanicoDetalhe.bonus)}
                </div>
              </div>

              <div style={{ background: theme.card2, padding: "12px 16px", borderRadius: "12px", border: `1px solid ${theme.border}` }}>
                <span style={{ fontSize: "10px", fontWeight: "800", color: theme.subtext, textTransform: "uppercase" }}>Fatia do Rateio</span>
                <div style={{ fontSize: "18px", fontWeight: "900", color: "#fff", marginTop: "2px" }}>
                  {mecanicoDetalhe.pctPool.toFixed(1)}% do pool
                </div>
              </div>
            </div>

            {/* Lista de Registros Avaliados */}
            <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <h4 style={{ margin: 0, fontSize: "14px", fontWeight: "800", color: "#fff" }}>
                  📑 Extrato Detalhado de Registros de Ponto ({mecanicoDetalhe.registrosTodos.length} sessões)
                </h4>
                <span style={{ fontSize: "11px", color: theme.subtext }}>
                  Janela oficial do turno aplicada dia a dia
                </span>
              </div>

              {mecanicoDetalhe.registrosTodos.length === 0 ? (
                <div style={{ textAlign: "center", padding: "32px", color: theme.subtext }}>
                  Nenhum registro de ponto encontrado para este funcionário na semana selecionada.
                </div>
              ) : (
                <div style={{ border: `1px solid ${theme.border}`, borderRadius: "14px", overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "12px" }}>
                    <thead>
                      <tr style={{ background: theme.card2, borderBottom: `1px solid ${theme.border}`, color: theme.subtext, fontSize: "10px", textTransform: "uppercase" }}>
                        <th style={{ padding: "10px 14px" }}>Data / Dia</th>
                        <th style={{ padding: "10px 12px" }}>Entrada</th>
                        <th style={{ padding: "10px 12px" }}>Saída</th>
                        <th style={{ padding: "10px 12px" }}>Tipo da Saída</th>
                        <th style={{ padding: "10px 12px", textAlign: "center" }}>Duração Ponto</th>
                        <th style={{ padding: "10px 14px", textAlign: "center", color: turnoAtualConfig.cor }}>Tempo {turnoAtualConfig.nomeCurto}</th>
                        <th style={{ padding: "10px 14px", textAlign: "center" }}>Status Cálculo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mecanicoDetalhe.registrosTodos.map((r, i) => {
                        const dateBR = r.dEntrada.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
                        const diaSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][r.dEntrada.getDay()];
                        const { classificacao, minPicoReg, duracaoTotalMin } = r;

                        return (
                          <tr
                            key={r.uuid || r.id || i}
                            style={{
                              borderBottom: `1px solid ${theme.border}33`,
                              background: classificacao.elegivel && minPicoReg > 0 ? "rgba(34,197,94,0.04)" : !classificacao.elegivel ? "rgba(239,68,68,0.03)" : "transparent",
                            }}
                          >
                            <td style={{ padding: "10px 14px", fontWeight: "700", color: "#fff" }}>
                              {dateBR} <span style={{ color: theme.subtext, fontSize: "11px" }}>({diaSemana})</span>
                            </td>
                            <td style={{ padding: "10px 12px", color: "#fff" }}>
                              {formatarHoraSimples(r.entrada)}
                            </td>
                            <td style={{ padding: "10px 12px", color: "#fff" }}>
                              {r.dSaidaElegivel ? formatarHoraSimples(r.dSaidaElegivel) : (r.saida ? formatarHoraSimples(r.saida) : "—")}
                            </td>
                            <td style={{ padding: "10px 12px" }}>
                              <span
                                style={{
                                  background: classificacao.bgBadge,
                                  color: classificacao.badgeColor,
                                  border: `1px solid ${classificacao.badgeColor}44`,
                                  padding: "3px 8px",
                                  borderRadius: "6px",
                                  fontSize: "11px",
                                  fontWeight: "700",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                }}
                                title={r.observacao || r.motivo || classificacao.label}
                              >
                                <span>{classificacao.icon}</span> {classificacao.label}
                              </span>
                            </td>
                            <td style={{ padding: "10px 12px", textAlign: "center", color: theme.subtext }}>
                              {formatarMinutos(duracaoTotalMin)}
                            </td>
                            <td style={{ padding: "10px 14px", textAlign: "center", fontWeight: "800", color: minPicoReg > 0 ? "#4ade80" : theme.subtext }}>
                              {minPicoReg > 0 ? formatarMinutos(minPicoReg) : "—"}
                            </td>
                            <td style={{ padding: "10px 14px", textAlign: "center" }}>
                              {classificacao.elegivel ? (
                                <span style={{ background: "rgba(34,197,94,0.15)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.3)", padding: "2px 8px", borderRadius: "6px", fontSize: "10px", fontWeight: "800" }}>
                                  ✓ Considerado
                                </span>
                              ) : (
                                <span style={{ background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)", padding: "2px 8px", borderRadius: "6px", fontSize: "10px", fontWeight: "800" }} title="Desconsiderado conforme regra de bônus">
                                  ✕ Ignorado
                                </span>
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

            {/* Rodapé do Modal */}
            <div style={{ padding: "16px 24px", borderTop: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", background: theme.card2 }}>
              <span style={{ fontSize: "11px", color: theme.subtext }}>
                🔒 Registros com sobreposição no mesmo dia têm os minutos unificados para evitar duplicidade.
              </span>
              <button
                onClick={() => setMecanicoDetalhe(null)}
                style={{
                  background: theme.card,
                  border: `1px solid ${theme.border}`,
                  color: "#fff",
                  padding: "8px 18px",
                  borderRadius: "10px",
                  fontSize: "12px",
                  fontWeight: "700",
                  cursor: "pointer",
                }}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA CONSOLIDADA: TOTAL A PAGAR (TODOS OS TURNOS) */}
      {/* ========================================================================= */}
      {abaAtiva === "consolidado" && relatorioConsolidado && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Barra de Controles e Filtro de Semana */}
          <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: "18px", padding: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
              {/* Navegação de Semanas */}
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", background: theme.card2, borderRadius: "12px", border: `1px solid ${theme.border}`, padding: "2px" }}>
                  <button
                    onClick={() => {
                      setModoPeriodo("semana");
                      setOffsetSemana((prev) => prev - 1);
                    }}
                    style={{ background: "transparent", border: "none", color: theme.text, padding: "8px 14px", cursor: "pointer", fontSize: "14px", fontWeight: "800" }}
                    title="Semana Anterior"
                  >
                    ◀
                  </button>
                  <button
                    onClick={() => {
                      setModoPeriodo("semana");
                      setOffsetSemana(0);
                    }}
                    style={{ background: offsetSemana === 0 && modoPeriodo === "semana" ? "rgba(16, 185, 129, 0.2)" : "transparent", border: "none", color: offsetSemana === 0 ? "#10b981" : theme.text, padding: "8px 16px", cursor: "pointer", fontSize: "13px", fontWeight: "800" }}
                  >
                    Semana Atual
                  </button>
                  <button
                    onClick={() => {
                      setModoPeriodo("semana");
                      setOffsetSemana((prev) => prev + 1);
                    }}
                    style={{ background: "transparent", border: "none", color: theme.text, padding: "8px 14px", cursor: "pointer", fontSize: "14px", fontWeight: "800" }}
                    title="Próxima Semana"
                  >
                    ▶
                  </button>
                </div>

                <span style={{ fontSize: "14px", fontWeight: "800", color: "#fff", background: "rgba(255,255,255,0.06)", padding: "8px 14px", borderRadius: "10px", border: `1px solid ${theme.border}` }}>
                  📅 {semanaInfo.label}
                </span>

                <span style={{ fontSize: "11px", fontWeight: "700", color: "#10b981", background: "rgba(16, 185, 129, 0.12)", border: "1px solid rgba(16, 185, 129, 0.3)", padding: "6px 12px", borderRadius: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span>💰</span> Folha Consolidada (Soma dos 4 Períodos: Obrigatório, Manhã, Tarde e Madrugada)
                </span>
              </div>

              {/* Botões de Ação */}
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <button
                  onClick={carregarPontosTurnos}
                  disabled={carregandoPontos}
                  style={{
                    background: theme.card2,
                    border: `1px solid ${theme.border}`,
                    padding: "10px 16px",
                    borderRadius: "12px",
                    color: theme.text,
                    fontWeight: "700",
                    cursor: "pointer",
                    fontSize: "13px",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <span style={{ animation: carregandoPontos ? "spin 1s infinite linear" : "none" }}>🔄</span>
                  {carregandoPontos ? "Atualizando..." : "Atualizar Dados"}
                </button>

                <button
                  onClick={copiarConsolidadoDiscord}
                  style={{
                    background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                    border: "none",
                    padding: "10px 18px",
                    borderRadius: "12px",
                    color: "#fff",
                    fontWeight: "800",
                    cursor: "pointer",
                    fontSize: "13px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    boxShadow: "0 4px 14px rgba(16, 185, 129, 0.35)",
                  }}
                >
                  <span>📋</span> Copiar Folha p/ Discord
                </button>
              </div>
            </div>
          </div>

          {/* Cards KPI Gerais do Consolidado */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
            <div style={{ background: theme.card, border: "1.5px solid #10b981", borderRadius: "16px", padding: "18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "12px", fontWeight: "800", color: "#10b981", textTransform: "uppercase" }}>💰 Folha Total da Semana</span>
                <span style={{ fontSize: "20px" }}>💵</span>
              </div>
              <div style={{ fontSize: "24px", fontWeight: "900", color: "#10b981", marginTop: "8px" }}>
                R$ {formatarMoeda(relatorioConsolidado.totalGeralAPagar)}
              </div>
              <div style={{ fontSize: "11px", color: theme.subtext, marginTop: "4px" }}>
                Soma integral dos bônus a pagar em todos os 4 turnos
              </div>
            </div>

            <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: "16px", padding: "18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "12px", fontWeight: "800", color: theme.subtext, textTransform: "uppercase" }}>👥 Mecânicos Bonificados</span>
                <span style={{ fontSize: "20px" }}>🎯</span>
              </div>
              <div style={{ fontSize: "24px", fontWeight: "900", color: "#fff", marginTop: "8px" }}>
                {relatorioConsolidado.totalMecanicosElegiveis} / {relatorioConsolidado.totalMecanicos}
              </div>
              <div style={{ fontSize: "11px", color: theme.subtext, marginTop: "4px" }}>
                Mecânicos com valor a receber na semana
              </div>
            </div>

            <div style={{ background: theme.card, border: "1px solid #f59e0b", borderRadius: "16px", padding: "18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "12px", fontWeight: "800", color: "#f59e0b", textTransform: "uppercase" }}>🏆 Maior Bônus da Semana</span>
                <span style={{ fontSize: "20px" }}>🥇</span>
              </div>
              <div style={{ fontSize: "24px", fontWeight: "900", color: "#f59e0b", marginTop: "8px" }}>
                R$ {formatarMoeda(relatorioConsolidado.maiorBonusIndividual)}
              </div>
              <div style={{ fontSize: "11px", color: theme.subtext, marginTop: "4px" }}>
                {relatorioConsolidado.mecanicos[0] ? `${relatorioConsolidado.mecanicos[0].nome} (${relatorioConsolidado.mecanicos[0].horasTotal}h total)` : "Nenhum no período"}
              </div>
            </div>

            <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: "16px", padding: "18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "12px", fontWeight: "800", color: theme.subtext, textTransform: "uppercase" }}>⏱️ Horas Cheias Totais</span>
                <span style={{ fontSize: "20px" }}>⏳</span>
              </div>
              <div style={{ fontSize: "24px", fontWeight: "900", color: "#fff", marginTop: "8px" }}>
                {relatorioConsolidado.totalHorasGerais} Horas
              </div>
              <div style={{ fontSize: "11px", color: theme.subtext, marginTop: "4px" }}>
                Acumulado de horas computadas nos 4 períodos
              </div>
            </div>
          </div>

          {/* Cards dos 4 Turnos no Rateio Geral */}
          <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: "18px", padding: "18px" }}>
            <div style={{ fontSize: "12px", fontWeight: "800", color: theme.subtext, textTransform: "uppercase", marginBottom: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
              <span>📊</span> Subtotais por Período da Semana
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "12px" }}>
              {Object.keys(TURNOS_CONFIG).map((tKey) => {
                const cfg = TURNOS_CONFIG[tKey];
                const tData = relatorioConsolidado?.totaisPorTurno?.[tKey] || { bonusTotal: 0, horas: 0, count: 0, montante: 0 };
                const pctGeral = (relatorioConsolidado?.totalGeralAPagar || 0) > 0 
                  ? Math.round((tData.bonusTotal / relatorioConsolidado.totalGeralAPagar) * 100)
                  : 0;
                return (
                  <div
                    key={tKey}
                    onClick={() => setAbaAtiva(tKey)}
                    style={{
                      background: cfg.bgBadge,
                      border: `1px solid ${cfg.cor}44`,
                      borderRadius: "14px",
                      padding: "14px 16px",
                      cursor: "pointer",
                      transition: "transform 0.15s ease",
                    }}
                    title={`Clique para ver os detalhes de ${cfg.nome}`}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "12px", fontWeight: "800", color: cfg.cor }}>
                        {cfg.emoji} {cfg.nome}
                      </span>
                      <span style={{ fontSize: "11px", fontWeight: "800", color: cfg.cor, background: "rgba(0,0,0,0.25)", padding: "2px 6px", borderRadius: "6px" }}>
                        {pctGeral}% da folha
                      </span>
                    </div>
                    <div style={{ fontSize: "18px", fontWeight: "900", color: "#fff", marginTop: "8px" }}>
                      R$ {formatarMoeda(tData.bonusTotal)}
                    </div>
                    <div style={{ fontSize: "11px", color: theme.subtext, marginTop: "4px", display: "flex", justifyContent: "space-between" }}>
                      <span>{tData.horas} horas cheias</span>
                      <span>{tData.count} beneficiados</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tabela Principal: Ordenada do Maior para o Menor Bônus */}
          <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: "18px", overflow: "hidden" }}>
            <div style={{ padding: "18px 20px", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#fff", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>💰</span> Relação Consolidada a Pagar — Ordenada do Maior para o Menor
                </h3>
                <span style={{ fontSize: "12px", color: theme.subtext, marginTop: "2px", display: "block" }}>
                  Soma consolidada dos 4 turnos. Cada mecânico listado uma única vez com o valor total a pagar e percentual por período.
                </span>
              </div>

              {/* Campo de Busca */}
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <input
                  type="text"
                  placeholder="Buscar mecânico..."
                  value={buscaMecanico}
                  onChange={(e) => setBuscaMecanico(e.target.value)}
                  style={{
                    background: theme.card2,
                    border: `1px solid ${theme.border}`,
                    color: theme.text,
                    padding: "8px 14px",
                    borderRadius: "10px",
                    fontSize: "13px",
                    outline: "none",
                    minWidth: "220px",
                  }}
                />
                <span style={{ fontSize: "12px", color: theme.subtext, whiteSpace: "nowrap" }}>
                  {mecanicosConsolidadosFiltrados.length} a receber
                </span>
              </div>
            </div>

            {/* Listagem em Tabela com Barras de Progresso e Percentuais */}
            <div style={{ overflowX: "auto", width: "100%" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px", minWidth: "900px" }}>
                <thead>
                  <tr style={{ background: theme.card2, borderBottom: `1px solid ${theme.border}`, color: theme.subtext, fontSize: "11px", textTransform: "uppercase" }}>
                    <th style={{ padding: "12px 10px", width: "45px", textAlign: "center", whiteSpace: "nowrap" }}>#</th>
                    <th style={{ padding: "12px 14px", minWidth: "200px", whiteSpace: "nowrap" }}>Mecânico</th>
                    <th style={{ padding: "12px 12px", textAlign: "center", width: "100px", whiteSpace: "nowrap" }}>Horas Cheias</th>
                    <th style={{ padding: "12px 14px", textAlign: "right", minWidth: "150px", color: "#10b981", whiteSpace: "nowrap" }}>💰 Total a Pagar</th>
                    <th style={{ padding: "12px 16px", minWidth: "380px" }}>Distribuição por Período (% e R$)</th>
                  </tr>
                </thead>
                <tbody>
                  {mecanicosConsolidadosFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center", padding: "36px", color: theme.subtext }}>
                        {carregandoPontos ? "Carregando dados dos turnos..." : "Nenhum mecânico encontrado no período."}
                      </td>
                    </tr>
                  ) : (
                    mecanicosConsolidadosFiltrados.map((m, idx) => {
                      const ehTop1 = idx === 0 && m.bonusTotal > 0;
                      const ehTop2 = idx === 1 && m.bonusTotal > 0;
                      const ehTop3 = idx === 2 && m.bonusTotal > 0;
                      const medalha = ehTop1 ? "🥇" : ehTop2 ? "🥈" : ehTop3 ? "🥉" : `${idx + 1}º`;
                      const semBonus = m.bonusTotal === 0;

                      return (
                        <tr
                          key={m.id}
                          style={{
                            borderBottom: `1px solid ${theme.border}26`,
                            background: ehTop1 ? "rgba(16, 185, 129, 0.08)" : ehTop2 ? "rgba(245, 158, 11, 0.05)" : ehTop3 ? "rgba(59, 130, 246, 0.04)" : "transparent",
                            opacity: semBonus ? 0.45 : 1,
                            transition: "background 0.2s ease",
                          }}
                        >
                          {/* Posição */}
                          <td style={{ padding: "14px 10px", textAlign: "center", fontWeight: "900", fontSize: ehTop1 || ehTop2 || ehTop3 ? "16px" : "13px" }}>
                            {medalha}
                          </td>

                          {/* Mecânico */}
                          <td style={{ padding: "14px 14px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                              {m.avatar ? (
                                <img
                                  src={m.avatar}
                                  alt={m.nome}
                                  style={{ width: "34px", height: "34px", borderRadius: "50%", objectFit: "cover", border: `1.5px solid ${ehTop1 ? "#10b981" : theme.border}` }}
                                />
                              ) : (
                                <div
                                  style={{
                                    width: "34px",
                                    height: "34px",
                                    borderRadius: "50%",
                                    background: theme.card2,
                                    border: `1.5px solid ${theme.border}`,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontWeight: "800",
                                    fontSize: "12px",
                                    color: theme.subtext,
                                  }}
                                >
                                  {m.nome.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div>
                                <div style={{ fontWeight: "800", color: "#fff", fontSize: "14px" }}>
                                  {m.nome}
                                </div>
                                <div style={{ fontSize: "11px", color: theme.subtext, display: "flex", gap: "6px" }}>
                                  <span>ID: {m.id}</span>
                                  {m.cargo && <span>• {m.cargo}</span>}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Horas Cheias Totais */}
                          <td style={{ padding: "14px 12px", textAlign: "center" }}>
                            <span style={{ fontWeight: "800", fontSize: "14px", color: "#fff" }}>
                              {m.horasTotal}h
                            </span>
                            <div style={{ fontSize: "10px", color: theme.subtext }}>
                              acumuladas
                            </div>
                          </td>

                          {/* Valor Total a Pagar */}
                          <td style={{ padding: "14px 14px", textAlign: "right" }}>
                            <div style={{ fontSize: "17px", fontWeight: "900", color: semBonus ? theme.subtext : "#10b981" }}>
                              R$ {formatarMoeda(m.bonusTotal)}
                            </div>
                            <div style={{ fontSize: "10px", color: theme.subtext }}>
                              {semBonus ? "Sem bônus na semana" : "Total líquido apurado"}
                            </div>
                          </td>

                          {/* Distribuição por Período */}
                          <td style={{ padding: "14px 16px" }}>
                            {semBonus ? (
                              <span style={{ fontSize: "12px", color: theme.subtext, fontStyle: "italic" }}>
                                Sem horas completadas nos turnos nesta semana
                              </span>
                            ) : (
                              <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                                {/* Barra de Progresso Segmentada Multi-Colorida */}
                                <div
                                  style={{
                                    height: "10px",
                                    width: "100%",
                                    background: "rgba(255,255,255,0.06)",
                                    borderRadius: "6px",
                                    display: "flex",
                                    overflow: "hidden",
                                  }}
                                  title={`Distribuição: Obrigatório: ${m.turnos.obrigatorio.pctDoTotal}%, Manhã: ${m.turnos.manha.pctDoTotal}%, Tarde: ${m.turnos.tarde.pctDoTotal}%, Madrugada: ${m.turnos.madrugada.pctDoTotal}%`}
                                >
                                  {m.turnos.obrigatorio.pctDoTotal > 0 && (
                                    <div
                                      style={{
                                        width: `${m.turnos.obrigatorio.pctDoTotal}%`,
                                        background: TURNOS_CONFIG.obrigatorio.cor,
                                        transition: "width 0.3s ease",
                                      }}
                                    />
                                  )}
                                  {m.turnos.manha.pctDoTotal > 0 && (
                                    <div
                                      style={{
                                        width: `${m.turnos.manha.pctDoTotal}%`,
                                        background: TURNOS_CONFIG.manha.cor,
                                        transition: "width 0.3s ease",
                                      }}
                                    />
                                  )}
                                  {m.turnos.tarde.pctDoTotal > 0 && (
                                    <div
                                      style={{
                                        width: `${m.turnos.tarde.pctDoTotal}%`,
                                        background: TURNOS_CONFIG.tarde.cor,
                                        transition: "width 0.3s ease",
                                      }}
                                    />
                                  )}
                                  {m.turnos.madrugada.pctDoTotal > 0 && (
                                    <div
                                      style={{
                                        width: `${m.turnos.madrugada.pctDoTotal}%`,
                                        background: TURNOS_CONFIG.madrugada.cor,
                                        transition: "width 0.3s ease",
                                      }}
                                    />
                                  )}
                                </div>

                                {/* Pílulas Indicadoras com % e R$ por Período */}
                                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                                  {Object.keys(TURNOS_CONFIG).map((tKey) => {
                                    const tCfg = TURNOS_CONFIG[tKey];
                                    const tInfo = m.turnos[tKey];
                                    const temValor = tInfo && tInfo.bonus > 0;

                                    if (!temValor) return null;

                                    return (
                                      <span
                                        key={tKey}
                                        style={{
                                          fontSize: "11px",
                                          padding: "3px 8px",
                                          borderRadius: "6px",
                                          background: tCfg.bgBadge,
                                          border: `1px solid ${tCfg.cor}55`,
                                          color: "#fff",
                                          display: "inline-flex",
                                          alignItems: "center",
                                          gap: "4px",
                                          fontWeight: "700",
                                        }}
                                        title={`${tCfg.nome}: R$ ${formatarMoeda(tInfo.bonus)} (${tInfo.horas}h cheias)`}
                                      >
                                        <span>{tCfg.emoji}</span>
                                        <span style={{ color: tCfg.cor }}>{tCfg.nomeCurto || tCfg.nome}:</span>
                                        <b style={{ color: "#fff" }}>{tInfo.pctDoTotal}%</b>
                                        <span style={{ opacity: 0.7, fontSize: "10px" }}>(R$ {formatarMoeda(tInfo.bonus)})</span>
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ABA 2: PROPOSTA GERAL & SIMULADOR DE TURNOS */}
      {/* ========================================================================= */}
      {abaAtiva === "proposta" && (
        <div>
          {/* Painel Superior de Configuração do Teto Geral */}
          <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: "20px", padding: "24px", marginBottom: "28px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px", marginBottom: "20px" }}>
              <div>
                <span style={{ fontSize: "11px", fontWeight: "800", color: "#ec4899", textTransform: "uppercase", letterSpacing: "1px" }}>
                  Painel de Simulação Financeira
                </span>
                <h2 style={{ fontSize: "20px", fontWeight: "900", margin: "4px 0 0 0" }}>
                  Parametrização do Orçamento Semanal
                </h2>
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  onClick={copiarTextoProposta}
                  style={{
                    background: "linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)",
                    border: "none",
                    padding: "10px 18px",
                    borderRadius: "12px",
                    color: "#fff",
                    fontWeight: "800",
                    cursor: "pointer",
                    fontSize: "13px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    boxShadow: "0 4px 14px rgba(236,72,153,0.3)",
                  }}
                >
                  <span>📋</span> Copiar Proposta Formatada
                </button>
              </div>
            </div>

            {/* Inputs de Controle Global */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
              <div style={{ background: theme.card2, borderRadius: "14px", padding: "14px 16px", border: `1px solid ${theme.border}` }}>
                <label style={{ fontSize: "11px", color: theme.subtext, fontWeight: "700", textTransform: "uppercase" }}>
                  💰 Montante Total da Semana
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "6px" }}>
                  <span style={{ fontSize: "16px", fontWeight: "900", color: theme.subtext }}>R$</span>
                  <input
                    type="text"
                    value={montanteProposta ? Number(montanteProposta).toLocaleString("pt-BR") : ""}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, "");
                      setMontanteProposta(raw ? parseInt(raw, 10) : 0);
                    }}
                    style={{
                      background: "transparent",
                      border: "none",
                      fontSize: "20px",
                      fontWeight: "900",
                      color: "#fff",
                      width: "100%",
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              <div style={{ background: theme.card2, borderRadius: "14px", padding: "14px 16px", border: `1px solid ${theme.border}` }}>
                <label style={{ fontSize: "11px", color: theme.subtext, fontWeight: "700", textTransform: "uppercase" }}>
                  ⏱️ Estimativa Horas Totais da Mecânica
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "6px" }}>
                  <input
                    type="number"
                    value={horasTotaisEstimadas}
                    onChange={(e) => setHorasTotaisEstimadas(Math.max(1, Number(e.target.value)))}
                    style={{
                      background: "transparent",
                      border: "none",
                      fontSize: "20px",
                      fontWeight: "900",
                      color: "#fff",
                      width: "100%",
                      outline: "none",
                    }}
                  />
                  <span style={{ fontSize: "14px", fontWeight: "800", color: theme.subtext }}>horas</span>
                </div>
              </div>

              <div style={{ background: theme.card2, borderRadius: "14px", padding: "14px 16px", border: `1px solid ${theme.border}` }}>
                <label style={{ fontSize: "11px", color: theme.subtext, fontWeight: "700", textTransform: "uppercase" }}>
                  👔 Quantidade de Gestores / Admins
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "6px" }}>
                  <input
                    type="number"
                    value={qtdAdmin}
                    onChange={(e) => setQtdAdmin(Math.max(1, Number(e.target.value)))}
                    style={{
                      background: "transparent",
                      border: "none",
                      fontSize: "20px",
                      fontWeight: "900",
                      color: "#fff",
                      width: "100%",
                      outline: "none",
                    }}
                  />
                  <span style={{ fontSize: "14px", fontWeight: "800", color: theme.subtext }}>pessoas</span>
                </div>
              </div>

              {/* Status da Soma dos % */}
              <div style={{
                background: somaPorcentagens === 100 ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                borderRadius: "14px",
                padding: "14px 16px",
                border: somaPorcentagens === 100 ? "1px solid rgba(34,197,94,0.3)" : "1px solid rgba(239,68,68,0.3)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
              }}>
                <span style={{ fontSize: "11px", color: somaPorcentagens === 100 ? "#4ade80" : "#f87171", fontWeight: "800", textTransform: "uppercase" }}>
                  {somaPorcentagens === 100 ? "✅ Distribuição Completa" : "⚠️ Atenção na Divisão"}
                </span>
                <div style={{ fontSize: "20px", fontWeight: "900", color: somaPorcentagens === 100 ? "#4ade80" : "#f87171", marginTop: "4px" }}>
                  {somaPorcentagens}% / 100%
                </div>
              </div>
            </div>
          </div>

          {/* Ajuste de Percentuais dos Pilares */}
          <h2 style={{ fontSize: "18px", fontWeight: "900", marginBottom: "16px" }}>
            ⚙️ Ajuste os Percentuais de Cada Categoria de Premiação:
          </h2>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(300px, 100%), 1fr))", gap: "20px", marginBottom: "40px" }}>
            
            {/* PILAR 1: Rateio de Horas Gerais */}
            <div style={{ background: theme.card, border: "1px solid #3b82f6", borderRadius: "18px", padding: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "20px" }}>⏳</span>
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#60a5fa" }}>Horas Gerais</h3>
                </div>
                <span style={{ background: "rgba(59,130,246,0.15)", color: "#60a5fa", padding: "4px 10px", borderRadius: "8px", fontWeight: "900", fontSize: "14px" }}>
                  {porcentagens.horas}%
                </span>
              </div>

              <div style={{ marginTop: "16px" }}>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={porcentagens.horas}
                  onChange={(e) => setPorcentagens({ ...porcentagens, horas: Number(e.target.value) })}
                  style={{ width: "100%", accentColor: "#3b82f6", cursor: "pointer" }}
                />
              </div>

              <div style={{ marginTop: "14px", background: theme.card2, borderRadius: "12px", padding: "14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: "11px", color: theme.subtext }}>Fatia Total:</div>
                  <div style={{ fontSize: "16px", fontWeight: "900", color: "#fff" }}>R$ {formatarMoeda(valoresCalculados.horas.total)}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "11px", color: theme.subtext }}>Valor / Hora:</div>
                  <div style={{ fontSize: "16px", fontWeight: "900", color: "#4ade80" }}>R$ {formatarMoeda(valoresCalculados.horas.valorPorHora)}</div>
                </div>
              </div>
              <p style={{ fontSize: "11px", color: theme.subtext, marginTop: "10px", lineHeight: "1.4" }}>
                Distribuído a todos proporcionalmente às horas cumpridas no ponto.
              </p>
            </div>

            {/* PILAR 2: Cargos Administrativos */}
            <div style={{ background: theme.card, border: "1px solid #10b981", borderRadius: "18px", padding: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "20px" }}>👔</span>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#34d399" }}>Cargos Administrativos</h3>
                    <span style={{ fontSize: "11px", color: theme.subtext }}>Gerência, Chefia & Supervisão</span>
                  </div>
                </div>
                <span style={{ background: "rgba(16,185,129,0.15)", color: "#34d399", padding: "4px 10px", borderRadius: "8px", fontWeight: "900", fontSize: "14px" }}>
                  {porcentagens.admin}%
                </span>
              </div>

              <div style={{ marginTop: "16px" }}>
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="1"
                  value={porcentagens.admin}
                  onChange={(e) => setPorcentagens({ ...porcentagens, admin: Number(e.target.value) })}
                  style={{ width: "100%", accentColor: "#10b981", cursor: "pointer" }}
                />
              </div>

              <div style={{ marginTop: "14px", background: theme.card2, borderRadius: "12px", padding: "14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: "11px", color: theme.subtext }}>Fatia Gestão:</div>
                  <div style={{ fontSize: "16px", fontWeight: "900", color: "#fff" }}>R$ {formatarMoeda(valoresCalculados.admin.total)}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "11px", color: theme.subtext }}>Por Gestor ({qtdAdmin}x):</div>
                  <div style={{ fontSize: "16px", fontWeight: "900", color: "#4ade80" }}>R$ {formatarMoeda(valoresCalculados.admin.valorPorPessoa)}</div>
                </div>
              </div>
              <p style={{ fontSize: "11px", color: theme.subtext, marginTop: "10px", lineHeight: "1.4" }}>
                Bonificação de liderança pela gestão da oficina, treinamentos e controle da equipe.
              </p>
            </div>

            {/* PILAR 3: Top 3 Manhã */}
            <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: "18px", padding: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "20px" }}>🌅</span>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800" }}>Top 3 Manhã</h3>
                    <span style={{ fontSize: "11px", color: theme.subtext }}>06:00 às 12:00</span>
                  </div>
                </div>
                <span style={{ background: theme.card2, color: "#f59e0b", padding: "4px 10px", borderRadius: "8px", fontWeight: "900", fontSize: "14px" }}>
                  {porcentagens.manha}%
                </span>
              </div>

              <div style={{ marginTop: "16px" }}>
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="1"
                  value={porcentagens.manha}
                  onChange={(e) => setPorcentagens({ ...porcentagens, manha: Number(e.target.value) })}
                  style={{ width: "100%", accentColor: "#f59e0b", cursor: "pointer" }}
                />
              </div>

              <div style={{ marginTop: "14px", display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", background: theme.card2, padding: "8px 12px", borderRadius: "8px" }}>
                  <span>🥇 1º Lugar (50%)</span>
                  <b style={{ color: "#4ade80" }}>R$ {formatarMoeda(valoresCalculados.manha.primeiro)}</b>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", background: theme.card2, padding: "8px 12px", borderRadius: "8px" }}>
                  <span>🥈 2º Lugar (30%)</span>
                  <b style={{ color: "#4ade80" }}>R$ {formatarMoeda(valoresCalculados.manha.segundo)}</b>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", background: theme.card2, padding: "8px 12px", borderRadius: "8px" }}>
                  <span>🥉 3º Lugar (20%)</span>
                  <b style={{ color: "#4ade80" }}>R$ {formatarMoeda(valoresCalculados.manha.terceiro)}</b>
                </div>
              </div>
            </div>

            {/* PILAR 4: Top 3 Tarde */}
            <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: "18px", padding: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "20px" }}>☀️</span>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800" }}>Top 3 Tarde</h3>
                    <span style={{ fontSize: "11px", color: theme.subtext }}>12:00 às 18:00</span>
                  </div>
                </div>
                <span style={{ background: theme.card2, color: "#eab308", padding: "4px 10px", borderRadius: "8px", fontWeight: "900", fontSize: "14px" }}>
                  {porcentagens.tarde}%
                </span>
              </div>

              <div style={{ marginTop: "16px" }}>
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="1"
                  value={porcentagens.tarde}
                  onChange={(e) => setPorcentagens({ ...porcentagens, tarde: Number(e.target.value) })}
                  style={{ width: "100%", accentColor: "#eab308", cursor: "pointer" }}
                />
              </div>

              <div style={{ marginTop: "14px", display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", background: theme.card2, padding: "8px 12px", borderRadius: "8px" }}>
                  <span>🥇 1º Lugar (50%)</span>
                  <b style={{ color: "#4ade80" }}>R$ {formatarMoeda(valoresCalculados.tarde.primeiro)}</b>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", background: theme.card2, padding: "8px 12px", borderRadius: "8px" }}>
                  <span>🥈 2º Lugar (30%)</span>
                  <b style={{ color: "#4ade80" }}>R$ {formatarMoeda(valoresCalculados.tarde.segundo)}</b>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", background: theme.card2, padding: "8px 12px", borderRadius: "8px" }}>
                  <span>🥉 3º Lugar (20%)</span>
                  <b style={{ color: "#4ade80" }}>R$ {formatarMoeda(valoresCalculados.tarde.terceiro)}</b>
                </div>
              </div>
            </div>

            {/* PILAR 5: Top 3 Noite */}
            <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: "18px", padding: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "20px" }}>🌙</span>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800" }}>Top 3 Noite</h3>
                    <span style={{ fontSize: "11px", color: theme.subtext }}>18:00 às 00:00</span>
                  </div>
                </div>
                <span style={{ background: theme.card2, color: "#a855f7", padding: "4px 10px", borderRadius: "8px", fontWeight: "900", fontSize: "14px" }}>
                  {porcentagens.noite}%
                </span>
              </div>

              <div style={{ marginTop: "16px" }}>
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="1"
                  value={porcentagens.noite}
                  onChange={(e) => setPorcentagens({ ...porcentagens, noite: Number(e.target.value) })}
                  style={{ width: "100%", accentColor: "#a855f7", cursor: "pointer" }}
                />
              </div>

              <div style={{ marginTop: "14px", display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", background: theme.card2, padding: "8px 12px", borderRadius: "8px" }}>
                  <span>🥇 1º Lugar (50%)</span>
                  <b style={{ color: "#4ade80" }}>R$ {formatarMoeda(valoresCalculados.noite.primeiro)}</b>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", background: theme.card2, padding: "8px 12px", borderRadius: "8px" }}>
                  <span>🥈 2º Lugar (30%)</span>
                  <b style={{ color: "#4ade80" }}>R$ {formatarMoeda(valoresCalculados.noite.segundo)}</b>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", background: theme.card2, padding: "8px 12px", borderRadius: "8px" }}>
                  <span>🥉 3º Lugar (20%)</span>
                  <b style={{ color: "#4ade80" }}>R$ {formatarMoeda(valoresCalculados.noite.terceiro)}</b>
                </div>
              </div>
            </div>

            {/* PILAR 6: Top 3 Madrugada */}
            <div style={{ background: theme.card, border: "1px solid #06b6d4", borderRadius: "18px", padding: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "20px" }}>🌌</span>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#22d3ee" }}>Top 3 Madrugada</h3>
                    <span style={{ fontSize: "11px", color: theme.subtext }}>00:00 às 06:00 (Turno Chave)</span>
                  </div>
                </div>
                <span style={{ background: "rgba(6,182,212,0.15)", color: "#22d3ee", padding: "4px 10px", borderRadius: "8px", fontWeight: "900", fontSize: "14px" }}>
                  {porcentagens.madrugada}%
                </span>
              </div>

              <div style={{ marginTop: "16px" }}>
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="1"
                  value={porcentagens.madrugada}
                  onChange={(e) => setPorcentagens({ ...porcentagens, madrugada: Number(e.target.value) })}
                  style={{ width: "100%", accentColor: "#06b6d4", cursor: "pointer" }}
                />
              </div>

              <div style={{ marginTop: "14px", display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", background: theme.card2, padding: "8px 12px", borderRadius: "8px" }}>
                  <span>🥇 1º Lugar (50%)</span>
                  <b style={{ color: "#4ade80" }}>R$ {formatarMoeda(valoresCalculados.madrugada.primeiro)}</b>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", background: theme.card2, padding: "8px 12px", borderRadius: "8px" }}>
                  <span>🥈 2º Lugar (30%)</span>
                  <b style={{ color: "#4ade80" }}>R$ {formatarMoeda(valoresCalculados.madrugada.segundo)}</b>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", background: theme.card2, padding: "8px 12px", borderRadius: "8px" }}>
                  <span>🥉 3º Lugar (20%)</span>
                  <b style={{ color: "#4ade80" }}>R$ {formatarMoeda(valoresCalculados.madrugada.terceiro)}</b>
                </div>
              </div>
            </div>

            {/* PILAR 7: Top 2 Horário Obrigatório */}
            <div style={{ background: theme.card, border: "1px solid #ec4899", borderRadius: "18px", padding: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "20px" }}>⭐</span>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#f472b6" }}>Top 2 Obrigatório</h3>
                    <span style={{ fontSize: "11px", color: theme.subtext }}>18:00 às 23:00 (Pico Staff)</span>
                  </div>
                </div>
                <span style={{ background: "rgba(236,72,153,0.15)", color: "#f472b6", padding: "4px 10px", borderRadius: "8px", fontWeight: "900", fontSize: "14px" }}>
                  {porcentagens.obrigatorio}%
                </span>
              </div>

              <div style={{ marginTop: "16px" }}>
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="1"
                  value={porcentagens.obrigatorio}
                  onChange={(e) => setPorcentagens({ ...porcentagens, obrigatorio: Number(e.target.value) })}
                  style={{ width: "100%", accentColor: "#ec4899", cursor: "pointer" }}
                />
              </div>

              <div style={{ marginTop: "14px", display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", background: theme.card2, padding: "8px 12px", borderRadius: "8px" }}>
                  <span>🥇 1º Lugar (60%)</span>
                  <b style={{ color: "#4ade80" }}>R$ {formatarMoeda(valoresCalculados.obrigatorio.primeiro)}</b>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", background: theme.card2, padding: "8px 12px", borderRadius: "8px" }}>
                  <span>🥈 2º Lugar (40%)</span>
                  <b style={{ color: "#4ade80" }}>R$ {formatarMoeda(valoresCalculados.obrigatorio.segundo)}</b>
                </div>
              </div>
            </div>
          </div>

          {/* Simulador Interativo Individual */}
          <div style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.1) 0%, rgba(236,72,153,0.1) 100%)", border: "1px solid rgba(139,92,246,0.3)", borderRadius: "20px", padding: "28px", marginBottom: "40px" }}>
            <div style={{ marginBottom: "20px" }}>
              <span style={{ fontSize: "12px", fontWeight: "800", color: "#c084fc", textTransform: "uppercase" }}>
                🎮 Simulador em Tempo Real
              </span>
              <h2 style={{ fontSize: "20px", fontWeight: "900", margin: "4px 0 0 0" }}>
                Quanto um Mecânico Ganharia nesta Configuração?
              </h2>
              <p style={{ fontSize: "13px", color: theme.subtext, marginTop: "4px" }}>
                Preencha o perfil abaixo para calcular os ganhos totais somando as horas e premiações conquistadas:
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(280px, 100%), 1fr))", gap: "20px" }}>
              {/* Inputs da Simulação */}
              <div style={{ background: theme.card, borderRadius: "16px", padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
                <div>
                  <label style={{ fontSize: "11px", color: theme.subtext, fontWeight: "700", textTransform: "uppercase" }}>
                    Horas Trabalhadas na Semana
                  </label>
                  <input
                    type="number"
                    value={simCalc.horasTrabalhadas}
                    onChange={(e) => setSimCalc({ ...simCalc, horasTrabalhadas: Number(e.target.value) })}
                    style={{
                      width: "100%",
                      background: theme.card2,
                      border: `1px solid ${theme.border}`,
                      borderRadius: "10px",
                      padding: "10px 14px",
                      fontSize: "15px",
                      fontWeight: "700",
                      color: "#fff",
                      marginTop: "6px",
                    }}
                  />
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "4px" }}>
                  <input
                    type="checkbox"
                    id="chkAdmin"
                    checked={simCalc.ehAdmin}
                    onChange={(e) => setSimCalc({ ...simCalc, ehAdmin: e.target.checked })}
                    style={{ width: "18px", height: "18px", cursor: "pointer" }}
                  />
                  <label htmlFor="chkAdmin" style={{ fontSize: "13px", fontWeight: "700", cursor: "pointer" }}>
                    👔 Exerce cargo administrativo (Gerência/Chefia)
                  </label>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "6px" }}>
                  <div>
                    <label style={{ fontSize: "10px", color: theme.subtext, fontWeight: "700", textTransform: "uppercase" }}>Pódio Madrugada</label>
                    <select
                      value={simCalc.podioMadrugada}
                      onChange={(e) => setSimCalc({ ...simCalc, podioMadrugada: Number(e.target.value) })}
                      style={{ width: "100%", background: theme.card2, border: `1px solid ${theme.border}`, color: "#fff", padding: "8px", borderRadius: "8px", marginTop: "4px" }}
                    >
                      <option value={0}>Sem Pódio</option>
                      <option value={1}>🥇 1º Lugar</option>
                      <option value={2}>🥈 2º Lugar</option>
                      <option value={3}>🥉 3º Lugar</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: "10px", color: theme.subtext, fontWeight: "700", textTransform: "uppercase" }}>Pódio Obrigatório</label>
                    <select
                      value={simCalc.podioObrigatorio}
                      onChange={(e) => setSimCalc({ ...simCalc, podioObrigatorio: Number(e.target.value) })}
                      style={{ width: "100%", background: theme.card2, border: `1px solid ${theme.border}`, color: "#fff", padding: "8px", borderRadius: "8px", marginTop: "4px" }}
                    >
                      <option value={0}>Sem Pódio</option>
                      <option value={1}>🥇 1º Lugar</option>
                      <option value={2}>🥈 2º Lugar</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", marginTop: "4px" }}>
                  <div>
                    <label style={{ fontSize: "9px", color: theme.subtext, fontWeight: "700", textTransform: "uppercase" }}>Manhã</label>
                    <select
                      value={simCalc.podioManha}
                      onChange={(e) => setSimCalc({ ...simCalc, podioManha: Number(e.target.value) })}
                      style={{ width: "100%", background: theme.card2, border: `1px solid ${theme.border}`, color: "#fff", padding: "6px", borderRadius: "8px", marginTop: "4px", fontSize: "11px" }}
                    >
                      <option value={0}>-</option>
                      <option value={1}>🥇 1º</option>
                      <option value={2}>🥈 2º</option>
                      <option value={3}>🥉 3º</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: "9px", color: theme.subtext, fontWeight: "700", textTransform: "uppercase" }}>Tarde</label>
                    <select
                      value={simCalc.podioTarde}
                      onChange={(e) => setSimCalc({ ...simCalc, podioTarde: Number(e.target.value) })}
                      style={{ width: "100%", background: theme.card2, border: `1px solid ${theme.border}`, color: "#fff", padding: "6px", borderRadius: "8px", marginTop: "4px", fontSize: "11px" }}
                    >
                      <option value={0}>-</option>
                      <option value={1}>🥇 1º</option>
                      <option value={2}>🥈 2º</option>
                      <option value={3}>🥉 3º</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: "9px", color: theme.subtext, fontWeight: "700", textTransform: "uppercase" }}>Noite</label>
                    <select
                      value={simCalc.podioNoite}
                      onChange={(e) => setSimCalc({ ...simCalc, podioNoite: Number(e.target.value) })}
                      style={{ width: "100%", background: theme.card2, border: `1px solid ${theme.border}`, color: "#fff", padding: "6px", borderRadius: "8px", marginTop: "4px", fontSize: "11px" }}
                    >
                      <option value={0}>-</option>
                      <option value={1}>🥇 1º</option>
                      <option value={2}>🥈 2º</option>
                      <option value={3}>🥉 3º</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Extrato do Bônus Calculado */}
              <div style={{ background: theme.card, borderRadius: "16px", padding: "24px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div>
                  <span style={{ fontSize: "12px", fontWeight: "800", color: "#c084fc", textTransform: "uppercase" }}>
                    🧾 Extrato do Mecânico Simulado
                  </span>

                  <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "10px", fontSize: "13px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", borderBottom: `1px solid ${theme.border}44`, paddingBottom: "6px" }}>
                      <span>⏳ Bônus por Horas ({simCalc.horasTrabalhadas}h × R$ {formatarMoeda(valoresCalculados.horas.valorPorHora)}):</span>
                      <b>R$ {formatarMoeda(resultadoSimulacaoIndividual.ganhoHoras)}</b>
                    </div>
                    {resultadoSimulacaoIndividual.ganhoAdmin > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between", borderBottom: `1px solid ${theme.border}44`, paddingBottom: "6px", color: "#34d399" }}>
                        <span>👔 Bônus Cargo Administrativo:</span>
                        <b>+ R$ {formatarMoeda(resultadoSimulacaoIndividual.ganhoAdmin)}</b>
                      </div>
                    )}
                    {resultadoSimulacaoIndividual.ganhoMadrugada > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between", borderBottom: `1px solid ${theme.border}44`, paddingBottom: "6px", color: "#22d3ee" }}>
                        <span>🌌 Pódio Madrugada:</span>
                        <b>+ R$ {formatarMoeda(resultadoSimulacaoIndividual.ganhoMadrugada)}</b>
                      </div>
                    )}
                    {resultadoSimulacaoIndividual.ganhoObrigatorio > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between", borderBottom: `1px solid ${theme.border}44`, paddingBottom: "6px", color: "#f472b6" }}>
                        <span>⭐ Pódio Horário Obrigatório:</span>
                        <b>+ R$ {formatarMoeda(resultadoSimulacaoIndividual.ganhoObrigatorio)}</b>
                      </div>
                    )}
                    {resultadoSimulacaoIndividual.ganhoManha > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between", borderBottom: `1px solid ${theme.border}44`, paddingBottom: "6px", color: "#f59e0b" }}>
                        <span>🌅 Pódio Manhã:</span>
                        <b>+ R$ {formatarMoeda(resultadoSimulacaoIndividual.ganhoManha)}</b>
                      </div>
                    )}
                    {resultadoSimulacaoIndividual.ganhoTarde > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between", borderBottom: `1px solid ${theme.border}44`, paddingBottom: "6px", color: "#eab308" }}>
                        <span>☀️ Pódio Tarde:</span>
                        <b>+ R$ {formatarMoeda(resultadoSimulacaoIndividual.ganhoTarde)}</b>
                      </div>
                    )}
                    {resultadoSimulacaoIndividual.ganhoNoite > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between", borderBottom: `1px solid ${theme.border}44`, paddingBottom: "6px", color: "#8b5cf6" }}>
                        <span>🌙 Pódio Noite:</span>
                        <b>+ R$ {formatarMoeda(resultadoSimulacaoIndividual.ganhoNoite)}</b>
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ marginTop: "20px", background: "linear-gradient(135deg, rgba(34,197,94,0.15) 0%, rgba(34,197,94,0.05) 100%)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: "14px", padding: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: "11px", fontWeight: "800", color: "#4ade80", textTransform: "uppercase" }}>💰 TOTAL A RECEBER DE BÔNUS:</div>
                    <div style={{ fontSize: "26px", fontWeight: "900", color: "#fff", marginTop: "2px" }}>
                      R$ {formatarMoeda(resultadoSimulacaoIndividual.total)}
                    </div>
                  </div>
                  <span style={{ fontSize: "32px" }}>💸</span>
                </div>
              </div>
            </div>
          </div>

          {/* Cenários Práticos de Demonstração */}
          <h2 style={{ fontSize: "18px", fontWeight: "900", marginBottom: "16px" }}>
            👥 Exemplos Práticos de Cenários para Mostrar à Equipe:
          </h2>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px", marginBottom: "40px" }}>
            
            {/* Cenário A: O Supervisor / Gerente */}
            <div style={{ background: theme.card, border: "1px solid #10b981", borderRadius: "16px", padding: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                <span style={{ fontSize: "24px" }}>👔</span>
                <div>
                  <h4 style={{ margin: 0, fontSize: "15px", fontWeight: "800", color: "#34d399" }}>O Gerente / Supervisor</h4>
                  <span style={{ fontSize: "11px", color: theme.subtext }}>20h de ponto + Bônus Admin</span>
                </div>
              </div>
              <p style={{ fontSize: "12px", color: theme.subtext, lineHeight: "1.4" }}>
                Trabalhou na oficina e exerceu a liderança administrativa e fiscalização da equipe.
              </p>
              <div style={{ background: theme.card2, borderRadius: "10px", padding: "12px", marginTop: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "12px" }}>Premiação Estimada:</span>
                <b style={{ color: "#4ade80", fontSize: "15px" }}>
                  R$ {formatarMoeda(20 * valoresCalculados.horas.valorPorHora + valoresCalculados.admin.valorPorPessoa)}
                </b>
              </div>
            </div>

            {/* Cenário B: O Mecânico da Madrugada */}
            <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: "16px", padding: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                <span style={{ fontSize: "24px" }}>🌌</span>
                <div>
                  <h4 style={{ margin: 0, fontSize: "15px", fontWeight: "800" }}>O Noturno / Madrugada</h4>
                  <span style={{ fontSize: "11px", color: "#22d3ee" }}>30h de ponto + 1º Madrugada</span>
                </div>
              </div>
              <p style={{ fontSize: "12px", color: theme.subtext, lineHeight: "1.4" }}>
                Focou no turno mais difícil e manteve a mecânica aberta na calada da noite.
              </p>
              <div style={{ background: theme.card2, borderRadius: "10px", padding: "12px", marginTop: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "12px" }}>Premiação Estimada:</span>
                <b style={{ color: "#4ade80", fontSize: "15px" }}>
                  R$ {formatarMoeda(30 * valoresCalculados.horas.valorPorHora + valoresCalculados.madrugada.primeiro)}
                </b>
              </div>
            </div>

            {/* Cenário C: O Mecânico de Horário Nobre */}
            <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: "16px", padding: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                <span style={{ fontSize: "24px" }}>⭐</span>
                <div>
                  <h4 style={{ margin: 0, fontSize: "15px", fontWeight: "800" }}>O Fiel do Horário Nobre</h4>
                  <span style={{ fontSize: "11px", color: "#f472b6" }}>25h de ponto + 1º Obrigatório</span>
                </div>
              </div>
              <p style={{ fontSize: "12px", color: theme.subtext, lineHeight: "1.4" }}>
                Garantiu presença em todos os dias das 18h às 23h, salvando a mecânica de multas da cidade.
              </p>
              <div style={{ background: theme.card2, borderRadius: "10px", padding: "12px", marginTop: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "12px" }}>Premiação Estimada:</span>
                <b style={{ color: "#4ade80", fontSize: "15px" }}>
                  R$ {formatarMoeda(25 * valoresCalculados.horas.valorPorHora + valoresCalculados.obrigatorio.primeiro)}
                </b>
              </div>
            </div>
          </div>

          {/* 4 Pilares de Argumentação para a Administração */}
          <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: "20px", padding: "28px" }}>
            <h3 style={{ margin: "0 0 16px 0", fontSize: "17px", fontWeight: "900" }}>
              💡 Por que esse modelo é a melhor proposta para a Administração da Cidade e para as Mecânicas?
            </h3>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
              <div style={{ background: theme.card2, padding: "16px", borderRadius: "14px" }}>
                <div style={{ fontSize: "20px", marginBottom: "6px" }}>👔</div>
                <b style={{ fontSize: "13px", color: "#fff", display: "block" }}>1. Valorização da Gestão</b>
                <p style={{ fontSize: "11px", color: theme.subtext, marginTop: "4px", lineHeight: "1.4" }}>
                  Reconhece o esforço dos gerentes, supervisores e chefes de oficina que organizam a rotina e treinam os novatos.
                </p>
              </div>

              <div style={{ background: theme.card2, padding: "16px", borderRadius: "14px" }}>
                <div style={{ fontSize: "20px", marginBottom: "6px" }}>🌌</div>
                <b style={{ fontSize: "13px", color: "#fff", display: "block" }}>2. Cidade Atendida 24 Horas</b>
                <p style={{ fontSize: "11px", color: theme.subtext, marginTop: "4px", lineHeight: "1.4" }}>
                  O maior desafio das cidades de RP é a madrugada vazia. Com bônus especial, os mecânicos disputarão para logar.
                </p>
              </div>

              <div style={{ background: theme.card2, padding: "16px", borderRadius: "14px" }}>
                <div style={{ fontSize: "20px", marginBottom: "6px" }}>⭐</div>
                <b style={{ fontSize: "13px", color: "#fff", display: "block" }}>3. Cumprimento do Horário Nobre</b>
                <p style={{ fontSize: "11px", color: theme.subtext, marginTop: "4px", lineHeight: "1.4" }}>
                  As 18h às 23h são cruciais. A bonificação focada nos 2 mais ativos assegura 100% de cobertura no pico.
                </p>
              </div>

              <div style={{ background: theme.card2, padding: "16px", borderRadius: "14px" }}>
                <div style={{ fontSize: "20px", marginBottom: "6px" }}>📊</div>
                <b style={{ fontSize: "13px", color: "#fff", display: "block" }}>4. Teto Orçamentário Seguro</b>
                <p style={{ fontSize: "11px", color: theme.subtext, marginTop: "4px", lineHeight: "1.4" }}>
                  O montante é travado na soma de 100%. Os donos e a prefeitura sabem exatamente quanto será gasto sem surpresas.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
