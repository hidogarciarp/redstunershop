import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  'https://sxrfkbjbyjdmyyxbzobb.supabase.co',
  'sb_publishable_et87L-NCrieyXmvteW84-w_v9cxAbjG'
);

async function run() {
  console.log('=== AUDITORIA DETALHADA DE PARES E SESSOES QUEBRADAS (RED\'S) ===\n');

  // Buscar todas as sessões da REDS a partir de 08/09/2026
  const { data: sessoes, error } = await sb
    .from('log_ponto')
    .select('*')
    .eq('mecanica_id', 'reds')
    .gte('entrada', '2026-09-08T00:00:00Z')
    .order('entrada', { ascending: true });

  if (error) {
    console.error('Erro:', error);
    return;
  }

  console.log(`Total de sessões da RED'S desde 08/09/2026: ${sessoes.length}\n`);

  // Classificar problemas:
  // 1. Fragmentações no mesmo dia (múltiplas sessões com intervalo curto onde uma ou mais é CRASH)
  // 2. CRASH_SEM_ATIVIDADE (sessões fechadas com 1 min)
  // 3. CRASH_COM_ATIVIDADE (sessões encurtadas na última atividade)
  // 4. Entradas sintéticas (auto- ou AUTO_ENTRADA)

  const fragmentadosPorDia = [];
  const crashSemAtiv = [];
  const crashComAtiv = [];
  const autoEntradas = [];

  // Agrupar por mecanico e dia
  const porMecDia = new Map();
  for (const s of sessoes) {
    const key = `${s.usuario_id}_${s.data}`;
    if (!porMecDia.has(key)) porMecDia.set(key, []);
    porMecDia.get(key).push(s);

    if (s.tipo_fechamento === 'CRASH_SEM_ATIVIDADE') crashSemAtiv.push(s);
    if (s.tipo_fechamento === 'CRASH_COM_ATIVIDADE') crashComAtiv.push(s);
    if (s.uuid_entrada?.startsWith('auto-') || s.uuid_entrada?.startsWith('AUTO_ENTRADA')) autoEntradas.push(s);
  }

  for (const [key, lista] of porMecDia.entries()) {
    if (lista.length > 1) {
      // Tem mais de 1 sessão no mesmo dia. Tem crash entre elas?
      const temCrash = lista.some(s => s.tipo_fechamento?.includes('CRASH') || s.uuid_saida?.startsWith('CRASH_'));
      const temAuto = lista.some(s => s.uuid_entrada?.startsWith('auto-'));
      if (temCrash || temAuto) {
        fragmentadosPorDia.push({ key, lista });
      }
    }
  }

  console.log(`1. Dias com possível FRAGMENTAÇÃO de turno (mesmo mecânico com sessões de CRASH/Auto no mesmo dia): ${fragmentadosPorDia.length} casos`);
  console.log(`2. Sessões encerradas como CRASH_SEM_ATIVIDADE (reduzidas a 1 min): ${crashSemAtiv.length}`);
  console.log(`3. Sessões encerradas como CRASH_COM_ATIVIDADE (cortadas na última atividade): ${crashComAtiv.length}`);
  console.log(`4. Sessões com entrada sintética (auto-...): ${autoEntradas.length}\n`);

  console.log('=== DETALHAMENTO DOS CASOS DE FRAGMENTAÇÃO NA RED\'S ===');
  for (const f of fragmentadosPorDia) {
    const mec = f.lista[0];
    console.log(`\n▶ Mecânico: ${mec.usuario_id} - ${mec.nome} | Data: ${mec.data} (${f.lista.length} sessões):`);
    for (const s of f.lista) {
      const ent = new Date(s.entrada).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' });
      const sai = s.saida ? new Date(s.saida).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : 'EM ABERTO';
      console.log(`   - #${s.id} | ${ent} -> ${sai} | ${s.total_minutos} min | Status: ${s.tipo_fechamento} | Ativ: ${s.total_atividades} (Tun: ${s.qtd_tunagens}, Banc: ${s.qtd_bancada}) | SaiUUID: ${s.uuid_saida?.slice(0, 20)}`);
    }
  }

  // Estatística de horas perdidas estimadas
  let minutosPerdidosCrashSemAtiv = crashSemAtiv.length; // cada uma teve 1 min mas podia ser esquecida ou não
  console.log('\nAudit concluído com sucesso.');
}

run();
