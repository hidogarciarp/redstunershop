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
        pareadoCom: null,
      });
    }
  });

  if (sessoesExistentes && sessoesExistentes.length > 0) {
    sessoesExistentes.forEach((s) => {
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
          atividades: [],
        };
        entradas.push(ent);
      }

      let sai = saidas.find((x) => !x.pareadoCom && (x.uuid === s.uuid_saida || x.hora === s.horaSaidaFormatada));
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
        };
        saidas.push(sai);
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
    if (ent.saidaId) return;

    const proximaEntrada = entradas[idx + 1];
    const saidaCandidata = saidas.find((s) => {
      if (s.pareadoCom) return false;
      const horaSai = s.hora;
      const horaEnt = ent.hora;
      const horaProx = proximaEntrada ? proximaEntrada.hora : "23:59:59";
      return horaSai >= horaEnt && horaSai <= horaProx;
    });

    if (saidaCandidata) {
      ent.saidaId = saidaCandidata.id;
      saidaCandidata.pareadoCom = ent.id;
    } else {
      const horaIni = ent.hora;
      const horaFim = proximaEntrada ? proximaEntrada.hora : "23:59:59";
      const atvsNoIntervalo = (atividades || []).filter((atv) => atv.hora >= horaIni && atv.hora <= horaFim);
      if (atvsNoIntervalo.length > 0) {
        atvsNoIntervalo[atvsNoIntervalo.length - 1].isUltima = true;
      }
      ent.atividades = atvsNoIntervalo;
    }
  });

  entradas.sort((a, b) => a.hora.localeCompare(b.hora));
  saidas.sort((a, b) => a.hora.localeCompare(b.hora));

  const totalMinutos = entradas.reduce((acc, ent) => {
    if (!ent.saidaId) return acc;
    const sai = saidas.find((s) => s.id === ent.saidaId);
    if (!sai) return acc;
    return acc + calcularDuracao(ent.hora, sai.hora);
  }, 0);

  const sessoesCasadas = entradas.filter((e) => e.saidaId).length;
  const sessoesAuditadas = entradas.filter((e) => e.saidaId && e.auditado).length;
  const sessoesPendentes = entradas.length - sessoesCasadas;

  return {
    data: dataDia,
    entradas,
    saidas,
    atividades: atividades || [],
    sessoesExistentes: sessoesExistentes || [],
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

    // 1. Busca lista de usuários para o seletor
    const { data: usuarios } = await v2
      .from("usuarios")
      .select("id, nome, role")
      .order("nome", { ascending: true });

    // 2. Busca mensagens de ponto do Discord (canal da RED'S: 1388991065226346718)
    let queryDiscord = prod
      .from("discord_log_messages")
      .select("id, content, created_at")
      .eq("log_type", "ponto")
      .ilike("content", `%[ID]: ${usuarioId} %`)
      .order("id", { ascending: true });

    if (isSemana) {
      const dataInicioUtc = new Date(`${dataInicio}T00:00:00-03:00`).toISOString();
      const dataFimUtc = new Date(`${dataFim}T23:59:59-03:00`).toISOString();
      queryDiscord = queryDiscord.gte("created_at", dataInicioUtc).lte("created_at", dataFimUtc);
    } else {
      const [ano, mes, dia] = dataFiltro.split("-");
      const dataBr = `${dia}/${mes}/${ano}`;
      queryDiscord = queryDiscord.ilike("content", `%${dataBr}%`);
    }

    const { data: rawPontoMsgs } = await queryDiscord;

    const todosEventosPonto = [];
    (rawPontoMsgs || []).forEach((m) => {
      const parsed = parseMsgPonto(m.content, m.created_at, String(m.id));
      if (parsed && String(parsed.usuario_id) === String(usuarioId)) {
        if (isSemana) {
          if (parsed.data >= dataInicio && parsed.data <= dataFim) {
            todosEventosPonto.push(parsed);
          }
        } else {
          if (parsed.data === dataFiltro) {
            todosEventosPonto.push(parsed);
          }
        }
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
      .select("uuid, item, quantidade, valor, hora, data, timestampz")
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
      sessoesQuery = sessoesQuery.eq("data", dataFiltro);
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
        desc: `🛠️ Bancada: ${b.quantidade || 1}x ${b.item || "Item"} — R$ ${Number(b.valor || 0).toLocaleString("pt-BR")}`,
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
      if (diffMin < 0) diffMin += 1440;

      return {
        mecanica_id: "reds",
        usuario_id: parseInt(usuario_id, 10),
        nome: nome || "Mecânico",
        data: dataSessao,
        entrada: `${dataSessao}T${s.horaEntrada}-03:00`,
        saida: `${dataSessao}T${s.horaSaida}-03:00`,
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
