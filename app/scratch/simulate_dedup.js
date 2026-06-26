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

async function run() {
  // Simulate fetching records for the week/period (or query similar to registrations)
  const { data: registrosRelatorio, error } = await supabase
    .from("ponto_cidade")
    .select("*");
  
  if (error) {
    console.error(error);
    return;
  }

  const func = { id: 1085, nome: "Alice Bianchi" };

  const byUid = {};
  const byNome = {};
  
  registrosRelatorio.forEach(reg => {
    if (reg.usuario_id) {
      const uid = String(reg.usuario_id);
      if (!byUid[uid]) byUid[uid] = [];
      byUid[uid].push(reg);
    }
    if (reg.nome) {
      const n = reg.nome.toLowerCase().trim();
      if (!byNome[n]) byNome[n] = [];
      byNome[n].push(reg);
    }
  });

  const regsVinculados = byUid[String(func.id)] || [];
  const regsOrfaos = func.nome ? (byNome[func.nome.toLowerCase().trim()] || []) : [];

  console.log("regsVinculados count:", regsVinculados.length);
  console.log("regsOrfaos count:", regsOrfaos.length);

  const todosRegs = [];
  const vistos = new Set();
  [...regsVinculados, ...regsOrfaos].forEach((reg, idx) => {
    const key = reg.id || reg.uuid_entrada || reg.entrada;
    console.log(`Index ${idx}: reg.id = ${reg.id}, reg.uuid_entrada = ${reg.uuid_entrada}, reg.entrada = ${reg.entrada}, key = ${key}, type = ${typeof key}`);
    if (!vistos.has(key)) {
      vistos.add(key);
      todosRegs.push(reg);
    } else {
      console.log(`DUPLICATE DETECTED AND FILTERED: key = ${key}`);
    }
  });

  console.log("Result todosRegs count:", todosRegs.length);
}
run();
