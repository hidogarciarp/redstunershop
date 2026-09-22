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

const client = createClient(oldUrl, oldKey);
const tables = [
  "configuracoes", "curso_configuracoes", "clientes", "servicos",
  "pagamentos_semanais", "vendas_nitro", "vendas_nitro_cidade",
  "vendas_drift_cidade", "notificacoes", "config_vagas",
  "candidaturas", "blacklist"
];

async function run() {
  console.log("=== CONTAGEM DE LINHAS NA ORIGEM ===");
  for (const t of tables) {
    const { count, error } = await client.from(t).select("*", { count: "exact", head: true });
    console.log(t.padEnd(25), count !== null ? `${count} linhas` : `ERRO: ${error?.message}`);
  }
}
run();
