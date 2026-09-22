import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const env = fs.readFileSync(".env.local", "utf-8");
let oldUrl = "", oldKey = "";
env.split("\n").forEach((l) => {
  const line = l.trim();
  if (line.startsWith("NEXT_PUBLIC_SUPABASE_URL=")) oldUrl = line.split("=")[1].replace(/["']/g, "").trim();
  if (line.startsWith("SUPABASE_SERVICE_ROLE_KEY=")) oldKey = line.split("=")[1].replace(/["']/g, "").trim();
  if (!oldKey && line.startsWith("NEXT_PUBLIC_SUPABASE_ANON_KEY=")) oldKey = line.split("=")[1].replace(/["']/g, "").trim();
});

const client = createClient(oldUrl, oldKey);

async function run() {
  const { data: curso, error: errCurso } = await client.from("curso_configuracoes").select("*");
  console.log("CURSO KEYS:", curso && curso[0] ? Object.keys(curso[0]) : null);
  console.log("CURSO DATA:", curso);

  const { data: clientes, error: errClientes } = await client.from("clientes").select("*").limit(5);
  console.log("CLIENTES KEYS:", clientes && clientes[0] ? Object.keys(clientes[0]) : null);
  console.log("SAMPLE CLIENTES:", clientes);

  // Check data types and values in clientes where error happens
  const { data: allClientes } = await client.from("clientes").select("*");
  const problematic = allClientes.filter(c => {
    return (c.ultima_alteracao && isNaN(Date.parse(c.ultima_alteracao))) ||
           (c.data_ultimo_servico && isNaN(Date.parse(c.data_ultimo_servico)));
  });
  console.log("PROBLEMATIC CLIENTES:", problematic.slice(0, 5));
}

run();
