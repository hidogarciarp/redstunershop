import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// Banco V2 / Novo (Onde a tabela feedbacks_equipe está criada no MecanicasRua2)
const v2Url =
  process.env.NEXT_PUBLIC_NEW_SUPABASE_URL ||
  "https://sxrfkbjbyjdmyyxbzobb.supabase.co";
const v2Key =
  process.env.NEXT_PUBLIC_NEW_SUPABASE_KEY ||
  "sb_publishable_et87L-NCrieyXmvteW84-w_v9cxAbjG";

// Banco Produção / Legado
const prodUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://prperurjtvayjrazdxvh.supabase.co";
const prodKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBycGVydXJqdHZheWpyYXpkeHZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwMjEwMzUsImV4cCI6MjA5MDU5NzAzNX0.MDk7Pm5fYQ_18GPUDv0R360y_M1eBaJ2-zKHPhmQOJ0";

function getV2Client() {
  return createClient(v2Url, v2Key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function getProdClient() {
  return createClient(prodUrl, prodKey, {
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
      usuario_id: anonimo ? null : (usuarioId ? String(usuarioId) : null),
      usuario_nome: anonimo ? null : (usuarioNome || null),
      usuario_cargo: anonimo ? null : (usuarioCargo || null),
      status: "pendente",
      criado_em: new Date().toISOString(),
    };

    let feedbackId = null;
    let erroDb = null;

    // 1. Tentar salvar no Banco V2 (MecanicasRua2)
    const v2Client = getV2Client();
    try {
      const { data, error } = await v2Client
        .from("feedbacks_equipe")
        .insert([payload])
        .select("id")
        .maybeSingle();

      if (!error && data) {
        feedbackId = data.id;
      } else if (error) {
        erroDb = error.message;
        console.warn("[Ouvidoria] Aviso ao salvar no V2:", error.message);
      }
    } catch (e) {
      erroDb = e.message;
      console.warn("[Ouvidoria] Exceção no V2:", e.message);
    }

    // 2. Se falhar, tenta no banco antigo de produção como fallback
    if (!feedbackId) {
      const prodClient = getProdClient();
      try {
        const { data, error } = await prodClient
          .from("feedbacks_equipe")
          .insert([payload])
          .select("id")
          .maybeSingle();

        if (!error && data) {
          feedbackId = data.id;
          erroDb = null;
        } else if (error) {
          console.warn("[Ouvidoria] Aviso ao salvar no Prod:", error.message);
        }
      } catch (e) {
        console.warn("[Ouvidoria] Exceção no Prod:", e.message);
      }
    }

    // Disparar Webhook para o Discord dos Donos imediatamente
    await enviarNotificacaoDiscord({
      ...payload,
      id: feedbackId,
    });

    if (!feedbackId && erroDb) {
      return NextResponse.json(
        {
          ok: false,
          error: `Erro ao gravar no banco de dados (${erroDb}). Notificação de segurança enviada ao Discord.`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      salvoNoBanco: Boolean(feedbackId),
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
    const limite = parseInt(searchParams.get("limite") || "200", 10);

    // 1. Tentar ler do Banco V2 (MecanicasRua2)
    const v2Client = getV2Client();
    let queryV2 = v2Client
      .from("feedbacks_equipe")
      .select("*")
      .order("criado_em", { ascending: false })
      .limit(limite);

    if (categoria && categoria !== "todas") {
      queryV2 = queryV2.eq("categoria", categoria);
    }
    if (status && status !== "todos") {
      queryV2 = queryV2.eq("status", status);
    }

    const { data: dataV2, error: errorV2 } = await queryV2;
    if (!errorV2 && Array.isArray(dataV2)) {
      return NextResponse.json({ ok: true, data: dataV2 });
    }

    // 2. Se falhar, tenta ler do banco prod
    const prodClient = getProdClient();
    let queryProd = prodClient
      .from("feedbacks_equipe")
      .select("*")
      .order("criado_em", { ascending: false })
      .limit(limite);

    if (categoria && categoria !== "todas") {
      queryProd = queryProd.eq("categoria", categoria);
    }
    if (status && status !== "todos") {
      queryProd = queryProd.eq("status", status);
    }

    const { data: dataProd, error: errorProd } = await queryProd;
    if (!errorProd && Array.isArray(dataProd)) {
      return NextResponse.json({ ok: true, data: dataProd });
    }

    return NextResponse.json(
      {
        ok: false,
        data: [],
        error: errorV2?.message || errorProd?.message || "Erro ao consultar feedbacks.",
      },
      { status: 500 }
    );
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

    // Tentar atualizar no Banco V2
    const v2Client = getV2Client();
    const resV2 = await v2Client
      .from("feedbacks_equipe")
      .update(updates)
      .eq("id", id)
      .select("id");

    if (!resV2.error && resV2.data && resV2.data.length > 0) {
      return NextResponse.json({ ok: true, message: "Status atualizado com sucesso!" });
    }

    // Se não encontrou no V2, tenta no Prod
    const prodClient = getProdClient();
    const resProd = await prodClient
      .from("feedbacks_equipe")
      .update(updates)
      .eq("id", id)
      .select("id");

    if (!resProd.error && resProd.data && resProd.data.length > 0) {
      return NextResponse.json({ ok: true, message: "Status atualizado com sucesso!" });
    }

    if (resV2.error || resProd.error) {
      throw new Error(resV2.error?.message || resProd.error?.message);
    }

    return NextResponse.json({ ok: true, message: "Atualizado com sucesso." });
  } catch (err) {
    console.error("[Ouvidoria] Erro ao atualizar feedback:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
