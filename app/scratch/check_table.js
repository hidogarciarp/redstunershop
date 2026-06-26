const { createClient } = require('@supabase/supabase-client');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function checkTable() {
  const { data, error } = await supabase
    .from('candidaturas')
    .select('id')
    .limit(1);
  
  if (error) {
    console.log('Error or table missing:', error.message);
  } else {
    console.log('Table exists!');
  }
}

checkTable();
