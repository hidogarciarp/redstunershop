import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  'https://sxrfkbjbyjdmyyxbzobb.supabase.co',
  'sb_publishable_et87L-NCrieyXmvteW84-w_v9cxAbjG'
);

async function auditar() {
  const { data: allSessions, error } = await sb.from('log_ponto')
    .select('id, mecanica_id, usuario_id, nome, data, entrada, saida, total_minutos, observacao')
    .eq('mecanica_id', 'reds')
    .gte('entrada', '2026-09-08T00:00:00Z')
    .order('entrada', { ascending: true });

  console.log('Total de sessoes em log_ponto desde 08/09:', allSessions?.length);

  const porUsuario = new Map();
  for (const s of allSessions) {
    if (!porUsuario.has(s.usuario_id)) porUsuario.set(s.usuario_id, []);
    porUsuario.get(s.usuario_id).push(s);
  }

  const violacoes = [];

  for (const [uid, sessoes] of porUsuario.entries()) {
    sessoes.sort((a,b) => new Date(a.entrada).getTime() - new Date(b.entrada).getTime());

    for (let i = 0; i < sessoes.length - 1; i++) {
      const atual = sessoes[i];
      const proxima = sessoes[i + 1];

      const tSaiAtual = new Date(atual.saida).getTime();
      const tEntProx = new Date(proxima.entrada).getTime();

      // Regra de Ouro: Saída atual NUNCA pode ser maior que a Entrada próxima!
      if (tSaiAtual > tEntProx + 60000) {
        violacoes.push({
          usuario_id: uid,
          nome: atual.nome,
          atual: { id: atual.id, entrada: atual.entrada, saida: atual.saida, durMin: atual.total_minutos, obs: atual.observacao },
          proxima: { id: proxima.id, entrada: proxima.entrada, saida: proxima.saida, durMin: proxima.total_minutos, obs: proxima.observacao }
        });
      }
    }
  }

  console.log('\n==================================================================');
  console.log('AUDITORIA DE REGRAS: SESSOES COM SAIDA ULTRAPASSANDO ENTRADA');
  console.log('==================================================================');
  console.log('Total de violacoes encontradas:', violacoes.length);

  violacoes.forEach((v, idx) => {
    const ent1BR = new Date(v.atual.entrada).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const sai1BR = new Date(v.atual.saida).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const ent2BR = new Date(v.proxima.entrada).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const sai2BR = new Date(v.proxima.saida).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    console.log(`\nViolacao #${idx+1}: ${v.nome} (ID: ${v.usuario_id})`);
    console.log(`   Sessao #${v.atual.id}: ${ent1BR} -> ${sai1BR} (${v.atual.durMin} min) | Obs: ${v.atual.obs}`);
    console.log(`   Sessao #${v.proxima.id}: ${ent2BR} -> ${sai2BR} (${v.proxima.durMin} min) | Obs: ${v.proxima.obs}`);
    console.log(`   [ALERTA]: A saida de #${v.atual.id} (${sai1BR}) ultrapassa a entrada de #${v.proxima.id} (${ent2BR})!`);
  });
}

auditar();
