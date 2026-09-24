import { NextResponse } from "next/server";
import { supabase as supabaseAdmin } from "@/app/utils/supabaseClient";

export const dynamic = "force-dynamic";

const INGEST_SECRET = process.env.DISCORD_BOT_INGEST_SECRET || "rua2_mec_9XkP72sLq_2026_seguro";

function getSupabaseAdmin() {
  return supabaseAdmin;
}

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
    uuid: uuid || `auto-${id}-${dataISO}`
  };
}

async function processarEventoPonto(supabase, mechanicId, evento) {
  const tableMap = {
    reds: "pontos_reds",
    harmony: "ponto_cidade_mecanica_2",
    dudark: "ponto_cidade_mecanica_3",
    vespucci: "ponto_cidade_mecanica_4"
  };

  const tabela = tableMap[mechanicId];
  if (!tabela) return { error: `Mecânica desconhecida: ${mechanicId}` };

  const idJogo = String(evento.id);
  const nome = evento.nome || "Desconhecido";
  const dataISO = evento.dataISO;
  const uuid = evento.uuid;

  if (evento.tipo === "entrada") {
    if (mechanicId === "reds") {
      // 1. Fechar entrada aberta anterior se houver (crash / reconexão)
      const { data: openSession } = await supabase
        .from("pontos_reds")
        .select("*")
        .eq("id", idJogo)
        .is("saida", null)
        .order("entrada", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (openSession?.entrada) {
        const diffMin = Math.min(720, Math.max(0, Math.round((new Date(dataISO).getTime() - new Date(openSession.entrada).getTime()) / 60000)));
        await supabase.from("pontos_reds").update({
          saida: dataISO,
          tempo: diffMin
        }).eq("uuid_entrada", openSession.uuid_entrada);
      }

      // 2. Inserir nova entrada aberta
      const { error } = await supabase.from("pontos_reds").upsert({
        uuid_entrada: uuid,
        uuid_saida: null,
        entrada: dataISO,
        saida: null,
        tempo: 0,
        id: idJogo,
        nome: nome
      }, { onConflict: "uuid_entrada" });

      return { ok: !error, error: error?.message };
    } else {
      // Mecânicas 2, 3, 4
      const { data: openSession } = await supabase
        .from(tabela)
        .select("*")
        .eq("id_jogo", idJogo)
        .is("saida", null)
        .order("entrada", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (openSession?.entrada) {
        await supabase.from(tabela).update({
          saida: dataISO,
          observacao: "Possível crash / reconexão rápida"
        }).eq("uuid_entrada", openSession.uuid_entrada);
      }

      const { error } = await supabase.from(tabela).upsert({
        id_jogo: idJogo,
        nome: nome,
        nome_personagem: nome,
        entrada: dataISO,
        saida: null,
        data: dataISO.substring(0, 10),
        uuid_entrada: uuid,
        uuid_saida: null,
        observacao: "Ponto em andamento ao vivo",
        oculto: false
      }, { onConflict: "uuid_entrada" });

      return { ok: !error, error: error?.message };
    }
  } else if (evento.tipo === "saida") {
    if (mechanicId === "reds") {
      const { data: openSession } = await supabase
        .from("pontos_reds")
        .select("*")
        .eq("id", idJogo)
        .is("saida", null)
        .order("entrada", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (openSession?.entrada) {
        const diffMin = Math.round((new Date(dataISO).getTime() - new Date(openSession.entrada).getTime()) / 60000);
        const tempo = Math.min(720, Math.max(0, diffMin));
        const { error } = await supabase.from("pontos_reds").update({
          saida: dataISO,
          uuid_saida: uuid,
          tempo: tempo
        }).eq("uuid_entrada", openSession.uuid_entrada);

        return { ok: !error, error: error?.message, closed: true };
      }
      return { ok: true, closed: false, note: "Saída sem entrada aberta" };
    } else {
      const { data: openSession } = await supabase
        .from(tabela)
        .select("*")
        .eq("id_jogo", idJogo)
        .is("saida", null)
        .order("entrada", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (openSession?.entrada) {
        const { error } = await supabase.from(tabela).update({
          saida: dataISO,
          uuid_saida: uuid,
          observacao: null
        }).eq("uuid_entrada", openSession.uuid_entrada);

        return { ok: !error, error: error?.message, closed: true };
      }
      return { ok: true, closed: false, note: "Saída sem entrada aberta" };
    }
  }

  return { ok: true };
}

export async function POST(request) {
  try {
    const secret = request.headers.get("x-bot-secret") || new URL(request.url).searchParams.get("secret");
    if (secret !== INGEST_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await request.json().catch(() => ({}));
    let mechanicId = payload.mechanic_id;
    const channelId = payload.channel_id;
    const content = payload.content;

    if (!mechanicId && channelId) {
      if (channelId === "1388991065226346718") mechanicId = "reds";
      else if (channelId === "1504297353824178226") mechanicId = "dudark";
      else if (channelId === "1535045942288326837") mechanicId = "vespucci";
      else if (channelId === "1389735866515066900") mechanicId = "harmony";
    }

    if (!content) {
      return NextResponse.json({ error: "content is required" }, { status: 400 });
    }

    const evento = parsePonto(content);
    if (!evento) {
      return NextResponse.json({ ok: false, error: "Formato de ponto inválido" }, { status: 422 });
    }

    const supabase = getSupabaseAdmin();
    const result = await processarEventoPonto(supabase, mechanicId || "reds", evento);

    return NextResponse.json({
      ok: true,
      mechanic_id: mechanicId,
      evento,
      result
    });
  } catch (err) {
    console.error("Erro no ingest de ponto:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  if (action === "sync") {
    // Sincronização sob demanda
    try {
      const supabase = getSupabaseAdmin();
      const dataLimite = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

      const { data: msgs, error } = await supabase
        .from("discord_log_messages")
        .select("id, channel_id, mechanic_id, content, created_at")
        .eq("log_type", "ponto")
        .gte("created_at", dataLimite)
        .order("created_at", { ascending: true })
        .limit(1000);

      if (error) throw error;

      let count = 0;
      for (const m of msgs || []) {
        const ev = parsePonto(m.content);
        if (!ev) continue;
        let mec = m.mechanic_id;
        if (!mec) {
          if (m.channel_id === "1388991065226346718") mec = "reds";
          else if (m.channel_id === "1504297353824178226") mec = "dudark";
          else if (m.channel_id === "1535045942288326837") mec = "vespucci";
          else if (m.channel_id === "1389735866515066900") mec = "harmony";
        }
        if (mec) {
          await processarEventoPonto(supabase, mec, ev);
          count++;
        }
      }

      return NextResponse.json({ ok: true, processed: count, message: "Sincronização concluída." });
    } catch (err) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    status: "online",
    service: "registro-servicos-logs-ingest",
    time: new Date().toISOString()
  });
}
