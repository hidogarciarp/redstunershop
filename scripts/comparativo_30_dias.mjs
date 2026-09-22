import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

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

          sessaoAberta = {
            nome: evEntrada.nome,
            entrada: evEntrada.timestamp,
            uuid: evEntrada.uuid
          };
        } else {
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
          let entradaResgatada = null;
          let uuidEntradaResgatada = null;
          let tipoResgate = "NORMAL";
          let obsResgate = "Turno encerrado via Discord (entrada recuperada no histórico antes do ciclo).";

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

async function executar30DiasEComparar() {
  console.log("===================================================================");
  console.log("⚡ PROCESSANDO OS ÚLTIMOS 30 DIAS PARA A TABELA pc_1 & COMPARANDO");
  console.log("===================================================================\n");

  console.log("🧹 Limpando tabela pc_1...");
  await supabase.from("pc_1").delete().gte("id", 0);

  // Gerar datas dos últimos 30 dias (de 16/08/2026 até 15/09/2026)
  const dataInicial = new Date("2026-08-16T09:00:00-03:00");
  const dias = [];
  for (let i = 0; i <= 30; i++) {
    const d = new Date(dataInicial.getTime() + i * 24 * 60 * 60 * 1000);
    dias.push(d.toISOString().split("T")[0]);
  }

  let totalSessoesPc1 = 0;
  const distribuicao = {};

  for (let d = 0; d < dias.length - 1; d++) {
    const diaInicio = dias[d];
    const diaFim = dias[d + 1];
    const inicioStr = `${diaInicio}T09:00:00-03:00`;
    const fimStr = `${diaFim}T09:00:00-03:00`;

    process.stdout.write(`Ciclo ${diaInicio} -> ${diaFim}... `);
    const sessoes = await processarCiclo(inicioStr, fimStr);

    if (sessoes.length > 0) {
      await supabase.from("pc_1").insert(sessoes);
      console.log(`✅ ${sessoes.length} gravadas.`);
      totalSessoesPc1 += sessoes.length;
      for (const s of sessoes) {
        distribuicao[s.tipo_fechamento] = (distribuicao[s.tipo_fechamento] || 0) + 1;
      }
    } else {
      console.log(`⚪ 0.`);
    }
  }

  console.log("\n===================================================================");
  console.log("📊 INICIANDO ANÁLISE COMPARATIVA: pontos_reds vs pc_1");
  console.log("===================================================================\n");

  // 1. Buscar todos os registros dos últimos 30 dias de pontos_reds
  const inicio30dISO = "2026-08-16T12:00:00.000Z";
  const { data: legado } = await supabase
    .from("pontos_reds")
    .select("*")
    .gte("entrada", inicio30dISO);

  // 2. Buscar todos os registros de pc_1
  const { data: novo } = await supabase
    .from("pc_1")
    .select("*");

  // Estatísticas Legado
  let legadoMinutosTotais = 0;
  let legadoSessoesValidas = 0;
  let legadoSessoesAbertas = 0; // saida null ou tempo 0
  let legadoTempoAbsurdo = 0; // > 12h (720 min)
  const legadoPorMec = {};

  for (const r of legado || []) {
    const t = Number(r.tempo) || 0;
    if (!r.saida || t <= 0) {
      legadoSessoesAbertas++;
    } else {
      legadoSessoesValidas++;
      legadoMinutosTotais += t;
      if (t > 720) legadoTempoAbsurdo++;
    }

    const idMec = String(r.id);
    if (!legadoPorMec[idMec]) {
      legadoPorMec[idMec] = { nome: r.nome, minutos: 0, sessoes: 0, abertas: 0 };
    }
    legadoPorMec[idMec].sessoes++;
    if (!r.saida || t <= 0) legadoPorMec[idMec].abertas++;
    else legadoPorMec[idMec].minutos += t;
  }

  // Estatísticas pc_1
  let novoMinutosTotais = 0;
  let novoAtividadesTotais = 0;
  const novoPorMec = {};

  for (const r of novo || []) {
    novoMinutosTotais += r.total_minutos;
    novoAtividadesTotais += r.total_atividades;
    const idMec = String(r.usuario_id);
    if (!novoPorMec[idMec]) {
      novoPorMec[idMec] = { nome: r.nome, minutos: 0, sessoes: 0, atividades: 0, crashComAtiv: 0, crashSemAtiv: 0 };
    }
    novoPorMec[idMec].minutos += r.total_minutos;
    novoPorMec[idMec].sessoes++;
    novoPorMec[idMec].atividades += r.total_atividades;
    if (r.tipo_fechamento === "CRASH_COM_ATIVIDADE") novoPorMec[idMec].crashComAtiv++;
    if (r.tipo_fechamento === "CRASH_SEM_ATIVIDADE") novoPorMec[idMec].crashSemAtiv++;
  }

  console.log("--- RESUMO COMPARATIVO GLOBAL (30 DIAS) ---");
  console.log(`Tabela Legada (pontos_reds):`);
  console.log(`  - Total de Registros: ${legado?.length || 0}`);
  console.log(`  - Sessões Fechadas com Tempo: ${legadoSessoesValidas}`);
  console.log(`  - Sessões Abertas/Abandonadas (tempo 0 ou sem saída): ${legadoSessoesAbertas}`);
  console.log(`  - Sessões Anômalas (> 12 horas seguidas): ${legadoTempoAbsurdo}`);
  console.log(`  - Horas Totais Computadas: ${(legadoMinutosTotais / 60).toFixed(1)} horas\n`);

  console.log(`Nova Tabela Inteligente (pc_1):`);
  console.log(`  - Total de Sessões Formadas: ${novo?.length || 0}`);
  console.log(`  - Sessões 100% Fechadas/Auditadas: ${novo?.length || 0}`);
  console.log(`  - Sessões Abandonadas/Perdidas: 0 (ZERO)`);
  console.log(`  - Horas Totais Computadas: ${(novoMinutosTotais / 60).toFixed(1)} horas`);
  console.log(`  - Atividades Materiais Comprovadas (Tunagem + Bancada): ${novoAtividadesTotais}`);
  console.log(`  - Distribuição dos Tipos:`, distribuicao);

  console.log("\n--- COMPARATIVO DOS TOP MECÂNICOS (LEGADO vs NOVO) ---");
  const todosIds = new Set([...Object.keys(legadoPorMec), ...Object.keys(novoPorMec)]);
  const listaComparativa = [];

  for (const id of todosIds) {
    const leg = legadoPorMec[id] || { minutos: 0, sessoes: 0, abertas: 0, nome: "N/A" };
    const nov = novoPorMec[id] || { minutos: 0, sessoes: 0, atividades: 0, crashComAtiv: 0, crashSemAtiv: 0, nome: "N/A" };
    const nome = nov.nome !== "N/A" ? nov.nome : leg.nome;
    const diffHoras = ((nov.minutos - leg.minutos) / 60);

    listaComparativa.push({
      id,
      nome,
      horasLegado: (leg.minutos / 60).toFixed(1),
      sessoesLegado: leg.sessoes,
      abertasLegado: leg.abertas,
      horasNovo: (nov.minutos / 60).toFixed(1),
      sessoesNovo: nov.sessoes,
      atividades: nov.atividades,
      resgatesCrash: nov.crashComAtiv,
      farmCortado: nov.crashSemAtiv,
      diffHoras: diffHoras.toFixed(1)
    });
  }

  listaComparativa.sort((a, b) => parseFloat(b.horasNovo) - parseFloat(a.horasNovo));

  console.table(listaComparativa.slice(0, 15));
}

await executar30DiasEComparar();
