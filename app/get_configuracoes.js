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
  const { data, error } = await supabase.from('configuracoes').select('*').limit(1).maybeSingle();
  if (error) {
    console.error(error);
  } else {
    console.log('configuracoes row:', JSON.stringify(data, null, 2));
  }
}
run();
