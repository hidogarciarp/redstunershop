import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  'https://sxrfkbjbyjdmyyxbzobb.supabase.co',
  'sb_publishable_et87L-NCrieyXmvteW84-w_v9cxAbjG'
);

async function check() {
  const { data: s } = await sb
    .from('log_ponto')
    .select('id, mecanica_id, usuario_id, nome, data, entrada, saida, total_minutos, tipo_fechamento, uuid_entrada, uuid_saida, observacao')
    .eq('mecanica_id', 'reds')
    .gte('entrada', '2026-09-20T00:00:00Z')
    .order('entrada', { ascending: true });

  console.log(`Total de sessoes da RED'S entre 20/09 e 24/09: ${s?.length || 0}`);

  const crashes = (s || []).filter(
    (x) =>
      x.tipo_fechamento?.includes('CRASH') ||
      x.uuid_saida?.startsWith('CRASH_') ||
      x.uuid_entrada?.startsWith('auto-')
  );
  console.log(`Sessoes sob suspeita (CRASH / auto-): ${crashes.length}\n`);

  for (const c of crashes) {
    const ent = new Date(c.entrada).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const sai = c.saida ? new Date(c.saida).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : 'EM ABERTO';
    console.log(`ID #${c.id} | ${c.usuario_id} - ${c.nome}`);
    console.log(`   Periodo: ${ent} -> ${sai} (${c.total_minutos} min)`);
    console.log(`   Status: ${c.tipo_fechamento} | Sai: ${c.uuid_saida}`);
    console.log(`   Obs: ${c.observacao || 'sem obs'}\n`);
  }
}

check();
