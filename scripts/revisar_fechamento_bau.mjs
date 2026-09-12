import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

const CONFIG = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || "https://prperurjtvayjrazdxvh.supabase.co",
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
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
  if (!CONFIG.supabaseKey && fs.existsSync(".env.local")) {
    const content = fs.readFileSync(".env.local", "utf8");
    const anonMatch = content.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY\s*=\s*(.+)/);
    if (anonMatch) CONFIG.supabaseKey = anonMatch[1].trim();
  }
} catch (e) {
  console.log("Aviso ao carregar chaves:", e.message);
}

const supabase = createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey);

async function buscarTodosOsRegistros(tabela, selectStr, filterCallback) {
  let todos = [];
  let page = 0;
  const pageSize = 1000;
  while (true) {
    let query = supabase.from(tabela).select(selectStr).range(page * pageSize, (page + 1) * pageSize - 1);
    if (filterCallback) query = filterCallback(query);
    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) break;
    todos = todos.concat(data);
    if (data.length < pageSize) break;
    page++;
  }
  return todos;
}

async function revisarEFecharApenasTunagemBancada() {
  console.log("🚀 Iniciando revisão de pontos fechados por baú...");

  // 1. Carregar atividades APENAS de Tunagem e Bancada (SEM BAÚ)
  console.log("⏳ Carregando histórico de Tunagem e Bancada (SEM BAÚ)...");
  const [tunGeral, tunReds, bancReds] = await Promise.all([
    buscarTodosOsRegistros("logs_tunagem", "tecnico_id, tecnico_nome, veiculo_nome, placa, timestampz"),
    buscarTodosOsRegistros("logs_tunagem_reds", "tecnico_id, tecnico_nome, veiculo_nome, placa, timestampz"),
    buscarTodosOsRegistros("log_bancada_reds", "id, nome, timestampz")
  ]);
  console.log(`- Tunagens: ${tunGeral.length + tunReds.length} registros`);
  console.log(`- Bancada: ${bancReds.length} registros`);

  // Indexar atividades por ID de jogo e Nome
  const mapaAtivsPorId = {};
  const mapaAtivsPorNome = {};

  function addAtiv(id, nome, tsStr, desc) {
    if (!tsStr) return;
    const ts = new Date(tsStr).getTime();
    if (isNaN(ts)) return;
    const item = { ts, desc };

    if (id) {
      const kId = String(id).trim();
      if (!mapaAtivsPorId[kId]) mapaAtivsPorId[kId] = [];
      mapaAtivsPorId[kId].push(item);
    }
    if (nome) {
      const kNome = nome.toLowerCase().trim();
      if (!mapaAtivsPorNome[kNome]) mapaAtivsPorNome[kNome] = [];
      mapaAtivsPorNome[kNome].push(item);
    }
  }

  tunGeral.forEach(t => addAtiv(t.tecnico_id, t.tecnico_nome, t.timestampz, `🚗 Tunagem: ${t.veiculo_nome || "Veículo"}`));
  tunReds.forEach(t => addAtiv(t.tecnico_id, t.tecnico_nome, t.timestampz, `🚗 Tunagem: ${t.veiculo_nome || "Veículo"}`));
  bancReds.forEach(b => addAtiv(b.id, b.nome, b.timestampz, `🛠️ Bancada: Compra/Craft de Peças`));

  for (const k in mapaAtivsPorId) mapaAtivsPorId[k].sort((a, b) => a.ts - b.ts);
  for (const k in mapaAtivsPorNome) mapaAtivsPorNome[k].sort((a, b) => a.ts - b.ts);

  // 2. Buscar todas as sessões em sessoes_ponto_auditoria_reds cujo motivo menciona Baú
  console.log("\n⏳ Buscando sessões que foram fechadas por baú em sessoes_ponto_auditoria_reds...");
  const { data: sessoesBau, error: errBau } = await supabase
    .from("sessoes_ponto_auditoria_reds")
    .select("*")
    .ilike("motivo_crash", "%baú%");

  if (errBau) throw errBau;
  console.log(`Total de sessões encontradas com fechamento por baú: ${sessoesBau.length}`);

  let corrigidosComAtiv = 0;
  let corrigidosZerados = 0;

  for (const sessao of sessoesBau) {
    const entTs = new Date(sessao.entrada).getTime();
    const limTs = entTs + 12 * 3600000;
    const idKey = String(sessao.id_jogo || "").trim();
    const nomeKey = (sessao.nome || "").toLowerCase().trim();

    const det = sessao.detalhes_json || {};
    const detAtivs = [];
    (det.tunagens || []).forEach(t => {
      const ts = new Date(t.timestampz || t.timestamp || t.created_at).getTime();
      if (!isNaN(ts)) detAtivs.push({ ts, desc: `🚗 Tunagem: ${t.veiculo_nome || t.veiculo || "Veículo"}` });
    });
    (det.bancada || []).forEach(b => {
      const ts = new Date(b.timestampz || b.timestamp || b.created_at).getTime();
      if (!isNaN(ts)) detAtivs.push({ ts, desc: `🛠️ Bancada: ${b.item || b.nome_item || "Peças"}` });
    });

    const possiveisAtivs = [
      ...detAtivs,
      ...(mapaAtivsPorId[idKey] || []),
      ...(mapaAtivsPorNome[nomeKey] || [])
    ];

    // Deduplicar e filtrar apenas no período da sessão
    const validas = possiveisAtivs
      .filter(a => a.ts >= entTs - 60000 && a.ts <= limTs)
      .sort((a, b) => a.ts - b.ts);

    let novaSaida = sessao.entrada;
    let novoTempo = 0;
    let novoMotivo = "Miss-click / Sem atividades de trabalho (fechado na entrada)";

    if (validas.length > 0) {
      const last = validas[validas.length - 1];
      novaSaida = new Date(last.ts).toISOString();
      novoTempo = Math.max(0, Math.round((last.ts - entTs) / 60000));
      novoMotivo = `Fechado na última atividade (${last.desc})`;
      corrigidosComAtiv++;
    } else {
      corrigidosZerados++;
    }

    console.log(`👉 Atualizando [${sessao.id_jogo}] ${sessao.nome}: De: ${sessao.duracao_min}m (${sessao.motivo_crash}) -> Para: ${novoTempo}m (${novoMotivo})`);

    // Atualizar sessoes_ponto_auditoria_reds
    await supabase
      .from("sessoes_ponto_auditoria_reds")
      .update({
        saida: novaSaida,
        duracao_min: novoTempo,
        motivo_crash: novoMotivo
      })
      .eq("id", sessao.id);

    // Atualizar também na tabela pontos_reds correspondente!
    let qPontos = supabase
      .from("pontos_reds")
      .update({
        saida: novaSaida,
        tempo: novoTempo
      });

    if (sessao.uuid_sessao) {
      qPontos = qPontos.eq("uuid_entrada", sessao.uuid_sessao);
    } else {
      qPontos = qPontos.eq("id", sessao.id_jogo).eq("entrada", sessao.entrada);
    }
    const { error: errP } = await qPontos;
    if (errP) console.error(`Erro ao atualizar pontos_reds para ${sessao.nome}:`, errP.message);
  }

  console.log(`\n🎉 Concluído!`);
  console.log(`- Ajustados com atividade real de trabalho (tunagem/bancada): ${corrigidosComAtiv}`);
  console.log(`- Ajustados para 0 minutos (sem tunagem/bancada): ${corrigidosZerados}`);
}

revisarEFecharApenasTunagemBancada().catch(err => {
  console.error("Erro fatal:", err);
  process.exit(1);
});
