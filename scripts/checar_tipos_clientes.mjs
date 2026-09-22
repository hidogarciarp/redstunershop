import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const env = fs.readFileSync(".env.local", "utf-8");
let oldUrl = "", oldKey = "";
env.split("\n").forEach((l) => {
  const line = l.trim();
  if (line.startsWith("NEXT_PUBLIC_SUPABASE_URL=")) oldUrl = line.split("=")[1].replace(/["']/g, "").trim();
  if (line.startsWith("SUPABASE_SERVICE_ROLE_KEY=")) oldKey = line.split("=")[1].replace(/["']/g, "").trim();
});

const client = createClient(oldUrl, oldKey);

async function run() {
  const { data: allClientes } = await client.from("clientes").select("*");
  const tiposUltimaAlteracao = new Set();
  const tiposDataUltimoServico = new Set();
  
  for (const c of allClientes) {
    if (c.ultima_alteracao !== null) {
      tiposUltimaAlteracao.add(typeof c.ultima_alteracao);
    }
    if (c.data_ultimo_servico !== null) {
      tiposDataUltimoServico.add(typeof c.data_ultimo_servico);
    }
  }
  console.log("Tipos de ultima_alteracao:", Array.from(tiposUltimaAlteracao));
  console.log("Tipos de data_ultimo_servico:", Array.from(tiposDataUltimoServico));
  console.log("Exemplos ultima_alteracao:", allClientes.map(c => c.ultima_alteracao).filter(Boolean).slice(0, 10));
}
run();
