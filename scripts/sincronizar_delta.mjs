import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const env = fs.readFileSync(".env.local", "utf-8");
let oldUrl = "", oldKey = "";
env.split("\n").forEach((l) => {
  const line = l.trim();
  if (line.startsWith("NEXT_PUBLIC_SUPABASE_URL=")) oldUrl = line.split("=")[1].replace(/["']/g, "").trim();
  if (line.startsWith("SUPABASE_SERVICE_ROLE_KEY=")) oldKey = line.split("=")[1].replace(/["']/g, "").trim();
  if (!oldKey && line.startsWith("NEXT_PUBLIC_SUPABASE_ANON_KEY=")) oldKey = line.split("=")[1].replace(/["']/g, "").trim();
});

const newUrl = "https://sxrfkbjbyjdmyyxbzobb.supabase.co";
const newKey = "sb_publishable_et87L-NCrieyXmvteW84-w_v9cxAbjG";

const oldClient = createClient(oldUrl, oldKey);
const newClient = createClient(newUrl, newKey);

async function sync() {
  // 1. Sync usuarios
  const { data: users } = await oldClient.from("usuarios").select("*");
  const { error: errU } = await newClient.from("usuarios").upsert(users, { onConflict: "id" });
  console.log("Usuarios sincronizados:", errU ? errU.message : `${users.length} usuários.`);

  // 2. Sync novos logs de discord_log_messages
  const { data: maxRow } = await newClient.from("discord_log_messages").select("id").order("id", { ascending: false }).limit(1);
  const maxId = maxRow && maxRow[0] ? maxRow[0].id : 0;
  console.log(`Último id em discord_log_messages no destino: ${maxId}`);

  let lastId = maxId;
  let novosLogs = 0;
  while (true) {
    const { data: batch, error } = await oldClient
      .from("discord_log_messages")
      .select("*")
      .gt("id", lastId)
      .order("id", { ascending: true })
      .limit(1000);

    if (error) {
      console.error("Erro ao ler novos logs:", error.message);
      break;
    }
    if (!batch || batch.length === 0) break;

    const { error: errIns } = await newClient.from("discord_log_messages").upsert(batch, { onConflict: "id" });
    if (errIns) {
      console.error("Erro ao inserir novos logs:", errIns.message);
      break;
    }

    novosLogs += batch.length;
    lastId = batch[batch.length - 1].id;
    process.stdout.write(`Novos logs sincronizados: ${novosLogs}...\r`);
    if (batch.length < 1000) break;
  }
  console.log(`\nNovos logs em discord_log_messages sincronizados: ${novosLogs}`);
}

sync();
