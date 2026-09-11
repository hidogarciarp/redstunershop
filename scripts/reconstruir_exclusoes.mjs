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
  console.log("Aviso ao carregar chaves.");
}

const supabase = createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey);

async function buscarTodosOsRegistros(tabela, colunas = "*", queryModifier = null) {
  let resultado = [];
  let de = 0;
  const limite = 1000;
  while (true) {
    let query = supabase.from(tabela).select(colunas).range(de, de + limite - 1);
    if (queryModifier) query = queryModifier(query);
    const { data, error } = await query;
    if (error) throw error;
    resultado = resultado.concat(data);
    if (data.length < limite) break;
    de += limite;
  }
  return resultado;
}

// Replicamos as funções de parser originais
function parsePontoTexto(rawText, messageUuid) {
  const registros = [];
  const lines = String(rawText || "").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const matchId = line.match(/^\[ID\]:\s*(\d+)\s+(.+?)\s*\(\s*(ENTROU EM SERVI[ÇC]O|SAIU DE SERVI[ÇC]O)\s*-[^)]+\)/i);
    if (!matchId) continue;
    let dataISO = null;
    let uuid = null;
    for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
      const l = lines[j].trim();
      if (!dataISO) {
        const mData = l.match(/^\[DATA\]:\s*(\d{2})\/(\d{2})\/(\d{4}),\s*(\d{2}:\d{2}:\d{2})/);
        if (mData) {
          const [, dd, mm, aaaa, hora] = mData;
          dataISO = `${aaaa}-${mm}-${dd}T${hora}-03:00`;
        }
      }
      if (!uuid) {
        const mUuid = l.match(/^\[UUID\]:\s*([a-f0-9-]{36})/i);
        if (mUuid) uuid = mUuid[1];
      }
      if (dataISO && uuid) break;
    }
    if (dataISO) {
      registros.push(uuid || `${messageUuid}-${i}`);
    }
  }
  return registros;
}

function parseAcaoLogUuid(rawText) {
  if (!rawText) return null;
  const lines = rawText.split('\n');
  let dataISO = null;
  lines.forEach(line => {
    const l = line.trim();
    const mData = l.match(/^\[DATA\]:\s*(\d{2})\/(\d{2})\/(\d{4}),\s*(\d{2}:\d{2}:\d{2})/);
    if (mData) {
      const [, dd, mm, aaaa, hora] = mData;
      dataISO = `${aaaa}-${mm}-${dd}T${hora}-03:00`;
    }
  });
  return dataISO ? true : false;
}

async function main() {
  console.log("Iniciando varredura retroativa para mapear registros apagados...");

  // 1. Obter UUIDs existentes nas tabelas tratadas
  console.log("Buscando UUIDs tratadas do banco...");
  const existentesPonto = new Set((await buscarTodosOsRegistros("log_ponto_reds", "uuid")).map(r => r.uuid));
  const existentesBau = new Set((await buscarTodosOsRegistros("log_bau_reds", "uuid")).map(r => r.uuid));
  const existentesBancada = new Set((await buscarTodosOsRegistros("log_bancada_reds", "uuid")).map(r => r.uuid));

  // 2. Buscar UUIDs que já estão na blacklist
  const jaExcluidos = new Set((await buscarTodosOsRegistros("logs_excluidos_reds", "uuid")).map(r => r.uuid));

  const novasExclusoes = [];

  // 3. Processar Pontos
  console.log("Verificando inconsistências de Ponto...");
  const brutosPonto = await buscarTodosOsRegistros("discord_log_events", "uuid, raw_text", (q) => q.eq("mechanic_id", "reds"));
  for (const log of brutosPonto) {
    const parsedUuids = parsePontoTexto(log.raw_text, log.uuid);
    for (const uuid of parsedUuids) {
      if (!existentesPonto.has(uuid) && !jaExcluidos.has(uuid)) {
        novasExclusoes.push({ uuid });
        jaExcluidos.add(uuid);
      }
    }
  }

  // 4. Processar Baú
  console.log("Verificando inconsistências de Baú...");
  const brutosBau = await buscarTodosOsRegistros("bau_logs", "uuid, raw_text", (q) => q.eq("mechanic_id", "reds"));
  for (const log of brutosBau) {
    const hasLog = parseAcaoLogUuid(log.raw_text);
    if (hasLog) {
      if (!existentesBau.has(log.uuid) && !jaExcluidos.has(log.uuid)) {
        novasExclusoes.push({ uuid: log.uuid });
        jaExcluidos.add(log.uuid);
      }
    }
  }

  // 5. Processar Bancada
  console.log("Verificando inconsistências de Bancada...");
  const brutosBancada = await buscarTodosOsRegistros("bancada_logs", "uuid, raw_text", (q) => q.eq("mechanic_id", "reds"));
  for (const log of brutosBancada) {
    const hasLog = parseAcaoLogUuid(log.raw_text);
    if (hasLog) {
      if (!existentesBancada.has(log.uuid) && !jaExcluidos.has(log.uuid)) {
        novasExclusoes.push({ uuid: log.uuid });
        jaExcluidos.add(log.uuid);
      }
    }
  }

  // 6. Gravar na Blacklist
  if (novasExclusoes.length > 0) {
    console.log(`Identificados ${novasExclusoes.length} UUIDs que haviam sido deletados. Salvando na tabela logs_excluidos_reds...`);
    for (let i = 0; i < novasExclusoes.length; i += 1000) {
      const lote = novasExclusoes.slice(i, i + 1000);
      const { error } = await supabase.from("logs_excluidos_reds").insert(lote);
      if (error) {
        console.error("Erro ao gravar exclusões no banco:", error);
        break;
      }
    }
    console.log("Blacklist atualizada com sucesso!");
  } else {
    console.log("Nenhuma exclusão retroativa encontrada (tudo em sincronia).");
  }
}

main();
