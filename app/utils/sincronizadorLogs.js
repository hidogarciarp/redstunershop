import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const url =
    process.env.NEXT_PUBLIC_NEW_SUPABASE_URL ||
    "https://sxrfkbjbyjdmyyxbzobb.supabase.co";
  const key =
    process.env.NEXT_PUBLIC_NEW_SUPABASE_KEY ||
    "sb_publishable_et87L-NCrieyXmvteW84-w_v9cxAbjG";
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const CANAIS_MECANICAS = [
  { key: "reds", nome: "RED'S Tunershop", canalPonto: "1388991065226346718" },
  { key: "harmony", nome: "Harmony Custom", canalPonto: "1389735866515066900" },
  { key: "dudark", nome: "Dudark Motors", canalPonto: "1504297353824178226" },
  { key: "vespucci", nome: "Vespucci / Beach", canalPonto: "1535045942288326837" }
];

function getDataCivilBrasilia(dateObj) {
  const d = new Date(dateObj.getTime() - 3 * 3600 * 1000);
  return d.toISOString().split("T")[0];
}

function parsePonto(rawText) {
  if (!rawText) return null;
  const clean = String(rawText).replace(/```ini/gi, "").replace(/```/g, "");
  const lines = clean.split("\n");
  let id = null, nome = null, tipo = null, dataISO = null, uuid = null;

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    const matchId = l.match(/^\[ID\]:\s*(\d+)\s+(.+?)\s*\(\s*(ENTROU EM SERVI[ÇC]O|SAIU DE SERVI[ÇC]O)/i);
    if (matchId) {
      id = matchId[1].trim();
      nome = matchId[2].trim();
      tipo = matchId[3].toUpperCase().includes("ENTROU") ? "ENTRADA" : "SAIDA";
    }
    const matchData = l.match(/\[DATA\]:\s*(\d{2})\/(\d{2})\/(\d{4})(?:,?\s*\[HORA\]:?|\s*,)?\s*(\d{2}:\d{2}:\d{2})/i);
    if (matchData) {
      const [, dd, mm, aaaa, hora] = matchData;
      dataISO = `${aaaa}-${mm}-${dd}T${hora}-03:00`;
    }
    const matchUuid = l.match(/\[UUID\]:\s*([a-f0-9-]{36})/i);
    if (matchUuid) uuid = matchUuid[1].trim();
  }

  if (!id || !dataISO) return null;
  return {
    id: parseInt(id, 10),
    nome,
    tipo,
    timestamp: new Date(dataISO),
    uuid: uuid || `auto-${id}-${dataISO}`
  };
}

async function buscarAtividades(supabase, mecanicaId, usuarioId, inicio, fim) {
  const inicioISO = inicio.toISOString();
  const fimISO = fim.toISOString();

  const { data: tunagens } = await supabase
    .from("log_tunagem")
    .select("uuid, tecnico_id, veiculo_nome, placa, valor_pago, timestampz")
    .eq("mecanica_id", mecanicaId)
    .eq("tecnico_id", String(usuarioId))
    .gte("timestampz", inicioISO)
    .lte("timestampz", fimISO)
    .order("timestampz", { ascending: true });

  const { data: bancadas } = await supabase
    .from("log_bancada")
    .select("uuid, usuario_id, usuario_nome, timestampz")
    .eq("mecanica_id", mecanicaId)
    .eq("usuario_id", String(usuarioId))
    .gte("timestampz", inicioISO)
    .lte("timestampz", fimISO)
    .order("timestampz", { ascending: true });

  const { data: baus } = await supabase
    .from("log_bau")
    .select("uuid, usuario_id, usuario_nome, timestampz")
    .eq("mecanica_id", mecanicaId)
    .eq("usuario_id", String(usuarioId))
    .gte("timestampz", inicioISO)
    .lte("timestampz", fimISO)
    .order("timestampz", { ascending: true });

  const lista = [];
  for (const t of tunagens || []) {
    lista.push({
      uuid: t.uuid,
      tipo: "TUNAGEM",
      timestamp: new Date(t.timestampz),
      detalhe: `Tunagem: ${t.veiculo_nome || "Veículo"} (${t.placa || "Sem Placa"})`
    });
  }
  for (const b of bancadas || []) {
    lista.push({
      uuid: b.uuid,
      tipo: "BANCADA",
      timestamp: new Date(b.timestampz),
      detalhe: `Craft de Bancada`
    });
  }
  for (const bau of baus || []) {
    lista.push({
      uuid: bau.uuid,
      tipo: "BAU",
      timestamp: new Date(bau.timestampz),
      detalhe: `Ação no Baú`
    });
  }

  lista.sort((a, b) => a.timestamp - b.timestamp);

  const qtdTunagens = tunagens?.length || 0;
  const qtdBancada = bancadas?.length || 0;
  const qtdBau = baus?.length || 0;
  const totalAtividades = qtdTunagens + qtdBancada + qtdBau;
  const ultima = lista.length > 0 ? lista[lista.length - 1] : null;

  return { qtdTunagens, qtdBancada, qtdBau, totalAtividades, ultimaAtividade: ultima };
}

