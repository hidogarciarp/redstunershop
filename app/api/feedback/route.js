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

    if (!feedbackId && erroDb) {
      return NextResponse.json(
        {
          ok: false,
          error: `Erro ao gravar no banco de dados (${erroDb}).`,
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
