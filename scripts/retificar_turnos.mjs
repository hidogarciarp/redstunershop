import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const sb = createClient(
  'https://sxrfkbjbyjdmyyxbzobb.supabase.co',
  'sb_publishable_et87L-NCrieyXmvteW84-w_v9cxAbjG'
);

function getDataCivilBrasilia(dateObj) {
  const d = new Date(dateObj.getTime() - 3 * 3600 * 1000);
  return d.toISOString().split('T')[0];
}

async function retificar() {
  console.log('==================================================================');
  console.log('RESTAURANDO TURNOS REAIS DA REDS (DESFAZENDO FUSAO INDEVIDA)');
  console.log('==================================================================\n');

  const data = JSON.parse(fs.readFileSync('scratch_consolidado.json', 'utf8'));

  let totalSessoesNovas = 0;
  let sessoesAjustadas = 0;

  for (const s of data) {
    if (s.id === 40376) {
      // Tiago Andre #40376 foi uma sessão legítima de 2h19m
      continue;
    }

    const dtInicio = s.data + 'T00:00:00-03:00';
    const dtFim = s.data + 'T23:59:59-03:00';
    const isoIni = new Date(new Date(dtInicio).getTime() - 4 * 3600000).toISOString();
    const isoFim = new Date(new Date(dtFim).getTime() + 6 * 3600000).toISOString();

    const { data: msgs } = await sb.from('discord_log_messages')
      .select('id, created_at, content')
      .eq('mechanic_id', 'reds')
      .eq('log_type', 'ponto')
      .ilike('content', '%' + s.usuario_id + '%')
      .gte('created_at', isoIni)
      .lte('created_at', isoFim)
      .order('id', { ascending: true });

    function parsePonto(rawText, createdAt) {
      if (!rawText) return null;
      const clean = String(rawText).replace(/```ini/gi, '').replace(/```/g, '');
      const lines = clean.split('\n');
      let id = null, nome = null, tipo = null, dataISO = null, uuid = null;
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i].trim();
        const matchId = l.match(/^\[ID\]:\s*(\d+)\s+(.+?)\s*\(\s*(ENTROU EM SERVI[ÇC]O|SAIU DE SERVI[ÇC]O)/i);
        if (matchId) {
          id = matchId[1].trim();
          nome = matchId[2].trim();
          tipo = matchId[3].toUpperCase().includes('ENTROU') ? 'entrada' : 'saida';
        }
        const matchData = l.match(/\[DATA\]:\s*(\d{2})\/(\d{2})\/(\d{4})(?:,?\s*\[HORA\]:?|\s*,)?\s*(\d{2}:\d{2}:\d{2})/i);
        if (matchData) {
          const [, dd, mm, aaaa, hora] = matchData;
          dataISO = aaaa + '-' + mm + '-' + dd + 'T' + hora + '-03:00';
        }
        const matchUuid = l.match(/\[UUID\]:\s*([a-f0-9-]{36})/i);
        if (matchUuid) uuid = matchUuid[1].trim();
      }
      if (!id) return null;
      const ts = dataISO ? new Date(dataISO) : new Date(createdAt);
      return { id: parseInt(id, 10), nome, tipo, timestampz: ts.toISOString(), uuid: uuid || ('ponto-' + id + '-' + ts.getTime()) };
    }

    const evs = (msgs || []).map(m => parsePonto(m.content, m.created_at)).filter(Boolean);
    evs.sort((a,b) => new Date(a.timestampz) - new Date(b.timestampz));

    const turnosReais = [];
    let i = 0;
    while (i < evs.length) {
      const atual = evs[i];
      if (atual.tipo === 'entrada') {
        const tEnt = new Date(atual.timestampz).getTime();
        let saida = null;
        let j = i + 1;
        while (j < evs.length) {
          if (evs[j].tipo === 'entrada') break;
          if (evs[j].tipo === 'saida') { saida = evs[j]; break; }
          j++;
        }
        if (saida) {
          const tSai = new Date(saida.timestampz).getTime();
          const durMin = Math.max(0, Math.round((tSai - tEnt) / 60000));
          turnosReais.push({
            nome: atual.nome,
            usuario_id: atual.id,
            entrada: atual.timestampz,
            saida: saida.timestampz,
            uuid_entrada: atual.uuid,
            uuid_saida: saida.uuid,
            total_minutos: durMin,
            total_segundos: durMin * 60,
            data: getDataCivilBrasilia(new Date(atual.timestampz))
          });
          i = j + 1;
        } else {
          i++;
        }
      } else {
        i++;
      }
    }

    if (turnosReais.length > 1) {
      console.log(`Corrigindo ${s.nome} (${s.data}): de 1 sessao artificial (${(s.total_minutos/60).toFixed(1)}h) para ${turnosReais.length} turnos reais.`);

      // 1. O primeiro turno atualiza o registro s.id
      const primeiro = turnosReais[0];
      const { error: errUpd } = await sb.from('log_ponto').update({
        entrada: primeiro.entrada,
        saida: primeiro.saida,
        uuid_entrada: primeiro.uuid_entrada,
        uuid_saida: primeiro.uuid_saida,
        tipo_fechamento: 'NORMAL',
        total_minutos: primeiro.total_minutos,
        total_segundos: primeiro.total_segundos,
        observacao: 'Turno real retificado via Discord (1º período do dia).'
      }).eq('id', s.id);

      if (errUpd) console.error(`Erro ao atualizar sessao ${s.id}:`, errUpd);

      // 2. Inserir os turnos adicionais
      for (let k = 1; k < turnosReais.length; k++) {
        const extra = turnosReais[k];
        const novoRegistro = {
          mecanica_id: 'reds',
          usuario_id: extra.usuario_id,
          nome: extra.nome,
          data: extra.data,
          entrada: extra.entrada,
          saida: extra.saida,
          uuid_entrada: extra.uuid_entrada,
          uuid_saida: extra.uuid_saida,
          tipo_fechamento: 'NORMAL',
          total_minutos: extra.total_minutos,
          total_segundos: extra.total_segundos,
          qtd_tunagens: 0,
          qtd_bancada: 0,
          total_atividades: 0,
          observacao: `Turno real retificado via Discord (${k+1}º período do dia).`
        };

        const { error: errIns } = await sb.from('log_ponto').insert(novoRegistro);
        if (errIns) console.error(`Erro ao inserir turno extra de ${extra.nome}:`, errIns);
        else totalSessoesNovas++;
      }
      sessoesAjustadas++;
    }
  }

  console.log('\n==================================================================');
  console.log('RETIFICACAO CONCLUIDA!');
  console.log(`• Dias corrigidos de fusao indevida: ${sessoesAjustadas}`);
  console.log(`• Turnos adicionais independentes restaurados: ${totalSessoesNovas}`);
  console.log('==================================================================');
}

retificar();
