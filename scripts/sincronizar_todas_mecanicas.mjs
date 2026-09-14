import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

// Carregar chaves
const CONFIG = {
  supabaseUrl: "https://prperurjtvayjrazdxvh.supabase.co",
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY || ""
};

try {
  const envPath = path.resolve("c:/Users/Garrido/Bot-rua2-pontos/.env.local");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf8");
    const urlMatch = content.match(/SUPABASE_URL\s*=\s*(.+)/);
    const keyMatch = content.match(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*(.+)/);
    if (urlMatch) CONFIG.supabaseUrl = urlMatch[1].trim();
    if (keyMatch) CONFIG.supabaseKey = keyMatch[1].trim();
  }
} catch (e) {
  console.log("Aviso ao carregar .env.local:", e.message);
}

const supabase = createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey);

function parsePonto(rawText) {
  if (!rawText) return null;
  const clean = String(rawText).replace(/```ini/gi, "").replace(/```/g, "");
  const lines = clean.split("\n");
  let id = null, nome = null, tipo = null, dataISO = null, uuid = null;

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    const matchId = l.match(/^\[ID\]:\s*(\d+)\s+(.+?)\s*\(\s*(ENTROU EM SERVI[ÇC]O|SAIU DE SERVI[ÇC]O)/i);
    if (matchId) {
      id = matchId[1].trim();
      nome = matchId[2].trim();
      tipo = matchId[3].toUpperCase().includes("ENTROU") ? "entrada" : "saida";
    }
    const matchData = l.match(/\[DATA\]:\s*(\d{2})\/(\d{2})\/(\d{4})(?:,?\s*\[HORA\]:?|\s*,)?\s*(\d{2}:\d{2}:\d{2})/i);
    if (matchData) {
      const [, dd, mm, aaaa, hora] = matchData;
      dataISO = `${aaaa}-${mm}-${dd}T${hora}-03:00`;
    }
    const matchUuid = l.match(/\[UUID\]:\s*([a-f0-9-]{36})/i);
    if (matchUuid) uuid = matchUuid[1].trim();
  }

  if (!id || !dataISO) return null;
  return {
    id,
    nome,
    tipo,
    dataISO,
    timestamp: new Date(dataISO).getTime(),
    uuid: uuid || `auto-${id}-${dataISO}`
  };
}

