import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

// ===== Carregar Variáveis de Ambiente =====
const CONFIG = {
  supabaseUrl: "https://prperurjtvayjrazdxvh.supabase.co",
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "" // Service Role Key do bot para evitar bloqueios de RLS
};

try {
  const envPath = path.resolve("c:/Users/Garrido/Bot-rua2-pontos/.env.local");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf8");
    const urlMatch = content.match(/SUPABASE_URL\s*=\s*(.+)/);
    const keyMatch = content.match(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*(.+)/);
    if (urlMatch) CONFIG.supabaseUrl = urlMatch[1].trim();
    if (keyMatch) CONFIG.supabaseKey = keyMatch[1].trim();
  }
} catch (e) {
  console.log("Aviso ao carregar chaves do .env.local do bot, usando padrão.");
}

const supabase = createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey);

// ===== Parser de Argumentos CLI (--inicio YYYY-MM-DD --fim YYYY-MM-DD) =====
const args = process.argv.slice(2);
let filtroInicio = null;
let filtroFim = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--inicio" && args[i + 1]) filtroInicio = args[i + 1];
  if (args[i] === "--fim" && args[i + 1]) filtroFim = args[i + 1];
}

let janela = null;
if (filtroInicio && filtroFim) {
  // Janela das 09h da manhã do dia de início até as 09h da manhã do dia SEGUINTE ao fim
  const inicioISO = `${filtroInicio}T09:00:00-03:00`;
  const dtFim = new Date(`${filtroFim}T12:00:00-03:00`);
  dtFim.setDate(dtFim.getDate() + 1);
  const fimDiaSeguinteStr = dtFim.toLocaleDateString("en-CA");
  const fimISO = `${fimDiaSeguinteStr}T09:00:00-03:00`;

  janela = {
    inicioStr: filtroInicio,
    fimStr: filtroFim,
    inicioISO,
    fimISO,
    inicioUTC: new Date(inicioISO).toISOString(),
    fimUTC: new Date(fimISO).toISOString()
  };
  console.log(`📌 Janela das 09:00 (Restart Diário) ativa: ${inicioISO} até ${fimISO}`);
}

// ===== Função Auxiliar para Paginação (Buscar Todos os Registros do Banco) =====
async function buscarTodosOsRegistros(tabela, selectStr, filterCallback) {
  let todos = [];
  let page = 0;
  const pageSize = 1000;

  while (true) {
    let query = supabase.from(tabela).select(selectStr).range(page * pageSize, (page + 1) * pageSize - 1);
    if (filterCallback) {
      query = filterCallback(query);
    }
    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) break;
    
    todos = todos.concat(data);
    if (data.length < pageSize) break;
    page++;
  }
  return todos;
}

// ===== Funções de Parser =====

function parsePontoTexto(rawText, messageId) {
  if (!rawText) return [];
  const registros = [];
  const clean = String(rawText || "").replace(/```ini/gi, "").replace(/```/g, "");
  const lines = clean.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const matchId = line.match(/^\[ID\]:\s*(\d+)\s+(.+?)\s*\(\s*(ENTROU EM SERVI[ÇC]O|SAIU DE SERVI[ÇC]O)/i);
    if (!matchId) continue;

    const idJogo = matchId[1];
    const nomePersonagem = matchId[2].trim();
    const tipo = matchId[3].toUpperCase().includes("ENTROU") ? "entrada" : "saida";
    let dataISO = null;
    let dataParam = null;
    let horaParam = null;
    let uuid = null;

    for (let j = i; j < Math.min(i + 8, lines.length); j++) {
      const l = lines[j].trim();
      if (!dataISO) {
        const mData = l.match(/\[DATA\]:\s*(\d{2})\/(\d{2})\/(\d{4})(?:,?\s*\[HORA\]:|\s*,)?\s*(\d{2}:\d{2}:\d{2})/i);
        if (mData) {
          const [, dd, mm, aaaa, hora] = mData;
          dataISO = `${aaaa}-${mm}-${dd}T${hora}-03:00`;
          dataParam = `${aaaa}-${mm}-${dd}`;
          horaParam = hora;
        }
      }
      if (!uuid) {
        const mUuid = l.match(/\[UUID\]:\s*([a-f0-9-]{36})/i);
        if (mUuid) uuid = mUuid[1];
      }
      if (dataISO && uuid) break;
    }

    if (dataISO) {
      registros.push({
        uuid: uuid || `${messageId}-${i}`,
        id: idJogo,
        nome: nomePersonagem,
        tipo,
        data: dataParam,
        hora: horaParam,
        timestampz: dataISO
      });
    }
  }
  return registros;
}

