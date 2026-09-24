import { createClient } from "@supabase/supabase-js";

const newUrl =
  process.env.NEXT_PUBLIC_NEW_SUPABASE_URL ||
  "https://sxrfkbjbyjdmyyxbzobb.supabase.co";
const newKey =
  process.env.NEXT_PUBLIC_NEW_SUPABASE_KEY ||
  "sb_publishable_et87L-NCrieyXmvteW84-w_v9cxAbjG";

const supabase = createClient(newUrl, newKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

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

// ==============================================================================
// 1. CARGA INTEGRAL DE TUNAGEM
// ==============================================================================
async function alimentarTunagem() {
  console.log("\n============================================================");
  console.log("🚗 [1/4] Processando e alimentando log_tunagem...");

  const { data: logs, error } = await supabase
    .from("discord_log_messages")
    .select("id, content, channel_id, mechanic_id, created_at")
    .eq("log_type", "tunagem")
    .order("id", { ascending: true });

  if (error) {
    console.error("Erro ao ler tunagens:", error.message);
    return;
  }

  console.log(`Total de mensagens de tunagem a processar: ${logs?.length || 0}`);
  if (!logs || logs.length === 0) return;

  const formatados = [];
  for (const t of logs) {
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

    let dt = t.created_at ? t.created_at.split("T")[0] : "2026-09-01";
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

  const batchSize = 500;
  for (let i = 0; i < formatados.length; i += batchSize) {
    const lote = formatados.slice(i, i + batchSize);
    const { error: insErr } = await supabase.from("log_tunagem").upsert(lote, { onConflict: "uuid" });
    if (insErr) console.error("Erro inserindo lote tunagem:", insErr.message);
    process.stdout.write(`   Inseridos: ${Math.min(i + batchSize, formatados.length)}/${formatados.length}...\r`);
  }
  console.log(`\n✅ log_tunagem: ${formatados.length} registros inseridos com sucesso!`);
}

// ==============================================================================
// 2. CARGA INTEGRAL DE BANCADA
// ==============================================================================
async function alimentarBancada() {
  console.log("\n============================================================");
  console.log("🛠️ [2/4] Processando e alimentando log_bancada...");

  const { count: total } = await supabase
    .from("discord_log_messages")
    .select("*", { count: "exact", head: true })
    .eq("log_type", "bancada");

  console.log(`Total de mensagens de bancada a processar: ${total || 0}`);

  const batchSize = 1000;
  let lastId = 0;
  let totalProcessado = 0;

  while (true) {
    const { data: logs, error } = await supabase
      .from("discord_log_messages")
      .select("id, content, channel_id, mechanic_id, created_at")
      .eq("log_type", "bancada")
      .gt("id", lastId)
      .order("id", { ascending: true })
      .limit(batchSize);

    if (error) {
      console.error("Erro ao ler lote de bancada:", error.message);
      break;
    }
    if (!logs || logs.length === 0) break;

    const formatados = [];
    for (const d of logs) {
      const matchId = d.content.match(/\[ID\]:\s*(\d+)\s+([^`\n\r]+)/i);
      const matchData = d.content.match(/\[DATA\]:\s*(\d{2}\/\d{2}\/\d{4})/i);
      const matchHora = d.content.match(/\[HORA\]:\s*(\d{2}:\d{2}:\d{2})/i);
      const matchItem = d.content.match(/\[ITEMNAME\]:\s*(.+)/i);
      const matchQtd = d.content.match(/\[QUANTIDADE\]:\s*(\d+)/i);
      const matchUuid = d.content.match(/\[UUID\]:\s*([a-f0-9-]{36})/i);

      let dt = d.created_at ? d.created_at.split("T")[0] : "2026-09-01";
      if (matchData) {
        const parts = matchData[1].split("/");
        dt = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }

      formatados.push({
        uuid: matchUuid ? matchUuid[1].trim() : `disc_banc_${d.id}`,
        mecanica_id: d.mechanic_id || "reds",
        usuario_id: matchId ? matchId[1].trim() : "0",
        usuario_nome: matchId ? matchId[2].trim() : "Desconhecido",
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

    const { error: insErr } = await supabase.from("log_bancada").upsert(formatados, { onConflict: "uuid" });
    if (insErr) {
      console.error("Erro inserindo lote bancada:", insErr.message);
      break;
    }

    totalProcessado += logs.length;
    lastId = logs[logs.length - 1].id;
    process.stdout.write(`   Inseridos: ${totalProcessado}/${total}...\r`);

    if (logs.length < batchSize) break;
  }
  console.log(`\n✅ log_bancada: ${totalProcessado} registros inseridos com sucesso!`);
}

// ==============================================================================
// 3. CARGA INTEGRAL DE BAÚ
// ==============================================================================
async function alimentarBau() {
  console.log("\n============================================================");
  console.log("📦 [3/4] Processando e alimentando log_bau...");

  const { count: total } = await supabase
    .from("discord_log_messages")
    .select("*", { count: "exact", head: true })
    .eq("log_type", "bau");

  console.log(`Total de mensagens de baú a processar: ${total || 0}`);

  const batchSize = 1000;
  let lastId = 0;
  let totalProcessado = 0;

  while (true) {
    const { data: logs, error } = await supabase
      .from("discord_log_messages")
      .select("id, content, channel_id, mechanic_id, created_at")
      .eq("log_type", "bau")
      .gt("id", lastId)
      .order("id", { ascending: true })
      .limit(batchSize);

    if (error) {
      console.error("Erro ao ler lote de baú:", error.message);
      break;
    }
    if (!logs || logs.length === 0) break;

    const formatados = [];
    for (const b of logs) {
      const matchId = b.content.match(/\[ID\]:\s*(\d+)\s+([^`\n\r]+)/i);
      const matchAcao = b.content.match(/(GUARDOU|RETIROU)\s+([^`\n\r]+)/i);
      const matchData = b.content.match(/\[DATA\]:\s*(\d{2}\/\d{2}\/\d{4})/i);
      const matchHora = b.content.match(/\[HORA\]:\s*(\d{2}:\d{2}:\d{2})/i);
      const matchUuid = b.content.match(/\[UUID\]:\s*([a-f0-9-]{36})/i);

      let dt = b.created_at ? b.created_at.split("T")[0] : "2026-09-01";
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

    const { error: insErr } = await supabase.from("log_bau").upsert(formatados, { onConflict: "uuid" });
    if (insErr) {
      console.error("Erro inserindo lote baú:", insErr.message);
      break;
    }

    totalProcessado += logs.length;
    lastId = logs[logs.length - 1].id;
    process.stdout.write(`   Inseridos: ${totalProcessado}/${total}...\r`);

    if (logs.length < batchSize) break;
  }
  console.log(`\n✅ log_bau: ${totalProcessado} registros inseridos com sucesso!`);
}

// ==============================================================================
// 4. CARGA INTEGRAL DE PONTO
// ==============================================================================
async function alimentarPonto() {
  console.log("\n============================================================");
  console.log("⏱️ [4/4] Processando e calculando sessões de log_ponto...");

  const { count: total } = await supabase
    .from("discord_log_messages")
    .select("*", { count: "exact", head: true })
    .eq("log_type", "ponto");

  console.log(`Total de mensagens de ponto a processar: ${total || 0}`);

  // 1. Ler todos os logs brutos de ponto
  const batchSize = 2000;
  let lastId = 0;
  const todosLogs = [];

  while (true) {
    const { data: logs, error } = await supabase
      .from("discord_log_messages")
      .select("id, content, channel_id, mechanic_id, created_at")
      .eq("log_type", "ponto")
      .gt("id", lastId)
      .order("id", { ascending: true })
      .limit(batchSize);

    if (error) {
      console.error("Erro ao ler lote de pontos:", error.message);
      break;
    }
    if (!logs || logs.length === 0) break;

    for (const r of logs) {
      const p = parsePonto(r.content);
      if (p) {
        p.id_msg = r.id;
        p.mecanica_id = r.mechanic_id || "reds";
        p.channel_id = r.channel_id;
        todosLogs.push(p);
      }
    }

    lastId = logs[logs.length - 1].id;
    process.stdout.write(`   Lidos da origem: ${todosLogs.length}/${total}...\r`);
    if (logs.length < batchSize) break;
  }

  console.log(`\n   Eventos de ponto válidos analisados: ${todosLogs.length}`);

  // 2. Agrupar por Mecânica e Usuário
  const porMecUsuario = new Map();
  for (const ev of todosLogs) {
    const chave = `${ev.mecanica_id}_${ev.id}`;
    if (!porMecUsuario.has(chave)) porMecUsuario.set(chave, []);
    porMecUsuario.get(chave).push(ev);
  }

  // 3. Montar sessões de ponto
  const todasSessoes = [];

  for (const [chave, evs] of porMecUsuario.entries()) {
    evs.sort((a, b) => a.timestamp - b.timestamp);

    const [mecanicaId, usuarioIdStr] = chave.split("_");
    const usuarioId = parseInt(usuarioIdStr, 10);

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
          const diffSeg = Math.max(0, Math.round((evSaida.timestamp.getTime() - sessaoAberta.entrada.getTime()) / 1000));
          todasSessoes.push({
            mecanica_id: mecanicaId,
            usuario_id: usuarioId,
            nome: sessaoAberta.nome,
            data: getDataCivilBrasilia(sessaoAberta.entrada),
            entrada: sessaoAberta.entrada.toISOString(),
            uuid_entrada: sessaoAberta.uuid,
            saida: evSaida.timestamp.toISOString(),
            uuid_saida: evSaida.uuid,
            tipo_fechamento: "NORMAL",
            total_minutos: Math.round(diffSeg / 60),
            total_segundos: diffSeg,
            observacao: "Turno encerrado via Discord (renovado em duplo clique)."
          });
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
          // Crash na nova entrada: fecha sessão anterior com 1 minuto caso não tenha saída
          const diffSeg = 60; // Regra 3: 1 minuto para crash sem atividade
          todasSessoes.push({
            mecanica_id: mecanicaId,
            usuario_id: usuarioId,
            nome: sessaoAberta.nome,
            data: getDataCivilBrasilia(sessaoAberta.entrada),
            entrada: sessaoAberta.entrada.toISOString(),
            uuid_entrada: sessaoAberta.uuid,
            saida: new Date(sessaoAberta.entrada.getTime() + diffSeg * 1000).toISOString(),
            uuid_saida: "CRASH_SEM_ATIVIDADE",
            tipo_fechamento: "CRASH_SEM_ATIVIDADE",
            total_minutos: 1,
            total_segundos: diffSeg,
            observacao: "Crash sem atividade. Fechado com 1 minuto."
          });
        }

        sessaoAberta = {
          nome: atual.nome,
          entrada: atual.timestamp,
          uuid: atual.uuid,
        };
      } else if (atual.tipo === "SAIDA") {
        if (sessaoAberta) {
          const diffSeg = Math.max(0, Math.round((atual.timestamp.getTime() - sessaoAberta.entrada.getTime()) / 1000));
          todasSessoes.push({
            mecanica_id: mecanicaId,
            usuario_id: usuarioId,
            nome: sessaoAberta.nome,
            data: getDataCivilBrasilia(sessaoAberta.entrada),
            entrada: sessaoAberta.entrada.toISOString(),
            uuid_entrada: sessaoAberta.uuid,
            saida: atual.timestamp.toISOString(),
            uuid_saida: atual.uuid,
            tipo_fechamento: "NORMAL",
            total_minutos: Math.round(diffSeg / 60),
            total_segundos: diffSeg,
            observacao: "Turno encerrado normalmente via Discord."
          });
          sessaoAberta = null;
        } else {
          const entradaEstimada = new Date(atual.timestamp.getTime() - 60000);
          todasSessoes.push({
            mecanica_id: mecanicaId,
            usuario_id: usuarioId,
            nome: atual.nome,
            data: getDataCivilBrasilia(entradaEstimada),
            entrada: entradaEstimada.toISOString(),
            uuid_entrada: `AUTO_${atual.uuid}`,
            saida: atual.timestamp.toISOString(),
            uuid_saida: atual.uuid,
            tipo_fechamento: "NORMAL",
            total_minutos: 1,
            total_segundos: 60,
            observacao: "Saída registrada via Discord. Entrada vinculada 1 min antes."
          });
        }
      }
      i++;
    }

    if (sessaoAberta) {
      const agora = new Date();
      const horasAberto = (agora.getTime() - sessaoAberta.entrada.getTime()) / (3600 * 1000);
      if (horasAberto < 2) {
        todasSessoes.push({
          mecanica_id: mecanicaId,
          usuario_id: usuarioId,
          nome: sessaoAberta.nome,
          data: getDataCivilBrasilia(sessaoAberta.entrada),
          entrada: sessaoAberta.entrada.toISOString(),
          uuid_entrada: sessaoAberta.uuid,
          saida: null,
          uuid_saida: null,
          tipo_fechamento: "ABERTO",
          total_minutos: 0,
          total_segundos: 0,
          observacao: "Ponto em andamento ao vivo."
        });
      } else {
        const saidaFim = new Date(sessaoAberta.entrada.getTime() + 60000);
        todasSessoes.push({
          mecanica_id: mecanicaId,
          usuario_id: usuarioId,
          nome: sessaoAberta.nome,
          data: getDataCivilBrasilia(sessaoAberta.entrada),
          entrada: sessaoAberta.entrada.toISOString(),
          uuid_entrada: sessaoAberta.uuid,
          saida: saidaFim.toISOString(),
          uuid_saida: "CRASH_AUTO",
          tipo_fechamento: "CRASH_SEM_ATIVIDADE",
          total_minutos: 1,
          total_segundos: 60,
          observacao: "Ponto esquecido sem saída registrada."
        });
      }
    }
  }

  console.log(`   Total de sessões calculadas: ${todasSessoes.length}`);

  // Inserir sessões calculadas no log_ponto
  const insertBatch = 500;
  for (let i = 0; i < todasSessoes.length; i += insertBatch) {
    const lote = todasSessoes.slice(i, i + insertBatch);
    const { error: insErr } = await supabase.from("log_ponto").upsert(lote, { onConflict: "uuid_entrada" });
    if (insErr) console.error("Erro inserindo sessões de ponto:", insErr.message);
    process.stdout.write(`   Inseridas: ${Math.min(i + insertBatch, todasSessoes.length)}/${todasSessoes.length}...\r`);
  }
  console.log(`\n✅ log_ponto: ${todasSessoes.length} sessões geradas e salvas com sucesso!`);
}

async function main() {
  console.log("============================================================");
  console.log("🚀 INICIANDO ALIMENTAÇÃO INTEGRAL DO BANCO NOVO");
  console.log(` Banco: ${newUrl}`);
  console.log("============================================================");

  const tInicio = Date.now();
  await alimentarTunagem();
  await alimentarBancada();
  await alimentarBau();
  await alimentarPonto();

  const tempoTotal = ((Date.now() - tInicio) / 1000).toFixed(1);
  console.log("\n============================================================");
  console.log(`🎉 ALIMENTAÇÃO INTEGRAL FINALIZADA EM ${tempoTotal}s!`);
  console.log("============================================================\n");
}

main();
