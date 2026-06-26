import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://prperurjtvayjrazdxvh.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBycGVydXJqdHZheWpyYXpkeHZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwMjEwMzUsImV4cCI6MjA5MDU5NzAzNX0.MDk7Pm5fYQ_18GPUDv0R360y_M1eBaJ2-zKHPhmQOJ0";
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: usuarios } = await supabase.from('usuarios').select('id, nome, status');
  const { data: registros } = await supabase.from('ponto_cidade').select('*');
  
  const targetId = "3124";
  const targetUser = usuarios.find(u => String(u.id) === targetId);
  console.log("Target user in DB:", targetUser);
  
  const matchingRegs = registros.filter(r => String(r.id_jogo) === targetId);
  console.log("Matching regs count for 3124:", matchingRegs.length);
  if (matchingRegs.length > 0) {
    console.log("First matching reg:", matchingRegs[0]);
  }
}
check();
