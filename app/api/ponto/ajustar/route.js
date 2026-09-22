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

export async function POST(request) {
  try {
    const body = await request.json();
    const { sessaoId, saida, uuidSaida, totalMinutos, totalSegundos, observacao } = body;

    if (!sessaoId || !saida) {
      return NextResponse.json({ ok: false, error: "sessaoId e saida são obrigatórios." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("log_ponto")
      .update({
        saida,
        uuid_saida: uuidSaida || `MANUAL_${Date.now()}`,
        tipo_fechamento: "AJUSTE_MANUAL",
        total_minutos: totalMinutos,
        total_segundos: totalSegundos,
        observacao,
      })
      .eq("id", sessaoId);

    if (error) throw error;

    return NextResponse.json({ ok: true, message: "Ajuste manual salvo com sucesso!" });
  } catch (err) {
    console.error("Erro na API /api/ponto/ajustar:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
