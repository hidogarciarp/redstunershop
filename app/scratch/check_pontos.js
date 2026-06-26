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
  console.log("Checking 'pontos' table:");
  const { data, error } = await supabase.from("pontos").select("*").order("created_at", { ascending: false }).limit(5);
  if (error) {
    // If created_at doesn't exist, let's try sorting by id or something else
    const { data: data2, error: error2 } = await supabase.from("pontos").select("*").limit(5);
    console.log("Error querying with created_at, fallback data:", data2, error2);
  } else {
    console.log(`Fetched ${data.length} records from 'pontos' sorted by created_at DESC.`);
    data.forEach((row, idx) => {
      console.log(`  [Row ${idx+1}]:`, JSON.stringify(row));
    });
  }
}
check();
