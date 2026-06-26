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

const uuids = [
  "ab1ba36c-f8dd-432c-a441-e663eb63c56d",
  "9f1572c6-e191-46d0-8d9e-3c5cdb9e3794",
  "a90d779b-4d7b-4539-9e4c-ca34ac12e2cd",
  "be3a5ca1-d249-48bf-9d45-090212678cea",
  "b85c4eb1-c5c3-4e21-88ec-552215512496",
  "1f67005b-ae6c-4288-978a-4f861967778f",
  "43799d30-a9cc-4a2a-b6a5-09fd20f6a718"
];

async function check() {
  const { data: d1 } = await supabase.from("ponto_cidade").select("*").or(`uuid_entrada.in.(${uuids.join(",")}),uuid_saida.in.(${uuids.join(",")})`);
  console.log("Found in ponto_cidade:", d1?.length, d1);
}
check();
