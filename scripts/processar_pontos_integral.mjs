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

async function processarTodosPontos() {
  console.log("⏱️ Processando todos os 35.803 logs de ponto...");

  // Limpar tabela log_ponto para recarga limpa e perfeita
  const { error: errDel } = await supabase.from("log_ponto").delete().neq("id", 0);
  if (errDel) console.warn("Aviso ao limpar log_ponto:", errDel.message);

  const batchSize = 1000;
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
    process.stdout.write(`   Mensagens lidas: ${lastId} | Eventos válidos: ${todosLogs.length}...\r`);
    if (logs.length < batchSize) break;
  }

  console.log(`\n✅ Leitura concluída! Total de eventos de ponto válidos: ${todosLogs.length}`);

  // Agrupar por Mecânica e Usuário
  const porMecUsuario = new Map();
  for (const ev of todosLogs) {
    const chave = `${ev.mecanica_id}_${ev.id}`;
    if (!porMecUsuario.has(chave)) porMecUsuario.set(chave, []);
    porMecUsuario.get(chave).push(ev);
  }

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
          saida: sessaoAberta.entrada.toISOString(),
          uuid_saida: "EM_ANDAMENTO",
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

  console.log(`Total de sessões calculadas para inserção: ${todasSessoes.length}`);

  // Inserir em lotes de 500
  const insertBatch = 500;
  for (let i = 0; i < todasSessoes.length; i += insertBatch) {
    const lote = todasSessoes.slice(i, i + insertBatch);
    const { error: insErr } = await supabase.from("log_ponto").insert(lote);
    if (insErr) {
      console.error("Erro inserindo lote:", insErr.message);
      break;
    }
    process.stdout.write(`   Inseridas no log_ponto: ${Math.min(i + insertBatch, todasSessoes.length)}/${todasSessoes.length}...\r`);
  }

  console.log(`\n🎉 log_ponto 100% alimentado! Total: ${todasSessoes.length} sessões.`);
}

processarTodosPontos();