function parseAcaoLog(rawText, logType) {
  if (!rawText) return null;
  const clean = String(rawText || "").replace(/```ini/gi, "").replace(/```/g, "");
  const lines = clean.split("\n");
  let id = null;
  let nome = "";
  let dataISO = "";
  let dataParam = "";
  let horaParam = "";

  lines.forEach(line => {
    const l = line.trim();
    if (logType === "bau") {
      const mId = l.match(/^\[ID\]:\s*(\d+)\s*(.*)/i);
      if (mId) {
        id = mId[1];
        nome = mId[2].trim();
      }
    } else if (logType === "bancada") {
      const mId = l.match(/^\[ID\]:\s*(\d+)/i);
      if (mId) id = mId[1];
      const mNome = l.match(/^\[NOME COMPLETO\]:\s*(.+)/i);
      if (mNome) nome = mNome[1].trim();
    }

    const mData = l.match(/\[DATA\]:\s*(\d{2})\/(\d{2})\/(\d{4})(?:,?\s*\[HORA\]:|\s*,)?\s*(\d{2}:\d{2}:\d{2})/i);
    if (mData) {
      const [, dd, mm, aaaa, hora] = mData;
      dataISO = `${aaaa}-${mm}-${dd}T${hora}-03:00`;
      dataParam = `${aaaa}-${mm}-${dd}`;
      horaParam = hora;
    }
  });

  if (!id || !dataISO) return null;
  return { id, nome, data: dataParam, hora: horaParam, timestampz: dataISO };
}

// ===== Processadores de Logs =====

async function processarPontos(setExcluidos, janela) {
  console.log("Iniciando processamento de pontos a partir de discord_log_messages...");
  
  if (janela) {
    console.log(`Limpando registros antigos de log_ponto_reds no período ${janela.inicioISO} a ${janela.fimISO}...`);
    await supabase.from("log_ponto_reds").delete().gte("timestampz", janela.inicioISO).lte("timestampz", janela.fimISO);
  } else {
    console.log("Limpando registros antigos de log_ponto_reds...");
    await supabase.from("log_ponto_reds").delete().neq("id", "0");
  }

  const logsBrutos = await buscarTodosOsRegistros(
    "discord_log_messages",
    "id, content, created_at",
    (q) => {
      let query = q.eq("mechanic_id", "reds").eq("log_type", "ponto");
      if (janela) {
        query = query.gte("created_at", janela.inicioUTC).lte("created_at", janela.fimUTC);
      }
      return query;
    }
  );
  console.log(`Total de mensagens brutas de pontos encontradas: ${logsBrutos.length}`);

  const novosPontos = [];
  const setProcessados = new Set();

  for (const log of logsBrutos) {
    const parsed = parsePontoTexto(log.content, log.id);
    for (const p of parsed) {
      if (setExcluidos && setExcluidos.has(p.uuid)) continue;
      if (!setProcessados.has(p.uuid)) {
        novosPontos.push({
          uuid: p.uuid,
          id: p.id,
          nome: p.nome,
          tipo: p.tipo,
          data: p.data,
          hora: p.hora,
          timestampz: p.timestampz
        });
        setProcessados.add(p.uuid);
      }
    }
  }

  if (novosPontos.length > 0) {
    console.log(`Inserindo ${novosPontos.length} registros tratados em log_ponto_reds...`);
    for (let i = 0; i < novosPontos.length; i += 1000) {
      const lote = novosPontos.slice(i, i + 1000);
      const { error: errInsert } = await supabase.from("log_ponto_reds").upsert(lote);
      if (errInsert) {
        console.error("Erro ao inserir pontos:", errInsert);
        break;
      }
    }
  } else {
    console.log("Nenhum ponto para inserir.");
  }
}

