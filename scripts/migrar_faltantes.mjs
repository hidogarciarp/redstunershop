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

async function migrateCurso() {
  console.log("\n📦 Migrando curso_configuracoes...");
  const { data, error } = await oldClient.from("curso_configuracoes").select("*");
  if (error) {
    console.error("Erro na leitura de curso_configuracoes:", error.message);
    return;
  }
  const { error: errInsert } = await newClient.from("curso_configuracoes").upsert(data, { onConflict: "id" });
  if (errInsert) {
    console.error("Erro na inserção de curso_configuracoes:", errInsert.message);
  } else {
    console.log(`✅ curso_configuracoes: ${data.length} registro(s) migrado(s) com sucesso!`);
  }
}

async function migrateClientes() {
  console.log("\n📦 Migrando clientes...");
  const { count: totalOrigem } = await oldClient.from("clientes").select("*", { count: "exact", head: true });
  console.log(`   Total na origem: ${totalOrigem} clientes.`);

  const batchSize = 500;
  let lastId = 0;
  let migrados = 0;

  while (true) {
    const { data: batch, error: errRead } = await oldClient
      .from("clientes")
      .select("*")
      .gt("id", lastId)
      .order("id", { ascending: true })
      .limit(batchSize);

    if (errRead) {
      console.error("Erro lendo lote de clientes:", errRead.message);
      break;
    }
    if (!batch || batch.length === 0) break;

    const { error: errInsert } = await newClient.from("clientes").upsert(batch, { onConflict: "id" });
    if (errInsert) {
      console.error("Erro inserindo lote de clientes:", errInsert.message);
      break;
    }

    migrados += batch.length;
    lastId = batch[batch.length - 1].id;
    process.stdout.write(`   Copiados: ${migrados}/${totalOrigem}...\r`);

    if (batch.length < batchSize) break;
  }
  console.log(`\n✅ clientes: ${migrados}/${totalOrigem} migrados com sucesso!`);
}

async function main() {
  await migrateCurso();
  await migrateClientes();
}

main();
