import { createClient } from "@supabase/supabase-js";
// Carregado via node --env-file=.env.local

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Erro: Credenciais do Supabase não encontradas no .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Função para parsear a mensagem do Discord
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

// Formatar data civil normal (YYYY-MM-DD) no fuso de Brasília (UTC-3)
function getDataCivilBrasilia(dateObj) {
  const d = new Date(dateObj.getTime() - 3 * 3600 * 1000);
  return d.toISOString().split("T")[0];
}

async function buscarAtividades(usuarioId, inicio, fim) {
  const inicioISO = inicio.toISOString();
  const fimISO = fim.toISOString();

  // 1. Tunagens
  const { data: tunagens } = await supabase
    .from("logs_tunagem_reds")
    .select("uuid, tecnico_id, veiculo_nome, placa, valor_pago, timestampz")
    .eq("tecnico_id", String(usuarioId))
    .gte("timestampz", inicioISO)
    .lte("timestampz", fimISO)
    .order("timestampz", { ascending: true });

  // 2. Bancada
  const { data: bancadas } = await supabase
    .from("log_bancada_reds")
    .select("uuid, id, nome, timestampz")
    .eq("id", String(usuarioId))
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

  return {
    qtdTunagens,
    qtdBancada,
    totalAtividades,
    ultimaAtividade: ultima
  };
}

