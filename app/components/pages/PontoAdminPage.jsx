import React, { useState, useRef, useEffect } from "react";
import ConciliacaoPage from "./ConciliacaoPage";
import { supabase } from "../../utils/supabaseClient";

// ===== PARSER =====
function parseLogCidade(texto) {
  const registros = [];
  const linhas = texto.split("\n");
  let i = 0;

  while (i < linhas.length) {
    const linha = linhas[i].trim();

    const matchId = linha.match(
      /^\[ID\]:\s*(\d+)\s+(.+?)\s*\(\s*(ENTROU EM SERVI[ÇC]O|SAIU DE SERVI[ÇC]O)\s*-[^)]+\)/i
    );

    if (matchId) {
      const idJogo = matchId[1];
      const nomePersonagem = matchId[2].trim();
      const acao = matchId[3].toUpperCase().includes("ENTROU") ? "entrada" : "saida";

      let dataISO = null;
      let uuid = null;

      for (let j = i + 1; j < Math.min(i + 8, linhas.length); j++) {
        const l = linhas[j].trim();
        if (!dataISO) {
          const mData = l.match(/^\[DATA\]:\s*(\d{2})\/(\d{2})\/(\d{4}),\s*(\d{2}:\d{2}:\d{2})/);
          if (mData) {
            const [, dd, mm, aaaa, hora] = mData;
            dataISO = `${aaaa}-${mm}-${dd}T${hora}-03:00`;
          }
        }
        if (!uuid) {
          const mUuid = l.match(/^\[UUID\]:\s*([a-f0-9-]{36})/i);
          if (mUuid) uuid = mUuid[1];
        }
        if (dataISO && uuid) break;
      }

      if (dataISO) {
        registros.push({ idJogo, nomePersonagem, acao, dataISO, uuid });
      }
    }
    i++;
  }

  return registros;
}

/**
 * Separa os eventos por funcionário (SEM pareamento automático).
 * Retorna: { [idJogo]: { nomePersonagem, entradas: [...], saidas: [...] } }
 */
function separarEventosPorFuncionario(registros) {
  const mapa = {};

  registros.forEach((r) => {
    if (!mapa[r.idJogo]) {
      mapa[r.idJogo] = { nomePersonagem: r.nomePersonagem, entradas: [], saidas: [] };
    }
    if (r.acao === "entrada") {
      mapa[r.idJogo].entradas.push({ dataISO: r.dataISO, uuid: r.uuid, mechanic_id: r.mechanic_id });
    } else {
      mapa[r.idJogo].saidas.push({ dataISO: r.dataISO, uuid: r.uuid, mechanic_id: r.mechanic_id });
    }
  });

  // Ordenar por data crescente e REMOVER DUPLICADOS NO MESMO MINUTO
  Object.values(mapa).forEach((f) => {
    const sortFn = (a, b) => new Date(a.dataISO) - new Date(b.dataISO);
    f.entradas.sort(sortFn);
    f.saidas.sort(sortFn);

    const filterDedup = (item, i, arr) => {
      if (i === 0) return true;
      const d1 = new Date(item.dataISO);
      const d2 = new Date(arr[i-1].dataISO);
      return (
        d1.getFullYear() !== d2.getFullYear() ||
        d1.getMonth() !== d2.getMonth() ||
        d1.getDate() !== d2.getDate() ||
        d1.getHours() !== d2.getHours() ||
        d1.getMinutes() !== d2.getMinutes()
      );
    };

    f.entradas = f.entradas.filter(filterDedup);
    f.saidas = f.saidas.filter(filterDedup);
  });

  return mapa;
}