async function processarBancada(setExcluidos, janela) {
  console.log("Iniciando processamento de bancada a partir de discord_log_messages...");
  
  if (janela) {
    console.log(`Limpando registros antigos de log_bancada_reds no período ${janela.inicioISO} a ${janela.fimISO}...`);
    await supabase.from("log_bancada_reds").delete().gte("timestampz", janela.inicioISO).lte("timestampz", janela.fimISO);
  } else {
    console.log("Limpando registros antigos de log_bancada_reds...");
    await supabase.from("log_bancada_reds").delete().neq("id", "0");
  }

  const logsBrutos = await buscarTodosOsRegistros(
    "discord_log_messages",
    "id, content, created_at",
    (q) => {
      let query = q.eq("mechanic_id", "reds").eq("log_type", "bancada");
      if (janela) {
        query = query.gte("created_at", janela.inicioUTC).lte("created_at", janela.fimUTC);
      }
      return query;
    }
  );
  console.log(`Total de mensagens brutas de bancada encontradas: ${logsBrutos.length}`);

  const novosLogs = [];
  const setProcessados = new Set();

  for (const log of logsBrutos) {
    const parsed = parseAcaoLog(log.content, "bancada");
    if (parsed) {
      const uuidLog = `${log.id}`;
      if (setExcluidos && setExcluidos.has(uuidLog)) continue;
      if (setProcessados.has(uuidLog)) continue;

      novosLogs.push({
        uuid: uuidLog,
        id: parsed.id,
        nome: parsed.nome,
        data: parsed.data,
        hora: parsed.hora,
        timestampz: parsed.timestampz
      });
      setProcessados.add(uuidLog);
    }
  }

  if (novosLogs.length > 0) {
    console.log(`Inserindo ${novosLogs.length} registros corrigidos em log_bancada_reds...`);
    for (let i = 0; i < novosLogs.length; i += 1000) {
      const lote = novosLogs.slice(i, i + 1000);
      const { error: errInsert } = await supabase.from("log_bancada_reds").upsert(lote);
      if (errInsert) {
        console.error("Erro ao inserir logs de bancada:", errInsert);
        break;
      }
    }
  } else {
    console.log("Nenhum log de bancada para processar.");
  }
}

// ===== Algoritmo de Pareamento e Conciliação (pontos_reds) =====

