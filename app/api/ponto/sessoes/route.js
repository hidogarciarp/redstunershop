import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getSupabaseAdmin() {
  const url =
    process.env.NEXT_PUBLIC_NEW_SUPABASE_URL ||
    "https://sxrfkbjbyjdmyyxbzobb.supabase.co";
  const key =
    process.env.NEXT_PUBLIC_NEW_SUPABASE_KEY ||
    "sb_publishable_et87L-NCrieyXmvteW84-w_v9cxAbjG";
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const mecanica = searchParams.get("mecanica") || "reds";
    const inicio = searchParams.get("inicio");
    const fim = searchParams.get("fim");
    const usuarioId = searchParams.get("usuario_id");

    const supabase = getSupabaseAdmin();
    let query = supabase
      .from("log_ponto")
      .select("*")
      .eq("mecanica_id", mecanica)
      .order("entrada", { ascending: false })
      .limit(1000);

    if (inicio) {
      query = query.gte("data", inicio);
    }
    if (fim) {
      query = query.lte("data", fim);
    }
    if (usuarioId) {
      query = query.eq("usuario_id", parseInt(usuarioId, 10));
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ ok: true, data: data || [] });
  } catch (err) {
    console.error("Erro na API /api/ponto/sessoes:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
