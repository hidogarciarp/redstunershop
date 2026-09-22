import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Erro: Credenciais do Supabase não encontradas no ambiente");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

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

async function buscarAtividades(usuarioId, inicio, fim) {
  const inicioISO = inicio.toISOString();
  const fimISO = fim.toISOString();

  const { data: tunagens } = await supabase
    .from("logs_tunagem_reds")
    .select("uuid, tecnico_id, veiculo_nome, placa, valor_pago, timestampz")
    .eq("tecnico_id", String(usuarioId))
    .gte("timestampz", inicioISO)
    .lte("timestampz", fimISO)
    .order("timestampz", { ascending: true });

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

async function processarCiclo(dataInicioStr, dataFimStr) {
  const { data: rawLogs, error } = await supabase
    .from("discord_log_messages")
    .select("id, content, created_at, channel_id")
    .eq("log_type", "ponto")
    .ilike("content", "%Reds Tunnershop%")
    .gte("created_at", new Date(dataInicioStr).toISOString())
    .lte("created_at", new Date(dataFimStr).toISOString())
    .order("created_at", { ascending: true });

  if (error) {
    console.error(`Erro ao buscar logs entre ${dataInicioStr} e ${dataFimStr}:`, error);
    return [];
  }

  const eventos = [];
  for (const r of rawLogs || []) {
    const p = parsePonto(r.content);
    if (p) {
      p.id_msg = r.id;
      eventos.push(p);
    }
  }

  const porUsuario = new Map();
  for (const ev of eventos) {
    if (!porUsuario.has(ev.id)) {
      porUsuario.set(ev.id, []);
    }
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
          // Caso 1: Já havia sessão aberta -> A SAÍDA fecha o turno anterior
          const atividades = await buscarAtividades(usuarioId, sessaoAberta.entrada, evSaida.timestamp);
          
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

          // A ENTRADA do duplo clique abre o novo turno
          sessaoAberta = {
            nome: evEntrada.nome,
            entrada: evEntrada.timestamp,
            uuid: evEntrada.uuid
          };
        } else {
          // Caso 2: Não havia sessão aberta -> O jogador deu duplo clique ao entrar e saiu na hora
          // Formam um par vinculado entre si (cancelamento imediato)
          const totSeg = Math.max(0, Math.round(Math.abs(evSaida.timestamp - evEntrada.timestamp) / 1000));
          const totMin = Math.round(totSeg / 60);

          sessoesFinais.push({
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

        sessaoAberta = {
          nome: atual.nome,
          entrada: atual.timestamp,
          uuid: atual.uuid
        };
      } else if (atual.tipo === "SAIDA") {
        if (sessaoAberta) {
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
        } else {
          // =========================================================================
          // NUNCA DESCARTAR UMA SAÍDA! Toda saída tem uma entrada vinculada!
          // =========================================================================
          let entradaResgatada = null;
          let uuidEntradaResgatada = null;
          let tipoResgate = "NORMAL";
          let obsResgate = "Turno encerrado via Discord (entrada recuperada no histórico antes do ciclo).";

          // 1. Tentar buscar no banco de dados a entrada desse mecânico antes dessa saída
          const { data: entradaBanco } = await supabase
            .from("discord_log_messages")
            .select("id, content, created_at")
            .eq("log_type", "ponto")
            .ilike("content", "%Reds Tunnershop%")
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

          // 2. Se não achou mensagem no Discord (webhook perdido), busca a 1ª atividade antes da saída
          if (!entradaResgatada) {
            const limitePassado = new Date(atual.timestamp.getTime() - 12 * 60 * 60 * 1000);
            const { data: tunagensPassadas } = await supabase
              .from("logs_tunagem_reds")
              .select("uuid, timestampz")
              .eq("tecnico_id", String(usuarioId))
              .gte("timestampz", limitePassado.toISOString())
              .lte("timestampz", atual.timestamp.toISOString())
              .order("timestampz", { ascending: true })
              .limit(1);

            const { data: bancadaPassadas } = await supabase
              .from("log_bancada_reds")
              .select("uuid, timestampz")
              .eq("id", String(usuarioId))
              .gte("timestampz", limitePassado.toISOString())
              .lte("timestampz", atual.timestamp.toISOString())
              .order("timestampz", { ascending: true })
              .limit(1);

            let primeiraAtiv = null;
            if (tunagensPassadas && tunagensPassadas.length > 0) {
              primeiraAtiv = new Date(tunagensPassadas[0].timestampz);
            }
            if (bancadaPassadas && bancadaPassadas.length > 0) {
              const dtB = new Date(bancadaPassadas[0].timestampz);
              if (!primeiraAtiv || dtB < primeiraAtiv) primeiraAtiv = dtB;
            }

            if (primeiraAtiv) {
              entradaResgatada = primeiraAtiv;
              uuidEntradaResgatada = "RECUPERADO_ATIVIDADE";
              obsResgate = "Entrada reconstruída na 1ª atividade comprovada (log de entrada do Discord ausente).";
            } else {
              // 3. Sem atividade prévia: entrou e saiu de imediato
              entradaResgatada = new Date(atual.timestamp.getTime() - 60000);
              uuidEntradaResgatada = `AUTO_ENTRADA_${atual.uuid}`;
              obsResgate = "Saída registrada. Entrada vinculada a 1 minuto antes (sessão mínima).";
            }
          }

          const atividades = await buscarAtividades(usuarioId, entradaResgatada, atual.timestamp);
          const totSeg = Math.max(0, Math.round((atual.timestamp - entradaResgatada) / 1000));
          const totMin = Math.round(totSeg / 60);

          sessoesFinais.push({
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

  return sessoesFinais;
}

async function executarDuasSemanas() {
  console.log("=============================================================");
  console.log("⚡ PROCESSANDO AS ÚLTIMAS 2 SEMANAS COMPLETAS PARA A TABELA pc_1");
  console.log("=============================================================\n");

  // 1. Limpar tabela pc_1 antes da recarga total das 2 semanas
  console.log("🧹 Limpando tabela pc_1 para carga limpa...");
  const { error: delErr } = await supabase.from("pc_1").delete().gte("id", 0);
  if (delErr) {
    console.warn("Aviso ao limpar pc_1:", delErr.message);
  }

  // Definir os ciclos diários (das 09h às 09h) desde 31/08/2026 até hoje (14/09/2026)
  // 14 ciclos diários + ciclo de hoje até o momento atual
  const dias = [
    "2026-08-31", "2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04",
    "2026-09-05", "2026-09-06", "2026-09-07", "2026-09-08", "2026-09-09",
    "2026-09-10", "2026-09-11", "2026-09-12", "2026-09-13", "2026-09-14"
  ];

  let totalGeralSessoes = 0;
  const resumoTipos = {};

  for (let d = 0; d < dias.length - 1; d++) {
    const diaInicio = dias[d];
    const diaFim = dias[d + 1];
    const inicioStr = `${diaInicio}T09:00:00-03:00`;
    const fimStr = `${diaFim}T09:00:00-03:00`;

    process.stdout.write(`Processando ciclo ${diaInicio} 09h -> ${diaFim} 09h... `);

    const sessoes = await processarCiclo(inicioStr, fimStr);
    
    if (sessoes.length > 0) {
      const { error: insErr } = await supabase.from("pc_1").insert(sessoes);
      if (insErr) {
        console.error(`\nErro ao inserir ciclo ${diaInicio}:`, insErr);
      } else {
        console.log(`✅ ${sessoes.length} sessões gravadas.`);
        totalGeralSessoes += sessoes.length;
        for (const s of sessoes) {
          resumoTipos[s.tipo_fechamento] = (resumoTipos[s.tipo_fechamento] || 0) + 1;
        }
      }
    } else {
      console.log(`⚪ 0 sessões.`);
    }
  }

  // Processar também o ciclo de hoje em andamento (14/09 09h até agora)
  const inicioHoje = `2026-09-14T09:00:00-03:00`;
  const agoraISO = new Date().toISOString();
  process.stdout.write(`Processando ciclo de HOJE (14/09 09h até agora)... `);
  const sessoesHoje = await processarCiclo(inicioHoje, agoraISO);
  if (sessoesHoje.length > 0) {
    await supabase.from("pc_1").insert(sessoesHoje);
    console.log(`✅ ${sessoesHoje.length} sessões gravadas.`);
    totalGeralSessoes += sessoesHoje.length;
    for (const s of sessoesHoje) {
      resumoTipos[s.tipo_fechamento] = (resumoTipos[s.tipo_fechamento] || 0) + 1;
    }
  } else {
    console.log(`⚪ 0 sessões.`);
  }

  console.log("\n=============================================================");
  console.log("🎉 PROCESSAMENTO DAS 2 SEMANAS CONCLUÍDO COM SUCESSO!");
  console.log(`Total geral de sessões criadas na pc_1: ${totalGeralSessoes}`);
  console.log("Distribuição geral de fechamentos:", resumoTipos);
  console.log("=============================================================\n");
}

await executarDuasSemanas();
