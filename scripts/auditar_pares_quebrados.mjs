import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  'https://sxrfkbjbyjdmyyxbzobb.supabase.co',
  'sb_publishable_et87L-NCrieyXmvteW84-w_v9cxAbjG'
);

async function audit() {
  console.log('=== AUDITORIA GERAL DE SESSOES QUEBRADAS / PAREAMENTO INDEVIDO ===\n');

  // 1. Total de sessões
  const { count: totalSessoes } = await sb
    .from('log_ponto')
    .select('*', { count: 'exact', head: true });
  console.log(`Total de sessoes em log_ponto: ${totalSessoes}`);

  // 2. Buscar todas as sessões
  const { data: todasSessoes, error } = await sb
    .from('log_ponto')
    .select('id, mecanica_id, usuario_id, nome, data, entrada, saida, total_minutos, total_segundos, tipo_fechamento, uuid_entrada, uuid_saida, observacao')
    .order('entrada', { ascending: false });

  if (error) {
    console.error('Erro ao buscar sessoes:', error);
    return;
  }

  // Identificar sessões com crash ou auto-entrada ou auto-saida
  const suspeitas = [];
  const sessoesAutoEntrada = [];
  const sessoesCrash = [];

  for (const s of todasSessoes) {
    const isCrash = s.tipo_fechamento?.includes('CRASH') || s.uuid_saida?.startsWith('CRASH_');
    const isAutoEntrada = s.uuid_entrada?.startsWith('auto-');
    const isAutoSaida = s.uuid_saida?.startsWith('auto-') || s.uuid_saida?.startsWith('CRASH_');

    if (isCrash) sessoesCrash.push(s);
    if (isAutoEntrada) sessoesAutoEntrada.push(s);

    if (isCrash || isAutoEntrada || isAutoSaida) {
      suspeitas.push(s);
    }
  }

  console.log(`Sessoes com status ou saida de CRASH: ${sessoesCrash.length}`);
  console.log(`Sessoes com entrada sintetica (auto-...): ${sessoesAutoEntrada.length}`);
  console.log(`Total de sessoes suspeitas identificadas: ${suspeitas.length}\n`);

  // Agrupar por usuário e mecânica
  const porMecanico = new Map();
  for (const s of suspeitas) {
    const key = `${s.mecanica_id} | ID: ${s.usuario_id} - ${s.nome}`;
    if (!porMecanico.has(key)) porMecanico.set(key, []);
    porMecanico.get(key).push(s);
  }

  console.log(`=== MECANICOS AFETADOS (${porMecanico.size} mecanicos no total) ===\n`);

  for (const [mec, sessoes] of porMecanico.entries()) {
    console.log(`------------------------------------------------------`);
    console.log(`* ${mec} (${sessoes.length} sessoes sob suspeita)`);
    console.log(`------------------------------------------------------`);
    
    sessoes.sort((a, b) => new Date(a.entrada).getTime() - new Date(b.entrada).getTime());

    for (const s of sessoes) {
      const entBR = new Date(s.entrada).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
      const saiBR = s.saida ? new Date(s.saida).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : 'EM ABERTO';
      console.log(`  - ID #${s.id} | ${entBR} -> ${saiBR} (${s.total_minutos} min)`);
      console.log(`    Status: ${s.tipo_fechamento} | UUID Ent: ${s.uuid_entrada?.slice(0, 30)} | UUID Sai: ${s.uuid_saida?.slice(0, 30)}`);
      if (s.observacao) console.log(`    Obs: ${s.observacao}`);
    }
    console.log('');
  }
}

audit();
