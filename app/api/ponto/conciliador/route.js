import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const prodUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://prperurjtvayjrazdxvh.supabase.co";
const prodKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const v2Url = process.env.NEXT_PUBLIC_NEW_SUPABASE_URL || "https://sxrfkbjbyjdmyyxbzobb.supabase.co";
const v2Key = process.env.NEXT_PUBLIC_NEW_SUPABASE_KEY || "sb_publishable_et87L-NCrieyXmvteW84-w_v9cxAbjG";

function getClients() {
  const prod = createClient(prodUrl, prodKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const v2 = createClient(v2Url, v2Key, { auth: { persistSession: false, autoRefreshToken: false } });
  return { prod, v2 };
}

// Extrai horário e dados de uma mensagem de ponto do Discord
function parseMsgPonto(content, createdAt, discordId) {
  if (!content) return null;
  const isEntrou = content.includes("ENTROU EM SERVIÇO");
  const isSaiu = content.includes("SAIU DE SERVIÇO");
  if (!isEntrou && !isSaiu) return null;

  const matchIdNome = content.match(/\[ID\]:\s*(\d+)\s+([^(]+)/i);
  const matchDataHora = content.match(/\[DATA\]:\s*(\d{2}\/\d{2}\/\d{4})(?:,\s*|\s+)(\d{2}:\d{2}:\d{2})/i);
  const matchUuid = content.match(/\[UUID\]:\s*([a-f0-9-]{36})/i);

  let hora = "00:00:00";
  let dataCivil = "";
  let iso = createdAt || new Date().toISOString();

  if (matchDataHora) {
    const [_, dStr, hStr] = matchDataHora;
    hora = hStr;
    const [dd, mm, aaaa] = dStr.split("/");
    dataCivil = `${aaaa}-${mm}-${dd}`;
    iso = `${aaaa}-${mm}-${dd}T${hStr}-03:00`;
  } else if (createdAt) {
    const d = new Date(createdAt);
    const sp = new Date(d.getTime() - 3 * 3600 * 1000);
    hora = sp.toISOString().slice(11, 19);
    dataCivil = sp.toISOString().slice(0, 10);
  }

  return {
    id: discordId || matchUuid?.[1] || `pt-${Date.now()}`,
    usuario_id: matchIdNome ? matchIdNome[1].trim() : "",
    nome: matchIdNome ? matchIdNome[2].trim() : "",
    tipo: isEntrou ? "entrada" : "saida",
    hora,
    data: dataCivil,
    timestampz: iso,
    uuid: matchUuid ? matchUuid[1].trim() : null,
    origem: `Discord (${isEntrou ? "Entrada" : "Saída"})`,
    raw: content,
  };
}

function calcularDuracao(hIni, hFim) {
  if (!hIni || !hFim) return 0;
  const [h1, m1, s1] = hIni.split(":").map(Number);
  const [h2, m2, s2] = hFim.split(":").map(Number);
  let diff = (h2 * 3600 + m2 * 60 + (s2 || 0)) - (h1 * 3600 + m1 * 60 + (s1 || 0));
  if (diff < 0) diff += 24 * 3600;
  return Math.round(diff / 60);
}

function getSegundaEDomingo(dataRefStr) {
  const [ano, mes, dia] = (dataRefStr || new Date().toISOString().split("T")[0]).split("-").map(Number);
  const data = new Date(ano, mes - 1, dia, 12, 0, 0);
  const diaSemana = data.getDay(); // 0 = Dom, 1 = Seg... 6 = Sáb
  const diasDesdeSegunda = diaSemana === 0 ? 6 : diaSemana - 1;

  const segunda = new Date(data);
  segunda.setDate(data.getDate() - diasDesdeSegunda);

  const domingo = new Date(segunda);
  domingo.setDate(segunda.getDate() + 6);

  const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const nomes = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
  const nomesCurtos = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

  return {
    segunda: fmt(segunda),
    domingo: fmt(domingo),
    dias: Array.from({ length: 7 }, (_, i) => {
      const d = new Date(segunda);
      d.setDate(segunda.getDate() + i);
      const iso = fmt(d);
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      return {
        data: iso,
        diaSemanaNome: `${nomes[i]} (${dd}/${mm})`,
        diaSemanaCurto: `${nomesCurtos[i]} (${dd}/${mm})`,
        nomeApenas: nomes[i],
        curtoApenas: nomesCurtos[i],
        diaMes: `${dd}/${mm}`,
      };
    }),
  };
}

function conciliarDia({ eventosPonto, atividades, sessoesExistentes, dataDia }) {
  const entradas = [];
  const saidas = [];

  eventosPonto.forEach((ev) => {
    if (ev.tipo === "entrada") {
      entradas.push({
        id: `ent-${ev.id}`,
        data: ev.data || dataDia,
        hora: ev.hora,
        origem: ev.origem,
        uuid: ev.uuid,
        saidaId: null,
        auditado: false,
        tipoFechamento: null,
        atividades: [],
      });
    } else {
      saidas.push({
        id: `sai-${ev.id}`,
        data: ev.data || dataDia,
        hora: ev.hora,
        origem: ev.origem,
        uuid: ev.uuid,
        raw: ev.raw,
        timestampz: ev.timestampz,
        pareadoCom: null,
      });
    }
  });

  const sessoesValidas = (sessoesExistentes || []).filter((s) => {
    if (s.uuid_entrada && s.uuid_entrada.startsWith("AUTO_ENTRADA_")) {
      const duplicada = sessoesExistentes.some((outra) => outra.id !== s.id && outra.uuid_saida === s.uuid_saida);
      if (duplicada) return false;
    }
    return true;
  });

  if (sessoesValidas && sessoesValidas.length > 0) {
    sessoesValidas.forEach((s) => {
      let ent = entradas.find((e) => e.uuid === s.uuid_entrada || e.hora === s.horaEntradaFormatada);
      if (!ent) {
        ent = {
          id: `ent-rec-${s.id}`,
          data: s.data || dataDia,
          hora: s.horaEntradaFormatada,
          origem: "Sessão Gravada em Banco",
          uuid: s.uuid_entrada,
          saidaId: null,
          auditado: true,
          tipoFechamento: s.tipo_fechamento,
          observacao: s.observacao,
          timestampz: s.entrada,
          atividades: [],
        };
        entradas.push(ent);
      } else {
        ent.observacao = s.observacao;
      }

      // Busca a saída primeiro por UUID exato para priorizar o log original do Discord
      let sai = saidas.find((x) => !x.pareadoCom && x.uuid && x.uuid === s.uuid_saida);
      if (!sai) {
        sai = saidas.find((x) => !x.pareadoCom && x.hora === s.horaSaidaFormatada);
      }

      if (!sai) {
        sai = {
          id: `sai-rec-${s.id}`,
          data: s.data || dataDia,
          hora: s.horaSaidaFormatada,
          origem: (s.tipo_fechamento || "").includes("CRASH") ? "Âncora de Atividade / Crash" : "Validado por Responsável",
          uuid: s.uuid_saida,
          pareadoCom: ent.id,
          geradoPorLog: true,
          auditado: true,
          tipoFechamento: s.tipo_fechamento,
          observacao: s.observacao,
          timestampz: s.saida,
          raw: s.observacao ? `[REGISTRO LOG_PONTO]\nTipo: ${s.tipo_fechamento}\nObservação: ${s.observacao}\nEntrada: ${s.entrada}\nSaída: ${s.saida}\nUUID Saída: ${s.uuid_saida}` : null,
        };
        saidas.push(sai);
      } else {
        sai.observacao = s.observacao;
        sai.tipoFechamento = s.tipo_fechamento;
        sai.auditado = true;
      }

      ent.saidaId = sai.id;
      sai.pareadoCom = ent.id;
      ent.auditado = true;
      ent.tipoFechamento = s.tipo_fechamento;
    });
  }

  entradas.sort((a, b) => a.hora.localeCompare(b.hora));
  saidas.sort((a, b) => a.hora.localeCompare(b.hora));

  entradas.forEach((ent, idx) => {
    const proximaEntrada = entradas[idx + 1];

    if (!ent.saidaId) {
      const saidaCandidata = saidas.find((s) => {
        if (s.pareadoCom) return false;
        const horaSai = s.hora;
        const horaEnt = ent.hora;
        const horaProx = proximaEntrada ? proximaEntrada.hora : "23:59:59";

        // Se a saída veio da madrugada seguinte (virada de noite), permite casar se for a última entrada do dia
        if ((s.dataOriginal && s.dataOriginal !== ent.data) || (s.data && s.data !== ent.data)) {
          return !proximaEntrada;
        }

        return horaSai >= horaEnt && horaSai <= horaProx;
      });

      if (saidaCandidata) {
        ent.saidaId = saidaCandidata.id;
        saidaCandidata.pareadoCom = ent.id;
      }
    }

    const saidaVinculada = saidas.find((s) => s.id === ent.saidaId);
    const horaIni = ent.hora;
    const horaLimiteProxima = proximaEntrada ? proximaEntrada.hora : "23:59:59";

    // Pega todas as atividades deste dia entre a entrada e a próxima entrada (ou saída)
    const atvsNoIntervalo = (atividades || [])
      .filter((atv) => atv.hora >= horaIni && atv.hora <= horaLimiteProxima)
      .map((atv) => {
        let dentroDoPar = true;
        if (saidaVinculada) {
          if (saidaVinculada.hora >= horaIni) {
            dentroDoPar = atv.hora <= saidaVinculada.hora;
          } else {
            // Virada de meia-noite
            dentroDoPar = atv.data === ent.data ? atv.hora >= horaIni : atv.hora <= saidaVinculada.hora;
          }
        }
        return {
          ...atv,
          dentroDoPar,
        };
      });

    if (atvsNoIntervalo.length > 0) {
      atvsNoIntervalo[atvsNoIntervalo.length - 1].isUltima = true;
    }
    ent.atividades = atvsNoIntervalo;
  });

  entradas.sort((a, b) => a.hora.localeCompare(b.hora));
  saidas.sort((a, b) => a.hora.localeCompare(b.hora));

  // Deduplica saidas pelo UUID para garantir que nenhum UUID real apareça mais de uma vez no mesmo dia
  const saidasUnicas = [];
  const uuidsSaidasVistos = new Set();
  saidas.forEach((s) => {
    if (s.uuid && !s.uuid.startsWith("CRASH_") && !s.uuid.startsWith("AUTO_")) {
      if (uuidsSaidasVistos.has(s.uuid)) return;
      uuidsSaidasVistos.add(s.uuid);
    }
    saidasUnicas.push(s);
  });

  const totalMinutos = entradas.reduce((acc, ent) => {
    if (!ent.saidaId) return acc;
    const sai = saidasUnicas.find((s) => s.id === ent.saidaId);
    if (!sai) return acc;
    return acc + calcularDuracao(ent.hora, sai.hora);
  }, 0);

  const sessoesCasadas = entradas.filter((e) => e.saidaId).length;
  const sessoesAuditadas = entradas.filter((e) => e.saidaId && e.auditado).length;
  const sessoesPendentes = entradas.length - sessoesCasadas;

  return {
    data: dataDia,
    entradas,
    saidas: saidasUnicas,
    atividades: atividades || [],
    sessoesExistentes: sessoesValidas,
    totalMinutos,
    totalSessoes: entradas.length,
    sessoesCasadas,
    sessoesAuditadas,
    sessoesPendentes,
  };
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const usuarioId = searchParams.get("usuario_id") || "643";
    const modo = searchParams.get("modo") || "dia"; // "dia" | "semana"
    const dataFiltro = searchParams.get("data") || new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    
    // Calcula a semana de referência (Segunda a Domingo)
    const semanaRef = getSegundaEDomingo(dataFiltro);
    const dataInicio = searchParams.get("data_inicio") || semanaRef.segunda;
    const dataFim = searchParams.get("data_fim") || semanaRef.domingo;
    const isSemana = modo === "semana";

    const { prod, v2 } = getClients();

    // 1. Busca lista de usuários para o seletor (apenas ativos na hierarquia, ordenados do cargo mais baixo para o mais alto)
    const { data: usuariosBrutos } = await v2
      .from("usuarios")
      .select("id, nome, role, status, oculto_hierarquia");

    const CARGOS_ORDEM = [
      { value: "jovem_aprendiz", label: "Jovem Aprendiz", nivel: 1 },
      { value: "estagiario", label: "Estagiário", nivel: 1 },
      { value: "mecanico", label: "Mecânico", nivel: 2 },
      { value: "mecanico_senior", label: "Mecânico Sênior", nivel: 3 },
      { value: "supervisor", label: "Supervisor", nivel: 4 },
      { value: "gerente", label: "Gerente", nivel: 5 },
      { value: "gerente_rh", label: "Gerente RH", nivel: 6 },
      { value: "gerente_geral", label: "Gerente Geral", nivel: 6 },
      { value: "dono", label: "Dono", nivel: 7 },
      { value: "admin", label: "Admin (sistema)", nivel: 8 },
    ];

    const getCargoInfo = (role) => {
      const primary = (role || "").split("|")[0].toLowerCase().trim();
      const idx = CARGOS_ORDEM.findIndex((c) => c.value === primary);
      if (idx !== -1) {
        return { ordem: idx, nivel: CARGOS_ORDEM[idx].nivel, label: CARGOS_ORDEM[idx].label };
      }
      return { ordem: 999, nivel: 99, label: primary || "Mecânico" };
    };

    const usuarios = (usuariosBrutos || [])
      .filter((u) => (!u.status || u.status === "ativo") && !u.oculto_hierarquia)
      .map((u) => {
        const info = getCargoInfo(u.role);
        return {
          id: u.id,
          nome: u.nome,
          role: u.role,
          cargoOrdem: info.ordem,
          cargoNivel: info.nivel,
          cargoLabel: info.label,
        };
      })
      .sort((a, b) => {
        if (a.cargoOrdem !== b.cargoOrdem) {
          return a.cargoOrdem - b.cargoOrdem; // Do mais baixo pro mais alto
        }
        return a.nome.localeCompare(b.nome);
      });

    // 2. Busca mensagens de ponto do Discord (canal da RED'S: 1388991065226346718)
    // Estende a janela: inclui o dia anterior para identificar se saídas da madrugada pertencem a turnos da noite anterior,
    // e vai até 06:00 do dia seguinte para cobrir saídas de turnos que viram a noite.
    const [anoF, mesF, diaF] = dataFiltro.split("-").map(Number);
    const dAnt = new Date(anoF, mesF - 1, diaF - 1);
    const dataAnteriorStr = `${dAnt.getFullYear()}-${String(dAnt.getMonth() + 1).padStart(2, "0")}-${String(dAnt.getDate()).padStart(2, "0")}`;

    const dataFimBase = isSemana ? dataFim : dataFiltro;
    const [fAno, fMes, fDia] = dataFimBase.split("-").map(Number);
    const dFimBuffer = new Date(fAno, fMes - 1, fDia + 1, 6, 0, 0);
    const dataFimBufferStr = `${dFimBuffer.getFullYear()}-${String(dFimBuffer.getMonth() + 1).padStart(2, "0")}-${String(dFimBuffer.getDate()).padStart(2, "0")}`;
    const dataFimUtc = new Date(`${dataFimBufferStr}T06:00:00-03:00`).toISOString();
    const dataInicioBusca = isSemana ? dataInicio : dataAnteriorStr;
    const dataInicioUtc = new Date(`${dataInicioBusca}T00:00:00-03:00`).toISOString();

    let queryDiscord = prod
      .from("discord_log_messages")
      .select("id, content, created_at")
      .eq("log_type", "ponto")
      .ilike("content", `%[ID]: ${usuarioId} %`)
      .gte("created_at", dataInicioUtc)
      .lte("created_at", dataFimUtc)
      .order("id", { ascending: true });

    const { data: rawPontoMsgs } = await queryDiscord;

    const rawEventosPonto = [];
    (rawPontoMsgs || []).forEach((m) => {
      const parsed = parseMsgPonto(m.content, m.created_at, String(m.id));
      if (parsed && String(parsed.usuario_id) === String(usuarioId)) {
        rawEventosPonto.push(parsed);
      }
    });

    // 3. Busca atividades (Tunagens e Bancada) para o mecânico
    let tunagensQuery = v2
      .from("log_tunagem")
      .select("uuid, veiculo_nome, placa, valor_pago, hora, data, timestampz")
      .eq("mecanica_id", "reds")
      .eq("tecnico_id", String(usuarioId))
      .order("hora", { ascending: true });

    let bancadaQuery = v2
      .from("log_bancada")
      .select("uuid, item_craftado, quantidade, hora, data, timestampz")
      .eq("mecanica_id", "reds")
      .eq("usuario_id", String(usuarioId))
      .order("hora", { ascending: true });

    let sessoesQuery = v2
      .from("log_ponto")
      .select("*")
      .eq("mecanica_id", "reds")
      .eq("usuario_id", parseInt(usuarioId, 10))
      .order("entrada", { ascending: true });

    if (isSemana) {
      tunagensQuery = tunagensQuery.gte("data", dataInicio).lte("data", dataFim);
      bancadaQuery = bancadaQuery.gte("data", dataInicio).lte("data", dataFim);
      sessoesQuery = sessoesQuery.gte("data", dataInicio).lte("data", dataFim);
    } else {
      tunagensQuery = tunagensQuery.eq("data", dataFiltro);
      bancadaQuery = bancadaQuery.eq("data", dataFiltro);
      // Busca também as sessões do dia anterior para saber se alguma saída da madrugada pertence à virada de noite
      sessoesQuery = sessoesQuery.gte("data", dataAnteriorStr).lte("data", dataFiltro);
    }

    const [tunagensRes, bancadaRes, sessoesRes] = await Promise.all([
      tunagensQuery,
      bancadaQuery,
      sessoesQuery,
    ]);

    const todasAtividades = [
      ...(tunagensRes.data || []).map((t) => ({
        id: t.uuid,
        tipo: "tunagem",
        data: t.data,
        hora: t.hora ? t.hora.slice(0, 8) : "00:00:00",
        desc: `🚗 Tunagem: ${t.veiculo_nome || "Veículo"} (${t.placa || "S/ Placa"}) — R$ ${Number(t.valor_pago || 0).toLocaleString("pt-BR")}`,
        timestampz: t.timestampz,
      })),
      ...(bancadaRes.data || []).map((b) => ({
        id: b.uuid,
        tipo: "bancada",
        data: b.data,
        hora: b.hora ? b.hora.slice(0, 8) : "00:00:00",
        desc: `🛠️ Bancada: ${b.quantidade || 1}x ${b.item_craftado || "Item"}`,
        timestampz: b.timestampz,
      })),
    ].sort((a, b) => a.hora.localeCompare(b.hora));

    const todasSessoesFormatadas = (sessoesRes.data || []).map((s) => {
      const dEnt = new Date(s.entrada);
      const hEnt = dEnt.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour12: false });
      const dSai = s.saida ? new Date(s.saida) : null;
      const hSai = dSai ? dSai.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour12: false }) : "";
      return {
        ...s,
        horaEntradaFormatada: hEnt,
        horaSaidaFormatada: hSai,
      };
    });

    // 3.5. Reassocia saídas de virada de noite (madrugada) ao dia da entrada correspondente
    const saidasReassociadas = new Set();

    // 1) Se a saída já está registrada em uma sessão do log_ponto, adota a data da sessão
    todasSessoesFormatadas.forEach((s) => {
      if (s.uuid_saida && !s.uuid_saida.startsWith("CRASH_") && !s.uuid_saida.startsWith("AUTO_")) {
        const evSai = rawEventosPonto.find((ev) => ev.tipo === "saida" && ev.uuid === s.uuid_saida);
        if (evSai) {
          evSai.dataOriginal = evSai.dataOriginal || evSai.data;
          evSai.data = s.data; // Associa a saída à data de início do expediente no banco
          evSai.sessaoVinculadaId = s.id;
          saidasReassociadas.add(evSai.id);
        }
      }
    });

    // 2) Para saídas do Discord de madrugada (00:00 às 06:00) ainda não homologadas:
    rawEventosPonto.forEach((evSai) => {
      if (evSai.tipo === "saida" && !saidasReassociadas.has(evSai.id) && evSai.hora <= "06:00:00") {
        const [a, m, d] = evSai.data.split("-").map(Number);
        const dAnt = new Date(a, m - 1, d - 1);
        const dataAnterior = `${dAnt.getFullYear()}-${String(dAnt.getMonth() + 1).padStart(2, "0")}-${String(dAnt.getDate()).padStart(2, "0")}`;

        // Houve entrada tarde na noite anterior (>= 20:00) sem saída no mesmo dia?
        const temEntradaNoturna = rawEventosPonto.some(
          (evEnt) => evEnt.tipo === "entrada" && (evEnt.dataOriginal || evEnt.data) === dataAnterior && evEnt.hora >= "20:00:00"
        );
        const temEntradaAntesNoDia = rawEventosPonto.some(
          (evEnt) => evEnt.tipo === "entrada" && (evEnt.dataOriginal || evEnt.data) === evSai.data && evEnt.hora < evSai.hora
        );

        if (temEntradaNoturna && !temEntradaAntesNoDia) {
          evSai.dataOriginal = evSai.dataOriginal || evSai.data;
          evSai.data = dataAnterior;
          saidasReassociadas.add(evSai.id);
        }
      }
    });

    // Filtra eventos para a janela solicitada considerando as saídas reassociadas
    const dataMin = isSemana ? dataInicio : dataFiltro;
    const dataMax = isSemana ? dataFim : dataFiltro;
    const todosEventosPonto = rawEventosPonto.filter((ev) => ev.data >= dataMin && ev.data <= dataMax);

    // 4. Constrói o resultado para os 7 dias da semana
    const diasDaSemanaResultado = semanaRef.dias.map((d) => {
      const evsDia = todosEventosPonto.filter((ev) => ev.data === d.data);
      const atvsDia = todasAtividades.filter((atv) => atv.data === d.data);
      const sessoesDia = todasSessoesFormatadas.filter((s) => s.data === d.data);
      const resultadoDia = conciliarDia({
        eventosPonto: evsDia,
        atividades: atvsDia,
        sessoesExistentes: sessoesDia,
        dataDia: d.data,
      });

      return {
        ...d,
        ...resultadoDia,
      };
    });

    // Se for modo dia único:
    let resultadoPrincipal;
    if (!isSemana) {
      const evsDia = todosEventosPonto.filter((ev) => ev.data === dataFiltro);
      const atvsDia = todasAtividades.filter((atv) => atv.data === dataFiltro);
      const sessoesDia = todasSessoesFormatadas.filter((s) => s.data === dataFiltro);
      resultadoPrincipal = conciliarDia({
        eventosPonto: evsDia,
        atividades: atvsDia,
        sessoesExistentes: sessoesDia,
        dataDia: dataFiltro,
      });
    }

    const totalMinutosSemana = diasDaSemanaResultado.reduce((acc, d) => acc + d.totalMinutos, 0);
    const totalSessoesSemana = diasDaSemanaResultado.reduce((acc, d) => acc + d.totalSessoes, 0);
    const totalAuditadasSemana = diasDaSemanaResultado.reduce((acc, d) => acc + d.sessoesAuditadas, 0);
    const totalPendentesSemana = diasDaSemanaResultado.reduce((acc, d) => acc + d.sessoesPendentes, 0);

    return NextResponse.json({
      ok: true,
      usuarioId,
      modo,
      isSemana,
      dataFiltro,
      dataInicio: semanaRef.segunda,
      dataFim: semanaRef.domingo,
      usuarios: usuarios || [],
      // Para o modo diário:
      entradas: isSemana ? [] : resultadoPrincipal.entradas,
      saidas: isSemana ? [] : resultadoPrincipal.saidas,
      atividades: isSemana ? todasAtividades : resultadoPrincipal.atividades,
      sessoesExistentes: isSemana ? todasSessoesFormatadas : resultadoPrincipal.sessoesExistentes,
      // Para o modo semanal / navegação entre dias da semana:
      diasDaSemana: diasDaSemanaResultado,
      resumoSemanal: {
        totalMinutos: totalMinutosSemana,
        totalSessoes: totalSessoesSemana,
        sessoesAuditadas: totalAuditadasSemana,
        sessoesPendentes: totalPendentesSemana,
        diasTrabalhados: diasDaSemanaResultado.filter((d) => d.totalSessoes > 0).length,
      },
    });
  } catch (err) {
    console.error("Erro na API /api/ponto/conciliador GET:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { usuario_id, data, sessoesValidadas, nome } = body;

    if (!usuario_id || !data || !Array.isArray(sessoesValidadas)) {
      return NextResponse.json({ ok: false, error: "Parâmetros insuficientes" }, { status: 400 });
    }

    const { v2 } = getClients();

    // 1. Identifica todas as datas afetadas pelas sessões
    const datasAfetadas = Array.from(new Set(sessoesValidadas.map((s) => s.data || data).filter(Boolean)));
    if (datasAfetadas.length === 0 && data) datasAfetadas.push(data);

    for (const d of datasAfetadas) {
      await v2
        .from("log_ponto")
        .delete()
        .eq("mecanica_id", "reds")
        .eq("usuario_id", parseInt(usuario_id, 10))
        .eq("data", d);
    }

    // 2. Insere as novas sessões validadas pelo Conciliador
    const registrosParaInserir = sessoesValidadas.map((s) => {
      const dataSessao = s.data || data;
      const [hIni, mIni, sIni] = (s.horaEntrada || "00:00:00").split(":").map(Number);
      const [hFim, mFim, sFim] = (s.horaSaida || "00:00:00").split(":").map(Number);
      let diffMin = Math.round(((hFim * 3600 + mFim * 60 + (sFim || 0)) - (hIni * 3600 + mIni * 60 + (sIni || 0))) / 60);
      let dataSaida = dataSessao;

      if (diffMin < 0) {
        diffMin += 1440;
        // Horário de saída virou a noite (menor que o de entrada)
        const [a, m, d] = dataSessao.split("-").map(Number);
        const dProx = new Date(a, m - 1, d + 1);
        dataSaida = `${dProx.getFullYear()}-${String(dProx.getMonth() + 1).padStart(2, "0")}-${String(dProx.getDate()).padStart(2, "0")}`;
      }

      return {
        mecanica_id: "reds",
        usuario_id: parseInt(usuario_id, 10),
        nome: nome || "Mecânico",
        data: dataSessao,
        entrada: `${dataSessao}T${s.horaEntrada}-03:00`,
        saida: `${dataSaida}T${s.horaSaida}-03:00`,
        uuid_entrada: s.uuidEntrada || `concil-ent-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        uuid_saida: s.uuidSaida || `concil-sai-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        total_minutos: diffMin,
        total_segundos: diffMin * 60,
        tipo_fechamento: s.tipoFechamento || "VALIDADO_CONCILIADOR",
        observacao: "Sessão validada e conciliada via Conciliador Visual de Pontos.",
      };
    });

    if (registrosParaInserir.length > 0) {
      const { error: insErr } = await v2.from("log_ponto").insert(registrosParaInserir);
      if (insErr) {
        throw new Error(`Erro ao inserir sessões em log_ponto: ${insErr.message}`);
      }
    }

    return NextResponse.json({
      ok: true,
      mensagem: `${registrosParaInserir.length} sessões validadas e gravadas com sucesso!`,
      registros: registrosParaInserir,
    });
  } catch (err) {
    console.error("Erro na API /api/ponto/conciliador POST:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
