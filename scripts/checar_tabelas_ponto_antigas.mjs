import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const env = fs.readFileSync(".env.local", "utf-8");
let oldUrl = "", oldKey = "";
env.split("\n").forEach((l) => {
  const line = l.trim();
  if (line.startsWith("NEXT_PUBLIC_SUPABASE_URL=")) oldUrl = line.split("=")[1].replace(/["']/g, "").trim();
  if (line.startsWith("SUPABASE_SERVICE_ROLE_KEY=")) oldKey = line.split("=")[1].replace(/["']/g, "").trim();
});

const c = createClient(oldUrl, oldKey);
async function run() {
  const tables = [
    "ponto_cidade_reds",
    "log_ponto_reds",
    "pontos_reds",
    "sessoes_ponto_auditoria_reds",
    "historico_ponto"
  ];
  for (const t of tables) {
    const { count, error } = await c.from(t).select("*", { count: "exact", head: true });
    console.log(t.padEnd(30), error ? error.message : `${count} rows`);
  }
}
run();
