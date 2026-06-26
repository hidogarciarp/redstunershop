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

async function checkRow(tableName) {
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select("*")
      .limit(1);
    
    if (error) {
      console.log(`Table ${tableName} error:`, error.message);
    } else if (data && data.length > 0) {
      console.log(`Table ${tableName} structure:`, Object.keys(data[0]));
      console.log(`Sample row for ${tableName}:`, JSON.stringify(data[0], null, 2));
    } else {
      console.log(`Table ${tableName} exists but is empty.`);
    }
  } catch (err) {
    console.log(`Table ${tableName} fetch error:`, err.message);
  }
}

async function run() {
  await checkRow("point_sessions");
  await checkRow("ponto_cidade_mecanica_2");
  await checkRow("ponto_cidade_mecanica_3");
}
run();
