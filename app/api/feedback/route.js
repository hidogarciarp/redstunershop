import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getSupabaseClient() {
  const url =
    process.env.NEXT_PUBLIC_NEW_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "https://prperurjtvayjrazdxvh.supabase.co";
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_NEW_SUPABASE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "";
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const CATEGORIA_LABELS = {
  dificuldades: "🔧 Dificuldades do Dia a Dia (Bugs / Cidade)",
  estoque: "📦 Estoque & Recursos (Peças / Bancada / Baú)",
  atendimento: "🏪 Atendimento & Concorrência",
  interno: "📌 Problemas Internos & Convivência",
  sugestoes: "💡 Sugestão de Melhoria",
  outros: "💬 Outros Assuntos",
};

const CATEGORIA_CORES = {
  dificuldades: 0xef4444, // Vermelho
  estoque: 0xf59e0b,      // Âmbar
  atendimento: 0x3b82f6,  // Azul
  interno: 0xa855f7,      // Roxo
  sugestoes: 0x10b981,    // Verde
  outros: 0x64748b,       // Cinza
};

async function enviarNotificacaoDiscord(feedback) {
  const webhookUrl =
    process.env.DISCORD_WEBHOOK_REPORT ||
    "https://discord.com/api/webhooks/1548094785573617768/grgXpJw1AaCLkqgaBR298iXEzBuCHTk6zP2qHa3WNOU_pbEFNr7lp79ANT_LnIvJRpJF";

  if (!webhookUrl) return;

  const autorTexto = feedback.anonimo
    ? "🕵️‍♂️ Anônimo (Mecânico da RED'S)"
    : `👤 ${feedback.usuario_nome || "Colaborador"} ${feedback.usuario_id ? `(ID: ${feedback.usuario_id})` : ""} - ${feedback.usuario_cargo || "Mecânico"}`;

  const catLabel = CATEGORIA_LABELS[feedback.categoria] || feedback.categoria;
  const embedColor = CATEGORIA_CORES[feedback.categoria] || 0xef4444;

  const embed = {
    title: `📢 Novo Feedback da Equipe (${feedback.categoria.toUpperCase()})`,
    description: feedback.mensagem,
    color: embedColor,
    fields: [
      { name: "📁 Categoria", value: catLabel, inline: true },
      { name: "👤 Autor", value: autorTexto, inline: true },
      { name: "🔒 Modo", value: feedback.anonimo ? "🛡️ 100% Anônimo" : "Identificado", inline: true },
    ],
    footer: {
      text: "RED'S TUNERSHOP • Ouvidoria & Feedbacks para Reunião",
    },
    timestamp: new Date().toISOString(),
  };

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: `🚨 **Novo Feedback Registrado no Painel da RED'S!**`,
        embeds: [embed],
      }),
    });
  } catch (err) {
    console.error("[Ouvidoria] Erro ao enviar webhook Discord:", err);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { categoria, mensagem, anonimo, usuarioId, usuarioNome, usuarioCargo } = body;

    if (!mensagem || !mensagem.trim()) {
      return NextResponse.json(
        { ok: false, error: "A mensagem do feedback não pode estar vazia." },
        { status: 400 }
      );
    }

    const payload = {
      categoria: categoria || "sugestoes",
      mensagem: mensagem.trim(),
      anonimo: Boolean(anonimo),
      usuario_id: anonimo ? null : (usuarioId ? parseInt(usuarioId, 10) : null),
      usuario_nome: anonimo ? null : (usuarioNome || null),
      usuario_cargo: anonimo ? null : (usuarioCargo || null),
      status: "pendente",
      criado_em: new Date().toISOString(),
    };

    const supabase = getSupabaseClient();
    let salvoNoBanco = false;
    let feedbackId = null;

    try {
      const { data, error } = await supabase
        .from("feedbacks_equipe")
        .insert([payload])
        .select("id")
        .maybeSingle();

      if (!error && data) {
        salvoNoBanco = true;
        feedbackId = data.id;
      } else if (error) {
        console.warn("[Ouvidoria] Aviso ao salvar em feedbacks_equipe:", error.message);
      }
    } catch (e) {
      console.warn("[Ouvidoria] Tabela feedbacks_equipe indisponível, seguindo com Discord:", e.message);
    }

    // Disparar Webhook para o Discord dos Donos imediatamente
    await enviarNotificacaoDiscord({
      ...payload,
      id: feedbackId,
    });

    return NextResponse.json({
      ok: true,
      salvoNoBanco,
      id: feedbackId,
      mensagem: "Feedback enviado com sucesso! Agradecemos sua contribuição.",
    });
  } catch (err) {
    console.error("[Ouvidoria] Erro geral na rota de feedback:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const categoria = searchParams.get("categoria");
    const status = searchParams.get("status");
    const limite = parseInt(searchParams.get("limite") || "100", 10);

    const supabase = getSupabaseClient();
    let query = supabase
      .from("feedbacks_equipe")
      .select("*")
      .order("criado_em", { ascending: false })
      .limit(limite);

    if (categoria && categoria !== "todas") {
      query = query.eq("categoria", categoria);
    }
    if (status && status !== "todos") {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) {
      // Se a tabela ainda não foi criada, retorna lista vazia amigável
      return NextResponse.json({ ok: true, data: [], aviso: error.message });
    }

    return NextResponse.json({ ok: true, data: data || [] });
  } catch (err) {
    console.error("[Ouvidoria] Erro ao buscar feedbacks:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const body = await request.json();
    const { id, status, respostaAdmin, respondidoPor } = body;

    if (!id) {
      return NextResponse.json({ ok: false, error: "ID é obrigatório." }, { status: 400 });
    }

    const updates = {};
    if (status) updates.status = status;
    if (respostaAdmin !== undefined) {
      updates.resposta_admin = respostaAdmin;
      updates.respondido_por = respondidoPor || "Admin";
      updates.respondido_em = new Date().toISOString();
    }

    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from("feedbacks_equipe")
      .update(updates)
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ ok: true, message: "Status atualizado com sucesso!" });
  } catch (err) {
    console.error("[Ouvidoria] Erro ao atualizar feedback:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
