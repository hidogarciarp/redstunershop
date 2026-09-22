import { createClient } from "@supabase/supabase-js";

const url = "https://sxrfkbjbyjdmyyxbzobb.supabase.co";
const key = "sb_publishable_et87L-NCrieyXmvteW84-w_v9cxAbjG";
const c = createClient(url, key);

async function run() {
  const types = ["ponto", "tunagem", "bancada", "bau", "outros"];
  for (const t of types) {
    const { count } = await c.from("discord_log_messages").select("*", { count: "exact", head: true }).eq("log_type", t);
    console.log(`log_type = ${t}:`, count);
  }
}
run();
