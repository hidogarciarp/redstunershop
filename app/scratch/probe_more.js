import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const envFile = fs.readFileSync(".env.local", "utf8");
const env = {};
envFile.split("\n").forEach(line => {
  const match = line.match(/^\s*([^#=]+)\s*=\s*(.*)$/);
  if (match) {
    env[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, '');
  }
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function probe() {
  const candidates = [
    "point_sessions_v2",
    "point_sessions_new",
    "point_sessions_old",
    "discord_ponto",
    "ponto_discord",
    "logs_bot",
    "bot_logs",
    "logs_ponto_cidade",
    "point_logs",
    "pontos",
    "registro_ponto",
    "registros_ponto",
    "ponto"
  ];
  
  for (const t of candidates) {
    try {
      const { data, error } = await supabase.from(t).select("*").limit(1);
      if (!error) {
        console.log(`FOUND TABLE: ${t}`);
      }
    } catch(e) {}
  }
  
  // Let's print the most recent record date/time of the tables we know exist
  const activeTables = [
    "point_sessions",
    "ponto_cidade",
    "ponto_cidade_mecanica_2",
    "ponto_cidade_mecanica_3",
    "servicos",
    "pagamentos_semanais",
    "usuarios"
  ];
  
  console.log("\n--- LATEST TIMESTAMPS OF ACTIVE TABLES ---");
  for (const t of activeTables) {
    try {
      let query = supabase.from(t).select("*");
      // Find the most recent record. We will sort by ID desc and also try to sort by date columns.
      const { data, error } = await query.order("id", { ascending: false }).limit(1);
      if (!error && data && data.length > 0) {
        console.log(`Table '${t}': latest ID = ${data[0].id}, data = ${JSON.stringify(data[0])}`);
      } else if (error) {
        // Try UUID sorting if ID is not numeric or not present
        const { data: dataUuid, error: errorUuid } = await supabase.from(t).select("*").limit(1);
        if (!errorUuid && dataUuid && dataUuid.length > 0) {
           console.log(`Table '${t}' (no numeric id): data = ${JSON.stringify(dataUuid[0])}`);
        }
      }
    } catch(e) {
      console.log(`Error on table ${t}:`, e);
    }
  }
}
probe();
