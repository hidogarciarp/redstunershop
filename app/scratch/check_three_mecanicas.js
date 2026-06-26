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
  console.log("=== 3 LATEST LOGS FOR HARMONY (mechanic_id = 'harmony') ===");
  const { data: harmony, error: eh } = await supabase
    .from("point_sessions")
    .select("*")
    .eq("mechanic_id", "harmony")
    .order("created_at", { ascending: false })
    .limit(3);
  if (eh) console.error(eh);
  else harmony.forEach((r, i) => console.log(`  [Harmony ${i+1}]: employee="${r.employee_name}" id=${r.id_jogo} entrada=${r.entrada} saida=${r.saida} created_at=${r.created_at}`));

  console.log("\n=== 3 LATEST LOGS FOR DUDARK (mechanic_id = 'dudark') ===");
  const { data: dudark, error: ed } = await supabase
    .from("point_sessions")
    .select("*")
    .eq("mechanic_id", "dudark")
    .order("created_at", { ascending: false })
    .limit(3);
  if (ed) console.error(ed);
  else dudark.forEach((r, i) => console.log(`  [Dudark ${i+1}]: employee="${r.employee_name}" id=${r.id_jogo} entrada=${r.entrada} saida=${r.saida} created_at=${r.created_at}`));

  console.log("\n=== 3 LATEST LOGS FOR REDS/DEFAULT (mechanic_id = 'reds' or other/null) ===");
  const { data: reds, error: er } = await supabase
    .from("point_sessions")
    .select("*")
    .not("mechanic_id", "in", '("harmony","dudark")')
    .order("created_at", { ascending: false })
    .limit(3);
  if (er) console.error(er);
  else reds.forEach((r, i) => console.log(`  [Reds ${i+1}]: mechanic_id="${r.mechanic_id}" employee="${r.employee_name}" id=${r.id_jogo} entrada=${r.entrada} saida=${r.saida} created_at=${r.created_at}`));
}
check();
