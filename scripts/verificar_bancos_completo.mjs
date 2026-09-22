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

const allTables = [
  { name: "discord_log_messages", copyData: true },
  { name: "usuarios", copyData: true },
  { name: "configuracoes", copyData: true },
  { name: "curso_configuracoes", copyData: true },
  { name: "clientes", copyData: true },
  { name: "servicos", copyData: true },
  { name: "pagamentos_semanais", copyData: true },
  { name: "vendas_nitro", copyData: true },
  { name: "vendas_nitro_cidade", copyData: true },
  { name: "vendas_drift_cidade", copyData: true },
  { name: "notificacoes", copyData: true },
  { name: "config_vagas", copyData: true },
  { name: "candidaturas", copyData: true },
  { name: "blacklist", copyData: true },
  { name: "log_ponto", copyData: false },
  { name: "log_tunagem", copyData: false },
  { name: "log_bancada", copyData: false },
  { name: "log_bau", copyData: false },
];

async function run() {
  console.log("--------------------------------------------------------------------------------");
  console.log("TABELA".padEnd(25) + "ORIGEM".padEnd(15) + "DESTINO (NOVO)".padEnd(15) + "STATUS");
  console.log("--------------------------------------------------------------------------------");

  for (const t of allTables) {
    const { count: oldCount } = await oldClient.from(t.name).select("*", { count: "exact", head: true });
    const { count: newCount, error: newErr } = await newClient.from(t.name).select("*", { count: "exact", head: true });

    let status = "";
    if (newErr) {
      status = `❌ ERRO: ${newErr.message}`;
    } else if (t.copyData) {
      status = (oldCount === newCount) ? "✅ 100% IGUAL" : `⚠️ DIFERENÇA (${oldCount} vs ${newCount})`;
    } else {
      status = "✅ ESTRUTURA PRONTA (Vazia)";
    }

    console.log(
      t.name.padEnd(25) +
      String(oldCount ?? "-").padEnd(15) +
      String(newCount ?? "erro").padEnd(15) +
      status
    );
  }
  console.log("--------------------------------------------------------------------------------");
}

run();
