"use client";
import React, { useState } from "react";
import { supabase } from "../../utils/supabaseClient";
import { getHorarioObrigatorioParaData, sincronizarPontosDiscordParaReds } from "../../utils/helpers";

// ===== HELPERS LOCAIS =====
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

function fmtMin(totalMin) {
  if (!totalMin || totalMin <= 0) return "0h 00min";
  const h = Math.floor(totalMin / 60);
  const m = Math.round(totalMin % 60);
  return `${h}h ${String(m).padStart(2, "0")}min`;
}

function fmtBR(isoDate) {
  return isoDate ? new Date(isoDate + "T12:00:00").toLocaleDateString("pt-BR") : "";
}

function getCargoTag(role) {
  if (!role) return "";
  const r = role.split("|")[0].toLowerCase().trim();
  const tags = {
    "jovem_aprendiz": "JA",
    "estagiario": "ES",
    "mecanico": "MC",
    "mecanico_senior": "MS",
    "supervisor": "SP",
    "gerente": "GR",
    "gerente_geral": "GG",
    "dono": "DN",
    "admin": "ADM"
  };
  return tags[r] || "";
}

function obterLabelSemana(dataStr) {
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
}

function obterSaidaValida(reg) {
  if (!reg || !reg.entrada || reg.oculto) return null;
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

  const agora = Date.now();
  const diffHoras = (agora - dEntrada.getTime()) / 3600000;
  if (diffHoras >= 0 && diffHoras <= 2) {
    return new Date(agora);
  }

  return dEntrada;
}

function calcularMetricasMecanica(registros, diasPeriodo) {
  let totalMin = 0;
  const pessoasUnicas = new Set();
  let sessoes = 0;

  registros.forEach(reg => {
    if (reg.oculto) return;
    if (reg.entrada) {
      const dEntrada = new Date(reg.entrada);
      const dSaida = obterSaidaValida(reg);
      if (!dSaida) return;
      const diff = (dSaida - dEntrada) / 60000;
      if (diff > 0) {
        totalMin += diff;
        sessoes++;
      }
      if (reg.nome_personagem || reg.nome) {
        pessoasUnicas.add(reg.nome_personagem || reg.nome);
      }
    }
  });

  let slotsCobertos = 0;
  let slotsObrigatoriosCobertos = 0;
  const totalSlots = diasPeriodo.length * 48;
  const totalSlotsObrigatorios = diasPeriodo.reduce((acc, dia) => acc + getHorarioObrigatorioParaData(dia).totalSlots30Min, 0);

  if (totalSlots > 0) {
    diasPeriodo.forEach(dia => {
      for (let h = 0; h < 24; h++) {
        const hStr = String(h).padStart(2, "0");
        const nextHStr = String(h + 1).padStart(2, "0");
        
        const start1 = new Date(`${dia}T${hStr}:00:00`).getTime();
        const end1 = new Date(`${dia}T${hStr}:30:00`).getTime();
        
        const start2 = new Date(`${dia}T${hStr}:30:00`).getTime();
        let end2;
        if (h === 23) {
          const base = new Date(`${dia}T00:00:00`).getTime();
          end2 = base + 24 * 60 * 60 * 1000;
        } else {
          end2 = new Date(`${dia}T${nextHStr}:00:00`).getTime();
        }

        let coberto1 = false;
        let coberto2 = false;

        for (let i = 0; i < registros.length; i++) {
          const reg = registros[i];
          if (reg.oculto || !reg.entrada) continue;

          const tEntrada = new Date(reg.entrada).getTime();
          const dSaidaVal = obterSaidaValida(reg);
          if (!dSaidaVal) continue;
          const tSaida = dSaidaVal.getTime();

          if (Math.max(tEntrada, start1) < Math.min(tSaida, end1)) {
            coberto1 = true;
          }
          if (Math.max(tEntrada, start2) < Math.min(tSaida, end2)) {
            coberto2 = true;
          }

          if (coberto1 && coberto2) break;
        }

        const infoObr = getHorarioObrigatorioParaData(dia);
        const ehObrigatorio = h >= infoObr.horaInicioNum && h < infoObr.horaFimNum;

        if (coberto1) {
          slotsCobertos++;
          if (ehObrigatorio) slotsObrigatoriosCobertos++;
        }
        if (coberto2) {
          slotsCobertos++;
          if (ehObrigatorio) slotsObrigatoriosCobertos++;
        }
      }
    });
  }

  const taxaCobertura = totalSlots > 0 ? (slotsCobertos / totalSlots) * 100 : 0;
  const minutosCobertos = slotsCobertos * 30;

  const taxaCoberturaObrigatoria = totalSlotsObrigatorios > 0 ? (slotsObrigatoriosCobertos / totalSlotsObrigatorios) * 100 : 0;
  const minutosObrigatoriosCobertos = slotsObrigatoriosCobertos * 30;
  const minutosMaxObrigatorios = totalSlotsObrigatorios * 30;
  const minutosObrigatoriosNaoCumpridos = minutosMaxObrigatorios - minutosObrigatoriosCobertos;

  return {
    totalMin,
    minutosCobertos,
    taxaCobertura,
    sessoes,
    funcionariosAtivos: pessoasUnicas.size,
    minutosObrigatoriosCobertos,
    taxaCoberturaObrigatoria,
    minutosObrigatoriosNaoCumpridos,
  };
}

function calcularSlotsGenerico(registros, dia) {
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
    
    registros.forEach(reg => {
      if (reg.oculto || !reg.entrada) return;
      
      const entradaDate = new Date(reg.entrada);
      const GlenOut = obterSaidaValida(reg);
      if (!GlenOut) return;
      
      const startT = slot.start.getTime();
      const endT = slot.end.getTime();
      const entT = entradaDate.getTime();
      const saiT = GlenOut.getTime();
      
      const overlap = Math.max(entT, startT) < Math.min(saiT, endT);
      if (overlap) {
        const funcNome = reg.nome_personagem || reg.nome;
        if (!funcionariosTrabalhando.some(f => f.nome === funcNome)) {
          funcionariosTrabalhando.push({
            nome: funcNome,
            idJogo: reg.id_jogo
          });
        }
      }
    });

    return {
      label: slot.label,
      coberto: funcionariosTrabalhando.length > 0,
      funcionarios: funcionariosTrabalhando
    };
  });
}

