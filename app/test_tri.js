const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testDB() {
  console.log("Fetching participants...");
  const { data, error } = await supabase.from('triathlon_participantes').select('*');
  console.log("Data:", data);
  console.log("Error:", error);
}

testDB();
