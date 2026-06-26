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

async function probe() {
  const tables = [
    "point_sessions",
    "ponto_cidade",
    "ponto_cidade_mecanica_2",
    "ponto_cidade_mecanica_3",
    "ponto_horas",
    "vendas_nitro_cidade",
    "vendas_drift_cidade",
    "solicitacoes_ponto",
    "pagamentos_semanais",
    "usuarios",
    "blacklist",
    "notificacoes",
    "servicos",
    "configuracoes",
    "logs",
    "sessions",
    "discord_logs",
    "logs_cidade",
    "ponto_logs",
    "importacoes_ponto",
    "point_logs",
    "ponto_cidade_import",
    "ponto_cidade_bruto",
    "ponto_bruto",
    "ponto_import"
  ];

  console.log("Starting probe of tables...\n");

  for (const table of tables) {
    try {
      // Get the count and latest entries if possible
      const { data, error } = await supabase.from(table).select("*").order("id", { ascending: false }).limit(3);
      if (error) {
        // Table probably doesn't exist
        continue;
      }
      
      console.log(`=== TABLE: ${table} ===`);
      console.log(`Successfully fetched ${data.length} records.`);
      if (data.length > 0) {
        console.log("Latest records:");
        data.forEach((row, i) => {
          // Identify columns that might be date/timestamp
          const dateKeys = Object.keys(row).filter(k => {
            const v = row[k];
            return typeof v === 'string' && (v.includes('-') || v.includes('T') || v.includes(':'));
          });
          
          const info = {};
          // Include id or primary key
          if (row.id !== undefined) info.id = row.id;
          if (row.nome !== undefined) info.nome = row.nome;
          if (row.nome_personagem !== undefined) info.nome_personagem = row.nome_personagem;
          if (row.employee_name !== undefined) info.employee_name = row.employee_name;
          if (row.entrada !== undefined) info.entrada = row.entrada;
          if (row.saida !== undefined) info.saida = row.saida;
          if (row.created_at !== undefined) info.created_at = row.created_at;
          if (row.criado_em !== undefined) info.criado_em = row.criado_em;
          if (row.importado_em !== undefined) info.importado_em = row.importado_em;
          
          // Add dates found
          dateKeys.forEach(k => {
            if (info[k] === undefined) info[k] = row[k];
          });
          
          console.log(`  [Record ${i+1}]:`, JSON.stringify(info));
        });
      } else {
        console.log("  Table is empty.");
      }
      console.log("");
    } catch (err) {
      // Ignore
    }
  }
}

probe();
