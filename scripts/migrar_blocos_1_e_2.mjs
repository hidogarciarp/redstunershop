import { createClient } from "@supabase/supabase-js";
import fs from "fs";

// Supabase de Origem (Atual)
const env = fs.readFileSync(".env.local", "utf-8");
let oldUrl = "", oldKey = "";
env.split("\n").forEach((l) => {
  const line = l.trim();
  if (line.startsWith("NEXT_PUBLIC_SUPABASE_URL=")) oldUrl = line.split("=")[1].replace(/["']/g, "").trim();
  if (line.startsWith("SUPABASE_SERVICE_ROLE_KEY=")) oldKey = line.split("=")[1].replace(/["']/g, "").trim();
  if (!oldKey && line.startsWith("NEXT_PUBLIC_SUPABASE_ANON_KEY=")) oldKey = line.split("=")[1].replace(/["']/g, "").trim();
});

// Supabase de Destino (Novo)
const newUrl = process.env.NEW_SUPABASE_URL || "https://sxrfkbjbyjdmyyxbzobb.supabase.co";
const newKey = process.env.NEW_SUPABASE_KEY || "sb_publishable_et87L-NCrieyXmvteW84-w_v9cxAbjG";

const oldClient = createClient(oldUrl, oldKey);
const newClient = createClient(newUrl, newKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const tablesToMigrate = [
  // Bloco 1: Sistema / Operação
  { name: "configuracoes", pk: "id", isNumericPk: true },
  { name: "curso_configuracoes", pk: "id", isNumericPk: true },
  { name: "clientes", pk: "id", isNumericPk: true },
  { name: "servicos", pk: "id", isNumericPk: true },
  { name: "pagamentos_semanais", pk: "id", isNumericPk: true },
  { name: "vendas_nitro", pk: "id", isNumericPk: false },
  { name: "vendas_nitro_cidade", pk: "id", isNumericPk: false },
  { name: "vendas_drift_cidade", pk: "id", isNumericPk: false },
  { name: "notificacoes", pk: "id", isNumericPk: true },
  
  // Bloco 2: RH / Recrutamento
  { name: "config_vagas", pk: "area_id", isNumericPk: false },
  { name: "candidaturas", pk: "id", isNumericPk: false },
  { name: "blacklist", pk: "id", isNumericPk: true },
];

async function migrateTable(tableConfig) {
  const { name, pk, isNumericPk } = tableConfig;
  console.log(`\n------------------------------------------------------------`);
  console.log(`📦 Migrando tabela: ${name}`);

  // 1. Contar registros na origem
  const { count: totalOrigem, error: errCount } = await oldClient
    .from(name)
    .select("*", { count: "exact", head: true });

  if (errCount) {
    console.error(`❌ Erro ao contar registros de ${name}:`, errCount.message);
    return false;
  }

  console.log(`   Total na origem: ${totalOrigem} registros.`);

  if (totalOrigem === 0) {
    console.log(`   Tabela vazia na origem, nada para copiar.`);
    return true;
  }

  // 2. Testar se a tabela existe no destino
  const { error: errTest } = await newClient.from(name).select(pk).limit(1);
  if (errTest) {
    console.error(`❌ Erro ao acessar ${name} no novo Supabase:`, errTest.message);
    console.error(`   Certifique-se de executar o script SQL no SQL Editor do novo Supabase!`);
    return false;
  }

  // 3. Ler e transferir em lotes
  const batchSize = 1000;
  let offset = 0;
  let migrados = 0;

  if (isNumericPk) {
    let lastId = 0;
    while (true) {
      const { data: batch, error: errRead } = await oldClient
        .from(name)
        .select("*")
        .gt(pk, lastId)
        .order(pk, { ascending: true })
        .limit(batchSize);

      if (errRead) {
        console.error(`   Erro na leitura do lote:`, errRead.message);
        return false;
      }
      if (!batch || batch.length === 0) break;

      const { error: errInsert } = await newClient.from(name).upsert(batch, { onConflict: pk });
      if (errInsert) {
        console.error(`   Erro ao inserir no destino:`, errInsert.message);
        return false;
      }

      migrados += batch.length;
      lastId = batch[batch.length - 1][pk];
      process.stdout.write(`   Copiados: ${migrados}/${totalOrigem}...\r`);

      if (batch.length < batchSize) break;
    }
  } else {
    // Para PK texto, usamos range pagination
    while (true) {
      const { data: batch, error: errRead } = await oldClient
        .from(name)
        .select("*")
        .range(offset, offset + batchSize - 1);

      if (errRead) {
        console.error(`   Erro na leitura do lote:`, errRead.message);
        return false;
      }
      if (!batch || batch.length === 0) break;

      const { error: errInsert } = await newClient.from(name).upsert(batch, { onConflict: pk });
      if (errInsert) {
        console.error(`   Erro ao inserir no destino:`, errInsert.message);
        return false;
      }

      migrados += batch.length;
      offset += batch.length;
      process.stdout.write(`   Copiados: ${migrados}/${totalOrigem}...\r`);

      if (batch.length < batchSize) break;
    }
  }

  console.log(`\n   ✅ Concluído: ${migrados}/${totalOrigem} registros copiados com sucesso.`);
  return true;
}

async function main() {
  console.log("============================================================");
  console.log("🚀 MIGRAÇÃO BLOCO 1 & BLOCO 2 PARA O NOVO SUPABASE");
  console.log(` Origem:  ${oldUrl}`);
  console.log(` Destino: ${newUrl}`);
  console.log("============================================================");

  let sucessos = 0;
  let falhas = 0;

  for (const tableConfig of tablesToMigrate) {
    const ok = await migrateTable(tableConfig);
    if (ok) sucessos++;
    else falhas++;
  }

  console.log("\n============================================================");
  console.log(`RESUMO DA MIGRAÇÃO:`);
  console.log(`Tabelas com sucesso: ${sucessos}/${tablesToMigrate.length}`);
  if (falhas > 0) {
    console.log(`Tabelas com falha:   ${falhas}`);
  }
  console.log("============================================================\n");
}

main();
