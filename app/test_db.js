const fs = require('fs');
const content = fs.readFileSync('c:/Users/Garrido/registro-servicos/app/page.js', 'utf8');
const urlMatch = content.match(/const supabaseUrl = ['"](.*?)['"]/);
const keyMatch = content.match(/const supabaseKey = ['"](.*?)['"]/);

async function run() {
  if(urlMatch && keyMatch) {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(urlMatch[1], keyMatch[1]);
    const { data: config, error: errConfig } = await supabase.from('configuracoes').select('*').limit(1);
    console.log('CONFIGURACOES:', errConfig ? errConfig.message : 'EXISTE');
    
    const { data: notif, error: errNotif } = await supabase.from('notificacoes').insert({
      funcionario_id: null,
      mensagem: 'teste',
      tipo: 'quadro_avisos'
    }).select();
    console.log('NOTIFICACOES INSERT:', errNotif ? errNotif.message : 'SUCCESS');
  }
}
run();
