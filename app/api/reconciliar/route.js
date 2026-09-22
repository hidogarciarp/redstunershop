import { exec } from "child_process";
import { NextResponse } from "next/server";
import { sincronizarLogsUnificados } from "../../utils/sincronizadorLogs";

export const dynamic = "force-dynamic";

export async function POST(req) {
  let body = {};
  try {
    body = await req.json();
  } catch (e) {}

  // Se a requisição veio do modo V2 (Banco Novo com tabelas unificadas)
  if (body?.isV2) {
    const dias = body.dias || 2;
    console.log(`[V2] Disparando sincronização incremental no Banco Novo (janela de ${dias} dias)...`);
    try {
      const relatorio = await sincronizarLogsUnificados(dias);
      return NextResponse.json({
        success: true,
        ok: true,
        isV2: true,
        message: `Sincronização V2 concluída com sucesso (janela de ${dias} dias)!`,
        relatorio
      });
    } catch (err) {
      console.error("[V2] Erro na sincronização:", err);
      return NextResponse.json({ success: false, ok: false, error: err.message }, { status: 500 });
    }
  }

  // Comportamento original da V1 (Banco Antigo)
  let cliArgs = "";
  if (body?.dataInicio && body?.dataFim) {
    cliArgs = ` --inicio "${body.dataInicio}" --fim "${body.dataFim}"`;
  }

  const cmd = `node scripts/processar_logs_reds.mjs${cliArgs}`;
  console.log(`Disparando conciliação V1: ${cmd}`);

  exec(cmd, (error, stdout, stderr) => {
    if (error) {
      console.error(`Erro ao executar conciliação automática: ${error.message}`);
      return;
    }
    if (stderr) {
      console.error(`StdErr conciliação: ${stderr}`);
    }
    console.log(`Conciliação automática concluída com sucesso:\n${stdout}`);
  });

  return NextResponse.json({ 
    success: true, 
    message: "Reconciliação iniciada em segundo plano.",
    cmd
  });
}