function processarEventos(eventos) {
  const porFuncionario = {};
  eventos.forEach(ev => {
    if (!porFuncionario[ev.id]) porFuncionario[ev.id] = [];
    porFuncionario[ev.id].push(ev);
  });

  const sessoes = [];
  const agora = Date.now();

  for (const [idJogo, lista] of Object.entries(porFuncionario)) {
    lista.sort((a, b) => a.timestamp - b.timestamp);

    let pontoAberto = null;

    for (let i = 0; i < lista.length; i++) {
      const ev = lista[i];

      if (ev.tipo === "entrada") {
        if (pontoAberto) {
          // Possível crash / reconexão rápida
          const diffMin = Math.max(0, Math.round((ev.timestamp - pontoAberto.timestamp) / 60000));
          const cappedMin = Math.min(diffMin, 720);
          sessoes.push({
            id: pontoAberto.id,
            nome: pontoAberto.nome,
            entrada: pontoAberto.dataISO,
            saida: ev.dataISO,
            tempo: cappedMin,
            uuid_entrada: pontoAberto.uuid,
            uuid_saida: null,
            observacao: "Possível crash / reconexão rápida"
          });
        }
        pontoAberto = ev;
      } else if (ev.tipo === "saida") {
        if (pontoAberto) {
          const diffMin = Math.max(0, Math.round((ev.timestamp - pontoAberto.timestamp) / 60000));
          if (diffMin <= 720) {
            sessoes.push({
              id: pontoAberto.id,
              nome: pontoAberto.nome,
              entrada: pontoAberto.dataISO,
              saida: ev.dataISO,
              tempo: diffMin,
              uuid_entrada: pontoAberto.uuid,
              uuid_saida: ev.uuid,
              observacao: diffMin <= 0 ? "Miss-click (≤ 10s)" : null
            });
            pontoAberto = null;
          } else {
            const dataMax = new Date(pontoAberto.timestamp + 12 * 3600000).toISOString();
            sessoes.push({
              id: pontoAberto.id,
              nome: pontoAberto.nome,
              entrada: pontoAberto.dataISO,
              saida: dataMax,
              tempo: 720,
              uuid_entrada: pontoAberto.uuid,
              uuid_saida: null,
              observacao: "Fechado automaticamente no limite de 12h"
            });
            pontoAberto = null;
          }
        }
      }
    }

    if (pontoAberto) {
      const diffMin = Math.max(0, Math.round((agora - pontoAberto.timestamp) / 60000));
      if (diffMin <= 120) {
        sessoes.push({
          id: pontoAberto.id,
          nome: pontoAberto.nome,
          entrada: pontoAberto.dataISO,
          saida: null,
          tempo: 0,
          uuid_entrada: pontoAberto.uuid,
          uuid_saida: null,
          observacao: "Ponto em andamento ao vivo"
        });
      } else {
        sessoes.push({
          id: pontoAberto.id,
          nome: pontoAberto.nome,
          entrada: pontoAberto.dataISO,
          saida: pontoAberto.dataISO,
          tempo: 0,
          uuid_entrada: pontoAberto.uuid,
          uuid_saida: null,
          observacao: "Fechado automaticamente (sem saída registrada)"
        });
      }
    }
  }

  return sessoes;
}

