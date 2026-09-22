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
    const mecanicaId = searchParams.get("mecanica_id");
    const usuarioId = searchParams.get("usuario_id");
    const inicio = searchParams.get("inicio");
    const fim = searchParams.get("fim");

    if (!mecanicaId || !usuarioId || !inicio || !fim) {
      return NextResponse.json({ ok: false, error: "Parâmetros insuficientes" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const [pontosRes, tunagensRes, bancadaRes, bauRes] = await Promise.all([
      supabase
        .from("log_ponto")
        .select("*")
        .eq("mecanica_id", mecanicaId)
        .eq("usuario_id", parseInt(usuarioId, 10))
        .gte("entrada", inicio)
        .lte("entrada", fim)
        .order("entrada", { ascending: true }),

      supabase
        .from("log_tunagem")
        .select("*")
        .eq("mecanica_id", mecanicaId)
        .eq("tecnico_id", String(usuarioId))
        .gte("timestampz", inicio)
        .lte("timestampz", fim)
        .order("timestampz", { ascending: true }),

      supabase
        .from("log_bancada")
        .select("*")
        .eq("mecanica_id", mecanicaId)
        .eq("usuario_id", String(usuarioId))
        .gte("timestampz", inicio)
        .lte("timestampz", fim)
        .order("timestampz", { ascending: true }),

      supabase
        .from("log_bau")
        .select("*")
        .eq("mecanica_id", mecanicaId)
        .eq("usuario_id", String(usuarioId))
        .gte("timestampz", inicio)
        .lte("timestampz", fim)
        .order("timestampz", { ascending: true }),
    ]);

    return NextResponse.json({
      ok: true,
      pontos: pontosRes.data || [],
      tunagens: tunagensRes.data || [],
      bancada: bancadaRes.data || [],
      bau: bauRes.data || [],
    });
  } catch (err) {
    console.error("Erro na API /api/ponto/timeline:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
