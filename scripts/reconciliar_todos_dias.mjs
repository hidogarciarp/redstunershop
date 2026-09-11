import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

const CONFIG = {
  supabaseUrl: "https://prperurjtvayjrazdxvh.supabase.co",
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY || ""
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
} catch (e) {}

const supabase = createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey);

function extrairTimestampSeguro(rawText, createdAt) {
  if (rawText) {
    const dataMatch = rawText.match(/\[DATA\]:\s*(\d{2})\/(\d{2})\/(\d{4})(?:,?\s*\[HORA\]:|\s*,)?\s*(\d{2}:\d{2}:\d{2})/i);
    if (dataMatch) {
      try {
        const [, dia, mes, ano, horaStr] = dataMatch;
        const d = new Date(`${ano}-${mes}-${dia}T${horaStr}-03:00`);
        if (!isNaN(d.getTime())) return d.toISOString();
      } catch (e) {}
    }
  }
  if (createdAt) {
    try {
      const d = new Date(createdAt);
      if (!isNaN(d.getTime())) return d.toISOString();
    } catch (e) {}
  }
  return new Date().toISOString();
}

// Funções de parser
function parseDiscordPontoMessage(content, createdAt) {
  if (!content) return null;
  const isEntrou = content.includes("ENTROU EM SERVIÇO");
  const isSaiu = content.includes("SAIU DE SERVIÇO");
  if (!isEntrou && !isSaiu) return null;

  const regexIdNomeOficina = /\[ID\]:\s*(\d+)\s+([^(]+?)\s*\(\s*(?:ENTROU\s+EM|SAIU\s+DE)\s+SERVIÇO\s*-\s*([^)]+)\)/i;
  const match = content.match(regexIdNomeOficina);

  let idJogo = "";
  let nome = "";
  let tipo = isEntrou ? "entrada" : "saida";
  let oficina = "Red's Tunershop";

  if (match) {
    idJogo = match[1].trim();
    nome = match[2].trim();
    oficina = match[3].trim();
  } else {
    const idMatch = content.match(/\[ID\]:\s*(\d+)/i);
    if (idMatch) idJogo = idMatch[1].trim();
    const nomeMatch = content.match(/\[ID\]:\s*\d+\s+([^(]+)/i);
    if (nomeMatch) nome = nomeMatch[1].trim();
  }

  const timestamp = extrairTimestampSeguro(content, createdAt);
  const uuidMatch = content.match(/\[UUID\]:\s*([a-f0-9-]+)/i);
  const uuid = uuidMatch ? uuidMatch[1].trim() : null;

  return {
    idJogo,
    nome,
    tipo,
    timestamp,
    uuid,
    oficina
  };
}

function parseBancadaMessage(content, createdAt) {
  if (!content) return null;
  const matchId = content.match(/\[ID\]:\s*(\d+)/i);
  const matchNome = content.match(/\[NOME COMPLETO\]:\s*([^\n]+)/i);
  const matchItem = content.match(/\[ITEMNAME\]:\s*([^\n]+)/i);
  const matchQtd = content.match(/\[QUANTIDADE\]:\s*(\d+)/i);
  const matchPrice = content.match(/\[PRICE\]:\s*([^\n]+)/i);

  const timestamp = extrairTimestampSeguro(content, createdAt);
  const idJogo = matchId ? matchId[1].trim() : "";
  const nome = matchNome ? matchNome[1].trim() : "";
  const item = matchItem ? matchItem[1].trim() : "Item";
  const qtd = matchQtd ? parseInt(matchQtd[1], 10) : 1;
  const precoStr = matchPrice ? matchPrice[1].replace(/\./g, "").replace(/,/g, ".") : "0";
  const valor = parseFloat(precoStr) || 0;

  return { idJogo, nome, item, qtd, valor, timestamp };
}

function parseBauMessage(content, createdAt) {
  if (!content) return null;
  const matchIdNome = content.match(/\[ID\]:\s*(\d+)\s+([^\n]+)/i);
  const matchAcao = content.match(/\[(RETIROU|GUARDOU)\]:\s*([^\n]+)/i);

  const timestamp = extrairTimestampSeguro(content, createdAt);
  const idJogo = matchIdNome ? matchIdNome[1].trim() : "";
  const nome = matchIdNome ? matchIdNome[2].trim() : "";
  const tipoAcao = matchAcao ? matchAcao[1].toUpperCase() : "AÇÃO";
  const descItem = matchAcao ? matchAcao[2].trim() : "";

  return { idJogo, nome, acao: tipoAcao, item: descItem, timestamp };
}

async function fetchAllPaginado(tabela, filterFn) {
  let all = [];
  let page = 0;
  const pageSize = 1000;
  while (page < 40) {
    let q = supabase.from(tabela).select("*");
    q = filterFn(q);
    q = q.range(page * pageSize, (page + 1) * pageSize - 1);
    const { data, error } = await q;
    if (error) throw error;
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < pageSize) break;
    page++;
  }
  return all;
}

