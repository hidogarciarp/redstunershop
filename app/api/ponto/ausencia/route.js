import { NextResponse } from "next/server";
import { supabase as supabaseAdmin } from "@/app/utils/supabaseClient";

export const dynamic = "force-dynamic";

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

// GET: Retorna o mapa de ausências ativas de hoje
export async function GET(request) {
  try {
    const agoraSP = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const hojeStr = agoraSP.toLocaleDateString("en-CA");
    const inicioHojeISO = new Date(`${hojeStr}T00:00:00-03:00`).toISOString();

    const { data: logs, error } = await supabaseAdmin
      .from("discord_log_messages")
      .select("id, author_name, content, embed_data, created_at")
      .eq("log_type", "ausencia")
      .gte("created_at", inicioHojeISO)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[API Ausencia] Erro ao buscar logs de ausência:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const mapaAusencias = {};
    (logs || []).forEach((log) => {
      const embed = log.embed_data;
      if (!embed || !embed.idJogo) return;
      const idJogo = String(embed.idJogo);
      if (embed.tipo === "inicio") {
        const desdeMs = new Date(embed.timestamp || log.created_at).getTime();
        mapaAusencias[idJogo] = {
          ausente: true,
          idJogo,
          nome: embed.nome || log.author_name,
          motivo: embed.motivo || "Ausente / Ocupado",
          desdeMs,
          timestampISO: embed.timestamp || log.created_at,
          logId: log.id,
        };
      } else if (embed.tipo === "fim") {
        delete mapaAusencias[idJogo];
      }
    });

    return NextResponse.json({ success: true, ausencias: mapaAusencias });
  } catch (err) {
    console.error("[API Ausencia] Exceção em GET:", err);
    return NextResponse.json({ error: err?.message || "Erro interno" }, { status: 500 });
  }
}

// POST: Inicia ou finaliza ausência de um mecânico
export async function POST(request) {
  try {
    const body = await request.json();
    const { idJogo, nome, acao, motivo, usuarioLogado } = body;

    if (!idJogo || !acao) {
      return NextResponse.json({ error: "Parâmetros obrigatórios ausentes (idJogo, acao)." }, { status: 400 });
    }

    const idJogoStr = String(idJogo).trim();
    const nomeFinal = (nome || usuarioLogado?.nome || `Mecânico #${idJogoStr}`).trim();
    const agora = new Date();
    const agoraISO = agora.toISOString();
    const dataFormatada = formatarDataHoraPtBR(agora);
    const motivoFinal = (motivo || "Ausente / Ocupado").trim();
    const acaoFinal = acao === "iniciar" ? "inicio" : "fim";

    const content = acaoFinal === "inicio"
      ? `[AUSENCIA_INICIO] ID: ${idJogoStr} ${nomeFinal} ausentou-se às ${dataFormatada} - Motivo: ${motivoFinal}`
      : `[AUSENCIA_FIM] ID: ${idJogoStr} ${nomeFinal} retornou ao serviço às ${dataFormatada}`;

    const embedPayload = {
      tipo: acaoFinal,
      idJogo: idJogoStr,
      nome: nomeFinal,
      motivo: acaoFinal === "inicio" ? motivoFinal : null,
      timestamp: agoraISO,
      operador_id: usuarioLogado?.id || null,
      operador_nome: usuarioLogado?.nome || nomeFinal,
    };

    const discordId = `${Date.now()}`;

    const { data: inserido, error } = await supabaseAdmin
      .from("discord_log_messages")
      .insert([
        {
          discord_id: discordId,
          channel_id: "ausencias",
          mechanic_id: "reds",
          log_type: "ausencia",
          author_name: nomeFinal,
          content,
          embed_data: embedPayload,
          created_at: agoraISO,
        },
      ])
      .select();

    if (error) {
      console.error("[API Ausencia] Erro ao gravar ausência no banco:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      acao: acaoFinal,
      ausencia: acaoFinal === "inicio" ? {
        ausente: true,
        idJogo: idJogoStr,
        nome: nomeFinal,
        motivo: motivoFinal,
        desdeMs: agora.getTime(),
        timestampISO: agoraISO,
      } : null,
    });
  } catch (err) {
    console.error("[API Ausencia] Exceção em POST:", err);
    return NextResponse.json({ error: err?.message || "Erro interno" }, { status: 500 });
  }
}