export async function sincronizarLogsUnificados(diasAtras = 2) {
  const supabase = getSupabaseAdmin();
  const dataLimite = new Date(Date.now() - diasAtras * 24 * 3600 * 1000);
  const dataLimiteISO = dataLimite.toISOString();

  const relatorio = {
    tunagens: 0,
    bancada: 0,
    bau: 0,
    pontos: 0,
    ajustesPreservados: 0,
  };

  // --------------------------------------------------------------------------
  // 1. SINCRONIZAR TUNAGEM
  // --------------------------------------------------------------------------
  try {
    const { data: tunagensNovas, error: errTun } = await supabase
      .from("discord_log_messages")
      .select("id, content, channel_id, mechanic_id, created_at")
      .eq("log_type", "tunagem")
      .gte("created_at", dataLimiteISO);

    if (!errTun && tunagensNovas && tunagensNovas.length > 0) {
      const formatados = [];
      for (const t of tunagensNovas) {
        const matchTecnico = t.content.match(/\[T[eé]cnico\]:\s*([^(]+)\s*\(ID:\s*(\d+)\)/i);
        const matchDono = t.content.match(/\[Dono\]:\s*([^(]+)\s*\(ID:\s*(\d+)\)/i);
        const matchVeiculo = t.content.match(/\[Ve[íi]culo\]:\s*([^(]+)\s*\(([^)]+)\)/i);
        const matchPlaca = t.content.match(/\[Placa\]:\s*([^\n\r]+)/i);
        const matchValor = t.content.match(/\[Valor Pago\]:\s*R\$\s*(\d+)/i);
        const matchAntes = t.content.match(/\[Antes\]:\s*(\[[^\]]*\]|\{[^}]*\})/i);
        const matchDepois = t.content.match(/\[Depois\]:\s*(\[[^\]]*\]|\{[^}]*\})/i);
        const matchData = t.content.match(/\[DATA\]:\s*(\d{2}\/\d{2}\/\d{4})(?:,\s*|\s+)(\d{2}:\d{2}:\d{2})/i);
        const matchUuid = t.content.match(/\[UUID\]:\s*([a-f0-9-]{36})/i);
        const matchBaia = t.content.match(/\[Baia\]:\s*([^\n\r]+)/i);
        const matchOficina = t.content.match(/\[Oficina\]:\s*([^\n\r]+)/i);

        let dt = t.created_at.split("T")[0];
        let hr = "00:00:00";
        if (matchData) {
          const parts = matchData[1].split("/");
          dt = `${parts[2]}-${parts[1]}-${parts[0]}`;
          hr = matchData[2];
        }

        let antesJson = null;
        let depoisJson = null;
        try { if (matchAntes) antesJson = JSON.parse(matchAntes[1]); } catch {}
        try { if (matchDepois) depoisJson = JSON.parse(matchDepois[1]); } catch {}

        formatados.push({
          uuid: matchUuid ? matchUuid[1].trim() : `tun_${t.id}`,
          mecanica_id: t.mechanic_id || "reds",
          tecnico_id: matchTecnico ? matchTecnico[2].trim() : "0",
          tecnico_nome: matchTecnico ? matchTecnico[1].trim() : "Desconhecido",
          dono_id: matchDono ? matchDono[2].trim() : null,
          dono_nome: matchDono ? matchDono[1].trim() : null,
          veiculo_nome: matchVeiculo ? matchVeiculo[1].trim() : null,
          veiculo_modelo: matchVeiculo ? matchVeiculo[2].trim() : null,
          placa: matchPlaca ? matchPlaca[1].trim() : null,
          valor_pago: matchValor ? Number(matchValor[1]) : 0,
          antes_json: antesJson,
          depois_json: depoisJson,
          data: dt,
          hora: hr,
          timestampz: t.created_at,
          baia_nome: matchBaia ? matchBaia[1].trim() : null,
          oficina_nome: matchOficina ? matchOficina[1].trim() : null,
          foto_url: null,
          cobrado: false,
          discord_message_id: String(t.id),
          discord_channel_id: t.channel_id,
          raw_text: t.content,
          criado_em: t.created_at,
        });
      }

      if (formatados.length > 0) {
        const { error: insErr } = await supabase
          .from("log_tunagem")
          .upsert(formatados, { onConflict: "uuid" });

        if (!insErr) relatorio.tunagens = formatados.length;
      }
    }
  } catch (e) {
    console.error("Erro ao sincronizar log_tunagem:", e);
  }

  // --------------------------------------------------------------------------
  // 2. SINCRONIZAR BANCADA
  // --------------------------------------------------------------------------
  try {
    const { data: bancadaNovas, error: errBanc } = await supabase
      .from("discord_log_messages")
      .select("id, content, channel_id, mechanic_id, created_at")
      .eq("log_type", "bancada")
      .gte("created_at", dataLimiteISO);

    if (!errBanc && bancadaNovas && bancadaNovas.length > 0) {
      const formatados = [];
      for (const d of bancadaNovas) {
        const matchId = d.content.match(/\[ID\]:\s*(\d+)\s+([^`\n\r]+)/i);
        const usuarioId = matchId ? matchId[1].trim() : "0";
        const usuarioNome = matchId ? matchId[2].trim() : "Desconhecido";
        const matchData = d.content.match(/\[DATA\]:\s*(\d{2}\/\d{2}\/\d{4})/i);
        const matchHora = d.content.match(/\[HORA\]:\s*(\d{2}:\d{2}:\d{2})/i);
        const matchItem = d.content.match(/\[ITEMNAME\]:\s*(.+)/i);
        const matchQtd = d.content.match(/\[QUANTIDADE\]:\s*(\d+)/i);
        const matchUuid = d.content.match(/\[UUID\]:\s*([a-f0-9-]{36})/i);

        let dt = d.created_at.split("T")[0];
        if (matchData) {
          const parts = matchData[1].split("/");
          dt = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }

        formatados.push({
          uuid: matchUuid ? matchUuid[1].trim() : `disc_banc_${d.id}`,
          mecanica_id: d.mechanic_id || "reds",
          usuario_id: usuarioId,
          usuario_nome: usuarioNome,
          item_craftado: matchItem ? matchItem[1].trim() : "Craft de Bancada",
          quantidade: matchQtd ? parseInt(matchQtd[1], 10) : 1,
          data: dt,
          hora: matchHora ? matchHora[1] : "00:00:00",
          timestampz: d.created_at,
          discord_message_id: String(d.id),
          discord_channel_id: d.channel_id,
          raw_text: d.content,
          criado_em: d.created_at,
        });
      }

      if (formatados.length > 0) {
        const { error: insErr } = await supabase
          .from("log_bancada")
          .upsert(formatados, { onConflict: "uuid" });

        if (!insErr) relatorio.bancada = formatados.length;
      }
    }
  } catch (e) {
    console.error("Erro ao sincronizar log_bancada:", e);
  }

  // --------------------------------------------------------------------------
  // 3. SINCRONIZAR BAÚ
  // --------------------------------------------------------------------------
  try {
    const { data: bauNovas, error: errBau } = await supabase
      .from("discord_log_messages")
      .select("id, content, channel_id, mechanic_id, created_at")
      .eq("log_type", "bau")
      .gte("created_at", dataLimiteISO);

    if (!errBau && bauNovas && bauNovas.length > 0) {
      const formatados = [];
      for (const b of bauNovas) {
        const matchId = b.content.match(/\[ID\]:\s*(\d+)\s+([^`\n\r]+)/i);
        const matchAcao = b.content.match(/(GUARDOU|RETIROU)\s+([^`\n\r]+)/i);
        const matchData = b.content.match(/\[DATA\]:\s*(\d{2}\/\d{2}\/\d{4})/i);
        const matchHora = b.content.match(/\[HORA\]:\s*(\d{2}:\d{2}:\d{2})/i);
        const matchUuid = b.content.match(/\[UUID\]:\s*([a-f0-9-]{36})/i);

        let dt = b.created_at.split("T")[0];
        if (matchData) {
          const parts = matchData[1].split("/");
          dt = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }

        formatados.push({
          uuid: matchUuid ? matchUuid[1].trim() : `bau_${b.id}`,
          mecanica_id: b.mechanic_id || "reds",
          usuario_id: matchId ? matchId[1].trim() : "0",
          usuario_nome: matchId ? matchId[2].trim() : "Desconhecido",
          acao: matchAcao ? matchAcao[1].toUpperCase() : "MOVIMENTOU",
          item: matchAcao ? matchAcao[2].trim() : "Item",
          quantidade: 1,
          data: dt,
          hora: matchHora ? matchHora[1] : "00:00:00",
          timestampz: b.created_at,
          discord_message_id: String(b.id),
          discord_channel_id: b.channel_id,
          raw_text: b.content,
          criado_em: b.created_at,
        });
      }

      if (formatados.length > 0) {
        const { error: insErr } = await supabase
          .from("log_bau")
          .upsert(formatados, { onConflict: "uuid" });

        if (!insErr) relatorio.bau = formatados.length;
      }
    }
  } catch (e) {
    console.error("Erro ao sincronizar log_bau:", e);
  }

  // --------------------------------------------------------------------------
  // 4. SINCRONIZAR PONTO (MOTOR CENTRALIZADO COM PROTEÇÃO DE AJUSTE MANUAL)
  // --------------------------------------------------------------------------
  try {
    const { data: sessoesExistentes } = await supabase
      .from("log_ponto")
      .select("id, uuid_entrada, tipo_fechamento")
      .gte("entrada", dataLimiteISO);

    const mapaExistentes = new Map();
    (sessoesExistentes || []).forEach((s) => {
      mapaExistentes.set(s.uuid_entrada, s);
    });

    for (const mec of CANAIS_MECANICAS) {
      const { data: rawLogs } = await supabase
        .from("discord_log_messages")
        .select("id, content, created_at, channel_id")
        .eq("log_type", "ponto")
        .eq("channel_id", mec.canalPonto)
        .gte("created_at", dataLimiteISO)
        .order("created_at", { ascending: true });

      if (!rawLogs || rawLogs.length === 0) continue;

      const eventos = [];
      for (const r of rawLogs) {
        const p = parsePonto(r.content);
        if (p) {
          p.id_msg = r.id;
          eventos.push(p);
        }
      }

      const porUsuario = new Map();
      for (const ev of eventos) {
        if (!porUsuario.has(ev.id)) porUsuario.set(ev.id, []);
        porUsuario.get(ev.id).push(ev);
      }

      for (const [usuarioId, evs] of porUsuario.entries()) {
        evs.sort((a, b) => a.timestamp - b.timestamp);

        let sessaoAberta = null;
        let i = 0;

        while (i < evs.length) {
          const atual = evs[i];
          const proximo = i + 1 < evs.length ? evs[i + 1] : null;
          const isBurst = proximo && Math.abs((proximo.timestamp - atual.timestamp) / 1000) <= 5;

          if (isBurst && atual.tipo !== proximo.tipo) {
            let evSaida = atual.tipo === "SAIDA" ? atual : proximo;
            let evEntrada = atual.tipo === "ENTRADA" ? atual : proximo;

            if (sessaoAberta) {
              await salvarOuAtualizarSessao(
                supabase,
                mec.key,
                usuarioId,
                sessaoAberta,
                evSaida.timestamp,
                evSaida.uuid,
                "NORMAL",
                "Turno encerrado via Discord (renovado em duplo clique).",
                mapaExistentes,
                relatorio
              );
            }

            sessaoAberta = {
              nome: evEntrada.nome,
              entrada: evEntrada.timestamp,
              uuid: evEntrada.uuid,
            };
            i += 2;
            continue;
          }

          if (atual.tipo === "ENTRADA") {
            if (sessaoAberta) {
              const atividades = await buscarAtividades(supabase, mec.key, usuarioId, sessaoAberta.entrada, atual.timestamp);
              let saidaFinal = atividades.ultimaAtividade
                ? new Date(atividades.ultimaAtividade.timestamp.getTime() + 1000)
                : new Date(sessaoAberta.entrada.getTime() + 60000);
              let tipoFechamento = atividades.ultimaAtividade ? "CRASH_COM_ATIVIDADE" : "CRASH_SEM_ATIVIDADE";
              let uuidSaida = atividades.ultimaAtividade
                ? `CRASH_${atividades.ultimaAtividade.tipo === "TUNAGEM" ? "TUN" : "BANC"}_${atividades.ultimaAtividade.uuid}`
                : "CRASH_SEM_ATIVIDADE";
              let obs = atividades.ultimaAtividade
                ? "Crash detectado na nova entrada. Fechado 1s após a última atividade comprovada."
                : "Ponto esquecido sem atividade. Fechado com 1 minuto.";

              await salvarOuAtualizarSessao(
                supabase,
                mec.key,
                usuarioId,
                sessaoAberta,
                saidaFinal,
                uuidSaida,
                tipoFechamento,
                obs,
                mapaExistentes,
                relatorio
              );
            }

            sessaoAberta = {
              nome: atual.nome,
              entrada: atual.timestamp,
              uuid: atual.uuid,
            };
          } else if (atual.tipo === "SAIDA") {
            if (sessaoAberta) {
              await salvarOuAtualizarSessao(
                supabase,
                mec.key,
                usuarioId,
                sessaoAberta,
                atual.timestamp,
                atual.uuid,
                "NORMAL",
                "Turno encerrado normalmente via Discord.",
                mapaExistentes,
                relatorio
              );
              sessaoAberta = null;
            } else {
              const entradaEstimada = new Date(atual.timestamp.getTime() - 60000);
              await salvarOuAtualizarSessao(
                supabase,
                mec.key,
                usuarioId,
                { nome: atual.nome, entrada: entradaEstimada, uuid: `AUTO_ENTRADA_${atual.uuid}` },
                atual.timestamp,
                atual.uuid,
                "NORMAL",
                "Saída registrada via Discord. Entrada vinculada 1 min antes.",
                mapaExistentes,
                relatorio
              );
            }
          }

          i++;
        }

        // Se sobrou sessão aberta
        if (sessaoAberta) {
          const agora = new Date();
          const horasAberto = (agora.getTime() - sessaoAberta.entrada.getTime()) / (3600 * 1000);
          const atividades = await buscarAtividades(supabase, mec.key, usuarioId, sessaoAberta.entrada, agora);

          let saidaFinal;
          let tipoFechamento;
          let uuidSaida;
          let obs;

          if (atividades.ultimaAtividade) {
            saidaFinal = new Date(atividades.ultimaAtividade.timestamp.getTime() + 1000);
            tipoFechamento = "CRASH_COM_ATIVIDADE";
            uuidSaida = `CRASH_${atividades.ultimaAtividade.tipo === "TUNAGEM" ? "TUN" : "BANC"}_${atividades.ultimaAtividade.uuid}`;
            obs = "Fechado 1s após a última atividade comprovada.";
          } else if (horasAberto > 2) {
            saidaFinal = new Date(sessaoAberta.entrada.getTime() + 60000);
            tipoFechamento = "CRASH_SEM_ATIVIDADE";
            uuidSaida = "CRASH_SEM_ATIVIDADE";
            obs = "Ponto aberto sem atividade por mais de 2 horas. Fechado com 1 minuto.";
          } else {
            // Menos de 2 horas e sem saída: Ponto ainda ativo ao vivo!
            saidaFinal = null;
            tipoFechamento = "ABERTO";
            uuidSaida = null;
            obs = "Ponto em andamento ao vivo.";
          }

          if (saidaFinal) {
            await salvarOuAtualizarSessao(
              supabase,
              mec.key,
              usuarioId,
              sessaoAberta,
              saidaFinal,
              uuidSaida,
              tipoFechamento,
              obs,
              mapaExistentes,
              relatorio
            );
          }
        }
      }
    }
  } catch (e) {
    console.error("Erro ao sincronizar log_ponto:", e);
  }

  return relatorio;
}

async function salvarOuAtualizarSessao(
  supabase,
  mecanicaId,
  usuarioId,
  sessaoAberta,
  saidaTimestamp,
  uuidSaida,
  tipoFechamento,
  obs,
  mapaExistentes,
  relatorio
) {
  const dSaida = new Date(saidaTimestamp);
  const dEntrada = new Date(sessaoAberta.entrada);

  const diffSeg = Math.max(0, Math.round((dSaida.getTime() - dEntrada.getTime()) / 1000));
  const diffMin = Math.round(diffSeg / 60);

  const atividades = await buscarAtividades(supabase, mecanicaId, usuarioId, dEntrada, dSaida);

  const payload = {
    mecanica_id: mecanicaId,
    usuario_id: usuarioId,
    nome: sessaoAberta.nome,
    data: getDataCivilBrasilia(dEntrada),
    entrada: dEntrada.toISOString(),
    uuid_entrada: sessaoAberta.uuid,
    saida: dSaida.toISOString(),
    uuid_saida: uuidSaida,
    tipo_fechamento: tipoFechamento,
    total_minutos: diffMin,
    total_segundos: diffSeg,
    qtd_tunagens: atividades.qtdTunagens,
    qtd_bancada: atividades.qtdBancada,
    total_atividades: atividades.totalAtividades,
    ultima_atividade_em: atividades.ultimaAtividade?.timestamp.toISOString() || null,
    tipo_ultima_atividade: atividades.ultimaAtividade?.tipo || null,
    detalhe_ultima_atividade: atividades.ultimaAtividade?.detalhe || null,
    observacao: obs,
  };

  const existente = mapaExistentes.get(sessaoAberta.uuid);

  if (existente) {
    // PROTEÇÃO TOTAL: SE FOI AJUSTADO MANUALMENTE PELO ADMIN, NÃO SOBRESCREVER!
    if (existente.tipo_fechamento === "AJUSTE_MANUAL") {
      relatorio.ajustesPreservados++;
      return;
    }

    await supabase.from("log_ponto").update(payload).eq("id", existente.id);
    relatorio.pontos++;
  } else {
    const { data: inserted } = await supabase
      .from("log_ponto")
      .insert([payload])
      .select("id, uuid_entrada, tipo_fechamento")
      .maybeSingle();

    if (inserted) {
      mapaExistentes.set(inserted.uuid_entrada, inserted);
      relatorio.pontos++;
    }
  }
}
