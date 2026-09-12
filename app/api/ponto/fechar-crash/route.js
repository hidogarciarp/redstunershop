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
  return `${dia}/${mes}/${ano}, ${hora}:${min}:${seg}`;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      funcionarioInspecao,
      justificativaCrash,
      printCrashBase64,
      saidaDataHoraCrash,
      usuarioLogado,
    } = body;

    if (!funcionarioInspecao) {
      return NextResponse.json({ error: "Dados do funcionário ausentes." }, { status: 400 });
    }

    if (!justificativaCrash || !justificativaCrash.trim()) {
      return NextResponse.json(
        { error: "Por favor, informe a justificativa do crash." },
        { status: 400 }
      );
    }

    if (!printCrashBase64) {
      return NextResponse.json(
        { error: "É obrigatório anexar o print do crash ou comprovante." },
        { status: 400 }
      );
    }

    if (!saidaDataHoraCrash) {
      return NextResponse.json(
        { error: "Por favor, informe a data e horário de saída do crash." },
        { status: 400 }
      );
    }

    const dataSaidaObj = new Date(saidaDataHoraCrash);
    if (Number.isNaN(dataSaidaObj.getTime())) {
      return NextResponse.json({ error: "Data/hora de saída inválida." }, { status: 400 });
    }

    const dataEntradaObj = new Date(funcionarioInspecao.entrada);
    if (!Number.isNaN(dataEntradaObj.getTime()) && dataSaidaObj < dataEntradaObj) {
      return NextResponse.json(
        { error: "O horário de saída do crash não pode ser anterior ao horário de entrada!" },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    const dataFormatadaDiscord = formatarDataHoraPtBR(dataSaidaObj);
    const idJogo = funcionarioInspecao.idJogo;
    const nome = funcionarioInspecao.nome;
    const oficina = funcionarioInspecao.oficina || "Red's Tunershop";
    const oficinaId = funcionarioInspecao.oficinaId || "reds";
    const dataSaidaISO = dataSaidaObj.toISOString();
    const fechadoPorNome = usuarioLogado?.nome || "Admin";
    const fechadoPorId = usuarioLogado?.id || null;

    const contentDiscord = [
      `[ID]: ${idJogo} ${nome} ( SAIU DE SERVIÇO - ${oficina} )`,
      `[DATA]: ${dataFormatadaDiscord}`,
      `[MOTIVO_CRASH]: ${justificativaCrash.trim()}`,
      `[FECHADO_POR]: ${fechadoPorNome}`,
      `[UUID]: manual-crash-${Date.now()}`,
    ].join("\n");

    const embedDataPayload = {
      motivo: "crash",
      justificativa: justificativaCrash.trim(),
      fechado_por_nome: fechadoPorNome,
      fechado_por_id: fechadoPorId,
      imagem_comprovante: printCrashBase64,
      horario_saida_manual: dataSaidaISO,
      tipo_fechamento: "manual_crash",
      criado_em: new Date().toISOString(),
    };

    const canalId = CANAIS_PONTO[oficinaId] || "manual-crash";
    const snowflake = calcularSnowflake(dataSaidaObj) || String(Date.now());

    // 1. Inserir log no discord_log_messages usando service_role (bypassa RLS)
    const { data: logInserido, error: discordError } = await supabaseAdmin
      .from("discord_log_messages")
      .insert([
        {
          discord_id: snowflake,
          channel_id: canalId,
          mechanic_id: oficinaId,
          log_type: "ponto",
          author_name: `${fechadoPorNome} (Fechamento Manual / Crash)`,
          content: contentDiscord,
          embed_data: embedDataPayload,
          created_at: dataSaidaISO,
        },
      ])
      .select();

    if (discordError) {
      console.error("[Fechar-Crash] Erro ao inserir log de saída por crash:", discordError);
      return NextResponse.json({ error: discordError.message }, { status: 500 });
    }

    // 2. Atualizar tabela ponto_horas
    try {
      await supabaseAdmin
        .from("ponto_horas")
        .update({
          saida: dataSaidaISO,
          verificado: true,
          verificado_por: fechadoPorNome,
        })
        .eq("nome", nome)
        .is("saida", null);
    } catch (e) {
      console.warn("[Fechar-Crash] Aviso ao atualizar ponto_horas:", e);
    }

    // 3. Atualizar sessões na tabela sessoes_ponto_auditoria_reds se houver registro aberto
    try {
      const entTs = dataEntradaObj.getTime();
      const saidaTs = dataSaidaObj.getTime();
      const durMin = !isNaN(entTs) ? Math.max(0, Math.round((saidaTs - entTs) / 60000)) : 0;

      await supabaseAdmin
        .from("sessoes_ponto_auditoria_reds")
        .update({
          saida: dataSaidaISO,
          duracao_min: durMin,
          status_ponto: "manual_crash",
          motivo_crash: "crash",
          justificativa: justificativaCrash.trim(),
          comprovante_img: printCrashBase64,
          fechado_por: fechadoPorNome,
          updated_at: new Date().toISOString(),
        })
        .eq("id_jogo", String(idJogo))
        .is("saida", null);
    } catch (e) {
      console.warn("[Fechar-Crash] Aviso ao atualizar sessoes_ponto_auditoria_reds:", e);
    }

    // 4. Atualizar pontos_reds se houver registro aberto
    try {
      const entTs = dataEntradaObj.getTime();
      const saidaTs = dataSaidaObj.getTime();
      const durMin = !isNaN(entTs) ? Math.max(0, Math.round((saidaTs - entTs) / 60000)) : 0;

      await supabaseAdmin
        .from("pontos_reds")
        .update({
          saida: dataSaidaISO,
          tempo: durMin,
          observacao: `[Fechamento Manual / Crash]: ${justificativaCrash.trim()} (por ${fechadoPorNome})`,
        })
        .eq("id", String(idJogo))
        .is("saida", null);
    } catch (e) {
      console.warn("[Fechar-Crash] Aviso ao atualizar pontos_reds:", e);
    }

    return NextResponse.json({
      success: true,
      message: "Ponto fechado com sucesso por motivo de Crash!",
      id: logInserido?.[0]?.id,
    });
  } catch (err) {
    console.error("[Fechar-Crash] Exceção na rota de fechamento por crash:", err);
    return NextResponse.json({ error: err?.message || "Erro interno no servidor" }, { status: 500 });
  }
}
