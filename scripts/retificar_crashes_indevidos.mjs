import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const url = "https://sxrfkbjbyjdmyyxbzobb.supabase.co";
const key = "sb_publishable_et87L-NCrieyXmvteW84-w_v9cxAbjG";
const sb = createClient(url, key);

async function main() {
  console.log("=============================================================");
  console.log("   INICIANDO RETIFICAÇÃO DE REGISTROS DE CRASH INDEVIDOS     ");
  console.log("=============================================================\n");

  // 1. Carregar todas as Tunagens do banco para indexação em memória
  console.log("📦 Carregando todas as tunagens para indexação...");
  const todasTunagens = [];
  let pageTun = 0;
  while (true) {
    const { data, error } = await sb
      .from("log_tunagem")
      .select("uuid, tecnico_id, data, hora, timestampz, veiculo_nome, valor_pago")
      .range(pageTun * 1000, (pageTun + 1) * 1000 - 1);
    if (error) {
      console.error("Erro ao carregar tunagens:", error);
      process.exit(1);
    }
    if (!data || data.length === 0) break;
    todasTunagens.push(...data);
    pageTun++;
  }
  console.log(`✅ ${todasTunagens.length} tunagens carregadas.`);

  // 2. Carregar todas as Bancadas do banco para indexação em memória
  console.log("📦 Carregando todas as bancadas para indexação...");
  const todasBancadas = [];
  let pageBanc = 0;
  while (true) {
    const { data, error } = await sb
      .from("log_bancada")
      .select("uuid, usuario_id, data, hora, timestampz, item_craftado, quantidade")
      .range(pageBanc * 1000, (pageBanc + 1) * 1000 - 1);
    if (error) {
      console.error("Erro ao carregar bancadas:", error);
      process.exit(1);
    }
    if (!data || data.length === 0) break;
    todasBancadas.push(...data);
    pageBanc++;
  }
  console.log(`✅ ${todasBancadas.length} itens de bancada carregados.`);

  // 3. Montar mapa de atividades por mecânico e data
  const atividadesPorMecData = new Map();

  for (const t of todasTunagens) {
    if (!t.tecnico_id || !t.data || !t.timestampz) continue;
    const key = `${String(t.tecnico_id)}_${t.data}`;
    if (!atividadesPorMecData.has(key)) atividadesPorMecData.set(key, []);
    atividadesPorMecData.get(key).push({
      tipo: "tunagem",
      uuid: t.uuid,
      hora: t.hora,
      timestampz: t.timestampz,
      timestampMs: new Date(t.timestampz).getTime(),
      desc: `Tunagem: ${t.veiculo_nome}`,
    });
  }

  for (const b of todasBancadas) {
    if (!b.usuario_id || !b.data || !b.timestampz) continue;
    const key = `${String(b.usuario_id)}_${b.data}`;
    if (!atividadesPorMecData.has(key)) atividadesPorMecData.set(key, []);
    atividadesPorMecData.get(key).push({
      tipo: "bancada",
      uuid: b.uuid,
      hora: b.hora,
      timestampz: b.timestampz,
      timestampMs: new Date(b.timestampz).getTime(),
      desc: `Bancada: ${b.quantidade}x ${b.item_craftado}`,
    });
  }

  // Ordenar atividades por horário em cada chave
  for (const [k, arr] of atividadesPorMecData.entries()) {
    arr.sort((a, b) => a.timestampMs - b.timestampMs);
  }
  console.log(`✅ Mapa de atividades compilado com ${atividadesPorMecData.size} chaves (mecânico x dia).\n`);

  // 4. Buscar todos os registros afetados em log_ponto
  console.log("🔍 Buscando registros afetados em log_ponto (CRASH_AUTO ou CRASH_SEM_ATIVIDADE > 1min)...");
  const registrosAfetados = [];
  let pagePonto = 0;
  while (true) {
    const { data, error } = await sb
      .from("log_ponto")
      .select("*")
      .or("uuid_saida.eq.CRASH_AUTO,and(tipo_fechamento.eq.CRASH_SEM_ATIVIDADE,total_minutos.gt.1)")
      .range(pagePonto * 1000, (pagePonto + 1) * 1000 - 1);
    if (error) {
      console.error("Erro ao carregar log_ponto:", error);
      process.exit(1);
    }
    if (!data || data.length === 0) break;
    registrosAfetados.push(...data);
    pagePonto++;
  }
  console.log(`📋 Total de registros afetados identificados: ${registrosAfetados.length}`);

  // 5. Salvar backup local de segurança em JSON
  const backupDir = path.resolve("scratch");
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, "backup_log_ponto_crashes_antes_retificacao.json");
  fs.writeFileSync(backupPath, JSON.stringify(registrosAfetados, null, 2), "utf8");
  console.log(`💾 Backup de segurança gravado em: ${backupPath} (${(fs.statSync(backupPath).size / 1024 / 1024).toFixed(2)} MB)\n`);

  // 6. Analisar e preparar retificações
  console.log("⚙️ Processando re-auditoria de cada sessão contra atividades reais...");
  let countComAtividade = 0;
  let countSemAtividade = 0;
  let minutosOriginais = 0;
  let minutosRetificados = 0;

  const registrosAtualizados = [];

  for (const r of registrosAfetados) {
    minutosOriginais += r.total_minutos || 0;
    const dEnt = new Date(r.entrada).getTime();
    const dSaiOriginal = new Date(r.saida).getTime();

    const key = `${String(r.usuario_id)}_${r.data}`;
    const atividadesDoDia = atividadesPorMecData.get(key) || [];

    // Atividades no intervalo da sessão (com tolerância de 5 segundos)
    const atvsNoIntervalo = atividadesDoDia.filter(
      (a) => a.timestampMs >= dEnt - 5000 && a.timestampMs <= dSaiOriginal + 5000
    );

    let newSaida;
    let newTipoFechamento;
    let newUuidSaida;
    let diffSeg;
    let observacao;

    if (atvsNoIntervalo.length > 0) {
      countComAtividade++;
      const ultimaAtv = atvsNoIntervalo[atvsNoIntervalo.length - 1];
      const timeUltima = Math.max(dEnt + 60000, ultimaAtv.timestampMs + 1000);
      newSaida = new Date(timeUltima).toISOString();
      diffSeg = Math.max(60, Math.round((timeUltima - dEnt) / 1000));
      newTipoFechamento = "CRASH_COM_ATIVIDADE";
      newUuidSaida = `CRASH_${ultimaAtv.tipo === "tunagem" ? "TUN" : "BANC"}_${ultimaAtv.uuid}`;
      observacao = `Auditado e retificado: fechado na última atividade comprovada (${ultimaAtv.hora}).`;
    } else {
      countSemAtividade++;
      const time1Min = dEnt + 60000;
      newSaida = new Date(time1Min).toISOString();
      diffSeg = 60;
      newTipoFechamento = "CRASH_SEM_ATIVIDADE";
      newUuidSaida = "CRASH_SEM_ATIVIDADE";
      observacao = "Auditado e retificado: crash sem atividade reduzido para 1 minuto (Regra 3).";
    }

    const totalMinutos = Math.round(diffSeg / 60);
    minutosRetificados += totalMinutos;

    registrosAtualizados.push({
      ...r,
      saida: newSaida,
      uuid_saida: newUuidSaida,
      tipo_fechamento: newTipoFechamento,
      total_minutos: totalMinutos,
      total_segundos: diffSeg,
      observacao: observacao,
    });
  }

  console.log(`📊 Resultado da Re-auditoria:`);
  console.log(`   - Sessões com Atividade Comprovada (reancoradas): ${countComAtividade}`);
  console.log(`   - Sessões Sem Nenhuma Atividade (reduzidas para 1 min): ${countSemAtividade}`);
  console.log(`   - Minutos antes: ${minutosOriginais} min (${(minutosOriginais / 60).toFixed(1)} h)`);
  console.log(`   - Minutos depois: ${minutosRetificados} min (${(minutosRetificados / 60).toFixed(1)} h)`);
  const diffHoras = ((minutosOriginais - minutosRetificados) / 60).toFixed(1);
  console.log(`   - HORAS FANTASMAS ELIMINADAS: ${diffHoras} horas!\n`);

  // 7. Gravar atualizações no banco em lotes de 100
  console.log("🚀 Aplicando atualizações no Supabase em lotes de 100...");
  const BATCH_SIZE = 100;
  let gravados = 0;

  for (let i = 0; i < registrosAtualizados.length; i += BATCH_SIZE) {
    const chunk = registrosAtualizados.slice(i, i + BATCH_SIZE);
    const { error } = await sb.from("log_ponto").upsert(chunk, { onConflict: "id" });
    if (error) {
      console.error(`❌ Erro no lote ${i} - ${i + chunk.length}:`, error);
      process.exit(1);
    }
    gravados += chunk.length;
    process.stdout.write(`\r   Progresso: ${gravados} / ${registrosAtualizados.length} registros gravados (${Math.round((gravados / registrosAtualizados.length) * 100)}%)`);
  }

  console.log("\n\n✅ GRAVAÇÃO CONCLUÍDA COM SUCESSO!");

  // 8. Verificação pós-retificação
  const { count: restantesCrashAuto } = await sb
    .from("log_ponto")
    .select("id", { count: "exact", head: true })
    .eq("uuid_saida", "CRASH_AUTO");

  const { count: restantes60MinSemAtiv } = await sb
    .from("log_ponto")
    .select("id", { count: "exact", head: true })
    .eq("tipo_fechamento", "CRASH_SEM_ATIVIDADE")
    .gt("total_minutos", 1);

  console.log(`\n🔍 Verificação no Banco:`);
  console.log(`   - Restantes com uuid_saida = 'CRASH_AUTO': ${restantesCrashAuto} (esperado: 0)`);
  console.log(`   - Restantes com CRASH_SEM_ATIVIDADE > 1min: ${restantes60MinSemAtiv} (esperado: 0)`);
  console.log("\n=============================================================");
  console.log("   BANCO DE DADOS HIGIENIZADO CONFORME A REGRA 3 OFICIAL!    ");
  console.log("=============================================================");
}

main().catch(console.error);