async function conciliarPontos(janela) {
  console.log("Iniciando conciliação da tabela de sessões (pontos_reds)...");

  if (janela) {
    console.log(`Limpando registros de pontos_reds no período ${janela.inicioISO} a ${janela.fimISO}...`);
    await supabase.from("pontos_reds").delete().gte("entrada", janela.inicioISO).lte("entrada", janela.fimISO);
  } else {
    console.log("Limpando registros antigos de pontos_reds...");
    await supabase.from("pontos_reds").delete().neq("id", "0");
  }

  const eventos = await buscarTodosOsRegistros(
    "log_ponto_reds",
    "*",
    (q) => {
      let query = q.order("timestampz", { ascending: true });
      if (janela) {
        query = query.gte("timestampz", janela.inicioISO).lte("timestampz", janela.fimISO);
      }
      return query;
    }
  );

  console.log("Buscando registros de Bancada e Tunagem para auditoria de atividades...");
  const atividadesBancada = await buscarTodosOsRegistros("log_bancada_reds", "id, timestampz, hora", (q) => {
    return janela ? q.gte("timestampz", janela.inicioISO).lte("timestampz", janela.fimISO) : q;
  });
  
  const atividadesTunagem = await buscarTodosOsRegistros("logs_tunagem", "tecnico_id, timestampz, hora", (q) => {
    let query = q.eq("mechanic_id", "reds");
    if (janela) {
      query = query.gte("timestampz", janela.inicioISO).lte("timestampz", janela.fimISO);
    }
    return query;
  });

  const atividadesTunagemReds = await buscarTodosOsRegistros("logs_tunagem_reds", "tecnico_id, timestampz, hora", (q) => {
    return janela ? q.gte("timestampz", janela.inicioISO).lte("timestampz", janela.fimISO) : q;
  });

  // Agrupar atividades por colaborador (Bancada e Tunagem)
  const atividadesPorJogador = {};
  const registrarAtividade = (playerID, tsStr, tipo, horaStr) => {
    if (!playerID || !tsStr) return;
    const pKey = String(playerID);
    if (!atividadesPorJogador[pKey]) {
      atividadesPorJogador[pKey] = [];
    }
    atividadesPorJogador[pKey].push({
      timestamp: new Date(tsStr).getTime(),
      timestampz: tsStr,
      tipo,
      horaStr: horaStr || new Date(tsStr).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })
    });
  };

  atividadesBancada.forEach(a => registrarAtividade(a.id, a.timestampz, "Bancada", a.hora));
  atividadesTunagem.forEach(a => registrarAtividade(a.tecnico_id, a.timestampz, "Tunagem", a.hora));
  atividadesTunagemReds.forEach(a => registrarAtividade(a.tecnico_id, a.timestampz, "Tunagem", a.hora));

  for (const playerID of Object.keys(atividadesPorJogador)) {
    atividadesPorJogador[playerID].sort((a, b) => a.timestamp - b.timestamp);
  }

  const eventosPorJogador = {};
  for (const ev of eventos) {
    if (!eventosPorJogador[ev.id]) {
      eventosPorJogador[ev.id] = [];
    }
    eventosPorJogador[ev.id].push(ev);
  }

  const novosPontos = [];

  for (const [id, logs] of Object.entries(eventosPorJogador)) {
    // Ordenar cronologicamente garantindo que, em caso de mesmo timestamp exato, a 'saida' venha ANTES da 'entrada'
    // para fechar a sessão anterior antes de processar um eventual duplo-clique acidental de entrada
    logs.sort((a, b) => {
      const diff = new Date(a.timestampz).getTime() - new Date(b.timestampz).getTime();
      if (diff !== 0) return diff;
      if (a.tipo === "saida" && b.tipo === "entrada") return -1;
      if (a.tipo === "entrada" && b.tipo === "saida") return 1;
      return 0;
    });

    let ultimaSaidaTs = null;
    let i = 0;
    while (i < logs.length) {
      const atual = logs[i];

      if (atual.tipo === "entrada") {
        const dataEntrada = new Date(atual.timestampz);
        const tEntrada = dataEntrada.getTime();

        // Se esta entrada aconteceu no mesmo timestamp exato (ou até 5s) de uma saída que acabou de fechar a sessão anterior,
        // trata-se de um duplo clique acidental no botão de bater ponto na saída. Descartar entrada fantasma!
        if (ultimaSaidaTs && Math.abs(tEntrada - ultimaSaidaTs) <= 5000) {
          i++;
          continue;
        }

        let saidaLog = null;
        let j = i + 1;
        while (j < logs.length) {
          if (logs[j].tipo === "entrada") break;
          if (logs[j].tipo === "saida") {
            saidaLog = logs[j];
            break;
          }
          j++;
        }

        const atividadesFunc = atividadesPorJogador[String(atual.id)] || [];

        if (saidaLog) {
          const dataSaida = new Date(saidaLog.timestampz);
          const tSaida = dataSaida.getTime();
          const tempoMinutos = Math.max(0, Math.round((tSaida - tEntrada) / 60000));

          if (tempoMinutos <= 720) {
            novosPontos.push({
              uuid_entrada: atual.uuid,
              uuid_saida: saidaLog.uuid,
              entrada: atual.timestampz,
              saida: saidaLog.timestampz,
              tempo: tempoMinutos,
              id: atual.id,
              nome: atual.nome,
              observacao: tempoMinutos <= 0 ? "Miss-Click / Ponto instantâneo (≤ 10s)" : null
            });
            ultimaSaidaTs = tSaida;
            i = j + 1;
            continue;
          }
        }

        // Sem saída válida oficial:
        // Caso A: Próxima entrada em até 1 hora (reconexão rápida pós-crash)
        if (j < logs.length && logs[j].tipo === "entrada") {
          const proximaEntrada = logs[j];
          const dataProximaEntrada = new Date(proximaEntrada.timestampz);
          const diffMinutos = Math.max(0, Math.round((dataProximaEntrada - dataEntrada) / 60000));
          
          if (diffMinutos <= 60) {
            novosPontos.push({
              uuid_entrada: atual.uuid,
              uuid_saida: null,
              entrada: atual.timestampz,
              saida: proximaEntrada.timestampz,
              tempo: diffMinutos,
              id: atual.id,
              nome: atual.nome,
              observacao: "Fechado por reconexão rápida"
            });
            i++;
            continue;
          }
        }

        // Caso B: Fechar pela última atividade em Bancada ou Tunagem (até 12h após a entrada)
        const tLimite = (j < logs.length && logs[j].tipo === "entrada")
          ? Math.min(tEntrada + 12 * 3600000, new Date(logs[j].timestampz).getTime())
          : (tEntrada + 12 * 3600000);
        const ativsValidas = atividadesFunc.filter(a => a.timestamp >= tEntrada && a.timestamp <= tLimite);

        if (ativsValidas.length > 0) {
          const ultimaAtiv = ativsValidas[ativsValidas.length - 1];
          const diffMinutos = Math.max(0, Math.round((ultimaAtiv.timestamp - tEntrada) / 60000));

          novosPontos.push({
            uuid_entrada: atual.uuid,
            uuid_saida: null,
            entrada: atual.timestampz,
            saida: new Date(ultimaAtiv.timestamp).toISOString(),
            tempo: diffMinutos,
            id: atual.id,
            nome: atual.nome,
            observacao: `Saída estimada por serviço de ${ultimaAtiv.tipo} às ${ultimaAtiv.horaStr}`
          });
          i++;
          continue;
        }

        // Caso C: Ponto sem saída e sem atividade comprovada
        // Se a entrada foi há menos de 60 minutos e não há próximo evento, pode ser ponto em andamento ao vivo
        const agoraMs = Date.now();
        const isUltimoEvento = (i === logs.length - 1);
        const isRecente = (agoraMs - tEntrada) < 60 * 60 * 1000;

        if (isUltimoEvento && isRecente) {
          novosPontos.push({
            uuid_entrada: atual.uuid,
            uuid_saida: null,
            entrada: atual.timestampz,
            saida: null,
            tempo: 0,
            id: atual.id,
            nome: atual.nome,
            observacao: "Ponto em andamento ao vivo"
          });
        } else {
          // Ponto passado ou abandonado sem atividade comprovada: saída na mesma hora da entrada (0 min)
          novosPontos.push({
            uuid_entrada: atual.uuid,
            uuid_saida: null,
            entrada: atual.timestampz,
            saida: atual.timestampz,
            tempo: 0,
            id: atual.id,
            nome: atual.nome,
            observacao: "Fechado automaticamente (sem atividades registradas)"
          });
        }
        i++;
      } else {
        // Saída isolada (sem entrada correspondente)
        i++;
      }
    }
  }

  if (novosPontos.length > 0) {
    const vistos = new Set();
    const pontosFiltrados = [];
    for (const p of novosPontos) {
      if (!vistos.has(p.uuid_entrada)) {
        vistos.add(p.uuid_entrada);
        pontosFiltrados.push(p);
      }
    }

    console.log(`Inserindo/Upserting ${pontosFiltrados.length} pontos na tabela pontos_reds...`);
    for (let i = 0; i < pontosFiltrados.length; i += 1000) {
      const lote = pontosFiltrados.slice(i, i + 1000);
      
      let { error: errInsert } = await supabase.from("pontos_reds").upsert(lote);
      if (errInsert && errInsert.message?.includes("observacao")) {
        const loteSemObs = lote.map(({ observacao, ...rest }) => rest);
        const res2 = await supabase.from("pontos_reds").upsert(loteSemObs);
        errInsert = res2.error;
      }

      if (errInsert) {
        console.error("Erro ao inserir pontos conciliados:", errInsert);
        break;
      }
    }

    try {
      console.log(`Atualizando sessoes_ponto_auditoria_reds (${pontosFiltrados.length} sessões)...`);
      const auditRecords = pontosFiltrados.map((p) => {
        const isAoVivo = !p.saida && p.observacao === "Ponto em andamento ao vivo";
        return {
          uuid_sessao: p.uuid_entrada,
          id_jogo: String(p.id),
          nome: p.nome,
          oficina: "Red's Tunershop",
          oficina_id: "reds",
          entrada: p.entrada,
          saida: p.saida || (isAoVivo ? null : p.entrada),
          duracao_min: p.tempo || 0,
          status_ponto: isAoVivo ? "aberto" : "normal",
          motivo_crash: p.observacao || null
        };
      });
      for (let i = 0; i < auditRecords.length; i += 100) {
        const lote = auditRecords.slice(i, i + 100);
        await supabase.from("sessoes_ponto_auditoria_reds").upsert(lote, { onConflict: "uuid_sessao" });
      }
    } catch (eAudit) {
      console.warn("Aviso ao conciliar sessoes_ponto_auditoria_reds:", eAudit?.message);
    }
  } else {
    console.log("Nenhum ponto para inserir.");
  }
}

// ===== Execução Principal =====
async function main() {
  try {
    console.log("Buscando lista de UUIDs excluídos na tabela logs_excluidos_reds...");
    const jaExcluidos = await buscarTodosOsRegistros("logs_excluidos_reds", "uuid");
    const setExcluidos = new Set(jaExcluidos.map(p => p.uuid));
    console.log(`Total de registros na blacklist de exclusões: ${setExcluidos.size}`);

    await processarPontos(setExcluidos, janela);
    await processarBancada(setExcluidos, janela);
    await conciliarPontos(janela);
    console.log("Processamento e conciliação da Red's concluídos com sucesso!");
  } catch (e) {
    console.error("Erro na execução do script:", e);
  }
}

main();

