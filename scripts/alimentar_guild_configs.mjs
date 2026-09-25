import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('C:/Users/Garrido/botreds/config.json', 'utf8'));
const guildId = '1388165063155646524';
const guildName = "A RED'S Tunershop";

const newClient = createClient(
  'https://sxrfkbjbyjdmyyxbzobb.supabase.co',
  'sb_publishable_et87L-NCrieyXmvteW84-w_v9cxAbjG'
);

async function run() {
  console.log('Verificando se a tabela guild_configs já foi criada no novo Supabase...');
  const { data: test, error: checkError } = await newClient.from('guild_configs').select('guild_id').limit(1);

  if (checkError) {
    console.error('❌ A tabela guild_configs ainda não existe no novo Supabase.');
    console.error('Mensagem:', checkError.message);
    console.log('\n👉 Por favor, execute o script SQL em:');
    console.log('https://supabase.com/dashboard/project/sxrfkbjbyjdmyyxbzobb/sql/new');
    console.log('Arquivo: C:/Users/Garrido/registro-servicos/scripts/migrar_guild_configs.sql');
    return;
  }

  console.log('✅ Tabela guild_configs encontrada! Gravando dados da guild...');

  const payload = {
    guild_id: guildId,
    guild_name: guildName,
    guild_icon: null,
    settings: config.settings,
    foto1: config.foto1,
    foto2: config.foto2,
    foto3: config.foto3,
    foto4: config.foto4,
    foto5: config.foto5,
    hierarquia: config.hierarquia,
    advertencias: config.advertencias,
    suggestion_count: config.suggestionCount || 0,
    updated_at: new Date().toISOString()
  };

  const { data, error } = await newClient
    .from('guild_configs')
    .upsert(payload, { onConflict: 'guild_id' })
    .select();

  if (error) {
    console.error('❌ Erro ao inserir dados em guild_configs:', error.message);
  } else {
    console.log('🎉 Dados de guild_configs inseridos/atualizados com sucesso!', data);
  }
}

run();