async function processarCiclo(dataInicioStr, dataFimStr, isDryRun = true) {
  console.log(`\n======================================================`);
  console.log(`🚀 PROCESSANDO CICLO: ${dataInicioStr} até ${dataFimStr}`);
  console.log(`Modo: ${isDryRun ? "SIMULAÇÃO (DRY-RUN - SEM GRAVAÇÃO)" : "GRAVAÇÃO REAL NA TABELA pc_1"}`);
  console.log(`======================================================\n`);

  // Buscar logs do Discord da Reds no período
  const { data: rawLogs, error } = await supabase
    .from("discord_log_messages")
    .select("id, content, created_at, channel_id")
    .eq("log_type", "ponto")
    .ilike("content", "%Reds Tunnershop%")
    .gte("created_at", new Date(dataInicioStr).toISOString())
    .lte("created_at", new Date(dataFimStr).toISOString())
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Erro ao buscar logs do Discord:", error);
    return;
  }

  console.log(`Mensagens encontradas no Discord: ${rawLogs.length}`);

  // Parsear eventos válidos
  const eventos = [];
  for (const r of rawLogs) {
    const p = parsePonto(r.content);
    if (p) {
      p.id_msg = r.id;
      eventos.push(p);
    }
  }

  // Agrupar por usuário
  const porUsuario = new Map();
  for (const ev of eventos) {
    if (!porUsuario.has(ev.id)) {
      porUsuario.set(ev.id, []);
    }
    porUsuario.get(ev.id).push(ev);
  }

  console.log(`Mecânicos distintos com atividade de ponto: ${porUsuario.size}\n`);

  const sessoesFinais = [];

  for (const [usuarioId, evs] of porUsuario.entries()) {
    // Ordenar cronologicamente
    evs.sort((a, b) => a.timestamp - b.timestamp);

    let sessaoAberta = null;
    let i = 0;

    while (i < evs.length) {
      const atual = evs[i];
      const proximo = i + 1 < evs.length ? evs[i + 1] : null;

      // Verificar se há um DUPLO CLIQUE / BURST (< 5 segundos de diferença)
      const isBurst = proximo && Math.abs((proximo.timestamp - atual.timestamp) / 1000) <= 5;

      if (isBurst && atual.tipo !== proximo.tipo) {
        // Encontramos um par ENTRADA e SAÍDA colados no mesmo segundo!
        // Como decidido na nossa arquitetura:
        // Se havia sessão aberta: a SAÍDA consome a sessão aberta anterior, e a ENTRADA abre a próxima!
        let evSaida = atual.tipo === "SAIDA" ? atual : proximo;
        let evEntrada = atual.tipo === "ENTRADA" ? atual : proximo;

        if (sessaoAberta) {
          // 1. Fechar a sessão aberta que vinha do passado com a SAÍDA
          const atividades = await buscarAtividades(usuarioId, sessaoAberta.entrada, evSaida.timestamp);
          
          // Se a última atividade foi muito antes da saída (> 20 min) ou não houve atividade:
          let saidaFinal = evSaida.timestamp;
          let tipoFechamento = "NORMAL";
          let uuidSaida = evSaida.uuid;
          let obs = "Turno encerrado via Discord (renovado em duplo clique).";

          if (atividades.totalAtividades === 0) {
            // Estava aberto sem fazer nada
            const diffMinTotal = (evSaida.timestamp - sessaoAberta.entrada) / 60000;
            if (diffMinTotal > 15) {
              // Crash sem atividade prévia
              saidaFinal = new Date(sessaoAberta.entrada.getTime() + 60000);
              tipoFechamento = "CRASH_SEM_ATIVIDADE";
              uuidSaida = "CRASH_SEM_ATIVIDADE";
              obs = "Sessão sem nenhuma atividade registrada até o reset. Fechado com 1 min.";
            }
          } else if (atividades.ultimaAtividade) {
            const gapMin = (evSaida.timestamp - atividades.ultimaAtividade.timestamp) / 60000;
            if (gapMin > 25) {
              // Teve crash no meio do caminho! Fecha na última atividade
              saidaFinal = atividades.ultimaAtividade.timestamp;
              tipoFechamento = "CRASH_COM_ATIVIDADE";
              uuidSaida = `CRASH_${atividades.ultimaAtividade.tipo === "TUNAGEM" ? "TUN" : "BANC"}_${atividades.ultimaAtividade.uuid}`;
              obs = `Crash detectado (gap de ${Math.round(gapMin)}min). Fechado na última atividade comprovada.`;
            }
          }

          const totSeg = Math.max(0, Math.round((saidaFinal - sessaoAberta.entrada) / 1000));
          const totMin = Math.round(totSeg / 60);

          sessoesFinais.push({
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

        // 2. Agora a ENTRADA do duplo clique abre o próximo turno!
        sessaoAberta = {
          nome: evEntrada.nome,
          entrada: evEntrada.timestamp,
          uuid: evEntrada.uuid
        };

        i += 2; // Pula os dois eventos já processados
        continue;
      }

      // Evento avulso ou espaçado normal:
      if (atual.tipo === "ENTRADA") {
        if (sessaoAberta) {
          // Colisão pura (Entrada sem saída intermediária -> CRASH REAL!)
          const atividades = await buscarAtividades(usuarioId, sessaoAberta.entrada, atual.timestamp);

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

        // Abre a nova sessão
        sessaoAberta = {
          nome: atual.nome,
          entrada: atual.timestamp,
          uuid: atual.uuid
        };
      } else if (atual.tipo === "SAIDA") {
        if (sessaoAberta) {
          // Fechamento normal por saída legítima
          const atividades = await buscarAtividades(usuarioId, sessaoAberta.entrada, atual.timestamp);
          const totSeg = Math.max(0, Math.round((atual.timestamp - sessaoAberta.entrada) / 1000));
          const totMin = Math.round(totSeg / 60);

          sessoesFinais.push({
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
        }
      }

      i++;
    }

    // Se sobrou sessão aberta no final do ciclo (09:00):
    if (sessaoAberta) {
      const fimCiclo = new Date(dataFimStr);
      const atividades = await buscarAtividades(usuarioId, sessaoAberta.entrada, fimCiclo);

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

  // Estatísticas do processamento
  console.log(`\n--- RESULTADOS DO PROCESSAMENTO ---`);
  console.log(`Total de sessões de ponto formadas: ${sessoesFinais.length}`);

  const porTipo = {};
  for (const s of sessoesFinais) {
    porTipo[s.tipo_fechamento] = (porTipo[s.tipo_fechamento] || 0) + 1;
  }
  console.log("Distribuição dos fechamentos:", porTipo);

  console.log(`\n--- AMOSTRA DAS PRIMEIRAS 5 SESSÕES ---`);
  console.log(JSON.stringify(sessoesFinais.slice(0, 5), null, 2));

  // Gravar no banco se não for dry-run
  if (!isDryRun && sessoesFinais.length > 0) {
    console.log(`\nInserindo ${sessoesFinais.length} registros na tabela pc_1...`);
    const { error: insertErr } = await supabase.from("pc_1").insert(sessoesFinais);
    if (insertErr) {
      console.error("Erro ao inserir na pc_1:", insertErr);
    } else {
      console.log("✅ Inserção concluída com sucesso na tabela pc_1!");
    }
  }
}

// Executar teste para o ciclo de ontem (13/09 09:00 até 14/09 09:00)
// Em Brasília: 13/09 09:00 é 13/09 12:00 UTC
const inicio = "2026-09-13T09:00:00-03:00";
const fim = "2026-09-14T09:00:00-03:00";

const dryRun = process.argv.includes("--real") ? false : true;
await processarCiclo(inicio, fim, dryRun);