async function sincronizarTudo() {
  console.log("🚀 Iniciando sincronização retroativa de todas as mecânicas...");

  const dataLimite = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  
  let page = 0;
  const pageSize = 1000;
  let allMsgs = [];

  while (true) {
    const { data, error } = await supabase.from("discord_log_messages")
      .select("id, channel_id, mechanic_id, content, created_at")
      .eq("log_type", "ponto")
      .gte("created_at", dataLimite)
      .order("created_at", { ascending: true })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.error("Erro ao buscar logs:", error);
      break;
    }
    if (!data || data.length === 0) break;
    allMsgs = allMsgs.concat(data);
    if (data.length < pageSize) break;
    page++;
  }

  console.log(`📦 Total de mensagens brutas de ponto recuperadas: ${allMsgs.length}`);

  const eventosPorMec = { reds: [], dudark: [], vespucci: [], harmony: [] };

  allMsgs.forEach(m => {
    const parsed = parsePonto(m.content);
    if (!parsed) return;

    let mec = m.mechanic_id;
    if (!mec) {
      if (m.channel_id === "1388991065226346718") mec = "reds";
      else if (m.channel_id === "1504297353824178226") mec = "dudark";
      else if (m.channel_id === "1535045942288326837") mec = "vespucci";
      else if (m.channel_id === "1389735866515066900") mec = "harmony";
    }

    if (eventosPorMec[mec]) {
      eventosPorMec[mec].push(parsed);
    }
  });

  // 1. Red's Tunershop -> pontos_reds
  const sessoesReds = processarEventos(eventosPorMec.reds);
  console.log(`🔧 Red's: ${eventosPorMec.reds.length} eventos -> ${sessoesReds.length} sessões geradas.`);
  if (sessoesReds.length > 0) {
    for (let i = 0; i < sessoesReds.length; i += 50) {
      const lote = sessoesReds.slice(i, i + 50).map(({ observacao, ...rest }) => rest);
      const { error } = await supabase.from("pontos_reds").upsert(lote, { onConflict: "uuid_entrada" });
      if (error) console.error("Erro ao upsert pontos_reds:", error.message);
    }
    console.log("✅ Red's sincronizado com sucesso na tabela pontos_reds!");
  }

  // 2. Dudark -> ponto_cidade_mecanica_3
  const sessoesDudark = processarEventos(eventosPorMec.dudark);
  console.log(`🔧 Dudark: ${eventosPorMec.dudark.length} eventos -> ${sessoesDudark.length} sessões geradas.`);
  if (sessoesDudark.length > 0) {
    const registrosM3 = sessoesDudark.map(s => ({
      id_jogo: String(s.id),
      nome: s.nome,
      nome_personagem: s.nome,
      entrada: s.entrada,
      saida: s.saida,
      data: s.entrada ? s.entrada.substring(0, 10) : new Date().toISOString().substring(0, 10),
      uuid_entrada: s.uuid_entrada,
      uuid_saida: s.uuid_saida,
      observacao: s.observacao,
      oculto: false
    }));

    for (let i = 0; i < registrosM3.length; i += 50) {
      const lote = registrosM3.slice(i, i + 50);
      const { error } = await supabase.from("ponto_cidade_mecanica_3").upsert(lote, { onConflict: "uuid_entrada" });
      if (error) console.error("Erro ao upsert ponto_cidade_mecanica_3:", error.message);
    }
    console.log("✅ Dudark sincronizado com sucesso na tabela ponto_cidade_mecanica_3!");
  }

  // 3. Vespucci -> ponto_cidade_mecanica_4
  const sessoesVespucci = processarEventos(eventosPorMec.vespucci);
  console.log(`🔧 Vespucci: ${eventosPorMec.vespucci.length} eventos -> ${sessoesVespucci.length} sessões geradas.`);
  if (sessoesVespucci.length > 0) {
    const registrosM4 = sessoesVespucci.map(s => ({
      id_jogo: String(s.id),
      nome: s.nome,
      nome_personagem: s.nome,
      entrada: s.entrada,
      saida: s.saida,
      data: s.entrada ? s.entrada.substring(0, 10) : new Date().toISOString().substring(0, 10),
      uuid_entrada: s.uuid_entrada,
      uuid_saida: s.uuid_saida,
      observacao: s.observacao,
      oculto: false
    }));

    for (let i = 0; i < registrosM4.length; i += 50) {
      const lote = registrosM4.slice(i, i + 50);
      const { error } = await supabase.from("ponto_cidade_mecanica_4").upsert(lote, { onConflict: "uuid_entrada" });
      if (error) console.error("Erro ao upsert ponto_cidade_mecanica_4:", error.message);
    }
    console.log("✅ Vespucci sincronizado com sucesso na tabela ponto_cidade_mecanica_4!");
  }

  // 4. Harmony -> ponto_cidade_mecanica_2
  const sessoesHarmony = processarEventos(eventosPorMec.harmony);
  console.log(`🔧 Harmony: ${eventosPorMec.harmony.length} eventos -> ${sessoesHarmony.length} sessões geradas.`);
  if (sessoesHarmony.length > 0) {
    const registrosM2 = sessoesHarmony.map(s => ({
      id_jogo: String(s.id),
      nome: s.nome,
      nome_personagem: s.nome,
      entrada: s.entrada,
      saida: s.saida,
      data: s.entrada ? s.entrada.substring(0, 10) : new Date().toISOString().substring(0, 10),
      uuid_entrada: s.uuid_entrada,
      uuid_saida: s.uuid_saida,
      observacao: s.observacao,
      oculto: false
    }));

    for (let i = 0; i < registrosM2.length; i += 50) {
      const lote = registrosM2.slice(i, i + 50);
      const { error } = await supabase.from("ponto_cidade_mecanica_2").upsert(lote, { onConflict: "uuid_entrada" });
      if (error) console.error("Erro ao upsert ponto_cidade_mecanica_2:", error.message);
    }
    console.log("✅ Harmony sincronizado com sucesso na tabela ponto_cidade_mecanica_2!");
  }

  console.log("🎉 Sincronização concluída com sucesso!");
}

sincronizarTudo();
