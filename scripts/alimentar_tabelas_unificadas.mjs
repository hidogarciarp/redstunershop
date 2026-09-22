import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Erro: Credenciais do Supabase não encontradas.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ==============================================================================
// 1. CARGA DE TUNAGEM -> log_tunagem
// ==============================================================================
async function alimentarLogTunagem() {
  console.log("\n🚗 [1/4] Alimentando tabela log_tunagem...");
  
  // Limpar log_tunagem para recarga limpa
  await supabase.from("log_tunagem").delete().neq("uuid", "xxx");

  // Buscar todos de logs_tunagem em lotes
  let offset = 0;
  const limit = 1000;
  let totalInserido = 0;

  while (true) {
    const { data: batch, error } = await supabase
      .from("logs_tunagem")
      .select("*")
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Erro ao buscar logs_tunagem:", error);
      break;
    }
    if (!batch || batch.length === 0) break;

    const formatados = batch.map(b => ({
      uuid: b.uuid,
      mecanica_id: b.mechanic_id || "reds",
      tecnico_id: String(b.tecnico_id || ""),
      tecnico_nome: b.tecnico_nome || "Desconhecido",
      dono_id: b.dono_id ? String(b.dono_id) : null,
      dono_nome: b.dono_nome || null,
      veiculo_nome: b.veiculo_nome || null,
      veiculo_modelo: b.veiculo_modelo || null,
      placa: b.placa || null,
      valor_pago: Number(b.valor_pago) || 0,
      antes_json: b.antes_json || null,
      depois_json: b.depois_json || null,
      data: b.data || (b.timestampz ? b.timestampz.split("T")[0] : "2026-09-01"),
      hora: b.hora || "00:00:00",
      timestampz: b.timestampz || b.criado_em,
      baia_nome: b.baia_nome || null,
      oficina_nome: b.oficina_nome || null,
      foto_url: b.foto_url || null,
      cobrado: Boolean(b.cobrado),
      discord_message_id: b.discord_message_id || null,
      discord_channel_id: b.discord_channel_id || null,
      raw_text: b.raw_text || null,
      criado_em: b.criado_em || new Date().toISOString()
    }));

    const { error: insErr } = await supabase.from("log_tunagem").upsert(formatados, { onConflict: "uuid" });
    if (insErr) {
      console.error("Erro ao inserir em log_tunagem:", insErr);
      break;
    }

    totalInserido += formatados.length;
    process.stdout.write(`Inseridos ${totalInserido} registros em log_tunagem...\r`);
    if (batch.length < limit) break;
    offset += limit;
  }

  console.log(`\n✅ log_tunagem populada com ${totalInserido} registros com sucesso!`);
}