// Processar dia específico (das 09:00 de dtInicio até as 09:00 do dia seguinte)
async function processarDia(dtStr) {
  const dtInicio = new Date(`${dtStr}T09:00:00-03:00`);
  const dtFim = new Date(dtInicio.getTime() + 24 * 60 * 60 * 1000);
  
  const iniISO = dtInicio.toISOString();
  const fimISO = dtFim.toISOString();
  const lookbackISO = new Date(dtInicio.getTime() - 24 * 60 * 60 * 1000).toISOString();

  // Buscar logs do Discord no período
  const [logsDiscord, logsBancada, logsBau, logsTunagem] = await Promise.all([
    fetchAllPaginado("discord_log_messages", (q) =>
      q.eq("log_type", "ponto").eq("mechanic_id", "reds").gte("created_at", lookbackISO).lte("created_at", fimISO).order("id", { ascending: true })
    ),
    fetchAllPaginado("discord_log_messages", (q) =>
      q.eq("log_type", "bancada").eq("mechanic_id", "reds").gte("created_at", lookbackISO).lte("created_at", fimISO).order("id", { ascending: true })
    ),
    fetchAllPaginado("discord_log_messages", (q) =>
      q.eq("log_type", "bau").eq("mechanic_id", "reds").gte("created_at", lookbackISO).lte("created_at", fimISO).order("id", { ascending: true })
    ),
    fetchAllPaginado("logs_tunagem", (q) =>
      q.eq("mechanic_id", "reds").gte("timestampz", lookbackISO).lte("timestampz", fimISO).order("timestampz", { ascending: true })
    )
  ]);

  const pontosParsed = logsDiscord.map(m => parseDiscordPontoMessage(m.content, m.created_at)).filter(Boolean);
  const bancadaParsed = logsBancada.map(m => parseBancadaMessage(m.content, m.created_at)).filter(Boolean);
  const bauParsed = logsBau.map(m => parseBauMessage(m.content, m.created_at)).filter(Boolean);

  // Mapear eventos por mecânico
  const mecanicosMap = {};
  for (const p of pontosParsed) {
    if (!p.idJogo) continue;
    if (!mecanicosMap[p.idJogo]) {
      mecanicosMap[p.idJogo] = { idJogo: p.idJogo, nome: p.nome, pontos: [] };
    }
    mecanicosMap[p.idJogo].pontos.push(p);
  }

  const ativsPorMecanico = {};
  const registrarAtividade = (idJogo, rawTs) => {
    if (!idJogo || !rawTs) return;
    const tsMs = new Date(rawTs).getTime();
    if (isNaN(tsMs)) return;
    if (!ativsPorMecanico[idJogo]) ativsPorMecanico[idJogo] = [];
    ativsPorMecanico[idJogo].push(tsMs);
  };

  bancadaParsed.forEach(b => registrarAtividade(b.idJogo, b.timestamp));
  bauParsed.forEach(b => registrarAtividade(b.idJogo, b.timestamp));
  logsTunagem.forEach(t => {
    const rawTs = t.timestampz || (t.data && t.hora ? `${t.data}T${t.hora}-03:00` : null);
    if (rawTs) registrarAtividade(t.tecnico_id || t.mecanico_id, rawTs);
  });

  for (const id in ativsPorMecanico) {
    ativsPorMecanico[id].sort((a, b) => a - b);
  }

  // Consolidar sessões
  const sessoesConsolidadas = [];

  for (const idJogo in mecanicosMap) {
    const mec = mecanicosMap[idJogo];
    const eventos = mec.pontos.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const ativs = ativsPorMecanico[idJogo] || [];

    let pontoAtual = null;

    for (let i = 0; i < eventos.length; i++) {
      const ev = eventos[i];
      if (ev.tipo === "entrada") {
        if (pontoAtual) {
          // Fechar entrada anterior pela próxima entrada ou atividade
          const entMs = new Date(pontoAtual.entrada).getTime();
          const proxEntMs = new Date(ev.timestamp).getTime();
          const diffProxMin = Math.round((proxEntMs - entMs) / 60000);

          if (diffProxMin <= 60) {
            pontoAtual.saida = ev.timestamp;
            pontoAtual.duracaoMin = diffProxMin;
            pontoAtual.statusPonto = "reconexao";
            sessoesConsolidadas.push(pontoAtual);
          } else {
            const ativsValidas = ativs.filter(ts => ts >= entMs && ts <= proxEntMs);
            if (ativsValidas.length > 0) {
              const ult = ativsValidas[ativsValidas.length - 1];
              pontoAtual.saida = new Date(ult).toISOString();
              pontoAtual.duracaoMin = Math.max(1, Math.round((ult - entMs) / 60000));
              pontoAtual.statusPonto = "atividade";
            } else {
              pontoAtual.saida = new Date(entMs + 10 * 60000).toISOString();
              pontoAtual.duracaoMin = 10;
              pontoAtual.statusPonto = "estimado";
            }
            sessoesConsolidadas.push(pontoAtual);
          }
        }
        pontoAtual = {
          idJogo: mec.idJogo,
          nome: mec.nome,
          oficina: ev.oficina || "Red's Tunershop",
          oficinaId: "reds",
          entrada: ev.timestamp,
          uuidEntrada: ev.uuid,
          saida: null,
          uuidSaida: null,
          duracaoMin: 0,
          statusPonto: "normal"
        };
      } else if (ev.tipo === "saida") {
        if (pontoAtual) {
          pontoAtual.saida = ev.timestamp;
          pontoAtual.uuidSaida = ev.uuid;
          const entMs = new Date(pontoAtual.entrada).getTime();
          const saiMs = new Date(ev.timestamp).getTime();
          pontoAtual.duracaoMin = Math.max(0, Math.round((saiMs - entMs) / 60000));
          sessoesConsolidadas.push(pontoAtual);
          pontoAtual = null;
        }
      }
    }

    if (pontoAtual && !pontoAtual.saida) {
      const entMs = new Date(pontoAtual.entrada).getTime();
      const ativsValidas = ativs.filter(ts => ts >= entMs);
      if (ativsValidas.length > 0) {
        const ult = ativsValidas[ativsValidas.length - 1];
        pontoAtual.saida = new Date(ult).toISOString();
        pontoAtual.duracaoMin = Math.max(1, Math.round((ult - entMs) / 60000));
        pontoAtual.statusPonto = "atividade";
      } else {
        pontoAtual.saida = new Date(entMs + 10 * 60000).toISOString();
        pontoAtual.duracaoMin = 10;
        pontoAtual.statusPonto = "estimado";
      }
      sessoesConsolidadas.push(pontoAtual);
    }
  }

  // Filtrar sessões que pertencem a este ciclo (09:00 do dia até 09:00 do dia seguinte)
  const iniMs = dtInicio.getTime();
  const fimMs = dtFim.getTime();
  const sessoesDoCiclo = sessoesConsolidadas.filter(s => {
    const ent = new Date(s.entrada).getTime();
    return ent >= iniMs && ent < fimMs;
  });

  if (sessoesDoCiclo.length === 0) return 0;

  // Montar detalhes de atividades (bancada, bau, tunagens)
  const recordsToUpsert = sessoesDoCiclo.map(s => {
    const entMs = new Date(s.entrada).getTime();
    const saiMs = s.saida ? new Date(s.saida).getTime() : entMs;

    const bFunc = bancadaParsed.filter(b => b.idJogo === s.idJogo && new Date(b.timestamp).getTime() >= entMs && new Date(b.timestamp).getTime() <= saiMs);
    const bauFunc = bauParsed.filter(b => b.idJogo === s.idJogo && new Date(b.timestamp).getTime() >= entMs && new Date(b.timestamp).getTime() <= saiMs);
    const tunFunc = logsTunagem.filter(t => {
      const pId = t.tecnico_id || t.mecanico_id;
      if (String(pId) !== String(s.idJogo)) return false;
      const rawTs = t.timestampz || (t.data && t.hora ? `${t.data}T${t.hora}-03:00` : null);
      if (!rawTs) return false;
      const tMs = new Date(rawTs).getTime();
      return !isNaN(tMs) && tMs >= entMs && tMs <= saiMs;
    });

    const totalTun = tunFunc.length;
    const valorTun = tunFunc.reduce((acc, t) => acc + (parseFloat(t.valor_pago || t.valor) || 0), 0);
    const totalBan = bFunc.length;
    const valorBan = bFunc.reduce((acc, b) => acc + (b.valor || 0), 0);
    const totalBau = bauFunc.length;

    // Infrações da regra dos 30 minutos
    let infracao30min = false;
    if (s.duracaoMin > 30) {
      const temAtividade = (totalTun > 0 || totalBan > 0 || totalBau > 0);
      if (!temAtividade) {
        infracao30min = true;
      }
    }

    const uuidSessao = s.uuidSaida || s.uuidEntrada || `${s.idJogo}_${s.entrada}_${s.saida}`;

    return {
      uuid_sessao: uuidSessao,
      id_jogo: String(s.idJogo),
      nome: s.nome,
      oficina: s.oficina || "Red's Tunershop",
      oficina_id: "reds",
      entrada: s.entrada,
      saida: s.saida,
      duracao_min: s.duracaoMin,
      status_ponto: s.statusPonto,
      total_tunagens: totalTun,
      valor_tunagens: valorTun,
      total_bancada: totalBan,
      valor_bancada: valorBan,
      total_bau: totalBau,
      infracao_30min: infracao30min,
      detalhes_json: {
        bancada: bFunc,
        bau: bauFunc,
        tunagens: tunFunc
      }
    };
  });

  // Salvar no banco
  for (let i = 0; i < recordsToUpsert.length; i += 500) {
    const chunk = recordsToUpsert.slice(i, i + 500);
    const { error } = await supabase.from("sessoes_ponto_auditoria_reds").upsert(chunk, { onConflict: "uuid_sessao" });
    if (error) console.error("Erro ao inserir sessões:", error);
  }

  return recordsToUpsert.length;
}

// Executar dia a dia de 01/01/2026 até hoje
async function main() {
  console.log("🚀 Iniciando reconciliação diária de 09:00 a 09:00 (Janeiro a Setembro 2026)...");
  
  let cur = new Date("2026-01-01T12:00:00-03:00");
  const hoje = new Date("2026-09-09T12:00:00-03:00");

  let totalInserido = 0;

  while (cur <= hoje) {
    const dtStr = cur.toLocaleDateString("en-CA");
    process.stdout.write(`⏳ Processando ciclo de ${dtStr}... `);
    try {
      const qtd = await processarDia(dtStr);
      console.log(`✅ ${qtd} sessões gravadas.`);
      totalInserido += qtd;
    } catch (e) {
      console.log(`❌ Erro:`, e.message);
    }
    cur.setDate(cur.getDate() + 1);
  }

  console.log(`\n🎉 Concluído com sucesso! Total consolidado: ${totalInserido} sessões gravadas no banco de dados.`);
}

main();
