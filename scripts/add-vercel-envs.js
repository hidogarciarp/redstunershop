const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.production.local');
if (!fs.existsSync(envPath)) {
  console.error('Arquivo .env.production.local nao encontrado!');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const lines = envContent.split('\n');

console.log('Iniciando cadastro de variaveis de ambiente no novo projeto Vercel...');

const vars = {};
for (let line of lines) {
  line = line.trim();
  if (!line || line.startsWith('#') || !line.includes('=')) continue;

  const eqIdx = line.indexOf('=');
  const key = line.substring(0, eqIdx).trim();
  let value = line.substring(eqIdx + 1).trim();

  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.substring(1, value.length - 1);
  }

  if (key === 'VERCEL_OIDC_TOKEN') continue;

  vars[key] = value;
}

vars['NEXT_PUBLIC_SUPABASE_URL'] = 'https://usqwhhergsexrmlsfjcc.supabase.co';
vars['NEXT_PUBLIC_SUPABASE_ANON_KEY'] = 'sb_publishable_v3sUR2OMgQcGISiMdYeoNA_yfsJwWQm';

const environments = ['production', 'preview', 'development'];

for (const [key, value] of Object.entries(vars)) {
  console.log(`Cadastrando ${key}...`);
  for (const env of environments) {
    try {
      execSync(`npx.cmd vercel env add ${key} ${env} --value "${value}" --yes`, { stdio: 'ignore' });
    } catch (err) {
      console.error(`✗ Erro ao cadastrar ${key} em ${env}:`, err.message);
    }
  }
  console.log(`✓ ${key} cadastrado em todos os ambientes!`);
}

console.log('Finalizado!');
