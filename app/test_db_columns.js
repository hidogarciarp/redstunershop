const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read .env.local
const envPath = 'c:/Users/Garrido/registro-servicos/.env.local';
const envContent = fs.readFileSync(envPath, 'utf8');

const getEnvVar = (name) => {
  const match = envContent.match(new RegExp(`${name}="?([^"\\n]+)"?`));
  return match ? match[1] : null;
};

const supabaseUrl = getEnvVar('NEXT_PUBLIC_SUPABASE_URL');
const supabaseKey = getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY');

async function run() {
  console.log('Connecting to:', supabaseUrl);
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // Let's get one user to see columns
  const { data: users, error } = await supabase.from('usuarios').select('*').limit(1);
  if (error) {
    console.error('Error fetching users:', error);
  } else {
    console.log('User sample:', users[0]);
  }
}

run();
