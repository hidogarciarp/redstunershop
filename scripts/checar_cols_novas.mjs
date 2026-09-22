import { createClient } from "@supabase/supabase-js";

const newUrl = "https://sxrfkbjbyjdmyyxbzobb.supabase.co";
const newKey = "sb_publishable_et87L-NCrieyXmvteW84-w_v9cxAbjG";
const client = createClient(newUrl, newKey);

async function checkCols() {
  const tables = ["log_ponto", "log_tunagem", "log_bancada", "log_bau"];
  for (const t of tables) {
    const { data, error } = await client.from(t).select("*").limit(0);
    console.log(`Tabela ${t}:`, error ? error.message : "Existe!");
  }
}
checkCols();
