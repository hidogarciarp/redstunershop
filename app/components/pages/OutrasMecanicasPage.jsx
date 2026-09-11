"use client";
import React, { useState, useRef, useEffect } from "react";
import { supabase } from "../../utils/supabaseClient";
import { getHorarioObrigatorioParaData } from "../../utils/helpers";

// ===== PARSER DE LOGS =====
function parseLogCidade(texto, mecanicaSelecionada) {
  const registros = [];
  const linhas = texto.split("\n");
  let i = 0;

  const mecEsperada = mecanicaSelecionada === "mecanica_2" ? "harmony" : "dudark";

  while (i < linhas.length) {
    const linha = linhas[i].trim();
    const matchId = linha.match(
      /^\[ID\]:\s*(\d+)\s+(.+?)\s*\(\s*(ENTROU EM SERVI[ÇC]O|SAIU DE SERVI[ÇC]O)\s*-\s*([^)]+)\)/i
    );

    if (matchId) {
      const idJogo = matchId[1];
      const nomePersonagem = matchId[2].trim();
      const acao = matchId[3].toUpperCase().includes("ENTROU") ? "entrada" : "saida";
      const mecanicaLog = matchId[4].trim().toLowerCase();
      if (mecanicaLog.includes(mecEsperada)) {
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
    }
    i++;
  }
  return registros;
}

