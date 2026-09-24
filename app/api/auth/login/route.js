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
    const rawSenha = (body?.senha ?? "").toString().trim();

    if (!rawId || !rawSenha) {
      return NextResponse.json(
        { error: "Preencha o ID e a senha." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    // 1. Busca por ID numérico
    const idNum = parseInt(rawId, 10);
    let user = null;

    if (!isNaN(idNum)) {
      const { data, error } = await supabase
        .from("usuarios")
        .select("*")
        .eq("id", idNum)
        .maybeSingle();

      if (!error && data) {
        user = data;
      }
    }

    // 2. Se não encontrou pelo ID primário, busca por id_jogo
    if (!user) {
      const { data: dataJogo, error: errorJogo } = await supabase
        .from("usuarios")
        .select("*")
        .eq("id_jogo", rawId)
        .maybeSingle();

      if (!errorJogo && dataJogo) {
        user = dataJogo;
      }
    }

    if (!user) {
      return NextResponse.json(
        { error: "ID não autorizado ou inexistente. Contate um administrador." },
        { status: 404 }
      );
    }

    // 3. Verifica se o usuário está inativo ou demitido
    if (user.status === "inativo" || user.status === "demitido") {
      return NextResponse.json(
        { error: "Acesso negado. Seu usuário está inativo ou demitido. Contate um administrador." },
        { status: 403 }
      );
    }

    // 4. Conferência de senha
    const senhaDb = (user.senha ?? user.id).toString().trim();
    const idDb = (user.id ?? "").toString().trim();

    // Primeiro acesso: senhaDb é igual ao ID e senha digitada também é igual ao ID
    if (senhaDb === idDb && rawSenha === idDb) {
      return NextResponse.json({
        primeiroAcesso: true,
        usuario: user,
      });
    }

    // Senha incorreta
    if (senhaDb !== rawSenha) {
      return NextResponse.json(
        { error: "Senha incorreta. Verifique sua senha." },
        { status: 401 }
      );
    }

    // Sucesso!
    return NextResponse.json({
      sucesso: true,
      usuario: user,
    });
  } catch (error) {
    console.error("Erro na rota /api/auth/login:", error);
    return NextResponse.json(
      { error: "Erro de servidor ao processar autenticação. Tente novamente." },
      { status: 500 }
    );
  }
}
