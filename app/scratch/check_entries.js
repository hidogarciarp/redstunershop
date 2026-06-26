import { createClient } from "@supabase/supabase-js";
import fs from "fs";

// Parse .env.local manually
const envFile = fs.readFileSync(".env.local", "utf8");
const env = {};
envFile.split("\n").forEach(line => {
  const match = line.match(/^\s*([^#=]+)\s*=\s*(.*)$/);
  if (match) {
    const key = match[1].trim();
    let val = match[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    env[key] = val;
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const ids = ["1085", "2099", "4414", "2341", "171", "1114", "1314", "1813", "2711", "5082", "1086", "392", "291", "5003", "962", "3969"];
  
  const { data: r1 } = await supabase.from("ponto_cidade").select("*").in("id_jogo", ids).gte("data", "2026-06-17");
  console.log("ponto_cidade entries since June 17:", r1?.length);
  if (r1 && r1.length > 0) {
    console.log("Sample entry from ponto_cidade:", r1[0]);
  }

  const { data: r2 } = await supabase.from("ponto_cidade_mecanica_2").select("*").in("id_jogo", ids).gte("data", "2026-06-17");
  console.log("ponto_cidade_mecanica_2 entries since June 17:", r2?.length);

  const { data: r3 } = await supabase.from("ponto_cidade_mecanica_3").select("*").in("id_jogo", ids).gte("data", "2026-06-17");
  console.log("ponto_cidade_mecanica_3 entries since June 17:", r3?.length);
}
check();
