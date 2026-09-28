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
  const hr = item.hora;
  let baseMs = 0;
  if (d && hr) {
    const t = new Date(`${d}T${hr}-03:00`).getTime();
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

function conciliarDia({ eventosPonto, atividades, sessoesExistentes, dataDia }) {
  const entradas = [];
  const saidas = [];

  const seenEnt = new Set();
  const seenSai = new Set();

  eventosPonto.forEach((ev) => {
    const chave = ev.uuid ? ev.uuid.toLowerCase() : `${ev.data || dataDia}_${ev.hora}`;
    if (ev.tipo === "entrada") {
      if (seenEnt.has(chave)) return;
      seenEnt.add(chave);
      entradas.push({
        id: `ent-${ev.id}`,
        data: ev.data || dataDia,
        dataOriginal: ev.dataOriginal || (ev.timestampz ? new Date(ev.timestampz).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }) : (ev.data || dataDia)),
        hora: ev.hora,
        origem: ev.origem,
        uuid: ev.uuid,
        saidaId: null,
        auditado: false,
        tipoFechamento: null,
        atividades: [],
        timestampz: ev.timestampz,
      });
    } else {
      if (seenSai.has(chave)) return;
      seenSai.add(chave);
      saidas.push({
        id: `sai-${ev.id}`,
        data: ev.data || dataDia,
        dataOriginal: ev.dataOriginal || (ev.timestampz ? new Date(ev.timestampz).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }) : (ev.data || dataDia)),
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
    const isAutoEntrada = s.uuid_entrada && (s.uuid_entrada.startsWith("AUTO_ENTRADA_") || s.uuid_entrada.toLowerCase().startsWith("auto-"));
    if (isAutoEntrada) {
      const duplicada = sessoesExistentes.some((outra) => outra.id !== s.id && outra.uuid_saida === s.uuid_saida && !outra.uuid_entrada?.toLowerCase().startsWith("auto-"));
      if (duplicada) return false;
    }
    return true;
  });

  if (sessoesValidas && sessoesValidas.length > 0) {
    sessoesValidas.forEach((s) => {
      let ent = null;
      if (s.uuid_entrada) {
        ent = entradas.find((e) => !e.saidaId && e.uuid === s.uuid_entrada);
        if (!ent) ent = entradas.find((e) => e.uuid === s.uuid_entrada);
      }
      if (!ent) {
        ent = entradas.find((e) => !e.saidaId && e.data === s.data && e.hora === s.horaEntradaFormatada);
      }
      if (!ent) {
        ent = entradas.find((e) => !e.saidaId && e.hora === s.horaEntradaFormatada);
      }
      if (!ent) {
        ent = entradas.find((e) => e.data === s.data && e.hora === s.horaEntradaFormatada);
      }
      if (!ent) {
        ent = entradas.find((e) => e.hora === s.horaEntradaFormatada);
      }

      // Regra de Negócio: Entradas devem ser exclusivamente logs reais do Discord.
      // Se não houver log correspondente de entrada do Discord, não criamos entrada sintética ("Sessão Gravada em Banco").
      if (!ent) {
        return;
      }

      ent.observacao = s.observacao;

      // Busca a saída primeiro por UUID exato para priorizar o log original do Discord
      let sai = null;
      if (s.uuid_saida) {
        sai = saidas.find((x) => !x.pareadoCom && x.uuid === s.uuid_saida);
        if (!sai) sai = saidas.find((x) => x.uuid === s.uuid_saida);
      }
      if (!sai) {
        sai = saidas.find((x) => !x.pareadoCom && x.data === s.data && x.hora === s.horaSaidaFormatada);
      }
      if (!sai) {
        sai = saidas.find((x) => x.data === s.data && x.hora === s.horaSaidaFormatada);
      }

      if (!sai) {
        sai = {
          id: `sai-rec-${s.id}`,
          data: s.data || dataDia,
          dataOriginal: s.saida ? new Date(s.saida).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }) : (s.data || dataDia),
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
        if (sai.origem && sai.origem.toLowerCase().includes("discord")) {
          sai.tipoFechamento = (s.tipo_fechamento && !s.tipo_fechamento.includes("CRASH")) ? s.tipo_fechamento : "NORMAL";
        } else {
          sai.tipoFechamento = s.tipo_fechamento;
        }
        sai.auditado = true;
      }

      ent.saidaId = sai.id;
      sai.pareadoCom = ent.id;
      ent.auditado = true;
      if (sai.origem && sai.origem.toLowerCase().includes("discord")) {
        ent.tipoFechamento = (s.tipo_fechamento && !s.tipo_fechamento.includes("CRASH")) ? s.tipo_fechamento : "NORMAL";
      } else {
        ent.tipoFechamento = s.tipo_fechamento;
      }
    });
  }

  // Ordenação cronológica estrita por milissegundos absolutos (normalizados para fuso)
  entradas.sort((a, b) => getTimestampMs(a, dataDia) - getTimestampMs(b, dataDia));
  saidas.sort((a, b) => getTimestampMs(a, dataDia) - getTimestampMs(b, dataDia));

  // Validação da Regra de Ouro apenas para pares NÃO auditados
  entradas.forEach((ent, idx) => {
    const proximaEntrada = entradas[idx + 1];
    if (!ent.auditado && proximaEntrada && ent.saidaId) {
      const sai = saidas.find((s) => s.id === ent.saidaId);
      if (sai && getTimestampMs(sai, dataDia) > getTimestampMs(proximaEntrada, dataDia)) {
        // Violação da Regra de Ouro: desvincula a saída inválida que transpassa a próxima entrada
        sai.pareadoCom = null;
        ent.saidaId = null;
        ent.auditado = false;
      }
    }
  });

  entradas.forEach((ent, idx) => {
    const proximaEntrada = entradas[idx + 1];

    if (!ent.saidaId) {
      const saidaCandidata = saidas.find((s) => {
        if (s.pareadoCom) return false;
        const kSai = getTimestampMs(s, dataDia);
        const kEnt = getTimestampMs(ent, dataDia);
        const kProx = proximaEntrada ? getTimestampMs(proximaEntrada, dataDia) : Infinity;

        return kSai >= kEnt && kSai <= kProx;
      });

      if (saidaCandidata) {
        ent.saidaId = saidaCandidata.id;
        saidaCandidata.pareadoCom = ent.id;
      }
    }

    const saidaVinculada = saidas.find((s) => s.id === ent.saidaId);
    const kIni = getTimestampMs(ent, dataDia);
    const kLimiteProxima = proximaEntrada ? getTimestampMs(proximaEntrada, dataDia) : Infinity;

    // Pega todas as atividades deste ciclo entre a entrada e a próxima entrada (ou saída)
    const atvsNoIntervalo = (atividades || [])
      .filter((atv) => {
        const kAtv = getTimestampMs(atv, dataDia);
        return kAtv >= kIni && kAtv <= kLimiteProxima;
      })
      .map((atv) => {
        let dentroDoPar = true;
        if (saidaVinculada) {
          const kSai = getTimestampMs(saidaVinculada, dataDia);
          dentroDoPar = getTimestampMs(atv, dataDia) <= kSai;
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

  // Mantém sempre ordenado cronologicamente por milissegundos absolutos
  entradas.sort((a, b) => getTimestampMs(a, dataDia) - getTimestampMs(b, dataDia));
  saidas.sort((a, b) => getTimestampMs(a, dataDia) - getTimestampMs(b, dataDia));

  // Deduplica saidas pelo UUID para garantir que nenhum UUID real apareça mais de uma vez no mesmo dia
  const saidasUnicas = [];
  const uuidsSaidasVistos = new Set();
  const idsSaidasVistos = new Set();
  saidas.forEach((s) => {
    if (s.uuid && !s.uuid.startsWith("CRASH_") && !s.uuid.startsWith("AUTO_") && !s.uuid.startsWith("sai-auto") && !s.uuid.startsWith("sai-1min")) {
      if (uuidsSaidasVistos.has(s.uuid) && !s.pareadoCom) return;
      uuidsSaidasVistos.add(s.uuid);
    }
    if (idsSaidasVistos.has(s.id)) return;
    idsSaidasVistos.add(s.id);
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

    // 2. Janela Operacional: das 09:00:00 de um dia até as 09:00:00 do dia seguinte (horário de Brasília)
    const [anoF, mesF, diaF] = dataFiltro.split("-").map(Number);
    const dProx = new Date(anoF, mesF - 1, diaF + 1);
    const dataSeguinteStr = `${dProx.getFullYear()}-${String(dProx.getMonth() + 1).padStart(2, "0")}-${String(dProx.getDate()).padStart(2, "0")}`;

    const inicioJanelaUtc = new Date(`${dataFiltro}T09:00:00-03:00`).toISOString();
    const fimJanelaUtc = new Date(`${dataSeguinteStr}T09:00:00-03:00`).toISOString();

    const [fAno, fMes, fDia] = (isSemana ? dataFim : dataFiltro).split("-").map(Number);
    const dFimSeg = new Date(fAno, fMes - 1, fDia + 1);
    const dataFimSeguinteStr = `${dFimSeg.getFullYear()}-${String(dFimSeg.getMonth() + 1).padStart(2, "0")}-${String(dFimSeg.getDate()).padStart(2, "0")}`;
    const inicioSemanaUtc = new Date(`${dataInicio}T09:00:00-03:00`).toISOString();
    const fimSemanaUtc = new Date(`${dataFimSeguinteStr}T09:00:00-03:00`).toISOString();

    const gteUtc = isSemana ? inicioSemanaUtc : inicioJanelaUtc;
    const lteUtc = isSemana ? fimSemanaUtc : fimJanelaUtc;

    let queryDiscord = v2
      .from("discord_log_messages")
      .select("id, content, created_at")
      .eq("log_type", "ponto")
      .ilike("content", `%[ID]: ${usuarioId} %`)
      .gte("created_at", gteUtc)
      .lte("created_at", lteUtc)
      .order("id", { ascending: true });

    const { data: rawPontoMsgs } = await queryDiscord;

    const rawEventosPonto = [];
    const seenUuids = new Set();
    (rawPontoMsgs || []).forEach((m) => {
      const parsed = parseMsgPonto(m.content, m.created_at, String(m.id));
      if (parsed && String(parsed.usuario_id) === String(usuarioId)) {
        const chave = parsed.uuid ? parsed.uuid.toLowerCase() : `${parsed.tipo}_${parsed.data}_${parsed.hora}`;
        if (seenUuids.has(chave)) return;
        seenUuids.add(chave);
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
      tunagensQuery = tunagensQuery.gte("data", dataInicio).lte("data", dataFimSeguinteStr);
      bancadaQuery = bancadaQuery.gte("data", dataInicio).lte("data", dataFimSeguinteStr);
      sessoesQuery = sessoesQuery.gte("data", dataInicio).lte("data", dataFimSeguinteStr);
    } else {
      tunagensQuery = tunagensQuery.in("data", [dataFiltro, dataSeguinteStr]);
      bancadaQuery = bancadaQuery.in("data", [dataFiltro, dataSeguinteStr]);
      sessoesQuery = sessoesQuery.in("data", [dataFiltro, dataSeguinteStr]);
    }

    const [tunagensRes, bancadaRes, sessoesRes] = await Promise.all([
      tunagensQuery,
      bancadaQuery,
      sessoesQuery,
    ]);

    const processarAtividade = (item, tipo) => {
      let hora = item.hora ? item.hora.slice(0, 8) : "";
      let data = item.data;
      let iso = item.timestampz;
      if (item.timestampz) {
        const d = new Date(item.timestampz);
        const horaSp = d.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour12: false });
        const dataSp = d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
        if (!hora || hora === "00:00:00") hora = horaSp;
        if (!data) data = dataSp;
        iso = d.toISOString();
      } else if (data && hora) {
        iso = new Date(`${data}T${hora}-03:00`).toISOString();
      }

      return {
        id: item.uuid,
        tipo,
        data,
        hora,
        desc: tipo === "tunagem"
          ? `🚗 Tunagem: ${item.veiculo_nome || "Veículo"} (${item.placa || "S/ Placa"}) — R$ ${Number(item.valor_pago || 0).toLocaleString("pt-BR")}`
          : `🛠️ Bancada: ${item.quantidade || 1}x ${item.item_craftado || "Item"}`,
        veiculo: item.veiculo_nome,
        placa: item.placa,
        valor: item.valor_pago,
        item: item.item_craftado,
        quantidade: item.quantidade,
        timestampz: iso,
      };
    };

    const todasAtividades = [
      ...(tunagensRes.data || []).map((t) => processarAtividade(t, "tunagem")),
      ...(bancadaRes.data || []).map((b) => processarAtividade(b, "bancada")),
    ]
      .filter((atv) => {
        if (atv.timestampz) {
          return atv.timestampz >= gteUtc && atv.timestampz <= lteUtc;
        }
        return true;
      })
      .sort((a, b) => (a.timestampz || `${a.data}T${a.hora}`).localeCompare(b.timestampz || `${b.data}T${b.hora}`));

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

    // 2) Reassocia eventos (entradas e saídas) e atividades da madrugada (00:00 às 08:59:59)
    // ao ciclo operacional de 24h que começou às 09:00 do dia anterior.
    const reassociarAoDiaOperacional = (item) => {
      if (!item || !item.hora) return;
      if (item.hora < "09:00:00") {
        const dStr = item.dataOriginal || item.data;
        if (dStr) {
          const [a, m, d] = dStr.split("-").map(Number);
          const dAnt = new Date(a, m - 1, d - 1);
          const dataAnterior = `${dAnt.getFullYear()}-${String(dAnt.getMonth() + 1).padStart(2, "0")}-${String(dAnt.getDate()).padStart(2, "0")}`;
          item.dataOriginal = item.dataOriginal || item.data;
          item.data = dataAnterior;
        }
      }
    };

    rawEventosPonto.forEach((ev) => {
      if (ev.sessaoVinculadaId) return; // Preserva associação já homologada
      reassociarAoDiaOperacional(ev);
    });

    todasAtividades.forEach(reassociarAoDiaOperacional);

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
      const evsDia = todosEventosPonto.filter((ev) => {
        if (ev.timestampz) return ev.timestampz >= inicioJanelaUtc && ev.timestampz <= fimJanelaUtc;
        return true;
      });
      const atvsDia = todasAtividades.filter((atv) => {
        if (atv.timestampz) return atv.timestampz >= inicioJanelaUtc && atv.timestampz <= fimJanelaUtc;
        return true;
      });
      const sessoesDia = todasSessoesFormatadas.filter((s) => {
        if (s.entrada) {
          const entIso = new Date(s.entrada).toISOString();
          return entIso >= inicioJanelaUtc && entIso <= fimJanelaUtc;
        }
        return s.data === dataFiltro;
      });
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

    // 5. Compila status de toda a equipe para o painel lateral esquerdo
    const dataMinGlobal = isSemana ? dataInicio : dataFiltro;
    const dataMaxGlobal = isSemana ? dataFim : dataFiltro;

    const [todosLogPontoRes, todosDiscordPontoRes, todosTunagensRes, todosBancadaRes] = await Promise.all([
      v2
        .from("log_ponto")
        .select("id, usuario_id, nome, total_minutos, tipo_fechamento, total_atividades, qtd_tunagens, qtd_bancada, uuid_entrada, uuid_saida, observacao")
        .eq("mecanica_id", "reds")
        .gte("data", dataMinGlobal)
        .lte("data", dataMaxGlobal),
      v2
        .from("discord_log_messages")
        .select("content")
        .eq("log_type", "ponto")
        .gte("created_at", gteUtc)
        .lte("created_at", lteUtc),
      v2
        .from("log_tunagem")
        .select("tecnico_id")
        .eq("mecanica_id", "reds")
        .gte("data", dataMinGlobal)
        .lte("data", dataMaxGlobal),
      v2
        .from("log_bancada")
        .select("usuario_id")
        .eq("mecanica_id", "reds")
        .gte("data", dataMinGlobal)
        .lte("data", dataMaxGlobal),
    ]);

    const mapaEquipe = new Map();

    (todosDiscordPontoRes.data || []).forEach((m) => {
      const match = m.content.match(/\[ID\]:\s*(\d+)\s+([^(]+)/i);
      if (match) {
        const uId = match[1].trim();
        const isEntrou = m.content.includes("ENTROU EM SERVIÇO");
        const isSaiu = m.content.includes("SAIU DE SERVIÇO");
        if (!mapaEquipe.has(uId)) {
          mapaEquipe.set(uId, { id: uId, entradasDiscord: 0, saidasDiscord: 0, sessoesBanco: 0, minutosBanco: 0, qtdTunagens: 0, qtdBancada: 0, qtdTurnosCurtosComServico: 0, qtdTurnosCurtosSemServico: 0 });
        }
        const item = mapaEquipe.get(uId);
        if (isEntrou) item.entradasDiscord++;
        if (isSaiu) item.saidasDiscord++;
      }
    });

    (todosTunagensRes.data || []).forEach((t) => {
      const uId = String(t.tecnico_id);
      if (uId) {
        if (!mapaEquipe.has(uId)) {
          mapaEquipe.set(uId, { id: uId, entradasDiscord: 0, saidasDiscord: 0, sessoesBanco: 0, minutosBanco: 0, qtdTunagens: 0, qtdBancada: 0, qtdTurnosCurtosComServico: 0, qtdTurnosCurtosSemServico: 0 });
        }
        mapaEquipe.get(uId).qtdTunagens++;
      }
    });

    (todosBancadaRes.data || []).forEach((b) => {
      const uId = String(b.usuario_id);
      if (uId) {
        if (!mapaEquipe.has(uId)) {
          mapaEquipe.set(uId, { id: uId, entradasDiscord: 0, saidasDiscord: 0, sessoesBanco: 0, minutosBanco: 0, qtdTunagens: 0, qtdBancada: 0, qtdTurnosCurtosComServico: 0, qtdTurnosCurtosSemServico: 0 });
        }
        mapaEquipe.get(uId).qtdBancada++;
      }
    });

    const logPontoRows = todosLogPontoRes.data || [];
    const seenUuidsEntrada = new Set();
    const logPontoValidos = logPontoRows.filter((s) => {
      const isAutoEntrada = s.uuid_entrada && (s.uuid_entrada.startsWith("AUTO_ENTRADA_") || s.uuid_entrada.toLowerCase().startsWith("auto-"));
      if (isAutoEntrada) {
        const duplicada = logPontoRows.some((outra) => outra.id !== s.id && outra.usuario_id === s.usuario_id && outra.uuid_saida === s.uuid_saida && !outra.uuid_entrada?.toLowerCase().startsWith("auto-"));
        if (duplicada) return false;
      }
      // Deduplicação estrita por uuid_entrada para evitar sessões idênticas gravadas em duplicidade com datas operacionais divergentes
      if (s.uuid_entrada && !s.uuid_entrada.startsWith("concil-ent-")) {
        const key = `${s.usuario_id}_${s.uuid_entrada}`;
        if (seenUuidsEntrada.has(key)) return false;
        seenUuidsEntrada.add(key);
      }
      return true;
    });

    logPontoValidos.forEach((s) => {
      const uId = String(s.usuario_id);
      if (!mapaEquipe.has(uId)) {
        mapaEquipe.set(uId, { id: uId, entradasDiscord: 0, saidasDiscord: 0, sessoesBanco: 0, minutosBanco: 0, qtdTunagens: 0, qtdBancada: 0, qtdTurnosCurtosComServico: 0, qtdTurnosCurtosSemServico: 0 });
      }
      const item = mapaEquipe.get(uId);
      item.sessoesBanco++;
      const minSessao = s.total_minutos || 0;
      item.minutosBanco += minSessao;

      const qtdAtv = (s.total_atividades || 0) + (s.qtd_tunagens || 0) + (s.qtd_bancada || 0);
      const tipoFmt = String(s.tipo_fechamento || "").toUpperCase();
      const obsFmt = String(s.observacao || "").toUpperCase();
      const isCrash = tipoFmt.includes("CRASH") || obsFmt.includes("CRASH") || tipoFmt.includes("1MIN") || obsFmt.includes("1 MINUTO") || tipoFmt.includes("ESTIMADO");
      const isSaidaDiscord = !isCrash;

      // Irregularidade (<30m) só se aplica quando a saída foi deliberada via log do Discord, nunca por crash
      if (minSessao > 0 && minSessao < 30 && isSaidaDiscord) {
        if (qtdAtv > 0 || (item.qtdTunagens + item.qtdBancada > 0)) {
          item.qtdTurnosCurtosComServico = (item.qtdTurnosCurtosComServico || 0) + 1;
        } else {
          item.qtdTurnosCurtosSemServico = (item.qtdTurnosCurtosSemServico || 0) + 1;
        }
      }
    });

    const equipePeriodo = usuarios
      .map((u) => {
        const info = mapaEquipe.get(String(u.id));
        const trabalhou = Boolean(
          info && (info.entradasDiscord > 0 || info.saidasDiscord > 0 || info.sessoesBanco > 0 || info.qtdTunagens > 0 || info.qtdBancada > 0)
        );
        const sessoesBanco = info?.sessoesBanco || 0;
        const entradasDiscord = info?.entradasDiscord || 0;
        const saidasDiscord = info?.saidasDiscord || 0;
        const minutosBanco = info?.minutosBanco || 0;
        const qtdTunagens = info?.qtdTunagens || 0;
        const qtdBancada = info?.qtdBancada || 0;
        const qtdTurnosCurtosComServico = info?.qtdTurnosCurtosComServico || 0;
        const qtdTurnosCurtosSemServico = info?.qtdTurnosCurtosSemServico || 0;
        const temTurnoCurtoComServico = qtdTurnosCurtosComServico > 0;
        const temTurnoCurtoSemServico = qtdTurnosCurtosSemServico > 0;
        const temIrregularidade = temTurnoCurtoComServico || temTurnoCurtoSemServico;

        let status = "sem_registro";
        if (trabalhou) {
          if (sessoesBanco > 0 && entradasDiscord <= sessoesBanco) {
            status = "avaliado";
          } else {
            status = "pendente";
          }
        }

        const h = Math.floor(minutosBanco / 60);
        const m = minutosBanco % 60;
        const horasFormatadas = minutosBanco > 0 ? `${h}H${String(m).padStart(2, "0")}M` : "0H00M";

        return {
          id: u.id,
          nome: u.nome,
          cargoLabel: u.cargoLabel,
          cargoNivel: u.cargoNivel,
          cargoOrdem: u.cargoOrdem,
          trabalhou,
          status,
          sessoesBanco,
          minutosBanco,
          horasFormatadas,
          entradasDiscord,
          saidasDiscord,
          qtdTunagens,
          qtdBancada,
          temTurnoCurtoComServico,
          qtdTurnosCurtosComServico,
          temTurnoCurtoSemServico,
          qtdTurnosCurtosSemServico,
          temIrregularidade,
        };
      })
      .filter((u) => u.trabalhou)
      .sort((a, b) => {
        if (a.status !== b.status) {
          return a.status === "pendente" ? -1 : 1;
        }
        if (b.minutosBanco !== a.minutosBanco) {
          return b.minutosBanco - a.minutosBanco;
        }
        return a.nome.localeCompare(b.nome);
      });

    return NextResponse.json({
      ok: true,
      usuarioId,
      modo,
      isSemana,
      dataFiltro,
      dataInicio: semanaRef.segunda,
      dataFim: semanaRef.domingo,
      janelaOperacional: {
        inicio: `${dataFiltro}T09:00:00`,
        fim: `${dataSeguinteStr}T09:00:00`,
        inicioUtc: inicioJanelaUtc,
        fimUtc: fimJanelaUtc,
        label: `${dataFiltro.slice(8, 10)}/${dataFiltro.slice(5, 7)} 09:00 até ${dataSeguinteStr.slice(8, 10)}/${dataSeguinteStr.slice(5, 7)} 09:00`,
      },
      usuarios: usuarios || [],
      equipePeriodo: equipePeriodo || [],
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

      // Determina as datas de calendário reais considerando a janela operacional das 09h às 09h
      const [a, m, d] = dataSessao.split("-").map(Number);
      const dProx = new Date(a, m - 1, d + 1);
      const dataSeguinte = `${dProx.getFullYear()}-${String(dProx.getMonth() + 1).padStart(2, "0")}-${String(dProx.getDate()).padStart(2, "0")}`;

      const dataEntradaReal = (s.horaEntrada && s.horaEntrada < "09:00:00") ? dataSeguinte : dataSessao;
      let dataSaidaReal = dataEntradaReal;

      if (diffMin < 0) {
        diffMin += 1440;
        dataSaidaReal = dataSeguinte;
      } else if (s.horaSaida && s.horaSaida < "09:00:00" && s.horaEntrada >= "09:00:00") {
        dataSaidaReal = dataSeguinte;
      }

      return {
        mecanica_id: "reds",
        usuario_id: parseInt(usuario_id, 10),
        nome: nome || "Mecânico",
        data: dataSessao,
        entrada: `${dataEntradaReal}T${s.horaEntrada}-03:00`,
        saida: `${dataSaidaReal}T${s.horaSaida}-03:00`,
        uuid_entrada: s.uuidEntrada || `concil-ent-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        uuid_saida: s.uuidSaida || `concil-sai-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        total_minutos: diffMin,
        total_segundos: diffMin * 60,
        tipo_fechamento: s.tipoFechamento || "VALIDADO_CONCILIADOR",
        qtd_tunagens: s.qtdTunagens || 0,
        qtd_bancada: s.qtdBancada || 0,
        total_atividades: (s.qtdTunagens || 0) + (s.qtdBancada || 0),
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
