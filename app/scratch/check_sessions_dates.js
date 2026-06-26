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

async function check() {
  console.log("--- POINT_SESSIONS sorted by entrada DESC ---");
  const { data: pEntrada, error: e1 } = await supabase.from("point_sessions").select("*").order("entrada", { ascending: false }).limit(5);
  if (e1) console.error("Error pEntrada:", e1);
  else {
    pEntrada.forEach((row, i) => console.log(`  [Row ${i+1}]: entrada=${row.entrada} saida=${row.saida} employee=${row.employee_name} created=${row.created_at}`));
  }

  console.log("--- POINT_SESSIONS sorted by created_at DESC ---");
  const { data: pCreated, error: e2 } = await supabase.from("point_sessions").select("*").order("created_at", { ascending: false }).limit(5);
  if (e2) console.error("Error pCreated:", e2);
  else {
    pCreated.forEach((row, i) => console.log(`  [Row ${i+1}]: entrada=${row.entrada} saida=${row.saida} employee=${row.employee_name} created=${row.created_at}`));
  }
}
check();
