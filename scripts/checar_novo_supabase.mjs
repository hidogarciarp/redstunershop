import { createClient } from "@supabase/supabase-js";

const newUrl = "https://sxrfkbjbyjdmyyxbzobb.supabase.co";
const newKey = "sb_publishable_et87L-NCrieyXmvteW84-w_v9cxAbjG";

const client = createClient(newUrl, newKey);

const tables = [
  "configuracoes",
  "servicos",
  "pagamentos_semanais",
  "vendas_nitro",
  "vendas_nitro_cidade",
  "vendas_drift_cidade",
  "notificacoes",
  "config_vagas",
  "candidaturas",
  "blacklist"
];

async function run() {
  console.log("=== CONTAGEM NO NOVO SUPABASE ===");
  for (const t of tables) {
    const { count, error } = await client.from(t).select("*", { count: "exact", head: true });
    console.log(t.padEnd(25), count !== null ? `${count} linhas` : `ERRO: ${error?.message}`);
  }
}

run();
