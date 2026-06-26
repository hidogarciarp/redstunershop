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
  const tables = [
    "configuracoes",
    "anuncio_status",
    "anuncio_historico",
    "anuncios",
    "anuncios_status",
    "anuncios_historico"
  ];
  for (const t of tables) {
    const { error, data } = await supabase.from(t).select("*").limit(1);
    if (error) {
      console.log(`Table ${t} check failed:`, error.message);
    } else {
      console.log(`Table ${t} exists! Data:`, data);
    }
  }
}
check();
