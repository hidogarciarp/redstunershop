import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const CANAIS_PONTO = {
  reds: process.env.REDS_CHANNEL_ID || "1388991065226346718",
  harmony: process.env.HARMONY_CHANNEL_ID || "1389735866515066900",
  dudark: process.env.DUDARK_CHANNEL_ID || "1504297353824178226",
  vespucci: process.env.VESPUCCI_CHANNEL_ID || "1535045942288326837",
};

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://prperurjtvayjrazdxvh.supabase.co";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function calcularSnowflake(dateObj) {
  const discordEpoch = 1420070400000n;
  const ts = BigInt(dateObj.getTime());
  return ((ts - discordEpoch) << 22n).toString();
}

function formatarDataHoraPtBR(dateObj) {
  const spDate = new Date(dateObj.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const dia = String(spDate.getDate()).padStart(2, "0");
  const mes = String(spDate.getMonth() + 1).padStart(2, "0");
  const ano = spDate.getFullYear();
  const hora = String(spDate.getHours()).padStart(2, "0");
  const min = String(spDate.getMinutes()).padStart(2, "0");
  const seg = String(spDate.getSeconds()).padStart(2, "0");
  return {
    dataStr: `${dia}/${mes}/${ano}`,
    horaStr: `${hora}:${min}:${seg}`,
  };
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { idJogo, nome, oficina, oficinaId = "reds", timestamp, motivo = "bancada" } = body;

    if (!idJogo || idJogo === "0" || String(idJogo).trim() === "0" || !timestamp) {
      return NextResponse.json(
        { error: "Campos obrigatórios ausentes ou ID 0 inválido." },
        { status: 400 }
      );
    }

    const nomeStr = String(nome || "").toLowerCase();
    if (nomeStr.includes("simulador") || nomeStr.includes("orçamento") || nomeStr.includes("orcamento")) {
      return NextResponse.json(
        { error: "Simulador / Orçamento não pode ter ponto registrado." },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    const targetDate = new Date(timestamp);
    if (Number.isNaN(targetDate.getTime())) {
      return NextResponse.json({ error: "Timestamp inválido." }, { status: 400 });
    }

    // Janela de deduplicação: +/- 45 minutos em torno do timestamp
    const janelaInicio = new Date(targetDate.getTime() - 45 * 60 * 1000).toISOString();
    const janelaFim = new Date(targetDate.getTime() + 45 * 60 * 1000).toISOString();

    // 1. Verifica se já existe log de ponto para este mecânico nesta janela
    const { data: existentes, error: buscaError } = await supabaseAdmin
      .from("discord_log_messages")
      .select("id, content, created_at")
      .eq("log_type", "ponto")
      .gte("created_at", janelaInicio)
      .lte("created_at", janelaFim);

    if (buscaError) {
      console.error("[Auto-Recuperação] Erro ao verificar logs existentes:", buscaError);
      return NextResponse.json({ error: buscaError.message }, { status: 500 });
    }

    const idRegex = new RegExp(`\\[ID\\]:\\s*${idJogo}\\b`, "i");
    const pontoJaExiste = (existentes || []).some((msg) => idRegex.test(msg.content || ""));

    if (pontoJaExiste) {
      return NextResponse.json({
        success: true,
        inserted: false,
        message: `Mecânico ID ${idJogo} já possui registro de ponto na janela de 45 minutos.`,
      });
    }

    // 2. Prepara inserção do novo registro
    const canalId = CANAIS_PONTO[oficinaId] || CANAIS_PONTO.reds;
    const nomeOficina = oficina || (oficinaId === "vespucci" ? "Beach Tunershop" : "Reds Tunnershop");
    const nomeMecanico = nome || `Mecânico ${idJogo}`;
    const { dataStr, horaStr } = formatarDataHoraPtBR(targetDate);
    const uuidUnico = `auto-recuperado-${idJogo}-${Date.now()}`;
    const snowflake = calcularSnowflake(targetDate);

    const contentFormatado = [
      "```ini",
      `[ID]: ${idJogo} ${nomeMecanico} ( ENTROU EM SERVIÇO - ${nomeOficina} )`,
      "```",
      "```ini",
      `[DATA]: ${dataStr}, ${horaStr}`,
      `[UUID]: ${uuidUnico}`,
      "```",
    ].join("\n");

    const novoLog = {
      discord_id: snowflake,
      channel_id: canalId,
      mechanic_id: oficinaId,
      log_type: "ponto",
      author_name: "RUA2 - Logs (Auto-Recuperado)",
      webhook_id: "1389737650985898095",
      content: contentFormatado,
      embed_data: [
        {
          tipo_recuperacao: "auto_recuperacao_atividade",
          motivo,
          recuperado_em: new Date().toISOString(),
        },
      ],
      created_at: targetDate.toISOString(),
    };

    const { data: inserido, error: insertError } = await supabaseAdmin
      .from("discord_log_messages")
      .insert([novoLog])
      .select();

    if (insertError) {
      console.error("[Auto-Recuperação] Falha ao inserir ponto recuperado:", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    console.log(`[Auto-Recuperação] Ponto recuperado e inserido com sucesso para ID ${idJogo} (${nomeMecanico}) às ${horaStr}`);

    return NextResponse.json({
      success: true,
      inserted: true,
      id: inserido?.[0]?.id,
      mecanico: nomeMecanico,
      timestamp: targetDate.toISOString(),
    });
  } catch (err) {
    console.error("[Auto-Recuperação] Exceção na rota de recuperação:", err);
    return NextResponse.json({ error: err?.message || "Erro interno" }, { status: 500 });
  }
}
