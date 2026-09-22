import { NextResponse } from "next/server";
import { sincronizarLogsUnificados } from "../../utils/sincronizadorLogs";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const dias = body.dias || 3;
    const relatorio = await sincronizarLogsUnificados(dias);

    return NextResponse.json({
      ok: true,
      mensagem: "Sincronização concluída com sucesso!",
      relatorio,
    });
  } catch (err) {
    console.error("Erro na API de sincronização:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const dias = parseInt(searchParams.get("dias") || "3", 10);
    const relatorio = await sincronizarLogsUnificados(dias);

    return NextResponse.json({
      ok: true,
      mensagem: "Sincronização concluída com sucesso!",
      relatorio,
    });
  } catch (err) {
    console.error("Erro no GET da API de sincronização:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