// ===== COMPONENTE =====
export default function RelatorioPage({
  styles,
  theme,
  usuarioLogado,
  listaFuncionarios = [],
  buscarRelatorio,
  registrosRelatorio = [],
  registrosRelatorioM2 = [],
  registrosRelatorioM3 = [],
  relatorioCarregando = false,
  onVerDetalhesPonto,
}) {
  const [logsCompletosFunc, setLogsCompletosFunc] = useState([]);
  const [carregandoLogsFunc, setCarregandoLogsFunc] = useState(false);
  const [funcModal,       setFuncModal]       = useState(null); // { func, status }
  const [sessaoAuditModal, setSessaoAuditModal] = useState(null); // Detalhes de atividades da sessão clicada
  const [timelineTooltip, setTimelineTooltip] = useState({ visible: false, x: 0, y: 0, content: "" });
  const [esconderResumoSemanal, setEsconderResumoSemanal] = useState(true);

  const fetchAllLogsFunc = async (func) => {
    if (!func) return;
    setCarregandoLogsFunc(true);
    try {
      const idVal = String(func.id_jogo || func.idJogo || func.id || "").trim();
      const nomeVal = (func.nome || "").trim();

      // 1. Tentar buscar da tabela consolidada de auditoria com atividades (tunagens, bancada, bau)
      let queryAuditoria = supabase
        .from("sessoes_ponto_auditoria_reds")
        .select("*")
        .order("entrada", { ascending: false })
        .limit(2000);

      const conditionsAud = [];
      if (idVal && !isNaN(Number(idVal))) {
        conditionsAud.push(`id_jogo.eq.${idVal}`);
      }
      if (func.id && String(func.id) !== String(idVal) && !isNaN(Number(func.id))) {
        conditionsAud.push(`id_jogo.eq.${func.id}`);
      }
      if (nomeVal) {
        conditionsAud.push(`nome.ilike.%${nomeVal}%`);
      }
      if (conditionsAud.length > 0) {
        queryAuditoria = queryAuditoria.or(conditionsAud.join(","));
      }

      // 2. Buscar da tabela/view ponto_cidade_reds (para trazer sessões recentes e em tempo real)
      let query = supabase
        .from("ponto_cidade_reds")
        .select("*")
        .or("oculto.is.null,oculto.eq.false")
        .order("entrada", { ascending: false })
        .limit(10000);

      const conditions = [];
      if (idVal && !isNaN(Number(idVal))) {
        conditions.push(`usuario_id.eq.${idVal}`);
        conditions.push(`id_jogo.eq.${idVal}`);
      } else if (func.id) {
        conditions.push(`usuario_id.eq.${func.id}`);
      }

      if (nomeVal) {
        conditions.push(`nome.ilike.%${nomeVal}%`);
        conditions.push(`nome_personagem.ilike.%${nomeVal}%`);
        const partes = nomeVal.split(/\s+/).filter(Boolean);
        if (partes.length >= 2) {
          conditions.push(`nome.ilike.%${partes[0]}%${partes[partes.length - 1]}%`);
          conditions.push(`nome_personagem.ilike.%${partes[0]}%${partes[partes.length - 1]}%`);
        }
      }

      if (conditions.length > 0) {
        query = query.or(conditions.join(","));
      }

      // 3. Buscar logs de atividades reais para este colaborador (tunagens, bancada, baú)
      const condsTun = [];
      const condsBanc = [];
      const condsBau = [];

      if (idVal) {
        condsTun.push(`tecnico_id.eq.${idVal}`);
        condsBanc.push(`id.eq.${idVal}`);
        condsBau.push(`id.eq.${idVal}`);
      }
      if (nomeVal) {
        condsTun.push(`tecnico_nome.ilike.%${nomeVal}%`);
        condsBanc.push(`nome.ilike.%${nomeVal}%`);
        condsBau.push(`nome.ilike.%${nomeVal}%`);
      }

      let qTun = supabase.from("logs_tunagem_reds").select("*").order("data", { ascending: false }).limit(2000);
      if (condsTun.length > 0) qTun = qTun.or(condsTun.join(","));

      let qBanc = supabase.from("log_bancada_reds").select("id, nome, data, hora, timestampz, uuid").order("data", { ascending: false }).limit(2000);
      if (condsBanc.length > 0) qBanc = qBanc.or(condsBanc.join(","));

      let qBau = supabase.from("log_bau_reds").select("id, nome, data, hora, timestampz, uuid").order("data", { ascending: false }).limit(2000);
      if (condsBau.length > 0) qBau = qBau.or(condsBau.join(","));

      const [resAud, resPonto, resTun, resBanc, resBau] = await Promise.all([
        queryAuditoria,
        query,
        qTun,
        qBanc,
        qBau
      ]);

      const dataAud = resAud.data || [];
      const logsPontoCidade = resPonto.data || [];
      const tunsMec = resTun.data || [];
      const bancMec = resBanc.data || [];
      const bauMec = resBau.data || [];

      let formatadosAud = [];
      if (dataAud && dataAud.length > 0) {
        formatadosAud = dataAud.map((r) => {
          const det = r.detalhes_json || { bau: [], bancada: [], tunagens: [] };
          const totTun = r.total_tunagens || (det.tunagens ? det.tunagens.length : 0);
          const totBanc = r.total_bancada || (det.bancada ? det.bancada.length : 0);
          const totBau = r.total_bau || (det.bau ? det.bau.length : 0);
          const valTun = r.valor_tunagens || (det.tunagens ? det.tunagens.reduce((a, t) => a + (parseFloat(t.valor_pago || t.valor) || 0), 0) : 0);
          const valBanc = r.valor_bancada || (det.bancada ? det.bancada.reduce((a, b) => a + (parseFloat(b.valor) || 0), 0) : 0);

          return {
            ...r,
            id: r.id_jogo,
            id_jogo: r.id_jogo,
            usuario_id: r.id_jogo,
            nome: r.nome,
            nome_personagem: r.nome,
            uuid_entrada: r.uuid_sessao,
            uuid_saida: r.saida ? r.uuid_sessao : null,
            observacao: r.justificativa || r.motivo_crash || null,
            detalhes: det,
            totalTunagens: totTun,
            valorTunagens: valTun,
            totalBancada: totBanc,
            valorBancada: valBanc,
            totalBau: totBau,
            infracao30min: r.infracao_30min,
            duracaoMin: r.duracao_min || ((r.entrada && r.saida) ? Math.round((new Date(r.saida) - new Date(r.entrada)) / 60000) : 0),
            statusPonto: r.status_ponto
          };
        });
      }

      // Unir as sessões de ponto_cidade_reds com as sessões auditadas sem perder nada
      const mapaLogs = new Map();

      // 1. Insere as auditadas (unificando por colaborador e entrada)
      formatadosAud.forEach((aud) => {
        const idColab = String(aud.id_jogo || aud.usuario_id || "");
        const key = idColab && aud.entrada ? `${idColab}_${aud.entrada}` : String(aud.uuid_entrada || aud.uuid_sessao);
        const existente = mapaLogs.get(key);
        if (!existente || (aud.total_tunagens || aud.total_bancada || aud.total_bau)) {
          mapaLogs.set(key, aud);
        }
      });

      // 2. Mescla as do ponto_cidade_reds
      logsPontoCidade.forEach((reg) => {
        const idColab = String(reg.id_jogo || reg.usuario_id || reg.id || "");
        const key = idColab && reg.entrada ? `${idColab}_${reg.entrada}` : String(reg.uuid_entrada);
        const existente = mapaLogs.get(key);
        if (!existente) {
          mapaLogs.set(key, reg);
        } else {
          mapaLogs.set(key, {
            ...reg,
            ...existente,
            saida: reg.saida || existente.saida,
            tempo: reg.tempo || existente.tempo
          });
        }
      });

      const listaFinal = Array.from(mapaLogs.values()).sort((a, b) => new Date(b.entrada) - new Date(a.entrada));

      // 3. Cruzamento Dinâmico de Atividades: Garante que sessões recentes sem auditoria pré-calculada mostrem suas tunagens, bancada e baú em tempo real
      listaFinal.forEach((s) => {
        const entTs = new Date(s.entrada).getTime();
        const saiTs = s.saida ? new Date(s.saida).getTime() : (entTs + 4 * 3600000);

        const det = s.detalhes || { tunagens: [], bancada: [], bau: [] };
        let tunagens = (det.tunagens && det.tunagens.length > 0) ? det.tunagens : [];
        let bancada = (det.bancada && det.bancada.length > 0) ? det.bancada : [];
        let bau = (det.bau && det.bau.length > 0) ? det.bau : [];

        // Se a sessão está sem atividades gravadas, busca nos logs reais do banco
        if (tunagens.length === 0 && tunsMec.length > 0) {
          tunagens = tunsMec.filter((t) => {
            const ts = t.timestampz ? new Date(t.timestampz).getTime() : (t.data && t.hora ? new Date(`${t.data}T${t.hora}-03:00`).getTime() : null);
            return ts && ts >= entTs - 60000 && ts <= saiTs + 60000;
          });
        }

        if (bancada.length === 0 && bancMec.length > 0) {
          bancada = bancMec.filter((b) => {
            const ts = b.timestampz ? new Date(b.timestampz).getTime() : (b.data && b.hora ? new Date(`${b.data}T${b.hora}-03:00`).getTime() : null);
            return ts && ts >= entTs - 60000 && ts <= saiTs + 60000;
          });
        }

        if (bau.length === 0 && bauMec.length > 0) {
          bau = bauMec.filter((b) => {
            const ts = b.timestampz ? new Date(b.timestampz).getTime() : (b.data && b.hora ? new Date(`${b.data}T${b.hora}-03:00`).getTime() : null);
            return ts && ts >= entTs - 60000 && ts <= saiTs + 60000;
          });
        }

        s.totalTunagens = tunagens.length;
        s.valorTunagens = tunagens.reduce((acc, t) => acc + (parseFloat(t.valor_pago || t.valor) || 0), 0);
        s.totalBancada = bancada.length;
        s.valorBancada = bancada.reduce((acc, b) => acc + (parseFloat(b.valor) || 0), 0);
        s.detalhes = { tunagens, bancada, bau };
      });

      // 4. Filtrar duplicatas fantasmas de saída avulsa (sessões de 0 min com entrada === saida que coincidem com a saída de uma sessão legítima)
      const listaLimpa = listaFinal.filter((s) => {
        const entTs = new Date(s.entrada).getTime();
        const saiTs = s.saida ? new Date(s.saida).getTime() : null;
        const ehZeroMin = entTs === saiTs || (!s.duracaoMin && !s.tempo);

        if (ehZeroMin && saiTs) {
          const temSessaoReal = listaFinal.some((outro) => {
            if (outro === s) return false;
            if (!outro.entrada || !outro.saida) return false;
            const oEntTs = new Date(outro.entrada).getTime();
            const oSaiTs = new Date(outro.saida).getTime();
            if (oEntTs === oSaiTs) return false;
            return Math.abs(oSaiTs - saiTs) <= 120000;
          });
          if (temSessaoReal) return false;
        }
        return true;
      });

      setLogsCompletosFunc(listaLimpa);
    } catch (err) {
      console.error(err);
    } finally {
      setCarregandoLogsFunc(false);
    }
  };

  React.useEffect(() => {
    if (funcModal?.func) {
      fetchAllLogsFunc(funcModal.func);
    } else {
      setLogsCompletosFunc([]);
    }
  }, [funcModal]);

  const [logs60Dias, setLogs60Dias] = useState([]);
  const [carregando60Dias, setCarregando60Dias] = useState(false);

  const fetchLogs60Dias = async () => {
    setCarregando60Dias(true);
    try {
      const agora = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
      const dataLimite = new Date(agora);
      dataLimite.setDate(agora.getDate() - 60);
      const dataLimiteStr = dataLimite.toLocaleDateString("en-CA");
      
      const { key: dataLimiteSemanaInicio } = obterLabelSemana(dataLimiteStr);
      const dataQueryInicio = dataLimiteSemanaInicio || dataLimiteStr;

      // 1. Buscar registros consolidados de auditoria (histórico dos meses anteriores)
      const { data: dataAud } = await supabase
        .from("sessoes_ponto_auditoria_reds")
        .select("id_jogo, nome, entrada, saida, uuid_sessao")
        .gte("entrada", `${dataQueryInicio}T00:00:00`)
        .limit(20000);

      // 2. Buscar registros em tempo real de ponto_cidade_reds
      let allData = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;
      while (hasMore && allData.length < 50000) {
        const { data, error } = await supabase
          .from("ponto_cidade_reds")
          .select("id, usuario_id, id_jogo, nome, nome_personagem, entrada, saida, uuid_entrada")
          .or("oculto.is.null,oculto.eq.false")
          .gte("entrada", `${dataQueryInicio}T00:00:00`)
          .order("entrada", { ascending: true })
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) throw error;
        if (data && data.length > 0) {
          allData = [...allData, ...data];
          if (data.length < pageSize) hasMore = false;
          else page++;
        } else {
          hasMore = false;
        }
      }

      // Unir as duas fontes sem duplicatas
      const mapaLogs = new Map();
      (dataAud || []).forEach(aud => {
        const key = String(aud.uuid_sessao || `${aud.id_jogo}_${aud.entrada}`);
        mapaLogs.set(key, {
          usuario_id: aud.id_jogo,
          id_jogo: aud.id_jogo,
          nome: aud.nome,
          nome_personagem: aud.nome,
          entrada: aud.entrada,
          saida: aud.saida
        });
      });

      allData.forEach(reg => {
        const key = String(reg.uuid_entrada || `${reg.id_jogo || reg.id}_${reg.entrada}`);
        const existente = mapaLogs.get(key);
        if (!existente) {
          mapaLogs.set(key, reg);
        } else {
          mapaLogs.set(key, {
            ...reg,
            ...existente,
            saida: reg.saida || existente.saida
          });
        }
      });

      setLogs60Dias(Array.from(mapaLogs.values()));
    } catch (err) {
      console.error("Erro ao buscar logs de 60 dias:", err);
    } finally {
      setCarregando60Dias(false);
    }
  };

  React.useEffect(() => {
    fetchLogs60Dias();
    // Sincroniza silenciosamente pontos novos do Discord para a tabela pontos_reds
    sincronizarPontosDiscordParaReds(supabase)
      .then(() => fetchLogs60Dias())
      .catch(() => {});
  }, []);

  const idsInativosAlerta = React.useMemo(() => {
    const ids = new Set();
    if (logs60Dias.length === 0) return ids;

    const agora = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const hojeStr = agora.toLocaleDateString("en-CA");

    listaFuncionarios.forEach(func => {
      // Cargos de liderança e donos não têm alerta de inatividade de metas
      const roleNorm = String(func.role || "").split("|")[0].toLowerCase().trim();
      if (roleNorm === "dono" || roleNorm === "admin" || roleNorm === "gerente" || roleNorm === "gerente_geral" || roleNorm === "gerente_rh") {
        return;
      }

      const logsFunc = logs60Dias.filter(reg => {
        const uid = reg.usuario_id || reg.id_jogo || reg.id;
        const fid = func.idJogo || func.id_jogo || func.id;
        if (uid && fid && String(uid) === String(fid)) return true;
        if (func.id && uid && String(uid) === String(func.id)) return true;

        const regNome = (reg.nome_personagem || reg.nome || "").toLowerCase().replace(/\s+/g, " ").trim();
        const funcNome = (func.nome || "").toLowerCase().replace(/\s+/g, " ").trim();
        if (regNome && funcNome && (regNome === funcNome || regNome.includes(funcNome) || funcNome.includes(regNome))) return true;
        return false;
      });

      // Se não houver data_admissao, usamos a data do primeiro registro de ponto nos últimos 60 dias como fallback
      let dataInicio = null;
      if (func.data_admissao) {
        dataInicio = new Date(`${func.data_admissao}T12:00:00`);
      } else if (logsFunc.length > 0) {
        const datas = logsFunc.map(r => r.entrada ? r.entrada.substring(0, 10) : r.data).filter(Boolean);
        if (datas.length > 0) {
          datas.sort();
          dataInicio = new Date(`${datas[0]}T12:00:00`);
        }
      }

      // Se não tiver nenhum registro nos 60 dias e nenhuma data de admissão, não gera alerta
      if (!dataInicio) return;

      const dataLimite60 = new Date(agora);
      dataLimite60.setDate(agora.getDate() - 60);
      const dataInicioAvaliacao = dataInicio > dataLimite60 ? dataInicio : dataLimite60;

      const semanasPossiveis = {};
      let temp = new Date(dataInicioAvaliacao);
      while (temp <= agora) {
        const yyyymmdd = temp.toLocaleDateString("en-CA");
        const { key, label } = obterLabelSemana(yyyymmdd);
        if (key) {
          semanasPossiveis[key] = { label, totalMinutos: 0 };
        }
        temp.setDate(temp.getDate() + 7);
      }
      const { key: hojeKey, label: hojeLabel } = obterLabelSemana(hojeStr);
      if (hojeKey) {
        semanasPossiveis[hojeKey] = { label: hojeLabel, totalMinutos: 0 };
      }

      logsFunc.forEach(reg => {
        if (!reg.entrada || !reg.saida) return;
        const dataRegStr = reg.entrada ? reg.entrada.substring(0, 10) : reg.data;
        const { key } = obterLabelSemana(dataRegStr);
        if (key && semanasPossiveis[key] !== undefined) {
          const diff = (new Date(reg.saida) - new Date(reg.entrada)) / 60000;
          if (diff > 0) {
            semanasPossiveis[key].totalMinutos += diff;
          }
        }
      });

      let semanasComPoucasHoras = 0;
      Object.keys(semanasPossiveis).forEach(weekKey => {
        const { key: semanaAtualKey } = obterLabelSemana(hojeStr);
        if (weekKey === semanaAtualKey) {
          return;
        }

        // Ignora a semana de início se começou no meio da semana (evitando penalizar contratação no meio da semana)
        const yyyymmddInicio = dataInicio.toLocaleDateString("en-CA");
        const { key: inicioWeekKey } = obterLabelSemana(yyyymmddInicio);
        if (weekKey === inicioWeekKey && yyyymmddInicio > inicioWeekKey) {
          return;
        }

        if (semanasPossiveis[weekKey].totalMinutos < 240) {
          semanasComPoucasHoras++;
        }
      });

      if (semanasComPoucasHoras >= 3) {
        ids.add(String(func.id));
      }
    });

    return ids;
  }, [logs60Dias, listaFuncionarios]);

  const [filtroPeriodo,    setFiltroPeriodo]    = useState("semana");
  const [filtroDataInicio, setFiltroDataInicio] = useState("");
  const [filtroDataFim,    setFiltroDataFim]    = useState("");
  const [semanaOffset,     setSemanaOffset]     = useState(() => {
    const agora = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    return agora.getDay() === 0 ? 0 : -1;
  });
  const [ordenacao,       setOrdenacao]       = useState("horas"); // "horas" | "nome"
  const [mostrarSemHoras, setMostrarSemHoras] = useState(true);
  const [jaGerou,         setJaGerou]         = useState(false);
  const [abaRelatorio,    setAbaRelatorio]    = useState("funcionarios"); // "funcionarios" | "cobertura" | "comparativo" | "sem_saida"
  const [diaSelecionado,  setDiaSelecionado]  = useState("");
  const [filtroApenasSemCobertura, setFiltroApenasSemCobertura] = useState(false);
  const [visualizacaoCobertura,   setVisualizacaoCobertura]   = useState("linha"); // "linha" | "detalhes"
  const [ocultarManuais, setOcultarManuais] = useState(true);
  const [ocultarDemitidos, setOcultarDemitidos] = useState(false);
  const [modalRelatorioMecanicasAberta, setModalRelatorioMecanicasAberta] = useState(false);
  const [linksCompartilhados, setLinksCompartilhados] = useState([]);
  const [gerandoLinkShare, setGerandoLinkShare] = useState(false);
  const [filtroBuscaSemSaida, setFiltroBuscaSemSaida] = useState("");
  const [analisandoAtividades, setAnalisandoAtividades] = useState(false);
  const [mapaAnaliseAtividades, setMapaAnaliseAtividades] = useState({});
  const [salvandoFechamento, setSalvandoFechamento] = useState(false);

  const executarAnaliseAtividadesSemSaida = async () => {
    if (pontosSemSaidaPeriodo.length === 0) {
      alert("Não há pontos sem saída no período selecionado.");
      return;
    }
    setAnalisandoAtividades(true);
    try {
      const { inicio, fim } = calcularDatasPeriodo(filtroPeriodo, semanaOffset, filtroDataInicio, filtroDataFim);
      const dataQueryInicio = inicio || "2026-01-01";
      const dataQueryFim = fim || "2026-12-31";
      const iniISO = new Date(`${dataQueryInicio}T00:00:00-03:00`).toISOString();
      const dtFimObj = new Date(`${dataQueryFim}T23:59:59-03:00`);
      dtFimObj.setDate(dtFimObj.getDate() + 2);
      const fimISO = dtFimObj.toISOString();
      const lookbackISO = new Date(new Date(iniISO).getTime() - 48 * 60 * 60 * 1000).toISOString();
      const UMA_HORA_MS = 60 * 60 * 1000;

      // 1. Buscar registros com lookback adequado e paginação para Discord logs
      const [resAud, resTun, resBanc] = await Promise.all([
        supabase
          .from("sessoes_ponto_auditoria_reds")
          .select("id_jogo, nome, entrada, saida, uuid_sessao, total_tunagens, total_bancada, total_bau, detalhes_json")
          .gte("entrada", lookbackISO)
          .lte("entrada", fimISO)
          .limit(10000),
        supabase
          .from("logs_tunagem")
          .select("tecnico_id, tecnico_nome, veiculo_nome, veiculo_modelo, placa, valor_pago, timestampz, data, hora")
          .gte("data", dataQueryInicio)
          .lte("data", dtFimObj.toLocaleDateString("en-CA"))
          .limit(10000),
        supabase
          .from("log_bancada_reds")
          .select("id, nome, item, quantidade, valor, timestampz, data, hora")
          .gte("data", dataQueryInicio)
          .lte("data", dtFimObj.toLocaleDateString("en-CA"))
          .limit(10000)
      ]);

      let allDiscordLogs = [];
      let pageDiscord = 0;
      while (pageDiscord < 10) {
        const { data: dData, error: dErr } = await supabase
          .from("discord_log_messages")
          .select("id, content, created_at")
          .eq("log_type", "ponto")
          .gte("created_at", lookbackISO)
          .lte("created_at", fimISO)
          .range(pageDiscord * 1000, (pageDiscord + 1) * 1000 - 1);
        if (dErr || !dData || dData.length === 0) break;
        allDiscordLogs.push(...dData);
        if (dData.length < 1000) break;
        pageDiscord++;
      }

      const auds = resAud.data || [];
      const tuns = resTun.data || [];
      const banc = resBanc.data || [];

      // Parser de eventos de ponto do Discord com extração de ID, Nome, Tipo e Timestamp exato
      const parseDiscordPonto = (l) => {
        const c = l.content || "";
        const isEntrou = c.includes("ENTROU EM SERVIÇO");
        const isSaiu = c.includes("SAIU DE SERVIÇO");
        if (!isEntrou && !isSaiu) return null;

        const dataMatch = c.match(/\[DATA\]:\s*(\d{2})\/(\d{2})\/(\d{4}),\s*(\d{2}):(\d{2}):(\d{2})/i);
        let ts = new Date(l.created_at).getTime();
        if (dataMatch) {
          const [_, d, m, y, h, min, s] = dataMatch;
          ts = new Date(`${y}-${m}-${d}T${h}:${min}:${s}-03:00`).getTime();
        }

        const idMatch = c.match(/\[ID\]:\s*(\d+)/i);
        const id = idMatch ? String(idMatch[1]).trim() : null;

        const nomeMatch = c.match(/\[ID\]:\s*\d+\s+([^(]+)/i) || c.match(/\[NOME\]:\s*([^\n\r]+)/i);
        const nome = nomeMatch ? nomeMatch[1].trim().toLowerCase() : null;

        return { id: l.id, tipo: isEntrou ? "entrada" : "saida", ts, idJogo: id, nome, raw: c };
      };

      const parsedDiscord = allDiscordLogs.map(parseDiscordPonto).filter(Boolean);

      const novoMapa = {};

      pontosSemSaidaPeriodo.forEach(p => {
        const chave = String(p.uuid_entrada || p.uuid_sessao || `${p.idJogoExibicao}_${p.entrada}`);
        const pEntTs = new Date(p.entrada).getTime();
        const idVal = String(p.idJogoExibicao || p.usuario_id || p.id || "").trim();
        const nomeNorm = (p.nomeExibicao || p.nome || "").toLowerCase().trim();

        // 1. Filtrar eventos de ponto do Discord deste colaborador
        const userDiscordEvs = parsedDiscord
          .filter(e => (idVal && e.idJogo === idVal) || (nomeNorm && e.nome && (e.nome.includes(nomeNorm) || nomeNorm.includes(e.nome))))
          .sort((a, b) => a.ts - b.ts);

        // Próximos eventos no Discord estritamente após esta entrada (+5 segundos de tolerância)
        const subsequentDiscordEvs = userDiscordEvs.filter(e => e.ts > pEntTs + 5000);
        const nextDiscordEv = subsequentDiscordEvs[0];

        // 2. Verificar próximas entradas em registrosRelatorio para delimitar limite superior
        const todasSessoesMec = (registrosRelatorio || []).filter(r => {
          const rId = String(r.idJogoExibicao || r.id || r.usuario_id || "").trim();
          const rNome = (r.nomeExibicao || r.nome || "").toLowerCase().trim();
          return (rId && rId === idVal) || (rNome && (rNome.includes(nomeNorm) || nomeNorm.includes(rNome)));
        });

        const proxEntradas = todasSessoesMec
          .map(r => new Date(r.entrada).getTime())
          .filter(ts => ts > pEntTs + 5000)
          .sort((a, b) => a - b);

        const proxEntradaRelatorioTs = proxEntradas.length > 0 ? proxEntradas[0] : null;

        // Limite máximo que qualquer atividade pode ser atribuída a este expediente
        let tetoSessaoTs = pEntTs + 12 * 3600000;
        if (nextDiscordEv && nextDiscordEv.tipo === "entrada") {
          tetoSessaoTs = Math.min(tetoSessaoTs, nextDiscordEv.ts);
        }
        if (proxEntradaRelatorioTs) {
          tetoSessaoTs = Math.min(tetoSessaoTs, proxEntradaRelatorioTs);
        }

        // 3. Coletar atividades reais (apenas tunagens e compras de bancada)
        const ativs = [];

        const aud = auds.find(a => 
          (p.uuid_entrada && (a.uuid_sessao === p.uuid_entrada || a.uuid_entrada === p.uuid_entrada)) ||
          (String(a.id_jogo).trim() === idVal && Math.abs(new Date(a.entrada).getTime() - pEntTs) < 180000)
        );
        const det = aud?.detalhes_json || {};

        (det.tunagens || []).forEach(t => {
          const ts = new Date(t.timestampz || t.timestamp || t.created_at).getTime();
          if (ts >= pEntTs - 60000 && ts <= tetoSessaoTs) {
            ativs.push({
              tipo: "tunagem",
              desc: `🚗 Tunagem: ${t.veiculo_nome || t.veiculo || "Veículo"}${t.placa ? ` (${t.placa})` : ""}`,
              ts,
              valor: parseFloat(t.valor_pago || t.valor) || 0
            });
          }
        });

        (det.bancada || []).forEach(b => {
          const ts = new Date(b.timestampz || b.timestamp || b.created_at).getTime();
          if (ts >= pEntTs - 60000 && ts <= tetoSessaoTs) {
            ativs.push({
              tipo: "bancada",
              desc: `🛠️ Bancada: ${b.item || b.nome_item || "Peças"}${b.quantidade ? ` x${b.quantidade}` : ""}`,
              ts,
              valor: parseFloat(b.valor) || 0
            });
          }
        });

        tuns.forEach(t => {
          if (String(t.tecnico_id).trim() === idVal || (t.tecnico_nome && t.tecnico_nome.toLowerCase().trim().includes(nomeNorm))) {
            const ts = t.timestampz ? new Date(t.timestampz).getTime() : (t.data && t.hora ? new Date(`${t.data}T${t.hora}-03:00`).getTime() : null);
            if (ts && ts >= pEntTs - 60000 && ts <= tetoSessaoTs) {
              ativs.push({
                tipo: "tunagem",
                desc: `🚗 Tunagem: ${t.veiculo_nome || t.veiculo_modelo || "Veículo"}${t.placa ? ` (${t.placa})` : ""}`,
                ts,
                valor: parseFloat(t.valor_pago) || 0
              });
            }
          }
        });

        banc.forEach(b => {
          if (String(b.id).trim() === idVal || (b.nome && b.nome.toLowerCase().trim().includes(nomeNorm))) {
            const ts = b.timestampz ? new Date(b.timestampz).getTime() : (b.data && b.hora ? new Date(`${b.data}T${b.hora}-03:00`).getTime() : null);
            if (ts && ts >= pEntTs - 60000 && ts <= tetoSessaoTs) {
              ativs.push({
                tipo: "bancada",
                desc: `🛠️ Bancada: ${b.item || "Compra de Peças"}${b.quantidade ? ` x${b.quantidade}` : ""}`,
                ts,
                valor: parseFloat(b.valor) || 0
              });
            }
          }
        });

        // Deduplicação e ordenação cronológica
        const dedup = [];
        ativs.sort((a, b) => a.ts - b.ts);
        ativs.forEach(a => {
          if (!dedup.some(d => d.tipo === a.tipo && Math.abs(d.ts - a.ts) < 5000)) {
            dedup.push(a);
          }
        });

        // 4. Aplicação das Regras Estritas do Sistema
        let saidaSugerida = p.entrada;
        let duracaoSugeridaMin = 0;
        let motivoSugerido = "";
        let ativsValidas = [];

        if (nextDiscordEv && nextDiscordEv.tipo === "saida") {
          // Caso 1: Saída oficial no Discord
          saidaSugerida = new Date(nextDiscordEv.ts).toISOString();
          duracaoSugeridaMin = Math.max(1, Math.round((nextDiscordEv.ts - pEntTs) / 60000));
          motivoSugerido = `Saída oficial do Discord registrada às ${new Date(nextDiscordEv.ts).toLocaleTimeString("pt-BR")}`;
          ativsValidas = dedup.filter(a => a.ts <= nextDiscordEv.ts);
        } else if (nextDiscordEv && nextDiscordEv.tipo === "entrada") {
          // Caso 2: Nova entrada registrada sem saída anterior
          const diffMs = nextDiscordEv.ts - pEntTs;
          if (diffMs <= UMA_HORA_MS) {
            // Reconexão rápida (queda / reinício em até 1 hora)
            saidaSugerida = new Date(nextDiscordEv.ts).toISOString();
            duracaoSugeridaMin = Math.max(1, Math.round(diffMs / 60000));
            motivoSugerido = `Fechado por reconexão rápida às ${new Date(nextDiscordEv.ts).toLocaleTimeString("pt-BR")}`;
            ativsValidas = dedup.filter(a => a.ts <= nextDiscordEv.ts);
          } else {
            // Mais de 1h de distância: encerra na última atividade antes de inatividade
            let ant = pEntTs;
            for (const a of dedup) {
              if (a.ts - ant > UMA_HORA_MS) break;
              ativsValidas.push(a);
              ant = a.ts;
            }
            if (ativsValidas.length > 0) {
              const ult = ativsValidas[ativsValidas.length - 1];
              saidaSugerida = new Date(ult.ts).toISOString();
              duracaoSugeridaMin = Math.max(1, Math.round((ult.ts - pEntTs) / 60000));
              motivoSugerido = `Inatividade (> 60m). Última atividade: ${ult.desc} às ${new Date(ult.ts).toLocaleTimeString("pt-BR")}`;
            } else {
              saidaSugerida = p.entrada;
              duracaoSugeridaMin = 0;
              motivoSugerido = "Sem atividades antes da próxima entrada (fechado em 0 min)";
            }
          }
        } else {
          // Caso 3: Não há próximo evento no Discord
          let ant = pEntTs;
          for (const a of dedup) {
            if (a.ts - ant > UMA_HORA_MS) break;
            ativsValidas.push(a);
            ant = a.ts;
          }
          if (ativsValidas.length > 0) {
            const ult = ativsValidas[ativsValidas.length - 1];
            saidaSugerida = new Date(ult.ts).toISOString();
            duracaoSugeridaMin = Math.max(1, Math.round((ult.ts - pEntTs) / 60000));
            motivoSugerido = `Última atividade antes de inatividade: ${ult.desc} às ${new Date(ult.ts).toLocaleTimeString("pt-BR")}`;
          } else {
            saidaSugerida = p.entrada;
            duracaoSugeridaMin = 0;
            motivoSugerido = "Miss-click / Sem atividades registradas (0 min)";
          }
        }

        const totalTunagens = ativsValidas.filter(a => a.tipo === "tunagem").length;
        const totalBancada = ativsValidas.filter(a => a.tipo === "bancada").length;

        novoMapa[chave] = {
          temAtividades: duracaoSugeridaMin > 0,
          totalAtividades: ativsValidas.length,
          totalTunagens,
          totalBancada,
          totalBau: 0,
          ultimaAtividade: ativsValidas.length > 0
            ? ativsValidas[ativsValidas.length - 1]
            : (duracaoSugeridaMin > 0 ? { desc: motivoSugerido, ts: new Date(saidaSugerida).getTime() } : null),
          saidaSugerida,
          duracaoSugeridaMin,
          motivoSugerido,
          atividadesLista: ativsValidas
        };
      });

      setMapaAnaliseAtividades(novoMapa);
    } catch (err) {
      console.error("Erro ao analisar atividades:", err);
      alert("Erro ao analisar atividades: " + err.message);
    } finally {
      setAnalisandoAtividades(false);
    }
  };

  const fecharPontoIndividual = async (item) => {
    const chave = String(item.uuid_entrada || item.uuid_sessao || `${item.idJogoExibicao}_${item.entrada}`);
    const analise = mapaAnaliseAtividades[chave];
    if (!analise) {
      alert("Por favor, execute a análise de atividades primeiro.");
      return;
    }

    const confirmMsg = analise.temAtividades
      ? `Deseja fechar o ponto de ${item.nomeExibicao} às ${new Date(analise.saidaSugerida).toLocaleTimeString("pt-BR")} (+${fmtMin(analise.duracaoSugeridaMin)}) baseado na última atividade (${analise.ultimaAtividade?.desc || analise.motivoSugerido})?`
      : `Nenhuma atividade detectada para ${item.nomeExibicao}. Deseja fechar o ponto com duração 0 min (mesma hora da entrada)?`;

    if (!confirm(confirmMsg)) return;

    try {
      let q = supabase.from("pontos_reds").update({
        saida: analise.saidaSugerida,
        tempo: analise.duracaoSugeridaMin
      });
      if (item.uuid_entrada) {
        q = q.eq("uuid_entrada", item.uuid_entrada);
      } else {
        q = q.eq("id", item.id || item.usuario_id).eq("entrada", item.entrada);
      }
      const { error: errP } = await q;
      if (errP) throw errP;

      if (item.uuid_entrada || item.uuid_sessao) {
        await supabase.from("sessoes_ponto_auditoria_reds").update({
          saida: analise.saidaSugerida,
          duracao_min: analise.duracaoSugeridaMin,
          motivo_crash: analise.motivoSugerido
        }).eq("uuid_sessao", item.uuid_entrada || item.uuid_sessao);
      }

      alert(`✅ Ponto de ${item.nomeExibicao} fechado com sucesso!`);
      aplicarFiltros();
    } catch (err) {
      console.error("Erro ao fechar ponto:", err);
      alert("Erro ao fechar ponto: " + err.message);
    }
  };

  const fecharTodosPontosAnalisados = async () => {
    const chaves = Object.keys(mapaAnaliseAtividades);
    if (chaves.length === 0) {
      alert("Execute a análise de atividades primeiro!");
      return;
    }

    const comAtiv = Object.values(mapaAnaliseAtividades).filter(a => a.temAtividades).length;
    const semAtiv = chaves.length - comAtiv;

    const confirmMsg = `⚠️ Deseja fechar todos os ${chaves.length} pontos sem saída analisados?\n\n` +
      `• ${comAtiv} pontos serão fechados no horário exato da última atividade de tunagem ou bancada.\n` +
      `• ${semAtiv} pontos sem atividades de serviço serão finalizados com 0 min (miss-clicks).\n\n` +
      `Esta ação atualizará o banco de dados e recalculará as horas no relatório.`;

    if (!confirm(confirmMsg)) return;

    setSalvandoFechamento(true);
    try {
      const lotePontos = [];
      pontosSemSaidaPeriodo.forEach(p => {
        const chave = String(p.uuid_entrada || p.uuid_sessao || `${p.idJogoExibicao}_${p.entrada}`);
        const analise = mapaAnaliseAtividades[chave];
        if (analise) {
          lotePontos.push({
            p,
            saida: analise.saidaSugerida,
            tempo: analise.duracaoSugeridaMin,
            observacao: analise.motivoSugerido,
            uuid: p.uuid_entrada || p.uuid_sessao,
            id: p.id || p.usuario_id,
            entrada: p.entrada
          });
        }
      });

      for (let i = 0; i < lotePontos.length; i += 25) {
        const slice = lotePontos.slice(i, i + 25);
        await Promise.all(
          slice.map(async (item) => {
            let q = supabase.from("pontos_reds").update({
              saida: item.saida,
              tempo: item.tempo
            });
            if (item.uuid) {
              q = q.eq("uuid_entrada", item.uuid);
            } else {
              q = q.eq("id", item.id).eq("entrada", item.entrada);
            }
            const { error: errP } = await q;
            if (errP) {
              console.error("Erro ao atualizar pontos_reds:", errP);
              throw errP;
            }

            if (item.uuid) {
              await supabase.from("sessoes_ponto_auditoria_reds").update({
                saida: item.saida,
                duracao_min: item.tempo,
                motivo_crash: item.observacao
              }).eq("uuid_sessao", item.uuid);
            }
          })
        );
      }

      setMapaAnaliseAtividades({});
      alert(`🎉 Sucesso! Todos os ${lotePontos.length} pontos foram fechados com sucesso no banco de dados!`);
      aplicarFiltros();
    } catch (err) {
      console.error("Erro ao fechar todos os pontos:", err);
      alert("Erro ao fechar pontos em lote: " + err.message);
    } finally {
      setSalvandoFechamento(false);
    }
  };

  const abrirAuditoriaSessao = async (sessao) => {
    setSessaoAuditModal(sessao);
    if (sessao.detalhes && (sessao.detalhes.tunagens?.length || sessao.detalhes.bancada?.length || sessao.detalhes.bau?.length)) {
      return;
    }
    try {
      let q = supabase.from("sessoes_ponto_auditoria_reds").select("*");
      if (sessao.uuid_entrada || sessao.uuid_sessao) {
        q = q.eq("uuid_sessao", sessao.uuid_entrada || sessao.uuid_sessao);
      } else if (sessao.entrada && (sessao.id_jogo || sessao.usuario_id)) {
        const idVal = sessao.id_jogo || sessao.usuario_id;
        q = q.eq("id_jogo", idVal).eq("entrada", sessao.entrada);
      } else {
        return;
      }
      const { data, error } = await q.maybeSingle();
      if (!error && data && (data.total_tunagens || (data.detalhes_json && (data.detalhes_json.tunagens?.length || data.detalhes_json.bancada?.length || data.detalhes_json.bau?.length)))) {
        setSessaoAuditModal(prev => {
          if (!prev) return null;
          const det = data.detalhes_json || { tunagens: [], bancada: [], bau: [] };
          return {
            ...prev,
            ...data,
            detalhes: det,
            totalTunagens: data.total_tunagens ?? det.tunagens?.length ?? 0,
            totalBancada: data.total_bancada ?? det.bancada?.length ?? 0,
            totalBau: data.total_bau ?? det.bau?.length ?? 0,
            valorTunagens: data.valor_tunagens ?? (det.tunagens?.reduce((a, t) => a + (parseFloat(t.valor_pago || t.valor) || 0), 0) || 0),
            valorBancada: data.valor_bancada ?? (det.bancada?.reduce((a, b) => a + (parseFloat(b.valor) || 0), 0) || 0),
          };
        });
      } else {
        // Fallback dinâmico: busca direto nas tabelas de tunagem, bancada e bau para este intervalo
        const idMec = String(sessao.id_jogo || sessao.usuario_id || sessao.id || "").trim();
        const nomeMec = (sessao.nome || sessao.nome_personagem || "").trim();
        const entTs = new Date(sessao.entrada).getTime();
        const saiTs = sessao.saida ? new Date(sessao.saida).getTime() : (entTs + 4 * 3600000);

        let qT = supabase.from("logs_tunagem_reds").select("*");
        if (idMec) qT = qT.or(`tecnico_id.eq.${idMec},tecnico_nome.ilike.%${nomeMec}%`);
        let qB = supabase.from("log_bancada_reds").select("id, nome, data, hora, timestampz, uuid");
        if (idMec) qB = qB.or(`id.eq.${idMec},nome.ilike.%${nomeMec}%`);
        let qBau = supabase.from("log_bau_reds").select("id, nome, data, hora, timestampz, uuid");
        if (idMec) qBau = qBau.or(`id.eq.${idMec},nome.ilike.%${nomeMec}%`);

        const [rT, rB, rBau] = await Promise.all([qT, qB, qBau]);
        const tunagens = (rT.data || []).filter(t => {
          const ts = t.timestampz ? new Date(t.timestampz).getTime() : (t.data && t.hora ? new Date(`${t.data}T${t.hora}-03:00`).getTime() : null);
          return ts && ts >= entTs - 60000 && ts <= saiTs + 60000;
        });
        const bancada = (rB.data || []).filter(b => {
          const ts = b.timestampz ? new Date(b.timestampz).getTime() : (b.data && b.hora ? new Date(`${b.data}T${b.hora}-03:00`).getTime() : null);
          return ts && ts >= entTs - 60000 && ts <= saiTs + 60000;
        });
        const bau = (rBau.data || []).filter(b => {
          const ts = b.timestampz ? new Date(b.timestampz).getTime() : (b.data && b.hora ? new Date(`${b.data}T${b.hora}-03:00`).getTime() : null);
          return ts && ts >= entTs - 60000 && ts <= saiTs + 60000;
        });

        setSessaoAuditModal(prev => {
          if (!prev) return null;
          return {
            ...prev,
            detalhes: { tunagens, bancada, bau },
            totalTunagens: tunagens.length,
            valorTunagens: tunagens.reduce((a, t) => a + (parseFloat(t.valor_pago || t.valor) || 0), 0),
            totalBancada: bancada.length,
            valorBancada: bancada.reduce((a, b) => a + (parseFloat(b.valor) || 0), 0),
            totalBau: bau.length
          };
        });
      }
    } catch (err) {
      console.warn("Aviso ao buscar detalhes de auditoria:", err);
    }
  };

  const abrirHistoricoFunc = (item) => {
    const funcObj = item.funcRef || {
      id: item.usuario_id || item.id_jogo || item.id,
      idJogo: item.id_jogo || item.usuario_id || item.id,
      nome: item.nomeExibicao || item.nome_personagem || item.nome,
      cargo: item.cargoExibicao || item.cargo
    };
    setFuncModal({ func: funcObj, status: "aberto" });
    fetchAllLogsFunc(funcObj);
  };

  const filtrarManuais = (regs) => {
    if (!ocultarManuais) return regs;
    return regs.filter(r => {
      const ehAutomaticoCompleto = r.uuid_entrada && r.uuid_saida;
      const ehEstimadoPorBancada = r.uuid_entrada && r.observacao && r.observacao.toLowerCase().includes("bancada");
      return ehAutomaticoCompleto || ehEstimadoPorBancada;
    });
  };

  const aplicarFiltros = (overridePeriodo, overrideOffset) => {
    const periodo = overridePeriodo !== undefined ? overridePeriodo : filtroPeriodo;
    const offset  = overrideOffset  !== undefined ? overrideOffset  : semanaOffset;
    const { inicio, fim } = calcularDatasPeriodo(periodo, offset, filtroDataInicio, filtroDataFim);
    buscarRelatorio({ dataInicio: inicio, dataFim: fim });
    setJaGerou(true);
  };

  const buscarLinksCompartilhados = async () => {
    try {
      const { data, error } = await supabase
        .from("relatorios_compartilhados")
        .select("*")
        .order("criado_em", { ascending: false });
      if (!error && data) {
        setLinksCompartilhados(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const criarLinkCompartilhado = async () => {
    try {
      setGerandoLinkShare(true);
      const { inicio, fim } = calcularDatasPeriodo(filtroPeriodo, semanaOffset, filtroDataInicio, filtroDataFim);
      if (!inicio || !fim) {
        alert("⚠️ Selecione um período válido antes de gerar o link!");
        setGerandoLinkShare(false);
        return;
      }
      
      const { data, error } = await supabase
        .from("relatorios_compartilhados")
        .insert({
          tipo: "comparativo_mecanicas",
          data_inicio: inicio,
          data_fim: fim,
          excluir_manuais: true, // Requisito: desconsiderar pontos manuais
          criado_por: usuarioLogado?.nome || "Admin"
        })
        .select()
        .single();

      if (error) throw error;
      
      alert("✅ Link público gerado com sucesso! Você pode copiá-lo na lista abaixo.");
      buscarLinksCompartilhados();
    } catch (err) {
      console.error("Erro ao gerar link de compartilhamento:", err);
      alert("❌ Falha ao gerar link: " + err.message);
    } finally {
      setGerandoLinkShare(false);
    }
  };

  const deletarLinkCompartilhado = async (id) => {
    if (!confirm("⚠️ Tem certeza de que deseja apagar este compartilhamento? O link deixará de funcionar imediatamente para pessoas externas.")) return;
    try {
      const { error } = await supabase
        .from("relatorios_compartilhados")
        .delete()
        .eq("id", id);
      if (error) throw error;
      alert("🗑️ Compartilhamento excluído com sucesso!");
      buscarLinksCompartilhados();
    } catch (err) {
      console.error(err);
      alert("❌ Falha ao excluir link: " + err.message);
    }
  };

  React.useEffect(() => {
    aplicarFiltros();
    buscarLinksCompartilhados();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Agrupar registros por usuario_id / id_jogo / id e fallback por nome
  const byUid = {};
  const byNome = {};
  const registrosRelatorioFiltrados = filtrarManuais(registrosRelatorio);
  registrosRelatorioFiltrados.forEach(reg => {
    const uid = reg.usuario_id || reg.id_jogo || reg.id;
    if (uid) {
      const uidStr = String(uid);
      if (!byUid[uidStr]) byUid[uidStr] = [];
      byUid[uidStr].push(reg);
    }
    const nomeNorm = (reg.nome_personagem || reg.nome || "").toLowerCase().replace(/\s+/g, " ").trim();
    if (nomeNorm) {
      if (!byNome[nomeNorm]) byNome[nomeNorm] = [];
      byNome[nomeNorm].push(reg);
    }
  });

  const processarFuncion = (func) => {
    const fid = func.idJogo || func.id_jogo || func.id;
    const regsVinculados = [
      ...(fid && byUid[String(fid)] ? byUid[String(fid)] : []),
      ...(func.id && byUid[String(func.id)] && String(func.id) !== String(fid) ? byUid[String(func.id)] : [])
    ];
    const funcNomeNorm = (func.nome || "").toLowerCase().replace(/\s+/g, " ").trim();
    const regsOrfaos = funcNomeNorm ? (byNome[funcNomeNorm] || []) : [];
    
    // Evita duplicatas ao mesclar por ID ou UUID (não usando reg.id pois reg.id é o passaporte)
    let todosRegs = [];
    const vistos = new Set();
    [...regsVinculados, ...regsOrfaos].forEach(reg => {
      const key = String(reg.uuid_entrada || reg.uuid || `${reg.usuario_id || reg.id}_${reg.entrada}_${reg.saida}`);
      if (!vistos.has(key)) {
        vistos.add(key);
        todosRegs.push(reg);
      }
    });

    let totalMin = 0, sessoes = 0, abertas = 0, idJogo = null;
    todosRegs.forEach(reg => {
      if (reg.oculto) return; // Ignora registros ocultos
      if (!idJogo && reg.id_jogo) idJogo = reg.id_jogo;
      if (reg.entrada && reg.saida) {
        const diff = (new Date(reg.saida) - new Date(reg.entrada)) / 60000;
        if (diff > 0) { totalMin += diff; sessoes++; }
      } else if (reg.entrada && !reg.saida) {
        const diffEntrada = (Date.now() - new Date(reg.entrada).getTime()) / 60000;
        if (diffEntrada >= 0 && diffEntrada <= 60) {
          abertas++;
        }
      }
    });
    return { ...func, totalMin, sessoes, abertas, idJogo };
  };

  const { inicio: periodoInicio, fim: periodoFim } = calcularDatasPeriodo(
    filtroPeriodo, semanaOffset, filtroDataInicio, filtroDataFim
  );
  const dataFimLimite = periodoFim ? new Date(`${periodoFim}T23:59:59`) : null;

  // Funcionários que estavam contratados ou trabalharam no período do relatório
  const funcionariosAtivos = listaFuncionarios
    .map(processarFuncion)
    .filter(f => {
      // Regra especial: se a opção de ocultar demitidos estiver ativa e ele não for ativo hoje
      const estaAtivoHoje = !f.status || f.status === "ativo";
      if (ocultarDemitidos && !estaAtivoHoje) {
        return false;
      }

      // 1. Se trabalhou (teve horas ou sessões) no período, sempre deve aparecer
      const trabalhouNoPeriodo = f.totalMin > 0 || f.sessoes > 0 || f.abertas > 0;
      if (trabalhouNoPeriodo) {
        return true;
      }

      // 2. Se não trabalhou, verifica se ele estava sob contrato (ativo) em algum momento do período filtrado
      if (periodoInicio && periodoFim) {
        const pInicio = new Date(`${periodoInicio}T00:00:00`);
        const pFim = new Date(`${periodoFim}T23:59:59`);

        const admissoes = f.data_admissao ? f.data_admissao.split(",").map(d => d.trim()).filter(Boolean) : [];
        const demissoes = f.data_demissao ? f.data_demissao.split(",").map(d => d.trim()).filter(Boolean) : [];

        // Montar os intervalos de contratação
        // Para cada admissão, o seu fim correspondente é a demissão de mesmo índice, ou Infinity se não houver
        const estavaContratado = admissoes.some((admStr, idx) => {
          const dAdmissao = new Date(`${admStr}T00:00:00`);
          const demStr = demissoes[idx];
          const dDemissao = demStr ? new Date(`${demStr}T23:59:59`) : null;

          // Se a admissão é posterior ao fim do período, este intervalo não conta
          if (dAdmissao > pFim) return false;

          // Se houve demissão e ela é anterior ao início do período, este intervalo já terminou
          if (dDemissao && dDemissao < pInicio) return false;

          // Se o funcionário está demitido/inativo hoje e não há data de demissão para este intervalo, não exibimos
          const estaAtivoHoje = !f.status || f.status === "ativo";
          if (!estaAtivoHoje && !dDemissao) {
            return false;
          }

          // Caso contrário, o intervalo de contratação sobrepõe o período filtrado!
          return true;
        });

        if (estavaContratado) {
          return true;
        }

        // Se ele tem datas de admissão cadastradas mas nenhuma sobrepõe o período, ele não era contratado nesta época
        if (admissoes.length > 0) {
          return false;
        }
      }

      // 3. Se não tem data de admissão cadastrada e não trabalhou, mas está ativo hoje, mantemos na lista por garantia
      if (estaAtivoHoje) {
        return true;
      }

      return false;
    });

  if (ordenacao === "horas") {
    funcionariosAtivos.sort((a, b) => b.totalMin - a.totalMin);
  } else if (ordenacao === "id") {
    funcionariosAtivos.sort((a, b) => {
      const idA = a.idJogo ? Number(a.idJogo) : Number(a.id);
      const idB = b.idJogo ? Number(b.idJogo) : Number(b.id);
      return idA - idB;
    });
  } else {
    funcionariosAtivos.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }

  const dadosFuncionarios = mostrarSemHoras
    ? funcionariosAtivos
    : funcionariosAtivos.filter(r => r.totalMin > 0);

  // Registros não vinculados a nenhum funcionário do sistema
  const naoVinculados = (() => {
    const linkedIds = new Set(listaFuncionarios.map(f => String(f.id)));
    const linkedNomes = new Set(listaFuncionarios.map(f => f.nome ? f.nome.toLowerCase().trim() : ""));
    const mapa = {};
    const registrosRelatorioFiltradosLocal = filtrarManuais(registrosRelatorio);
    registrosRelatorioFiltradosLocal.forEach(reg => {
      const uid = reg.usuario_id || reg.id || reg.id_jogo;
      const foiVinculadoPorId = uid && linkedIds.has(String(uid));
      const foiVinculadoPorNome = reg.nome && linkedNomes.has(reg.nome.toLowerCase().trim());

      if (!foiVinculadoPorId && !foiVinculadoPorNome) {
        const key = reg.id_jogo || reg.id || reg.nome;
        if (!mapa[key]) mapa[key] = { id_jogo: reg.id_jogo || reg.id, nome: reg.nome, totalMin: 0, sessoes: 0 };
        if (reg.entrada && reg.saida) {
          const diff = (new Date(reg.saida) - new Date(reg.entrada)) / 60000;
          if (diff > 0) { mapa[key].totalMin += diff; mapa[key].sessoes++; }
        }
      }
    });
    return Object.values(mapa);
  })();

  const totalGeralMin = dadosFuncionarios.reduce((acc, r) => acc + r.totalMin, 0);
  const funcAtivos    = dadosFuncionarios.filter(r => r.totalMin > 0).length;
  const totalSessoes  = dadosFuncionarios.reduce((acc, r) => acc + r.sessoes, 0);

  const pontosSemSaidaPeriodo = React.useMemo(() => {
    const regs = registrosRelatorio || [];
    const mapaFuncPorId = new Map();
    const mapaFuncPorNome = new Map();
    (listaFuncionarios || []).forEach(f => {
      const fid = f.idJogo || f.id_jogo || f.id;
      if (fid) mapaFuncPorId.set(String(fid), f);
      if (f.id) mapaFuncPorId.set(String(f.id), f);
      if (f.nome) mapaFuncPorNome.set(f.nome.toLowerCase().trim(), f);
    });

    const lista = [];
    const vistos = new Set();

    regs.forEach(reg => {
      if (reg.oculto || !reg.entrada) return;
      if (ocultarManuais && reg.manual === true) return;
      
      const dEntrada = new Date(reg.entrada);
      if (isNaN(dEntrada.getTime())) return;

      let semSaida = false;
      let motivo = "";

      if (!reg.saida) {
        semSaida = true;
        motivo = "Sem registro de saída (Ponto em aberto)";
      } else {
        const dSaida = new Date(reg.saida);
        if (isNaN(dSaida.getTime()) || reg.saida === reg.entrada || dSaida <= dEntrada) {
          semSaida = true;
          motivo = "Saída igual à entrada (0 min / Miss-click)";
        } else if (reg.tempo === 0 || (reg.duracao_min !== undefined && reg.duracao_min === 0) || (reg.duracaoMin !== undefined && reg.duracaoMin === 0)) {
          semSaida = true;
          motivo = "Duração zerada (0 min)";
        }
      }

      if (semSaida) {
        const key = String(reg.uuid_entrada || reg.uuid_sessao || `${reg.usuario_id || reg.id_jogo || reg.id}_${reg.entrada}`);
        if (vistos.has(key)) return;
        vistos.add(key);

        const uid = reg.usuario_id || reg.id_jogo || reg.id;
        const nomeReg = reg.nome_personagem || reg.nome || "";
        const func = (uid && mapaFuncPorId.get(String(uid))) || (nomeReg && mapaFuncPorNome.get(nomeReg.toLowerCase().trim())) || null;

        const durMin = (reg.entrada && reg.saida) ? Math.max(0, Math.round((new Date(reg.saida) - new Date(reg.entrada)) / 60000)) : 0;

        lista.push({
          ...reg,
          funcRef: func,
          motivoSemSaida: reg.observacao || motivo,
          nomeExibicao: func?.nome || nomeReg || "Desconhecido",
          idJogoExibicao: func?.idJogo || func?.id_jogo || uid || "—",
          cargoExibicao: func?.cargo || reg.cargo || "",
          durMinCalculada: durMin
        });
      }
    });

    return lista.sort((a, b) => new Date(b.entrada) - new Date(a.entrada));
  }, [registrosRelatorio, ocultarManuais, listaFuncionarios]);

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

  // Lógica para aba Comparativo
  const metricasM1 = React.useMemo(() => {
    return calcularMetricasMecanica(filtrarManuais(registrosRelatorio), diasPeriodo);
  }, [registrosRelatorio, diasPeriodo, ocultarManuais]);

  const metricasM2 = React.useMemo(() => {
    return calcularMetricasMecanica(filtrarManuais(registrosRelatorioM2), diasPeriodo);
  }, [registrosRelatorioM2, diasPeriodo, ocultarManuais]);

  const metricasM3 = React.useMemo(() => {
    return calcularMetricasMecanica(filtrarManuais(registrosRelatorioM3), diasPeriodo);
  }, [registrosRelatorioM3, diasPeriodo, ocultarManuais]);

  const rankingMecanicas = React.useMemo(() => {
    const arr = [
      { id: "m1", nome: "RED's Tunershop", cor: "#ef4444", ...metricasM1 },
      { id: "m2", nome: "Harmony", cor: "#eab308", ...metricasM2 },
      { id: "m3", nome: "Dudark", cor: "#38bdf8", ...metricasM3 },
    ];
    return arr.sort((a, b) => b.taxaCobertura - a.taxaCobertura || b.totalMin - a.totalMin);
  }, [metricasM1, metricasM2, metricasM3]);

  const rankingMecanicasObrigatorias = React.useMemo(() => {
    const arr = [
      { id: "m1", nome: "RED's Tunershop", cor: "#ef4444", ...metricasM1 },
      { id: "m2", nome: "Harmony", cor: "#eab308", ...metricasM2 },
      { id: "m3", nome: "Dudark", cor: "#38bdf8", ...metricasM3 },
    ];
    return arr.sort((a, b) => b.taxaCoberturaObrigatoria - a.taxaCoberturaObrigatoria || b.totalMin - a.totalMin);
  }, [metricasM1, metricasM2, metricasM3]);

  // Função auxiliar para calcular minutos ativos de funcionários apenas no horário obrigatório (19h às 22h)
  const calcularRankingFuncionariosObrigatorio = (registros, filtrarMecanicaId = null) => {
    const mapa = {};
    const linkedIds = new Set(listaFuncionarios.map(f => String(f.id)));
    const linkedNomes = new Set(listaFuncionarios.map(f => f.nome ? f.nome.toLowerCase().trim() : ""));

    registros.forEach(reg => {
      if (reg.oculto) return;
      if (!reg.entrada || !reg.saida) return;

      const tEntrada = new Date(reg.entrada);
      const tSaida = new Date(reg.saida);

      // Iterar pelos dias do período para calcular a intersecção com o horário obrigatório (19h às 22h) do dia
      diasPeriodo.forEach(dia => {
        const infoObr = getHorarioObrigatorioParaData(dia);
        const limiteInicio = new Date(`${dia}T${infoObr.horaInicio}-03:00`);
        const limiteFim = new Date(`${dia}T${infoObr.horaFim}-03:00`);

        const startIntersect = Math.max(tEntrada.getTime(), limiteInicio.getTime());
        const endIntersect = Math.min(tSaida.getTime(), limiteFim.getTime());
        const diff = (endIntersect - startIntersect) / 60000;

        if (diff > 0) {
          // Achar nome do funcionário
          let funcNome = reg.nome || reg.nome_personagem;
          if (reg.usuario_id) {
            const f = listaFuncionarios.find(u => String(u.id) === String(reg.usuario_id));
            if (f) funcNome = f.nome;
          }

          if (funcNome) {
            const key = funcNome.trim();
            if (!mapa[key]) mapa[key] = { nome: key, minutos: 0, idJogo: reg.id_jogo, mecanica: reg.origin || "reds" };
            mapa[key].minutos += diff;
          }
        }
      });
    });

    return Object.values(mapa)
      .sort((a, b) => b.minutos - a.minutos)
      .slice(0, 3);
  };

  const rankingFuncionariosObrigatorioReds = React.useMemo(() => {
    const regsWithOrigin = filtrarManuais(registrosRelatorio).map(r => ({ ...r, origin: "reds" }));
    return calcularRankingFuncionariosObrigatorio(regsWithOrigin);
  }, [registrosRelatorio, diasPeriodo, listaFuncionarios, ocultarManuais]);

  const rankingFuncionariosObrigatorioGeral = React.useMemo(() => {
    const todosRegs = [
      ...filtrarManuais(registrosRelatorio).map(r => ({ ...r, origin: "reds" })),
      ...filtrarManuais(registrosRelatorioM2).map(r => ({ ...r, origin: "harmony" })),
      ...filtrarManuais(registrosRelatorioM3).map(r => ({ ...r, origin: "dudark" }))
    ];
    return calcularRankingFuncionariosObrigatorio(todosRegs);
  }, [registrosRelatorio, registrosRelatorioM2, registrosRelatorioM3, diasPeriodo, listaFuncionarios, ocultarManuais]);

  const coberturaComparativa = React.useMemo(() => {
    const res = {};
    diasPeriodo.forEach(dia => {
      res[dia] = {
        m1: calcularSlotsGenerico(filtrarManuais(registrosRelatorio), dia),
        m2: calcularSlotsGenerico(filtrarManuais(registrosRelatorioM2), dia),
        m3: calcularSlotsGenerico(filtrarManuais(registrosRelatorioM3), dia),
      };
    });
    return res;
  }, [diasPeriodo, registrosRelatorio, registrosRelatorioM2, registrosRelatorioM3, ocultarManuais]);

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
      const registrosRelatorioFiltradosLocal = filtrarManuais(registrosRelatorio);
      
      registrosRelatorioFiltradosLocal.forEach(reg => {
        if (reg.oculto || !reg.entrada) return;
        
        const entradaDate = new Date(reg.entrada);
        const saidaDate = obterSaidaValida(reg);
        if (!saidaDate) return;
        
        if (entradaDate < slot.end && saidaDate > slot.start) {
          let funcNome = reg.nome || reg.nome_personagem || `ID: ${reg.id_jogo}`;
          if (reg.usuario_id) {
            const f = listaFuncionarios.find(u => String(u.id) === String(reg.usuario_id));
            if (f) funcNome = f.nome;
          }
          
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
  }, [registrosRelatorio, listaFuncionarios, ocultarManuais]);

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

  const inputSmall = { ...styles.input, padding: "5px 10px", fontSize: "13px", height: "32px" };
  const cardStyle  = { ...styles.whiteCard, marginBottom: "16px", padding: "16px 20px" };

  const semanaLabel = (() => {
    const agora = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const defOff = agora.getDay() === 0 ? 0 : -1;
    if (semanaOffset === defOff) return "🗓 Última semana completa";
    if (semanaOffset === 0)      return "🗓 Semana atual";
    if (semanaOffset === -1)     return "🗓 Semana passada";
    return `🗓 ${Math.abs(semanaOffset)} sem. atrás`;
  })();

  const colunasHeader = ["#", "ID Jogo", "Funcionário", "Cargo", "Total de Horas", "Sessões", "Status"];

  const renderModalAuditoriaSessao = () => {
    if (!sessaoAuditModal) return null;
    const activeAudit = (sessaoAuditModal.detalhes?.tunagens?.length || sessaoAuditModal.detalhes?.bancada?.length || sessaoAuditModal.detalhes?.bau?.length)
      ? sessaoAuditModal
      : (logsCompletosFunc?.find(l => {
          if (sessaoAuditModal.uuid_entrada && (l.uuid_sessao === sessaoAuditModal.uuid_entrada || l.uuid_entrada === sessaoAuditModal.uuid_entrada)) return true;
          if (l.entrada && sessaoAuditModal.entrada) {
            return Math.abs(new Date(l.entrada).getTime() - new Date(sessaoAuditModal.entrada).getTime()) < 180000;
          }
          return false;
        }) || sessaoAuditModal);

    const det = activeAudit.detalhes || { tunagens: [], bancada: [], bau: [] };
    const listTun = det.tunagens || [];
    const listBanc = det.bancada || [];
    const listBau = det.bau || [];
    const valTun = activeAudit.valorTunagens || listTun.reduce((a, t) => a + (parseFloat(t.valor_pago || t.valor) || 0), 0);
    const valBanc = activeAudit.valorBancada || listBanc.reduce((a, b) => a + (parseFloat(b.valor) || 0), 0);
    const nomeAudit = activeAudit.nome || activeAudit.nome_personagem || activeAudit.nomeExibicao || (funcModal?.func?.nome) || "Mecânico";
    const idJogoAudit = activeAudit.id_jogo || activeAudit.usuario_id || activeAudit.id || (funcModal?.func?.idJogo) || (funcModal?.func?.id) || "—";

    return (
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.85)",
          backdropFilter: "blur(10px)",
          zIndex: 100005,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px"
        }}
        onClick={() => setSessaoAuditModal(null)}
      >
        <div
          style={{
            background: "#0f172a",
            border: "1.5px solid rgba(56, 189, 248, 0.3)",
            borderRadius: "20px",
            width: "100%",
            maxWidth: "680px",
            maxHeight: "85vh",
            overflowY: "auto",
            padding: "24px",
            color: "#fff",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.8)"
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid rgba(255, 255, 255, 0.1)", paddingBottom: "16px", marginBottom: "16px" }}>
            <div>
              <span style={{ fontSize: "11px", color: "#38bdf8", fontWeight: "800", textTransform: "uppercase" }}>
                🔍 Auditoria de Atividades no Expediente
              </span>
              <h2 style={{ fontSize: "18px", fontWeight: "900", color: "#fff", margin: "4px 0" }}>
                {nomeAudit} <span style={{ color: "#94a3b8", fontSize: "14px" }}>(ID: {idJogoAudit})</span>
              </h2>
              <div style={{ fontSize: "12px", color: "#cbd5e1" }}>
                ⏱️ <strong>{activeAudit.duracaoMin || Math.round((new Date(activeAudit.saida) - new Date(activeAudit.entrada)) / 60000) || 0} min de serviço</strong> &bull; {new Date(activeAudit.entrada).toLocaleString("pt-BR")} até {activeAudit.saida ? new Date(activeAudit.saida).toLocaleTimeString("pt-BR") : "Em Aberto"}
              </div>
            </div>

            <button
              onClick={() => setSessaoAuditModal(null)}
              style={{
                background: "rgba(255, 255, 255, 0.1)",
                border: "none",
                color: "#cbd5e1",
                borderRadius: "8px",
                padding: "6px 12px",
                fontSize: "14px",
                cursor: "pointer",
                fontWeight: "bold"
              }}
            >
              ✕
            </button>
          </div>

          {/* TUNAGENS */}
          <div style={{ marginBottom: "20px" }}>
            <div style={{ fontSize: "13px", fontWeight: "800", color: "#22c55e", marginBottom: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>🚗 Tunagens no Expediente ({listTun.length || activeAudit.totalTunagens || 0})</span>
              <span style={{ fontSize: "13px", color: "#4ade80", fontWeight: "800" }}>
                R$ {valTun.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </span>
            </div>
            {listTun.length === 0 ? (
              <div style={{ fontSize: "12px", color: "#64748b", fontStyle: "italic", background: "rgba(255,255,255,0.02)", padding: "10px", borderRadius: "8px" }}>Nenhuma tunagem realizada neste expediente.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {listTun.map((t, tIdx) => (
                  <div key={tIdx} style={{ background: "rgba(34, 197, 94, 0.05)", border: "1px solid rgba(34, 197, 94, 0.2)", borderRadius: "8px", padding: "10px 14px", fontSize: "12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong>🚗 {t.veiculo_nome || t.veiculo || t.veiculo_modelo || "Veículo"}</strong>
                      <span style={{ color: "#4ade80", fontWeight: "800" }}>R$ {(parseFloat(t.valor_pago || t.valor) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "4px", display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
                      {t.placa && <span style={{ background: "rgba(255,255,255,0.08)", padding: "1px 6px", borderRadius: "4px", fontWeight: "600", color: "#cbd5e1" }}>🔖 {t.placa}</span>}
                      {(t.dono_nome || t.cliente_nome) && <span>👤 Cliente: {t.dono_nome || t.cliente_nome} {(t.dono_id || t.cliente_id) ? `(ID: ${t.dono_id || t.cliente_id})` : ""}</span>}
                      {(t.baia_nome || t.baia) && <span>🏷️ Baia: {t.baia_nome || t.baia}</span>}
                      {(t.timestampz || t.created_at || t.timestamp) && <span>🕒 {new Date(t.timestampz || t.created_at || t.timestamp).toLocaleTimeString("pt-BR")}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* COMPRAS NA BANCADA */}
          <div style={{ marginBottom: "20px" }}>
            <div style={{ fontSize: "13px", fontWeight: "800", color: "#c084fc", marginBottom: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>🛠️ Compras na Bancada ({listBanc.length || activeAudit.totalBancada || 0})</span>
              <span style={{ fontSize: "13px", color: "#e9d5ff", fontWeight: "800" }}>
                ${valBanc.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </span>
            </div>
            {listBanc.length === 0 ? (
              <div style={{ fontSize: "12px", color: "#64748b", fontStyle: "italic", background: "rgba(255,255,255,0.02)", padding: "10px", borderRadius: "8px" }}>Nenhuma compra na bancada realizada neste expediente.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {listBanc.map((b, bIdx) => (
                  <div key={bIdx} style={{ background: "rgba(192, 132, 252, 0.05)", border: "1px solid rgba(192, 132, 252, 0.2)", borderRadius: "8px", padding: "10px 14px", fontSize: "12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong>🛠️ {b.item || b.nomeItem || b.nome_item || "Item de Bancada"}</strong>
                      <span style={{ color: "#c084fc", fontWeight: "800" }}>${(parseFloat(b.valor) || 0).toLocaleString("pt-BR")}</span>
                    </div>
                    <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "4px", display: "flex", gap: "12px" }}>
                      {(b.qtd || b.quantidade) && <span>📦 Quantidade: {b.qtd || b.quantidade}x</span>}
                      {(b.timestamp || b.created_at) && <span>🕒 {new Date(b.timestamp || b.created_at).toLocaleTimeString("pt-BR")}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* MOVIMENTAÇÕES NO BAÚ */}
          <div style={{ marginBottom: "20px" }}>
            <div style={{ fontSize: "13px", fontWeight: "800", color: "#fbbf24", marginBottom: "8px" }}>
              📦 Movimentações no Baú ({listBau.length || activeAudit.totalBau || 0})
            </div>
            {listBau.length === 0 ? (
              <div style={{ fontSize: "12px", color: "#64748b", fontStyle: "italic", background: "rgba(255,255,255,0.02)", padding: "10px", borderRadius: "8px" }}>Nenhuma movimentação de baú realizada neste expediente.</div>
            ) : (
              <div style={{ maxHeight: "200px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px", background: "rgba(0,0,0,0.2)", padding: "8px", borderRadius: "8px" }}>
                {listBau.map((m, mIdx) => {
                  const isRetirou = (m.acao === "RETIROU" || m.tipo === "RETIROU" || String(m.acao).toLowerCase().includes("retir"));
                  return (
                    <div key={mIdx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px", padding: "6px 10px", background: "rgba(255,255,255,0.02)", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.05)" }}>
                      <span style={{ color: isRetirou ? "#fca5a5" : "#86efac", fontWeight: "700" }}>
                        {isRetirou ? "📤 Retirou:" : "📥 Guardou:"} {m.item || m.nome_item || m.nomeItem}
                      </span>
                      {(m.timestamp || m.created_at) && <span style={{ color: "#94a3b8", fontSize: "10px" }}>{new Date(m.timestamp || m.created_at).toLocaleTimeString("pt-BR")}</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Botão Fechar */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "16px" }}>
            <button
              onClick={() => setSessaoAuditModal(null)}
              style={{
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.2)",
                color: "#fff",
                padding: "8px 20px",
                borderRadius: "8px",
                fontWeight: "800",
                fontSize: "12px",
                cursor: "pointer"
              }}
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderModalDetalhes = () => {
    if (!funcModal) return null;
    const { func, status } = funcModal;
    
    // Filtrar registros deste funcionário específico
    const fid = func.idJogo || func.id_jogo || func.id;
    const regsVinculados = [
      ...(fid && byUid[String(fid)] ? byUid[String(fid)] : []),
      ...(func.id && byUid[String(func.id)] && String(func.id) !== String(fid) ? byUid[String(func.id)] : [])
    ];
    const funcNomeNorm = (func.nome || "").toLowerCase().replace(/\s+/g, " ").trim();
    const regsOrfaos = funcNomeNorm ? (byNome[funcNomeNorm] || []) : [];
    
    // Evita duplicatas ao mesclar por ID ou UUID (não usando reg.id pois reg.id é o passaporte)
    let todosRegs = [];
    const vistos = new Set();
    [...regsVinculados, ...regsOrfaos].forEach(reg => {
      const key = String(reg.uuid_entrada || reg.uuid || `${reg.usuario_id || reg.id}_${reg.entrada}_${reg.saida}`);
      if (!vistos.has(key)) {
        vistos.add(key);
        todosRegs.push(reg);
      }
    });

    const totalSessoesFunc = todosRegs.length;
    const sessoesSemSaidaFuncCount = todosRegs.filter(r => r.entrada && (!r.saida || r.saida === r.entrada || r.duracaoMin === 0 || r.tempo === 0)).length;

    if (status === "aberto") {
      todosRegs = todosRegs.filter(r => r.entrada && (!r.saida || r.saida === r.entrada || r.duracaoMin === 0 || r.tempo === 0));
    }

    // Enriquecer registros com os dados detalhados de auditoria se disponíveis em logsCompletosFunc
    if (logsCompletosFunc && logsCompletosFunc.length > 0) {
      todosRegs = todosRegs.map((reg) => {
        const matched = logsCompletosFunc.find((l) => {
          if (reg.uuid_entrada && (l.uuid_sessao === reg.uuid_entrada || l.uuid_entrada === reg.uuid_entrada)) return true;
          if (l.entrada && reg.entrada) {
            const diff = Math.abs(new Date(l.entrada).getTime() - new Date(reg.entrada).getTime());
            if (diff < 180000) return true;
          }
          return false;
        });
        if (matched) {
          return {
            ...reg,
            ...matched,
            uuid_entrada: reg.uuid_entrada || matched.uuid_entrada || matched.uuid_sessao,
            uuid_saida: reg.uuid_saida || matched.uuid_saida,
            observacao: reg.observacao || matched.observacao,
            detalhes: matched.detalhes || reg.detalhes || { tunagens: [], bancada: [], bau: [] },
            totalTunagens: matched.totalTunagens ?? reg.totalTunagens ?? (matched.detalhes?.tunagens?.length || 0),
            valorTunagens: matched.valorTunagens ?? reg.valorTunagens ?? (matched.detalhes?.tunagens?.reduce((a, t) => a + (parseFloat(t.valor_pago || t.valor) || 0), 0) || 0),
            totalBancada: matched.totalBancada ?? reg.totalBancada ?? (matched.detalhes?.bancada?.length || 0),
            valorBancada: matched.valorBancada ?? reg.valorBancada ?? (matched.detalhes?.bancada?.reduce((a, b) => a + (parseFloat(b.valor) || 0), 0) || 0),
            totalBau: matched.totalBau ?? reg.totalBau ?? (matched.detalhes?.bau?.length || 0),
            duracaoMin: matched.duracaoMin ?? reg.duracaoMin ?? ((matched.entrada && matched.saida) ? Math.round((new Date(matched.saida) - new Date(matched.entrada)) / 60000) : 0),
            statusPonto: matched.statusPonto || reg.statusPonto
          };
        }
        return reg;
      });
    }

    todosRegs.sort((a, b) => new Date(b.entrada) - new Date(a.entrada));

    // Agrupar por semana a partir de TODOS OS REGISTROS (sem limite do filtro de período do relatório)
    const semanas = {};
    const logsCompletosFiltrados = filtrarManuais(logsCompletosFunc);

    // Determinar a data de início para exibição de semanas (admissão ou primeiro registro nos logs completos)
    let dataInicio = null;
    if (func.data_admissao) {
      dataInicio = new Date(`${func.data_admissao}T12:00:00`);
    } else if (logsCompletosFiltrados.length > 0) {
      const datas = logsCompletosFiltrados.map(r => {
        if (r.entrada) {
          try {
            return new Date(r.entrada).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
          } catch (e) {
            return r.entrada.substring(0, 10);
          }
        }
        return r.data;
      }).filter(Boolean);
      if (datas.length > 0) {
        datas.sort();
        dataInicio = new Date(`${datas[0]}T12:00:00`);
      }
    }

    if (dataInicio) {
      const agora = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
      const dataLimite60 = new Date(agora);
      dataLimite60.setDate(agora.getDate() - 60);
      const dataInicioAvaliacao = dataInicio > dataLimite60 ? dataInicio : dataLimite60;

      let temp = new Date(dataInicioAvaliacao);
      while (temp <= agora) {
        const yyyymmdd = temp.toLocaleDateString("en-CA");
        const { key, label } = obterLabelSemana(yyyymmdd);
        if (key) {
          semanas[key] = { key, label, totalMinutos: 0 };
        }
        temp.setDate(temp.getDate() + 7);
      }
      const hojeStr = agora.toLocaleDateString("en-CA");
      const { key: hojeKey, label: hojeLabel } = obterLabelSemana(hojeStr);
      if (hojeKey) {
        semanas[hojeKey] = { key: hojeKey, label: hojeLabel, totalMinutos: 0 };
      }
    }

    logsCompletosFiltrados.forEach((reg) => {
      if (!reg.entrada || !reg.saida) return;
      let dataRegStr = "";
      if (reg.entrada) {
        try {
          dataRegStr = new Date(reg.entrada).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
        } catch (e) {
          dataRegStr = reg.entrada.substring(0, 10);
        }
      } else {
        dataRegStr = reg.data;
      }
      const { key, label } = obterLabelSemana(dataRegStr);
      if (!key) return;

      const diffMin = (new Date(reg.saida) - new Date(reg.entrada)) / 60000;
      if (diffMin > 0) {
        if (!semanas[key]) {
          semanas[key] = { key, label, totalMinutos: 0 };
        }
        semanas[key].totalMinutos += diffMin;
      }
    });
    const resumosSemanais = Object.values(semanas).sort((a, b) => b.key.localeCompare(a.key));

    return (
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.85)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)", padding: "20px" }}>
        <div style={{ background: theme.card, width: "100%", maxWidth: "800px", borderRadius: "24px", overflow: "hidden", border: `1px solid ${theme.border}`, boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)", display: "flex", flexDirection: "column", maxHeight: "90vh" }}>
          
          <div style={{ padding: "20px 30px", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", background: theme.card2 }}>
            <div>
              <h3 style={{ margin: 0, color: theme.text, fontSize: "18px", fontWeight: "800" }}>Histórico de Sessões</h3>
              <div style={{ color: "#38bdf8", fontSize: "12px", fontWeight: "700", marginTop: "2px" }}>
                {func.nome} (ID: {func.idJogo || func.id}){func.data_admissao && ` · Contratação: ${fmtBR(func.data_admissao)}`}
              </div>
            </div>
            <button onClick={() => setFuncModal(null)} style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${theme.border}`, color: theme.text, padding: "8px 16px", borderRadius: "10px", cursor: "pointer", fontWeight: "800", fontSize: "11px" }}>FECHAR</button>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "20px 30px" }}>
            {carregandoLogsFunc ? (
              <div style={{ padding: "24px", textAlign: "center", color: theme.subtext }}>⏳ Carregando histórico completo de todas as semanas...</div>
            ) : resumosSemanais.length > 0 ? (
              <div style={{ marginBottom: "20px", padding: "16px", background: "rgba(255, 255, 255, 0.02)", borderRadius: "14px", border: `1px solid ${theme.border}44` }}>
                <div style={{ fontSize: "11px", fontWeight: "800", color: theme.subtext, textTransform: "uppercase", marginBottom: "8px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
                  <span>📊 Resumo de Horas por Semana (Total)</span>
                  <button 
                    onClick={() => setEsconderResumoSemanal(!esconderResumoSemanal)}
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: `1px solid ${theme.border}`,
                      color: theme.text,
                      padding: "4px 8px",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontSize: "10px",
                      fontWeight: "700"
                    }}
                  >
                    {esconderResumoSemanal ? "👁️ Mostrar" : "🙈 Ocultar"}
                  </button>
                </div>
                {!esconderResumoSemanal && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "8px" }}>
                    {resumosSemanais.map((sem, idx) => {
                      const h = Math.floor(sem.totalMinutos / 60);
                      const m = Math.round(sem.totalMinutos % 60);
                      const totalStr = `${h}h ${String(m).padStart(2, "0")}min`;
                      const corHoras = sem.totalMinutos >= 240 ? "#22c55e" : sem.totalMinutos > 0 ? "#facc15" : theme.subtext;
                      return (
                        <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: theme.text, background: "rgba(255,255,255,0.01)", padding: "8px 12px", borderRadius: "8px", border: `1px solid ${theme.border}22` }}>
                          <span style={{ color: theme.subtext }}>{sem.label}</span>
                          <b style={{ color: corHoras }}>{totalStr}</b>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : null}

            {/* FILTRO DE SESSÕES DO FUNCIONÁRIO */}
            <div style={{ display: "flex", gap: "8px", marginBottom: "14px", flexWrap: "wrap", alignItems: "center" }}>
              <button
                onClick={() => setFuncModal(prev => ({ ...prev, status: null }))}
                style={{
                  background: !status ? "rgba(56, 189, 248, 0.2)" : "rgba(255, 255, 255, 0.05)",
                  border: `1px solid ${!status ? "#38bdf8" : theme.border}`,
                  color: !status ? "#38bdf8" : theme.text,
                  padding: "6px 14px",
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontWeight: "700",
                  cursor: "pointer"
                }}
              >
                📋 Todas as Sessões ({totalSessoesFunc})
              </button>
              <button
                onClick={() => setFuncModal(prev => ({ ...prev, status: "aberto" }))}
                style={{
                  background: status === "aberto" ? "rgba(250, 204, 21, 0.2)" : "rgba(255, 255, 255, 0.05)",
                  border: `1px solid ${status === "aberto" ? "#facc15" : theme.border}`,
                  color: status === "aberto" ? "#facc15" : theme.text,
                  padding: "6px 14px",
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontWeight: "700",
                  cursor: "pointer"
                }}
              >
                ⚠️ Apenas sem Saída / Zeradas ({sessoesSemSaidaFuncCount})
              </button>
            </div>

            {todosRegs.length === 0 ? (
              <div style={{ padding: "40px", textAlign: "center", color: theme.subtext }}>Nenhum registro encontrado para este filtro.</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left" }}>
                    <th style={{ padding: "10px", color: theme.subtext, fontSize: "10px", textTransform: "uppercase" }}>Entrada</th>
                    <th style={{ padding: "10px", color: theme.subtext, fontSize: "10px", textTransform: "uppercase" }}>Saída</th>
                    <th style={{ padding: "10px", color: theme.subtext, fontSize: "10px", textTransform: "uppercase" }}>Duração</th>
                    <th style={{ padding: "10px", color: theme.subtext, fontSize: "10px", textTransform: "uppercase" }}>Status</th>
                    <th style={{ padding: "10px", color: theme.subtext, fontSize: "10px", textTransform: "uppercase" }}>Atividades no Período</th>
                    <th style={{ padding: "10px", color: theme.subtext, fontSize: "10px", textTransform: "uppercase", textAlign: "right" }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {todosRegs.map((reg, idx) => {
                    const dur = (reg.entrada && reg.saida) ? (new Date(reg.saida) - new Date(reg.entrada)) / 60000 : 0;
                    const totTun = reg.totalTunagens || reg.detalhes?.tunagens?.length || 0;
                    const totBanc = reg.totalBancada || reg.detalhes?.bancada?.length || 0;
                    const totBau = reg.totalBau || reg.detalhes?.bau?.length || 0;
                    const temAtividade = totTun > 0 || totBanc > 0 || totBau > 0;

                    return (
                      <tr 
                        key={idx} 
                        style={{ borderBottom: `1px solid ${theme.border}33`, transition: "background 0.15s" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.03)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <td style={{ padding: "12px 10px", color: theme.text, fontSize: "13px" }}>{new Date(reg.entrada).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
                        <td style={{ padding: "12px 10px", color: reg.saida ? theme.text : "#ef4444", fontSize: "13px" }}>{reg.saida ? new Date(reg.saida).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "EM ABERTO"}</td>
                        <td style={{ padding: "12px 10px", color: dur >= 30 ? "#22c55e" : dur > 0 ? "#facc15" : theme.subtext, fontWeight: "700" }}>
                          {dur > 0 ? fmtMin(dur) : "—"}
                          {reg.observacao && (
                            <span 
                              title={reg.observacao} 
                              style={{ marginLeft: "6px", cursor: "help", fontSize: "11px", opacity: 0.7 }}
                            >
                              ℹ️
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "12px 10px" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                            {reg.uuid_saida ? (
                              <span style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e", padding: "2px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: "700", display: "inline-block", width: "fit-content" }}>✅ Completo</span>
                            ) : reg.saida ? (
                              (() => {
                                const obsLower = (reg.observacao || "").toLowerCase();
                                if (obsLower.includes("bancada")) {
                                  return (
                                    <span title={reg.observacao} style={{ background: "rgba(168,85,247,0.12)", color: "#c084fc", padding: "2px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: "700", display: "inline-block", width: "fit-content", cursor: "help" }}>🛠️ Log de Bancada</span>
                                  );
                                }
                                if (obsLower.includes("tunagem")) {
                                  return (
                                    <span title={reg.observacao} style={{ background: "rgba(236,72,153,0.12)", color: "#f472b6", padding: "2px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: "700", display: "inline-block", width: "fit-content", cursor: "help" }}>🔧 Log de Tunagem</span>
                                  );
                                }
                                if (obsLower.includes("reconex") || obsLower.includes("entrada")) {
                                  return (
                                    <span title={reg.observacao} style={{ background: "rgba(14,165,233,0.12)", color: "#38bdf8", padding: "2px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: "700", display: "inline-block", width: "fit-content", cursor: "help" }}>🔄 Outra Entrada</span>
                                  );
                                }

                                // Detecção dinâmica caso o registro venha sem observação gravada
                                const tSaida = new Date(reg.saida).getTime();
                                const temProximaEntrada = (todosRegs || []).some(outro => {
                                  if (outro.uuid_entrada && reg.uuid_entrada && outro.uuid_entrada === reg.uuid_entrada) return false;
                                  if (outro.entrada === reg.entrada) return false;
                                  const tOutraEntrada = new Date(outro.entrada).getTime();
                                  return Math.abs(tOutraEntrada - tSaida) <= 120000;
                                });

                                if (temProximaEntrada) {
                                  const horaStr = new Date(reg.saida).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
                                  return (
                                    <span title={`Fechado automaticamente por identificação de nova entrada às ${horaStr}.`} style={{ background: "rgba(14,165,233,0.12)", color: "#38bdf8", padding: "2px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: "700", display: "inline-block", width: "fit-content", cursor: "help" }}>🔄 Outra Entrada</span>
                                  );
                                }

                                return (
                                  <span title={reg.observacao || "Saída registrada manualmente."} style={{ background: "rgba(249,115,22,0.12)", color: "#f97316", padding: "2px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: "700", display: "inline-block", width: "fit-content", cursor: "help" }}>✏️ Manual</span>
                                );
                              })()
                            ) : (
                              <span style={{ background: "rgba(250,204,21,0.12)", color: "#facc15", padding: "2px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: "700", display: "inline-block", width: "fit-content" }}>🔓 Sem saída</span>
                            )}
                            
                            {(reg.verificado || (reg.uuid_entrada && reg.uuid_saida)) ? (
                              <span style={{ color: "#22c55e", fontSize: "10px", fontWeight: "600" }}>✓ Verificado</span>
                            ) : (
                              <span style={{ color: theme.subtext, fontSize: "10px", opacity: 0.7 }}>⏳ Pendente</span>
                            )}
                          </div>
                        </td>

                        {/* ATIVIDADES NO PERÍODO */}
                        <td style={{ padding: "12px 10px" }}>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
                            {totTun > 0 && (
                              <span style={{ background: "rgba(34, 197, 94, 0.15)", color: "#4ade80", border: "1px solid rgba(34, 197, 94, 0.3)", padding: "2px 6px", borderRadius: "4px", fontSize: "11px", fontWeight: "700" }}>
                                🚗 {totTun}x
                              </span>
                            )}
                            {totBanc > 0 && (
                              <span style={{ background: "rgba(192, 132, 252, 0.15)", color: "#c084fc", border: "1px solid rgba(192, 132, 252, 0.3)", padding: "2px 6px", borderRadius: "4px", fontSize: "11px", fontWeight: "700" }}>
                                🛠️ {totBanc}x
                              </span>
                            )}
                            {totBau > 0 && (
                              <span style={{ background: "rgba(251, 191, 36, 0.15)", color: "#fbbf24", border: "1px solid rgba(251, 191, 36, 0.3)", padding: "2px 6px", borderRadius: "4px", fontSize: "11px", fontWeight: "700" }}>
                                📦 {totBau}x
                              </span>
                            )}
                            {!temAtividade && (
                              <span style={{ color: theme.subtext, fontSize: "11px" }}>—</span>
                            )}
                          </div>
                        </td>

                        {/* AÇÃO AUDITORIA */}
                        <td style={{ padding: "12px 10px", textAlign: "right" }}>
                          <button
                            onClick={() => setSessaoAuditModal(reg)}
                            style={{
                              background: temAtividade ? "rgba(56, 189, 248, 0.15)" : "rgba(255, 255, 255, 0.05)",
                              border: `1px solid ${temAtividade ? "#38bdf8" : theme.border}`,
                              color: temAtividade ? "#38bdf8" : theme.text,
                              padding: "5px 10px",
                              borderRadius: "6px",
                              fontSize: "11px",
                              fontWeight: "700",
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              transition: "all 0.15s"
                            }}
                            title="Clique para ver todas as atividades detalhadas desta sessão"
                          >
                            🔍 Ver Atividades
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

  return (
    <div style={{ padding: "28px 36px", maxWidth: "1200px", margin: "0 auto" }}>
      {renderModalDetalhes()}
      {renderModalAuditoriaSessao()}

      {/* HEADER */}
      <div style={{ marginBottom: "24px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: "800", color: theme.text, margin: 0 }}>
            📊 Relatório de Horas
          </h1>
          <p style={{ fontSize: "13px", color: theme.subtext, marginTop: "6px" }}>
            Total de horas trabalhadas por funcionário no período selecionado.
          </p>
        </div>
        <button
          onClick={() => window.print()}
          style={{
            background: "linear-gradient(135deg, #1e40af, #3b82f6)",
            color: "#fff", border: "none", padding: "10px 22px",
            borderRadius: "10px", cursor: "pointer", fontSize: "13px", fontWeight: "700",
            boxShadow: "0 4px 14px rgba(59,130,246,0.3)",
            display: "flex", alignItems: "center", gap: "8px",
          }}
        >🖨️ Imprimir / PDF</button>
      </div>

      {/* FILTROS */}
      <div style={cardStyle}>
        <div style={{ ...styles.cardHeader, marginBottom: "14px" }}>
          <span style={styles.dot} /> Período do Relatório
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "flex-end" }}>

          {/* Presets */}
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
                      const agora = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
                      const defaultOffset = agora.getDay() === 0 ? 0 : -1;
                      setSemanaOffset(defaultOffset);
                      aplicarFiltros(val, defaultOffset);
                    } else if (val !== "custom") {
                      aplicarFiltros(val);
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

              {/* Navegação de semanas */}
              {filtroPeriodo === "semana" && (
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginLeft: "8px" }}>
                  <button
                    onClick={() => { const n = semanaOffset - 1; setSemanaOffset(n); aplicarFiltros("semana", n); }}
                    title="Semana anterior"
                    style={{ background: theme.card2, border: `1px solid ${theme.border}`, color: theme.text, width: "28px", height: "28px", borderRadius: "7px", cursor: "pointer", fontSize: "14px", display: "flex", alignItems: "center", justifyContent: "center" }}
                  >←</button>
                  <div style={{ padding: "4px 10px", borderRadius: "8px", background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.3)", fontSize: "11px", fontWeight: "700", color: "#38bdf8", whiteSpace: "nowrap" }}>
                    {semanaLabel}
                    <span style={{ fontWeight: "400", marginLeft: "6px", color: theme.subtext }}>{fmtBR(periodoInicio)} – {fmtBR(periodoFim)}</span>
                  </div>
                  <button
                    onClick={() => { const n = semanaOffset + 1; setSemanaOffset(n); aplicarFiltros("semana", n); }}
                    disabled={semanaOffset >= 0}
                    title="Semana seguinte"
                    style={{ background: theme.card2, border: `1px solid ${theme.border}`, color: semanaOffset >= 0 ? theme.subtext : theme.text, width: "28px", height: "28px", borderRadius: "7px", cursor: semanaOffset >= 0 ? "not-allowed" : "pointer", fontSize: "14px", opacity: semanaOffset >= 0 ? 0.4 : 1, display: "flex", alignItems: "center", justifyContent: "center" }}
                  >→</button>
                </div>
              )}
            </div>
          </div>

          {/* Datas custom */}
          {filtroPeriodo === "custom" && (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                <label style={{ fontSize: "10px", color: theme.subtext, fontWeight: "700", textTransform: "uppercase" }}>De</label>
                <input type="date" value={filtroDataInicio} onChange={e => setFiltroDataInicio(e.target.value)} style={{ ...inputSmall, width: "145px" }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                <label style={{ fontSize: "10px", color: theme.subtext, fontWeight: "700", textTransform: "uppercase" }}>Até</label>
                <input type="date" value={filtroDataFim} onChange={e => setFiltroDataFim(e.target.value)} style={{ ...inputSmall, width: "145px" }} />
              </div>
            </>
          )}

          {/* Filtro Ocultar Manuais */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px", height: "30px", padding: "0 10px", borderRadius: "8px", background: "rgba(255,255,255,0.02)", border: `1px solid ${theme.border}44`, cursor: "pointer" }} onClick={() => setOcultarManuais(!ocultarManuais)}>
            <input 
              type="checkbox" 
              checked={ocultarManuais} 
              onChange={() => {}} // handled by parent container click
              style={{ cursor: "pointer" }} 
            />
            <label style={{ fontSize: "11px", fontWeight: "700", color: theme.text, cursor: "pointer", userSelect: "none" }}>
              🚫 Excluir Pontos Manuais
            </label>
          </div>

          {/* Filtro Ocultar Demitidos */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px", height: "30px", padding: "0 10px", borderRadius: "8px", background: "rgba(255,255,255,0.02)", border: `1px solid ${theme.border}44`, cursor: "pointer" }} onClick={() => setOcultarDemitidos(!ocultarDemitidos)}>
            <input 
              type="checkbox" 
              checked={ocultarDemitidos} 
              onChange={() => {}} // handled by parent container click
              style={{ cursor: "pointer" }} 
            />
            <label style={{ fontSize: "11px", fontWeight: "700", color: theme.text, cursor: "pointer", userSelect: "none" }}>
              👥 Ocultar Demitidos
            </label>
          </div>

          {/* Botão gerar */}
          <button
            onClick={() => aplicarFiltros()}
            disabled={relatorioCarregando}
            style={{
              background: "linear-gradient(135deg, #b40d0d, #ef4444)",
              color: "#fff", border: "none", padding: "6px 18px",
              borderRadius: "8px", cursor: relatorioCarregando ? "not-allowed" : "pointer",
              fontSize: "12px", fontWeight: "700", opacity: relatorioCarregando ? 0.7 : 1,
            }}
          >{relatorioCarregando ? "⏳ Gerando..." : "🔍 Gerar Relatório"}</button>
        </div>
      </div>

      {/* TABS DE SELEÇÃO DE RELATÓRIO */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "16px", borderBottom: `1px solid ${theme.border}`, paddingBottom: "10px" }}>
        <button
          onClick={() => setAbaRelatorio("funcionarios")}
          style={{
            background: "transparent",
            border: "none",
            borderBottom: abaRelatorio === "funcionarios" ? `3px solid ${theme.accent}` : "3px solid transparent",
            color: abaRelatorio === "funcionarios" ? theme.text : theme.subtext,
            fontWeight: "700",
            fontSize: "14px",
            padding: "8px 16px",
            cursor: "pointer",
            transition: "all 0.2s"
          }}
        >
          👤 Horas por Funcionário
        </button>
        <button
          onClick={() => setAbaRelatorio("cobertura")}
          style={{
            background: "transparent",
            border: "none",
            borderBottom: abaRelatorio === "cobertura" ? `3px solid ${theme.accent}` : "3px solid transparent",
            color: abaRelatorio === "cobertura" ? theme.text : theme.subtext,
            fontWeight: "700",
            fontSize: "14px",
            padding: "8px 16px",
            cursor: "pointer",
            transition: "all 0.2s"
          }}
        >
          ⏱️ Ausência de Cobertura
        </button>
        <button
          onClick={() => setAbaRelatorio("comparativo")}
          style={{
            background: "transparent",
            border: "none",
            borderBottom: abaRelatorio === "comparativo" ? `3px solid ${theme.accent}` : "3px solid transparent",
            color: abaRelatorio === "comparativo" ? theme.text : theme.subtext,
            fontWeight: "700",
            fontSize: "14px",
            padding: "8px 16px",
            cursor: "pointer",
            transition: "all 0.2s"
          }}
        >
          📊 Comparativo das Mecânicas
        </button>
        <button
          onClick={() => setAbaRelatorio("sem_saida")}
          style={{
            background: "transparent",
            border: "none",
            borderBottom: abaRelatorio === "sem_saida" ? "3px solid #facc15" : "3px solid transparent",
            color: abaRelatorio === "sem_saida" ? "#facc15" : theme.subtext,
            fontWeight: "700",
            fontSize: "14px",
            padding: "8px 16px",
            cursor: "pointer",
            transition: "all 0.2s",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}
        >
          <span>⚠️ Pontos sem Saída</span>
          {pontosSemSaidaPeriodo.length > 0 && (
            <span style={{
              background: "#ef4444",
              color: "#fff",
              fontSize: "11px",
              fontWeight: "800",
              padding: "1px 7px",
              borderRadius: "10px"
            }}>
              {pontosSemSaidaPeriodo.length}
            </span>
          )}
        </button>
      </div>

      {/* ABA: FUNCIONÁRIOS (RELATÓRIO TRADICIONAL) */}
      {abaRelatorio === "funcionarios" && (
        <>
          {/* CARDS DE RESUMO */}
          {jaGerou && !relatorioCarregando && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px", marginBottom: "20px" }}>
              {[
                { label: "Total de Horas",      valor: fmtMin(totalGeralMin), cor: "#22c55e", emoji: "⏱️" },
                { label: "Funcionários Ativos", valor: funcAtivos,            cor: "#38bdf8", emoji: "👤" },
                { label: "Sessões Completas",   valor: totalSessoes,          cor: "#a78bfa", emoji: "📋" },
                { 
                  label: "Sem Saída / Zerados", 
                  valor: pontosSemSaidaPeriodo.length, 
                  cor: pontosSemSaidaPeriodo.length > 0 ? "#facc15" : "#22c55e", 
                  emoji: "⚠️",
                  onClick: () => setAbaRelatorio("sem_saida")
                },
              ].map(({ label, valor, cor, emoji, onClick }) => (
                <div 
                  key={label} 
                  onClick={onClick}
                  style={{ 
                    ...styles.whiteCard, 
                    padding: "14px 18px", 
                    borderLeft: `3px solid ${cor}`, 
                    textAlign: "center",
                    cursor: onClick ? "pointer" : "default",
                    transition: "transform 0.15s"
                  }}
                  onMouseEnter={(e) => { if (onClick) e.currentTarget.style.transform = "translateY(-2px)"; }}
                  onMouseLeave={(e) => { if (onClick) e.currentTarget.style.transform = "none"; }}
                >
                  <div style={{ fontSize: "22px" }}>{emoji}</div>
                  <div style={{ fontSize: "22px", fontWeight: "800", color: cor }}>{valor}</div>
                  <div style={{ fontSize: "11px", color: theme.subtext, fontWeight: "600" }}>{label}</div>
                </div>
              ))}
            </div>
          )}

          {/* TABELA PRINCIPAL */}
          <div style={{ ...styles.whiteCard, padding: "0", overflow: "hidden" }}>

            {/* Header */}
            <div style={{
              padding: "14px 20px", borderBottom: `1px solid ${theme.border}`,
              display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px",
            }}>
              <div style={{ ...styles.cardHeader, marginBottom: 0 }}>
                <span style={styles.dot} />
                {periodoInicio && periodoFim
                  ? ` Funcionários — ${fmtBR(periodoInicio)} a ${fmtBR(periodoFim)}`
                  : " Funcionários — selecione um período"}
              </div>
              <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontSize: "11px", color: theme.subtext }}>Ordenar:</span>
                {[{ val: "horas", label: "Horas ↓" }, { val: "nome", label: "Nome A-Z" }, { val: "id", label: "ID 1-9" }].map(({ val, label }) => (
                  <button key={val} onClick={() => setOrdenacao(val)} style={{
                    padding: "3px 10px", borderRadius: "6px", border: "none", cursor: "pointer",
                    fontSize: "11px", fontWeight: "700",
                    background: ordenacao === val ? theme.accent : theme.card2,
                    color: ordenacao === val ? "#fff" : theme.subtext,
                  }}>{label}</button>
                ))}
                <button onClick={() => setMostrarSemHoras(v => !v)} style={{
                  padding: "3px 10px", borderRadius: "6px", border: `1px solid ${theme.border}`,
                  cursor: "pointer", fontSize: "11px", background: "transparent", color: theme.subtext, fontWeight: "600",
                }}>{mostrarSemHoras ? "🙈 Só ativos" : "👁 Todos"}</button>
              </div>
            </div>

            {relatorioCarregando ? (
              <div style={{ padding: "48px", textAlign: "center", color: theme.subtext }}>
                <div style={{ fontSize: "36px", marginBottom: "10px" }}>⏳</div>Gerando relatório...
              </div>
            ) : !jaGerou ? (
              <div style={{ padding: "48px", textAlign: "center", color: theme.subtext, opacity: 0.6 }}>
                <div style={{ fontSize: "36px", marginBottom: "10px" }}>📊</div>
                Clique em "Gerar Relatório" para visualizar os dados.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                  <thead>
                    <tr style={{ background: theme.card2 }}>
                      {colunasHeader.map((col, i) => (
                        <th key={i} style={{
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
                    {dadosFuncionarios.map((func, i) => {
                      const rank     = i + 1;
                      const medal    = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
                      const temHoras = func.totalMin > 0;

                      const admitidoNoPeriodo = func.data_admissao && 
                        func.data_admissao >= periodoInicio && 
                        func.data_admissao <= periodoFim;
                      const temMenosDeQuatroHoras = func.totalMin < 240;
                      const destacarContratadoSemHoras = admitidoNoPeriodo && temMenosDeQuatroHoras;

                      return (
                        <tr key={func.id} style={{
                          background: destacarContratadoSemHoras 
                            ? "rgba(234,179,8,0.04)" 
                            : (i % 2 === 0 ? "transparent" : `${theme.card2}55`),
                          borderBottom: `1px solid ${theme.border}55`,
                          borderLeft: destacarContratadoSemHoras ? "4px solid #eab308" : "none",
                          opacity: (temHoras || destacarContratadoSemHoras) ? 1 : 0.4,
                        }}>
                          <td style={{ padding: "10px 14px", fontWeight: "800", color: theme.subtext, fontSize: "13px", width: "40px" }}>
                            {medal ?? <span style={{ opacity: 0.5 }}>{rank}</span>}
                          </td>
                          <td style={{ padding: "10px 14px", color: theme.subtext, fontFamily: "monospace", fontSize: "12px" }}>
                            {func.idJogo ? `#${func.idJogo}` : "—"}
                          </td>
                            <td 
                            onClick={() => setFuncModal({ func, status: "todos" })}
                            style={{ padding: "10px 14px", color: theme.text, fontWeight: "700", cursor: "pointer", textDecoration: "none" }}
                          >
                             {(() => {
                              const tag = getCargoTag(func.role);
                              if (!tag) return null;
                              const isEstagiarioPromo = tag === "ES" && func.totalMin >= 540;
                              const isAlertaInativo = idsInativosAlerta.has(String(func.id));
                              return (
                                <span 
                                  title={isAlertaInativo ? "Alerta de inatividade: 3+ semanas com menos de 4h nos últimos 60 dias" : undefined}
                                  style={{ 
                                    background: isAlertaInativo 
                                      ? "rgba(239, 68, 68, 0.15)"
                                      : isEstagiarioPromo 
                                        ? "rgba(234, 179, 8, 0.15)" 
                                        : "rgba(255,255,255,0.05)", 
                                    color: isAlertaInativo 
                                      ? "#ef4444"
                                      : isEstagiarioPromo 
                                        ? "#facc15" 
                                        : theme.subtext, 
                                    fontSize: "9px", 
                                    padding: "2px 5px", 
                                    borderRadius: "4px", 
                                    marginRight: "8px",
                                    border: isAlertaInativo
                                      ? "1px solid rgba(239, 68, 68, 0.4)"
                                      : isEstagiarioPromo 
                                        ? "1px solid rgba(234, 179, 8, 0.4)" 
                                        : `1px solid ${theme.border}`,
                                    fontWeight: (isEstagiarioPromo || isAlertaInativo) ? "800" : "normal",
                                    verticalAlign: "middle",
                                    boxShadow: isAlertaInativo
                                      ? "0 0 8px rgba(239, 68, 68, 0.2)"
                                      : isEstagiarioPromo 
                                        ? "0 0 8px rgba(234, 179, 8, 0.2)" 
                                        : "none"
                                  }}
                                >
                                  {tag}
                                </span>
                              );
                            })()}
                            {func.nome}
                            {destacarContratadoSemHoras && (
                              <span style={{ 
                                background: "rgba(234,179,8,0.15)", 
                                color: "#eab308", 
                                fontSize: "10px", 
                                fontWeight: "800",
                                padding: "2px 8px", 
                                borderRadius: "12px", 
                                marginLeft: "8px",
                                border: "1px solid rgba(234,179,8,0.3)",
                                verticalAlign: "middle",
                                whiteSpace: "nowrap"
                              }} title={`Admitido em ${new Date(func.data_admissao + "T12:00:00").toLocaleDateString("pt-BR")}`}>
                                🆕 Contratado Recente (&lt;4h)
                              </span>
                            )}
                          </td>
                          <td style={{ padding: "10px 14px", color: theme.subtext, fontSize: "12px" }}>{func.cargo || "—"}</td>
                          <td style={{ padding: "10px 14px" }}>
                            <div style={{ fontWeight: "900", fontSize: "16px", color: temHoras ? "#22c55e" : theme.subtext }}>
                              {fmtMin(func.totalMin)}
                            </div>
                            {func.abertas > 0 && (
                              <div 
                                onClick={(e) => { e.stopPropagation(); setFuncModal({ func, status: "aberto" }); }}
                                style={{ 
                                  fontSize: "10px", color: "#facc15", fontWeight: "700", 
                                  marginTop: "2px", cursor: "pointer", textDecoration: "underline",
                                  display: "inline-block"
                                }}
                                title="Clique para ver registros em aberto"
                              >
                                ⚠️ {func.abertas} em aberto
                              </div>
                            )}
                          </td>
                          <td style={{ padding: "10px 14px", color: theme.subtext, fontWeight: "700", textAlign: "center" }}>
                            {func.sessoes > 0 ? func.sessoes : "—"}
                          </td>
                          <td style={{ padding: "10px 14px" }}>
                            {temHoras ? (
                              <span style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e", padding: "2px 10px", borderRadius: "8px", fontSize: "11px", fontWeight: "700" }}>✅ Ativo</span>
                            ) : (
                              <span style={{ background: `${theme.card2}`, color: theme.subtext, padding: "2px 10px", borderRadius: "8px", fontSize: "11px" }}>— Sem registro</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* RODAPÉ TOTAIS */}
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "14px 20px", borderTop: `2px solid ${theme.border}`,
                  background: theme.card2, gap: "20px", flexWrap: "wrap",
                }}>
                  <div style={{ display: "flex", gap: "28px", flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontSize: "10px", color: theme.subtext, fontWeight: "700", textTransform: "uppercase" }}>Funcionários</div>
                      <div style={{ fontWeight: "800", fontSize: "16px", color: theme.text }}>{dadosFuncionarios.length}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: "10px", color: theme.subtext, fontWeight: "700", textTransform: "uppercase" }}>Ativos</div>
                      <div style={{ fontWeight: "800", fontSize: "16px", color: "#22c55e" }}>{funcAtivos}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: "10px", color: theme.subtext, fontWeight: "700", textTransform: "uppercase" }}>Sessões</div>
                      <div style={{ fontWeight: "800", fontSize: "16px", color: "#a78bfa" }}>{totalSessoes}</div>
                    </div>
                  </div>
                  <div style={{
                    display: "flex", alignItems: "center", gap: "12px",
                    background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.3)",
                    borderRadius: "12px", padding: "10px 20px",
                  }}>
                    <span style={{ fontSize: "22px" }}>⏱️</span>
                    <div>
                      <div style={{ fontSize: "10px", color: theme.subtext, fontWeight: "700", textTransform: "uppercase" }}>Total Geral de Horas</div>
                      <div style={{ fontWeight: "900", fontSize: "26px", color: "#22c55e", lineHeight: 1 }}>{fmtMin(totalGeralMin)}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* REGISTROS NÃO VINCULADOS */}
          {naoVinculados.length > 0 && (
            <div style={{ ...cardStyle, marginTop: "16px", borderLeft: "3px solid #facc15" }}>
              <div style={{ fontSize: "12px", color: "#facc15", fontWeight: "700", marginBottom: "8px" }}>
                ⚠️ {naoVinculados.length} registro(s) não vinculados a nenhum funcionário do sistema
              </div>
              {naoVinculados.map((r, i) => (
                <div key={i} style={{ fontSize: "12px", color: theme.subtext, padding: "3px 0" }}>
                  #{r.id_jogo} — {r.nome}: <strong>{fmtMin(r.totalMin)}</strong> ({r.sessoes} sessão/ões)
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ABA: AUSÊNCIA DE COBERTURA */}
      {abaRelatorio === "cobertura" && (
        <div>
          {relatorioCarregando ? (
            <div style={{ padding: "48px", textAlign: "center", color: theme.subtext }}>
              <div style={{ fontSize: "36px", marginBottom: "10px" }}>⏳</div>Analisando cobertura de horários...
            </div>
          ) : !jaGerou ? (
            <div style={{ padding: "48px", textAlign: "center", color: theme.subtext, opacity: 0.6 }}>
              <div style={{ fontSize: "36px", marginBottom: "10px" }}>📊</div>
              Clique em "Gerar Relatório" para visualizar os dados de cobertura.
            </div>
          ) : diasPeriodo.length === 0 ? (
            <div style={{ padding: "48px", textAlign: "center", color: theme.subtext }}>
              Nenhum dia encontrado no período selecionado.
            </div>
          ) : (
            <div>
              {/* Controles de Visualização */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px", borderBottom: `1px solid ${theme.border}55`, paddingBottom: "12px" }}>
                <div style={{ ...styles.cardHeader, marginBottom: 0 }}>
                  <span style={styles.dot} /> Cobertura de Meia em Meia Hora
                </div>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button
                    onClick={() => setVisualizacaoCobertura("linha")}
                    style={{
                      padding: "6px 14px", borderRadius: "8px", border: "none", cursor: "pointer",
                      fontSize: "12px", fontWeight: "700",
                      background: visualizacaoCobertura === "linha" ? theme.accent : theme.card2,
                      color: visualizacaoCobertura === "linha" ? "#fff" : theme.subtext,
                      transition: "all 0.2s"
                    }}
                  >
                    📊 Linha do Tempo
                  </button>
                  <button
                    onClick={() => setVisualizacaoCobertura("detalhes")}
                    style={{
                      padding: "6px 14px", borderRadius: "8px", border: "none", cursor: "pointer",
                      fontSize: "12px", fontWeight: "700",
                      background: visualizacaoCobertura === "detalhes" ? theme.accent : theme.card2,
                      color: visualizacaoCobertura === "detalhes" ? "#fff" : theme.subtext,
                      transition: "all 0.2s"
                    }}
                  >
                    🔍 Detalhes por Dia
                  </button>
                </div>
              </div>

              {/* RENDER MODE: LINHA (TIMELINE) */}
              {visualizacaoCobertura === "linha" && (
                <div style={{ ...styles.whiteCard, padding: "20px", overflowX: "auto", marginBottom: "20px" }}>
                  <div style={{ minWidth: "980px" }}>
                    {/* Linha de Horas do Topo */}
                    <div style={{ display: "flex", alignItems: "center", marginBottom: "12px" }}>
                      <div style={{ width: "120px", flexShrink: 0, fontWeight: "800", fontSize: "11px", color: theme.subtext, textTransform: "uppercase" }}>
                        Dia da Semana
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(48, 1fr)", flex: 1, gap: "3px" }}>
                        {Array.from({ length: 24 }).map((_, h) => (
                          <div key={h} style={{ gridColumn: "span 2", textAlign: "left", fontSize: "10px", fontWeight: "800", color: "#38bdf8", paddingLeft: "2px", borderLeft: `1px solid ${theme.border}44` }}>
                            {String(h).padStart(2, "0")}h
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Cada dia do período */}
                    {diasPeriodo.map(dia => {
                      const dataObj = new Date(`${dia}T12:00:00`);
                      const diaSemana = dataObj.toLocaleDateString("pt-BR", { weekday: "short" });
                      const slots = coberturaTodosDias[dia] || [];
                      const [ano, mes, diaNum] = dia.split("-");

                      return (
                        <div key={dia} style={{ display: "flex", alignItems: "center", marginBottom: "8px" }}>
                          {/* Nome do dia */}
                          <div style={{ width: "120px", flexShrink: 0, fontWeight: "700", fontSize: "12px", color: theme.text }}>
                            <span style={{ textTransform: "capitalize", fontWeight: "800" }}>{diaSemana.replace(".", "")}</span>
                            <span style={{ color: theme.subtext, marginLeft: "4px", fontSize: "11px" }}>({diaNum}/{mes})</span>
                          </div>

                          {/* Blocos horizontais */}
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(48, 1fr)", flex: 1, gap: "3px" }}>
                            {slots.map((slot, idx) => {
                              const tooltipText = `${slot.label}\n${slot.coberto ? `🟢 Coberto por:\n${slot.funcionarios.map(f => `• ${f.nome}`).join("\n")}` : "🔴 Sem cobertura"}`;
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
                                    border: `1px solid ${slot.coberto ? "rgba(34, 197, 94, 0.3)" : theme.border}55`,
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

              {/* RENDER MODE: DETALHES POR DIA */}
              {visualizacaoCobertura === "detalhes" && (
                <>
                  {/* Seletor de Dia */}
                  <div style={{ marginBottom: "20px" }}>
                    <div style={{ fontSize: "11px", fontWeight: "700", color: theme.subtext, marginBottom: "8px", textTransform: "uppercase" }}>
                      Selecione o Dia para Análise:
                    </div>
                    <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "8px" }}>
                      {diasPeriodo.map(dia => {
                        const [ano, mes, diaNum] = dia.split("-");
                        const dataObj = new Date(`${dia}T12:00:00`);
                        const diaSemana = dataObj.toLocaleDateString("pt-BR", { weekday: "short" });
                        const ativo = dia === diaSelecionado;
                        return (
                          <button
                            key={dia}
                            onClick={() => setDiaSelecionado(dia)}
                            style={{
                              padding: "8px 16px",
                              borderRadius: "10px",
                              border: `1px solid ${ativo ? theme.accent : theme.border}`,
                              background: ativo ? theme.accent : theme.card2,
                              color: ativo ? "#fff" : theme.text,
                              cursor: "pointer",
                              fontSize: "13px",
                              fontWeight: "700",
                              whiteSpace: "nowrap",
                              transition: "all 0.2s",
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              minWidth: "75px"
                            }}
                          >
                            <span style={{ fontSize: "9px", opacity: ativo ? 0.9 : 0.6, textTransform: "uppercase", fontWeight: "800" }}>{diaSemana}</span>
                            <span>{diaNum}/{mes}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Métricas do Dia Selecionado */}
                  {diaSelecionado && (
                    <>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "20px" }}>
                        <div style={{ ...styles.whiteCard, padding: "14px 18px", borderLeft: "3px solid #22c55e", textAlign: "center" }}>
                          <div style={{ fontSize: "20px" }}>🟢</div>
                          <div style={{ fontSize: "20px", fontWeight: "800", color: "#22c55e" }}>
                            {slotsDoDia.filter(s => s.coberto).length} / {slotsDoDia.length}
                          </div>
                          <div style={{ fontSize: "11px", color: theme.subtext, fontWeight: "600" }}>Horários Cobertos</div>
                        </div>
                        <div style={{ ...styles.whiteCard, padding: "14px 18px", borderLeft: "3px solid #ef4444", textAlign: "center" }}>
                          <div style={{ fontSize: "20px" }}>🔴</div>
                          <div style={{ fontSize: "20px", fontWeight: "800", color: "#ef4444" }}>
                            {slotsDoDia.filter(s => !s.coberto).length} / {slotsDoDia.length}
                          </div>
                          <div style={{ fontSize: "11px", color: theme.subtext, fontWeight: "600" }}>Sem Cobertura</div>
                        </div>
                        <div style={{ ...styles.whiteCard, padding: "14px 18px", borderLeft: "3px solid #38bdf8", textAlign: "center" }}>
                          <div style={{ fontSize: "20px" }}>📊</div>
                          <div style={{ fontSize: "20px", fontWeight: "800", color: "#38bdf8" }}>
                            {slotsDoDia.length > 0 ? ((slotsDoDia.filter(s => s.coberto).length / slotsDoDia.length) * 100).toFixed(0) : 0}%
                          </div>
                          <div style={{ fontSize: "11px", color: theme.subtext, fontWeight: "600" }}>Taxa de Cobertura</div>
                        </div>
                      </div>

                      {/* Filtro por Sem Cobertura */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
                        <div style={{ fontSize: "15px", fontWeight: "800", color: theme.text }}>
                          🕒 Cobertura de Meia em Meia Hora - {new Date(`${diaSelecionado}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })}
                        </div>
                        <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: theme.text, cursor: "pointer", fontWeight: "700" }}>
                          <input
                            type="checkbox"
                            checked={filtroApenasSemCobertura}
                            onChange={e => setFiltroApenasSemCobertura(e.target.checked)}
                            style={{ cursor: "pointer", width: "16px", height: "16px", accentColor: theme.accent }}
                          />
                          Mostrar apenas horários sem cobertura (vazios)
                        </label>
                      </div>

                      {/* Grade de Slots */}
                      {slotsDoDia.filter(s => !filtroApenasSemCobertura || !s.coberto).length === 0 ? (
                        <div style={{ ...styles.whiteCard, padding: "48px", textAlign: "center", color: theme.subtext }}>
                          {filtroApenasSemCobertura ? "🎉 Incrível! Não há nenhum horário sem cobertura (vazio) neste dia." : "Nenhum horário a exibir."}
                        </div>
                      ) : (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "12px" }}>
                          {slotsDoDia
                            .filter(s => !filtroApenasSemCobertura || !s.coberto)
                            .map((slot, idx) => {
                              const sHours = slot.start.getHours();
                              const infoObr = getHorarioObrigatorioParaData(diaSelecionado);
                              const ehObrigatorio = sHours >= infoObr.horaInicioNum && sHours < infoObr.horaFimNum;
                              return (
                                <div
                                  key={idx}
                                  style={{
                                    ...styles.whiteCard,
                                    padding: "16px",
                                    borderLeft: `4px solid ${slot.coberto ? "#22c55e" : "#ef4444"}`,
                                    border: ehObrigatorio ? `2px solid ${slot.coberto ? "#eab308" : "#f87171"}` : `1px solid ${theme.border}44`,
                                    background: slot.coberto ? "rgba(34, 197, 94, 0.03)" : "rgba(239, 68, 68, 0.03)",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "8px",
                                    transition: "transform 0.15s, box-shadow 0.15s",
                                    boxShadow: ehObrigatorio 
                                      ? (slot.coberto ? "0 0 10px rgba(234,179,8,0.2)" : "0 0 12px rgba(239,68,68,0.35)")
                                      : "0 2px 8px rgba(0,0,0,0.05)"
                                  }}
                                >
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span style={{ fontSize: "14px", fontWeight: "800", color: theme.text }}>
                                      {ehObrigatorio ? "⭐ " : ""}{slot.label}
                                    </span>
                                    <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                                      {ehObrigatorio && (
                                        <span style={{ fontSize: "8px", fontWeight: "900", background: "#facc15", color: "#000", padding: "2px 4px", borderRadius: "3px" }}>OBRIGATÓRIO</span>
                                      )}
                                      <span style={{
                                        fontSize: "9px",
                                        fontWeight: "800",
                                        padding: "2px 6px",
                                        borderRadius: "4px",
                                        background: slot.coberto ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.15)",
                                        color: slot.coberto ? "#22c55e" : "#ef4444"
                                      }}>
                                        {slot.coberto ? "COBERTO" : "VAZIO"}
                                      </span>
                                    </div>
                                  </div>
                                  <div style={{ fontSize: "12px", color: theme.subtext }}>
                                    {slot.coberto ? (
                                      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                        <span style={{ fontWeight: "700", color: theme.text, fontSize: "11px" }}>Trabalhando:</span>
                                        {slot.funcionarios.map((f, fIdx) => (
                                          <div key={fIdx} style={{ display: "flex", alignItems: "center", gap: "4px", color: theme.text }}>
                                            • {f.nome} <span style={{ fontSize: "10px", color: theme.subtext }}>({f.idJogo ? `#${f.idJogo}` : ""})</span>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <span style={{ color: "#ef4444", fontWeight: "700" }}>
                                        {ehObrigatorio ? "🚨 FALHA: Horário Obrigatório Sem Cobertura" : "⚠️ Ninguém trabalhou"}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ABA: COMPARATIVO */}
      {abaRelatorio === "comparativo" && (
        <div style={{ animation: "fadeIn 0.3s ease-out" }}>
          {jaGerou && !relatorioCarregando ? (
            <>
              {/* Botão de Relatório Externo e Links de Compartilhamento */}
              <div style={{ display: "flex", flexDirection: "column", background: "rgba(30, 41, 59, 0.4)", padding: "16px", borderRadius: "12px", border: `1px solid ${theme.border}44`, marginBottom: "24px", gap: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                  <div>
                    <h4 style={{ color: theme.text, fontSize: "14px", fontWeight: "700", margin: 0 }}>🔗 Compartilhamento com Pessoas Externas</h4>
                    <p style={{ color: theme.subtext, fontSize: "12px", margin: "2px 0 0 0" }}>Gere um link web público para pessoas sem login verem este comparativo de cobertura (pontos manuais desconsiderados).</p>
                  </div>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <button
                      onClick={criarLinkCompartilhado}
                      disabled={gerandoLinkShare}
                      style={{
                        background: "rgba(16, 185, 129, 0.15)",
                        border: "1px solid rgba(16, 185, 129, 0.3)",
                        color: "#10b981",
                        padding: "8px 16px",
                        borderRadius: "8px",
                        cursor: "pointer",
                        fontSize: "12px",
                        fontWeight: "700",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px"
                      }}
                    >
                      {gerandoLinkShare ? "⏳ Gerando..." : "🔗 Gerar Link Compartilhável"}
                    </button>
                    <button
                      onClick={() => setModalRelatorioMecanicasAberta(true)}
                      style={{
                        background: "rgba(56, 189, 248, 0.15)",
                        border: "1px solid rgba(56, 189, 248, 0.3)",
                        color: "#38bdf8",
                        padding: "8px 16px",
                        borderRadius: "8px",
                        cursor: "pointer",
                        fontSize: "12px",
                        fontWeight: "700",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px"
                      }}
                    >
                      📄 Visualizar Relatório
                    </button>
                  </div>
                </div>

                {/* Listagem de Links Ativos */}
                {linksCompartilhados.length > 0 && (
                  <div style={{ marginTop: "10px", borderTop: `1px solid ${theme.border}22`, paddingTop: "12px" }}>
                    <span style={{ fontSize: "11px", fontWeight: "800", color: theme.subtext, textTransform: "uppercase", display: "block", marginBottom: "8px" }}>Links Compartilhados Ativos:</span>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {linksCompartilhados.map(link => {
                        const urlCompleta = `${window.location.origin}${window.location.pathname}#/share/comparativo-mecanicas?id=${link.id}`;
                        return (
                          <div key={link.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255,255,255,0.02)", padding: "8px 12px", borderRadius: "8px", border: `1px solid ${theme.border}22` }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                              <span style={{ fontSize: "12px", color: theme.text, fontWeight: "600" }}>
                                Período: {fmtBR(link.data_inicio)} – {fmtBR(link.data_fim)}
                              </span>
                              <span style={{ fontSize: "10px", color: theme.subtext }}>
                                Criado por {link.criado_por} em {new Date(link.criado_em).toLocaleString("pt-BR")}
                              </span>
                            </div>
                            <div style={{ display: "flex", gap: "6px" }}>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(urlCompleta);
                                  alert("📋 Link copiado para a área de transferência!");
                                }}
                                style={{
                                  background: "rgba(255,255,255,0.05)",
                                  border: `1px solid ${theme.border}`,
                                  color: theme.text,
                                  padding: "4px 10px",
                                  borderRadius: "6px",
                                  fontSize: "11px",
                                  cursor: "pointer",
                                  fontWeight: "600"
                                }}
                              >
                                📋 Copiar Link
                              </button>
                              <button
                                onClick={() => deletarLinkCompartilhado(link.id)}
                                style={{
                                  background: "rgba(239, 68, 68, 0.15)",
                                  border: "1px solid rgba(239, 68, 68, 0.3)",
                                  color: "#ef4444",
                                  padding: "4px 10px",
                                  borderRadius: "6px",
                                  fontSize: "11px",
                                  cursor: "pointer",
                                  fontWeight: "600"
                                }}
                              >
                                🗑️ Apagar
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* PODIUM/RANKING DESIGN */}
              <div style={{ textAlign: "center", marginBottom: "32px" }}>
                <h3 style={{ color: theme.text, fontSize: "20px", fontWeight: "800", marginBottom: "8px" }}>
                  🏆 Ranking de Funcionamento Geral (Tempo Aberto)
                </h3>
                <p style={{ color: theme.subtext, fontSize: "12px", marginBottom: "24px" }}>
                  Baseado no percentual de tempo de cobertura em que a oficina teve pelo menos 1 funcionário trabalhando no período completo.
                </p>

                {/* PODIUM GRID */}
                <div style={{ 
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "24px",
                  justifyContent: "center",
                  alignItems: "flex-end",
                  maxWidth: "850px",
                  margin: "0 auto 32px auto"
                }}>
                  
                  {/* 2º LUGAR */}
                  {rankingMecanicas[1] && (
                    <div style={{
                      background: "rgba(255,255,255,0.02)",
                      borderRadius: "16px",
                      border: "1px solid rgba(192, 192, 192, 0.2)",
                      padding: "24px 16px",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      order: 2,
                      minHeight: "220px",
                      justifyContent: "center",
                      position: "relative",
                      boxShadow: "0 4px 30px rgba(0,0,0,0.2)",
                      flex: "1 1 220px",
                      maxWidth: "240px"
                    }}>
                      <div style={{ position: "absolute", top: "-15px", fontSize: "32px" }}>🥈</div>
                      <span style={{ fontSize: "11px", fontWeight: "800", color: "rgba(192, 192, 192, 0.8)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px" }}>2º Lugar</span>
                      <h4 style={{ color: rankingMecanicas[1].cor, fontSize: "18px", fontWeight: "800", marginBottom: "12px" }}>{rankingMecanicas[1].nome}</h4>
                      <div style={{ fontSize: "28px", fontWeight: "900", color: theme.text }}>{rankingMecanicas[1].taxaCobertura.toFixed(1)}%</div>
                      <span style={{ fontSize: "11px", color: theme.subtext, marginTop: "4px" }}>Cobertura total</span>
                      <span style={{ fontSize: "12px", color: theme.text, fontWeight: "600", marginTop: "12px" }}>Funcionamento: {fmtMin(rankingMecanicas[1].minutosCobertos)}</span>
                    </div>
                  )}

                  {/* 1º LUGAR */}
                  {rankingMecanicas[0] && (
                    <div style={{
                      background: "rgba(255,255,255,0.03)",
                      borderRadius: "20px",
                      border: "1.5px solid rgba(250, 204, 21, 0.4)",
                      padding: "32px 20px",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      order: 1,
                      minHeight: "260px",
                      justifyContent: "center",
                      position: "relative",
                      boxShadow: "0 10px 30px rgba(250,204,21,0.05)",
                      transform: "scale(1.03)",
                      flex: "1 1 250px",
                      maxWidth: "280px"
                    }}>
                      <div style={{ position: "absolute", top: "-20px", fontSize: "40px" }}>🥇</div>
                      <span style={{ fontSize: "12px", fontWeight: "900", color: "#facc15", textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: "8px" }}>🏆 Campeã</span>
                      <h4 style={{ color: rankingMecanicas[0].cor, fontSize: "22px", fontWeight: "900", marginBottom: "12px" }}>{rankingMecanicas[0].nome}</h4>
                      <div style={{ fontSize: "36px", fontWeight: "900", color: "#facc15" }}>{rankingMecanicas[0].taxaCobertura.toFixed(1)}%</div>
                      <span style={{ fontSize: "11px", color: "rgba(250,204,21,0.8)", marginTop: "4px" }}>Cobertura total</span>
                      <span style={{ fontSize: "13px", color: theme.text, fontWeight: "700", marginTop: "16px" }}>Funcionamento: {fmtMin(rankingMecanicas[0].minutosCobertos)}</span>
                    </div>
                  )}

                  {/* 3º LUGAR */}
                  {rankingMecanicas[2] && (
                    <div style={{
                      background: "rgba(255,255,255,0.01)",
                      borderRadius: "16px",
                      border: "1px solid rgba(205, 127, 50, 0.2)",
                      padding: "20px 16px",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      order: 3,
                      minHeight: "190px",
                      justifyContent: "center",
                      position: "relative",
                      boxShadow: "0 4px 30px rgba(0,0,0,0.2)",
                      flex: "1 1 220px",
                      maxWidth: "240px"
                    }}>
                      <div style={{ position: "absolute", top: "-15px", fontSize: "28px" }}>🥉</div>
                      <span style={{ fontSize: "11px", fontWeight: "800", color: "rgba(205, 127, 50, 0.8)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px" }}>3º Lugar</span>
                      <h4 style={{ color: rankingMecanicas[2].cor, fontSize: "16px", fontWeight: "800", marginBottom: "12px" }}>{rankingMecanicas[2].nome}</h4>
                      <div style={{ fontSize: "24px", fontWeight: "900", color: theme.text }}>{rankingMecanicas[2].taxaCobertura.toFixed(1)}%</div>
                      <span style={{ fontSize: "11px", color: theme.subtext, marginTop: "4px" }}>Cobertura total</span>
                      <span style={{ fontSize: "11px", color: theme.text, fontWeight: "600", marginTop: "8px" }}>Funcionamento: {fmtMin(rankingMecanicas[2].minutosCobertos)}</span>
                    </div>
                  )}

                </div>
              </div>

              {/* PODIUM/RANKING HORARIO OBRIGATORIO */}
              <div style={{ textAlign: "center", marginBottom: "32px", borderTop: `1px solid ${theme.border}33`, paddingTop: "32px" }}>
                <h3 style={{ color: theme.text, fontSize: "20px", fontWeight: "800", marginBottom: "8px" }}>
                  ⭐ Ranking de Horário Obrigatório
                </h3>
                <p style={{ color: theme.subtext, fontSize: "12px", marginBottom: "24px" }}>
                  Baseado no cumprimento do horário de funcionamento obrigatório da cidade (18h às 23h a partir de 07/09/2026; 19h às 22h até 06/09/2026).
                </p>

                {/* PODIUM GRID OBRIGATORIO */}
                <div style={{ 
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "24px",
                  justifyContent: "center",
                  alignItems: "flex-end",
                  maxWidth: "850px",
                  margin: "0 auto 32px auto"
                }}>
                  
                  {/* 2º LUGAR */}
                  {rankingMecanicasObrigatorias[1] && (
                    <div style={{
                      background: "rgba(255,255,255,0.02)",
                      borderRadius: "16px",
                      border: "1px solid rgba(192, 192, 192, 0.2)",
                      padding: "24px 16px",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      order: 2,
                      minHeight: "220px",
                      justifyContent: "center",
                      position: "relative",
                      boxShadow: "0 4px 30px rgba(0,0,0,0.2)",
                      flex: "1 1 220px",
                      maxWidth: "240px"
                    }}>
                      <div style={{ position: "absolute", top: "-15px", fontSize: "32px" }}>🥈</div>
                      <span style={{ fontSize: "11px", fontWeight: "800", color: "rgba(192, 192, 192, 0.8)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px" }}>2º Lugar</span>
                      <h4 style={{ color: rankingMecanicasObrigatorias[1].cor, fontSize: "18px", fontWeight: "800", marginBottom: "12px" }}>{rankingMecanicasObrigatorias[1].nome}</h4>
                      <div style={{ fontSize: "28px", fontWeight: "900", color: theme.text }}>{rankingMecanicasObrigatorias[1].taxaCoberturaObrigatoria.toFixed(1)}%</div>
                      <span style={{ fontSize: "11px", color: theme.subtext, marginTop: "4px" }}>Cob. Obrigatória</span>
                      <span style={{ fontSize: "12px", color: "#f87171", fontWeight: "700", marginTop: "12px" }}>Não cumprido: {fmtMin(rankingMecanicasObrigatorias[1].minutosObrigatoriosNaoCumpridos)}</span>
                    </div>
                  )}

                  {/* 1º LUGAR */}
                  {rankingMecanicasObrigatorias[0] && (
                    <div style={{
                      background: "rgba(255,255,255,0.03)",
                      borderRadius: "20px",
                      border: "1.5px solid rgba(250, 204, 21, 0.4)",
                      padding: "32px 20px",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      order: 1,
                      minHeight: "260px",
                      justifyContent: "center",
                      position: "relative",
                      boxShadow: "0 10px 30px rgba(250,204,21,0.05)",
                      transform: "scale(1.03)",
                      flex: "1 1 250px",
                      maxWidth: "280px"
                    }}>
                      <div style={{ position: "absolute", top: "-20px", fontSize: "40px" }}>🥇</div>
                      <span style={{ fontSize: "12px", fontWeight: "900", color: "#facc15", textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: "8px" }}>🏆 Campeã</span>
                      <h4 style={{ color: rankingMecanicasObrigatorias[0].cor, fontSize: "22px", fontWeight: "900", marginBottom: "12px" }}>{rankingMecanicasObrigatorias[0].nome}</h4>
                      <div style={{ fontSize: "36px", fontWeight: "900", color: "#facc15" }}>{rankingMecanicasObrigatorias[0].taxaCoberturaObrigatoria.toFixed(1)}%</div>
                      <span style={{ fontSize: "11px", color: "rgba(250,204,21,0.8)", marginTop: "4px" }}>Cob. Obrigatória</span>
                      <span style={{ fontSize: "13px", color: "#f87171", fontWeight: "700", marginTop: "16px" }}>Não cumprido: {fmtMin(rankingMecanicasObrigatorias[0].minutosObrigatoriosNaoCumpridos)}</span>
                    </div>
                  )}

                  {/* 3º LUGAR */}
                  {rankingMecanicasObrigatorias[2] && (
                    <div style={{
                      background: "rgba(255,255,255,0.01)",
                      borderRadius: "16px",
                      border: "1px solid rgba(205, 127, 50, 0.2)",
                      padding: "20px 16px",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      order: 3,
                      minHeight: "190px",
                      justifyContent: "center",
                      position: "relative",
                      boxShadow: "0 4px 30px rgba(0,0,0,0.2)",
                      flex: "1 1 220px",
                      maxWidth: "240px"
                    }}>
                      <div style={{ position: "absolute", top: "-15px", fontSize: "28px" }}>🥉</div>
                      <span style={{ fontSize: "11px", fontWeight: "800", color: "rgba(205, 127, 50, 0.8)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px" }}>3º Lugar</span>
                      <h4 style={{ color: rankingMecanicasObrigatorias[2].cor, fontSize: "16px", fontWeight: "800", marginBottom: "12px" }}>{rankingMecanicasObrigatorias[2].nome}</h4>
                      <div style={{ fontSize: "24px", fontWeight: "900", color: theme.text }}>{rankingMecanicasObrigatorias[2].taxaCoberturaObrigatoria.toFixed(1)}%</div>
                      <span style={{ fontSize: "11px", color: theme.subtext, marginTop: "4px" }}>Cob. Obrigatória</span>
                      <span style={{ fontSize: "11px", color: "#f87171", fontWeight: "700", marginTop: "8px" }}>Não cumprido: {fmtMin(rankingMecanicasObrigatorias[2].minutosObrigatoriosNaoCumpridos)}</span>
                    </div>
                  )}

                </div>
              </div>

              {/* RANKING DOS 3 FUNCIONÁRIOS MAIS ATIVOS NO PERÍODO OBRIGATÓRIO */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px", marginBottom: "32px" }}>
                
                {/* RANKING RED'S */}
                <div style={{ background: theme.card2, borderRadius: "16px", padding: "20px", border: `1px solid ${theme.border}` }}>
                  <h4 style={{ color: theme.text, fontSize: "14px", fontWeight: "800", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                    🔴 Top 3 Funcionários Ativos (RED's — Horário Obrigatório)
                  </h4>
                  {rankingFuncionariosObrigatorioReds.length === 0 ? (
                    <div style={{ padding: "20px", textAlign: "center", color: theme.subtext, fontSize: "13px" }}>Nenhuma atividade registrada no período obrigatório.</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      {rankingFuncionariosObrigatorioReds.map((f, i) => {
                        const medalhas = ["🥇", "🥈", "🥉"];
                        return (
                          <div key={f.nome} style={{
                            display: "flex",
                            alignItems: "center",
                            padding: "10px 14px",
                            borderRadius: "10px",
                            background: "rgba(239, 68, 68, 0.04)",
                            border: "1px solid rgba(239, 68, 68, 0.15)",
                            justifyContent: "space-between"
                          }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                              <span style={{ fontSize: "20px" }}>{medalhas[i]}</span>
                              <div>
                                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                  <div style={{ fontSize: "13px", fontWeight: "800", color: theme.text }}>{f.nome}</div>
                                  <span style={{
                                    padding: "1px 6px",
                                    borderRadius: "8px",
                                    fontSize: "9px",
                                    fontWeight: "800",
                                    textTransform: "uppercase",
                                    background: "rgba(239, 68, 68, 0.12)",
                                    color: "#ef4444",
                                    border: "1px solid rgba(239, 68, 68, 0.3)"
                                  }}>RED's</span>
                                </div>
                                <div style={{ fontSize: "11px", color: theme.subtext }}>ID Jogo: #{f.idJogo}</div>
                              </div>
                            </div>
                            <span style={{ fontSize: "13px", fontWeight: "900", color: "#ef4444" }}>{fmtMin(f.minutos)}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* RANKING GERAL CIDADE */}
                <div style={{ background: theme.card2, borderRadius: "16px", padding: "20px", border: `1px solid ${theme.border}` }}>
                  <h4 style={{ color: theme.text, fontSize: "14px", fontWeight: "800", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                    🌐 Top 3 Funcionários Ativos (Cidade Toda — Horário Obrigatório)
                  </h4>
                  {rankingFuncionariosObrigatorioGeral.length === 0 ? (
                    <div style={{ padding: "20px", textAlign: "center", color: theme.subtext, fontSize: "13px" }}>Nenhuma atividade registrada no período obrigatório.</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      {rankingFuncionariosObrigatorioGeral.map((f, i) => {
                        const medalhas = ["🥇", "🥈", "🥉"];
                        return (
                          <div key={f.nome} style={{
                            display: "flex",
                            alignItems: "center",
                            padding: "10px 14px",
                            borderRadius: "10px",
                            background: "rgba(56, 189, 248, 0.04)",
                            border: "1px solid rgba(56, 189, 248, 0.15)",
                            justifyContent: "space-between"
                          }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                              <span style={{ fontSize: "20px" }}>{medalhas[i]}</span>
                              <div>
                                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                                  <div style={{ fontSize: "13px", fontWeight: "800", color: theme.text }}>{f.nome}</div>
                                  <span style={{
                                    padding: "1px 6px",
                                    borderRadius: "8px",
                                    fontSize: "9px",
                                    fontWeight: "800",
                                    textTransform: "uppercase",
                                    background: (f.mecanica === "harmony" ? "rgba(168, 85, 247, 0.12)" : f.mecanica === "dudark" ? "rgba(249, 115, 22, 0.12)" : "rgba(239, 68, 68, 0.12)"),
                                    color: f.mecanica === "harmony" ? "#a855f7" : f.mecanica === "dudark" ? "#f97316" : "#ef4444",
                                    border: `1px solid ${f.mecanica === "harmony" ? "rgba(168, 85, 247, 0.3)" : f.mecanica === "dudark" ? "rgba(249, 115, 22, 0.3)" : "rgba(239, 68, 68, 0.3)"}`
                                  }}>{f.mecanica === "harmony" ? "Harmony" : f.mecanica === "dudark" ? "Dudark" : "RED's"}</span>
                                </div>
                                <div style={{ fontSize: "11px", color: theme.subtext }}>ID Jogo: #{f.idJogo}</div>
                              </div>
                            </div>
                            <span style={{ fontSize: "13px", fontWeight: "900", color: "#38bdf8" }}>{fmtMin(f.minutos)}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>

              {/* COMPARATIVE METRICS GRID & VISUAL PROGRESS */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px", marginBottom: "32px" }}>
                
                {/* PROGRESS BARS GERAL */}
                <div style={{ background: theme.card2, borderRadius: "16px", padding: "20px", border: `1px solid ${theme.border}` }}>
                  <h4 style={{ color: theme.text, fontSize: "14px", fontWeight: "700", marginBottom: "16px" }}>📊 Gráfico de Cobertura Geral</h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    {rankingMecanicas.map((m) => (
                      <div key={m.id}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: "12px" }}>
                          <span style={{ fontWeight: "700", color: theme.text }}>{m.nome}</span>
                          <span style={{ fontWeight: "800", color: m.cor }}>{m.taxaCobertura.toFixed(1)}% (Aberto: {fmtMin(m.minutosCobertos)})</span>
                        </div>
                        <div style={{ width: "100%", height: "12px", background: "rgba(255,255,255,0.05)", borderRadius: "6px", overflow: "hidden" }}>
                          <div style={{ 
                            width: `${m.taxaCobertura}%`, 
                            height: "100%", 
                            background: `linear-gradient(90deg, ${m.cor}dd, ${m.cor})`,
                            borderRadius: "6px",
                            transition: "width 0.8s cubic-bezier(0.4, 0, 0.2, 1)"
                          }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* PROGRESS BARS OBRIGATORIO */}
                <div style={{ background: theme.card2, borderRadius: "16px", padding: "20px", border: `1px solid ${theme.border}` }}>
                  <h4 style={{ color: theme.text, fontSize: "14px", fontWeight: "700", marginBottom: "16px" }}>⭐ Gráfico de Horário Obrigatório (Horário de Pico)</h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    {rankingMecanicasObrigatorias.map((m) => (
                      <div key={m.id}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: "12px" }}>
                          <span style={{ fontWeight: "700", color: theme.text }}>{m.nome}</span>
                          <span style={{ fontWeight: "800", color: m.cor }}>{m.taxaCoberturaObrigatoria.toFixed(1)}% (Faltou: {fmtMin(m.minutosObrigatoriosNaoCumpridos)})</span>
                        </div>
                        <div style={{ width: "100%", height: "12px", background: "rgba(255,255,255,0.05)", borderRadius: "6px", overflow: "hidden" }}>
                          <div style={{ 
                            width: `${m.taxaCoberturaObrigatoria}%`, 
                            height: "100%", 
                            background: `linear-gradient(90deg, ${m.cor}dd, ${m.cor})`,
                            borderRadius: "6px",
                            transition: "width 0.8s cubic-bezier(0.4, 0, 0.2, 1)"
                          }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* DETAILED STATS TABLE */}
              <div style={{ background: theme.card2, borderRadius: "16px", padding: "20px", border: `1px solid ${theme.border}`, overflowX: "auto", marginBottom: "32px" }}>
                <h4 style={{ color: theme.text, fontSize: "14px", fontWeight: "700", marginBottom: "16px" }}>📋 Tabela Comparativa de Desempenho</h4>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "900px" }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${theme.border}`, textAlign: "left" }}>
                      <th style={{ padding: "10px", color: theme.subtext, fontSize: "11px", fontWeight: "700", textTransform: "uppercase" }}>Mecânica</th>
                      <th style={{ padding: "10px", color: theme.subtext, fontSize: "11px", fontWeight: "700", textTransform: "uppercase" }}>Cob. Geral</th>
                      <th style={{ padding: "10px", color: theme.subtext, fontSize: "11px", fontWeight: "700", textTransform: "uppercase" }}>Tempo Aberto (Geral)</th>
                      <th style={{ padding: "10px", color: theme.subtext, fontSize: "11px", fontWeight: "700", textTransform: "uppercase" }}>Cob. Obrigatória (Pico)</th>
                      <th style={{ padding: "10px", color: theme.subtext, fontSize: "11px", fontWeight: "700", textTransform: "uppercase" }}>Falta Obrigatório</th>
                      <th style={{ padding: "10px", color: theme.subtext, fontSize: "11px", fontWeight: "700", textTransform: "uppercase" }}>Total Horas Staff</th>
                      <th style={{ padding: "10px", color: theme.subtext, fontSize: "11px", fontWeight: "700", textTransform: "uppercase" }}>Sessões</th>
                      <th style={{ padding: "10px", color: theme.subtext, fontSize: "11px", fontWeight: "700", textTransform: "uppercase" }}>Funcionários</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankingMecanicas.map((m) => (
                      <tr key={m.id} style={{ borderBottom: `1px solid rgba(255,255,255,0.03)`, height: "48px" }}>
                        <td style={{ padding: "10px", fontWeight: "800", color: m.cor }}>{m.nome}</td>
                        <td style={{ padding: "10px", fontWeight: "700", color: theme.text }}>{m.taxaCobertura.toFixed(1)}%</td>
                        <td style={{ padding: "10px", color: theme.text }}>{fmtMin(m.minutosCobertos)}</td>
                        <td style={{ padding: "10px", fontWeight: "700", color: theme.text }}>{m.taxaCoberturaObrigatoria.toFixed(1)}%</td>
                        <td style={{ padding: "10px", color: "#f87171", fontWeight: "700" }}>{fmtMin(m.minutosObrigatoriosNaoCumpridos)}</td>
                        <td style={{ padding: "10px", color: theme.text }}>{fmtMin(m.totalMin)}</td>
                        <td style={{ padding: "10px", color: theme.text }}>{m.sessoes}</td>
                        <td style={{ padding: "10px", color: theme.text }}>{m.funcionariosAtivos}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* COMPARATIVE LINEAR TIMELINE */}
              <div style={{ background: theme.card2, borderRadius: "16px", padding: "20px", border: `1px solid ${theme.border}`, overflowX: "auto" }}>
                <h4 style={{ color: theme.text, fontSize: "14px", fontWeight: "700", marginBottom: "16px" }}>📅 Comparativo Linear de Cobertura (Linha do Tempo)</h4>
                <div style={{ minWidth: "920px" }}>
                  
                  {/* Shift Period Headers */}
                  <div style={{ display: "flex", alignItems: "center", marginBottom: "6px" }}>
                    <div style={{ width: "160px", flexShrink: 0 }} />
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(48, 1fr)", flex: 1, gap: "3px" }}>
                      <div style={{ gridColumn: "span 12", background: "rgba(168,85,247,0.03)", border: `1px solid ${theme.border}33`, borderBottom: "none", padding: "4px 2px", textAlign: "center", fontSize: "10px", fontWeight: "800", color: "#a855f7", borderTopLeftRadius: "4px", borderTopRightRadius: "4px" }}>
                        🌑 Madrugada
                      </div>
                      <div style={{ gridColumn: "span 12", background: "rgba(251,191,36,0.03)", border: `1px solid ${theme.border}33`, borderBottom: "none", padding: "4px 2px", textAlign: "center", fontSize: "10px", fontWeight: "800", color: "#fbbf24", borderTopLeftRadius: "4px", borderTopRightRadius: "4px" }}>
                        🌅 Manhã
                      </div>
                      <div style={{ gridColumn: "span 12", background: "rgba(249,115,22,0.03)", border: `1px solid ${theme.border}33`, borderBottom: "none", padding: "4px 2px", textAlign: "center", fontSize: "10px", fontWeight: "800", color: "#f97316", borderTopLeftRadius: "4px", borderTopRightRadius: "4px" }}>
                        ☀️ Tarde
                      </div>
                      <div style={{ gridColumn: "span 12", background: "rgba(59,130,246,0.03)", border: `1px solid ${theme.border}33`, borderBottom: "none", padding: "4px 2px", textAlign: "center", fontSize: "10px", fontWeight: "800", color: "#3b82f6", borderTopLeftRadius: "4px", borderTopRightRadius: "4px" }}>
                        🌙 Noite
                      </div>
                    </div>
                  </div>

                  {/* Header Hours */}
                  <div style={{ display: "flex", alignItems: "center", marginBottom: "12px" }}>
                    <div style={{ width: "160px", fontWeight: "800", fontSize: "11px", color: theme.subtext }}>MECÂNICA / DIA</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(48, 1fr)", flex: 1, gap: "3px" }}>
                      {Array.from({ length: 24 }).map((_, h) => (
                        <div key={h} style={{ gridColumn: "span 2", textAlign: "left", fontSize: "10px", color: "#38bdf8", borderLeft: `1px solid ${theme.border}44`, paddingLeft: "2px" }}>
                          {String(h).padStart(2, "0")}h
                        </div>
                      ))}
                    </div>
                  </div>

                    {/* Rows */}
                    {diasPeriodo.map(dia => {
                      const dataObj = new Date(`${dia}T12:00:00`);
                      const diaSemana = dataObj.toLocaleDateString("pt-BR", { weekday: "short" });
                      const [, mes, diaNum] = dia.split("-");
                      const labelDia = `${diaSemana.toUpperCase().replace(".", "")} (${diaNum}/${mes})`;

                      const slotsM1 = coberturaComparativa[dia]?.m1 || [];
                      const slotsM2 = coberturaComparativa[dia]?.m2 || [];
                      const slotsM3 = coberturaComparativa[dia]?.m3 || [];

                      const renderRow = (slots, colorActive, labelMecanica) => {
                        return (
                          <div style={{ display: "flex", alignItems: "center", marginBottom: "4px" }}>
                            <div style={{ width: "160px", display: "flex", alignItems: "center", gap: "8px" }}>
                              <span style={{ 
                                width: "8px", 
                                height: "8px", 
                                borderRadius: "50%", 
                                background: colorActive 
                              }} />
                              <span style={{ fontSize: "10px", color: theme.text, fontWeight: "700" }}>{labelMecanica}</span>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(48, 1fr)", flex: 1, gap: "3px" }}>
                              {slots.map((slot, idx) => {
                                const infoObr = getHorarioObrigatorioParaData(dia);
                                const ehObrigatorio = idx >= infoObr.slotInicioIdx && idx <= infoObr.slotFimIdx;
                                const tooltipText = `${ehObrigatorio ? `⭐ [Horário Obrigatório ${infoObr.labelCurto}] ` : ""}${slot.label} (${labelMecanica})\n${slot.coberto ? `🟢 Coberto por:\n${slot.funcionarios.map(f => `• ${f.nome}`).join("\n")}` : `🔴 Sem cobertura${ehObrigatorio ? " (FALHA NO HORÁRIO OBRIGATÓRIO)" : ""}`}\n\n📌 Clique para copiar`;
                                
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

                                return (
                                  <div
                                    key={idx}
                                    style={{
                                      height: "16px",
                                      borderRadius: "4px",
                                      background: slot.coberto 
                                        ? colorActive
                                        : emptyColor,
                                      border: ehObrigatorio
                                        ? `2px solid ${slot.coberto ? "#facc15" : "#f87171"}`
                                        : `1px solid ${slot.coberto ? colorActive : emptyBorder}`,
                                      boxShadow: ehObrigatorio && !slot.coberto ? "0 0 6px rgba(248,113,113,0.8)" : "none",
                                      cursor: "pointer",
                                      position: "relative",
                                      transition: "transform 0.1s ease, box-shadow 0.1s ease"
                                    }}
                                    onMouseEnter={e => {
                                      e.currentTarget.style.transform = "scale(1.3)";
                                      e.currentTarget.style.zIndex = 10;
                                      e.currentTarget.style.boxShadow = "0 2px 6px rgba(0,0,0,0.4)";
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      setTimelineTooltip({
                                        visible: true,
                                        x: rect.left + rect.width / 2,
                                        y: rect.top - 8,
                                        content: tooltipText
                                      });
                                    }}
                                    onMouseLeave={e => {
                                      e.currentTarget.style.transform = "scale(1)";
                                      e.currentTarget.style.zIndex = 1;
                                      e.currentTarget.style.boxShadow = "none";
                                      setTimelineTooltip({ visible: false, x: 0, y: 0, content: "" });
                                    }}
                                    onClick={() => {
                                      const cleanText = tooltipText.replace("\n\n📌 Clique para copiar", "");
                                      navigator.clipboard.writeText(cleanText)
                                        .then(() => {
                                          alert("📋 Copiado para a área de transferência!");
                                        })
                                        .catch(err => {
                                          console.error("Erro ao copiar:", err);
                                        });
                                    }}
                                  />
                                );
                              })}
                            </div>
                          </div>
                        );
                      };

                      return (
                        <div key={dia} style={{ marginBottom: "16px", padding: "12px", background: "rgba(255,255,255,0.01)", borderRadius: "10px", border: `1px solid ${theme.border}44` }}>
                          <div style={{ fontSize: "12px", fontWeight: "800", color: theme.text, marginBottom: "8px", borderBottom: `1px solid ${theme.border}22`, paddingBottom: "4px" }}>
                            {labelDia}
                          </div>
                          {renderRow(slotsM1, "#ef4444", "RED's")}
                          {renderRow(slotsM2, "#eab308", "Harmony")}
                          {renderRow(slotsM3, "#38bdf8", "Dudark")}
                        </div>
                      );
                    })}

                  </div>
                </div>
            </>
          ) : (
            <div style={{ padding: "40px", textAlign: "center", color: theme.subtext }}>
              {relatorioCarregando ? "Carregando dados comparativos..." : "Selecione um período acima e clique em 'Gerar Relatório' para ver a comparação."}
            </div>
          )}
        </div>
      )}

      {/* ABA: PONTOS SEM SAÍDA / ZERADOS */}
      {abaRelatorio === "sem_saida" && (
        <div>
          {/* CARDS DE RESUMO DA ABA SEM SAÍDA */}
          {jaGerou && !relatorioCarregando && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px", marginBottom: "20px" }}>
              <div style={{ ...styles.whiteCard, padding: "14px 18px", borderLeft: "3px solid #facc15", textAlign: "center" }}>
                <div style={{ fontSize: "22px" }}>⚠️</div>
                <div style={{ fontSize: "22px", fontWeight: "800", color: "#facc15" }}>{pontosSemSaidaPeriodo.length}</div>
                <div style={{ fontSize: "11px", color: theme.subtext, fontWeight: "600" }}>Total Sem Saída / Zerados</div>
              </div>

              <div style={{ ...styles.whiteCard, padding: "14px 18px", borderLeft: "3px solid #ef4444", textAlign: "center" }}>
                <div style={{ fontSize: "22px" }}>🔓</div>
                <div style={{ fontSize: "22px", fontWeight: "800", color: "#ef4444" }}>
                  {pontosSemSaidaPeriodo.filter(p => !p.saida).length}
                </div>
                <div style={{ fontSize: "11px", color: theme.subtext, fontWeight: "600" }}>Sem Registro de Saída (Abertos)</div>
              </div>

              <div style={{ ...styles.whiteCard, padding: "14px 18px", borderLeft: "3px solid #f97316", textAlign: "center" }}>
                <div style={{ fontSize: "22px" }}>⚡</div>
                <div style={{ fontSize: "22px", fontWeight: "800", color: "#f97316" }}>
                  {pontosSemSaidaPeriodo.filter(p => p.saida).length}
                </div>
                <div style={{ fontSize: "11px", color: theme.subtext, fontWeight: "600" }}>Zerados / Miss-Clicks (0 min)</div>
              </div>

              <div style={{ ...styles.whiteCard, padding: "14px 18px", borderLeft: "3px solid #22c55e", textAlign: "center" }}>
                <div style={{ fontSize: "22px" }}>🛠️</div>
                <div style={{ fontSize: "22px", fontWeight: "800", color: "#22c55e" }}>
                  {Object.keys(mapaAnaliseAtividades).length > 0
                    ? Object.values(mapaAnaliseAtividades).filter(a => a.temAtividades).length
                    : pontosSemSaidaPeriodo.filter(p => {
                        const totTun = p.totalTunagens || (p.detalhes?.tunagens ? p.detalhes.tunagens.length : 0);
                        const totBanc = p.totalBancada || (p.detalhes?.bancada ? p.detalhes.bancada.length : 0);
                        return totTun > 0 || totBanc > 0;
                      }).length}
                </div>
                <div style={{ fontSize: "11px", color: theme.subtext, fontWeight: "600" }}>Com Atividades (Tunagem / Bancada)</div>
              </div>
            </div>
          )}

          {/* BANNER DE RESULTADO DA ANÁLISE (QUANDO EXECUTADA) */}
          {Object.keys(mapaAnaliseAtividades).length > 0 && (
            <div style={{
              padding: "16px 22px",
              background: "linear-gradient(135deg, rgba(14, 165, 233, 0.12), rgba(59, 130, 246, 0.08))",
              border: "1.5px solid rgba(56, 189, 248, 0.35)",
              borderRadius: "14px",
              marginBottom: "20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "14px",
              boxShadow: "0 10px 25px -5px rgba(14, 165, 233, 0.15)"
            }}>
              <div style={{ maxWidth: "650px" }}>
                <div style={{ color: "#38bdf8", fontWeight: "800", fontSize: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>⚡ Análise de Atividades Concluída!</span>
                </div>
                <div style={{ color: theme.text, fontSize: "12px", marginTop: "4px", lineHeight: "1.5" }}>
                  Identificamos <b>{Object.values(mapaAnaliseAtividades).filter(a => a.temAtividades).length} pontos com atividades</b> (com saída sugerida pelo horário da última tunagem ou bancada) e <b>{Object.values(mapaAnaliseAtividades).filter(a => !a.temAtividades).length} pontos sem atividades</b> (miss-clicks de 0 minutos).
                </div>
              </div>

              <button
                onClick={fecharTodosPontosAnalisados}
                disabled={salvandoFechamento}
                style={{
                  background: "linear-gradient(135deg, #10b981, #059669)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "10px",
                  padding: "10px 20px",
                  fontSize: "12px",
                  fontWeight: "800",
                  cursor: salvandoFechamento ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  boxShadow: "0 4px 14px rgba(16, 185, 129, 0.3)",
                  opacity: salvandoFechamento ? 0.7 : 1,
                  transition: "all 0.15s"
                }}
              >
                {salvandoFechamento ? "⏳ Fechando Pontos no Banco..." : "💾 Fechar Todos os Pontos na Última Atividade"}
              </button>
            </div>
          )}

          {/* TABELA DE PONTOS SEM SAÍDA */}
          <div style={{ ...styles.whiteCard, padding: "0", overflow: "hidden" }}>
            {/* Header da Tabela com Barra de Pesquisa e Botão de Análise */}
            <div style={{ padding: "18px 22px", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", background: theme.card2 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: theme.text, display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>⚠️ Sessões sem Saída Registrada ou Zeradas</span>
                  <span style={{ fontSize: "12px", background: "rgba(250, 204, 21, 0.15)", color: "#facc15", padding: "2px 8px", borderRadius: "12px", fontWeight: "700", border: "1px solid rgba(250, 204, 21, 0.3)" }}>
                    {pontosSemSaidaPeriodo.length} ocorrência(s)
                  </span>
                </h3>
                <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: theme.subtext }}>
                  Sessões no período selecionado onde o colaborador bateu entrada mas não houve saída oficial, ou o registro encerrou em 0 minutos.
                </p>
              </div>

              {/* Ações e Campo de Busca */}
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <button
                  onClick={executarAnaliseAtividadesSemSaida}
                  disabled={analisandoAtividades || pontosSemSaidaPeriodo.length === 0}
                  style={{
                    background: "linear-gradient(135deg, #0ea5e9, #2563eb)",
                    color: "#fff",
                    border: "none",
                    borderRadius: "8px",
                    padding: "8px 16px",
                    fontSize: "12px",
                    fontWeight: "800",
                    cursor: (analisandoAtividades || pontosSemSaidaPeriodo.length === 0) ? "not-allowed" : "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    boxShadow: "0 4px 12px rgba(14, 165, 233, 0.3)",
                    opacity: (analisandoAtividades || pontosSemSaidaPeriodo.length === 0) ? 0.6 : 1,
                    transition: "all 0.2s"
                  }}
                  title="Cruza registros de tunagem, compras de bancada e movimentações de baú para encontrar a última atividade deste expediente"
                >
                  {analisandoAtividades ? "⏳ Analisando Atividades..." : "⚡ Analisar Pontos & Identificar Última Atividade"}
                </button>

                <input
                  type="text"
                  placeholder="🔎 Filtrar mecânico..."
                  value={filtroBuscaSemSaida}
                  onChange={(e) => setFiltroBuscaSemSaida(e.target.value)}
                  style={{
                    ...styles.input,
                    width: "190px",
                    padding: "7px 12px",
                    fontSize: "12px",
                    height: "34px",
                    background: "rgba(255,255,255,0.05)"
                  }}
                />
                {filtroBuscaSemSaida && (
                  <button
                    onClick={() => setFiltroBuscaSemSaida("")}
                    style={{
                      background: "rgba(255,255,255,0.1)",
                      border: "none",
                      color: theme.subtext,
                      borderRadius: "6px",
                      padding: "6px 10px",
                      fontSize: "11px",
                      cursor: "pointer"
                    }}
                  >
                    Limpar
                  </button>
                )}
              </div>
            </div>

            {/* Conteúdo da Tabela */}
            {relatorioCarregando ? (
              <div style={{ padding: "40px", textAlign: "center", color: theme.subtext }}>
                ⏳ Carregando relatório...
              </div>
            ) : pontosSemSaidaPeriodo.length === 0 ? (
              <div style={{ padding: "50px 20px", textAlign: "center", color: theme.subtext }}>
                <div style={{ fontSize: "36px", marginBottom: "10px" }}>✅</div>
                <div style={{ fontSize: "15px", fontWeight: "700", color: "#22c55e" }}>Tudo em ordem!</div>
                <div style={{ fontSize: "13px", marginTop: "4px" }}>
                  Nenhum ponto sem saída ou com duração zerada foi encontrado no período selecionado.
                </div>
              </div>
            ) : (() => {
              const filtrados = pontosSemSaidaPeriodo.filter(p => {
                if (!filtroBuscaSemSaida) return true;
                const q = filtroBuscaSemSaida.toLowerCase();
                const nome = (p.nomeExibicao || "").toLowerCase();
                const idStr = String(p.idJogoExibicao || "");
                const cargoStr = (p.cargoExibicao || "").toLowerCase();
                const obsStr = (p.motivoSemSaida || "").toLowerCase();
                return nome.includes(q) || idStr.includes(q) || cargoStr.includes(q) || obsStr.includes(q);
              });

              if (filtrados.length === 0) {
                return (
                  <div style={{ padding: "40px", textAlign: "center", color: theme.subtext }}>
                    Nenhum registro encontrado para a busca "{filtroBuscaSemSaida}".
                  </div>
                );
              }

              return (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: theme.card2, borderBottom: `1px solid ${theme.border}`, textAlign: "left" }}>
                        <th style={{ padding: "12px 14px", fontSize: "11px", color: theme.subtext, textTransform: "uppercase", width: "40px" }}>#</th>
                        <th style={{ padding: "12px 14px", fontSize: "11px", color: theme.subtext, textTransform: "uppercase" }}>Mecânico / Colaborador</th>
                        <th style={{ padding: "12px 14px", fontSize: "11px", color: theme.subtext, textTransform: "uppercase" }}>Entrada</th>
                        <th style={{ padding: "12px 14px", fontSize: "11px", color: theme.subtext, textTransform: "uppercase" }}>Saída Atual</th>
                        <th style={{ padding: "12px 14px", fontSize: "11px", color: theme.subtext, textTransform: "uppercase" }}>Atividades no Ponto</th>
                        <th style={{ padding: "12px 14px", fontSize: "11px", color: theme.subtext, textTransform: "uppercase" }}>Última Atividade / Saída Sugerida</th>
                        <th style={{ padding: "12px 14px", fontSize: "11px", color: theme.subtext, textTransform: "uppercase", textAlign: "right" }}>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtrados.map((item, idx) => {
                        const chave = String(item.uuid_entrada || item.uuid_sessao || `${item.idJogoExibicao}_${item.entrada}`);
                        const analise = mapaAnaliseAtividades[chave];

                        const dEntrada = new Date(item.entrada);
                        const dSaida = item.saida ? new Date(item.saida) : null;
                        const dataEntradaStr = !isNaN(dEntrada.getTime()) 
                          ? dEntrada.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }) 
                          : item.entrada;
                        const dataSaidaStr = dSaida && !isNaN(dSaida.getTime())
                          ? dSaida.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", second: "2-digit" })
                          : null;

                        const totTun = analise ? analise.totalTunagens : (item.totalTunagens || (item.detalhes?.tunagens ? item.detalhes.tunagens.length : 0));
                        const totBanc = analise ? analise.totalBancada : (item.totalBancada || (item.detalhes?.bancada ? item.detalhes.bancada.length : 0));
                        const temAtividades = analise ? analise.temAtividades : (totTun > 0 || totBanc > 0);

                        const cargoTag = getCargoTag(item.cargoExibicao);

                        return (
                          <tr 
                            key={idx} 
                            style={{ borderBottom: `1px solid ${theme.border}22`, transition: "background 0.15s" }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.02)")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                          >
                            <td style={{ padding: "12px 14px", fontSize: "12px", color: theme.subtext }}>{idx + 1}</td>
                            
                            {/* MECÂNICO */}
                            <td style={{ padding: "12px 14px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                <div style={{
                                  width: "32px",
                                  height: "32px",
                                  borderRadius: "8px",
                                  background: "linear-gradient(135deg, rgba(239,68,68,0.2), rgba(249,115,22,0.2))",
                                  border: "1px solid rgba(239,68,68,0.3)",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontWeight: "800",
                                  fontSize: "12px",
                                  color: "#f87171"
                                }}>
                                  {(item.nomeExibicao || "?").substring(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <div style={{ fontWeight: "700", color: theme.text, fontSize: "13px", display: "flex", alignItems: "center", gap: "6px" }}>
                                    <span>{item.nomeExibicao}</span>
                                    {cargoTag && (
                                      <span style={{ fontSize: "10px", padding: "1px 5px", borderRadius: "4px", background: "rgba(255,255,255,0.08)", color: theme.subtext, fontWeight: "700" }}>
                                        {cargoTag}
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ fontSize: "11px", color: "#38bdf8", fontWeight: "600", marginTop: "1px" }}>
                                    Passaporte: #{item.idJogoExibicao}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* ENTRADA */}
                            <td style={{ padding: "12px 14px", fontSize: "12px", color: theme.text }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <span style={{ color: "#22c55e" }}>🟢</span>
                                <span style={{ fontWeight: "600" }}>{dataEntradaStr}</span>
                              </div>
                            </td>

                            {/* SAÍDA ATUAL */}
                            <td style={{ padding: "12px 14px", fontSize: "12px" }}>
                              {dataSaidaStr ? (
                                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                  <span style={{ color: "#facc15" }}>🟡</span>
                                  <span style={{ color: theme.text, fontWeight: "600" }}>{dataSaidaStr}</span>
                                  <span style={{ fontSize: "10px", color: theme.subtext }}>(0 min)</span>
                                </div>
                              ) : (
                                <span style={{
                                  padding: "3px 8px",
                                  borderRadius: "6px",
                                  background: "rgba(239, 68, 68, 0.15)",
                                  color: "#ef4444",
                                  border: "1px solid rgba(239, 68, 68, 0.3)",
                                  fontSize: "11px",
                                  fontWeight: "700",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px"
                                }}>
                                  ⚠️ Não registrada
                                </span>
                              )}
                            </td>

                            {/* ATIVIDADES NO PONTO (APENAS TUNAGEM E BANCADA) */}
                            <td style={{ padding: "12px 14px" }}>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", alignItems: "center" }}>
                                {totTun > 0 && (
                                  <span style={{ background: "rgba(34, 197, 94, 0.15)", color: "#4ade80", border: "1px solid rgba(34, 197, 94, 0.3)", padding: "2px 6px", borderRadius: "4px", fontSize: "11px", fontWeight: "700" }}>
                                    🚗 {totTun}x
                                  </span>
                                )}
                                {totBanc > 0 && (
                                  <span style={{ background: "rgba(192, 132, 252, 0.15)", color: "#c084fc", border: "1px solid rgba(192, 132, 252, 0.3)", padding: "2px 6px", borderRadius: "4px", fontSize: "11px", fontWeight: "700" }}>
                                    🛠️ {totBanc}x
                                  </span>
                                )}
                                {!temAtividades && (
                                  <span style={{ color: theme.subtext, fontSize: "11px" }}>— Nenhuma</span>
                                )}
                              </div>
                            </td>

                            {/* ÚLTIMA ATIVIDADE / SAÍDA SUGERIDA */}
                            <td style={{ padding: "12px 14px", fontSize: "12px" }}>
                              {analise ? (
                                analise.temAtividades ? (
                                  <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                      <span style={{ background: "rgba(34, 197, 94, 0.15)", color: "#4ade80", border: "1px solid rgba(34, 197, 94, 0.3)", padding: "1px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: "800" }}>
                                        🕒 {new Date(analise.saidaSugerida).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                                      </span>
                                      <span style={{ background: "rgba(56, 189, 248, 0.15)", color: "#38bdf8", border: "1px solid rgba(56, 189, 248, 0.3)", padding: "1px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: "800" }}>
                                        +{fmtMin(analise.duracaoSugeridaMin)}
                                      </span>
                                    </div>
                                    <div style={{ fontSize: "11px", color: theme.text, fontWeight: "600", maxWidth: "260px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={analise.ultimaAtividade?.desc || analise.motivoSugerido}>
                                      {analise.ultimaAtividade?.desc || analise.motivoSugerido}
                                    </div>
                                  </div>
                                ) : (
                                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                    <span style={{ background: "rgba(255, 255, 255, 0.05)", color: theme.subtext, border: `1px solid ${theme.border}44`, padding: "2px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: "700" }}>
                                      ⚪ 0 min (Miss-click / Sem ativ.)
                                    </span>
                                  </div>
                                )
                              ) : (
                                <span style={{ color: theme.subtext, fontSize: "11px", fontStyle: "italic", opacity: 0.7 }}>
                                  Clique em "Analisar Pontos" acima
                                </span>
                              )}
                            </td>

                            {/* AÇÕES */}
                            <td style={{ padding: "12px 14px", textAlign: "right" }}>
                              <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px", alignItems: "center" }}>
                                {analise && (
                                  <button
                                    onClick={() => fecharPontoIndividual(item)}
                                    style={{
                                      background: analise.temAtividades ? "rgba(34, 197, 94, 0.15)" : "rgba(255, 255, 255, 0.05)",
                                      border: `1px solid ${analise.temAtividades ? "#22c55e" : theme.border}`,
                                      color: analise.temAtividades ? "#4ade80" : theme.subtext,
                                      padding: "5px 10px",
                                      borderRadius: "6px",
                                      fontSize: "11px",
                                      fontWeight: "800",
                                      cursor: "pointer",
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "4px",
                                      transition: "all 0.15s"
                                    }}
                                    title="Fechar este ponto com a saída sugerida calculada"
                                  >
                                    💾 Fechar
                                  </button>
                                )}
                                <button
                                  onClick={() => abrirAuditoriaSessao(item)}
                                  style={{
                                    background: temAtividades ? "rgba(56, 189, 248, 0.15)" : "rgba(255, 255, 255, 0.05)",
                                    border: `1px solid ${temAtividades ? "#38bdf8" : theme.border}`,
                                    color: temAtividades ? "#38bdf8" : theme.text,
                                    padding: "5px 10px",
                                    borderRadius: "6px",
                                    fontSize: "11px",
                                    fontWeight: "700",
                                    cursor: "pointer",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "4px"
                                  }}
                                  title="Ver atividades realizadas durante este ponto"
                                >
                                  🔍 Atividades
                                </button>
                                <button
                                  onClick={() => abrirHistoricoFunc(item)}
                                  style={{
                                    background: "rgba(255, 255, 255, 0.05)",
                                    border: `1px solid ${theme.border}`,
                                    color: theme.text,
                                    padding: "5px 10px",
                                    borderRadius: "6px",
                                    fontSize: "11px",
                                    fontWeight: "700",
                                    cursor: "pointer",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "4px"
                                  }}
                                  title="Ver histórico de todos os pontos deste funcionário"
                                >
                                  👤 Histórico
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        </div>
      )}
      {/* FLOATING TIMELINE TOOLTIP */}
      {timelineTooltip.visible && (
        <div style={{
          position: "fixed",
          left: `${timelineTooltip.x}px`,
          top: `${timelineTooltip.y}px`,
          transform: "translate(-50%, -105%)",
          background: "rgba(15, 23, 42, 0.95)",
          backdropFilter: "blur(4px)",
          color: "#f8fafc",
          padding: "10px 14px",
          borderRadius: "8px",
          fontSize: "12px",
          fontWeight: "600",
          border: "1px solid rgba(255, 255, 255, 0.15)",
          boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -4px rgba(0, 0, 0, 0.5)",
          zIndex: 9999,
          pointerEvents: "none",
          whiteSpace: "pre-line",
          lineHeight: "1.5",
          width: "max-content",
          maxWidth: "300px",
          textAlign: "left"
        }}>
          {timelineTooltip.content}
        </div>
      )}

      {/* MODAL DE RELATÓRIO COMPARATIVO EXTERNO */}
      {modalRelatorioMecanicasAberta && (
        <div style={{
          position: "fixed",
          top: 0, left: 0, right: 0, bottom: 0,
          background: "#0f172a", // Slate escuro premium
          zIndex: 99999,
          overflowY: "auto",
          padding: "40px 20px",
          color: "#f8fafc",
          fontFamily: "'Outfit', 'Inter', sans-serif"
        }}>
          <div style={{ maxWidth: "1200px", margin: "0 auto", position: "relative" }}>
            
            {/* Controles de Ações (Escondidos na Impressão) */}
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
                  Visualização do Relatório Comparativo Externo
                </h2>
                <p style={{ fontSize: "12px", color: "#94a3b8", margin: "4px 0 0 0" }}>
                  Apenas as tabelas, podiums e a linha do tempo interativa de cobertura das oficinas (sem cabeçalhos do site e menu principal).
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
                  onClick={() => setModalRelatorioMecanicasAberta(false)}
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

            {/* Cabeçalho do Relatório */}
            <div style={{ marginBottom: "30px" }}>
              <div style={{ fontSize: "22px", fontWeight: "800", color: "#f8fafc" }}>
                Relatório Comparativo de Atividades entre Mecânicas
              </div>
              <div style={{ fontSize: "13px", color: "#94a3b8", marginTop: "4px" }}>
                Período: {periodoInicio ? fmtBR(periodoInicio) : ""} – {periodoFim ? fmtBR(periodoFim) : ""}
              </div>
            </div>

            {/* PODIUM/RANKING GERAL */}
            <div style={{ textAlign: "center", marginBottom: "32px" }}>
              <h3 style={{ color: "#f8fafc", fontSize: "18px", fontWeight: "800", marginBottom: "8px" }}>
                🏆 Ranking de Funcionamento Geral (Tempo Aberto)
              </h3>
              <p style={{ color: "#94a3b8", fontSize: "12px", marginBottom: "24px" }}>
                Baseado no percentual de tempo de cobertura em que a oficina teve pelo menos 1 funcionário trabalhando no período completo.
              </p>

              <div className="podium-container" style={{ 
                display: "flex",
                flexWrap: "wrap",
                gap: "24px",
                justifyContent: "center",
                alignItems: "flex-end",
                maxWidth: "850px",
                margin: "0 auto 32px auto"
              }}>
                {/* 2º LUGAR */}
                {rankingMecanicas[1] && (
                  <div style={{
                    background: "rgba(255,255,255,0.02)",
                    borderRadius: "16px",
                    border: "1px solid rgba(192, 192, 192, 0.2)",
                    padding: "24px 16px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    order: 2,
                    minHeight: "220px",
                    justifyContent: "center",
                    position: "relative",
                    flex: "1 1 220px",
                    maxWidth: "240px"
                  }}>
                    <div style={{ position: "absolute", top: "-15px", fontSize: "32px" }}>🥈</div>
                    <span style={{ fontSize: "11px", fontWeight: "800", color: "rgba(192, 192, 192, 0.8)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px" }}>2º Lugar</span>
                    <h4 style={{ color: rankingMecanicas[1].cor, fontSize: "18px", fontWeight: "800", marginBottom: "12px" }}>{rankingMecanicas[1].nome}</h4>
                    <div style={{ fontSize: "28px", fontWeight: "900", color: "#f8fafc" }}>{rankingMecanicas[1].taxaCobertura.toFixed(1)}%</div>
                    <span style={{ fontSize: "11px", color: "#94a3b8", marginTop: "4px" }}>Cobertura total</span>
                    <span style={{ fontSize: "12px", color: "#f8fafc", fontWeight: "600", marginTop: "12px" }}>Funcionamento: {fmtMin(rankingMecanicas[1].minutosCobertos)}</span>
                  </div>
                )}

                {/* 1º LUGAR */}
                {rankingMecanicas[0] && (
                  <div style={{
                    background: "rgba(255,255,255,0.03)",
                    borderRadius: "20px",
                    border: "1.5px solid rgba(250, 204, 21, 0.4)",
                    padding: "32px 20px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    order: 1,
                    minHeight: "260px",
                    justifyContent: "center",
                    position: "relative",
                    transform: "scale(1.03)",
                    flex: "1 1 250px",
                    maxWidth: "280px"
                  }}>
                    <div style={{ position: "absolute", top: "-20px", fontSize: "40px" }}>🥇</div>
                    <span style={{ fontSize: "12px", fontWeight: "900", color: "#facc15", textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: "8px" }}>🏆 Campeã</span>
                    <h4 style={{ color: rankingMecanicas[0].cor, fontSize: "22px", fontWeight: "900", marginBottom: "12px" }}>{rankingMecanicas[0].nome}</h4>
                    <div style={{ fontSize: "36px", fontWeight: "900", color: "#facc15" }}>{rankingMecanicas[0].taxaCobertura.toFixed(1)}%</div>
                    <span style={{ fontSize: "11px", color: "rgba(250,204,21,0.8)", marginTop: "4px" }}>Cobertura total</span>
                    <span style={{ fontSize: "13px", color: "#f8fafc", fontWeight: "700", marginTop: "16px" }}>Funcionamento: {fmtMin(rankingMecanicas[0].minutosCobertos)}</span>
                  </div>
                )}

                {/* 3º LUGAR */}
                {rankingMecanicas[2] && (
                  <div style={{
                    background: "rgba(255,255,255,0.01)",
                    borderRadius: "16px",
                    border: "1px solid rgba(205, 127, 50, 0.2)",
                    padding: "20px 16px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    order: 3,
                    minHeight: "190px",
                    justifyContent: "center",
                    position: "relative",
                    flex: "1 1 220px",
                    maxWidth: "240px"
                  }}>
                    <div style={{ position: "absolute", top: "-15px", fontSize: "28px" }}>🥉</div>
                    <span style={{ fontSize: "11px", fontWeight: "800", color: "rgba(205, 127, 50, 0.8)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px" }}>3º Lugar</span>
                    <h4 style={{ color: rankingMecanicas[2].cor, fontSize: "16px", fontWeight: "800", marginBottom: "12px" }}>{rankingMecanicas[2].nome}</h4>
                    <div style={{ fontSize: "24px", fontWeight: "900", color: "#f8fafc" }}>{rankingMecanicas[2].taxaCobertura.toFixed(1)}%</div>
                    <span style={{ fontSize: "11px", color: "#94a3b8", marginTop: "4px" }}>Cobertura total</span>
                    <span style={{ fontSize: "11px", color: "#f8fafc", fontWeight: "600", marginTop: "8px" }}>Funcionamento: {fmtMin(rankingMecanicas[2].minutosCobertos)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* TABELA COMPARATIVA */}
            <div style={{ background: "rgba(30, 41, 59, 0.7)", borderRadius: "16px", padding: "20px", border: "1px solid rgba(255,255,255,0.05)", overflowX: "auto", marginBottom: "32px" }}>
              <h4 style={{ color: "#f8fafc", fontSize: "14px", fontWeight: "700", marginBottom: "16px" }}>📋 Tabela Comparativa de Desempenho</h4>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "900px" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)", textAlign: "left" }}>
                    <th style={{ padding: "10px", color: "#94a3b8", fontSize: "11px", fontWeight: "700", textTransform: "uppercase" }}>Mecânica</th>
                    <th style={{ padding: "10px", color: "#94a3b8", fontSize: "11px", fontWeight: "700", textTransform: "uppercase" }}>Cob. Geral</th>
                    <th style={{ padding: "10px", color: "#94a3b8", fontSize: "11px", fontWeight: "700", textTransform: "uppercase" }}>Tempo Aberto (Geral)</th>
                    <th style={{ padding: "10px", color: "#94a3b8", fontSize: "11px", fontWeight: "700", textTransform: "uppercase" }}>Cob. Obrigatória (Pico)</th>
                    <th style={{ padding: "10px", color: "#94a3b8", fontSize: "11px", fontWeight: "700", textTransform: "uppercase" }}>Falta Obrigatório</th>
                    <th style={{ padding: "10px", color: "#94a3b8", fontSize: "11px", fontWeight: "700", textTransform: "uppercase" }}>Total Horas Staff</th>
                    <th style={{ padding: "10px", color: "#94a3b8", fontSize: "11px", fontWeight: "700", textTransform: "uppercase" }}>Sessões</th>
                    <th style={{ padding: "10px", color: "#94a3b8", fontSize: "11px", fontWeight: "700", textTransform: "uppercase" }}>Funcionários</th>
                  </tr>
                </thead>
                <tbody>
                  {rankingMecanicas.map((m) => (
                    <tr key={m.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)", height: "48px" }}>
                      <td style={{ padding: "10px", fontWeight: "800", color: m.cor }}>{m.nome}</td>
                      <td style={{ padding: "10px", fontWeight: "700", color: "#f8fafc" }}>{m.taxaCobertura.toFixed(1)}%</td>
                      <td style={{ padding: "10px", color: "#f8fafc" }}>{fmtMin(m.minutosCobertos)}</td>
                      <td style={{ padding: "10px", fontWeight: "700", color: "#f8fafc" }}>{m.taxaCoberturaObrigatoria.toFixed(1)}%</td>
                      <td style={{ padding: "10px", color: "#f87171", fontWeight: "700" }}>{fmtMin(m.minutosObrigatoriosNaoCumpridos)}</td>
                      <td style={{ padding: "10px", color: "#f8fafc" }}>{fmtMin(m.totalMin)}</td>
                      <td style={{ padding: "10px", color: "#f8fafc" }}>{m.sessoes}</td>
                      <td style={{ padding: "10px", color: "#f8fafc" }}>{m.funcionariosAtivos}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* LINHA DO TEMPO COMPARATIVA */}
            <div style={{ background: "rgba(30, 41, 59, 0.7)", borderRadius: "16px", padding: "20px", border: "1px solid rgba(255,255,255,0.05)", overflowX: "auto" }}>
              <h4 style={{ color: "#f8fafc", fontSize: "14px", fontWeight: "700", marginBottom: "16px" }}>📅 Comparativo Linear de Cobertura (Linha do Tempo)</h4>
              <div style={{ minWidth: "920px" }}>
                
                {/* Headers */}
                <div style={{ display: "flex", alignItems: "center", marginBottom: "6px" }}>
                  <div style={{ width: "160px", flexShrink: 0 }} />
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(48, 1fr)", flex: 1, gap: "3px" }}>
                    <div style={{ gridColumn: "span 12", background: "rgba(168,85,247,0.03)", border: "1px solid rgba(255,255,255,0.05)", borderBottom: "none", padding: "4px 2px", textAlign: "center", fontSize: "10px", fontWeight: "800", color: "#c084fc", borderTopLeftRadius: "4px", borderTopRightRadius: "4px" }}>
                      🌑 Madrugada
                    </div>
                    <div style={{ gridColumn: "span 12", background: "rgba(251,191,36,0.03)", border: "1px solid rgba(255,255,255,0.05)", borderBottom: "none", padding: "4px 2px", textAlign: "center", fontSize: "10px", fontWeight: "800", color: "#fcd34d", borderTopLeftRadius: "4px", borderTopRightRadius: "4px" }}>
                      🌅 Manhã
                    </div>
                    <div style={{ gridColumn: "span 12", background: "rgba(249,115,22,0.03)", border: "1px solid rgba(255,255,255,0.05)", borderBottom: "none", padding: "4px 2px", textAlign: "center", fontSize: "10px", fontWeight: "800", color: "#fdba74", borderTopLeftRadius: "4px", borderTopRightRadius: "4px" }}>
                      ☀️ Tarde
                    </div>
                    <div style={{ gridColumn: "span 12", background: "rgba(59,130,246,0.03)", border: "1px solid rgba(255,255,255,0.05)", borderBottom: "none", padding: "4px 2px", textAlign: "center", fontSize: "10px", fontWeight: "800", color: "#60a5fa", borderTopLeftRadius: "4px", borderTopRightRadius: "4px" }}>
                      🌙 Noite
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", marginBottom: "12px" }}>
                  <div style={{ width: "160px", fontWeight: "800", fontSize: "11px", color: "#94a3b8" }}>MECÂNICA / DIA</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(48, 1fr)", flex: 1, gap: "3px" }}>
                    {Array.from({ length: 24 }).map((_, h) => (
                      <div key={h} style={{ gridColumn: "span 2", textAlign: "left", fontSize: "10px", color: "#38bdf8", borderLeft: "1px solid rgba(255,255,255,0.1)", paddingLeft: "2px" }}>
                        {String(h).padStart(2, "0")}h
                      </div>
                    ))}
                  </div>
                </div>

                {/* Rows */}
                {diasPeriodo.map(dia => {
                  const dataObj = new Date(`${dia}T12:00:00`);
                  const diaSemana = dataObj.toLocaleDateString("pt-BR", { weekday: "short" });
                  const [, mes, diaNum] = dia.split("-");
                  const labelDia = `${diaSemana.toUpperCase().replace(".", "")} (${diaNum}/{mes})`;

                  const slotsM1 = coberturaComparativa[dia]?.m1 || [];
                  const slotsM2 = coberturaComparativa[dia]?.m2 || [];
                  const slotsM3 = coberturaComparativa[dia]?.m3 || [];

                  const renderRowModal = (slots, colorActive, labelMecanica) => {
                    return (
                      <div style={{ display: "flex", alignItems: "center", marginBottom: "4px" }}>
                        <div style={{ width: "160px", display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ 
                            width: "8px", 
                            height: "8px", 
                            borderRadius: "50%", 
                            background: colorActive 
                          }} />
                          <span style={{ fontSize: "10px", color: "#f8fafc", fontWeight: "700" }}>{labelMecanica}</span>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(48, 1fr)", flex: 1, gap: "3px" }}>
                          {slots.map((slot, idx) => {
                            const infoObr = getHorarioObrigatorioParaData(dia);
                            const ehObrigatorio = idx >= infoObr.slotInicioIdx && idx <= infoObr.slotFimIdx;
                            const tooltipText = `${ehObrigatorio ? `⭐ [Horário Obrigatório ${infoObr.labelCurto}] ` : ""}${slot.label} (${labelMecanica})\n${slot.coberto ? `🟢 Coberto por:\n${slot.funcionarios.map(f => `• ${f.nome}`).join("\n")}` : `🔴 Sem cobertura${ehObrigatorio ? " (FALHA NO HORÁRIO OBRIGATÓRIO)" : ""}`}`;
                            
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

                            return (
                              <div
                                key={idx}
                                title={tooltipText}
                                style={{
                                  height: "16px",
                                  borderRadius: "4px",
                                  background: slot.coberto ? colorActive : emptyColor,
                                  border: ehObrigatorio
                                    ? `2px solid ${slot.coberto ? "#facc15" : "#f87171"}`
                                    : `1px solid ${slot.coberto ? colorActive : emptyBorder}`,
                                  boxShadow: ehObrigatorio && !slot.coberto ? "0 0 6px rgba(248,113,113,0.8)" : "none",
                                  cursor: "pointer",
                                  position: "relative",
                                  transition: "transform 0.1s ease, box-shadow 0.1s ease"
                                }}
                                onMouseEnter={e => {
                                  e.currentTarget.style.transform = "scale(1.3)";
                                  e.currentTarget.style.zIndex = 10;
                                }}
                                onMouseLeave={e => {
                                  e.currentTarget.style.transform = "scale(1)";
                                  e.currentTarget.style.zIndex = 1;
                                }}
                              />
                            );
                          })}
                        </div>
                      </div>
                    );
                  };

                  return (
                    <div key={dia} style={{ marginBottom: "16px", padding: "12px", background: "rgba(255,255,255,0.01)", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.05)" }}>
                      <div style={{ fontSize: "12px", fontWeight: "800", color: "#f8fafc", marginBottom: "8px", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: "4px" }}>
                        {labelDia}
                      </div>
                      {renderRowModal(slotsM1, "#ef4444", "RED's")}
                      {renderRowModal(slotsM2, "#eab308", "Harmony")}
                      {renderRowModal(slotsM3, "#38bdf8", "Dudark")}
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

          <style dangerouslySetInnerHTML={{__html: `
            @media print {
              @page {
                size: A4 portrait;
                margin: 8mm 6mm;
              }
              .no-print {
                display: none !important;
              }
              body {
                background: #0f172a !important; /* Mantém a identidade premium escura no PDF */
                color: #f8fafc !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              html, body {
                height: auto;
                font-size: 11px; /* Reduz ligeiramente a fonte geral para caber em uma página */
              }
              /* Reduzir espaçamentos na impressão */
              div {
                page-break-inside: avoid;
              }
              /* Ajustar Ranking / Podium para ocupar menos espaço */
              .podium-container {
                transform: scale(0.85);
                margin: 0 auto -20px auto !important;
              }
            }
          `}} />
        </div>
      )}
    </div>
  );
}
