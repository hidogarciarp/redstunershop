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

async function main() {
  console.log("==================================================================");
  console.log("🚀 INICIANDO MIGRAÇÃO DE DADOS: discord_log_messages");
  console.log(` Origem:  ${oldUrl}`);
  console.log(` Destino: ${newUrl}`);
  console.log("==================================================================\n");

  // 1. Contar registros na origem
  const { count: totalOrigem, error: errCount } = await oldClient
    .from("discord_log_messages")
    .select("*", { count: "exact", head: true });

  if (errCount) {
    console.error("Erro ao contar registros na origem:", errCount);
    process.exit(1);
  }

  console.log(`📊 Total de registros em discord_log_messages a migrar: ${totalOrigem}\n`);

  // 2. Testar se a tabela de destino existe
  const { error: errTest } = await newClient
    .from("discord_log_messages")
    .select("id")
    .limit(1);

  if (errTest && errTest.message.includes("does not exist")) {
    console.error("❌ A tabela 'discord_log_messages' ainda não foi criada no novo Supabase!");
    console.error("Por favor, execute o script SQL no SQL Editor do novo Supabase primeiro.\n");
    process.exit(1);
  }

  // 3. Migrar em lotes de 1000 registros usando keyset pagination (muito mais rápido)
  const batchSize = 1000;
  let lastId = 0;
  let migrados = 0;
  const startTime = Date.now();

  while (true) {
    // Ler da origem usando cursor no id
    const { data: batch, error: errRead } = await oldClient
      .from("discord_log_messages")
      .select("*")
      .gt("id", lastId)
      .order("id", { ascending: true })
      .limit(batchSize);

    if (errRead) {
      console.error("\nErro ao ler lote da origem:", errRead);
      break;
    }
    if (!batch || batch.length === 0) break;

    // Inserir no destino (upsert por ID para idempotência)
    const { error: errInsert } = await newClient
      .from("discord_log_messages")
      .upsert(batch, { onConflict: "id" });

    if (errInsert) {
      console.error(`\nErro ao inserir lote no destino (após id ${lastId}):`, errInsert);
      break;
    }

    migrados += batch.length;
    lastId = batch[batch.length - 1].id;

    const progresso = ((migrados / totalOrigem) * 100).toFixed(1);
    const tempoDecorrido = ((Date.now() - startTime) / 1000).toFixed(0);
    const velocidade = Math.round(migrados / (tempoDecorrido || 1));

    process.stdout.write(
      `⏳ Progresso: ${migrados}/${totalOrigem} (${progresso}%) | ${velocidade} rows/s | ${tempoDecorrido}s decorridos...\r`
    );

    if (batch.length < batchSize) break;
  }

  console.log(`\n\n🎉 MIGRAÇÃO CONCLUÍDA COM SUCESSO!`);
  console.log(`Total de registros transferidos para o novo Supabase: ${migrados}\n`);
}

main();
