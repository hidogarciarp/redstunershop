import { NextResponse } from "next/server";
import { supabase as supabaseClient } from "@/app/utils/supabaseClient";

export const dynamic = "force-dynamic";

function getSupabaseClient() {
  return supabaseClient;
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const rawId = (body?.id ?? "").toString().trim();
    const novaSenha = (body?.novaSenha ?? "").toString().trim();

    if (!rawId || !novaSenha) {
      return NextResponse.json(
        { error: "ID e nova senha são obrigatórios." },
        { status: 400 }
      );
    }

    if (!/^\d+$/.test(novaSenha)) {
      return NextResponse.json(
        { error: "A nova senha deve conter apenas números." },
        { status: 400 }
      );
    }

    if (novaSenha.length < 3) {
      return NextResponse.json(
        { error: "A nova senha deve ter pelo menos 3 dígitos." },
        { status: 400 }
      );
    }

    const idNum = parseInt(rawId, 10);
    if (isNaN(idNum)) {
      return NextResponse.json(
        { error: "ID inválido." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    // 1. Localizar usuário
    const { data: user, error: fetchError } = await supabase
      .from("usuarios")
      .select("id, status, nome")
      .eq("id", idNum)
      .maybeSingle();

    if (fetchError || !user) {
      return NextResponse.json(
        { error: "Usuário não encontrado." },
        { status: 404 }
      );
    }

    if (user.status === "inativo" || user.status === "demitido") {
      return NextResponse.json(
        { error: "Usuário inativo ou demitido. Operação negada." },
        { status: 403 }
      );
    }

    // 2. Atualizar senha com privilégios administrativos
    const { error: updateError } = await supabase
      .from("usuarios")
      .update({ senha: novaSenha })
      .eq("id", user.id);

    if (updateError) {
      console.error("Erro ao atualizar senha no Supabase:", updateError);
      return NextResponse.json(
        { error: "Erro ao salvar a nova senha no banco de dados." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      sucesso: true,
      mensagem: "Senha alterada com sucesso.",
    });
  } catch (error) {
    console.error("Erro na rota /api/auth/alterar-senha:", error);
    return NextResponse.json(
      { error: "Erro interno no servidor ao alterar senha." },
      { status: 500 }
    );
  }
}
