import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://prperurjtvayjrazdxvh.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBycGVydXJqdHZheWpyYXpkeHZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwMjEwMzUsImV4cCI6MjA5MDU5NzAzNX0.MDk7Pm5fYQ_18GPUDv0R360y_M1eBaJ2-zKHPhmQOJ0";
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase
    .from("usuarios")
    .select("id, nome, status")
    .in("id", [170, 171]);

  if (error) {
    console.error(error);
  } else {
    console.log(data);
  }
}
run();