// ==============================================================================
// 2. CARGA DE BANCADA -> log_bancada
// ==============================================================================
async function alimentarLogBancada() {
  console.log("\n🛠️ [2/4] Alimentando tabela log_bancada...");
  await supabase.from("log_bancada").delete().neq("uuid", "xxx");

  // 1. Carga de Reds a partir de log_bancada_reds
  let offset = 0;
  const limit = 1000;
  let totalBancada = 0;

  while (true) {
    const { data: batch, error } = await supabase
      .from("log_bancada_reds")
      .select("*")
      .range(offset, offset + limit - 1);

    if (error || !batch || batch.length === 0) break;

    const formatados = batch.map(b => ({
      uuid: `reds_banc_${b.uuid}`,
      mecanica_id: "reds",
      usuario_id: String(b.id || ""),
      usuario_nome: b.nome || "Desconhecido",
      item_craftado: "Craft de Bancada",
      quantidade: 1,
      data: b.data || (b.timestampz ? b.timestampz.split("T")[0] : "2026-09-01"),
      hora: b.hora || "00:00:00",
      timestampz: b.timestampz || b.criado_em,
      criado_em: b.criado_em || new Date().toISOString()
    }));

    const { error: insErr } = await supabase.from("log_bancada").upsert(formatados, { onConflict: "uuid" });
    if (insErr) console.error("Erro ao inserir log_bancada (reds):", insErr);

    totalBancada += formatados.length;
    process.stdout.write(`Inseridos ${totalBancada} registros em log_bancada...\r`);
    if (batch.length < limit) break;
    offset += limit;
  }

  // 2. Carga das outras mecânicas a partir de discord_log_messages
  const { data: discBancada } = await supabase
    .from("discord_log_messages")
    .select("id, content, channel_id, mechanic_id, created_at")
    .eq("log_type", "bancada")
    .neq("mechanic_id", "reds");

  if (discBancada && discBancada.length > 0) {
    const formatadosDisc = [];
    for (const d of discBancada) {
      const matchId = d.content.match(/\[ID\]:\s*(\d+)\s+([^`\n\r]+)/i);
      const usuarioId = matchId ? matchId[1].trim() : "0";
      const usuarioNome = matchId ? matchId[2].trim() : "Desconhecido";
      const matchData = d.content.match(/\[DATA\]:\s*(\d{2}\/\d{2}\/\d{4})/i);
      const matchHora = d.content.match(/\[HORA\]:\s*(\d{2}:\d{2}:\d{2})/i);

      let dt = d.created_at.split("T")[0];
      if (matchData) {
        const parts = matchData[1].split("/");
        dt = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }

      formatadosDisc.push({
        uuid: `disc_banc_${d.id}`,
        mecanica_id: d.mechanic_id || "dudark",
        usuario_id: usuarioId,
        usuario_nome: usuarioNome,
        item_craftado: "Craft de Bancada",
        quantidade: 1,
        data: dt,
        hora: matchHora ? matchHora[1] : "00:00:00",
        timestampz: d.created_at,
        discord_message_id: String(d.id),
        discord_channel_id: d.channel_id,
        raw_text: d.content,
        criado_em: d.created_at
      });
    }

    await supabase.from("log_bancada").upsert(formatadosDisc, { onConflict: "uuid" });
    totalBancada += formatadosDisc.length;
  }

  console.log(`\n✅ log_bancada populada com ${totalBancada} registros com sucesso!`);
}

// ==============================================================================
// 3. CARGA DE BAÚ -> log_bau
// ==============================================================================
async function alimentarLogBau() {
  console.log("\n📦 [3/4] Alimentando tabela log_bau...");
  await supabase.from("log_bau").delete().neq("uuid", "xxx");

  let offset = 0;
  const limit = 1000;
  let totalBau = 0;

  while (true) {
    const { data: batch, error } = await supabase
      .from("discord_log_messages")
      .select("id, content, channel_id, mechanic_id, created_at")
      .eq("log_type", "bau")
      .range(offset, offset + limit - 1);

    if (error || !batch || batch.length === 0) break;

    const formatados = [];
    for (const b of batch) {
      const matchId = b.content.match(/\[ID\]:\s*(\d+)\s+([^`\n\r]+)/i);
      const matchAcao = b.content.match(/\[(GUARDOU|RETIROU)\]:\s*([^`\n\r]+)/i);
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
        criado_em: b.created_at
      });
    }

    const { error: insErr } = await supabase.from("log_bau").upsert(formatados, { onConflict: "uuid" });
    if (insErr) console.error("Erro ao inserir em log_bau:", insErr);

    totalBau += formatados.length;
    process.stdout.write(`Inseridos ${totalBau} registros em log_bau...\r`);
    if (batch.length < limit) break;
    offset += limit;
  }

  console.log(`\n✅ log_bau populada com ${totalBau} registros com sucesso!`);
}

// ==============================================================================
// 4. MOTOR DE PONTO CENTRALIZADO -> log_ponto
// ==============================================================================
const MECANICAS = [
  { key: "reds", nome: "RED'S Tunershop", canalPonto: "1388991065226346718" },
  { key: "harmony", nome: "Harmony Custom", canalPonto: "1389735866515066900" },
  { key: "dudark", nome: "Dudark Motors", canalPonto: "1504297353824178226" },
  { key: "vespucci", nome: "Vespucci / Beach", canalPonto: "1535045942288326837" }
];

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

function getDataCivilBrasilia(dateObj) {
  const d = new Date(dateObj.getTime() - 3 * 3600 * 1000);
  return d.toISOString().split("T")[0];
}

async function buscarAtividades(mecanicaId, usuarioId, inicio, fim) {
  const inicioISO = inicio.toISOString();
  const fimISO = fim.toISOString();

  // Tunagens na tabela centralizada log_tunagem
  const { data: tunagens } = await supabase
    .from("log_tunagem")
    .select("uuid, tecnico_id, veiculo_nome, placa, valor_pago, timestampz")
    .eq("mecanica_id", mecanicaId)
    .eq("tecnico_id", String(usuarioId))
    .gte("timestampz", inicioISO)
    .lte("timestampz", fimISO)
    .order("timestampz", { ascending: true });

  // Bancada na tabela centralizada log_bancada
  const { data: bancadas } = await supabase
    .from("log_bancada")
    .select("uuid, usuario_id, usuario_nome, timestampz")
    .eq("mecanica_id", mecanicaId)
    .eq("usuario_id", String(usuarioId))
    .gte("timestampz", inicioISO)
    .lte("timestampz", fimISO)
    .order("timestampz", { ascending: true });

  const lista = [];

  for (const t of tunagens || []) {
    lista.push({
      tipo: "TUNAGEM",
      uuid: t.uuid,
      timestamp: new Date(t.timestampz),
      detalhe: `${t.veiculo_nome || "Veículo"} (${t.placa || "S/ Placa"}) - R$ ${t.valor_pago || 0}`
    });
  }

  for (const b of bancadas || []) {
    lista.push({
      tipo: "BANCADA",
      uuid: b.uuid,
      timestamp: new Date(b.timestampz),
      detalhe: `Craft de Bancada (ID: ${b.uuid})`
    });
  }

  lista.sort((a, b) => a.timestamp - b.timestamp);

  const qtdTunagens = tunagens?.length || 0;
  const qtdBancada = bancadas?.length || 0;
  const totalAtividades = qtdTunagens + qtdBancada;
  const ultima = lista.length > 0 ? lista[lista.length - 1] : null;

  return { qtdTunagens, qtdBancada, totalAtividades, ultimaAtividade: ultima };
}

async function processarCicloMecanica(mecanicaId, canalPonto, dataInicioStr, dataFimStr) {
  const { data: rawLogs, error } = await supabase
    .from("discord_log_messages")
    .select("id, content, created_at, channel_id")
    .eq("log_type", "ponto")
    .eq("channel_id", canalPonto)
    .gte("created_at", new Date(dataInicioStr).toISOString())
    .lte("created_at", new Date(dataFimStr).toISOString())
    .order("created_at", { ascending: true });

  if (error || !rawLogs) return [];

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

  const sessoesFinais = [];

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
          const atividades = await buscarAtividades(mecanicaId, usuarioId, sessaoAberta.entrada, evSaida.timestamp);
          
          let saidaFinal = evSaida.timestamp;
          let tipoFechamento = "NORMAL";
          let uuidSaida = evSaida.uuid;
          let obs = "Turno encerrado via Discord (renovado em duplo clique).";

          if (atividades.totalAtividades === 0) {
            const diffMinTotal = (evSaida.timestamp - sessaoAberta.entrada) / 60000;
            if (diffMinTotal > 15) {
              saidaFinal = new Date(sessaoAberta.entrada.getTime() + 60000);
              tipoFechamento = "CRASH_SEM_ATIVIDADE";
              uuidSaida = "CRASH_SEM_ATIVIDADE";
              obs = "Sessão sem nenhuma atividade registrada até o reset. Fechado com 1 min.";
            }
          } else if (atividades.ultimaAtividade) {
            const gapMin = (evSaida.timestamp - atividades.ultimaAtividade.timestamp) / 60000;
            if (gapMin > 25) {
              saidaFinal = atividades.ultimaAtividade.timestamp;
              tipoFechamento = "CRASH_COM_ATIVIDADE";
              uuidSaida = `CRASH_${atividades.ultimaAtividade.tipo === "TUNAGEM" ? "TUN" : "BANC"}_${atividades.ultimaAtividade.uuid}`;
              obs = `Crash detectado (gap de ${Math.round(gapMin)}min). Fechado na última atividade comprovada.`;
            }
          }

          const totSeg = Math.max(0, Math.round((saidaFinal - sessaoAberta.entrada) / 1000));
          const totMin = Math.round(totSeg / 60);

          sessoesFinais.push({
            mecanica_id: mecanicaId,
            usuario_id: usuarioId,
            nome: sessaoAberta.nome,
            data: getDataCivilBrasilia(sessaoAberta.entrada),
            entrada: sessaoAberta.entrada.toISOString(),
            uuid_entrada: sessaoAberta.uuid,
            saida: saidaFinal.toISOString(),
            uuid_saida: uuidSaida,
            tipo_fechamento: tipoFechamento,
            total_minutos: totMin,
            total_segundos: totSeg,
            qtd_tunagens: atividades.qtdTunagens,
            qtd_bancada: atividades.qtdBancada,
            total_atividades: atividades.totalAtividades,
            ultima_atividade_em: atividades.ultimaAtividade?.timestamp.toISOString() || null,
            tipo_ultima_atividade: atividades.ultimaAtividade?.tipo || null,
            detalhe_ultima_atividade: atividades.ultimaAtividade?.detalhe || null,
            observacao: obs
          });

          sessaoAberta = {
            nome: evEntrada.nome,
            entrada: evEntrada.timestamp,
            uuid: evEntrada.uuid
          };
        } else {
          const totSeg = Math.max(0, Math.round(Math.abs(evSaida.timestamp - evEntrada.timestamp) / 1000));
          const totMin = Math.round(totSeg / 60);

          sessoesFinais.push({
            mecanica_id: mecanicaId,
            usuario_id: usuarioId,
            nome: evEntrada.nome,
            data: getDataCivilBrasilia(evEntrada.timestamp),
            entrada: evEntrada.timestamp.toISOString(),
            uuid_entrada: evEntrada.uuid,
            saida: evSaida.timestamp.toISOString(),
            uuid_saida: evSaida.uuid,
            tipo_fechamento: "DUPLO_CLIQUE_CANCELADO",
            total_minutos: totMin,
            total_segundos: totSeg,
            qtd_tunagens: 0,
            qtd_bancada: 0,
            total_atividades: 0,
            ultima_atividade_em: null,
            tipo_ultima_atividade: null,
            detalhe_ultima_atividade: null,
            observacao: "Entrada e saída no mesmo instante via duplo clique (cancelamento imediato)."
          });

          sessaoAberta = null;
        }

        i += 2;
        continue;
      }

      if (atual.tipo === "ENTRADA") {
        if (sessaoAberta) {
          const atividades = await buscarAtividades(mecanicaId, usuarioId, sessaoAberta.entrada, atual.timestamp);

          let saidaFinal;
          let tipoFechamento;
          let uuidSaida;
          let obs;

          if (atividades.totalAtividades > 0 && atividades.ultimaAtividade) {
            saidaFinal = atividades.ultimaAtividade.timestamp;
            tipoFechamento = "CRASH_COM_ATIVIDADE";
            uuidSaida = `CRASH_${atividades.ultimaAtividade.tipo === "TUNAGEM" ? "TUN" : "BANC"}_${atividades.ultimaAtividade.uuid}`;
            obs = "Nova entrada sem saída anterior (Crash). Fechado na última atividade exata.";
          } else {
            saidaFinal = new Date(sessaoAberta.entrada.getTime() + 60000);
            tipoFechamento = "CRASH_SEM_ATIVIDADE";
            uuidSaida = "CRASH_SEM_ATIVIDADE";
            obs = "Nova entrada sem saída anterior e sem atividades. Fechado com 1 minuto.";
          }

          const totSeg = Math.max(0, Math.round((saidaFinal - sessaoAberta.entrada) / 1000));
          const totMin = Math.round(totSeg / 60);

          sessoesFinais.push({
            mecanica_id: mecanicaId,
            usuario_id: usuarioId,
            nome: sessaoAberta.nome,
            data: getDataCivilBrasilia(sessaoAberta.entrada),
            entrada: sessaoAberta.entrada.toISOString(),
            uuid_entrada: sessaoAberta.uuid,
            saida: saidaFinal.toISOString(),
            uuid_saida: uuidSaida,
            tipo_fechamento: tipoFechamento,
            total_minutos: totMin,
            total_segundos: totSeg,
            qtd_tunagens: atividades.qtdTunagens,
            qtd_bancada: atividades.qtdBancada,
            total_atividades: atividades.totalAtividades,
            ultima_atividade_em: atividades.ultimaAtividade?.timestamp.toISOString() || null,
            tipo_ultima_atividade: atividades.ultimaAtividade?.tipo || null,
            detalhe_ultima_atividade: atividades.ultimaAtividade?.detalhe || null,
            observacao: obs
          });
        }

        sessaoAberta = {
          nome: atual.nome,
          entrada: atual.timestamp,
          uuid: atual.uuid
        };
      } else if (atual.tipo === "SAIDA") {
        if (sessaoAberta) {
          const atividades = await buscarAtividades(mecanicaId, usuarioId, sessaoAberta.entrada, atual.timestamp);
          const totSeg = Math.max(0, Math.round((atual.timestamp - sessaoAberta.entrada) / 1000));
          const totMin = Math.round(totSeg / 60);

          sessoesFinais.push({
            mecanica_id: mecanicaId,
            usuario_id: usuarioId,
            nome: sessaoAberta.nome,
            data: getDataCivilBrasilia(sessaoAberta.entrada),
            entrada: sessaoAberta.entrada.toISOString(),
            uuid_entrada: sessaoAberta.uuid,
            saida: atual.timestamp.toISOString(),
            uuid_saida: atual.uuid,
            tipo_fechamento: "NORMAL",
            total_minutos: totMin,
            total_segundos: totSeg,
            qtd_tunagens: atividades.qtdTunagens,
            qtd_bancada: atividades.qtdBancada,
            total_atividades: atividades.totalAtividades,
            ultima_atividade_em: atividades.ultimaAtividade?.timestamp.toISOString() || null,
            tipo_ultima_atividade: atividades.ultimaAtividade?.tipo || null,
            detalhe_ultima_atividade: atividades.ultimaAtividade?.detalhe || null,
            observacao: "Turno encerrado normalmente via Discord."
          });

          sessaoAberta = null;
        } else {
          let entradaResgatada = null;
          let uuidEntradaResgatada = null;
          let tipoResgate = "NORMAL";
          let obsResgate = "Turno encerrado via Discord (entrada recuperada no histórico antes do ciclo).";

          const { data: entradaBanco } = await supabase
            .from("discord_log_messages")
            .select("id, content, created_at")
            .eq("log_type", "ponto")
            .eq("channel_id", canalPonto)
            .ilike("content", `%[ID]: ${usuarioId} %`)
            .ilike("content", "%ENTROU EM SERVIÇO%")
            .lt("created_at", atual.timestamp.toISOString())
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (entradaBanco) {
            const p = parsePonto(entradaBanco.content);
            if (p && p.timestamp) {
              const diffHoras = (atual.timestamp - p.timestamp) / (1000 * 60 * 60);
              if (diffHoras > 0 && diffHoras <= 12) {
                entradaResgatada = p.timestamp;
                uuidEntradaResgatada = p.uuid;
              }
            }
          }

          if (!entradaResgatada) {
            const limitePassado = new Date(atual.timestamp.getTime() - 12 * 60 * 60 * 1000);
            const { data: tunagensPassadas } = await supabase
              .from("log_tunagem")
              .select("uuid, timestampz")
              .eq("mecanica_id", mecanicaId)
              .eq("tecnico_id", String(usuarioId))
              .gte("timestampz", limitePassado.toISOString())
              .lte("timestampz", atual.timestamp.toISOString())
              .order("timestampz", { ascending: true })
              .limit(1);

            let primeiraAtiv = null;
            if (tunagensPassadas && tunagensPassadas.length > 0) {
              primeiraAtiv = new Date(tunagensPassadas[0].timestampz);
            }

            if (primeiraAtiv) {
              entradaResgatada = primeiraAtiv;
              uuidEntradaResgatada = "RECUPERADO_ATIVIDADE";
              obsResgate = "Entrada reconstruída na 1ª atividade comprovada (log de entrada ausente no Discord).";
            } else {
              entradaResgatada = new Date(atual.timestamp.getTime() - 60000);
              uuidEntradaResgatada = `AUTO_ENTRADA_${atual.uuid}`;
              obsResgate = "Saída registrada. Entrada vinculada a 1 minuto antes (sessão mínima).";
            }
          }

          const atividades = await buscarAtividades(mecanicaId, usuarioId, entradaResgatada, atual.timestamp);
          const totSeg = Math.max(0, Math.round((atual.timestamp - entradaResgatada) / 1000));
          const totMin = Math.round(totSeg / 60);

          sessoesFinais.push({
            mecanica_id: mecanicaId,
            usuario_id: usuarioId,
            nome: atual.nome,
            data: getDataCivilBrasilia(entradaResgatada),
            entrada: entradaResgatada.toISOString(),
            uuid_entrada: uuidEntradaResgatada,
            saida: atual.timestamp.toISOString(),
            uuid_saida: atual.uuid,
            tipo_fechamento: tipoResgate,
            total_minutos: totMin,
            total_segundos: totSeg,
            qtd_tunagens: atividades.qtdTunagens,
            qtd_bancada: atividades.qtdBancada,
            total_atividades: atividades.totalAtividades,
            ultima_atividade_em: atividades.ultimaAtividade?.timestamp.toISOString() || null,
            tipo_ultima_atividade: atividades.ultimaAtividade?.tipo || null,
            detalhe_ultima_atividade: atividades.ultimaAtividade?.detalhe || null,
            observacao: obsResgate
          });
        }
      }

      i++;
    }

    if (sessaoAberta) {
      const fimCiclo = new Date(dataFimStr);
      const atividades = await buscarAtividades(mecanicaId, usuarioId, sessaoAberta.entrada, fimCiclo);

      let saidaFinal = fimCiclo;
      let uuidSaida = "REINICIO_09H";
      let tipoFechamento = "REINICIO_09H";
      let obs = "Ponto mantido aberto até o reinício do servidor (09:00).";

      if (atividades.totalAtividades === 0) {
        saidaFinal = new Date(sessaoAberta.entrada.getTime() + 60000);
        tipoFechamento = "CRASH_SEM_ATIVIDADE";
        uuidSaida = "CRASH_SEM_ATIVIDADE";
        obs = "Ponto abandonado sem atividade. Fechado com 1 minuto.";
      } else if (atividades.ultimaAtividade) {
        saidaFinal = atividades.ultimaAtividade.timestamp;
        uuidSaida = `CRASH_${atividades.ultimaAtividade.tipo === "TUNAGEM" ? "TUN" : "BANC"}_${atividades.ultimaAtividade.uuid}`;
        tipoFechamento = "CRASH_COM_ATIVIDADE";
        obs = "Ponto encerrado no reinício na última atividade registrada.";
      }

      const totSeg = Math.max(0, Math.round((saidaFinal - sessaoAberta.entrada) / 1000));
      const totMin = Math.round(totSeg / 60);

      sessoesFinais.push({
        mecanica_id: mecanicaId,
        usuario_id: usuarioId,
        nome: sessaoAberta.nome,
        data: getDataCivilBrasilia(sessaoAberta.entrada),
        entrada: sessaoAberta.entrada.toISOString(),
        uuid_entrada: sessaoAberta.uuid,
        saida: saidaFinal.toISOString(),
        uuid_saida: uuidSaida,
        tipo_fechamento: tipoFechamento,
        total_minutos: totMin,
        total_segundos: totSeg,
        qtd_tunagens: atividades.qtdTunagens,
        qtd_bancada: atividades.qtdBancada,
        total_atividades: atividades.totalAtividades,
        ultima_atividade_em: atividades.ultimaAtividade?.timestamp.toISOString() || null,
        tipo_ultima_atividade: atividades.ultimaAtividade?.tipo || null,
        detalhe_ultima_atividade: atividades.ultimaAtividade?.detalhe || null,
        observacao: obs
      });
    }
  }

  return sessoesFinais;
}

async function alimentarLogPonto(diasRetroativos = 30) {
  console.log(`\n⏱️ [4/4] Alimentando tabela log_ponto (Últimos ${diasRetroativos} dias para TODAS as 4 oficinas)...`);
  await supabase.from("log_ponto").delete().gte("id", 0);

  const dataInicial = new Date(Date.now() - diasRetroativos * 24 * 60 * 60 * 1000);
  const dataInicial09h = new Date(`${dataInicial.toISOString().split("T")[0]}T09:00:00-03:00`);

  const dias = [];
  for (let i = 0; i <= diasRetroativos; i++) {
    const d = new Date(dataInicial09h.getTime() + i * 24 * 60 * 60 * 1000);
    dias.push(d.toISOString().split("T")[0]);
  }

  let totalGeralSessoes = 0;

  for (const mec of MECANICAS) {
    console.log(`\nProcessando ${mec.nome} (${mec.key})...`);
    let sessoesMec = 0;

    for (let d = 0; d < dias.length - 1; d++) {
      const diaInicio = dias[d];
      const diaFim = dias[d + 1];
      const inicioStr = `${diaInicio}T09:00:00-03:00`;
      const fimStr = `${diaFim}T09:00:00-03:00`;

      const sessoes = await processarCicloMecanica(mec.key, mec.canalPonto, inicioStr, fimStr);
      if (sessoes.length > 0) {
        await supabase.from("log_ponto").insert(sessoes);
        sessoesMec += sessoes.length;
        process.stdout.write(`Ciclo ${diaInicio} -> ${diaFim}: +${sessoes.length} sessões.\r`);
      }
    }

    console.log(`\n✅ ${mec.nome}: ${sessoesMec} sessões gravadas em log_ponto.`);
    totalGeralSessoes += sessoesMec;
  }

  console.log(`\n🎉 log_ponto populada com ${totalGeralSessoes} sessões no total de todas as mecânicas!`);
}

// ==============================================================================
// EXECUÇÃO GERAL
// ==============================================================================
async function executarCargaCompleta() {
  console.log("===================================================================");
  console.log("🚀 CARGA DAS 4 TABELAS CENTRALIZADAS DA CIDADE");
  console.log("===================================================================");

  await alimentarLogTunagem();
  await alimentarLogBancada();
  await alimentarLogBau();
  await alimentarLogPonto(30);

  console.log("\n===================================================================");
  console.log("🎉 TODAS AS 4 TABELAS CENTRALIZADAS FORAM POPULADAS COM SUCESSO!");
  console.log("===================================================================");
}

await executarCargaCompleta();
