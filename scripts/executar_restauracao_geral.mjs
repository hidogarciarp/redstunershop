import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  'https://sxrfkbjbyjdmyyxbzobb.supabase.co',
  'sb_publishable_et87L-NCrieyXmvteW84-w_v9cxAbjG'
);

async function main() {
  console.log('==================================================================');
  console.log('🚀 INICIANDO RESTAURAÇÃO DE SESSÕES E EXPURGO DE LOGS FALSOS');
  console.log('==================================================================\n');

  // 1. Expurgo dos 113 logs falsos de discord_log_messages
  console.log('1. Excluindo mensagens sintéticas auto-recuperadas de discord_log_messages...');
  const { data: deletadosMsg, error: errDelMsg } = await sb
    .from('discord_log_messages')
    .delete()
    .ilike('content', '%auto-recuperado%')
    .select('id');

  if (errDelMsg) {
    console.error('Erro ao deletar mensagens falsas:', errDelMsg);
    return;
  }
  console.log(`✅ ${deletadosMsg?.length || 0} mensagens sintéticas removidas de discord_log_messages!\n`);

  // 2. Expurgo de sessões em log_ponto geradas por essas entradas falsas
  console.log('2. Buscando sessões em log_ponto com uuid_entrada auto-recuperado ou resíduos...');
  const { data: sessoesAutoRecup } = await sb
    .from('log_ponto')
    .select('id, mecanica_id, usuario_id, nome, data, entrada, saida, total_minutos, uuid_entrada')
    .ilike('uuid_entrada', 'auto-recuperado%');

  console.log(`Encontradas ${sessoesAutoRecup?.length || 0} sessões em log_ponto com uuid_entrada auto-recuperado.`);
  if (sessoesAutoRecup && sessoesAutoRecup.length > 0) {
    const idsParaDeletar = sessoesAutoRecup.map(s => s.id);
    const { error: errDelSess } = await sb
      .from('log_ponto')
      .delete()
      .in('id', idsParaDeletar);
    if (errDelSess) console.error('Erro ao deletar sessões auto-recuperadas:', errDelSess);
    else console.log(`✅ ${idsParaDeletar.length} sessões fantasmas removidas de log_ponto.\n`);
  }

  // 3. Identificar e unificar sessões legítimas que foram quebradas
  // Vamos buscar por mecânicos que tiveram sessões com CRASH na REDS a partir de 08/09
  console.log('3. Analisando mecânicos da REDS com sessões fatiadas indevidamente...');
  const { data: sessoesReds } = await sb
    .from('log_ponto')
    .select('*')
    .eq('mecanica_id', 'reds')
    .gte('entrada', '2026-09-08T00:00:00Z')
    .order('entrada', { ascending: true });

  // Agrupar por usuário e data
  const porMecData = new Map();
  for (const s of (sessoesReds || [])) {
    const key = `${s.usuario_id}_${s.data}`;
    if (!porMecData.has(key)) porMecData.set(key, []);
    porMecData.get(key).push(s);
  }

  let turnosConsolidados = 0;
  let minutosRestauradosTotal = 0;

  for (const [key, lista] of porMecData.entries()) {
    // Se tem mais de uma sessão no mesmo dia e pelo menos uma delas foi fechada como CRASH
    const temCrash = lista.some(s => s.tipo_fechamento?.includes('CRASH') || s.uuid_saida?.startsWith('CRASH_'));
    const temAuto = lista.some(s => s.uuid_entrada?.startsWith('auto-'));

    if (lista.length > 1 && (temCrash || temAuto)) {
      // Verificar se as sessões são contíguas (ou seja, o fim de uma é próximo do início da outra, ou o mecânico estava na mesma janela de trabalho)
      lista.sort((a, b) => new Date(a.entrada).getTime() - new Date(b.entrada).getTime());
      
      const primeira = lista[0];
      const ultima = lista[lista.length - 1];

      // Se a última sessão tem uma saída legítima (não nula) e o intervalo entre a primeira entrada e a última saída é razoável (<= 14h)
      if (primeira.entrada && ultima.saida) {
        const entMs = new Date(primeira.entrada).getTime();
        const saiMs = new Date(ultima.saida).getTime();
        const duracaoTotalHoras = (saiMs - entMs) / (3600 * 1000);

        // Se a duração total faz sentido como um turno de trabalho (até 12 horas)
        if (duracaoTotalHoras > 0 && duracaoTotalHoras <= 12) {
          const minutosAntes = lista.reduce((acc, s) => acc + (s.total_minutos || 0), 0);
          const duracaoTotalMin = Math.round((saiMs - entMs) / 60000);
          const duracaoTotalSeg = Math.round((saiMs - entMs) / 1000);
          const minutosGanhos = Math.max(0, duracaoTotalMin - minutosAntes);

          // Buscar todas as atividades reais do período
          const { data: tunagens } = await sb
            .from('log_tunagem')
            .select('uuid, timestampz')
            .eq('mecanica_id', 'reds')
            .eq('tecnico_id', String(primeira.usuario_id))
            .gte('timestampz', new Date(entMs - 60000).toISOString())
            .lte('timestampz', new Date(saiMs + 60000).toISOString());

          const { data: bancadas } = await sb
            .from('log_bancada')
            .select('uuid, timestampz')
            .eq('mecanica_id', 'reds')
            .eq('usuario_id', String(primeira.usuario_id))
            .gte('timestampz', new Date(entMs - 60000).toISOString())
            .lte('timestampz', new Date(saiMs + 60000).toISOString());

          const { data: baus } = await sb
            .from('log_bau')
            .select('uuid, timestampz')
            .eq('mecanica_id', 'reds')
            .eq('usuario_id', String(primeira.usuario_id))
            .gte('timestampz', new Date(entMs - 60000).toISOString())
            .lte('timestampz', new Date(saiMs + 60000).toISOString());

          const totalAtiv = (tunagens?.length || 0) + (bancadas?.length || 0) + (baus?.length || 0);

          console.log(`------------------------------------------------------------------`);
          console.log(`👤 Consolidando turno: ${primeira.usuario_id} - ${primeira.nome} (${primeira.data})`);
          console.log(`   De: ${lista.length} sessões quebradas somando ${minutosAntes} min`);
          console.log(`   Para: 1 sessão unificada de ${duracaoTotalMin} min (+${minutosGanhos} min devolvidos!)`);
          console.log(`   Horário: ${new Date(entMs).toLocaleTimeString('pt-BR')} ➔ ${new Date(saiMs).toLocaleTimeString('pt-BR')}`);
          console.log(`   Atividades vinculadas: ${totalAtiv} (Tun: ${tunagens?.length || 0}, Banc: ${bancadas?.length || 0}, Baú: ${baus?.length || 0})`);

          // 1. Atualizar a primeira sessão para cobrir todo o período
          const { error: errUpd } = await sb
            .from('log_ponto')
            .update({
              saida: ultima.saida,
              uuid_saida: ultima.uuid_saida?.startsWith('CRASH_') ? (ultima.uuid_entrada || 'SAIDA_CONSOLIDADA') : ultima.uuid_saida,
              tipo_fechamento: 'NORMAL',
              total_minutos: duracaoTotalMin,
              total_segundos: duracaoTotalSeg,
              qtd_tunagens: tunagens?.length || 0,
              qtd_bancada: bancadas?.length || 0,
              total_atividades: totalAtiv,
              observacao: `Turno unificado e consolidado. Horas legítimas restauradas (+${minutosGanhos} min devolvidos).`
            })
            .eq('id', primeira.id);

          if (errUpd) {
            console.error(`Erro ao atualizar sessão ${primeira.id}:`, errUpd);
          } else {
            // 2. Excluir as demais sessões intermediárias fragmentadas
            const idsSobrando = lista.slice(1).map(s => s.id);
            if (idsSobrando.length > 0) {
              await sb.from('log_ponto').delete().in('id', idsSobrando);
            }
            turnosConsolidados++;
            minutosRestauradosTotal += minutosGanhos;
          }
        }
      }
    }
  }

  console.log('\n==================================================================');
  console.log(`🎉 RESTAURAÇÃO CONCLUÍDA!`);
  console.log(`• Turnos unificados e corrigidos: ${turnosConsolidados}`);
  console.log(`• Minutos restaurados aos funcionários: ${minutosRestauradosTotal} min (~${(minutosRestauradosTotal / 60).toFixed(1)} horas)`);
  console.log('==================================================================');
}

main();
