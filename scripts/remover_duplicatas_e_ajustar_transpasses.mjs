import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  'https://sxrfkbjbyjdmyyxbzobb.supabase.co',
  'sb_publishable_et87L-NCrieyXmvteW84-w_v9cxAbjG'
);

async function resolver() {
  console.log('==================================================================');
  console.log('ENFORCING GOLDEN RULES: ZERO OVERLAPPING & ZERO DUPLICATES');
  console.log('==================================================================\n');

  const { data: allSessions, error } = await sb.from('log_ponto')
    .select('*')
    .eq('mecanica_id', 'reds')
    .gte('entrada', '2026-09-08T00:00:00Z')
    .order('entrada', { ascending: true });

  console.log('Total de sessoes lidas:', allSessions?.length);

  // 1. Eliminar duplicatas exatas de entrada para o mesmo usuario
  const porUsuarioEntrada = new Map();
  const idsParaExcluir = [];

  for (const s of allSessions) {
    const chave = `${s.usuario_id}_${s.entrada}`;
    if (porUsuarioEntrada.has(chave)) {
      const existente = porUsuarioEntrada.get(chave);
      // Se um deles for mais detalhado ou validado, mantem o melhor e deleta o outro
      if (s.observacao?.includes('retificado') || s.observacao?.includes('Conciliador')) {
        idsParaExcluir.push(existente.id);
        porUsuarioEntrada.set(chave, s);
      } else {
        idsParaExcluir.push(s.id);
      }
    } else {
      porUsuarioEntrada.set(chave, s);
    }
  }

  if (idsParaExcluir.length > 0) {
    console.log(`Excluindo ${idsParaExcluir.length} sessoes duplicadas em log_ponto...`);
    const { error: errDel } = await sb.from('log_ponto').delete().in('id', idsParaExcluir);
    if (errDel) console.error('Erro ao deletar duplicatas:', errDel);
    else console.log(`✅ ${idsParaExcluir.length} duplicatas removidas com sucesso!`);
  }

  // 2. Recarregar sessoes limpas e verificar transpasses (saida > proxima entrada)
  const { data: sessoesLimpas } = await sb.from('log_ponto')
    .select('*')
    .eq('mecanica_id', 'reds')
    .gte('entrada', '2026-09-08T00:00:00Z')
    .order('entrada', { ascending: true });

  const porUsuario = new Map();
  for (const s of sessoesLimpas) {
    if (!porUsuario.has(s.usuario_id)) porUsuario.set(s.usuario_id, []);
    porUsuario.get(s.usuario_id).push(s);
  }

  let transpassesAjustados = 0;

  for (const [uid, sessoes] of porUsuario.entries()) {
    sessoes.sort((a,b) => new Date(a.entrada).getTime() - new Date(b.entrada).getTime());

    for (let i = 0; i < sessoes.length - 1; i++) {
      const atual = sessoes[i];
      const proxima = sessoes[i + 1];

      const tEntAtual = new Date(atual.entrada).getTime();
      const tSaiAtual = new Date(atual.saida).getTime();
      const tEntProx = new Date(proxima.entrada).getTime();

      // Se a saida da atual ultrapassa a entrada da proxima
      if (tSaiAtual > tEntProx) {
        console.log(`Corrigindo transpasse para ${atual.nome} (#${atual.id}): saida era ${atual.saida}, cortando em ${proxima.entrada}`);
        
        // A sessao atual DEVE terminar no maximo na entrada da proxima (ou na ultima atividade valida antes dela)
        const novoFimMs = tEntProx;
        const durMin = Math.max(1, Math.round((novoFimMs - tEntAtual) / 60000));
        const durSeg = Math.max(60, Math.round((novoFimMs - tEntAtual) / 1000));

        await sb.from('log_ponto').update({
          saida: new Date(novoFimMs).toISOString(),
          total_minutos: durMin,
          total_segundos: durSeg,
          tipo_fechamento: 'CRASH_COM_ATIVIDADE',
          observacao: `Ajustado pela Regra de Ouro: encerrado na entrada do turno seguinte (#${proxima.id}).`
        }).eq('id', atual.id);

        transpassesAjustados++;
      }
    }
  }

  console.log(`\n✅ Transpasses ajustados: ${transpassesAjustados}`);
}

resolver();