// ===== HELPERS =====
function formatarHoraBR(isoStr) {
  if (!isoStr) return "—";
  return new Date(isoStr).toLocaleTimeString("pt-BR", {
    hour: "2-digit", minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

function formatarDataBR(isoStr) {
  if (!isoStr) return "—";
  return new Date(isoStr).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function calcularDuracaoISO(entrada, saida) {
  if (!entrada || !saida) return null;
  const diff = (new Date(saida) - new Date(entrada)) / 60000;
  if (diff < 0) return null;
  const minsRounded = Math.round(diff);
  const h = Math.floor(minsRounded / 60);
  const m = minsRounded % 60;
  return `${h}h ${m}min`;
}

function extrairData(isoStr) {
  if (!isoStr) return "";
  return new Date(isoStr).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

// ===== PARSER DISCORD LOG MESSAGES =====
function parseDiscordLogContent(content, logType) {
  if (!content) return null;
  const lines = content.split('\n');
  let idJogo = null;
  let nome = "";
  let item = "";
  let qtd = 0;
  let tipoLog = logType; // 'bau' ou 'bancada'
  let dataStr = "";
  let bauId = "";

  lines.forEach(line => {
    const l = line.trim();
    if (logType === 'bau') {
      const mId = l.match(/^\[ID\]:\s*(\d+)\s*(.*)/i);
      if (mId) {
        idJogo = mId[1];
        nome = mId[2].trim();
      }
      const mBau = l.match(/^\[ID BA[ÚU]\]:\s*(.+)/i);
      if (mBau) {
        bauId = mBau[1].trim();
      }
      const mRetirou = l.match(/^\[RETIROU\]:\s*(\d+)x\s*(.+)/i);
      if (mRetirou) {
        qtd = parseInt(mRetirou[1]);
        item = mRetirou[2].trim();
      }
    } else if (logType === 'bancada') {
      const mId = l.match(/^\[ID\]:\s*(\d+)/i);
      if (mId) {
        idJogo = mId[1];
      }
      const mNome = l.match(/^\[NOME COMPLETO\]:\s*(.+)/i);
      if (mNome) {
        nome = mNome[1].trim();
      }
      const mItem = l.match(/^\[ITEMNAME\]:\s*(.+)/i);
      if (mItem) {
        item = mItem[1].trim();
      }
      const mQtd = l.match(/^\[QUANTIDADE\]:\s*(\d+)/i);
      if (mQtd) {
        qtd = parseInt(mQtd[1]);
      }
    }

    const mData = l.match(/^\[DATA\]:\s*(\d{2})\/(\d{2})\/(\d{4}),\s*(\d{2}:\d{2}:\d{2})/);
    if (mData) {
      const [, dd, mm, aaaa, hora] = mData;
      dataStr = `${aaaa}-${mm}-${dd}T${hora}-03:00`;
    }
  });

  if (!idJogo) return null;

  return {
    idJogo,
    nome,
    item,
    qtd,
    tipoLog,
    dataStr,
    bauId
  };
}

// ===== COMPONENTE =====
export default function PontoAdminPage({
  styles,
  theme,
  usuarioLogado,
  listaFuncionarios,
  importarSessoesParaBanco,
  registrosCidade = [],
  registrosSite = [],
  registrosCidadeCarregando = false,
  buscarPontoCidade,
  formatarDataHora,
  calcularDuracao,
  atualizarPontoCidade,
  deletarPontoCidade,
  registrosOcultos = [],
  registrosOcultosCarregando = false,
  buscarPontoCidadeOcultos,
  darEstrelaPonto,
  apagarPonto,
  clonarPontoCidadeParaSite,
  filtroNomeInicial,
  setFiltroNomeInicial,
  filtroStatusInicial,
  setFiltroStatusInicial,
  filtroDataIniInicial,
  setFiltroDataIniInicial,
  filtroDataFimInicial,
  setFiltroDataFimInicial,
  buscarHistoricoPonto,
}) {
  const [textoLog, setTextoLog] = useState("");
  // { [idJogo]: { nomePersonagem, entradas, saidas } }
  const [eventos, setEventos] = useState(null);
  // { [idJogo]: { [entradaIdx]: { modo: 'existente'|'manual'|'aberto', saidaIdx: null|number, saidaData: '', saidaHora: '', ignorar: false } } }
  const [config, setConfig] = useState({});
  const formatarDataISO = (date) => date.toLocaleDateString("en-CA");
  const hoje = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const segunda = new Date(hoje);
  segunda.setDate(hoje.getDate() - (hoje.getDay() === 0 ? 6 : hoje.getDay() - 1));
  const domingo = new Date(segunda);
  domingo.setDate(segunda.getDate() + 6);

  const [dataInicio, setDataInicio] = useState(filtroDataIniInicial || formatarDataISO(segunda));
  const [dataFim, setDataFim] = useState(filtroDataFimInicial || formatarDataISO(domingo));

  const [importando, setImportando] = useState(false);
  const [processandoLog, setProcessandoLog] = useState(false);
  const [resultadoImportacao, setResultadoImportacao] = useState(null);
  const histRef = useRef(null);
  
  const [modoImportacao, setModoImportacao] = useState("texto"); // 'texto' | 'banco'
  const [pointSessionsInicio, setPointSessionsInicio] = useState("");
  const [pointSessionsFim, setPointSessionsFim] = useState("");
  
  const [registrosExtraDoBanco, setRegistrosExtraDoBanco] = useState([]);
  const todosRegistrosBanco = [...registrosCidade, ...registrosExtraDoBanco];

  // ===== ESTADOS: AUDITORIA DE BAÚ =====
  const [auditoriaCarregando, setAuditoriaCarregando] = useState(false);
  const [auditoriaAlertas, setAuditoriaAlertas] = useState([]);
  const [tempoLimiteAuditoria, setTempoLimiteAuditoria] = useState(15);
  const [filtroMecanicaAuditoria, setFiltroMecanicaAuditoria] = useState("todas");
  const [ocultarReleveisAuditoria, setOcultarReleveisAuditoria] = useState(false);


  // ===== ESTADOS DE FILTRO DO HISTÓRICO =====
  const [filtroNome,       setFiltroNome]       = useState(filtroNomeInicial || "");
  const [filtroPeriodo,    setFiltroPeriodo]    = useState("semana");  // 'hoje'|'semana'|'mes'|'custom'
  const [filtroDataInicio, setFiltroDataInicio] = useState("");
  const [filtroDataFim,    setFiltroDataFim]    = useState("");
  const [modalRelatorioExternoAberta, setModalRelatorioExternoAberta] = useState(false);
  const [semanaOffset,     setSemanaOffset]     = useState(() => {
    const agora = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    return agora.getDay() === 0 ? 0 : -1;
  });

  // Helper: formata data BR legível
  const fmtBR = (isoDate) =>
    isoDate ? new Date(isoDate + "T12:00:00").toLocaleDateString("pt-BR") : "";

  // Helper: calcula datas de início e fim conforme preset
  const calcularDatasPeriodo = (periodo, offset = 0) => {
    const agora = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    if (periodo === "hoje") {
      const hoje = agora.toLocaleDateString("en-CA");
      return { inicio: hoje, fim: hoje };
    }
    if (periodo === "semana") {
      const diaSemana = agora.getDay();
      const diasDesdeSegunda = diaSemana === 0 ? 6 : diaSemana - 1;
      const segunda = new Date(agora);
      segunda.setDate(agora.getDate() - diasDesdeSegunda + offset * 7);
      const domingo = new Date(segunda);
      domingo.setDate(segunda.getDate() + 6);
      return { inicio: segunda.toLocaleDateString("en-CA"), fim: domingo.toLocaleDateString("en-CA") };
    }
    if (periodo === "mes") {
      const primeiro = new Date(agora.getFullYear(), agora.getMonth(), 1);
      const ultimo   = new Date(agora.getFullYear(), agora.getMonth() + 1, 0);
      return { inicio: primeiro.toLocaleDateString("en-CA"), fim: ultimo.toLocaleDateString("en-CA") };
    }
    return { inicio: filtroDataInicio, fim: filtroDataFim };
  };

  // Sincronizar filtros com o estado global para que a clonagem não resete a visão
  useEffect(() => {
    const { inicio, fim } = calcularDatasPeriodo(filtroPeriodo, semanaOffset);
    if (setFiltroDataIniInicial) setFiltroDataIniInicial(inicio);
    if (setFiltroDataFimInicial) setFiltroDataFimInicial(fim);
  }, [filtroPeriodo, semanaOffset, filtroDataInicio, filtroDataFim]);

  useEffect(() => {
    if (setFiltroNomeInicial) setFiltroNomeInicial(filtroNome);
  }, [filtroNome]);

  const aplicarFiltros = (overrideNome, overridePeriodo, overrideOffset) => {
    const nome    = overrideNome    !== undefined ? overrideNome    : filtroNome;
    const periodo = overridePeriodo !== undefined ? overridePeriodo : filtroPeriodo;
    const offset  = overrideOffset  !== undefined ? overrideOffset  : semanaOffset;
    const { inicio, fim } = calcularDatasPeriodo(periodo, offset);
    buscarPontoCidade({ nome, dataInicio: inicio, dataFim: fim });
  };

  useEffect(() => {
    aplicarFiltros();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const executarAuditoria = async () => {
    setAuditoriaCarregando(true);
    try {
      const { inicio, fim } = calcularDatasPeriodo(filtroPeriodo, semanaOffset);
      if (!inicio || !fim) {
        alert("Selecione um período válido.");
        return;
      }
      
      const inicioISO = new Date(`${inicio}T00:00:00-03:00`).toISOString();
      const fimISO = new Date(`${fim}T23:59:59-03:00`).toISOString();

      // 1. Buscar registros de ponto das três mecânicas para o período
      const [resReds, resHarmony, resDudark] = await Promise.all([
        supabase.from("ponto_cidade").select("*").gte("entrada", inicioISO).lte("entrada", fimISO).eq("oculto", false),
        supabase.from("ponto_cidade_mecanica_2").select("*").gte("entrada", inicioISO).lte("entrada", fimISO).eq("oculto", false),
        supabase.from("ponto_cidade_mecanica_3").select("*").gte("entrada", inicioISO).lte("entrada", fimISO).eq("oculto", false)
      ]);

      let todosPontos = [];
      if (resReds.data) {
        todosPontos = [...todosPontos, ...resReds.data.map(p => ({ ...p, mec: "Reds", mechanic_id: "reds" }))];
      }
      if (resHarmony.data) {
        todosPontos = [...todosPontos, ...resHarmony.data.map(p => ({ ...p, mec: "Harmony", mechanic_id: "harmony" }))];
      }
      if (resDudark.data) {
        todosPontos = [...todosPontos, ...resDudark.data.map(p => ({ ...p, mec: "Dudark", mechanic_id: "dudark" }))];
      }

      // Filtrar pontos curtos (< tempoLimiteAuditoria OU sem saída / pontos abertos)
      const pontosCurtos = todosPontos.filter(p => {
        if (!p.entrada) return false;
        
        let satisfiesTime = false;
        if (p.saida) {
          const diffMin = (new Date(p.saida) - new Date(p.entrada)) / 60000;
          satisfiesTime = diffMin > 0 && diffMin < tempoLimiteAuditoria;
        } else {
          // Ponto aberto é considerado elegível para auditoria
          satisfiesTime = true;
        }
        
        const satisfiesMec = filtroMecanicaAuditoria === "todas" || p.mechanic_id === filtroMecanicaAuditoria;
        return satisfiesTime && satisfiesMec;
      });

      if (pontosCurtos.length === 0) {
        setAuditoriaAlertas([]);
        setAuditoriaCarregando(false);
        return;
      }

      // 2. Buscar logs de discord_log_messages correspondentes ao mesmo período
      const bufferInicioMs = new Date(inicioISO).getTime() - 5 * 60 * 1000;
      const bufferFimMs = new Date(fimISO).getTime() + 5 * 60 * 1000;

      const distinctIds = Array.from(new Set(pontosCurtos.map(p => String(p.id_jogo))));

      // Para contornar limites de PostgREST da API (geralmente limitado a 1000 registros no servidor),
      // dividimos a busca do período em pedaços de no máximo 7 dias.
      const seteDiasMs = 7 * 24 * 60 * 60 * 1000;
      const intervalos = [];
      let atualMs = bufferInicioMs;

      while (atualMs < bufferFimMs) {
        const proximoMs = Math.min(atualMs + seteDiasMs, bufferFimMs);
        intervalos.push({
          inicio: new Date(atualMs).toISOString(),
          fim: new Date(proximoMs).toISOString()
        });
        atualMs = proximoMs;
      }

      // Executar buscas em paralelo para cada intervalo de tempo
      const queries = intervalos.map(inter => {
        let q = supabase
          .from("discord_log_messages")
          .select("content, log_type, created_at, mechanic_id")
          .in("log_type", ["bau", "bancada"])
          .gte("created_at", inter.inicio)
          .lte("created_at", inter.fim)
          .limit(10000);

        if (distinctIds.length > 0 && distinctIds.length < 80) {
          const orFilter = distinctIds.map(id => `content.ilike.%[ID]: ${id}%`).join(',');
          q = q.or(orFilter);
        }
        return q;
      });

      const resultadosQuery = await Promise.all(queries);
      
      let logsDiscord = [];
      resultadosQuery.forEach(res => {
        if (res.data) {
          logsDiscord = [...logsDiscord, ...res.data];
        }
        if (res.error) {
          throw res.error;
        }
      });

      // 3. Parsear cada log
      const logsProcessados = [];
      logsDiscord.forEach(log => {
        const parsed = parseDiscordLogContent(log.content, log.log_type);
        if (parsed) {
          const ts = parsed.dataStr ? new Date(parsed.dataStr).getTime() : new Date(log.created_at).getTime();
          logsProcessados.push({
            ...parsed,
            timestamp: ts,
            mecanicaLog: log.mechanic_id
          });
        }
      });

      // 4. Cruzar os dados: para cada ponto curto, verificar se o funcionário realizou retiradas durante aquela sessão
      const alertas = [];
      pontosCurtos.forEach(p => {
        const entradaMs = new Date(p.entrada).getTime();
        // Se for ponto aberto, buscamos retiradas ocorridas até a duração limite estipulada
        const saidaMs = p.saida ? new Date(p.saida).getTime() : (entradaMs + tempoLimiteAuditoria * 60000);
        const idJogoStr = String(p.id_jogo);

        const logsCorrespondentes = logsProcessados.filter(log => {
          return String(log.idJogo) === idJogoStr &&
                 log.timestamp >= (entradaMs - 60000) &&
                 log.timestamp <= (saidaMs + 60000);
        });

        if (logsCorrespondentes.length > 0) {
          const sessoesProximas = todosPontos.filter(outro => {
            if (outro.id === p.id) return false;
            if (String(outro.id_jogo) !== idJogoStr) return false;
            if (!outro.entrada || !outro.saida) return false;
            
            const diffMs = Math.abs(new Date(outro.entrada).getTime() - entradaMs);
            const dentroDe24Horas = diffMs <= 24 * 60 * 60 * 1000;
            
            const duracaoOutro = (new Date(outro.saida) - new Date(outro.entrada)) / 60000;
            const ehSessaoLonga = duracaoOutro >= 30;
            
            return dentroDe24Horas && ehSessaoLonga;
          }).map(outro => {
            const diffMs = Math.abs(new Date(outro.entrada).getTime() - entradaMs);
            const dur = (new Date(outro.saida) - new Date(outro.entrada)) / 60000;
            const h = Math.floor(dur / 60);
            const m = Math.round(dur % 60);
            return {
              entrada: outro.entrada,
              saida: outro.saida,
              duracaoStr: `${h}h ${m}min`,
              mec: outro.mec,
              diffMs
            };
          });

          // Ordenar pelo mais próximo e pegar apenas o primeiro (mais próximo temporalmente)
          sessoesProximas.sort((a, b) => a.diffMs - b.diffMs);
          const sessaoMaisProxima = sessoesProximas.slice(0, 1);

          alertas.push({
            ponto: p,
            logs: logsCorrespondentes,
            duracaoMin: p.saida ? Math.round((saidaMs - entradaMs) / 60000) : null,
            sessoesProximas: sessaoMaisProxima
          });
        }
      });

      alertas.sort((a, b) => new Date(b.ponto.entrada) - new Date(a.ponto.entrada));
      setAuditoriaAlertas(alertas);

    } catch (err) {
      console.error(err);
      alert("Erro ao executar auditoria: " + err.message);
    } finally {
      setAuditoriaCarregando(false);
    }
  };

  // ===== ESTADOS: ABA ATIVA =====
  const [abaAtiva, setAbaAtiva] = useState("registros"); // 'registros' | 'log-bruto' | 'cobertura'

  useEffect(() => {
    if (abaAtiva === "auditoria") {
      executarAuditoria();
    }
  }, [abaAtiva, filtroPeriodo, semanaOffset, tempoLimiteAuditoria, filtroMecanicaAuditoria, filtroDataInicio, filtroDataFim]);

  const [ocultarManuaisPontoAdmin, setOcultarManuaisPontoAdmin] = useState(false);
  const [excluirDonos, setExcluirDonos] = useState(false);
  const [ocultarDonos, setOcultarDonos] = useState(false);

  const filtrarManuaisLocal = (regs) => {
    if (!ocultarManuaisPontoAdmin) return regs;
    return regs.filter(r => r.uuid_entrada && r.uuid_saida);
  };

  // ===== ESTADOS: BONIFICAÇÃO SEMANAL =====
  const [configBonificacao, setConfigBonificacao] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("config_bonificacao");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error(e);
        }
      }
    }
    return {
      manha: { premio: 500000, horasMinimas: 10 },
      tarde: { premio: 500000, horasMinimas: 10 },
      noite: { premio: 500000, horasMinimas: 10 },
      madrugada: { premio: 500000, horasMinimas: 10 },
    };
  });

  const [configBonificacaoAberta, setConfigBonificacaoAberta] = useState(false);

  const salvarConfigBonificacao = (novaConfig) => {
    setConfigBonificacao(novaConfig);
    if (typeof window !== "undefined") {
      localStorage.setItem("config_bonificacao", JSON.stringify(novaConfig));
    }
  };

  const formatarMinutos = (mins) => {
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    return `${h}h ${m}min`;
  };

  const formatarDinheiro = (val) => {
    return `$${Number(val).toLocaleString("pt-BR")}`;
  };

  const calcularAcumuladoBonificacao = React.useMemo(() => {
    const players = {};
    const { inicio, fim } = calcularDatasPeriodo(filtroPeriodo, semanaOffset);
    if (!inicio || !fim) return { list: [], rankings: { manha: [], tarde: [], noite: [], madrugada: [] }, winners: { manha: [], tarde: [], noite: [], madrugada: [] } };

    const inicioMs = new Date(`${inicio}T00:00:00-03:00`).getTime();
    const fimMs = new Date(`${fim}T23:59:59-03:00`).getTime();

    const todosRegistrosFiltrados = filtrarManuaisLocal(todosRegistrosBanco);
    todosRegistrosFiltrados.forEach(reg => {
      if (reg.oculto) return;
      if (!reg.entrada || !reg.saida) return;

      const entryTime = new Date(reg.entrada).getTime();
      const exitTime = new Date(reg.saida).getTime();
      if (entryTime > fimMs || exitTime < inicioMs) return;

      const idJogo = reg.id_jogo;
      const nomePersonagem = reg.nome_personagem || reg.nome || `ID: ${idJogo}`;
      if (!idJogo) return;

      if (!players[idJogo]) {
        players[idJogo] = {
          idJogo,
          nome: nomePersonagem,
          manha: 0,
          tarde: 0,
          noite: 0,
          madrugada: 0
        };
      }

      const startMs = Math.max(entryTime, inicioMs);
      const endMs = Math.min(exitTime, fimMs);
      const oneMinuteMs = 60000;
      const offsetMs = 3 * 60 * 60 * 1000; // UTC-3 timezone offset

      for (let t = startMs; t < endMs; t += oneMinuteMs) {
        const d = new Date(t - offsetMs);
        const hour = d.getUTCHours();
        
        if (hour >= 6 && hour < 12) {
          players[idJogo].manha++;
        } else if (hour >= 12 && hour < 18) {
          players[idJogo].tarde++;
        } else if (hour >= 18 && hour < 24) {
          players[idJogo].noite++;
        } else {
          players[idJogo].madrugada++;
        }
      }
    });

    const list = Object.values(players).filter(p => {
      const func = listaFuncionarios.find(f => String(f.id) === String(p.idJogo));
      if (!func || func.status !== "ativo") return false;
      if (ocultarDonos) {
        const roleParts = func.role ? func.role.split('|') : [];
        const colabIsDono = roleParts[0] === 'dono' || roleParts.includes('dono_secundario');
        if (colabIsDono) return false;
      }
      return true;
    });

    const minManha = configBonificacao.manha.horasMinimas * 60;
    const minTarde = configBonificacao.tarde.horasMinimas * 60;
    const minNoite = configBonificacao.noite.horasMinimas * 60;
    const minMadrugada = configBonificacao.madrugada.horasMinimas * 60;

    const isDono = (idJogo) => {
      const func = listaFuncionarios.find(f => String(f.id) === String(idJogo));
      if (!func || !func.role) return false;
      const roleParts = func.role.split('|');
      return roleParts[0] === 'dono' || roleParts.includes('dono_secundario');
    };

    const candidatosManha = list.filter(p => p.manha >= minManha && !(excluirDonos && isDono(p.idJogo)));
    const candidatosTarde = list.filter(p => p.tarde >= minTarde && !(excluirDonos && isDono(p.idJogo)));
    const candidatosNoite = list.filter(p => p.noite >= minNoite && !(excluirDonos && isDono(p.idJogo)));
    const candidatosMadrugada = list.filter(p => p.madrugada >= minMadrugada && !(excluirDonos && isDono(p.idJogo)));

    const sortFn = (field) => (a, b) => b[field] - a[field];

    const sortedManha = [...candidatosManha].sort(sortFn("manha"));
    const sortedTarde = [...candidatosTarde].sort(sortFn("tarde"));
    const sortedNoite = [...candidatosNoite].sort(sortFn("noite"));
    const sortedMadrugada = [...candidatosMadrugada].sort(sortFn("madrugada"));

    const getWinners = (sortedArr, field) => {
      if (sortedArr.length === 0) return [];
      const maxVal = sortedArr[0][field];
      return sortedArr.filter(p => p[field] === maxVal);
    };

    const winnersManha = getWinners(sortedManha, "manha");
    const winnersTarde = getWinners(sortedTarde, "tarde");
    const winnersNoite = getWinners(sortedNoite, "noite");
    const winnersMadrugada = getWinners(sortedMadrugada, "madrugada");

    return {
      list,
      rankings: {
        manha: list.slice().sort(sortFn("manha")),
        tarde: list.slice().sort(sortFn("tarde")),
        noite: list.slice().sort(sortFn("noite")),
        madrugada: list.slice().sort(sortFn("madrugada"))
      },
      winners: {
        manha: winnersManha,
        tarde: winnersTarde,
        noite: winnersNoite,
        madrugada: winnersMadrugada
      }
    };
  }, [todosRegistrosBanco, configBonificacao, listaFuncionarios, filtroPeriodo, semanaOffset, filtroDataInicio, filtroDataFim, ocultarManuaisPontoAdmin, excluirDonos, ocultarDonos]);

  const diasPeriodoBonificacao = React.useMemo(() => {
    const { inicio, fim } = calcularDatasPeriodo(filtroPeriodo, semanaOffset);
    if (!inicio || !fim) return [];
    const dias = [];
    const dataInicioObj = new Date(`${inicio}T12:00:00`);
    const dataFimObj = new Date(`${fim}T12:00:00`);
    let atual = new Date(dataInicioObj);
    while (atual <= dataFimObj) {
      dias.push(atual.toLocaleDateString("en-CA"));
      atual.setDate(atual.getDate() + 1);
    }
    return dias;
  }, [filtroPeriodo, semanaOffset, filtroDataInicio, filtroDataFim]);

  const slotsCoberturaBonificacao = React.useMemo(() => {
    const mapa = {};
    diasPeriodoBonificacao.forEach(dia => {
      const slots = [];
      for (let h = 0; h < 24; h++) {
        const hStr = String(h).padStart(2, "0");
        const nextHStr = String(h + 1).padStart(2, "0");
        
        slots.push({
          label: `${hStr}:00 - ${hStr}:30`,
          start: new Date(`${dia}T${hStr}:00:00`),
          end: new Date(`${dia}T${hStr}:30:00`),
          hora: h
        });
        
        let endVal;
        if (h === 23) {
          const base = new Date(`${dia}T00:00:00`).getTime();
          const proximoDia = new Date(base + 24 * 60 * 60 * 1000);
          const proximoDiaStr = proximoDia.toLocaleDateString("en-CA");
          endVal = new Date(`${proximoDiaStr}T00:00:00`);
        } else {
          endVal = new Date(`${dia}T${nextHStr}:00:00`);
        }
        
        slots.push({
          label: `${hStr}:30 - ${nextHStr === "24" ? "00" : nextHStr}:00`,
          start: new Date(`${dia}T${hStr}:30:00`),
          end: endVal,
          hora: h
        });
      }

      mapa[dia] = slots.map(slot => {
        const funcionariosTrabalhando = [];
        
        // O relatório externo e a grade de cobertura sempre desconsideram pontos manuais (ou seja, apenas registros com entrada e saída automáticas, contendo UUID de entrada e saída)
        const todosRegistrosFiltrados = todosRegistrosBanco.filter(r => r.uuid_entrada && r.uuid_saida);
        todosRegistrosFiltrados.forEach(reg => {
          if (reg.oculto) return;
          if (!reg.entrada) return;
          
          const func = listaFuncionarios.find(f => String(f.id) === String(reg.id_jogo));
          if (!func || func.status !== "ativo") return;

          const entradaDate = new Date(reg.entrada);
          const saidaDate = reg.saida ? new Date(reg.saida) : new Date();
          
          if (entradaDate < slot.end && saidaDate > slot.start) {
            const funcNome = func.nome || reg.nome_personagem || reg.nome;
            if (!funcionariosTrabalhando.some(f => f.nome === funcNome)) {
              funcionariosTrabalhando.push({
                nome: funcNome,
                idJogo: reg.id_jogo
              });
            }
          }
        });
        
        return {
          ...slot,
          coberto: funcionariosTrabalhando.length > 0,
          funcionarios: funcionariosTrabalhando
        };
      });
    });
    return mapa;
  }, [diasPeriodoBonificacao, todosRegistrosBanco, listaFuncionarios, ocultarManuaisPontoAdmin]);

  const [coberturaVista, setCoberturaVista] = useState("heatmap"); // 'heatmap' | 'calendario'
  const [heatmapSemana, setHeatmapSemana] = useState(() => {
    const agora = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const diaSemana = agora.getDay(); // 0 (Dom) a 6 (Sáb)
    // Se hoje é Domingo(0), a semana atual é a última completa. 
    // Caso contrário, a última completa foi a anterior.
    const diasParaSubtrair = diaSemana === 0 ? 6 : diaSemana + 6;
    const segunda = new Date(agora);
    segunda.setDate(agora.getDate() - diasParaSubtrair);
    return segunda.toLocaleDateString("en-CA");
  }); // 'todas' | ISO date da segunda-feira
  const [heatmapMetrica, setHeatmapMetrica] = useState("tempo"); // 'tempo' | 'equipe'

  // ===== ESTADOS: LOG BRUTO =====
  const [logBrutoFiltroId,     setLogBrutoFiltroId]     = useState("");
  const [logBrutoFiltroInicio, setLogBrutoFiltroInicio] = useState("");
  const [logBrutoFiltroFim,    setLogBrutoFiltroFim]    = useState("");
  const [logBrutoFiltroTipo,   setLogBrutoFiltroTipo]   = useState("todos");   // 'todos'|'entrada'|'saida'
  const [logBrutoFiltroVinculo,setLogBrutoFiltroVinculo]= useState("todos");   // 'todos'|'vinculado'|'solto'
  
  // ===== ESTADOS: REGISTROS PAREADOS =====
  const [filtroStatus, setFiltroStatus] = useState("todos"); // 'todos' | 'completo' | 'manual' | 'aberto'
  const [ordemEntrada, setOrdemEntrada] = useState("desc"); // 'desc' = mais recente primeiro | 'asc' = mais antigo primeiro

  // ===== ESTADOS: EDIÇÃO E OCULTAMENTO =====
  const [editandoId,             setEditandoId]             = useState(null);
  const [editValues,             setEditValues]             = useState({});
  const [ocultandoId,            setOcultandoId]            = useState(null);
  const [justificativaOcult,     setJustificativaOcult]     = useState("");
  const [mostrarOcultos,         setMostrarOcultos]         = useState(false);
  const [salvandoId,             setSalvandoId]             = useState(null);

  // Sincronizar filtros iniciais vindos de fora (ex: Relatório)
  React.useEffect(() => {
    let mudou = false;
    let novoNome = filtroNome;
    let novoStatus = filtroStatus;
    let novaDataIni = filtroDataInicio;
    let novaDataFim = filtroDataFim;
    let novoPeriodo = filtroPeriodo;

    if (filtroNomeInicial !== undefined && filtroNomeInicial !== "") {
      novoNome = filtroNomeInicial;
      setFiltroNome(filtroNomeInicial);
      if (setFiltroNomeInicial) setFiltroNomeInicial("");
      mudou = true;
    }
    if (filtroStatusInicial !== undefined && filtroStatusInicial !== "todos") {
      novoStatus = filtroStatusInicial;
      setFiltroStatus(filtroStatusInicial);
      if (setFiltroStatusInicial) setFiltroStatusInicial("todos");
      mudou = true;
    }


    if (mudou) {
      buscarPontoCidade({
        nome: novoNome,
        periodo: novoPeriodo,
        dataInicio: novaDataIni,
        dataFim: novaDataFim,
        status: novoStatus // Opcional, o filtro de status já é aplicado no render
      });
    }
  }, [filtroNomeInicial, filtroStatusInicial, filtroDataIniInicial, filtroDataFimInicial]);



  const iniciarEdicao = (reg) => {
    const toDate = (iso) => iso ? new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }) : "";
    const toTime = (iso) => iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }) : "";
    
    // Se não tiver saída, sugerir horário inteligente
    let saidaSugestao = reg.saida;
    if (!saidaSugestao && reg.entrada) {
      const dataEntrada = new Date(reg.entrada);
      
      // Procurar a próxima entrada deste mesmo funcionário na lista atual
      const proximasEntradas = registrosCidade
        .filter(r => r.id_jogo === reg.id_jogo && r.entrada && new Date(r.entrada) > dataEntrada)
        .sort((a, b) => new Date(a.entrada) - new Date(b.entrada));

      const proxima = proximasEntradas[0];

      if (proxima) {
        const dataProxima = new Date(proxima.entrada);
        const sugestaoPadrao = new Date(dataEntrada);
        sugestaoPadrao.setHours(sugestaoPadrao.getHours() + 1);

        if (dataProxima <= sugestaoPadrao) {
          // Se a próxima entrada for antes ou no horário da sugestão padrão de 1h, sugerir 1 minuto antes dela
          const sug = new Date(dataProxima);
          sug.setMinutes(sug.getMinutes() - 1);
          saidaSugestao = sug.toISOString();
        } else {
          saidaSugestao = sugestaoPadrao.toISOString();
        }
      } else {
        const sugestaoPadrao = new Date(dataEntrada);
        sugestaoPadrao.setHours(sugestaoPadrao.getHours() + 1);
        saidaSugestao = sugestaoPadrao.toISOString();
      }
    }

    setEditandoId(reg.id);
    setEditValues({
      entrada_data: toDate(reg.entrada),
      entrada_hora: toTime(reg.entrada),
      saida_data:   toDate(saidaSugestao),
      saida_hora:   toTime(saidaSugestao),
    });
    setOcultandoId(null);
  };

  const salvarEdicao = async () => {
    if (!editandoId) return;
    setSalvandoId(editandoId);
    const entradaISO = editValues.entrada_data && editValues.entrada_hora
      ? new Date(`${editValues.entrada_data}T${editValues.entrada_hora}:00-03:00`).toISOString() : null;
    const saidaISO = editValues.saida_data && editValues.saida_hora
      ? new Date(`${editValues.saida_data}T${editValues.saida_hora}:00-03:00`).toISOString() : null;
    if (saidaISO && entradaISO && new Date(saidaISO) < new Date(entradaISO)) {
      alert("⚠️ A saída não pode ser anterior à entrada!");
      setSalvandoId(null); return;
    }
    const { error } = await atualizarPontoCidade(editandoId, {
      entrada: entradaISO,
      saida:   saidaISO || null,
      data:    editValues.entrada_data || null,
      uuid_saida: editValues.uuid_saida || null,
    });

    if (!error && editValues.id_orfa_para_remover) {
      await deletarPontoCidade(editValues.id_orfa_para_remover);
    }
    setSalvandoId(null);
    if (error) { alert("❌ Erro ao salvar: " + error.message); return; }
    setEditandoId(null);
    aplicarFiltros();
  };

  const confirmarOcultamento = async () => {
    if (!ocultandoId) return;
    setSalvandoId(ocultandoId);
    const { error } = await atualizarPontoCidade(ocultandoId, {
      oculto: true,
      justificativa_ocultamento: justificativaOcult.trim() || null,
      oculto_por: usuarioLogado?.id || null,
      oculto_em:  new Date().toISOString(),
    });
    setSalvandoId(null);
    if (error) { alert("❌ Erro ao ocultar: " + error.message); return; }
    setOcultandoId(null);
    setJustificativaOcult("");
    aplicarFiltros();
    if (mostrarOcultos && buscarPontoCidadeOcultos) buscarPontoCidadeOcultos();
  };

  const restaurarRegistro = async (id) => {
    setSalvandoId(id);
    await atualizarPontoCidade(id, { oculto: false, justificativa_ocultamento: null, oculto_por: null, oculto_em: null });
    setSalvandoId(null);
    if (buscarPontoCidadeOcultos) buscarPontoCidadeOcultos();
    aplicarFiltros();
  };

  const toggleMostrarOcultos = () => {
    const prox = !mostrarOcultos;
    setMostrarOcultos(prox);
    if (prox && buscarPontoCidadeOcultos) buscarPontoCidadeOcultos();
  };

  // ===== PROCESSAR LOG =====
  const processarLog = async () => {
    if (!textoLog.trim()) return;
    setProcessandoLog(true);
    try {
      const registros = parseLogCidade(textoLog);
      const mapa = separarEventosPorFuncionario(registros);

      const idsJogos = Object.keys(mapa);
      let registrosExtra = [];
      if (idsJogos.length > 0) {
        const dataLimite = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();
        const dataLimiteStr = dataLimite.split("T")[0];

        const [r1, r2, r3] = await Promise.all([
          supabase.from("ponto_cidade").select("*").in("id_jogo", idsJogos).gte("data", dataLimiteStr),
          supabase.from("ponto_cidade_mecanica_2").select("*").in("id_jogo", idsJogos).gte("data", dataLimiteStr),
          supabase.from("ponto_cidade_mecanica_3").select("*").in("id_jogo", idsJogos).gte("data", dataLimiteStr)
        ]);

        if (r1.data) registrosExtra = [...registrosExtra, ...r1.data];
        if (r2.data) registrosExtra = [...registrosExtra, ...r2.data];
        if (r3.data) registrosExtra = [...registrosExtra, ...r3.data];
      }
      setRegistrosExtraDoBanco(registrosExtra);
      const combinedRecords = [...registrosCidade, ...registrosExtra];

      // Aplicar regras de ocultamento: remover registros que já existem no banco e não precisam de ação
      Object.keys(mapa).forEach((idJogo) => {
        const funcData = mapa[idJogo];
        const uuidSaidasParaRemover = new Set();
        
        funcData.entradas = funcData.entradas.filter((entrada) => {
          const registroExistente = combinedRecords.find((r) => r.uuid_entrada === entrada.uuid);
          if (registroExistente && registroExistente.saida) {
            // Se já tem saída oficial, ignora
            if (registroExistente.uuid_saida) {
              uuidSaidasParaRemover.add(registroExistente.uuid_saida);
              return false;
            }
            
            // Se tem saída manual, só mantemos se houver uma saída VÁLIDA no log dentro de 5h para substituí-la
            // Uma saída é inválida se ela já constar no banco (saída órfã importada), pois ela será filtrada logo abaixo
            const temSaidaValidaNoLog = funcData.saidas.some(s => {
              if (uuidSaidasParaRemover.has(s.uuid)) return false;
              
              const jaNoBanco = combinedRecords.some(r => r.uuid_saida === s.uuid);
              if (jaNoBanco) return false;

              const diffMin = (new Date(s.dataISO) - new Date(entrada.dataISO)) / 60000;
              return diffMin > 0 && diffMin <= 300;
            });
            if (!temSaidaValidaNoLog) return false;
          }
          return true;
        });

        funcData.saidas = funcData.saidas.filter((saida) => {
          // Se a saída foi pareada com uma entrada ignorada acima, ignora a saída também
          if (uuidSaidasParaRemover.has(saida.uuid)) return false;
          // Se a saída já consta no banco (saída órfã já importada), ignora
          const jaNoBanco = combinedRecords.some(r => r.uuid_saida === saida.uuid);
          if (jaNoBanco) return false;
          return true;
        });

        if (funcData.entradas.length === 0 && funcData.saidas.length === 0) {
          delete mapa[idJogo];
        }
      });

      if (Object.keys(mapa).length === 0) {
        alert("Todos os registros deste log já constam no banco de dados e foram ignorados.");
        setEventos(null);
        setConfig({});
        setResultadoImportacao(null);
        setProcessandoLog(false);
        return;
      }

      // Tentar associar saídas não vinculadas a entradas abertas no banco (ex: do dia anterior)
      Object.keys(mapa).forEach((idJogo) => {
        const funcData = mapa[idJogo];
        const entradas = funcData.entradas;
        const saidas = funcData.saidas;
        
        const saidasUsadasPorEntradasLog = new Set();
        entradas.forEach((entrada, idx) => {
          const dEntradaMin = new Date(entrada.dataISO).setSeconds(0, 0);
          const proximaEntrada = entradas[idx + 1];

          for (let sIdx = 0; sIdx < saidas.length; sIdx++) {
            if (saidasUsadasPorEntradasLog.has(sIdx)) continue;
            const dSaidaMin = new Date(saidas[sIdx].dataISO).setSeconds(0, 0);
            if (dSaidaMin < dEntradaMin) continue;
            if (proximaEntrada && new Date(saidas[sIdx].dataISO) > new Date(proximaEntrada.dataISO)) break;
            saidasUsadasPorEntradasLog.add(sIdx);
            break;
          }
        });

        saidas.forEach((saida, sIdx) => {
          if (!saidasUsadasPorEntradasLog.has(sIdx)) {
            const dSaida = new Date(saida.dataISO);
            
            const entradaBanco = combinedRecords.find(r => {
              if (String(r.id_jogo) !== String(idJogo)) return false;
              if (r.uuid_saida) return false; // Já tem saída oficial
              if (!r.entrada) return false;
              const dEntrada = new Date(r.entrada);
              const diffMin = (dSaida - dEntrada) / 60000;
              // Aceitamos se a saída for depois da entrada, até um limite de 24h (1440 min)
              return diffMin > 0 && diffMin <= 1440;
            });

            if (entradaBanco) {
              const jaInserida = entradas.some(e => e.uuid === entradaBanco.uuid_entrada);
              if (!jaInserida) {
                entradas.push({
                  acao: "entrada",
                  dataISO: entradaBanco.entrada,
                  uuid: entradaBanco.uuid_entrada,
                  nomePersonagem: funcData.nomePersonagem
                });
              }
            }
          }
        });
        
        entradas.sort((a, b) => new Date(a.dataISO) - new Date(b.dataISO));
      });

      // Inicializar config: pré-selecionar saída inteligente se possível
      const novaConfig = {};
      Object.entries(mapa).forEach(([idJogo, { entradas, saidas }]) => {
        novaConfig[idJogo] = {};
        const indicesUsados = new Set();

        entradas.forEach((entrada, idx) => {
          let autoSaidaIdx = null;
          const dEntrada = new Date(entrada.dataISO);
          const dEntradaMin = new Date(dEntrada).setSeconds(0, 0);
          const proximaEntrada = entradas[idx + 1];

          // Achar primeira saída do log que encaixe
          for (let sIdx = 0; sIdx < saidas.length; sIdx++) {
            if (indicesUsados.has(sIdx)) continue;

            const dSaida = new Date(saidas[sIdx].dataISO);
            const dSaidaMin = new Date(dSaida).setSeconds(0, 0);

            // Deve ser no mesmo minuto ou posterior
            if (dSaidaMin < dEntradaMin) continue;

            // Não pode ultrapassar a próxima entrada
            if (proximaEntrada && dSaida > new Date(proximaEntrada.dataISO)) break;

          // Encontrou o par perfeito
            autoSaidaIdx = sIdx;
            indicesUsados.add(sIdx);
            break;
          }

          if (autoSaidaIdx === null) {
            // Se não achou saída no log, já sugere o modo manual (CRIAR)
            const dEntrada = new Date(entrada.dataISO);
            let saidaSugestao = new Date(dEntrada);
            
            if (proximaEntrada) {
              const dProx = new Date(proximaEntrada.dataISO);
              const sugestaoPadrao = new Date(dEntrada);
              sugestaoPadrao.setHours(sugestaoPadrao.getHours() + 1);

              if (dProx <= sugestaoPadrao) {
                // Se a próxima entrada for antes ou no horário da sugestão padrão de 1h, sugerir 1 minuto antes dela
                saidaSugestao = new Date(dProx);
                saidaSugestao.setMinutes(saidaSugestao.getMinutes() - 1);
              } else {
                saidaSugestao = sugestaoPadrao;
              }
            } else {
              saidaSugestao.setHours(saidaSugestao.getHours() + 1);
            }

            novaConfig[idJogo][idx] = {
              modo: "manual",
              saidaIdx: null,
              saidaData: saidaSugestao.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }),
              saidaHora: saidaSugestao.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }),
              ignorar: false,
            };
          } else {
            novaConfig[idJogo][idx] = {
              modo: "existente",
              saidaIdx: autoSaidaIdx,
              saidaData: "",
              saidaHora: "",
              ignorar: false,
            };
          }
        });
      });

      setEventos(mapa);
      setConfig(novaConfig);
      setResultadoImportacao(null);
    } catch (e) {
      alert("❌ Erro ao processar o log: " + e.message);
    } finally {
      setProcessandoLog(false);
    }
  };

  // ===== ATUALIZAR CONFIG DE UMA ENTRADA =====
  const atualizarConfig = (idJogo, entradaIdx, campo, valor) => {
    setConfig((prev) => {
      const currentConfig = prev[idJogo]?.[entradaIdx] || {};
      const newConfig = { ...currentConfig, [campo]: valor };

      // Se mudar para modo manual, sugerir horário inteligente
      if (campo === "modo" && valor === "manual") {
        const entradaAtual = eventos[idJogo]?.entradas[entradaIdx];
        if (entradaAtual) {
          const dataEntrada = new Date(entradaAtual.dataISO);
          let saidaSugestao = new Date(dataEntrada);
          
          // Procurar próxima entrada no log
          const proximas = eventos[idJogo].entradas
            .filter((e, i) => i > entradaIdx)
            .sort((a, b) => new Date(a.dataISO) - new Date(b.dataISO));
          
          const proxima = proximas[0];
          if (proxima) {
            const dataProxima = new Date(proxima.dataISO);
            const sugestaoPadrao = new Date(dataEntrada);
            sugestaoPadrao.setHours(sugestaoPadrao.getHours() + 1);

            if (dataProxima <= sugestaoPadrao) {
              // Se a próxima entrada for antes ou no horário da sugestão padrão de 1h, sugerir 1 minuto antes dela
              saidaSugestao = new Date(dataProxima);
              saidaSugestao.setMinutes(saidaSugestao.getMinutes() - 1);
            } else {
              saidaSugestao = sugestaoPadrao;
            }
          } else {
            saidaSugestao.setHours(saidaSugestao.getHours() + 1);
          }

          newConfig.saidaData = saidaSugestao.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
          newConfig.saidaHora = saidaSugestao.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
        }
      }

      return {
        ...prev,
        [idJogo]: {
          ...prev[idJogo],
          [entradaIdx]: newConfig,
        },
      };
    });
  };

  // Saídas já usadas por este funcionário
  const saidasUsadas = (idJogo) => {
    const cfg = config[idJogo] || {};
    return new Set(
      Object.values(cfg)
        .filter((c) => c.saidaIdx !== null && c.modo === "existente")
        .map((c) => c.saidaIdx)
    );
  };

  const salvarSessoesImportadasCustom = async (sessoes) => {
    if (!sessoes || sessoes.length === 0) {
      return { inseridos: 0, duplicados: 0, erros: 0 };
    }

    let inseridos = 0;
    let duplicados = 0;
    let erros = 0;

    for (const s of sessoes) {
      let tabela = "ponto_cidade";
      if (s.mechanic_id === "harmony") {
        tabela = "ponto_cidade_mecanica_2";
      } else if (s.mechanic_id === "dudark") {
        tabela = "ponto_cidade_mecanica_3";
      }

      let existenteId = null;
      if (s.uuid_entrada) {
        const { data: existente } = await supabase
          .from(tabela)
          .select("id")
          .eq("uuid_entrada", s.uuid_entrada)
          .maybeSingle();
        if (existente) existenteId = existente.id;
      }

      const registro = {
        usuario_id: s.usuario_id || null,
        nome: s.nome,
        nome_personagem: s.nome_personagem,
        id_jogo: s.id_jogo,
        entrada: s.entrada,
        saida: s.saida || null,
        data: s.data,
        uuid_entrada: s.uuid_entrada || null,
        uuid_saida: s.uuid_saida || null,
        importado_por: s.importado_por || null,
      };

      if (existenteId) {
        const { error } = await supabase.from(tabela).update(registro).eq("id", existenteId);
        if (error) {
          console.error(`Erro ao atualizar ${tabela}:`, error.message);
          erros++;
        } else {
          duplicados++;
        }
      } else {
        const { error } = await supabase.from(tabela).insert([registro]);
        if (error) {
          console.error(`Erro ao inserir ${tabela}:`, error.message);
          erros++;
        } else {
          inseridos++;
        }
      }
    }

    return { inseridos, duplicados, erros };
  };

  const buscarEProcessarPointSessions = async () => {
    if (!pointSessionsInicio || !pointSessionsFim) {
      alert("⚠️ Selecione a data/hora de início e fim.");
      return;
    }
    setProcessandoLog(true);
    try {
      const inicioISO = new Date(pointSessionsInicio).toISOString();
      const fimISO = new Date(pointSessionsFim).toISOString();

      const { data, error } = await supabase
        .from("point_sessions")
        .select("*")
        .or(`and(entrada.gte.${inicioISO},entrada.lte.${fimISO}),and(saida.gte.${inicioISO},saida.lte.${fimISO})`)
        .eq("hidden", false);

      if (error) {
        alert("❌ Erro ao buscar registros de point_sessions: " + error.message);
        setProcessandoLog(false);
        return;
      }

      if (!data || data.length === 0) {
        alert("ℹ️ Nenhum registro encontrado no período selecionado.");
        setProcessandoLog(false);
        return;
      }

      const registrosPlanos = [];
      data.forEach((row) => {
        if (row.entrada) {
          registrosPlanos.push({
            idJogo: row.id_jogo,
            nomePersonagem: row.employee_name,
            acao: "entrada",
            dataISO: row.entrada,
            uuid: row.uuid_entrada || row.id,
            mechanic_id: row.mechanic_id
          });
        }
        if (row.saida) {
          registrosPlanos.push({
            idJogo: row.id_jogo,
            nomePersonagem: row.employee_name,
            acao: "saida",
            dataISO: row.saida,
            uuid: row.uuid_saida || `${row.uuid_entrada || row.id}-saida`,
            mechanic_id: row.mechanic_id
          });
        }
      });

      const mapa = separarEventosPorFuncionario(registrosPlanos);
      const idsJogos = Object.keys(mapa);
      let registrosExtra = [];

      if (idsJogos.length > 0) {
        const dataLimite = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();
        const dataLimiteStr = dataLimite.split("T")[0];

        const [r1, r2, r3] = await Promise.all([
          supabase.from("ponto_cidade").select("*").in("id_jogo", idsJogos).gte("data", dataLimiteStr),
          supabase.from("ponto_cidade_mecanica_2").select("*").in("id_jogo", idsJogos).gte("data", dataLimiteStr),
          supabase.from("ponto_cidade_mecanica_3").select("*").in("id_jogo", idsJogos).gte("data", dataLimiteStr)
        ]);

        if (r1.data) registrosExtra = [...registrosExtra, ...r1.data];
        if (r2.data) registrosExtra = [...registrosExtra, ...r2.data];
        if (r3.data) registrosExtra = [...registrosExtra, ...r3.data];
      }

      setRegistrosExtraDoBanco(registrosExtra);
      const combinedRecords = [...registrosCidade, ...registrosExtra];

      Object.keys(mapa).forEach((idJogo) => {
        const funcData = mapa[idJogo];
        const uuidSaidasParaRemover = new Set();

        funcData.entradas = funcData.entradas.filter((entrada) => {
          const registroExistente = combinedRecords.find((r) => r.uuid_entrada === entrada.uuid);
          if (registroExistente && registroExistente.saida) {
            if (registroExistente.uuid_saida) {
              uuidSaidasParaRemover.add(registroExistente.uuid_saida);
            }
            return false;
          }
          return true;
        });

        funcData.saidas = funcData.saidas.filter((saida) => {
          if (uuidSaidasParaRemover.has(saida.uuid)) return false;
          const registroExistente = combinedRecords.find((r) => r.uuid_saida === saida.uuid);
          if (registroExistente && registroExistente.entrada) return false;
          return true;
        });
      });

      const mapaFiltrado = {};
      Object.entries(mapa).forEach(([idJogo, f]) => {
        if (f.entradas.length > 0 || f.saidas.length > 0) {
          mapaFiltrado[idJogo] = f;
        }
      });

      setEventos(mapaFiltrado);
      
      const inicialConfig = {};
      Object.entries(mapaFiltrado).forEach(([idJogo, { entradas, saidas }]) => {
        inicialConfig[idJogo] = {};
        const indicesUsados = new Set();

        entradas.forEach((entrada, idx) => {
          let autoSaidaIdx = null;
          const dEntrada = new Date(entrada.dataISO);
          const dEntradaMin = new Date(dEntrada).setSeconds(0, 0);
          const proximaEntrada = entradas[idx + 1];

          // Achar primeira saída do log que encaixe
          for (let sIdx = 0; sIdx < saidas.length; sIdx++) {
            if (indicesUsados.has(sIdx)) continue;

            const dSaida = new Date(saidas[sIdx].dataISO);
            const dSaidaMin = new Date(dSaida).setSeconds(0, 0);

            // Deve ser no mesmo minuto ou posterior
            if (dSaidaMin < dEntradaMin) continue;

            // Não pode ultrapassar a próxima entrada
            if (proximaEntrada && dSaida > new Date(proximaEntrada.dataISO)) break;

            // Limite rígido de 6 horas
            const diff = dSaida - dEntrada;
            if (diff > 21600000) continue;

            // Encontrou o par perfeito
            autoSaidaIdx = sIdx;
            indicesUsados.add(sIdx);
            break;
          }

          if (autoSaidaIdx !== null) {
            inicialConfig[idJogo][idx] = {
              modo: "existente",
              saidaIdx: autoSaidaIdx,
              saidaData: "",
              saidaHora: "",
              ignorar: false
            };
          } else {
            // Se excedeu 6 horas ou não tem saída, sugere criar saída padrão de 1h ou aberto
            let saidaSugestao = new Date(dEntrada);
            if (proximaEntrada) {
              const dProx = new Date(proximaEntrada.dataISO);
              const sugestaoPadrao = new Date(dEntrada);
              sugestaoPadrao.setHours(sugestaoPadrao.getHours() + 1);

              if (dProx <= sugestaoPadrao) {
                saidaSugestao = new Date(dProx);
                saidaSugestao.setMinutes(saidaSugestao.getMinutes() - 1);
              } else {
                saidaSugestao = sugestaoPadrao;
              }
            } else {
              saidaSugestao.setHours(saidaSugestao.getHours() + 1);
            }

            inicialConfig[idJogo][idx] = {
              modo: "manual",
              saidaIdx: null,
              saidaData: saidaSugestao.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }),
              saidaHora: saidaSugestao.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }),
              ignorar: false
            };
          }
        });
      });
      setConfig(inicialConfig);

    } catch (err) {
      console.error("Erro ao processar logs:", err);
      alert("❌ Ocorreu um erro no processamento.");
    } finally {
      setProcessandoLog(false);
    }
  };

  // ===== IMPORTAÇÃO =====
  const handleImportar = async () => {
    if (!eventos) return;
    setImportando(true);

    const sessoesParaImportar = [];
    let erroValidacao = false;

    Object.entries(eventos).forEach(([idJogo, { nomePersonagem, entradas, saidas }]) => {
      const funcEncontrado = listaFuncionarios.find((f) => String(f.id) === String(idJogo));
      const cfg = config[idJogo] || {};

      entradas.forEach((entrada, idx) => {
        const c = cfg[idx];
        if (!c || c.ignorar) return;

        // VERIFICAÇÃO DE SEGURANÇA (A mesma que usamos para esconder na tela)
        const registroExistente = todosRegistrosBanco.find(r => r.uuid_entrada === entrada.uuid);
        if (registroExistente && registroExistente.saida) {
          // Se já é oficial, não importar de novo
          if (registroExistente.uuid_saida) return;
          // Se é manual e o usuário NÃO selecionou uma saída nova do log, não importar (para não limpar a manual)
          if (!registroExistente.uuid_saida && c.modo === "existente" && c.saidaIdx === null) return;
        }

        let saidaFinal = null;
        let uuidSaida = null;

        if (c.modo === "existente" && c.saidaIdx !== null) {
          saidaFinal = saidas[c.saidaIdx]?.dataISO || null;
          uuidSaida = saidas[c.saidaIdx]?.uuid || null;
        } else if (c.modo === "manual") {
          if (!c.saidaData || !c.saidaHora) return; // skip se incompleto
          saidaFinal = new Date(`${c.saidaData}T${c.saidaHora}:00-03:00`).toISOString();
        }
        // modo 'aberto' → saidaFinal permanece null

        // Validar saída posterior à entrada (ignorando segundos para permitir mesmo minuto)
        const dEntrada = new Date(entrada.dataISO);
        const dSaida = new Date(saidaFinal);
        
        // Zera os segundos para comparação por minuto
        const dEntradaMin = new Date(dEntrada).setSeconds(0, 0);
        const dSaidaMin = new Date(dSaida).setSeconds(0, 0);

        if (saidaFinal && dSaidaMin < dEntradaMin) {
          alert(`⚠️ Saída inválida para ${nomePersonagem}: a saída não pode ser de um horário anterior à entrada!`);
          erroValidacao = true;
          return;
        }

        sessoesParaImportar.push({
          usuario_id: funcEncontrado ? funcEncontrado.id : null,
          nome: funcEncontrado ? funcEncontrado.nome : nomePersonagem,
          nome_personagem: nomePersonagem,
          id_jogo: idJogo,
          entrada: entrada.dataISO,
          saida: saidaFinal,
          data: extrairData(entrada.dataISO),
          uuid_entrada: entrada.uuid,
          uuid_saida: uuidSaida,
          importado_por: usuarioLogado?.id,
          mechanic_id: entrada.mechanic_id || (c.modo === "existente" && c.saidaIdx !== null ? saidas[c.saidaIdx]?.mechanic_id : null),
        });
      });

      // NOVIDADE: Adicionar saídas que NÃO foram vinculadas a nenhuma entrada (Saídas Órfãs)
      const cfgF = config[idJogo] || {};
      const saidasVinculadasIdx = new Set(
        Object.values(cfgF)
          .filter(c => c.modo === "existente" && c.saidaIdx !== null)
          .map(c => c.saidaIdx)
      );

      saidas.forEach((s, sIdx) => {
        if (!saidasVinculadasIdx.has(sIdx)) {
          // Esta saída está "sozinha", vamos salvar para permitir vínculo manual depois
          sessoesParaImportar.push({
            usuario_id: funcEncontrado ? funcEncontrado.id : null,
            nome: funcEncontrado ? funcEncontrado.nome : nomePersonagem,
            nome_personagem: nomePersonagem,
            id_jogo: idJogo,
            entrada: null, // Sem entrada vinculada
            saida: s.dataISO,
            data: extrairData(s.dataISO),
            uuid_entrada: null,
            uuid_saida: s.uuid,
            importado_por: usuarioLogado?.id,
            mechanic_id: s.mechanic_id,
          });
        }
      });
    });

    if (erroValidacao) { setImportando(false); return; }

    const resultado = await salvarSessoesImportadasCustom(sessoesParaImportar);
    setResultadoImportacao(resultado);
    setImportando(false);
    
    // Limpar os cards processados para não gerar cards fantasmas após importação
    if (!resultado.erro && resultado.erros === 0) {
      setEventos(null);
      setConfig({});
    }

    // Recarregar histórico e rolar até ele
    if (buscarPontoCidade) await buscarPontoCidade();
    setTimeout(() => {
      histRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 300);
  };

  // ===== ESTATÍSTICAS =====
  const calcularStats = () => {
    if (!eventos) return null;
    let totalEntradas = 0, totalSaidas = 0, totalFuncs = 0;
    Object.values(eventos).forEach(({ entradas, saidas }) => {
      totalEntradas += entradas.length;
      totalSaidas += saidas.length;
      totalFuncs++;
    });
    return { totalEntradas, totalSaidas, totalFuncs };
  };

  const contarParaImportar = () => {
    if (!eventos) return 0;
    return Object.entries(config).reduce((acc, [idJogo, cfgFunc]) => {
      return acc + Object.values(cfgFunc).filter((c) => !c.ignorar).length;
    }, 0);
  };

  const stats = calcularStats();

  const cardStyle = { ...styles.whiteCard, marginBottom: "16px", padding: "16px 20px" };
  const badgeStyle = (cor) => ({
    display: "inline-block", padding: "2px 10px", borderRadius: "20px",
    fontSize: "11px", fontWeight: "700",
    background: cor + "22", color: cor, border: `1px solid ${cor}55`,
  });
  const inputSmall = { ...styles.input, padding: "5px 10px", fontSize: "13px", height: "32px" };

  return (
    <div style={{ padding: "28px 36px", maxWidth: "1200px", margin: "0 auto" }}>

      {/* HEADER */}
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: "800", color: theme.text, margin: 0 }}>
          📋 Ponto Admin — Importação de Logs da Cidade
        </h1>
        <p style={{ fontSize: "13px", color: theme.subtext, marginTop: "6px" }}>
          Cole o log, processe e <strong>vincule manualmente</strong> cada entrada à sua saída correspondente.
        </p>
      </div>

      {/* TABS DE SELEÇÃO DE MODO DE IMPORTAÇÃO */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
        <button
          onClick={() => {
            setModoImportacao("texto");
            setEventos(null);
            setConfig({});
            setResultadoImportacao(null);
          }}
          style={{
            flex: 1, padding: "12px", borderRadius: "10px", fontWeight: "700", fontSize: "14px",
            background: modoImportacao === "texto" ? "linear-gradient(135deg, #b40d0d, #ef4444)" : theme.card2,
            color: "#fff", border: `1px solid ${modoImportacao === "texto" ? "transparent" : theme.border}`,
            cursor: "pointer", transition: "all 0.2s ease"
          }}
        >
          📝 Cole o Log (Discord)
        </button>
        <button
          onClick={() => {
            setModoImportacao("banco");
            setEventos(null);
            setConfig({});
            setResultadoImportacao(null);
          }}
          style={{
            flex: 1, padding: "12px", borderRadius: "10px", fontWeight: "700", fontSize: "14px",
            background: modoImportacao === "banco" ? "linear-gradient(135deg, #b40d0d, #ef4444)" : theme.card2,
            color: "#fff", border: `1px solid ${modoImportacao === "banco" ? "transparent" : theme.border}`,
            cursor: "pointer", transition: "all 0.2s ease"
          }}
        >
          🗄️ Importar do Banco (point_sessions)
        </button>
      </div>

      {/* INPUT */}
      <div style={cardStyle}>
        {modoImportacao === "texto" ? (
          <>
            <div style={{ ...styles.cardHeader, marginBottom: "14px" }}>
              <span style={styles.dot} /> Cole o Log da Cidade
            </div>
            <textarea
              value={textoLog}
              onChange={(e) => setTextoLog(e.target.value)}
              placeholder={`Cole aqui o conteúdo do arquivo .txt...\n\nExemplo:\n — 20/04/2026 00:54\n[ID]: 3503 Lucas Piccinato ( ENTROU EM SERVIÇO - Reds Tunnershop )\n\n[DATA]: 20/04/2026, 00:54:17\n[UUID]: 0af11e05-6cba-43f1-b104-ebbd85033824`}
              style={{
                width: "100%", minHeight: "180px", padding: "14px", borderRadius: "10px",
                background: theme.card2, color: theme.text, border: `1px solid ${theme.border}`,
                fontSize: "12px", fontFamily: "monospace", resize: "vertical", outline: "none", lineHeight: "1.6",
              }}
            />
            <div style={{ display: "flex", gap: "10px", marginTop: "12px", alignItems: "center" }}>
              <button
                onClick={processarLog}
                disabled={!textoLog.trim() || processandoLog}
                style={{
                  background: (textoLog.trim() && !processandoLog) ? "linear-gradient(135deg, #b40d0d, #ef4444)" : "#333",
                  color: "#fff", border: "none", padding: "10px 24px", borderRadius: "10px",
                  fontWeight: "700", fontSize: "14px",
                  cursor: (textoLog.trim() && !processandoLog) ? "pointer" : "not-allowed", opacity: (textoLog.trim() && !processandoLog) ? 1 : 0.5,
                }}
              >
                {processandoLog ? "⏳ Processando..." : "🔍 Processar Log"}
              </button>
              {eventos && (
                <button
                  onClick={() => { setEventos(null); setConfig({}); setResultadoImportacao(null); setTextoLog(""); }}
                  style={{ background: "transparent", border: `1px solid ${theme.border}`, color: theme.subtext, padding: "10px 18px", borderRadius: "10px", cursor: "pointer", fontSize: "13px" }}
                >
                  🔄 Limpar
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <div style={{ ...styles.cardHeader, marginBottom: "14px" }}>
              <span style={styles.dot} /> Importar Logs de point_sessions
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", marginBottom: "16px" }}>
              <div style={{ flex: "1 1 200px" }}>
                <label style={{ display: "block", fontSize: "12px", color: theme.subtext, fontWeight: "700", marginBottom: "6px" }}>Data/Hora de Início</label>
                <input
                  type="datetime-local"
                  value={pointSessionsInicio}
                  onChange={(e) => setPointSessionsInicio(e.target.value)}
                  style={{
                    ...styles.input,
                    width: "100%",
                    background: theme.card2,
                    color: theme.text,
                    border: `1px solid ${theme.border}`,
                    padding: "8px 12px",
                    borderRadius: "8px",
                  }}
                />
              </div>
              <div style={{ flex: "1 1 200px" }}>
                <label style={{ display: "block", fontSize: "12px", color: theme.subtext, fontWeight: "700", marginBottom: "6px" }}>Data/Hora de Fim</label>
                <input
                  type="datetime-local"
                  value={pointSessionsFim}
                  onChange={(e) => setPointSessionsFim(e.target.value)}
                  style={{
                    ...styles.input,
                    width: "100%",
                    background: theme.card2,
                    color: theme.text,
                    border: `1px solid ${theme.border}`,
                    padding: "8px 12px",
                    borderRadius: "8px",
                  }}
                />
              </div>
            </div>
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <button
                onClick={buscarEProcessarPointSessions}
                disabled={!pointSessionsInicio || !pointSessionsFim || processandoLog}
                style={{
                  background: (pointSessionsInicio && pointSessionsFim && !processandoLog) ? "linear-gradient(135deg, #b40d0d, #ef4444)" : "#333",
                  color: "#fff", border: "none", padding: "10px 24px", borderRadius: "10px",
                  fontWeight: "700", fontSize: "14px",
                  cursor: (pointSessionsInicio && pointSessionsFim && !processandoLog) ? "pointer" : "not-allowed", opacity: (pointSessionsInicio && pointSessionsFim && !processandoLog) ? 1 : 0.5,
                }}
              >
                {processandoLog ? "⏳ Processando..." : "🔍 Processar Logs do Banco"}
              </button>
              {eventos && (
                <button
                  onClick={() => { setEventos(null); setConfig({}); setResultadoImportacao(null); }}
                  style={{ background: "transparent", border: `1px solid ${theme.border}`, color: theme.subtext, padding: "10px 18px", borderRadius: "10px", cursor: "pointer", fontSize: "13px" }}
                >
                  🔄 Limpar
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* RESULTADO DA IMPORTAÇÃO FICA DE FORA PARA CONTINUAR VISÍVEL DEPOIS DE LIMPAR A TELA */}
      {resultadoImportacao && (
        <div style={{ ...cardStyle, borderLeft: `3px solid ${resultadoImportacao.erro ? "#ef4444" : "#22c55e"}`, marginBottom: "20px" }}>
          {resultadoImportacao.erro ? (
            <span style={{ color: "#ef4444", fontWeight: "700" }}>❌ Erro: {resultadoImportacao.erro}</span>
          ) : (
            <div>
              <span style={{ color: "#22c55e", fontWeight: "700" }}>✅ Importação concluída!</span>
              <div style={{ fontSize: "13px", color: theme.subtext, marginTop: "6px" }}>
                • {resultadoImportacao.inseridos} registros inseridos
                {resultadoImportacao.duplicados > 0 && <> · <span style={{ color: "#facc15" }}>{resultadoImportacao.duplicados} duplicatas ignoradas (UUID já existente)</span></>}
                {resultadoImportacao.erros > 0 && <> · <span style={{ color: "#ef4444" }}>{resultadoImportacao.erros} com erro</span></>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* RESULTADO */}
      {eventos && stats && (
        <>
          {/* ESTATÍSTICAS */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "20px" }}>
            {[
              { label: "Funcionários", valor: stats.totalFuncs, cor: "#38bdf8", emoji: "👤" },
              { label: "Entradas no log", valor: stats.totalEntradas, cor: "#22c55e", emoji: "▶" },
              { label: "Saídas no log", valor: stats.totalSaidas, cor: "#ef4444", emoji: "⏹" },
            ].map(({ label, valor, cor, emoji }) => (
              <div key={label} style={{ ...styles.whiteCard, padding: "14px 18px", borderLeft: `3px solid ${cor}`, textAlign: "center" }}>
                <div style={{ fontSize: "22px" }}>{emoji}</div>
                <div style={{ fontSize: "24px", fontWeight: "800", color: cor }}>{valor}</div>
                <div style={{ fontSize: "11px", color: theme.subtext, fontWeight: "600" }}>{label}</div>
              </div>
            ))}
          </div>

          {/* AVISO PRINCIPAL */}
          <div style={{ ...cardStyle, borderLeft: "3px solid #f97316", background: "rgba(249,115,22,0.05)", marginBottom: "20px" }}>
            <div style={{ fontSize: "13px", color: "#f97316", fontWeight: "700" }}>
              ⚠️ Vínculo manual obrigatório
            </div>
            <div style={{ fontSize: "12px", color: theme.subtext, marginTop: "4px" }}>
              Para cada entrada, selecione a saída correspondente no dropdown. Se a saída não existir no log, use <b>"Criar saída"</b>. Se não houver saída, use <b>"Sem saída"</b>.
            </div>
          </div>

          {/* CARDS POR FUNCIONÁRIO */}
          {Object.entries(eventos).map(([idJogo, { nomePersonagem, entradas, saidas }]) => {
            const funcEncontrado = listaFuncionarios.find((f) => String(f.id) === String(idJogo));
            const cfgFunc = config[idJogo] || {};
            const jaUsadas = saidasUsadas(idJogo);

            return (
              <div key={idJogo} style={{ ...cardStyle, borderLeft: `3px solid ${funcEncontrado ? "#22c55e" : "#facc15"}` }}>
                {/* HEADER */}
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "18px" }}>
                  <div style={{
                    width: "38px", height: "38px", borderRadius: "50%", flexShrink: 0,
                    background: funcEncontrado ? "linear-gradient(135deg, #16a34a, #22c55e)" : "linear-gradient(135deg, #78350f, #f59e0b)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "15px", fontWeight: "800", color: "#fff",
                  }}>
                    {nomePersonagem.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: "800", fontSize: "15px", color: theme.text }}>{nomePersonagem}</div>
                    <div style={{ fontSize: "12px", color: theme.subtext, display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginTop: "3px" }}>
                      <span>ID Jogo: #{idJogo}</span>
                      {funcEncontrado
                        ? <span style={{ color: "#22c55e", fontWeight: "700" }}>✅ {funcEncontrado.nome}</span>
                        : <span style={{ color: "#facc15" }}>⚠️ Não encontrado no banco</span>
                      }
                      <span style={{
                        display: "inline-flex",
                        alignItems: "center",
                        padding: "1px 8px",
                        borderRadius: "12px",
                        fontSize: "10px",
                        fontWeight: "800",
                        textTransform: "uppercase",
                        background: (entradas[0]?.mechanic_id === "harmony" ? "#a855f7" : entradas[0]?.mechanic_id === "dudark" ? "#f97316" : "#ef4444") + "22",
                        color: entradas[0]?.mechanic_id === "harmony" ? "#a855f7" : entradas[0]?.mechanic_id === "dudark" ? "#f97316" : "#ef4444",
                        border: `1px solid ${entradas[0]?.mechanic_id === "harmony" ? "#a855f7" : entradas[0]?.mechanic_id === "dudark" ? "#f97316" : "#ef4444"}55`
                      }}>
                        ⚙️ {entradas[0]?.mechanic_id === "harmony" ? "Harmony" : entradas[0]?.mechanic_id === "dudark" ? "Dudark" : "Reds"}
                      </span>
                    </div>
                  </div>
                  <div style={{ marginLeft: "auto", display: "flex", gap: "6px" }}>
                    <span style={badgeStyle("#22c55e")}>{entradas.length} entrada(s)</span>
                    <span style={badgeStyle("#ef4444")}>{saidas.length} saída(s)</span>
                  </div>
                </div>

                {/* ENTRADAS */}
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      {entradas.map((entrada, idx) => {
                        const c = config[idJogo]?.[idx] || { modo: "existente", saidaIdx: null, saidaData: "", saidaHora: "", ignorar: false };
                        if (c.ignorar) return null;

                        const registroExistente = todosRegistrosBanco.find(r => r.uuid_entrada === entrada.uuid);
                        const jaSalvoNoBanco = !!registroExistente;
                        
                        // REGRAS DE OCULTAMENTO INTELIGENTE:
                        if (jaSalvoNoBanco && registroExistente.saida) {
                          // Se já é uma saída oficial (do log), oculta sempre.
                          if (registroExistente.uuid_saida) return null;
                          
                          // Se é uma saída manual, só mostramos se o log tiver uma saída OFICIAL 
                          // que esteja dentro da janela de 5 horas para substituir.
                          const temSaidaValidaNoLog = saidas.some(s => {
                            const diffMin = (new Date(s.dataISO) - new Date(entrada.dataISO)) / 60000;
                            return diffMin > 0 && diffMin <= 300;
                          });

                          if (!temSaidaValidaNoLog) return null;
                        }
                        let saidaFinal = null;
                        let uuidSaida = null;
                        if (c.modo === "existente" && c.saidaIdx !== null) {
                          saidaFinal = saidas[c.saidaIdx]?.dataISO || null;
                          uuidSaida = saidas[c.saidaIdx]?.uuid || null;
                        } else if (c.modo === "manual" && c.saidaData && c.saidaHora) {
                          saidaFinal = new Date(`${c.saidaData}T${c.saidaHora}:00-03:00`).toISOString();
                        }

                        const duracao = calcularDuracaoISO(entrada.dataISO, saidaFinal);

                        return (
                          <div key={idx} style={{ 
                            background: jaSalvoNoBanco ? "rgba(34,197,94,0.04)" : theme.card2, 
                            padding: "16px", 
                            borderRadius: "12px", 
                            border: `1px solid ${jaSalvoNoBanco ? "rgba(34,197,94,0.3)" : theme.border}`,
                            position: "relative"
                          }}>
                            {jaSalvoNoBanco && (
                              <div style={{ position: "absolute", top: "8px", right: "80px", fontSize: "10px", color: "#22c55e", fontWeight: "800" }}>
                                ✓ JÁ NO BANCO (PODE ATUALIZAR)
                              </div>
                            )}
                            
                            {/* TOPO: ENTRADA */}
                            <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "12px", flexWrap: "wrap" }}>
                              {/* Entrada */}
                              <div>
                                <div style={{ fontSize: "10px", color: theme.subtext, fontWeight: "700", textTransform: "uppercase", marginBottom: "2px" }}>▶ Entrada</div>
                                <div style={{ fontWeight: "800", fontSize: "17px", color: "#22c55e" }}>{formatarHoraBR(entrada.dataISO)}</div>
                                <div style={{ fontSize: "11px", color: theme.subtext }}>{formatarDataBR(entrada.dataISO)}</div>
                              </div>

                              <span style={{ fontSize: "20px", color: theme.subtext }}>→</span>

                              {/* Saída selecionada ou input */}
                              <div style={{ flex: 1, minWidth: "200px" }}>
                                <div style={{ fontSize: "10px", color: theme.subtext, fontWeight: "700", textTransform: "uppercase", marginBottom: "6px" }}>⏹ Saída</div>

                                {/* SELETOR DE MODO */}
                                <div style={{ display: "flex", gap: "6px", marginBottom: "8px", flexWrap: "wrap" }}>
                                  {[
                                    { val: "existente", label: "📋 Do log", disabled: false },
                                    { val: "manual", label: "✏️ Criar", disabled: jaSalvoNoBanco },
                                    { val: "aberto", label: "🔓 Sem saída", disabled: jaSalvoNoBanco },
                                  ].map(({ val, label, disabled }) => (
                                    <button
                                      key={val}
                                      disabled={disabled}
                                      onClick={() => !disabled && atualizarConfig(idJogo, idx, "modo", val)}
                                      style={{
                                        padding: "4px 12px", borderRadius: "8px", border: "none", 
                                        cursor: disabled ? "not-allowed" : "pointer",
                                        fontSize: "11px", fontWeight: "700",
                                        background: c.modo === val ? "#b40d0d" : theme.card2,
                                        color: c.modo === val ? "#fff" : theme.subtext,
                                        opacity: disabled ? 0.4 : 1,
                                      }}
                                    >
                                      {label}
                                    </button>
                                  ))}
                                </div>

                                {/* DROPDOWN DE SAÍDAS DO LOG */}
                                {c.modo === "existente" && (
                                  saidas.length === 0 ? (
                                    <div style={{ fontSize: "12px", color: "#facc15" }}>⚠️ Nenhuma saída encontrada no log para este funcionário.</div>
                                  ) : (
                                    <select
                                      value={c.saidaIdx !== null ? String(c.saidaIdx) : ""}
                                      onChange={(e) => atualizarConfig(idJogo, idx, "saidaIdx", e.target.value === "" ? null : Number(e.target.value))}
                                      style={{
                                        ...inputSmall,
                                        width: "100%", maxWidth: "340px",
                                        background: theme.card2, color: theme.text,
                                        border: `1px solid ${c.saidaIdx !== null ? "#22c55e" : "#facc15"}`,
                                      }}
                                    >
                                      <option value="">— Selecione a saída correspondente —</option>
                                      {saidas
                                        .map((saida, sIdx) => ({ ...saida, sIdx }))
                                        .filter(saida => {
                                          const dEntrada = new Date(entrada.dataISO);
                                          const dSaida = new Date(saida.dataISO);
                                          
                                          // Zera os segundos para comparação por minuto
                                          const dEntradaMin = new Date(dEntrada).setSeconds(0, 0);
                                          const dSaidaMin = new Date(dSaida).setSeconds(0, 0);

                                          // 1. Deve ser no mesmo minuto ou posterior (permite cliques duplos)
                                          if (dSaidaMin < dEntradaMin) return false;

                                          // 2. Não pode ser após a PRÓXIMA entrada deste funcionário
                                          const proximaEntrada = entradas[idx + 1];
                                          if (proximaEntrada && dSaida > new Date(proximaEntrada.dataISO)) return false;

                                          // 3. Não pode já estar sendo usada por OUTRA entrada deste mesmo funcionário
                                          const usadas = saidasUsadas(idJogo);
                                          if (usadas.has(saida.sIdx) && c.saidaIdx !== saida.sIdx) return false;

                                          // 4. Limite de segurança de 6h (360 minutos)
                                          const diffMin = (dSaida - dEntrada) / 60000;
                                          if (diffMin > 360) return false;

                                          return true;
                                        })
                                        .map((saida) => (
                                          <option key={saida.sIdx} value={String(saida.sIdx)}>
                                            {formatarHoraBR(saida.dataISO)} — {formatarDataBR(saida.dataISO)}
                                          </option>
                                        ))}
                                    </select>
                                  )
                                )}

                                {/* INPUT DE SAÍDA MANUAL */}
                                {c.modo === "manual" && (
                                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "flex-end" }}>
                                    <div>
                                      <div style={{ fontSize: "9px", color: theme.subtext, fontWeight: "700", textTransform: "uppercase", marginBottom: "3px" }}>Data</div>
                                      <input
                                        type="date"
                                        value={c.saidaData || extrairData(entrada.dataISO)}
                                        onChange={(e) => atualizarConfig(idJogo, idx, "saidaData", e.target.value)}
                                        style={{ ...inputSmall, width: "145px" }}
                                      />
                                    </div>
                                    <div>
                                      <div style={{ fontSize: "9px", color: theme.subtext, fontWeight: "700", textTransform: "uppercase", marginBottom: "3px" }}>Hora</div>
                                      <input
                                        type="time"
                                        value={c.saidaHora}
                                        onChange={(e) => atualizarConfig(idJogo, idx, "saidaHora", e.target.value)}
                                        style={{ ...inputSmall, width: "110px" }}
                                      />
                                    </div>
                                  </div>
                                )}

                                {/* EXIBIR DURAÇÃO SE HOUVER SAÍDA */}
                                {duracao && (
                                  <div style={{ 
                                    marginTop: "6px", fontSize: "11px", fontWeight: "800", color: "#38bdf8",
                                    display: "flex", alignItems: "center", gap: "4px"
                                  }}>
                                    ⏱️ {duracao} de duração
                                  </div>
                                )}
                              </div>

                              {/* AÇÕES */}
                              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                <button
                                  onClick={async () => {
                                    const registroExistente = todosRegistrosBanco.find(r => r.uuid_entrada === entrada.uuid);
                                    const funcEncontrado = listaFuncionarios.find(f => String(f.id) === String(idJogo));
                                    
                                    // SÓ SALVA SE: 
                                    // 1. For registro novo
                                    // 2. Tiver uma nova saída selecionada (saidaFinal não nula)
                                    // 3. For um registro aberto no banco que agora estamos fechando
                                    if (registroExistente && registroExistente.saida && !saidaFinal) {
                                      alert("⚠️ Este registro já possui uma saída. Para atualizar, selecione uma saída oficial do log.");
                                      return;
                                    }

                                    const sessao = {
                                      usuario_id: funcEncontrado ? funcEncontrado.id : null,
                                      nome: funcEncontrado ? funcEncontrado.nome : nomePersonagem,
                                      nome_personagem: nomePersonagem,
                                      id_jogo: idJogo,
                                      entrada: entrada.dataISO,
                                      saida: saidaFinal || (registroExistente ? registroExistente.saida : null),
                                      data: extrairData(entrada.dataISO),
                                      uuid_entrada: entrada.uuid,
                                      uuid_saida: uuidSaida || (registroExistente ? registroExistente.uuid_saida : null),
                                      importado_por: usuarioLogado?.id,
                                      mechanic_id: entrada.mechanic_id || (uuidSaida ? saidas.find(x => x.uuid === uuidSaida)?.mechanic_id : null),
                                    };
                                    const res = await salvarSessoesImportadasCustom([sessao]);
                                    if (res.erros === 0) {
                                      alert("✅ Registro salvo/atualizado com sucesso!");
                                      if (buscarPontoCidade) buscarPontoCidade();
                                    } else {
                                      alert("❌ Erro ao salvar registro.");
                                    }
                                  }}
                                  style={{
                                    background: "#22c55e", color: "#fff", border: "none",
                                    padding: "6px 12px", borderRadius: "7px", cursor: "pointer",
                                    fontSize: "11px", fontWeight: "700", whiteSpace: "nowrap"
                                  }}
                                >
                                  💾 Salvar Individual
                                </button>
                                <button
                                  onClick={() => atualizarConfig(idJogo, idx, "ignorar", true)}
                                  style={{
                                    background: "rgba(107,114,128,0.12)", border: `1px solid ${theme.border}`,
                                    color: theme.subtext, padding: "6px 12px", borderRadius: "7px",
                                    cursor: "pointer", fontSize: "11px", fontWeight: "700", whiteSpace: "nowrap",
                                  }}
                                >
                                  🗑 Ignorar
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                </div>

                {/* SAÍDAS SEM ENTRADA */}
                {(() => {
                  const cfgF = config[idJogo] || {};
                  const saidasVinculadas = new Set(
                    Object.values(cfgF)
                      .filter((c) => c.modo === "existente" && c.saidaIdx !== null)
                      .map((c) => c.saidaIdx)
                  );
                  const livres = saidas.filter((s, idx) => {
                    if (saidasVinculadas.has(idx)) return false;
                    // Ocultar se já estiver no banco como saída órfã
                    const jaNoBanco = todosRegistrosBanco.some(r => r.uuid_saida === s.uuid);
                    return !jaNoBanco;
                  });
                  if (livres.length === 0) return null;
                  return (
                    <div style={{ marginTop: "12px", padding: "10px 14px", borderRadius: "10px", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)" }}>
                      <div style={{ fontSize: "11px", color: "#ef4444", fontWeight: "700", marginBottom: "6px" }}>
                        ⚠️ {livres.length} saída(s) não vinculada(s) — serão ignoradas na importação
                      </div>
                      {livres.map((s, i) => (
                        <div key={i} style={{ fontSize: "12px", color: theme.subtext }}>
                          ⏹ {formatarHoraBR(s.dataISO)} — {formatarDataBR(s.dataISO)}
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            );
          })}

          {/* BOTÃO DE IMPORTAÇÃO */}
          <div style={{ position: "sticky", bottom: "20px", display: "flex", justifyContent: "center", marginTop: "20px" }}>
            <button
              onClick={handleImportar}
              disabled={importando}
              style={{
                background: "linear-gradient(135deg, #22c55e, #16a34a)",
                color: "#fff", border: "none", padding: "12px 24px",
                borderRadius: "10px", cursor: "pointer", fontSize: "14px", fontWeight: "700",
                boxShadow: "0 4px 12px rgba(34,197,94,0.3)",
              }}
            >
              {importando ? "⏳ PROCESSANDO..." : "🚀 IMPORTAR / ATUALIZAR TUDO"}
            </button>
          </div>
        </>
      )}
      {/* ===== HISTÓRICO DE REGISTROS IMPORTADOS ===== */}
      <div ref={histRef} style={{ marginTop: "40px" }}>
        <div style={{ ...cardStyle, padding: "0", overflow: "hidden" }}>

          {/* ------ TABS ------ */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${theme.border}`, paddingRight: "16px" }}>
            <div style={{ display: "flex", gap: "0" }}>
              {[
                { id: "registros",   label: "📋 Registros Pareados" },
                { id: "log-bruto",   label: "🗂 Log Bruto" },
                { id: "cobertura",   label: "📅 Cobertura" },
                { id: "conciliacao", label: "⚖️ Conciliação" },
                { id: "bonificacao", label: "🎁 Bonificação" },
                { id: "auditoria",   label: "🔍 Auditoria de Baú" },
              ].map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setAbaAtiva(id)}
                  style={{
                    padding: "12px 22px", border: "none", cursor: "pointer",
                    fontWeight: "700", fontSize: "13px",
                    background: "transparent",
                    color: abaAtiva === id ? theme.accent : theme.subtext,
                    borderBottom: abaAtiva === id ? `2px solid ${theme.accent}` : "2px solid transparent",
                    transition: "all 0.15s",
                  }}
                >{label}</button>
              ))}
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              {/* Filtro Ocultar Manuais no Ponto Admin */}
              {(abaAtiva === "cobertura" || abaAtiva === "bonificacao") && (
                <div style={{ display: "flex", alignItems: "center", gap: "6px", height: "30px", padding: "0 10px", borderRadius: "8px", background: "rgba(255,255,255,0.02)", border: `1px solid ${theme.border}44`, cursor: "pointer" }} onClick={() => setOcultarManuaisPontoAdmin(!ocultarManuaisPontoAdmin)}>
                  <input 
                    type="checkbox" 
                    checked={ocultarManuaisPontoAdmin} 
                    onChange={() => {}} // handled by parent click
                    style={{ cursor: "pointer" }} 
                  />
                  <label style={{ fontSize: "11px", fontWeight: "700", color: theme.text, cursor: "pointer", userSelect: "none" }}>
                    🚫 Excluir Pontos Manuais
                  </label>
                </div>
              )}

              {/* Filtro Excluir Donos da Bonificação */}
              {abaAtiva === "bonificacao" && (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", height: "30px", padding: "0 10px", borderRadius: "8px", background: "rgba(255,255,255,0.02)", border: `1px solid ${theme.border}44`, cursor: "pointer" }} onClick={() => setExcluirDonos(!excluirDonos)}>
                    <input 
                      type="checkbox" 
                      checked={excluirDonos} 
                      onChange={() => {}} // handled by parent click
                      style={{ cursor: "pointer" }} 
                    />
                    <label style={{ fontSize: "11px", fontWeight: "700", color: theme.text, cursor: "pointer", userSelect: "none" }}>
                      👑 Excluir Donos
                    </label>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "6px", height: "30px", padding: "0 10px", borderRadius: "8px", background: "rgba(255,255,255,0.02)", border: `1px solid ${theme.border}44`, cursor: "pointer" }} onClick={() => setOcultarDonos(!ocultarDonos)}>
                    <input 
                      type="checkbox" 
                      checked={ocultarDonos} 
                      onChange={() => {}} // handled by parent click
                      style={{ cursor: "pointer" }} 
                    />
                    <label style={{ fontSize: "11px", fontWeight: "700", color: theme.text, cursor: "pointer", userSelect: "none" }}>
                      🙈 Ocultar Donos
                    </label>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ------ ABA REGISTROS PAREADOS ------ */}
          {abaAtiva === "registros" && (
          <>
          <div style={{ padding: "16px 20px", borderBottom: `1px solid ${theme.border}` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
              <div>
                <div style={{ ...styles.cardHeader, marginBottom: "2px" }}>
                  <span style={styles.dot} /> Registros Importados — ponto_cidade
                </div>
                <div style={{ fontSize: "12px", color: theme.subtext }}>
                  {registrosCidadeCarregando ? "Carregando..." : `${registrosCidade.length} registro(s) encontrado(s)`}
                </div>
              </div>
            </div>

            {/* ------ PAINEL DE FILTROS ------ */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "flex-end" }}>

              {/* Busca por nome/ID */}
              <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                <label style={{ fontSize: "10px", color: theme.subtext, fontWeight: "700", textTransform: "uppercase" }}>Funcionário</label>
                <input
                  type="text"
                  placeholder="Nome ou ID do personagem..."
                  value={filtroNome}
                  onChange={(e) => setFiltroNome(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && aplicarFiltros()}
                  list="lista-funcionarios-ponto"
                  style={{ ...styles.input, width: "240px", height: "32px", fontSize: "13px" }}
                />
                <datalist id="lista-funcionarios-ponto">
                  {listaFuncionarios.map(f => (
                    <option key={f.id} value={f.nome} />
                  ))}
                </datalist>
              </div>

              {/* Presets de período */}
              <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                <label style={{ fontSize: "10px", color: theme.subtext, fontWeight: "700", textTransform: "uppercase" }}>Período</label>
                <div style={{ display: "flex", gap: "5px", flexWrap: "wrap", alignItems: "center" }}>
                  {[
                    { val: "hoje",   label: "Hoje" },
                    { val: "semana", label: "Seg → Dom" },
                    { val: "mes",    label: "Mês" },
                    { val: "custom", label: "Custom" },
                  ].map(({ val, label }) => (
                    <button
                      key={val}
                      onClick={() => {
                        setFiltroPeriodo(val);
                        if (val === "semana") {
                          // Resetar para a última semana completa
                          const agora = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
                          const defaultOffset = agora.getDay() === 0 ? 0 : -1;
                          setSemanaOffset(defaultOffset);
                          aplicarFiltros(undefined, val, defaultOffset);
                        } else if (val === "custom") {
                          // Preencher 3 meses atrás até hoje
                          const agora = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
                          const hoje = agora.toLocaleDateString("en-CA");
                          const tresMesesAtras = new Date(agora);
                          tresMesesAtras.setMonth(agora.getMonth() - 3);
                          const inicio = tresMesesAtras.toLocaleDateString("en-CA");
                          setFiltroDataInicio(inicio);
                          setFiltroDataFim(hoje);
                        } else {
                          aplicarFiltros(undefined, val);
                        }
                      }}
                      style={{
                        padding: "5px 12px", borderRadius: "8px", border: "none", cursor: "pointer",
                        fontSize: "12px", fontWeight: "700",
                        background: filtroPeriodo === val ? theme.accent : theme.card2,
                        color: filtroPeriodo === val ? "#fff" : theme.subtext,
                        transition: "all 0.15s",
                      }}
                    >{label}</button>
                  ))}

                  {/* Botão atalho: Semana Atual */}
                  {(filtroPeriodo !== "semana" || semanaOffset !== 0) && (
                    <button
                      onClick={() => {
                        setFiltroPeriodo("semana");
                        setSemanaOffset(0);
                        aplicarFiltros(undefined, "semana", 0);
                      }}
                      title="Ir para a semana atual (em andamento)"
                      style={{
                        padding: "5px 12px", borderRadius: "8px",
                        border: "1px solid rgba(56,189,248,0.4)",
                        cursor: "pointer", fontSize: "12px", fontWeight: "700",
                        background: "rgba(56,189,248,0.08)",
                        color: "#38bdf8",
                        transition: "all 0.15s",
                        whiteSpace: "nowrap",
                      }}
                    >📅 Semana Atual</button>
                  )}

                  {/* Navegação de semanas */}
                  {filtroPeriodo === "semana" && (() => {
                    const { inicio, fim } = calcularDatasPeriodo("semana", semanaOffset);
                    return (
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginLeft: "8px" }}>
                        <button
                          onClick={() => {
                            const novoOffset = semanaOffset - 1;
                            setSemanaOffset(novoOffset);
                            aplicarFiltros(undefined, "semana", novoOffset);
                          }}
                          title="Semana anterior"
                          style={{
                            background: theme.card2, border: `1px solid ${theme.border}`,
                            color: theme.text, width: "28px", height: "28px",
                            borderRadius: "7px", cursor: "pointer", fontSize: "14px",
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}
                        >←</button>

                        <div style={{
                          padding: "4px 10px", borderRadius: "8px",
                          background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.3)",
                          fontSize: "11px", fontWeight: "700", color: "#38bdf8",
                          whiteSpace: "nowrap",
                        }}>
                          {(() => {
                            const agora = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
                            const defaultOffset = agora.getDay() === 0 ? 0 : -1;
                            if (semanaOffset === defaultOffset) return "🗓 Última semana completa";
                            if (semanaOffset === 0) return "🗓 Semana atual";
                            if (semanaOffset === -1) return "🗓 Semana passada";
                            return `🗓 ${semanaOffset < 0 ? Math.abs(semanaOffset) + " sem. atrás" : semanaOffset + " sem. à frente"}`;
                          })()}
                          <span style={{ fontWeight: "400", marginLeft: "6px", color: theme.subtext }}>
                            {fmtBR(inicio)} – {fmtBR(fim)}
                          </span>
                        </div>

                        <button
                          onClick={() => {
                            const novoOffset = semanaOffset + 1;
                            setSemanaOffset(novoOffset);
                            aplicarFiltros(undefined, "semana", novoOffset);
                          }}
                          title="Semana seguinte"
                          disabled={semanaOffset >= 0}
                          style={{
                            background: theme.card2, border: `1px solid ${theme.border}`,
                            color: semanaOffset >= 0 ? theme.subtext : theme.text,
                            width: "28px", height: "28px",
                            borderRadius: "7px",
                            cursor: semanaOffset >= 0 ? "not-allowed" : "pointer",
                            fontSize: "14px", opacity: semanaOffset >= 0 ? 0.4 : 1,
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}
                        >→</button>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Datas custom */}
              {filtroPeriodo === "custom" && (
                <>
                  <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                    <label style={{ fontSize: "10px", color: theme.subtext, fontWeight: "700", textTransform: "uppercase" }}>De</label>
                    <input type="date" value={filtroDataInicio} onChange={(e) => setFiltroDataInicio(e.target.value)}
                      style={{ ...inputSmall, width: "145px" }} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                    <label style={{ fontSize: "10px", color: theme.subtext, fontWeight: "700", textTransform: "uppercase" }}>Até</label>
                    <input type="date" value={filtroDataFim} onChange={(e) => setFiltroDataFim(e.target.value)}
                      style={{ ...inputSmall, width: "145px" }} />
                  </div>
                </>
              )}

              {/* Filtro de Status */}
              <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                <label style={{ fontSize: "10px", color: theme.subtext, fontWeight: "700", textTransform: "uppercase" }}>Status</label>
                <select 
                  value={filtroStatus} 
                  onChange={(e) => setFiltroStatus(e.target.value)}
                  style={{ ...inputSmall, width: "130px" }}
                >
                  <option value="todos">Todos</option>
                  <option value="completo">✅ Completo</option>
                  <option value="manual">✏️ Manual</option>
                  <option value="aberto">🔓 Sem saída</option>
                </select>
              </div>

              {/* Ordenação */}
              <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                <label style={{ fontSize: "10px", color: theme.subtext, fontWeight: "700", textTransform: "uppercase" }}>Ordenação</label>
                <button
                  onClick={() => setOrdemEntrada(o => o === "desc" ? "asc" : "desc")}
                  style={{
                    ...inputSmall,
                    width: "170px",
                    background: theme.card2,
                    border: `1px solid ${theme.border}`,
                    color: theme.text,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    fontWeight: "700",
                    justifyContent: "center",
                  }}
                  title="Alternar ordenação"
                >
                  {ordemEntrada === "desc" ? "🔽 Mais recente primeiro" : "🔼 Mais antigo primeiro"}
                </button>
              </div>

              {/* Botões acao */}
              <div style={{ display: "flex", gap: "6px" }}>
                <button
                  onClick={() => aplicarFiltros()}
                  disabled={registrosCidadeCarregando}
                  style={{
                    background: "linear-gradient(135deg, #b40d0d, #ef4444)",
                    color: "#fff", border: "none", padding: "6px 16px",
                    borderRadius: "8px", cursor: "pointer", fontSize: "12px", fontWeight: "700",
                  }}
                >🔍 Filtrar</button>
                <button
                  onClick={() => {
                    setFiltroNome("");
                    setFiltroPeriodo("mes");
                    setFiltroDataInicio("");
                    setFiltroDataFim("");
                    setFiltroStatus("todos");
                    aplicarFiltros("", "mes");
                  }}
                  style={{
                    background: theme.card2, border: `1px solid ${theme.border}`,
                    color: theme.subtext, padding: "6px 12px",
                    borderRadius: "8px", cursor: "pointer", fontSize: "12px", fontWeight: "600",
                  }}
                >🔄 Limpar</button>
              </div>
            </div>
          </div>

          {/* ------ TABELA ------ */}
          {registrosCidadeCarregando ? (
            <div style={{ padding: "32px", textAlign: "center", color: theme.subtext }}>⏳ Carregando...</div>
          ) : registrosCidade.length === 0 ? (
            <div style={{ padding: "32px", textAlign: "center", color: theme.subtext, opacity: 0.6 }}>
              <div style={{ fontSize: "32px", marginBottom: "8px" }}>📭</div>
              Nenhum registro encontrado com os filtros aplicados.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ background: theme.card2 }}>
                    {["Funcionário", "ID Jogo", "Entrada", "Saída", "Duração", "Status", "Ações"].map((col) => (
                      <th key={col} style={{
                        padding: "10px 14px", textAlign: "left",
                        color: theme.subtext, fontWeight: "700", fontSize: "11px",
                        textTransform: "uppercase", letterSpacing: "0.4px",
                        borderBottom: `1px solid ${theme.border}`,
                        whiteSpace: "nowrap",
                      }}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {registrosCidade
                    .filter(r => r.entrada !== null) // Esconde registros que são apenas saída (órfãos)
                    .filter(r => {
                      if (filtroStatus === "todos") return true;
                      if (filtroStatus === "completo") return !!r.uuid_saida;
                      if (filtroStatus === "manual") return !!r.saida && !r.uuid_saida;
                      if (filtroStatus === "aberto") return !r.saida;
                      return true;
                    })
                    .sort((a, b) => {
                      const dA = a.entrada ? new Date(a.entrada).getTime() : 0;
                      const dB = b.entrada ? new Date(b.entrada).getTime() : 0;
                      return ordemEntrada === "desc" ? dB - dA : dA - dB;
                    })
                    .map((reg, i) => {
                    const duracao = calcularDuracaoISO(reg.entrada, reg.saida);
                    return (
                      <React.Fragment key={reg.id}>
                        {/* ROW NORMAL ou EDIT MODE */}
                        <tr style={{
                          background: editandoId === reg.id
                            ? "rgba(180,13,13,0.06)"
                            : ocultandoId === reg.id
                              ? "rgba(249,115,22,0.07)"
                              : i % 2 === 0 ? "transparent" : `${theme.card2}55`,
                          borderBottom: ocultandoId === reg.id ? "none" : `1px solid ${theme.border}55`,
                          outline: editandoId === reg.id ? "1px solid rgba(180,13,13,0.4)" : "none",
                        }}>
                          {/* FUNCIONÁRIO */}
                          <td style={{ padding: "10px 14px", color: theme.text, fontWeight: "600" }}>
                            <div>{reg.nome}</div>
                            {reg.nome_personagem && reg.nome_personagem !== reg.nome && (
                              <div style={{ fontSize: "11px", color: theme.subtext }}>{reg.nome_personagem}</div>
                            )}
                          </td>

                          {/* ID JOGO */}
                          <td style={{ padding: "10px 14px", color: theme.subtext, fontFamily: "monospace" }}>#{reg.id_jogo}</td>

                          {/* ENTRADA */}
                          <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                            {editandoId === reg.id ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: "4px", opacity: 0.6 }}>
                                <input type="date" value={editValues.entrada_data} disabled
                                  style={{ ...inputSmall, width: "130px", cursor: "not-allowed" }} />
                                <input type="time" value={editValues.entrada_hora} disabled
                                  style={{ ...inputSmall, width: "100px", cursor: "not-allowed" }} />
                                <div style={{ fontSize: "9px", color: theme.subtext, fontFamily: "monospace", maxWidth: "130px", overflow: "hidden", textOverflow: "ellipsis" }} title={reg.uuid_entrada}>
                                  UUID: {reg.uuid_entrada || "Manual"}
                                </div>
                              </div>
                            ) : (
                              <>
                                <div style={{ color: "#22c55e", fontWeight: "700" }}>
                                  {reg.entrada ? new Date(reg.entrada).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }) : "—"}
                                </div>
                                <div style={{ fontSize: "11px", color: theme.subtext }}>
                                  {reg.entrada ? new Date(reg.entrada).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : ""}
                                </div>
                              </>
                            )}
                          </td>

                          {/* SAÍDA */}
                          <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                            {editandoId === reg.id ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                <input type="date" value={editValues.saida_data} onChange={e => setEditValues(v => ({...v, saida_data: e.target.value}))}
                                  style={{ ...inputSmall, width: "130px" }} />
                                <input type="time" value={editValues.saida_hora} onChange={e => setEditValues(v => ({...v, saida_hora: e.target.value}))}
                                  style={{ ...inputSmall, width: "100px" }} />
                                <div style={{ fontSize: "9px", color: theme.subtext, fontFamily: "monospace", maxWidth: "130px", overflow: "hidden", textOverflow: "ellipsis" }} title={editValues.uuid_saida !== undefined ? editValues.uuid_saida : reg.uuid_saida}>
                                  UUID: {editValues.uuid_saida !== undefined ? (editValues.uuid_saida || "Manual") : (reg.uuid_saida || "Manual")}
                                </div>
                                
                                {/* SELETOR DE SAÍDAS ÓRFÃS */}
                                {(() => {
                                  const orfas = registrosCidade.filter(r => r.entrada === null && r.id_jogo === reg.id_jogo);
                                  if (orfas.length === 0) return null;
                                  return (
                                    <div style={{ marginTop: "5px" }}>
                                      <div style={{ fontSize: "9px", color: "#38bdf8", fontWeight: "800", marginBottom: "3px" }}>🔗 VINCULAR DA CIDADE:</div>
                                      <select 
                                        style={{ ...inputSmall, width: "130px", borderColor: "#38bdf8" }}
                                        onChange={(e) => {
                                          const selected = orfas.find(o => o.id === e.target.value);
                                          if (selected) {
                                            const d = new Date(selected.saida);
                                            setEditValues(v => ({
                                              ...v, 
                                              saida_data: d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }),
                                              saida_hora: d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }),
                                              uuid_saida: selected.uuid_saida,
                                              id_orfa_para_remover: selected.id
                                            }));
                                          }
                                        }}
                                      >
                                        <option value="">Escolher log...</option>
                                        {orfas.map(o => (
                                          <option key={o.id} value={o.id}>
                                            {new Date(o.saida).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })} ({new Date(o.saida).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })})
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  );
                                })()}

                                <button onClick={() => setEditValues(v => ({...v, saida_data: "", saida_hora: "", uuid_saida: null, id_orfa_para_remover: null}))} style={{
                                  background: "none", border: "none", color: theme.subtext, fontSize: "10px", cursor: "pointer", padding: 0, textAlign: "left"
                                }}>✕ Remover saída</button>
                              </div>
                            ) : reg.saida ? (
                              <>
                                <div style={{ color: "#ef4444", fontWeight: "700" }}>
                                  {new Date(reg.saida).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}
                                </div>
                                <div style={{ fontSize: "11px", color: theme.subtext }}>
                                  {new Date(reg.saida).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                                </div>
                              </>
                            ) : (
                              <span style={{ background: "rgba(250,204,21,0.15)", color: "#facc15", padding: "2px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: "700" }}>🔓 Aberto</span>
                            )}
                          </td>

                          {/* DURAÇÃO */}
                          <td style={{ padding: "10px 14px", fontWeight: "700", color: duracao ? theme.accent : theme.subtext }}>
                            {duracao || "—"}
                          </td>

                          {/* STATUS */}
                          <td style={{ padding: "10px 14px" }}>
                            {reg.uuid_saida ? (
                              <span style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e", padding: "2px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: "700" }}>✅ Completo</span>
                            ) : reg.saida ? (
                              <span style={{ background: "rgba(249,115,22,0.15)", color: "#f97316", padding: "2px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: "700" }}>✏️ Manual</span>
                            ) : (
                              <span style={{ background: "rgba(250,204,21,0.15)", color: "#facc15", padding: "2px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: "700" }}>🔓 Sem saída</span>
                            )}
                          </td>

                          {/* AÇÕES */}
                          <td style={{ padding: "8px 14px", whiteSpace: "nowrap" }}>
                            {editandoId === reg.id ? (
                              <div style={{ display: "flex", gap: "6px" }}>
                                <button onClick={salvarEdicao} disabled={salvandoId === reg.id} style={{
                                  background: "rgba(34,197,94,0.2)", border: "1px solid #22c55e", color: "#22c55e",
                                  padding: "4px 10px", borderRadius: "6px", cursor: "pointer", fontSize: "11px", fontWeight: "700"
                                }}>{salvandoId === reg.id ? "⏳" : "💾"}</button>
                                <button onClick={() => setEditandoId(null)} style={{
                                  background: "transparent", border: `1px solid ${theme.border}`, color: theme.subtext,
                                  padding: "4px 10px", borderRadius: "6px", cursor: "pointer", fontSize: "11px"
                                }}>✕</button>
                              </div>
                            ) : ocultandoId === reg.id ? (
                              <button onClick={() => setOcultandoId(null)} style={{
                                background: "transparent", border: `1px solid ${theme.border}`, color: theme.subtext,
                                padding: "4px 10px", borderRadius: "6px", cursor: "pointer", fontSize: "11px"
                              }}>✕ Cancelar</button>
                            ) : (
                              <div style={{ display: "flex", gap: "6px" }}>
                                <button onClick={() => iniciarEdicao(reg)} title="Editar" style={{
                                  background: "rgba(56,189,248,0.15)", border: "1px solid #38bdf8", color: "#38bdf8",
                                  padding: "4px 8px", borderRadius: "6px", cursor: "pointer", fontSize: "12px"
                                }}>✏️</button>
                                <button onClick={() => { setOcultandoId(reg.id); setEditandoId(null); setJustificativaOcult(""); }}
                                  title="Ocultar registro" style={{
                                  background: "rgba(249,115,22,0.15)", border: "1px solid #f97316", color: "#f97316",
                                  padding: "4px 8px", borderRadius: "6px", cursor: "pointer", fontSize: "12px"
                                }}>🚫</button>
                              </div>
                            )}
                          </td>
                        </tr>

                        {/* ROW DE CONFIRMAÇÃO DE OCULTAMENTO */}
                        {ocultandoId === reg.id && (
                          <tr style={{ background: "rgba(249,115,22,0.06)", borderBottom: `1px solid ${theme.border}55` }}>
                            <td colSpan={7} style={{ padding: "12px 18px" }}>
                              <div style={{ display: "flex", alignItems: "flex-end", gap: "10px", flexWrap: "wrap" }}>
                                <div style={{ flex: 1, minWidth: "220px" }}>
                                  <div style={{ fontSize: "10px", color: "#f97316", fontWeight: "700", textTransform: "uppercase", marginBottom: "4px" }}>
                                    🚫 Justificativa do ocultamento (opcional)
                                  </div>
                                  <input
                                    type="text"
                                    autoFocus
                                    value={justificativaOcult}
                                    onChange={e => setJustificativaOcult(e.target.value)}
                                    onKeyDown={e => e.key === "Enter" && confirmarOcultamento()}
                                    placeholder="Ex: ponto quebrado, crash do servidor, duplicata..."
                                    style={{ ...inputSmall, width: "100%", borderColor: "#f97316" }}
                                  />
                                </div>
                                <button onClick={confirmarOcultamento} disabled={salvandoId === reg.id} style={{
                                  background: "#f97316", color: "#fff", border: "none",
                                  padding: "6px 16px", borderRadius: "8px", cursor: "pointer",
                                  fontSize: "12px", fontWeight: "700",
                                }}>{salvandoId === reg.id ? "⏳" : "🚫 Confirmar Ocultamento"}</button>
                                <button onClick={() => setOcultandoId(null)} style={{
                                  background: theme.card2, border: `1px solid ${theme.border}`,
                                  color: theme.subtext, padding: "6px 12px",
                                  borderRadius: "8px", cursor: "pointer", fontSize: "12px",
                                }}>Cancelar</button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>

              {/* ------ RODAPÉ: TOTAIS ------ */}
              {(() => {
                const totalMin = registrosCidade.reduce((acc, reg) => {
                  if (!reg.entrada || !reg.saida) return acc;
                  const diff = (new Date(reg.saida) - new Date(reg.entrada)) / 60000;
                  return diff > 0 ? acc + diff : acc;
                }, 0);
                const totalH   = Math.floor(totalMin / 60);
                const totalM   = Math.round(totalMin % 60);
                const comSaida = registrosCidade.filter(r => r.saida).length;
                const semSaida = registrosCidade.length - comSaida;

                return (
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "14px 20px",
                    borderTop: `2px solid ${theme.border}`,
                    background: theme.card2,
                    gap: "20px", flexWrap: "wrap",
                  }}>
                    <div style={{ display: "flex", gap: "28px", flexWrap: "wrap" }}>
                      <div>
                        <div style={{ fontSize: "10px", color: theme.subtext, fontWeight: "700", textTransform: "uppercase" }}>Registros</div>
                        <div style={{ fontWeight: "800", fontSize: "16px", color: theme.text }}>{registrosCidade.length}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: "10px", color: theme.subtext, fontWeight: "700", textTransform: "uppercase" }}>Completos</div>
                        <div style={{ fontWeight: "800", fontSize: "16px", color: "#22c55e" }}>{comSaida}</div>
                      </div>
                      {semSaida > 0 && (
                        <div>
                          <div style={{ fontSize: "10px", color: theme.subtext, fontWeight: "700", textTransform: "uppercase" }}>Sem Saída</div>
                          <div style={{ fontWeight: "800", fontSize: "16px", color: "#facc15" }}>{semSaida}</div>
                        </div>
                      )}
                    </div>
                    <div style={{
                      display: "flex", alignItems: "center", gap: "12px",
                      background: "rgba(34,197,94,0.08)",
                      border: "1px solid rgba(34,197,94,0.3)",
                      borderRadius: "12px", padding: "10px 20px",
                    }}>
                      <span style={{ fontSize: "22px" }}>⏱️</span>
                      <div>
                        <div style={{ fontSize: "10px", color: theme.subtext, fontWeight: "700", textTransform: "uppercase" }}>Total de Horas</div>
                        <div style={{ fontWeight: "900", fontSize: "26px", color: "#22c55e", lineHeight: 1 }}>
                          {totalH}h {String(totalM).padStart(2, "0")}min
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
          </>
        )} {/* fim abaAtiva === registros */}

        {/* ===== ABA: LOG BRUTO ===== */}
        {abaAtiva === "log-bruto" && (() => {
          // Expande cada registro ponto_cidade nos seus sub-eventos de UUID
          // Cada registro gera 1 linha de ENTRADA (uuid_entrada) e possivelmente 1 de SAÍDA (uuid_saida)
          const eventos = [];
          registrosCidade.forEach(reg => {
            // Linha de ENTRADA
            if (reg.uuid_entrada || reg.entrada) {
              eventos.push({
                uuid: reg.uuid_entrada || null,
                tipo: "entrada",
                timestamp: reg.entrada,
                id_jogo: reg.id_jogo,
                nome: reg.nome_personagem || reg.nome,
                registroId: reg.id,
                vinculado: !!(reg.uuid_entrada && reg.uuid_saida) || !!(reg.entrada && reg.saida),
                uuid_par: reg.uuid_saida || null,
              });
            }
            // Linha de SAÍDA
            if (reg.uuid_saida || reg.saida) {
              eventos.push({
                uuid: reg.uuid_saida || null,
                tipo: "saida",
                timestamp: reg.saida,
                id_jogo: reg.id_jogo,
                nome: reg.nome_personagem || reg.nome,
                registroId: reg.id,
                vinculado: !!(reg.uuid_entrada && reg.uuid_saida) || !!(reg.entrada && reg.saida),
                uuid_par: reg.uuid_entrada || null,
              });
            }
          });

          // Ordenar por timestamp crescente
          eventos.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

          // Aplicar filtros locais
          let filtrados = eventos;
          if (logBrutoFiltroId.trim()) {
            const t = logBrutoFiltroId.trim().toLowerCase();
            filtrados = filtrados.filter(e =>
              String(e.id_jogo) === t || e.nome?.toLowerCase().includes(t)
            );
          }
          if (logBrutoFiltroTipo !== "todos") {
            filtrados = filtrados.filter(e => e.tipo === logBrutoFiltroTipo);
          }
          if (logBrutoFiltroVinculo === "vinculado") {
            filtrados = filtrados.filter(e => e.vinculado);
          } else if (logBrutoFiltroVinculo === "solto") {
            filtrados = filtrados.filter(e => !e.vinculado);
          }
          if (logBrutoFiltroInicio) {
            filtrados = filtrados.filter(e => e.timestamp && e.timestamp.slice(0,10) >= logBrutoFiltroInicio);
          }
          if (logBrutoFiltroFim) {
            filtrados = filtrados.filter(e => e.timestamp && e.timestamp.slice(0,10) <= logBrutoFiltroFim);
          }

          return (
            <div>
              {/* Filtros */}
              <div style={{
                display: "flex", flexWrap: "wrap", gap: "10px", padding: "14px 20px",
                borderBottom: `1px solid ${theme.border}`, alignItems: "flex-end",
              }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                  <label style={{ fontSize: "10px", color: theme.subtext, fontWeight: "700", textTransform: "uppercase" }}>ID / Nome</label>
                  <input
                    type="text" value={logBrutoFiltroId}
                    onChange={e => setLogBrutoFiltroId(e.target.value)}
                    placeholder="ID ou nome..."
                    style={{ ...inputSmall, width: "160px" }}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                  <label style={{ fontSize: "10px", color: theme.subtext, fontWeight: "700", textTransform: "uppercase" }}>Tipo</label>
                  <select value={logBrutoFiltroTipo} onChange={e => setLogBrutoFiltroTipo(e.target.value)}
                    style={{ ...inputSmall, width: "130px" }}>
                    <option value="todos">Todos</option>
                    <option value="entrada">▶ Entrada</option>
                    <option value="saida">⏹ Saída</option>
                  </select>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                  <label style={{ fontSize: "10px", color: theme.subtext, fontWeight: "700", textTransform: "uppercase" }}>Vínculo</label>
                  <select value={logBrutoFiltroVinculo} onChange={e => setLogBrutoFiltroVinculo(e.target.value)}
                    style={{ ...inputSmall, width: "150px" }}>
                    <option value="todos">Todos</option>
                    <option value="vinculado">✅ Vinculado</option>
                    <option value="solto">⚠️ Sem par</option>
                  </select>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                  <label style={{ fontSize: "10px", color: theme.subtext, fontWeight: "700", textTransform: "uppercase" }}>De</label>
                  <input type="date" value={logBrutoFiltroInicio} onChange={e => setLogBrutoFiltroInicio(e.target.value)}
                    style={{ ...inputSmall, width: "140px" }} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                  <label style={{ fontSize: "10px", color: theme.subtext, fontWeight: "700", textTransform: "uppercase" }}>Até</label>
                  <input type="date" value={logBrutoFiltroFim} onChange={e => setLogBrutoFiltroFim(e.target.value)}
                    style={{ ...inputSmall, width: "140px" }} />
                </div>
                <div style={{ display: "flex", alignItems: "flex-end" }}>
                  <button onClick={() => { setLogBrutoFiltroId(""); setLogBrutoFiltroTipo("todos"); setLogBrutoFiltroVinculo("todos"); setLogBrutoFiltroInicio(""); setLogBrutoFiltroFim(""); }}
                    style={{ ...inputSmall, background: theme.card2, border: `1px solid ${theme.border}`, color: theme.subtext, cursor: "pointer", height: "32px" }}
                  >🔄 Limpar</button>
                </div>
                <div style={{ marginLeft: "auto", display: "flex", alignItems: "flex-end" }}>
                  <span style={{ fontSize: "12px", color: theme.subtext, fontWeight: "700" }}>
                    {filtrados.length} evento(s)
                  </span>
                </div>
              </div>

              {/* Tabela */}
              {registrosCidadeCarregando ? (
                <div style={{ padding: "32px", textAlign: "center", color: theme.subtext }}>⏳ Carregando...</div>
              ) : filtrados.length === 0 ? (
                <div style={{ padding: "32px", textAlign: "center", color: theme.subtext, opacity: 0.6 }}>
                  <div style={{ fontSize: "28px", marginBottom: "8px" }}>🗂</div>
                  Nenhum evento encontrado.
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                    <thead>
                      <tr style={{ background: theme.card2 }}>
                        {["Tipo", "Data/Hora", "ID Jogo", "Personagem", "UUID do Evento", "UUID do Par", "Vínculo"].map(col => (
                          <th key={col} style={{
                            padding: "9px 13px", textAlign: "left",
                            color: theme.subtext, fontWeight: "700", fontSize: "10px",
                            textTransform: "uppercase", letterSpacing: "0.4px",
                            borderBottom: `1px solid ${theme.border}`,
                            whiteSpace: "nowrap",
                          }}>{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtrados.map((ev, i) => (
                        <tr key={`${ev.registroId}-${ev.tipo}`} style={{
                          background: i % 2 === 0 ? "transparent" : `${theme.card2}55`,
                          borderBottom: `1px solid ${theme.border}44`,
                        }}>
                          {/* TIPO */}
                          <td style={{ padding: "8px 13px", whiteSpace: "nowrap" }}>
                            {ev.tipo === "entrada" ? (
                              <span style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e", padding: "2px 9px", borderRadius: "6px", fontWeight: "700", fontSize: "11px" }}>▶ Entrada</span>
                            ) : (
                              <span style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444", padding: "2px 9px", borderRadius: "6px", fontWeight: "700", fontSize: "11px" }}>⏹ Saída</span>
                            )}
                          </td>

                          {/* DATA/HORA */}
                          <td style={{ padding: "8px 13px", whiteSpace: "nowrap" }}>
                            <div style={{ color: ev.tipo === "entrada" ? "#22c55e" : "#ef4444", fontWeight: "700" }}>
                              {ev.timestamp ? new Date(ev.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "America/Sao_Paulo" }) : "—"}
                            </div>
                            <div style={{ fontSize: "10px", color: theme.subtext }}>
                              {ev.timestamp ? new Date(ev.timestamp).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : ""}
                            </div>
                          </td>

                          {/* ID JOGO */}
                          <td style={{ padding: "8px 13px", color: theme.subtext, fontFamily: "monospace", fontWeight: "700" }}>#{ev.id_jogo}</td>

                          {/* NOME */}
                          <td style={{ padding: "8px 13px", color: theme.text, fontWeight: "600" }}>{ev.nome || "—"}</td>

                          {/* UUID DO EVENTO */}
                          <td style={{ padding: "8px 13px" }}>
                            {ev.uuid ? (
                              <span style={{ fontFamily: "monospace", fontSize: "11px", color: theme.subtext, background: theme.card2, padding: "2px 6px", borderRadius: "4px", letterSpacing: "0.3px" }}
                                title={ev.uuid}>
                                {ev.uuid.substring(0, 8)}…{ev.uuid.substring(ev.uuid.length - 4)}
                              </span>
                            ) : (
                              <span style={{ color: theme.subtext, fontStyle: "italic", fontSize: "11px" }}>sem UUID</span>
                            )}
                          </td>

                          {/* UUID DO PAR */}
                          <td style={{ padding: "8px 13px" }}>
                            {ev.uuid_par ? (
                              <span style={{ fontFamily: "monospace", fontSize: "11px", color: "#38bdf8", background: "rgba(56,189,248,0.1)", padding: "2px 6px", borderRadius: "4px" }}
                                title={ev.uuid_par}>
                                {ev.uuid_par.substring(0, 8)}…{ev.uuid_par.substring(ev.uuid_par.length - 4)}
                              </span>
                            ) : (
                              <span style={{ color: theme.subtext, fontStyle: "italic", fontSize: "11px" }}>—</span>
                            )}
                          </td>

                          {/* VÍNCULO */}
                          <td style={{ padding: "8px 13px" }}>
                            {ev.vinculado ? (
                              <span style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e", padding: "2px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: "700" }}>✅ Vinculado</span>
                            ) : (
                              <span style={{ background: "rgba(250,204,21,0.15)", color: "#facc15", padding: "2px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: "700" }}>⚠️ Sem par</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })()}

        {/* ===== ABA: COBERTURA ===== */}
        {abaAtiva === "cobertura" && (() => {
          // ---- Cálculo de cobertura por hora ----
          // Calendário mensal: { '2026-04-15': minutosAtivos } (sempre usa tudo)
          const coberturaDia = {};
          const coberturaDiaFuncionarios = {};
          
          // Auxiliar: Encontrar a segunda-feira de uma data ISO (mantendo fuso BRT)
          const getSegundaFeira = (isoStr) => {
            if (!isoStr) return null;
            const d = new Date(isoStr);
            const diaSemana = d.getDay();
            const diff = diaSemana === 0 ? -6 : 1 - diaSemana;
            d.setDate(d.getDate() + diff);
            return d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
          };

          const semanasDisponiveis = new Set();

          filtrarManuaisLocal(registrosCidade).forEach(reg => {
            if (!reg.entrada || !reg.saida) return;
            const segStr = getSegundaFeira(reg.entrada);
            if (segStr) semanasDisponiveis.add(segStr);

            const func = listaFuncionarios.find(f => String(f.id) === String(reg.id_jogo));
            const funcNome = func ? func.nome : reg.nome_personagem || reg.nome;

            const inicio = new Date(reg.entrada);
            const fim    = new Date(reg.saida);
            if (fim <= inicio) return;

            // Alimenta calendario full
            const cur = new Date(inicio);
            cur.setMinutes(0, 0, 0);
            while (cur < fim) {
              const slotStart = cur.getTime();
              const slotEnd   = slotStart + 3600000;
              const overlap   = Math.min(fim.getTime(), slotEnd) - Math.max(inicio.getTime(), slotStart);
              if (overlap > 0) {
                const dateKey = cur.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
                coberturaDia[dateKey] = (coberturaDia[dateKey] || 0) + overlap / 60000;
                
                if (!coberturaDiaFuncionarios[dateKey]) {
                  coberturaDiaFuncionarios[dateKey] = new Set();
                }
                if (funcNome) coberturaDiaFuncionarios[dateKey].add(funcNome);
              }
              cur.setTime(cur.getTime() + 3600000);
            }
          });

          // Ordernar semanas
          const semanasArray = Array.from(semanasDisponiveis).sort();

          // Filtra registros apenas pro heatmap (se uma semana foi selecionada)
          const registrosHeatmap = heatmapSemana === "todas"
            ? registrosCidade
            : registrosCidade.filter(r => getSegundaFeira(r.entrada) === heatmapSemana);

          // Heatmap semanal (0=Dom,1=Seg...6=Sab)
          const heatmapSemanal = {}; // { diaSemana_hora: count }
          const heatmapFuncionarios = {}; // { diaSemana_hora: Set }
          
          filtrarManuaisLocal(registrosHeatmap).forEach(reg => {
            if (!reg.entrada || !reg.saida) return;
            
            const func = listaFuncionarios.find(f => String(f.id) === String(reg.id_jogo));
            const funcNome = func ? func.nome : reg.nome_personagem || reg.nome;

            const inicio = new Date(reg.entrada);
            const fim    = new Date(reg.saida);
            if (fim <= inicio) return;

            // Itera de hora em hora
            const cur = new Date(inicio);
            cur.setMinutes(0, 0, 0);
            while (cur < fim) {
              const slotStart = cur.getTime();
              const slotEnd   = slotStart + 3600000; // +1h
              const overlap   = Math.min(fim.getTime(), slotEnd) - Math.max(inicio.getTime(), slotStart);
              if (overlap > 0) {
                const diaSem = cur.getDay(); // 0-6
                const hora   = cur.getHours();
                const key    = `${diaSem}_${hora}`;
                heatmapSemanal[key] = (heatmapSemanal[key] || 0) + overlap / 60000; // minutos
                
                if (!heatmapFuncionarios[key]) {
                  heatmapFuncionarios[key] = new Set();
                }
                if (funcNome) heatmapFuncionarios[key].add(funcNome);
              }
              cur.setTime(cur.getTime() + 3600000);
            }
          });

          const DIAS_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
          const ORDEM_DIAS = [1, 2, 3, 4, 5, 6, 0]; // Seg a Dom
          const HORAS = Array.from({ length: 24 }, (_, i) => i);

          // Transformar minutos brutos no valor desejado para a métrica
          const divisorAgregado = heatmapSemana === "todas" ? Math.max(semanasArray.length, 1) : 1;
          const formatarValor = (minutos) => {
            if (heatmapMetrica === "equipe") {
              const simul = (minutos / 60) / divisorAgregado;
              return { val: simul, desc: `${simul.toFixed(1).replace(".", ",")} funcionário(s) em média` };
            }
            const horas = Math.floor(minutos / 60);
            const mins = Math.round(minutos % 60);
            return { val: minutos, desc: `${horas}h${mins}min de cobertura total` };
          };

          // Valor máximo para normalizar cores
          const rawVals = Object.values(heatmapSemanal);
          const metricVals = rawVals.map(v => formatarValor(v).val);
          const maxVal = Math.max(...metricVals, 1);

          const cellColor = (minutos) => {
            const v = formatarValor(minutos).val;
            if (!v) return "rgba(255,255,255,0.04)";
            const ratio = Math.min(v / maxVal, 1);
            if (ratio < 0.25) return "rgba(34,197,94,0.25)";
            if (ratio < 0.5)  return "rgba(34,197,94,0.45)";
            if (ratio < 0.75) return "rgba(34,197,94,0.70)";
            return "rgba(34,197,94,0.95)";
          };

          // Calendário mensal
          const diasOrdenados = Object.keys(coberturaDia).sort();
          const maxDiaCob = Math.max(...Object.values(coberturaDia), 1);

          const calColor = (min) => {
            const h = min / 60;
            if (h === 0) return "rgba(255,255,255,0.04)";
            if (h < 2)   return "rgba(34,197,94,0.2)";
            if (h < 5)   return "rgba(34,197,94,0.45)";
            if (h < 10)  return "rgba(34,197,94,0.70)";
            return "rgba(34,197,94,0.95)";
          };

          // Gerar range de dias do calendário
          const gerarCalendario = () => {
            if (diasOrdenados.length === 0) return [];
            const inicio = new Date(diasOrdenados[0] + "T12:00:00");
            const fim    = new Date(diasOrdenados[diasOrdenados.length - 1] + "T12:00:00");
            const days   = [];
            const cur    = new Date(inicio.getFullYear(), inicio.getMonth(), 1);
            const end    = new Date(fim.getFullYear(), fim.getMonth() + 1, 0);
            while (cur <= end) {
              days.push(cur.toLocaleDateString("en-CA"));
              cur.setDate(cur.getDate() + 1);
            }
            return days;
          };
          const calDays = gerarCalendario();
          // Agrupar por mês
          const meses = {};
          calDays.forEach(d => {
            const [y, m] = d.split("-");
            const mk = `${y}-${m}`;
            if (!meses[mk]) meses[mk] = [];
            meses[mk].push(d);
          });

          return (
            <div style={{ padding: "20px" }}>
              {/* Sub-vista */}
              <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
                {[{id: "heatmap", label: "🟩 Heatmap Semanal"}, {id: "calendario", label: "📅 Calendário Mensal"}].map(({id, label}) => (
                  <button
                    key={id}
                    onClick={() => setCoberturaVista(id)}
                    style={{
                      padding: "7px 18px", border: "none", borderRadius: "8px", cursor: "pointer",
                      fontWeight: "700", fontSize: "12px",
                      background: coberturaVista === id ? theme.accent : theme.card2,
                      color: coberturaVista === id ? "#fff" : theme.subtext,
                    }}
                  >{label}</button>
                ))}
              </div>

              {coberturaVista === "heatmap" && (
                <div>
                  <div style={{ marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: "700", color: theme.text, marginBottom: "4px" }}>⏱️ Padrão Semanal de Cobertura</div>
                      <div style={{ fontSize: "11px", color: theme.subtext }}>Como se comportaram os horários da mecânica na visão escolhida.</div>
                    </div>
                    
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      
                      {/* FILTRO 1: Métrica */}
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <label style={{ fontSize: "11px", fontWeight: "700", color: theme.subtext, textTransform: "uppercase" }}>Métrica:</label>
                        <select 
                          value={heatmapMetrica} 
                          onChange={(e) => setHeatmapMetrica(e.target.value)}
                          style={{
                            padding: "6px 10px", borderRadius: "8px", border: `1px solid ${theme.border}`,
                            background: theme.card2, color: theme.text, fontSize: "12px", outline: "none", cursor: "pointer",
                            maxWidth: "200px"
                          }}
                        >
                          <option value="tempo">Tempo Coberto (Horas)</option>
                          <option value="equipe">Tamanho da Equipe (Média)</option>
                        </select>
                      </div>

                      {/* FILTRO 2: Período */}
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <label style={{ fontSize: "11px", fontWeight: "700", color: theme.subtext, textTransform: "uppercase" }}>Período:</label>
                      <select 
                        value={heatmapSemana} 
                        onChange={(e) => setHeatmapSemana(e.target.value)}
                        style={{
                          padding: "6px 10px", borderRadius: "8px", border: `1px solid ${theme.border}`,
                          background: theme.card2, color: theme.text, fontSize: "12px", outline: "none", cursor: "pointer",
                          maxWidth: "200px"
                        }}
                      >
                        <option value="todas">Período Selecionado (Agregado)</option>
                        {semanasArray.map(seg => {
                          const dSeg = new Date(seg + "T12:00:00");
                          const dDom = new Date(seg + "T12:00:00");
                          dDom.setDate(dDom.getDate() + 6);
                          const lbl = `Semana de ${dSeg.toLocaleDateString("pt-BR").slice(0, 5)} até ${dDom.toLocaleDateString("pt-BR").slice(0, 5)}`;
                          return <option key={seg} value={seg}>{lbl}</option>;
                        })}
                      </select>
                    </div>
                    </div>
                  </div>

                  {/* Legenda */}
                  <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "16px" }}>
                    <span style={{ fontSize: "10px", color: theme.subtext }}>Vazio</span>
                    {[0.25, 0.5, 0.75, 1].map(r => (
                      <div key={r} style={{ width: "20px", height: "14px", borderRadius: "3px",
                        background: r < 0.25 ? "rgba(34,197,94,0.25)" : r < 0.5 ? "rgba(34,197,94,0.45)" : r < 0.75 ? "rgba(34,197,94,0.70)" : "rgba(34,197,94,0.95)" }} />
                    ))}
                    <span style={{ fontSize: "10px", color: theme.subtext }}>Máx. cobertura</span>
                  </div>

                  <div style={{ overflowX: "auto" }}>
                    <table style={{ borderCollapse: "collapse", minWidth: "700px" }}>
                      <thead>
                        <tr>
                          <th style={{ padding: "6px 10px", fontSize: "10px", color: theme.subtext, fontWeight: "700", width: "40px" }}></th>
                          {HORAS.map(h => (
                            <th key={h} style={{ padding: "4px 2px", fontSize: "9px", color: theme.subtext, fontWeight: "700", textAlign: "center", width: "28px" }}>{String(h).padStart(2,"0")}h</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {ORDEM_DIAS.map((diaSem) => {
                          const dia = DIAS_LABELS[diaSem];
                          return (
                          <tr key={dia}>
                            <td style={{ padding: "3px 10px 3px 0", fontSize: "11px", color: theme.subtext, fontWeight: "700", whiteSpace: "nowrap" }}>{dia}</td>
                            {HORAS.map(hora => {
                              const val = heatmapSemanal[`${diaSem}_${hora}`] || 0;
                              const { desc } = formatarValor(val);
                              const funcionariosSet = heatmapFuncionarios[`${diaSem}_${hora}`];
                              const listaFuncs = funcionariosSet ? Array.from(funcionariosSet) : [];
                              const tooltipFuncs = listaFuncs.length > 0 
                                ? `\n\n🟢 Em serviço:\n${listaFuncs.map(f => `• ${f}`).join("\n")}` 
                                : "";

                              return (
                                <td key={hora} title={val ? `${desc}${tooltipFuncs}` : "Sem dados neste horário"}
                                  style={{
                                    width: "28px", height: "24px",
                                    background: cellColor(val),
                                    borderRadius: "4px",
                                    border: "1px solid rgba(255,255,255,0.04)",
                                    cursor: "default",
                                    transition: "transform 0.1s",
                                  }}
                                />
                              );
                            })}
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Horários mais e menos cobertos */}
                  {Object.keys(heatmapSemanal).length > 0 && (() => {
                    const sorted = Object.entries(heatmapSemanal).sort((a, b) => b[1] - a[1]);
                    const top3 = sorted.slice(0, 3);
                    const bot3 = sorted.slice(-3).reverse();
                    const labelSlot = (key) => {
                      const [d, h] = key.split("_");
                      return `${DIAS_LABELS[d]} ${String(h).padStart(2,"0")}h-${String(Number(h)+1).padStart(2,"0")}h`;
                    };
                    return (
                      <div style={{ display: "flex", gap: "16px", marginTop: "20px", flexWrap: "wrap" }}>
                        <div style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: "10px", padding: "12px 16px", minWidth: "200px" }}>
                          <div style={{ fontSize: "11px", fontWeight: "800", color: "#22c55e", marginBottom: "8px" }}>🟢 Horários mais movimentados</div>
                          {top3.map(([k, v]) => (
                            <div key={k} style={{ fontSize: "12px", color: theme.text, marginBottom: "4px" }}>
                              {labelSlot(k)} — <span style={{ color: "#22c55e", fontWeight: "700" }}>{formatarValor(v).desc}</span>
                            </div>
                          ))}
                        </div>
                        <div style={{ background: "rgba(250,204,21,0.06)", border: "1px solid rgba(250,204,21,0.2)", borderRadius: "10px", padding: "12px 16px", minWidth: "200px" }}>
                          <div style={{ fontSize: "11px", fontWeight: "800", color: "#facc15", marginBottom: "8px" }}>🟡 Horários menos cobertos (com qualquer dado)</div>
                          {bot3.map(([k, v]) => (
                            <div key={k} style={{ fontSize: "12px", color: theme.text, marginBottom: "4px" }}>
                              {labelSlot(k)} — <span style={{ color: "#facc15", fontWeight: "700" }}>{formatarValor(v).desc}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {coberturaVista === "calendario" && (
                <div>
                  <div style={{ marginBottom: "14px" }}>
                    <div style={{ fontSize: "13px", fontWeight: "700", color: theme.text, marginBottom: "4px" }}>📅 Calendário de Cobertura Diária</div>
                    <div style={{ fontSize: "11px", color: theme.subtext }}>Cada dia colorido pelo total de horas com ao menos 1 funcionário ativo.</div>
                  </div>

                  {/* Legenda */}
                  <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "16px" }}>
                    {[
                      { cor: "rgba(255,255,255,0.04)", label: "Sem dados" },
                      { cor: "rgba(34,197,94,0.2)",    label: "< 2h" },
                      { cor: "rgba(34,197,94,0.45)",   label: "2h-5h" },
                      { cor: "rgba(34,197,94,0.70)",   label: "5h-10h" },
                      { cor: "rgba(34,197,94,0.95)",   label: "10h+" },
                    ].map(({cor, label}) => (
                      <div key={label} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <div style={{ width: "14px", height: "14px", borderRadius: "3px", background: cor, border: "1px solid rgba(255,255,255,0.1)" }} />
                        <span style={{ fontSize: "10px", color: theme.subtext }}>{label}</span>
                      </div>
                    ))}
                  </div>

                  {Object.entries(meses).map(([mesKey, dias]) => {
                    const [ano, mes] = mesKey.split("-");
                    const nomeMes = new Date(Number(ano), Number(mes) - 1, 1)
                      .toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
                    // Primeiro dia da semana desse mês
                    const firstDow = new Date(Number(ano), Number(mes) - 1, 1).getDay();
                    const allCells = Array(firstDow).fill(null).concat(dias);

                    return (
                      <div key={mesKey} style={{ marginBottom: "24px" }}>
                        <div style={{ fontSize: "12px", fontWeight: "800", color: theme.text, marginBottom: "10px",
                          textTransform: "capitalize", letterSpacing: "0.5px" }}>
                          {nomeMes}
                        </div>
                        <div style={{ display: "flex", gap: "2px", marginBottom: "4px" }}>
                          {["D","S","T","Q","Q","S","S"].map((d, i) => (
                            <div key={i} style={{ width: "32px", fontSize: "9px", color: theme.subtext, fontWeight: "700", textAlign: "center" }}>{d}</div>
                          ))}
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "2px", maxWidth: `${7*34}px` }}>
                          {allCells.map((d, i) => {
                            if (!d) return <div key={`empty-${i}`} style={{ width: "32px", height: "32px" }} />;
                            const min = coberturaDia[d] || 0;
                            const horas = Math.floor(min / 60);
                            const mins  = Math.round(min % 60);
                            const dayNum = new Date(d + "T12:00:00").getDate();
                            const isToday = d === new Date().toLocaleDateString("en-CA");
                            const funcionariosSet = coberturaDiaFuncionarios[d];
                            const listaFuncs = funcionariosSet ? Array.from(funcionariosSet) : [];
                            const tooltipFuncs = listaFuncs.length > 0 
                               ? `\n\n🟢 Em serviço:\n${listaFuncs.map(f => `• ${f}`).join("\n")}` 
                               : "";

                            return (
                              <div key={d}
                                title={min ? `${d.split("-").reverse().join("/")}: ${horas}h${mins}min de cobertura${tooltipFuncs}` : `${d.split("-").reverse().join("/")}: sem registros`}
                                style={{
                                  width: "32px", height: "32px", borderRadius: "6px",
                                  background: calColor(min),
                                  border: isToday ? "2px solid #38bdf8" : "1px solid rgba(255,255,255,0.05)",
                                  display: "flex", flexDirection: "column",
                                  alignItems: "center", justifyContent: "center",
                                  cursor: "default",
                                  position: "relative",
                                }}
                              >
                                <span style={{ fontSize: "10px", color: min > 0 ? "#fff" : theme.subtext, fontWeight: min > 0 ? "700" : "400" }}>{dayNum}</span>
                                {min > 0 && <span style={{ fontSize: "8px", color: "rgba(255,255,255,0.75)", lineHeight: 1 }}>{horas}h</span>}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                  {Object.keys(meses).length === 0 && (
                    <div style={{ textAlign: "center", color: theme.subtext, opacity: 0.6, padding: "32px" }}>
                      <div style={{ fontSize: "28px", marginBottom: "8px" }}>📅</div>
                      Nenhum dado com saida registrada no período filtrado.
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}
      </div>
      </div>

          {/* ------ ABA CONCILIAÇÃO ------ */}
          {abaAtiva === "conciliacao" && (
            <ConciliacaoPage 
              theme={theme}
              styles={styles}
              registrosCidade={registrosCidade}
              registrosSite={registrosSite || []}
              listaFuncionarios={listaFuncionarios}
              atualizarPontoCidade={atualizarPontoCidade}
              darEstrelaPonto={darEstrelaPonto}
              buscarPontoCidade={() => aplicarFiltros()}
              buscarHistoricoPonto={buscarHistoricoPonto}
              clonarPontoCidadeParaSite={clonarPontoCidadeParaSite}
              apagarPonto={apagarPonto}
            />
          )}

          {/* ------ ABA BONIFICAÇÃO ------ */}
          {abaAtiva === "bonificacao" && (() => {
            const dataBonificacao = calcularAcumuladoBonificacao;
            const periodos = [
              { key: "manha", label: "Manhã", emoji: "🌅", horas: "06:00 às 12:00" },
              { key: "tarde", label: "Tarde", emoji: "☀️", horas: "12:00 às 18:00" },
              { key: "noite", label: "Noite", emoji: "🌙", horas: "18:00 às 00:00" },
              { key: "madrugada", label: "Madrugada", emoji: "🌑", horas: "00:00 às 06:00" },
            ];

            // Agrupa os ganhadores totais por ID de colaborador para fazer o resumo
            const resumoGanhadores = {};
            periodos.forEach(p => {
              const ganhadoresTurno = dataBonificacao.winners[p.key] || [];
              ganhadoresTurno.forEach(g => {
                const valorPremio = configBonificacao[p.key].premio;
                if (!resumoGanhadores[g.idJogo]) {
                  resumoGanhadores[g.idJogo] = {
                    nome: g.nome,
                    idJogo: g.idJogo,
                    totalPremio: 0,
                    categorias: []
                  };
                }
                resumoGanhadores[g.idJogo].totalPremio += valorPremio;
                resumoGanhadores[g.idJogo].categorias.push(`${p.emoji} ${p.label}`);
              });
            });

            const listaGanhadoresResumo = Object.values(resumoGanhadores).sort((a, b) => b.totalPremio - a.totalPremio);

            return (
              <div style={{ padding: "20px" }}>
                {/* FILTROS DE PERÍODO E BOTÃO DE CONFIGURAÇÕES */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", alignItems: "flex-end", marginBottom: "20px", background: "rgba(255,255,255,0.02)", padding: "16px", borderRadius: "12px", border: `1px solid ${theme.border}` }}>
                  
                  {/* Presets de período */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                    <label style={{ fontSize: "10px", color: theme.subtext, fontWeight: "700", textTransform: "uppercase" }}>Período de Análise</label>
                    <div style={{ display: "flex", gap: "5px", flexWrap: "wrap", alignItems: "center" }}>
                      {[
                        { val: "hoje",   label: "Hoje" },
                        { val: "semana", label: "Seg → Dom" },
                        { val: "mes",    label: "Mês" },
                        { val: "custom", label: "Custom" },
                      ].map(({ val, label }) => (
                        <button
                          key={val}
                          onClick={() => {
                            setFiltroPeriodo(val);
                            if (val === "semana") {
                              const agora = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
                              const defaultOffset = agora.getDay() === 0 ? 0 : -1;
                              setSemanaOffset(defaultOffset);
                              aplicarFiltros(undefined, val, defaultOffset);
                            } else if (val === "custom") {
                              const agora = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
                              const hoje = agora.toLocaleDateString("en-CA");
                              const tresMesesAtras = new Date(agora);
                              tresMesesAtras.setMonth(agora.getMonth() - 3);
                              const inicio = tresMesesAtras.toLocaleDateString("en-CA");
                              setFiltroDataInicio(inicio);
                              setFiltroDataFim(hoje);
                            } else {
                              aplicarFiltros(undefined, val);
                            }
                          }}
                          style={{
                            padding: "6px 12px", borderRadius: "8px", border: "none", cursor: "pointer",
                            fontSize: "12px", fontWeight: "700",
                            background: filtroPeriodo === val ? theme.accent : theme.card2,
                            color: filtroPeriodo === val ? "#fff" : theme.subtext,
                            transition: "all 0.15s",
                          }}
                        >{label}</button>
                      ))}

                      {/* Botão atalho: Semana Atual */}
                      {(filtroPeriodo !== "semana" || semanaOffset !== 0) && (
                        <button
                          onClick={() => {
                            setFiltroPeriodo("semana");
                            setSemanaOffset(0);
                            aplicarFiltros(undefined, "semana", 0);
                          }}
                          title="Ir para a semana atual (em andamento)"
                          style={{
                            padding: "6px 12px", borderRadius: "8px",
                            border: "1px solid rgba(56,189,248,0.4)",
                            cursor: "pointer", fontSize: "12px", fontWeight: "700",
                            background: "rgba(56,189,248,0.08)",
                            color: "#38bdf8",
                            transition: "all 0.15s",
                            whiteSpace: "nowrap",
                          }}
                        >📅 Semana Atual</button>
                      )}

                      {/* Navegação de semanas */}
                      {filtroPeriodo === "semana" && (() => {
                        const { inicio, fim } = calcularDatasPeriodo("semana", semanaOffset);
                        return (
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginLeft: "8px" }}>
                            <button
                              onClick={() => {
                                const novoOffset = semanaOffset - 1;
                                setSemanaOffset(novoOffset);
                                aplicarFiltros(undefined, "semana", novoOffset);
                              }}
                              title="Semana anterior"
                              style={{
                                background: theme.card2, border: `1px solid ${theme.border}`,
                                color: theme.text, width: "28px", height: "28px",
                                borderRadius: "7px", cursor: "pointer", fontSize: "14px",
                                display: "flex", alignItems: "center", justifyContent: "center",
                              }}
                            >←</button>

                            <div style={{
                              padding: "4px 10px", borderRadius: "8px",
                              background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.3)",
                              fontSize: "11px", fontWeight: "700", color: "#38bdf8",
                              whiteSpace: "nowrap",
                            }}>
                              {(() => {
                                const agora = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
                                const defaultOffset = agora.getDay() === 0 ? 0 : -1;
                                if (semanaOffset === defaultOffset) return "🗓 Última semana completa";
                                if (semanaOffset === 0) return "🗓 Semana atual";
                                if (semanaOffset === -1) return "🗓 Semana passada";
                                return `🗓 ${semanaOffset < 0 ? Math.abs(semanaOffset) + " sem. atrás" : semanaOffset + " sem. à frente"}`;
                              })()}
                              <span style={{ fontWeight: "400", marginLeft: "6px", color: theme.subtext }}>
                                {fmtBR(inicio)} – {fmtBR(fim)}
                              </span>
                            </div>

                            <button
                              onClick={() => {
                                const novoOffset = semanaOffset + 1;
                                setSemanaOffset(novoOffset);
                                aplicarFiltros(undefined, "semana", novoOffset);
                              }}
                              title="Semana seguinte"
                              disabled={semanaOffset >= 0}
                              style={{
                                background: theme.card2, border: `1px solid ${theme.border}`,
                                color: semanaOffset >= 0 ? theme.subtext : theme.text,
                                width: "28px", height: "28px",
                                borderRadius: "7px",
                                cursor: semanaOffset >= 0 ? "not-allowed" : "pointer",
                                fontSize: "14px", opacity: semanaOffset >= 0 ? 0.4 : 1,
                                display: "flex", alignItems: "center", justifyContent: "center",
                              }}
                            >→</button>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Datas custom */}
                  {filtroPeriodo === "custom" && (
                    <>
                      <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                        <label style={{ fontSize: "10px", color: theme.subtext, fontWeight: "700", textTransform: "uppercase" }}>De</label>
                        <input type="date" value={filtroDataInicio} onChange={(e) => setFiltroDataInicio(e.target.value)}
                          style={{ ...inputSmall, width: "145px", background: theme.card2, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: "8px", padding: "0 8px" }} />
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                        <label style={{ fontSize: "10px", color: theme.subtext, fontWeight: "700", textTransform: "uppercase" }}>Até</label>
                        <input type="date" value={filtroDataFim} onChange={(e) => setFiltroDataFim(e.target.value)}
                          style={{ ...inputSmall, width: "145px", background: theme.card2, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: "8px", padding: "0 8px" }} />
                      </div>
                      <button
                        onClick={() => aplicarFiltros()}
                        style={{
                          background: theme.accent, border: "none", color: "#fff",
                          padding: "6px 14px", borderRadius: "8px", cursor: "pointer",
                          fontSize: "12px", fontWeight: "700", height: "32px",
                        }}
                      >
                        Filtrar
                      </button>
                    </>
                  )}

                  {/* Botão de abrir/fechar config */}
                  <div style={{ marginLeft: "auto", display: "flex", gap: "10px" }}>
                    <button
                      onClick={() => setModalRelatorioExternoAberta(true)}
                      style={{
                        background: "rgba(56, 189, 248, 0.15)",
                        border: "1px solid rgba(56, 189, 248, 0.3)",
                        color: "#38bdf8",
                        padding: "7px 16px",
                        borderRadius: "10px",
                        cursor: "pointer",
                        fontSize: "13px",
                        fontWeight: "700",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        height: "34px",
                      }}
                    >
                      📄 Gerar Relatório Externo
                    </button>

                    <button
                      onClick={() => setConfigBonificacaoAberta(!configBonificacaoAberta)}
                      style={{
                        background: configBonificacaoAberta ? "rgba(180,13,13,0.15)" : theme.card2,
                        border: `1px solid ${configBonificacaoAberta ? "#b40d0d" : theme.border}`,
                        color: configBonificacaoAberta ? "#fff" : theme.text,
                        padding: "7px 16px",
                        borderRadius: "10px",
                        cursor: "pointer",
                        fontSize: "13px",
                        fontWeight: "700",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        height: "34px",
                      }}
                    >
                      ⚙️ {configBonificacaoAberta ? "Ocultar Ajustes" : "Ajustar Prêmios e Metas"}
                    </button>
                  </div>
                </div>

                {/* CONFIGURAÇÕES DO PRÊMIO E HORAS MÍNIMAS */}
                {configBonificacaoAberta && (
                  <div style={{ marginBottom: "24px" }}>
                    <div style={{ ...styles.cardHeader, marginBottom: "12px" }}>
                      ⚙️ Configurações da Bonificação Semanal
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
                      {periodos.map(p => {
                        const cfg = configBonificacao[p.key];
                        return (
                          <div key={p.key} style={{ background: theme.card2, border: `1px solid ${theme.border}`, padding: "14px", borderRadius: "10px" }}>
                            <div style={{ fontSize: "14px", fontWeight: "800", color: theme.text, display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px" }}>
                              <span>{p.emoji}</span>
                              <span>{p.label}</span>
                              <span style={{ fontSize: "10px", color: theme.subtext, fontWeight: "normal" }}>({p.horas})</span>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                              <div>
                                <label style={{ fontSize: "11px", color: theme.subtext, fontWeight: "700", display: "block", marginBottom: "3px" }}>Premiação ($)</label>
                                <input
                                  type="number"
                                  value={cfg.premio}
                                  onChange={(e) => {
                                    const val = Number(e.target.value);
                                    salvarConfigBonificacao({
                                      ...configBonificacao,
                                      [p.key]: { ...cfg, premio: val }
                                    });
                                  }}
                                  style={{ ...styles.input, width: "100%", height: "32px", fontSize: "13px" }}
                                />
                              </div>
                              <div>
                                <label style={{ fontSize: "11px", color: theme.subtext, fontWeight: "700", display: "block", marginBottom: "3px" }}>Min. Horas</label>
                                <input
                                  type="number"
                                  value={cfg.horasMinimas}
                                  onChange={(e) => {
                                    const val = Number(e.target.value);
                                    salvarConfigBonificacao({
                                      ...configBonificacao,
                                      [p.key]: { ...cfg, horasMinimas: val }
                                    });
                                  }}
                                  style={{ ...styles.input, width: "100%", height: "32px", fontSize: "13px" }}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* PAINEL DE VENCEDORES */}
                <div style={{ ...styles.cardHeader, marginBottom: "12px" }}>
                  🏆 Resumo de Vencedores da Semana
                </div>
                {listaGanhadoresResumo.length === 0 ? (
                  <div style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${theme.border}`, padding: "24px", borderRadius: "10px", textAlign: "center", color: theme.subtext, marginBottom: "24px" }}>
                    <span style={{ fontSize: "24px", display: "block", marginBottom: "8px" }}>🤷‍♂️</span>
                    Nenhum colaborador atingiu a meta de 10 horas em nenhum período até o momento.
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px", marginBottom: "24px" }}>
                    {listaGanhadoresResumo.map(g => (
                      <div key={g.idJogo} style={{ background: "rgba(22,163,74,0.05)", border: "1px solid rgba(22,163,74,0.25)", padding: "16px", borderRadius: "12px", display: "flex", gap: "12px", alignItems: "center" }}>
                        <div style={{ width: "42px", height: "42px", borderRadius: "50%", background: "linear-gradient(135deg, #15803d, #22c55e)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px" }}>
                          👑
                        </div>
                        <div>
                          <div style={{ fontWeight: "800", fontSize: "15px", color: theme.text }}>{g.nome}</div>
                          <div style={{ fontSize: "11px", color: theme.subtext, marginTop: "2px" }}>ID: #{g.idJogo}</div>
                          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "4px" }}>
                            {g.categorias.map((cat, i) => (
                              <span key={i} style={{ background: "rgba(255,255,255,0.06)", padding: "2px 6px", borderRadius: "4px", fontSize: "9px", color: theme.text, fontWeight: "700" }}>{cat}</span>
                            ))}
                          </div>
                          <div style={{ fontSize: "14px", fontWeight: "800", color: "#22c55e", marginTop: "6px" }}>
                            Prêmio total: {formatarDinheiro(g.totalPremio)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* LISTAGEM DE CLASSIFICAÇÃO / RANKING POR TURNO */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: "16px" }}>
                  {periodos.map(p => {
                    const ranking = dataBonificacao.rankings[p.key] || [];
                    const winners = dataBonificacao.winners[p.key] || [];
                    const limitMinutos = configBonificacao[p.key].horasMinimas * 60;
                    const totalMinsPeriodo = ranking.reduce((sum, colab) => {
                      const func = listaFuncionarios.find(f => String(f.id) === String(colab.idJogo));
                      const colabIsDono = func?.role ? (func.role.split('|')[0] === 'dono' || func.role.split('|').includes('dono_secundario')) : false;
                      if (excluirDonos && colabIsDono) return sum;
                      return sum + (colab[p.key] || 0);
                    }, 0);

                    return (
                      <div key={p.key} style={{ background: "rgba(255,255,255,0.01)", border: `1px solid ${theme.border}`, padding: "16px", borderRadius: "12px" }}>
                        <div style={{ borderBottom: `1px solid ${theme.border}`, paddingBottom: "10px", marginBottom: "12px" }}>
                          <div style={{ fontSize: "15px", fontWeight: "800", color: theme.text, display: "flex", alignItems: "center", gap: "6px" }}>
                            <span>{p.emoji}</span>
                            <span>{p.label}</span>
                          </div>
                          <div style={{ fontSize: "11px", color: theme.subtext, marginTop: "2px" }}>
                            Meta: {configBonificacao[p.key].horasMinimas}h · Prêmio: {formatarDinheiro(configBonificacao[p.key].premio)} · Total: {formatarMinutos(totalMinsPeriodo)}
                          </div>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                          {ranking.length === 0 ? (
                            <div style={{ fontSize: "12px", color: theme.subtext, opacity: 0.6, padding: "12px 0", textAlign: "center" }}>
                              Nenhum registro.
                            </div>
                          ) : (
                            ranking.map((colab, idx) => {
                              const totalMins = colab[p.key] || 0;
                              const isWinner = winners.some(w => w.idJogo === colab.idJogo);
                              const atingiuMeta = totalMins >= limitMinutos;
                              const pct = Math.min(100, (totalMins / (limitMinutos || 1)) * 100);

                              const func = listaFuncionarios.find(f => String(f.id) === String(colab.idJogo));
                              const colabIsDono = func?.role ? (func.role.split('|')[0] === 'dono' || func.role.split('|').includes('dono_secundario')) : false;
                              const deveApagarCard = excluirDonos && colabIsDono;

                              return (
                                <div key={colab.idJogo} style={{ background: isWinner ? "rgba(22,163,74,0.06)" : "transparent", border: isWinner ? "1px solid rgba(22,163,74,0.2)" : "1px solid transparent", borderRadius: "8px", padding: "8px 10px", opacity: deveApagarCard ? 0.4 : 1, transition: "opacity 0.2s ease" }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "4px" }}>
                                    <div style={{ maxWidth: "70%" }}>
                                      <div style={{ fontWeight: "700", fontSize: "12px", color: theme.text, display: "flex", alignItems: "center", gap: "4px" }}>
                                        {isWinner && <span title="Vencedor do período">🏆</span>}
                                        <span style={{ textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>{colab.nome}</span>
                                      </div>
                                      <div style={{ fontSize: "10px", color: theme.subtext }}>ID: #{colab.idJogo}</div>
                                    </div>
                                    <div style={{ textAlign: "right" }}>
                                      <div style={{ fontSize: "12px", fontWeight: "800", color: isWinner ? "#22c55e" : theme.text }}>
                                        {formatarMinutos(totalMins)}
                                      </div>
                                      {atingiuMeta ? (
                                        <span style={{ fontSize: "8px", background: "rgba(34,197,94,0.2)", color: "#22c55e", padding: "1px 4px", borderRadius: "3px", fontWeight: "800" }}>META OK</span>
                                      ) : (
                                        <span style={{ fontSize: "8px", background: "rgba(239,68,68,0.1)", color: "#ef4444", padding: "1px 4px", borderRadius: "3px", fontWeight: "800" }}>PENDENTE</span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Barra de Progresso */}
                                  <div style={{ width: "100%", height: "4px", background: "rgba(255,255,255,0.05)", borderRadius: "2px", overflow: "hidden" }}>
                                    <div style={{
                                      width: `${pct}%`,
                                      height: "100%",
                                      background: atingiuMeta ? "linear-gradient(90deg, #16a34a, #22c55e)" : "linear-gradient(90deg, #b40d0d, #ef4444)",
                                      transition: "width 0.3s ease"
                                    }} />
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* LINHA DO TEMPO DE COBERTURA INTEGRADA */}
                <div style={{ ...styles.cardHeader, marginTop: "32px", marginBottom: "12px" }}>
                  📅 Linha do Tempo de Cobertura no Período (Funcionários Ativos)
                </div>
                <div style={{ ...styles.whiteCard, padding: "20px", overflowX: "auto", marginBottom: "20px" }}>
                  <div style={{ minWidth: "980px" }}>
                    
                    {/* Linha de Horas do Topo */}
                    <div style={{ display: "flex", alignItems: "center", marginBottom: "12px" }}>
                      <div style={{ width: "120px", flexShrink: 0, fontWeight: "800", fontSize: "11px", color: theme.subtext, textTransform: "uppercase" }}>
                        Dia da Semana
                      </div>
                      <div style={{ display: "flex", flex: 1, gap: "2px" }}>
                        <div style={{ flex: "12 1 0%", borderLeft: `1px solid ${theme.border}44`, borderRight: `1px solid ${theme.border}44`, background: "rgba(168,85,247,0.03)", padding: "4px 2px", textAlign: "center", fontSize: "10px", fontWeight: "800", color: "#a855f7", marginRight: "8px", borderRadius: "4px" }}>
                          🌑 Madrugada (00h-06h)
                        </div>
                        <div style={{ flex: "12 1 0%", borderLeft: `1px solid ${theme.border}44`, borderRight: `1px solid ${theme.border}44`, background: "rgba(251,191,36,0.03)", padding: "4px 2px", textAlign: "center", fontSize: "10px", fontWeight: "800", color: "#fbbf24", marginRight: "8px", borderRadius: "4px" }}>
                          🌅 Manhã (06h-12h)
                        </div>
                        <div style={{ flex: "12 1 0%", borderLeft: `1px solid ${theme.border}44`, borderRight: `1px solid ${theme.border}44`, background: "rgba(249,115,22,0.03)", padding: "4px 2px", textAlign: "center", fontSize: "10px", fontWeight: "800", color: "#f97316", marginRight: "8px", borderRadius: "4px" }}>
                          ☀️ Tarde (12h-18h)
                        </div>
                        <div style={{ flex: "12 1 0%", borderLeft: `1px solid ${theme.border}44`, borderRight: `1px solid ${theme.border}44`, background: "rgba(59,130,246,0.03)", padding: "4px 2px", textAlign: "center", fontSize: "10px", fontWeight: "800", color: "#3b82f6", borderRadius: "4px" }}>
                          🌙 Noite (18h-00h)
                        </div>
                      </div>
                    </div>

                    {/* Cada dia do período */}
                    {diasPeriodoBonificacao.map(dia => {
                      const dataObj = new Date(`${dia}T12:00:00`);
                      const diaSemana = dataObj.toLocaleDateString("pt-BR", { weekday: "short" });
                      const slots = slotsCoberturaBonificacao[dia] || [];
                      const [ano, mes, diaNum] = dia.split("-");

                      return (
                        <div key={dia} style={{ display: "flex", alignItems: "center", marginBottom: "8px" }}>
                          {/* Nome do dia */}
                          <div style={{ width: "120px", flexShrink: 0, fontWeight: "700", fontSize: "12px", color: theme.text }}>
                            <span style={{ textTransform: "capitalize", fontWeight: "800" }}>{diaSemana.replace(".", "")}</span>
                            <span style={{ color: theme.subtext, marginLeft: "4px", fontSize: "11px" }}>({diaNum}/{mes})</span>
                          </div>

                          {/* Blocos horizontais */}
                          <div style={{ display: "flex", flex: 1, gap: "2px" }}>
                            {slots.map((slot, idx) => {
                              const tooltipText = `${slot.label}\n${slot.coberto ? `🟢 Coberto por:\n${slot.funcionarios.map(f => `• ${f.nome}`).join("\n")}` : "🔴 Sem cobertura"}`;
                              
                              let emptyColor = "";
                              let emptyBorder = "";
                              if (idx < 12) {
                                emptyColor = "rgba(168,85,247,0.03)";
                                emptyBorder = "rgba(168,85,247,0.15)";
                              } else if (idx < 24) {
                                emptyColor = "rgba(251,191,36,0.03)";
                                emptyBorder = "rgba(251,191,36,0.15)";
                              } else if (idx < 36) {
                                emptyColor = "rgba(249,115,22,0.03)";
                                emptyBorder = "rgba(249,115,22,0.15)";
                              } else {
                                emptyColor = "rgba(59,130,246,0.03)";
                                emptyBorder = "rgba(59,130,246,0.15)";
                              }

                              const isLastOfShift = idx === 11 || idx === 23 || idx === 35;
                              const marginRight = isLastOfShift ? "8px" : "0px";

                              return (
                                <div
                                  key={idx}
                                  title={tooltipText}
                                  style={{
                                    height: "30px",
                                    borderRadius: "5px",
                                    flex: "1 1 0%",
                                    background: slot.coberto ? "#1b5e20" : emptyColor,
                                    border: `1px solid ${slot.coberto ? "rgba(34, 197, 94, 0.3)" : emptyBorder}`,
                                    cursor: "pointer",
                                    position: "relative",
                                    marginRight: marginRight,
                                    transition: "transform 0.1s ease, box-shadow 0.1s ease"
                                  }}
                                  onMouseEnter={e => {
                                    e.currentTarget.style.transform = "scale(1.18)";
                                    e.currentTarget.style.zIndex = 10;
                                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.25)";
                                  }}
                                  onMouseLeave={e => {
                                    e.currentTarget.style.transform = "scale(1)";
                                    e.currentTarget.style.zIndex = 1;
                                    e.currentTarget.style.boxShadow = "none";
                                  }}
                                />
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })()}


          {/* ------ ABA AUDITORIA DE BAÚ ------ */}
          {abaAtiva === "auditoria" && (() => {
            const periodosLabels = {
              hoje: "Hoje",
              semana: "Seg → Dom",
              mes: "Mês",
              custom: "Customizado"
            };

            const formatarDiscordWarn = (alerta) => {
              const { ponto, logs, duracaoMin } = alerta;
              const dataFormatada = new Date(ponto.entrada).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
              const horaEntrada = new Date(ponto.entrada).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "America/Sao_Paulo" });
              const horaSaida = new Date(ponto.saida).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "America/Sao_Paulo" });
              
              let listItens = logs.map(l => `• ${l.qtd}x ${l.item} (${l.tipoLog === 'bau' ? `Baú: ${l.bauId || 'Geral'}` : 'Bancada'}) às ${new Date(l.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "America/Sao_Paulo" })}`).join("\n");
              
              return `⚠️ **ADVERTÊNCIA DE SERVIÇO** ⚠️\n` +
                     `**Funcionário:** ${ponto.nome} [ID: ${ponto.id_jogo}]\n` +
                     `**Infração:** Entrou em serviço e saiu em menos de 30 minutos (limite da auditoria: ${tempoLimiteAuditoria}min) realizando retiradas/compras.\n\n` +
                     `📅 **Data:** ${dataFormatada}\n` +
                     `⏱️ **Tempo em serviço:** ${duracaoMin}min (Entrada: ${horaEntrada} | Saída: ${horaSaida})\n` +
                     `📦 **Atividades detectadas:**\n${listItens}\n\n` +
                     `*Atenção: É obrigatório cumprir o tempo mínimo de serviço de 30 minutos ao entrar.*`;
            };

            const handleCopiarAdvertencia = (alerta) => {
              const texto = formatarDiscordWarn(alerta);
              navigator.clipboard.writeText(texto)
                .then(() => alert("✅ Advertência copiada para a área de transferência!"))
                .catch(() => alert("❌ Erro ao copiar advertência."));
            };

            // Cálculo das estatísticas da auditoria
            const totalSuspeitos = auditoriaAlertas.length;
            const totalItensRetirados = auditoriaAlertas.reduce((acc, a) => acc + a.logs.length, 0);

            return (
              <div style={{ padding: "20px" }}>
                {/* CONFIGURAÇÃO DA AUDITORIA */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", alignItems: "flex-end", marginBottom: "20px", background: "rgba(255,255,255,0.02)", padding: "16px", borderRadius: "12px", border: `1px solid ${theme.border}` }}>
                  
                  {/* Tempo limite slider */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: "1 1 240px" }}>
                    <label style={{ fontSize: "11px", color: theme.subtext, fontWeight: "700", textTransform: "uppercase", display: "flex", justifyContent: "space-between" }}>
                      <span>Duração Máxima do Ponto:</span>
                      <span style={{ color: theme.accent, fontWeight: "800" }}>{tempoLimiteAuditoria} minutos</span>
                    </label>
                    <input 
                      type="range" 
                      min="5" 
                      max="30" 
                      value={tempoLimiteAuditoria} 
                      onChange={(e) => setTempoLimiteAuditoria(Number(e.target.value))}
                      style={{ width: "100%", accentColor: theme.accent, cursor: "pointer" }}
                    />
                  </div>

                  {/* Filtro por Mecânica */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "3px", width: "180px" }}>
                    <label style={{ fontSize: "10px", color: theme.subtext, fontWeight: "700", textTransform: "uppercase" }}>Filtrar por Mecânica</label>
                    <select 
                      value={filtroMecanicaAuditoria} 
                      onChange={(e) => setFiltroMecanicaAuditoria(e.target.value)}
                      style={{ ...inputSmall, width: "100%", background: theme.card2, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: "8px", height: "34px" }}
                    >
                      <option value="todas">⚙️ Todas as Mecânicas</option>
                      <option value="reds">🔴 Reds Tunnershop</option>
                      <option value="harmony">🟣 Harmony</option>
                      <option value="dudark">🟠 Dudark</option>
                    </select>
                  </div>

                  {/* Período de Análise */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                    <label style={{ fontSize: "10px", color: theme.subtext, fontWeight: "700", textTransform: "uppercase" }}>Período selecionado</label>
                    <div style={{ display: "flex", gap: "5px", flexWrap: "wrap", alignItems: "center" }}>
                      {[
                        { val: "hoje",   label: "Hoje" },
                        { val: "semana", label: "Semana" },
                        { val: "mes",    label: "Mês" },
                        { val: "custom", label: "Custom" },
                      ].map(({ val, label }) => (
                        <button
                          key={val}
                          onClick={() => {
                            setFiltroPeriodo(val);
                            if (val === "semana") {
                              const agora = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
                              const defaultOffset = agora.getDay() === 0 ? 0 : -1;
                              setSemanaOffset(defaultOffset);
                              aplicarFiltros(undefined, val, defaultOffset);
                            } else if (val === "custom") {
                              const agora = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
                              const hoje = agora.toLocaleDateString("en-CA");
                              const seteDiasAtras = new Date(agora);
                              seteDiasAtras.setDate(agora.getDate() - 7);
                              const inicio = seteDiasAtras.toLocaleDateString("en-CA");
                              setFiltroDataInicio(inicio);
                              setFiltroDataFim(hoje);
                            } else {
                              aplicarFiltros(undefined, val);
                            }
                          }}
                          style={{
                            padding: "6px 12px", borderRadius: "8px", border: "none", cursor: "pointer",
                            fontSize: "12px", fontWeight: "700",
                            background: filtroPeriodo === val ? theme.accent : theme.card2,
                            color: filtroPeriodo === val ? "#fff" : theme.subtext,
                            transition: "all 0.15s",
                            height: "34px"
                          }}
                        >{label}</button>
                      ))}

                      {filtroPeriodo === "semana" && (
                        <div style={{ display: "flex", gap: "4px" }}>
                          <button
                            onClick={() => {
                              const n = semanaOffset - 1;
                              setSemanaOffset(n);
                              aplicarFiltros(undefined, "semana", n);
                            }}
                            style={{ background: theme.card2, color: theme.text, border: `1px solid ${theme.border}`, width: "30px", height: "34px", borderRadius: "8px", cursor: "pointer" }}
                          >←</button>
                          <button
                            onClick={() => {
                              const n = semanaOffset + 1;
                              setSemanaOffset(n);
                              aplicarFiltros(undefined, "semana", n);
                            }}
                            disabled={semanaOffset >= 0}
                            style={{ background: theme.card2, color: theme.text, border: `1px solid ${theme.border}`, width: "30px", height: "34px", borderRadius: "8px", cursor: semanaOffset >= 0 ? "not-allowed" : "pointer", opacity: semanaOffset >= 0 ? 0.4 : 1 }}
                          >→</button>
                        </div>
                      )}

                      {filtroPeriodo === "custom" && (
                        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                          <input
                            type="date"
                            value={filtroDataInicio}
                            onChange={(e) => setFiltroDataInicio(e.target.value)}
                            style={{ ...inputSmall, width: "135px", background: theme.card2, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: "8px", padding: "0 8px" }}
                          />
                          <span style={{ color: theme.subtext, fontSize: "12px" }}>até</span>
                          <input
                            type="date"
                            value={filtroDataFim}
                            onChange={(e) => setFiltroDataFim(e.target.value)}
                            style={{ ...inputSmall, width: "135px", background: theme.card2, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: "8px", padding: "0 8px" }}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Ocultar Toleráveis Checkbox */}
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", height: "34px", paddingBottom: "2px" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "12px", color: theme.text, fontWeight: "600" }}>
                      <input 
                        type="checkbox" 
                        checked={ocultarReleveisAuditoria} 
                        onChange={(e) => setOcultarReleveisAuditoria(e.target.checked)}
                        style={{ width: "16px", height: "16px", accentColor: theme.accent, cursor: "pointer" }}
                      />
                      Ocultar Toleráveis (Crashes)
                    </label>
                  </div>

                  {/* Botão Atualizar/Recarregar */}
                  <button
                    onClick={executarAuditoria}
                    disabled={auditoriaCarregando}
                    style={{
                      background: "linear-gradient(135deg, #b40d0d, #ef4444)",
                      color: "#fff", border: "none", padding: "0 18px", borderRadius: "10px",
                      fontWeight: "700", fontSize: "13px", height: "34px", cursor: "pointer",
                      display: "flex", alignItems: "center", gap: "6px", marginLeft: "auto"
                    }}
                  >
                    🔄 {auditoriaCarregando ? "Carregando..." : "Atualizar"}
                  </button>
                </div>

                {/* ESTATÍSTICAS DA AUDITORIA */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px", marginBottom: "20px" }}>
                  {[
                    { label: "Casos Suspeitos", valor: totalSuspeitos, cor: "#ef4444", emoji: "🚨" },
                    { label: "Retiradas / Compras Suspeitas", valor: totalItensRetirados, cor: "#fbbf24", emoji: "📦" },
                    { label: "Mecânica Selecionada", valor: filtroMecanicaAuditoria === "todas" ? "Todas" : filtroMecanicaAuditoria.toUpperCase(), cor: "#38bdf8", emoji: "⚙️" },
                  ].map(({ label, valor, cor, emoji }) => (
                    <div key={label} style={{ ...styles.whiteCard, padding: "14px 18px", borderLeft: `3px solid ${cor}`, textAlign: "center" }}>
                      <div style={{ fontSize: "20px" }}>{emoji}</div>
                      <div style={{ fontSize: "22px", fontWeight: "800", color: cor, marginTop: "4px" }}>{valor}</div>
                      <div style={{ fontSize: "11px", color: theme.subtext, fontWeight: "600", marginTop: "2px" }}>{label}</div>
                    </div>
                  ))}
                </div>

                {/* RELATÓRIO / RESULTADOS */}
                <div style={{ ...styles.whiteCard, padding: "0", overflow: "hidden" }}>
                  <div style={{ padding: "16px 20px", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: "14px", fontWeight: "800", color: theme.text }}>
                      🚨 Ocorrências de Entrada e Saída Rápidas com Retirada
                    </div>
                    <span style={{ fontSize: "11px", color: theme.subtext }}>
                      Período: {fmtBR(calcularDatasPeriodo(filtroPeriodo, semanaOffset).inicio)} a {fmtBR(calcularDatasPeriodo(filtroPeriodo, semanaOffset).fim)}
                    </span>
                  </div>
                  {auditoriaCarregando ? (
                    <div style={{ padding: "40px", textAlign: "center", color: theme.subtext }}>
                      ⏳ Consultando banco de dados e cruzando logs...
                    </div>
                  ) : (
                    auditoriaAlertas.filter(a => !(ocultarReleveisAuditoria && a.sessoesProximas && a.sessoesProximas.length > 0)).length === 0 ? (
                      <div style={{ padding: "40px", textAlign: "center", color: theme.subtext, opacity: 0.7 }}>
                        <div style={{ fontSize: "36px", marginBottom: "8px" }}>✅</div>
                        Nenhuma infração detectada para os filtros e período selecionados.
                      </div>
                    ) : (
                      <div style={{ overflowX: "auto" }}>

                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                        <thead>
                          <tr style={{ background: theme.card2 }}>
                            {["Funcionário", "Mecânica", "Serviço (Entrada → Saída)", "Duração", "Itens Retirados / Compras Realizadas", "Ações"].map(col => (
                              <th key={col} style={{ padding: "10px 14px", textAlign: "left", color: theme.subtext, fontWeight: "700", fontSize: "11px", textTransform: "uppercase", borderBottom: `1px solid ${theme.border}` }}>{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {auditoriaAlertas
                            .filter(alerta => !(ocultarReleveisAuditoria && alerta.sessoesProximas && alerta.sessoesProximas.length > 0))
                            .map((alerta, i) => {
                              const { ponto, logs, duracaoMin } = alerta;
                              const temSessaoLongaProxima = alerta.sessoesProximas && alerta.sessoesProximas.length > 0;
                              return (
                                <tr key={i} style={{ background: i % 2 === 0 ? "transparent" : `${theme.card2}55`, borderBottom: `1px solid ${theme.border}44` }}>
                                  {/* FUNCIONÁRIO */}
                                  <td style={{ padding: "12px 14px" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                                      <span style={{ fontWeight: "700", color: theme.text }}>{ponto.nome}</span>
                                      {temSessaoLongaProxima && (
                                        <span style={{
                                          fontSize: "9px",
                                          fontWeight: "800",
                                          background: "rgba(56,189,248,0.15)",
                                          color: "#38bdf8",
                                          padding: "2px 6px",
                                          borderRadius: "4px",
                                          border: "1px solid rgba(56,189,248,0.3)"
                                        }} title="Possui sessão de serviço >= 30 minutos nas últimas 24 horas (provável crash ou tolerância)">
                                          Tolerável (Crash?)
                                        </span>
                                      )}
                                    </div>
                                    <div style={{ fontSize: "11px", color: theme.subtext }}>ID Jogo: #{ponto.id_jogo}</div>
                                  </td>

                                  {/* MECÂNICA */}
                                  <td style={{ padding: "12px 14px" }}>
                                  <span style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    padding: "2px 8px",
                                    borderRadius: "12px",
                                    fontSize: "10px",
                                    fontWeight: "800",
                                    background: (ponto.mechanic_id === "harmony" ? "#a855f7" : ponto.mechanic_id === "dudark" ? "#f97316" : "#ef4444") + "22",
                                    color: ponto.mechanic_id === "harmony" ? "#a855f7" : ponto.mechanic_id === "dudark" ? "#f97316" : "#ef4444",
                                    border: `1px solid ${ponto.mechanic_id === "harmony" ? "#a855f7" : ponto.mechanic_id === "dudark" ? "#f97316" : "#ef4444"}55`
                                  }}>
                                    ⚙️ {ponto.mec}
                                  </span>
                                </td>

                                  {/* SERVIÇO */}
                                 <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                                   <div style={{ fontSize: "12px" }}>
                                     <span style={{ color: "#22c55e", fontWeight: "700" }}>▶ {new Date(ponto.entrada).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "America/Sao_Paulo" })}</span>
                                     <span style={{ color: theme.subtext, margin: "0 6px" }}>→</span>
                                     {ponto.saida ? (
                                       <span style={{ color: "#ef4444", fontWeight: "700" }}>⏹ {new Date(ponto.saida).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "America/Sao_Paulo" })}</span>
                                     ) : (
                                       <span style={{ background: "rgba(250,204,21,0.15)", color: "#facc15", padding: "1px 6px", borderRadius: "4px", fontSize: "11px", fontWeight: "700" }}>🔓 Aberto</span>
                                     )}
                                   </div>
                                   <div style={{ fontSize: "11px", color: theme.subtext, marginTop: "2px" }}>
                                     📅 {new Date(ponto.entrada).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                                   </div>
                                 </td>

                                 {/* DURAÇÃO */}
                                 <td style={{ padding: "12px 14px" }}>
                                   {ponto.saida ? (
                                     <span style={{ color: "#ef4444", fontWeight: "800" }}>
                                       ⏱️ {duracaoMin} min
                                     </span>
                                   ) : (
                                     <span style={{ color: "#facc15", fontWeight: "800" }}>
                                       Aberto
                                     </span>
                                   )}
                                 </td>

                                  {/* ITENS RETIRADOS */}
                                  <td style={{ padding: "12px 14px" }}>
                                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                      {logs.map((log, lIdx) => (
                                        <div key={lIdx} style={{ fontSize: "12px", background: theme.card2, padding: "4px 8px", borderRadius: "6px", border: `1px solid ${theme.border}55` }}>
                                          <span style={{ fontWeight: "800", color: theme.accent }}>{log.qtd}x</span> {log.item} 
                                          <span style={{ color: theme.subtext, fontSize: "10px", marginLeft: "6px" }}>
                                            ({log.tipoLog === 'bau' ? `📦 Baú: ${log.bauId}` : '🛠️ Bancada'}) às {new Date(log.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "America/Sao_Paulo" })}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                    {alerta.sessoesProximas && alerta.sessoesProximas.length > 0 && (
                                      <div style={{ marginTop: "8px", background: "rgba(56,189,248,0.06)", border: "1px solid rgba(56,189,248,0.2)", borderRadius: "8px", padding: "8px 12px" }}>
                                        <div style={{ fontSize: "10px", fontWeight: "800", color: "#38bdf8", textTransform: "uppercase", marginBottom: "4px" }}>
                                          ℹ️ Sessão Longa Próxima Encontrada (Possível Crash):
                                        </div>
                                        {alerta.sessoesProximas.map((s, sIdx) => {
                                          const dtEntrada = new Date(s.entrada);
                                          const dtSaida = new Date(s.saida);
                                          const dia = String(dtEntrada.getDate()).padStart(2, '0');
                                          const mes = String(dtEntrada.getMonth() + 1).padStart(2, '0');
                                          const horaEntrada = dtEntrada.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
                                          const horaSaida = dtSaida.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
                                          
                                          return (
                                            <div key={sIdx} style={{ fontSize: "11px", color: theme.subtext, marginTop: "2px" }}>
                                              • 📅 {dia}/{mes} - {horaEntrada} às {horaSaida} — Duração: <b>{s.duracaoStr}</b> ({s.mec})
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </td>



                                {/* AÇÕES */}
                                <td style={{ padding: "12px 14px" }}>
                                  <button
                                    onClick={() => handleCopiarAdvertencia(alerta)}
                                    style={{
                                      background: "rgba(56,189,248,0.15)",
                                      border: "1px solid #38bdf8",
                                      color: "#38bdf8",
                                      padding: "6px 12px",
                                      borderRadius: "8px",
                                      cursor: "pointer",
                                      fontWeight: "700",
                                      fontSize: "12px",
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "4px"
                                    }}
                                  >
                                    💬 Copiar Advertência
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    )
                  )}

                </div>
              </div>
            );
          })()}



      {/* ===== SEÇÃO DE REGISTROS OCULTOS ===== */}
      <div style={{ marginTop: "16px" }}>
        <button
          onClick={toggleMostrarOcultos}
          style={{
            background: "transparent",
            border: `1px solid ${theme.border}`,
            color: theme.subtext,
            padding: "8px 16px", borderRadius: "10px",
            cursor: "pointer", fontSize: "12px", fontWeight: "600",
            display: "flex", alignItems: "center", gap: "8px",
          }}
        >
          <span>{mostrarOcultos ? "👁 Esconder" : "👁️ Ver"} registros ocultos</span>
          {registrosOcultos.length > 0 && (
            <span style={{ background: "rgba(249,115,22,0.2)", color: "#f97316", padding: "1px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: "800" }}>
              {registrosOcultos.length}
            </span>
          )}
        </button>

        {mostrarOcultos && (
          <div style={{ ...cardStyle, padding: "0", overflow: "hidden", marginTop: "10px", borderLeft: "3px solid #f97316" }}>
            <div style={{ padding: "12px 16px", borderBottom: `1px solid ${theme.border}`, fontSize: "13px", fontWeight: "700", color: "#f97316" }}>
              🚫 Registros Ocultos — apenas visíveis para administradores
            </div>
            {registrosOcultosCarregando ? (
              <div style={{ padding: "24px", textAlign: "center", color: theme.subtext }}>⏳ Carregando...</div>
            ) : registrosOcultos.length === 0 ? (
              <div style={{ padding: "24px", textAlign: "center", color: theme.subtext, opacity: 0.6 }}>Nenhum registro oculto.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                  <thead>
                    <tr style={{ background: theme.card2 }}>
                      {["Funcionário", "Entrada", "Saída", "Justificativa", "Oculto em", "Ação"].map(col => (
                        <th key={col} style={{ padding: "8px 12px", textAlign: "left", color: theme.subtext, fontWeight: "700", fontSize: "10px", textTransform: "uppercase", borderBottom: `1px solid ${theme.border}` }}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {registrosOcultos.map((reg, i) => (
                      <tr key={reg.id} style={{ background: i % 2 === 0 ? "transparent" : `${theme.card2}55`, borderBottom: `1px solid ${theme.border}55` }}>
                        <td style={{ padding: "8px 12px", color: theme.text, fontWeight: "600" }}>
                          <div>{reg.nome}</div>
                          {reg.nome_personagem && reg.nome_personagem !== reg.nome && (
                            <div style={{ fontSize: "10px", color: theme.subtext }}>{reg.nome_personagem}</div>
                          )}
                        </td>
                        <td style={{ padding: "8px 12px", color: "#22c55e", fontWeight: "700", whiteSpace: "nowrap" }}>
                          {reg.entrada ? new Date(reg.entrada).toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" }) : "—"}
                        </td>
                        <td style={{ padding: "8px 12px", color: reg.saida ? "#ef4444" : theme.subtext, fontWeight: "700", whiteSpace: "nowrap" }}>
                          {reg.saida ? new Date(reg.saida).toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" }) : "—"}
                        </td>
                        <td style={{ padding: "8px 12px", color: theme.subtext, fontStyle: reg.justificativa_ocultamento ? "normal" : "italic" }}>
                          {reg.justificativa_ocultamento || "Sem justificativa"}
                        </td>
                        <td style={{ padding: "8px 12px", color: theme.subtext, whiteSpace: "nowrap", fontSize: "11px" }}>
                          {reg.oculto_em ? new Date(reg.oculto_em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }) : "—"}
                        </td>
                        <td style={{ padding: "8px 12px" }}>
                          <button
                            onClick={() => restaurarRegistro(reg.id)}
                            disabled={salvandoId === reg.id}
                            style={{
                              background: "rgba(34,197,94,0.15)", border: "1px solid #22c55e", color: "#22c55e",
                              padding: "3px 10px", borderRadius: "6px", cursor: "pointer", fontSize: "11px", fontWeight: "700"
                            }}
                          >{salvandoId === reg.id ? "⏳" : "↩ Restaurar"}</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ESTADO VAZIO só quando não há log nem registros */}
      {!eventos && !textoLog.trim() && registrosCidade.length === 0 && !registrosCidadeCarregando && (
        <div style={{ ...cardStyle, textAlign: "center", padding: "48px", opacity: 0.6, marginTop: "20px" }}>
          <div style={{ fontSize: "48px", marginBottom: "12px" }}>📋</div>
          <div style={{ fontSize: "15px", fontWeight: "700", color: theme.text }}>Nenhum registro no período</div>
          <div style={{ fontSize: "13px", color: theme.subtext, marginTop: "6px" }}>
            Ajuste os filtros ou cole um novo log acima.
          </div>
        </div>
      )}
      {/* MODAL DE RELATÓRIO EXTERNO DE COBERTURA */}
      {modalRelatorioExternoAberta && (
        <div style={{
          position: "fixed",
          top: 0, left: 0, right: 0, bottom: 0,
          background: "#0f172a", // Slate escuro premium
          zIndex: 9999,
          overflowY: "auto",
          padding: "40px 20px",
          color: "#f8fafc",
          fontFamily: "'Outfit', 'Inter', sans-serif"
        }}>
          {/* Container do Relatório */}
          <div style={{ maxWidth: "1200px", margin: "0 auto", position: "relative" }}>
            
            {/* Controles de Ações do Modal (Escondidos na Impressão) */}
            <div className="no-print" style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "30px",
              paddingBottom: "20px",
              borderBottom: "1px solid rgba(255,255,255,0.1)"
            }}>
              <div>
                <h2 style={{ fontSize: "20px", fontWeight: "800", color: "#38bdf8", margin: 0 }}>
                  Visualização do Relatório Externo
                </h2>
                <p style={{ fontSize: "12px", color: "#94a3b8", margin: "4px 0 0 0" }}>
                  Apenas a grade de cobertura interativa (sem pontos manuais e sem cabeçalhos administrativos).
                </p>
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  onClick={() => window.print()}
                  style={{
                    background: "#0284c7", color: "#fff", border: "none",
                    padding: "8px 18px", borderRadius: "8px", cursor: "pointer",
                    fontSize: "13px", fontWeight: "700", display: "flex", alignItems: "center", gap: "6px"
                  }}
                >
                  🖨️ Imprimir / Salvar PDF
                </button>
                <button
                  onClick={() => setModalRelatorioExternoAberta(false)}
                  style={{
                    background: "rgba(255,255,255,0.08)", color: "#f8fafc", border: "1px solid rgba(255,255,255,0.15)",
                    padding: "8px 18px", borderRadius: "8px", cursor: "pointer",
                    fontSize: "13px", fontWeight: "700"
                  }}
                >
                  Fechar Relatório
                </button>
              </div>
            </div>

            {/* Cabeçalho do Relatório para Impressão */}
            <div style={{ marginBottom: "30px" }}>
              <div style={{ fontSize: "22px", fontWeight: "800", color: "#f8fafc" }}>
                Relatório de Cobertura de Serviço
              </div>
              <div style={{ fontSize: "13px", color: "#94a3b8", marginTop: "4px" }}>
                Período: {(() => {
                  const { inicio, fim } = calcularDatasPeriodo(filtroPeriodo, semanaOffset);
                  return `${inicio ? fmtBR(inicio) : ""} – ${fim ? fmtBR(fim) : ""}`;
                })()}
              </div>
            </div>

            {/* Linha do tempo de cobertura (Grade Interativa) */}
            <div style={{ background: "rgba(30, 41, 59, 0.7)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "12px", padding: "24px", overflowX: "auto" }}>
              <div style={{ minWidth: "980px" }}>
                
                {/* Linha de Turnos */}
                <div style={{ display: "flex", alignItems: "center", marginBottom: "16px" }}>
                  <div style={{ width: "120px", flexShrink: 0, fontWeight: "800", fontSize: "11px", color: "#94a3b8", textTransform: "uppercase" }}>
                    Dia da Semana
                  </div>
                  <div style={{ display: "flex", flex: 1, gap: "2px" }}>
                    <div style={{ flex: "12 1 0%", borderLeft: "1px solid rgba(255,255,255,0.05)", borderRight: "1px solid rgba(255,255,255,0.05)", background: "rgba(168,85,247,0.05)", padding: "6px 2px", textAlign: "center", fontSize: "10px", fontWeight: "800", color: "#c084fc", marginRight: "8px", borderRadius: "4px" }}>
                      🌑 Madrugada (00h-06h)
                    </div>
                    <div style={{ flex: "12 1 0%", borderLeft: "1px solid rgba(255,255,255,0.05)", borderRight: "1px solid rgba(255,255,255,0.05)", background: "rgba(251,191,36,0.05)", padding: "6px 2px", textAlign: "center", fontSize: "10px", fontWeight: "800", color: "#fcd34d", marginRight: "8px", borderRadius: "4px" }}>
                      🌅 Manhã (06h-12h)
                    </div>
                    <div style={{ flex: "12 1 0%", borderLeft: "1px solid rgba(255,255,255,0.05)", borderRight: "1px solid rgba(255,255,255,0.05)", background: "rgba(249,115,22,0.05)", padding: "6px 2px", textAlign: "center", fontSize: "10px", fontWeight: "800", color: "#fdba74", marginRight: "8px", borderRadius: "4px" }}>
                      ☀️ Tarde (12h-18h)
                    </div>
                    <div style={{ flex: "12 1 0%", borderLeft: "1px solid rgba(255,255,255,0.05)", borderRight: "1px solid rgba(255,255,255,0.05)", background: "rgba(59,130,246,0.05)", padding: "6px 2px", textAlign: "center", fontSize: "10px", fontWeight: "800", color: "#60a5fa", borderRadius: "4px" }}>
                      🌙 Noite (18h-00h)
                    </div>
                  </div>
                </div>

                {/* Cada dia do período */}
                {diasPeriodoBonificacao.map(dia => {
                  const dataObj = new Date(`${dia}T12:00:00`);
                  const diaSemana = dataObj.toLocaleDateString("pt-BR", { weekday: "short" });
                  const slots = slotsCoberturaBonificacao[dia] || [];
                  const [ano, mes, diaNum] = dia.split("-");

                  return (
                    <div key={dia} style={{ display: "flex", alignItems: "center", marginBottom: "8px" }}>
                      {/* Nome do dia */}
                      <div style={{ width: "120px", flexShrink: 0, fontWeight: "700", fontSize: "12px", color: "#f8fafc" }}>
                        <span style={{ textTransform: "capitalize", fontWeight: "800" }}>{diaSemana.replace(".", "")}</span>
                        <span style={{ color: "#94a3b8", marginLeft: "4px", fontSize: "11px" }}>({diaNum}/{mes})</span>
                      </div>

                      {/* Blocos horizontais */}
                      <div style={{ display: "flex", flex: 1, gap: "2px" }}>
                        {slots.map((slot, idx) => {
                          const tooltipText = `${slot.label}\n${slot.coberto ? `🟢 Coberto por:\n${slot.funcionarios.map(f => `• ${f.nome}`).join("\n")}` : "🔴 Sem cobertura"}`;
                          
                          let emptyColor = "";
                          let emptyBorder = "";
                          if (idx < 12) {
                            emptyColor = "rgba(168,85,247,0.03)";
                            emptyBorder = "rgba(168,85,247,0.15)";
                          } else if (idx < 24) {
                            emptyColor = "rgba(251,191,36,0.03)";
                            emptyBorder = "rgba(251,191,36,0.15)";
                          } else if (idx < 36) {
                            emptyColor = "rgba(249,115,22,0.03)";
                            emptyBorder = "rgba(249,115,22,0.15)";
                          } else {
                            emptyColor = "rgba(59,130,246,0.03)";
                            emptyBorder = "rgba(59,130,246,0.15)";
                          }

                          const isLastOfShift = idx === 11 || idx === 23 || idx === 35;
                          const marginRight = isLastOfShift ? "8px" : "0px";

                          return (
                            <div
                              key={idx}
                              title={tooltipText}
                              style={{
                                height: "30px",
                                borderRadius: "5px",
                                flex: "1 1 0%",
                                background: slot.coberto ? "#1b5e20" : emptyColor,
                                border: `1px solid ${slot.coberto ? "rgba(34, 197, 94, 0.3)" : emptyBorder}`,
                                cursor: "pointer",
                                position: "relative",
                                marginRight: marginRight,
                                transition: "transform 0.1s ease, box-shadow 0.1s ease"
                              }}
                              onMouseEnter={e => {
                                e.currentTarget.style.transform = "scale(1.18)";
                                e.currentTarget.style.zIndex = 10;
                                e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.25)";
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.transform = "scale(1)";
                                e.currentTarget.style.zIndex = 1;
                                e.currentTarget.style.boxShadow = "none";
                              }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Comparativo das Mecânicas (Classificação por Turnos) */}
            <div style={{ marginTop: "30px", marginBottom: "30px" }}>
              <div style={{ fontSize: "16px", fontWeight: "800", color: "#f8fafc", marginBottom: "16px" }}>
                📊 Comparativo das Mecânicas e Ranking por Turno
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "16px" }}>
                {(() => {
                  const dataBonificacao = calcularAcumuladoBonificacao;
                  const periodosList = [
                    { key: "manha", label: "Manhã", emoji: "🌅", horas: "06:00 às 12:00" },
                    { key: "tarde", label: "Tarde", emoji: "☀️", horas: "12:00 às 18:00" },
                    { key: "noite", label: "Noite", emoji: "🌙", horas: "18:00 às 00:00" },
                    { key: "madrugada", label: "Madrugada", emoji: "🌑", horas: "00:00 às 06:00" },
                  ];

                  return periodosList.map(p => {
                    const ranking = dataBonificacao.rankings[p.key] || [];
                    const winners = dataBonificacao.winners[p.key] || [];
                    const limitMinutos = configBonificacao[p.key].horasMinimas * 60;
                    
                    const totalMinsPeriodo = ranking.reduce((sum, colab) => {
                      const func = listaFuncionarios.find(f => String(f.id) === String(colab.idJogo));
                      const colabIsDono = func?.role ? (func.role.split('|')[0] === 'dono' || func.role.split('|').includes('dono_secundario')) : false;
                      if (excluirDonos && colabIsDono) return sum;
                      return sum + (colab[p.key] || 0);
                    }, 0);

                    return (
                      <div key={p.key} style={{ background: "rgba(30, 41, 59, 0.7)", border: "1px solid rgba(255,255,255,0.05)", padding: "16px", borderRadius: "12px" }}>
                        <div style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "10px", marginBottom: "12px" }}>
                          <div style={{ fontSize: "14px", fontWeight: "800", color: "#f8fafc", display: "flex", alignItems: "center", gap: "6px" }}>
                            <span>{p.emoji}</span>
                            <span>{p.label}</span>
                          </div>
                          <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>
                            Meta: {configBonificacao[p.key].horasMinimas}h · Total no Turno: {formatarMinutos(totalMinsPeriodo)}
                          </div>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                          {ranking.length === 0 ? (
                            <div style={{ fontSize: "11px", color: "#94a3b8", opacity: 0.6, padding: "12px 0", textAlign: "center" }}>
                              Nenhum registro.
                            </div>
                          ) : (
                            ranking.map((colab) => {
                              const totalMins = colab[p.key] || 0;
                              const isWinner = winners.some(w => w.idJogo === colab.idJogo);
                              const atingiuMeta = totalMins >= limitMinutos;
                              const pct = Math.min(100, (totalMins / (limitMinutos || 1)) * 100);

                              const func = listaFuncionarios.find(f => String(f.id) === String(colab.idJogo));
                              const colabIsDono = func?.role ? (func.role.split('|')[0] === 'dono' || func.role.split('|').includes('dono_secundario')) : false;
                              const deveApagarCard = excluirDonos && colabIsDono;

                              if (deveApagarCard) return null;

                              return (
                                <div key={colab.idJogo} style={{ background: isWinner ? "rgba(34,197,94,0.04)" : "transparent", border: isWinner ? "1px solid rgba(34,197,94,0.15)" : "1px solid transparent", borderRadius: "8px", padding: "8px 10px" }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "4px" }}>
                                    <div style={{ maxWidth: "70%" }}>
                                      <div style={{ fontWeight: "700", fontSize: "11px", color: "#f8fafc", display: "flex", alignItems: "center", gap: "4px" }}>
                                        {isWinner && <span title="Vencedor do período">🏆</span>}
                                        <span style={{ textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>{colab.nome}</span>
                                      </div>
                                      <div style={{ fontSize: "9px", color: "#94a3b8" }}>ID: #{colab.idJogo}</div>
                                    </div>
                                    <div style={{ textAlign: "right" }}>
                                      <div style={{ fontSize: "11px", fontWeight: "800", color: isWinner ? "#22c55e" : "#f8fafc" }}>
                                        {formatarMinutos(totalMins)}
                                      </div>
                                      {atingiuMeta ? (
                                        <span style={{ fontSize: "8px", background: "rgba(34,197,94,0.2)", color: "#22c55e", padding: "1px 4px", borderRadius: "3px", fontWeight: "800" }}>META OK</span>
                                      ) : (
                                        <span style={{ fontSize: "8px", background: "rgba(239,68,68,0.1)", color: "#ef4444", padding: "1px 4px", borderRadius: "3px", fontWeight: "800" }}>PENDENTE</span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Barra de Progresso */}
                                  <div style={{ width: "100%", height: "4px", background: "rgba(255,255,255,0.05)", borderRadius: "2px", overflow: "hidden" }}>
                                    <div style={{
                                      width: `${pct}%`,
                                      height: "100%",
                                      background: atingiuMeta ? "linear-gradient(90deg, #16a34a, #22c55e)" : "linear-gradient(90deg, #b40d0d, #ef4444)",
                                      transition: "width 0.3s ease"
                                    }} />
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

          </div>

          {/* Regra CSS para esconder controles na impressão */}
          <style dangerouslySetInnerHTML={{__html: `
            @media print {
              .no-print {
                display: none !important;
              }
              body {
                background: #ffffff !important;
                color: #000000 !important;
              }
              html, body {
                height: auto;
              }
            }
          `}} />
        </div>
      )}
    </div>
  );
}
