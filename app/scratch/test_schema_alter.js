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

async function testSchemaAlter() {
  console.log("Checking if supabase key can query config or execute a sql to insert config row...");
  const { data, error } = await supabase.from("configuracoes").select("quadro_avisos").eq("id", 1).maybeSingle();
  if (error) {
    console.error("Config fetch error:", error);
  } else {
    console.log("Current configuracoes quadro_avisos:", data);
  }
}
testSchemaAlter();
