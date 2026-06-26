const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envPath = 'c:/Users/Garrido/registro-servicos/.env.local';
const envContent = fs.readFileSync(envPath, 'utf8');

const getEnvVar = (name) => {
  const match = envContent.match(new RegExp(`${name}="?([^"\\n]+)"?`));
  return match ? match[1] : null;
};

const supabaseUrl = getEnvVar('NEXT_PUBLIC_SUPABASE_URL');
const supabaseKey = getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY');

async function run() {
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // Query all column names of usuarios table using postgres catalog or just a query
  // Since we might not have direct catalog access or RPC, let's try a query on 'usuarios'
  // and see if we can get details or if there are other tables like logs/historico.
  const { data, error } = await supabase.from('usuarios').select('*').limit(1);
  if (error) {
     console.error(error);
  } else if (data && data.length > 0) {
     console.log('Columns in usuarios:', Object.keys(data[0]));
  }
}
run();