function separarEventosPorFuncionario(registros) {
  const mapa = {};
  registros.forEach((r) => {
    if (!mapa[r.idJogo]) {
      mapa[r.idJogo] = { nomePersonagem: r.nomePersonagem, entradas: [], saidas: [] };
    }
    if (r.acao === "entrada") {
      mapa[r.idJogo].entradas.push({ dataISO: r.dataISO, uuid: r.uuid });
    } else {
      mapa[r.idJogo].saidas.push({ dataISO: r.dataISO, uuid: r.uuid });
    }
  });

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

function calcularDatasPeriodo(periodo, offset = 0, filtroDataInicio = "", filtroDataFim = "") {
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
}

// ===== COMPONENTE PRINCIPAL =====
export default function OutrasMecanicasPage({ styles, theme, usuarioLogado }) {
  const [mecanicaSelecionada, setMecanicaSelecionada] = useState("mecanica_2"); // "mecanica_2" (Harmony) | "mecanica_3" (Dudark)
  const [subAba, setSubAba] = useState("importar"); // "importar" | "cobertura"
  
  // Estados para Importação
  const [textoLog, setTextoLog] = useState("");
  const [processandoLog, setProcessandoLog] = useState(false);
  const [eventos, setEventos] = useState(null);
  const [config, setConfig] = useState({});
  const [importando, setImportando] = useState(false);
  const [resultadoImportacao, setResultadoImportacao] = useState(null);
  const [todosRegistrosBanco, setTodosRegistrosBanco] = useState([]);
  
  // Estados para Filtros de Cobertura
  const [filtroPeriodo, setFiltroPeriodo] = useState("semana");
  const [filtroDataInicio, setFiltroDataInicio] = useState("");
  const [filtroDataFim, setFiltroDataFim] = useState("");
  const [semanaOffset, setSemanaOffset] = useState(() => {
    const agora = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    return agora.getDay() === 0 ? 0 : -1;
  });
  const [jaGerou, setJaGerou] = useState(false);
  const [registrosRelatorio, setRegistrosRelatorio] = useState([]);
  const [relatorioCarregando, setRelatorioCarregando] = useState(false);
  
  const [diaSelecionado, setDiaSelecionado] = useState("");
  const [filtroApenasSemCobertura, setFiltroApenasSemCobertura] = useState(false);
  const [visualizacaoCobertura, setVisualizacaoCobertura] = useState("linha");

  const getTabelaNome = () => {
    if (mecanicaSelecionada === "mecanica_2") return "ponto_cidade_mecanica_2";
    if (mecanicaSelecionada === "mecanica_3") return "ponto_cidade_mecanica_3";
    return mecanicaSelecionada;
  };

  // Carregar todos os registros do banco da mecânica selecionada para checar duplicatas
  const carregarRegistrosBanco = async () => {
    const table = getTabelaNome();
    const { data } = await supabase.from(table).select("*").order("entrada", { ascending: false }).limit(2000);
    if (data) setTodosRegistrosBanco(data);
  };

  useEffect(() => {
    carregarRegistrosBanco();
    setEventos(null);
    setConfig({});
    setResultadoImportacao(null);
    setTextoLog("");
    setJaGerou(false);
    setRegistrosRelatorio([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mecanicaSelecionada]);

  // Processamento de Logs
  const processarLog = async () => {
    if (!textoLog.trim()) return;
    setProcessandoLog(true);
    try {
      const registros = parseLogCidade(textoLog, mecanicaSelecionada);
      const mapa = separarEventosPorFuncionario(registros);
      const idsJogos = Object.keys(mapa);
      
      let registrosExtra = [];
      if (idsJogos.length > 0) {
        const dataLimite = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();
        const { data } = await supabase
          .from(getTabelaNome())
          .select("*")
          .in("id_jogo", idsJogos)
          .gte("data", dataLimite.split("T")[0]);
        if (data) registrosExtra = data;
      }
      
      // Mesclar
      const combinedRecords = [...todosRegistrosBanco, ...registrosExtra];
      
      // Filtrar
      Object.keys(mapa).forEach((idJogo) => {
        const funcData = mapa[idJogo];
        const uuidSaidasParaRemover = new Set();
        
        funcData.entradas = funcData.entradas.filter((entrada) => {
          const registroExistente = combinedRecords.find((r) => r.uuid_entrada === entrada.uuid);
          if (registroExistente && registroExistente.saida) {
            if (registroExistente.uuid_saida) {
              uuidSaidasParaRemover.add(registroExistente.uuid_saida);
              return false;
            }
          }
          return true;
        });

        funcData.saidas = funcData.saidas.filter((saida) => {
          if (uuidSaidasParaRemover.has(saida.uuid)) return false;
          const jaNoBanco = combinedRecords.some(r => r.uuid_saida === saida.uuid);
          if (jaNoBanco) return false;
          return true;
        });

        if (funcData.entradas.length === 0 && funcData.saidas.length === 0) {
          delete mapa[idJogo];
        }
      });

      if (Object.keys(mapa).length === 0) {
        alert("Todos os registros deste log já constam no banco de dados.");
        setEventos(null);
        setProcessandoLog(false);
        return;
      }

      // Config Inicial
      const novaConfig = {};
      Object.entries(mapa).forEach(([idJogo, { entradas, saidas }]) => {
        novaConfig[idJogo] = {};
        const indicesUsados = new Set();

        entradas.forEach((entrada, idx) => {
          let autoSaidaIdx = null;
          const dEntradaMin = new Date(entrada.dataISO).setSeconds(0, 0);
          const proximaEntrada = entradas[idx + 1];

          for (let sIdx = 0; sIdx < saidas.length; sIdx++) {
            if (indicesUsados.has(sIdx)) continue;
            const dSaida = new Date(saidas[sIdx].dataISO);
            if (new Date(dSaida).setSeconds(0, 0) < dEntradaMin) continue;
            if (proximaEntrada && dSaida > new Date(proximaEntrada.dataISO)) break;

            autoSaidaIdx = sIdx;
            indicesUsados.add(sIdx);
            break;
          }

          if (autoSaidaIdx === null) {
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
              saidaData: saidaSugestao.toLocaleDateString("en-CA"),
              saidaHora: saidaSugestao.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
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
    } catch (e) {
      alert("❌ Erro ao processar o log: " + e.message);
    } finally {
      setProcessandoLog(false);
    }
  };

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
              saidaSugestao = new Date(dataProxima);
              saidaSugestao.setMinutes(saidaSugestao.getMinutes() - 1);
            } else {
              saidaSugestao = sugestaoPadrao;
            }
          } else {
            saidaSugestao.setHours(saidaSugestao.getHours() + 1);
          }

          newConfig.saidaData = saidaSugestao.toLocaleDateString("en-CA");
          newConfig.saidaHora = saidaSugestao.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        }
      }

      return {
        ...prev,
        [idJogo]: {
          ...prev[idJogo],
          [entradaIdx]: newConfig
        }
      };
    });
  };

  const saidasUsadas = (idJogo) => {
    const cfg = config[idJogo] || {};
    return new Set(
      Object.values(cfg)
        .filter((c) => c.saidaIdx !== null && c.modo === "existente")
        .map((c) => c.saidaIdx)
    );
  };

  const handleImportar = async () => {
    if (!eventos) return;
    setImportando(true);

    const sessoesParaImportar = [];
    let erroValidacao = false;

    Object.entries(eventos).forEach(([idJogo, { nomePersonagem, entradas, saidas }]) => {
      const cfg = config[idJogo] || {};

      entradas.forEach((entrada, idx) => {
        const c = cfg[idx];
        if (!c || c.ignorar) return;

        let saidaFinal = null;
        let uuidSaida = null;

        if (c.modo === "existente" && c.saidaIdx !== null) {
          saidaFinal = saidas[c.saidaIdx]?.dataISO || null;
          uuidSaida = saidas[c.saidaIdx]?.uuid || null;
        } else if (c.modo === "manual") {
          if (!c.saidaData || !c.saidaHora) return;
          saidaFinal = new Date(`${c.saidaData}T${c.saidaHora}:00-03:00`).toISOString();
        }

        const dEntradaMin = new Date(entrada.dataISO).setSeconds(0, 0);
        const dSaidaMin = saidaFinal ? new Date(saidaFinal).setSeconds(0, 0) : null;

        if (dSaidaMin !== null && dSaidaMin < dEntradaMin) {
          alert(`⚠️ Saída inválida para ${nomePersonagem}: saída anterior à entrada!`);
          erroValidacao = true;
          return;
        }

        sessoesParaImportar.push({
          usuario_id: null,
          nome: nomePersonagem,
          nome_personagem: nomePersonagem,
          id_jogo: idJogo,
          entrada: entrada.dataISO,
          saida: saidaFinal,
          data: extrairData(entrada.dataISO),
          uuid_entrada: entrada.uuid,
          uuid_saida: uuidSaida,
          importado_por: usuarioLogado?.id,
        });
      });

      // Saídas órfãs
      const cfgF = config[idJogo] || {};
      const saidasVinculadasIdx = new Set(
        Object.values(cfgF)
          .filter(c => c.modo === "existente" && c.saidaIdx !== null)
          .map(c => c.saidaIdx)
      );

      saidas.forEach((s, sIdx) => {
        if (!saidasVinculadasIdx.has(sIdx)) {
          sessoesParaImportar.push({
            usuario_id: null,
            nome: nomePersonagem,
            nome_personagem: nomePersonagem,
            id_jogo: idJogo,
            entrada: null,
            saida: s.dataISO,
            data: extrairData(s.dataISO),
            uuid_entrada: null,
            uuid_saida: s.uuid,
            importado_por: usuarioLogado?.id,
          });
        }
      });
    });

    if (erroValidacao) { setImportando(false); return; }

    try {
      let inseridos = 0; let erros = 0;
      for (const s of sessoesParaImportar) {
        const { error } = await supabase.from(getTabelaNome()).insert([s]);
        if (error) erros++;
        else inseridos++;
      }
      setResultadoImportacao({ inseridos, erros, erro: null });
      setEventos(null);
      setConfig({});
      setTextoLog("");
      carregarRegistrosBanco();
    } catch (e) {
      setResultadoImportacao({ erro: e.message });
    } finally {
      setImportando(false);
    }
  };

  // Cobertura Lógica
  const buscarRelatorio = async () => {
    setRelatorioCarregando(true);
    const { inicio, fim } = calcularDatasPeriodo(filtroPeriodo, semanaOffset, filtroDataInicio, filtroDataFim);
    try {
      const { data, error } = await supabase
        .from(getTabelaNome())
        .select("*")
        .or("oculto.is.null,oculto.eq.false")
        .gte("data", inicio)
        .lte("data", fim);

      if (error) throw error;
      setRegistrosRelatorio(data || []);
      setJaGerou(true);
    } catch (e) {
      alert("Erro ao buscar logs de cobertura: " + e.message);
    } finally {
      setRelatorioCarregando(false);
    }
  };

  const { inicio: periodoInicio, fim: periodoFim } = calcularDatasPeriodo(
    filtroPeriodo, semanaOffset, filtroDataInicio, filtroDataFim
  );

  const diasPeriodo = React.useMemo(() => {
    if (!periodoInicio || !periodoFim) return [];
    const dias = [];
    const dataInicioObj = new Date(`${periodoInicio}T12:00:00`);
    const dataFimObj = new Date(`${periodoFim}T12:00:00`);
    let atual = new Date(dataInicioObj);
    while (atual <= dataFimObj) {
      dias.push(atual.toLocaleDateString("en-CA"));
      atual.setDate(atual.getDate() + 1);
    }
    return dias;
  }, [periodoInicio, periodoFim]);

  React.useEffect(() => {
    if (diasPeriodo.length > 0) {
      if (!diaSelecionado || !diasPeriodo.includes(diaSelecionado)) {
        setDiaSelecionado(diasPeriodo[0]);
      }
    } else {
      setDiaSelecionado("");
    }
  }, [diasPeriodo, diaSelecionado]);

  const calcularSlotsParaDia = React.useCallback((dia) => {
    const slots = [];
    for (let h = 0; h < 24; h++) {
      const hStr = String(h).padStart(2, "0");
      const nextHStr = String(h + 1).padStart(2, "0");
      
      slots.push({
        label: `${hStr}:00 - ${hStr}:30`,
        start: new Date(`${dia}T${hStr}:00:00`),
        end: new Date(`${dia}T${hStr}:30:00`)
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
        end: endVal
      });
    }

    return slots.map(slot => {
      const funcionariosTrabalhando = [];
      
      registrosRelatorio.forEach(reg => {
        if (reg.oculto || !reg.entrada) return;
        
        const entradaDate = new Date(reg.entrada);
        let saidaDate = null;
        if (reg.saida) {
          const dS = new Date(reg.saida);
          if (!isNaN(dS.getTime()) && dS >= entradaDate) {
            const maxS = new Date(entradaDate.getTime() + 12 * 3600000);
            saidaDate = dS > maxS ? maxS : dS;
          }
        } else if (typeof reg.tempo === "number" && reg.tempo > 0) {
          saidaDate = new Date(entradaDate.getTime() + reg.tempo * 60000);
        } else {
          const agora = Date.now();
          const diffHoras = (agora - entradaDate.getTime()) / 3600000;
          if (diffHoras >= 0 && diffHoras <= 2) {
            saidaDate = new Date(agora);
          }
        }

        if (!saidaDate) return;
        
        if (entradaDate < slot.end && saidaDate > slot.start) {
          const funcNome = reg.nome || reg.nome_personagem || `ID: ${reg.id_jogo}`;
          if (!funcionariosTrabalhando.some(f => f.nome === funcNome)) {
            funcionariosTrabalhando.push({ nome: funcNome, idJogo: reg.id_jogo });
          }
        }
      });
      
      return {
        ...slot,
        coberto: funcionariosTrabalhando.length > 0,
        funcionarios: funcionariosTrabalhando
      };
    });
  }, [registrosRelatorio]);

  const coberturaTodosDias = React.useMemo(() => {
    const mapa = {};
    diasPeriodo.forEach(dia => {
      mapa[dia] = calcularSlotsParaDia(dia);
    });
    return mapa;
  }, [diasPeriodo, calcularSlotsParaDia]);

  const slotsDoDia = React.useMemo(() => {
    return coberturaTodosDias[diaSelecionado] || [];
  }, [coberturaTodosDias, diaSelecionado]);

  const cardStyle = { ...styles.whiteCard, marginBottom: "16px", padding: "16px 20px" };
  const inputSmall = { ...styles.input, padding: "5px 10px", fontSize: "13px", height: "32px" };
  
  const semanaLabel = (() => {
    const agora = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const defOff = agora.getDay() === 0 ? 0 : -1;
    if (semanaOffset === defOff) return "🗓 Última semana completa";
    if (semanaOffset === 0)      return "🗓 Semana atual";
    if (semanaOffset === -1)     return "🗓 Semana passada";
    return `🗓 ${Math.abs(semanaOffset)} sem. atrás`;
  })();

  return (
    <div style={{ padding: "28px 36px", maxWidth: "1200px", margin: "0 auto" }}>
      
      {/* HEADER & SELECTOR DE MECANICA */}
      <div style={{ marginBottom: "24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: "800", color: theme.text, margin: 0 }}>
            🛠️ Outras Mecânicas
          </h1>
          <p style={{ fontSize: "13px", color: theme.subtext, marginTop: "6px" }}>
            Importação e análise de escala para oficinas de terceiros.
          </p>
        </div>
        
        {/* Selector Mecanica */}
        <div style={{ display: "flex", gap: "8px" }}>
          {[
            { id: "mecanica_2", label: "Harmony", color: "#14b8a6" },
            { id: "mecanica_3", label: "Dudark", color: "#38bdf8" }
          ].map(m => (
            <button
              key={m.id}
              onClick={() => setMecanicaSelecionada(m.id)}
              style={{
                padding: "10px 20px",
                borderRadius: "12px",
                border: `1px solid ${mecanicaSelecionada === m.id ? m.color : theme.border}`,
                background: mecanicaSelecionada === m.id ? m.color : theme.card,
                color: mecanicaSelecionada === m.id ? "#fff" : theme.text,
                fontWeight: "800",
                fontSize: "13px",
                cursor: "pointer",
                transition: "all 0.2s"
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* TABS DE SUB-PÁGINA */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "20px", borderBottom: `1px solid ${theme.border}`, paddingBottom: "8px" }}>
        <button
          onClick={() => setSubAba("importar")}
          style={{
            background: "transparent", border: "none",
            borderBottom: subAba === "importar" ? `3px solid ${theme.accent}` : "3px solid transparent",
            color: subAba === "importar" ? theme.text : theme.subtext,
            fontWeight: "800", fontSize: "14px", padding: "8px 16px", cursor: "pointer"
          }}
        >
          📥 Importar Logs
        </button>
        <button
          onClick={() => setSubAba("cobertura")}
          style={{
            background: "transparent", border: "none",
            borderBottom: subAba === "cobertura" ? `3px solid ${theme.accent}` : "3px solid transparent",
            color: subAba === "cobertura" ? theme.text : theme.subtext,
            fontWeight: "800", fontSize: "14px", padding: "8px 16px", cursor: "pointer"
          }}
        >
          ⏱️ Ausência de Cobertura
        </button>
      </div>

      {/* ================================== SUB-ABA: IMPORTAR ================================== */}
      {subAba === "importar" && (
        <div>
          <div style={cardStyle}>
            <div style={{ ...styles.cardHeader, marginBottom: "14px" }}>
              <span style={styles.dot} /> Cole o Log da Cidade ({mecanicaSelecionada === "mecanica_2" ? "Harmony" : "Dudark"})
            </div>
            <textarea
              value={textoLog}
              onChange={(e) => setTextoLog(e.target.value)}
              placeholder="Paste txt logs here..."
              style={{
                width: "100%", minHeight: "150px", padding: "14px", borderRadius: "10px",
                background: theme.card2, color: theme.text, border: `1px solid ${theme.border}`,
                fontSize: "12px", fontFamily: "monospace", resize: "vertical"
              }}
            />
            <button
              onClick={processarLog}
              disabled={!textoLog.trim() || processandoLog}
              style={{
                background: "linear-gradient(135deg, #1b5e20, #2e7d32)", color: "#fff", border: "none",
                padding: "10px 24px", borderRadius: "10px", fontWeight: "700", marginTop: "12px", cursor: "pointer"
              }}
            >
              {processandoLog ? "⏳ Processando..." : "🔍 Processar Log"}
            </button>
          </div>

          {resultadoImportacao && (
            <div style={{ ...cardStyle, borderLeft: `3px solid ${resultadoImportacao.erro ? "#ef4444" : "#22c55e"}` }}>
              {resultadoImportacao.erro ? (
                <span style={{ color: "#ef4444" }}>Erro: {resultadoImportacao.erro}</span>
              ) : (
                <span>✅ Sucesso! Inseridos: {resultadoImportacao.inseridos} (Erros: {resultadoImportacao.erros})</span>
              )}
            </div>
          )}

          {eventos && (
            <div>
              <div style={{ ...cardStyle, borderLeft: "3px solid #f97316", background: "rgba(249,115,22,0.05)" }}>
                <span style={{ fontWeight: "700", color: "#f97316" }}>Vínculo de Turno Requerido</span>
                <p style={{ margin: "4px 0 0 0", fontSize: "12px" }}>Pareie as entradas e saídas de cada funcionário abaixo e clique em Importar.</p>
              </div>

              {Object.entries(eventos).map(([idJogo, { nomePersonagem, entradas, saidas }]) => {
                const cfgFunc = config[idJogo] || {};
                const jaUsadas = saidasUsadas(idJogo);

                return (
                  <div key={idJogo} style={{ ...cardStyle, borderLeft: "3px solid #14b8a6", marginBottom: "12px" }}>
                    <div style={{ fontWeight: "800", fontSize: "14px", marginBottom: "10px" }}>👤 {nomePersonagem} (ID: #{idJogo})</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {entradas.map((entrada, idx) => {
                        const c = cfgFunc[idx] || { modo: "existente", saidaIdx: null, saidaData: "", saidaHora: "", ignorar: false };
                        if (c.ignorar) return null;

                        let saidaFinal = null;
                        if (c.modo === "existente" && c.saidaIdx !== null) {
                          saidaFinal = saidas[c.saidaIdx]?.dataISO || null;
                        } else if (c.modo === "manual" && c.saidaData && c.saidaHora) {
                          saidaFinal = new Date(`${c.saidaData}T${c.saidaHora}:00-03:00`).toISOString();
                        }

                        return (
                          <div key={idx} style={{ background: theme.card2, padding: "12px", borderRadius: "8px", border: `1px solid ${theme.border}` }}>
                            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "10px", alignItems: "center" }}>
                              <div>
                                <span style={{ fontSize: "10px", color: theme.subtext }}>ENTRADA</span>
                                <div style={{ fontWeight: "800", color: "#22c55e" }}>{formatarHoraBR(entrada.dataISO)} ({formatarDataBR(entrada.dataISO)})</div>
                              </div>
                              
                              <div style={{ flex: 1, minWidth: "200px" }}>
                                <div style={{ display: "flex", gap: "4px", marginBottom: "4px" }}>
                                  <button onClick={() => atualizarConfig(idJogo, idx, "modo", "existente")} style={{ fontSize: "10px", background: c.modo === "existente" ? theme.accent : "#333", color: "#fff", border: "none", padding: "2px 8px", borderRadius: "4px", cursor: "pointer" }}>Do log</button>
                                  <button onClick={() => atualizarConfig(idJogo, idx, "modo", "manual")} style={{ fontSize: "10px", background: c.modo === "manual" ? theme.accent : "#333", color: "#fff", border: "none", padding: "2px 8px", borderRadius: "4px", cursor: "pointer" }}>Manual</button>
                                </div>
                                
                                {c.modo === "existente" && (
                                  <select
                                    value={c.saidaIdx !== null ? String(c.saidaIdx) : ""}
                                    onChange={(e) => atualizarConfig(idJogo, idx, "saidaIdx", e.target.value === "" ? null : Number(e.target.value))}
                                    style={inputSmall}
                                  >
                                    <option value="">— Selecione a saída —</option>
                                    {saidas.map((s, sIdx) => {
                                      if (jaUsadas.has(sIdx) && c.saidaIdx !== sIdx) return null;
                                      if (new Date(s.dataISO) < new Date(entrada.dataISO)) return null;
                                      return (
                                        <option key={sIdx} value={sIdx}>{formatarHoraBR(s.dataISO)} ({formatarDataBR(s.dataISO)})</option>
                                      );
                                    })}
                                  </select>
                                )}

                                {c.modo === "manual" && (
                                  <div style={{ display: "flex", gap: "4px" }}>
                                    <input type="date" value={c.saidaData} onChange={e => atualizarConfig(idJogo, idx, "saidaData", e.target.value)} style={inputSmall} />
                                    <input type="time" value={c.saidaHora} onChange={e => atualizarConfig(idJogo, idx, "saidaHora", e.target.value)} style={inputSmall} />
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              
              <button
                onClick={handleImportar}
                style={{
                  background: "linear-gradient(135deg, #1b5e20, #2e7d32)", color: "#fff", border: "none",
                  padding: "12px 36px", borderRadius: "10px", fontWeight: "800", cursor: "pointer", marginTop: "16px"
                }}
              >
                📥 Confirmar e Salvar Importação
              </button>
            </div>
          )}
        </div>
      )}

      {/* ================================== SUB-ABA: COBERTURA ================================== */}
      {subAba === "cobertura" && (
        <div>
          {/* FILTROS */}
          <div style={cardStyle}>
            <div style={{ ...styles.cardHeader, marginBottom: "14px" }}>
              <span style={styles.dot} /> Escolha o Período
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "flex-end" }}>
              <div style={{ display: "flex", gap: "6px" }}>
                {["hoje", "semana", "mes", "custom"].map(p => (
                  <button
                    key={p}
                    onClick={() => setFiltroPeriodo(p)}
                    style={{
                      padding: "6px 14px", borderRadius: "8px", border: "none", cursor: "pointer",
                      background: filtroPeriodo === p ? theme.accent : theme.card2,
                      color: filtroPeriodo === p ? "#fff" : theme.subtext,
                      fontSize: "12px", fontWeight: "700"
                    }}
                  >
                    {p.toUpperCase()}
                  </button>
                ))}
              </div>

              {filtroPeriodo === "semana" && (
                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  <button onClick={() => { const n = semanaOffset - 1; setSemanaOffset(n); }} style={{ background: theme.card2, border: `1px solid ${theme.border}`, color: theme.text, padding: "4px 10px", borderRadius: "6px", cursor: "pointer" }}>←</button>
                  <span style={{ fontSize: "11px", fontWeight: "700", color: "#38bdf8" }}>{semanaLabel}</span>
                  <button onClick={() => { if (semanaOffset < 0) setSemanaOffset(semanaOffset + 1); }} style={{ background: theme.card2, border: `1px solid ${theme.border}`, color: theme.text, padding: "4px 10px", borderRadius: "6px", cursor: "pointer" }}>→</button>
                </div>
              )}

              {filtroPeriodo === "custom" && (
                <div style={{ display: "flex", gap: "6px" }}>
                  <input type="date" value={filtroDataInicio} onChange={e => setFiltroDataInicio(e.target.value)} style={inputSmall} />
                  <input type="date" value={filtroDataFim} onChange={e => setFiltroDataFim(e.target.value)} style={inputSmall} />
                </div>
              )}

              <button
                onClick={buscarRelatorio}
                disabled={relatorioCarregando}
                style={{
                  background: "linear-gradient(135deg, #b40d0d, #ef4444)", color: "#fff", border: "none",
                  padding: "6px 18px", borderRadius: "8px", cursor: "pointer", fontSize: "12px", fontWeight: "700"
                }}
              >
                {relatorioCarregando ? "⏳ Carregando..." : "🔍 Analisar Cobertura"}
              </button>
            </div>
          </div>

          {jaGerou && !relatorioCarregando && (
            <div>
              {/* Controles de Modo */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <span style={{ fontWeight: "800", color: theme.text, fontSize: "14px" }}>📅 Escala de Turnos ({mecanicaSelecionada === "mecanica_2" ? "Harmony" : "Dudark"})</span>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button onClick={() => setVisualizacaoCobertura("linha")} style={{ padding: "4px 10px", borderRadius: "6px", border: "none", cursor: "pointer", fontSize: "11px", background: visualizacaoCobertura === "linha" ? theme.accent : theme.card2, color: "#fff" }}>📊 Linha do Tempo</button>
                  <button onClick={() => setVisualizacaoCobertura("detalhes")} style={{ padding: "4px 10px", borderRadius: "6px", border: "none", cursor: "pointer", fontSize: "11px", background: visualizacaoCobertura === "detalhes" ? theme.accent : theme.card2, color: "#fff" }}>🔍 Detalhes</button>
                </div>
              </div>

              {/* LINHA DO TEMPO */}
              {visualizacaoCobertura === "linha" && (
                <div style={{ ...styles.whiteCard, padding: "20px", overflowX: "auto", marginBottom: "20px" }}>
                  <div style={{ minWidth: "920px" }}>
                    <div style={{ display: "flex", alignItems: "center", marginBottom: "12px" }}>
                      <div style={{ width: "120px", fontWeight: "800", fontSize: "11px", color: theme.subtext }}>DIA</div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(48, 1fr)", flex: 1, gap: "2px" }}>
                        {Array.from({ length: 24 }).map((_, h) => (
                          <div key={h} style={{ gridColumn: "span 2", textAlign: "left", fontSize: "10px", color: "#38bdf8", borderLeft: `1px solid ${theme.border}44`, paddingLeft: "2px" }}>
                            {String(h).padStart(2, "0")}h
                          </div>
                        ))}
                      </div>
                    </div>

                    {diasPeriodo.map(dia => {
                      const dataObj = new Date(`${dia}T12:00:00`);
                      const diaSemana = dataObj.toLocaleDateString("pt-BR", { weekday: "short" });
                      const slots = coberturaTodosDias[dia] || [];
                      const [, mes, diaNum] = dia.split("-");

                      return (
                        <div key={dia} style={{ display: "flex", alignItems: "center", marginBottom: "6px" }}>
                          <div style={{ width: "120px", fontSize: "12px", color: theme.text, fontWeight: "700" }}>
                            {diaSemana.toUpperCase().replace(".", "")} ({diaNum}/{mes})
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(48, 1fr)", flex: 1, gap: "3px" }}>
                            {slots.map((slot, idx) => {
                              const infoObr = getHorarioObrigatorioParaData(dia);
                              const ehObrigatorio = idx >= infoObr.slotInicioIdx && idx <= infoObr.slotFimIdx;
                              const tooltipText = `${ehObrigatorio ? `⭐ [Horário Obrigatório ${infoObr.labelCurto}] ` : ""}${slot.label}\n${slot.coberto ? `🟢 Coberto por:\n${slot.funcionarios.map(f => `• ${f.nome}`).join("\n")}` : `🔴 Sem cobertura${ehObrigatorio ? " (FALHA NO HORÁRIO OBRIGATÓRIO)" : ""}`}`;
                              return (
                                <div
                                  key={idx}
                                  title={tooltipText}
                                  style={{
                                    height: "30px",
                                    borderRadius: "5px",
                                    background: slot.coberto 
                                      ? "#1b5e20" 
                                      : (theme.border === "#2e2e2e" ? "#222" : "#e0e0e0"),
                                    border: ehObrigatorio
                                      ? `2px solid ${slot.coberto ? "#facc15" : "#f87171"}`
                                      : `1px solid ${slot.coberto ? "rgba(34, 197, 94, 0.3)" : theme.border}55`,
                                    boxShadow: ehObrigatorio && !slot.coberto ? "0 0 6px rgba(248,113,113,0.8)" : "none",
                                    cursor: "pointer",
                                    position: "relative",
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
              )}

              {/* DETALHES POR DIA */}
              {visualizacaoCobertura === "detalhes" && (
                <div>
                  <div style={{ display: "flex", gap: "6px", overflowX: "auto", marginBottom: "16px" }}>
                    {diasPeriodo.map(dia => {
                      const [, mes, diaNum] = dia.split("-");
                      const ativo = dia === diaSelecionado;
                      return (
                        <button
                          key={dia} onClick={() => setDiaSelecionado(dia)}
                          style={{
                            padding: "6px 12px", borderRadius: "8px", border: `1px solid ${ativo ? theme.accent : theme.border}`,
                            background: ativo ? theme.accent : theme.card2, color: ativo ? "#fff" : theme.text, cursor: "pointer"
                          }}
                        >
                          {diaNum}/{mes}
                        </button>
                      );
                    })}
                  </div>

                  {diaSelecionado && (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                        <span style={{ fontWeight: "700" }}>🕒 Slots do dia {diaSelecionado.split("-").reverse().join("/")}</span>
                        <label style={{ fontSize: "12px", cursor: "pointer", display: "flex", gap: "4px", alignItems: "center" }}>
                          <input type="checkbox" checked={filtroApenasSemCobertura} onChange={e => setFiltroApenasSemCobertura(e.target.checked)} />
                          Apenas vazios
                        </label>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "10px" }}>
                        {slotsDoDia
                          .filter(s => !filtroApenasSemCobertura || !s.coberto)
                          .map((slot, idx) => {
                            const sHours = slot.start.getHours();
                            const infoObr = getHorarioObrigatorioParaData(diaSelecionado);
                            const ehObrigatorio = sHours >= infoObr.horaInicioNum && sHours < infoObr.horaFimNum;
                            return (
                              <div key={idx} style={{ 
                                ...styles.whiteCard, 
                                padding: "12px", 
                                borderLeft: `4px solid ${slot.coberto ? "#22c55e" : "#ef4444"}`,
                                border: ehObrigatorio ? `2px solid ${slot.coberto ? "#eab308" : "#f87171"}` : `1px solid ${theme.border}44`,
                                boxShadow: ehObrigatorio 
                                  ? (slot.coberto ? "0 0 8px rgba(234,179,8,0.15)" : "0 0 10px rgba(239,68,68,0.3)")
                                  : "none",
                              }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                                  <span style={{ fontWeight: "800", fontSize: "13px" }}>
                                    {ehObrigatorio ? "⭐ " : ""}{slot.label}
                                  </span>
                                  <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                                    {ehObrigatorio && (
                                      <span style={{ fontSize: "8px", fontWeight: "900", background: "#facc15", color: "#000", padding: "1px 3px", borderRadius: "2px" }}>OBRIGATÓRIO</span>
                                    )}
                                    <span style={{ fontSize: "9px", padding: "1px 4px", borderRadius: "3px", background: slot.coberto ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", color: slot.coberto ? "#22c55e" : "#ef4444" }}>
                                      {slot.coberto ? "COBERTO" : "VAZIO"}
                                    </span>
                                  </div>
                                </div>
                                <div style={{ fontSize: "11px", color: theme.subtext }}>
                                  {slot.coberto ? (
                                    <div>
                                      {slot.funcionarios.map((f, fIdx) => <div key={fIdx}>• {f.nome} (#{f.idJogo})</div>)}
                                    </div>
                                  ) : (
                                    <span style={{ color: "#ef4444", fontWeight: "700" }}>
                                      {ehObrigatorio ? "🚨 FALHA: Horário Obrigatório Sem Cobertura" : "Sem funcionários"}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
