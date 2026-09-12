import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

// ===== Carregar Variáveis de Ambiente =====
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
} catch (e) {
  console.log("Aviso ao carregar chaves do .env.local do bot, usando padrão.");
}

const supabase = createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey);

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

async function fecharTodosPontosNulos() {
  console.log("🚀 Iniciando fechamento automático de todos os pontos sem saída (saida: null)...");

  // 1. Carregar atividades de todas as fontes
  console.log("⏳ Carregando histórico de atividades (Tunagem, Bancada, Baú)...");
  
  const tunagemGeral = await buscarTodosOsRegistros("logs_tunagem", "tecnico_id, tecnico_nome, timestampz");
  console.log(`- logs_tunagem: ${tunagemGeral.length} registros`);

  const tunagemReds = await buscarTodosOsRegistros("logs_tunagem_reds", "tecnico_id, tecnico_nome, timestampz");
  console.log(`- logs_tunagem_reds: ${tunagemReds.length} registros`);

  const bancadaReds = await buscarTodosOsRegistros("log_bancada_reds", "id, nome, timestampz");
  console.log(`- log_bancada_reds: ${bancadaReds.length} registros`);

  // Indexar atividades por ID de jogo e por Nome (lowercase)
  const mapaAtividades = {};
  function registrarAtividade(id, nome, tsStr) {
    if (!tsStr) return;
    const ts = new Date(tsStr).getTime();
    if (isNaN(ts)) return;

    if (id) {
      const kId = String(id).trim();
      if (!mapaAtividades[kId]) mapaAtividades[kId] = [];
      mapaAtividades[kId].push(ts);
    }
    if (nome) {
      const kNome = nome.toLowerCase().trim();
      if (!mapaAtividades[kNome]) mapaAtividades[kNome] = [];
      mapaAtividades[kNome].push(ts);
      const partes = kNome.split(/\s+/).filter(Boolean);
      if (partes.length > 1) {
        const primeiroNome = partes[0];
        if (primeiroNome.length >= 3) {
          if (!mapaAtividades[primeiroNome]) mapaAtividades[primeiroNome] = [];
          mapaAtividades[primeiroNome].push(ts);
        }
      }
    }
  }

  tunagemGeral.forEach(t => registrarAtividade(t.tecnico_id, t.tecnico_nome, t.timestampz));
  tunagemReds.forEach(t => registrarAtividade(t.tecnico_id, t.tecnico_nome, t.timestampz));
  bancadaReds.forEach(b => registrarAtividade(b.id, b.nome, b.timestampz));

  // Ordenar timestamps de cada mecânico
  for (const k of Object.keys(mapaAtividades)) {
    mapaAtividades[k].sort((a, b) => a - b);
  }

  // 2. Buscar todos os pontos com saida IS NULL em pontos_reds
  console.log("\n⏳ Buscando pontos com saida: null na tabela pontos_reds...");
  const pontosNulos = await buscarTodosOsRegistros(
    "pontos_reds",
    "uuid_entrada, uuid_saida, entrada, saida, tempo, id, nome",
    (q) => q.is("saida", null).order("entrada", { ascending: true })
  );

  console.log(`Total de pontos sem saída encontrados em pontos_reds: ${pontosNulos.length}`);
  if (pontosNulos.length === 0) {
    console.log("✅ Nenhum ponto com saida: null encontrado em pontos_reds!");
  } else {
    // Agrupar todos os pontos por mecânico para respeitar o limite até a próxima entrada
    const pontosPorId = {};
    pontosNulos.forEach(p => {
      const k = String(p.id).trim();
      if (!pontosPorId[k]) pontosPorId[k] = [];
      pontosPorId[k].push(p);
    });

    let comAtividadeCount = 0;
    let semAtividadeCount = 0;
    const pontosParaAtualizar = [];

    for (const [idJogo, lista] of Object.entries(pontosPorId)) {
      for (let i = 0; i < lista.length; i++) {
        const p = lista[i];
        const entTs = new Date(p.entrada).getTime();
        
        // Limite máximo de busca: 12 horas ou o horário da próxima entrada do mesmo mecânico
        let limiteTs = entTs + 12 * 3600000;
        if (i + 1 < lista.length) {
          const proxEntTs = new Date(lista[i + 1].entrada).getTime();
          if (proxEntTs > entTs && proxEntTs < limiteTs) {
            limiteTs = proxEntTs;
          }
        }

        const idKey = String(p.id).trim();
        const nomeKey = (p.nome || "").toLowerCase().trim();
        const ativs = [
          ...(mapaAtividades[idKey] || []),
          ...(mapaAtividades[nomeKey] || [])
        ];
        const ativsUnicas = Array.from(new Set(ativs)).sort((a, b) => a - b);
        const ativsValidas = ativsUnicas.filter(ts => ts >= entTs && ts <= limiteTs);

        if (ativsValidas.length > 0) {
          const ultAtivTs = ativsValidas[ativsValidas.length - 1];
          const diffMin = Math.max(0, Math.round((ultAtivTs - entTs) / 60000));
          const novaSaida = new Date(ultAtivTs).toISOString();
          
          pontosParaAtualizar.push({
            uuid_entrada: p.uuid_entrada,
            id: p.id,
            entrada: p.entrada,
            saida: novaSaida,
            tempo: diffMin
          });
          comAtividadeCount++;
        } else {
          // Sem atividades registradas: saída igual à entrada, 0 minutos
          pontosParaAtualizar.push({
            uuid_entrada: p.uuid_entrada,
            id: p.id,
            entrada: p.entrada,
            saida: p.entrada,
            tempo: 0
          });
          semAtividadeCount++;
        }
      }
    }

    console.log(`\n📊 Diagnóstico de conciliação:`);
    console.log(`- Pontos com atividade encontrada: ${comAtividadeCount}`);
    console.log(`- Pontos sem atividade (saida = entrada): ${semAtividadeCount}`);

    console.log(`\n⏳ Aplicando atualizações na tabela pontos_reds...`);
    for (let i = 0; i < pontosParaAtualizar.length; i += 50) {
      const lote = pontosParaAtualizar.slice(i, i + 50);
      await Promise.all(
        lote.map(async (item) => {
          let updateQuery = supabase
            .from("pontos_reds")
            .update({
              saida: item.saida,
              tempo: item.tempo
            });
          
          if (item.uuid_entrada) {
            updateQuery = updateQuery.eq("uuid_entrada", item.uuid_entrada);
          } else {
            updateQuery = updateQuery.eq("id", item.id).eq("entrada", item.entrada);
          }
          
          const { error: errUp } = await updateQuery;
          if (errUp) {
            console.error(`Erro ao atualizar ponto ${item.uuid_entrada || item.id}:`, errUp.message);
          }
        })
      );
      process.stdout.write(`Progresso pontos_reds: ${Math.min(i + 50, pontosParaAtualizar.length)} / ${pontosParaAtualizar.length}\r`);
    }
    console.log("\n✅ Atualização de pontos_reds concluída!");
  }

  // 3. Atualizar também sessoes_ponto_auditoria_reds
  console.log("\n⏳ Buscando e fechando registros em sessoes_ponto_auditoria_reds...");
  const auditoriaNulos = await buscarTodosOsRegistros(
    "sessoes_ponto_auditoria_reds",
    "id, uuid_sessao, id_jogo, nome, entrada, saida, duracao_min",
    (q) => q.is("saida", null)
  );
  console.log(`Total de sessões sem saída em sessoes_ponto_auditoria_reds: ${auditoriaNulos.length}`);

  if (auditoriaNulos.length > 0) {
    for (let i = 0; i < auditoriaNulos.length; i += 50) {
      const lote = auditoriaNulos.slice(i, i + 50);
      await Promise.all(
        lote.map(async (aud) => {
          const entTs = new Date(aud.entrada).getTime();
          const idKey = String(aud.id_jogo).trim();
          const nomeKey = (aud.nome || "").toLowerCase().trim();
          const ativs = [
            ...(mapaAtividades[idKey] || []),
            ...(mapaAtividades[nomeKey] || [])
          ];
          const ativsUnicas = Array.from(new Set(ativs)).sort((a, b) => a - b);
          const ativsValidas = ativsUnicas.filter(ts => ts >= entTs && ts <= entTs + 12 * 3600000);

          let novaSaida = aud.entrada;
          let durMin = 0;
          let motivo = "Fechado automaticamente (sem atividades registradas)";

          if (ativsValidas.length > 0) {
            const ultAtivTs = ativsValidas[ativsValidas.length - 1];
            novaSaida = new Date(ultAtivTs).toISOString();
            durMin = Math.max(0, Math.round((ultAtivTs - entTs) / 60000));
            motivo = `Fechado automaticamente por última atividade (${ativsValidas.length} ações)`;
          }

          const { error: errAudUp } = await supabase
            .from("sessoes_ponto_auditoria_reds")
            .update({
              saida: novaSaida,
              duracao_min: durMin,
              status_ponto: "normal",
              motivo_crash: motivo
            })
            .eq("id", aud.id);

          if (errAudUp) {
            console.error(`Erro ao atualizar auditoria ${aud.id}:`, errAudUp.message);
          }
        })
      );
      process.stdout.write(`Progresso auditoria: ${Math.min(i + 50, auditoriaNulos.length)} / ${auditoriaNulos.length}\r`);
    }
    console.log("\n✅ Atualização de sessoes_ponto_auditoria_reds concluída!");
  }

  console.log("\n🎉 Processo de fechamento de pontos nulos concluído com sucesso!");
}

fecharTodosPontosNulos().catch(err => {
  console.error("Erro fatal:", err);
});
