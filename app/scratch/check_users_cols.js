const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('c:/Users/Garrido/registro-servicos/.env.local', 'utf8');
const urlMatch = envFile.match(/NEXT_PUBLIC_SUPABASE_URL\s*=\s*(.*)/);
const keyMatch = envFile.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY\s*=\s*(.*)/);

async function run() {
  if (urlMatch && keyMatch) {
    const url = urlMatch[1].trim().replace(/['"]/g, '');
    const key = keyMatch[1].trim().replace(/['"]/g, '');
    const supabase = createClient(url, key);
    const { data, error } = await supabase.from('usuarios').select('*').limit(1);
    if (error) {
      console.error(error);
    } else {
      console.log('Columns:', Object.keys(data[0]));
      console.log('Sample Row:', data[0]);
    }
  } else {
    console.log("Could not find keys");
  }
}
run();
