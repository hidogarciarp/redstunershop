import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://prperurjtvayjrazdxvh.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBycGVydXJqdHZheWpyYXpkeHZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwMjEwMzUsImV4cCI6MjA5MDU5NzAzNX0.MDk7Pm5fYQ_18GPUDv0R360y_M1eBaJ2-zKHPhmQOJ0";
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: user, error: userError } = await supabase
    .from("usuarios")
    .select("id, nome, data_admissao, status")
    .eq("id", 291)
    .single();

  console.log("User details:", user);

  const { data: logs, error: logsError } = await supabase
    .from("ponto_cidade")
    .select("id, entrada, saida, data")
    .or("usuario_id.eq.291,nome.ilike.%Lumi Jones%")
    .order("data", { ascending: true });

  console.log("First log:", logs[0]);
  console.log("Total logs count:", logs.length);
}
run();
