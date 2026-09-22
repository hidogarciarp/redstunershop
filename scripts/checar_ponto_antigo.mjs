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
  const { data: pCidade } = await c.from("ponto_cidade_reds").select("*").limit(2);
  console.log("ponto_cidade_reds sample:", pCidade);

  const { data: pSessao } = await c.from("sessoes_ponto_auditoria_reds").select("*").limit(2);
  console.log("sessoes_ponto_auditoria_reds sample:", pSessao);
}
run();
