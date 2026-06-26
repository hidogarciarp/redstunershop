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

async function test() {
  const ids = ['1085', '2099', '4414', '2341', '171', '1114', '1314', '1813', '2711', '5082', '1086', '392', '291', '5003', '962', '3969'];
  const dataLimiteStr = '2026-06-04';
  const [r1, r2, r3] = await Promise.all([
    supabase.from('ponto_cidade').select('*').in('id_jogo', ids).gte('data', dataLimiteStr),
    supabase.from('ponto_cidade_mecanica_2').select('*').in('id_jogo', ids).gte('data', dataLimiteStr),
    supabase.from('ponto_cidade_mecanica_3').select('*').in('id_jogo', ids).gte('data', dataLimiteStr)
  ]);
  console.log('r1 count:', r1.data ? r1.data.length : 0);
  console.log('r2 count:', r2.data ? r2.data.length : 0);
  console.log('r3 count:', r3.data ? r3.data.length : 0);
  const r1Uuids = r1.data ? r1.data.map(r => r.uuid_entrada).filter(Boolean) : [];
  console.log('r1 uuids contains entry uuid be3a5ca1-d249-48bf-9d45-090212678cea?', r1Uuids.includes('be3a5ca1-d249-48bf-9d45-090212678cea'));
}
test();
