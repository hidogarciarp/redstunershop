import { exec } from "child_process";
import { NextResponse } from "next/server";

export async function POST(req) {
  let cliArgs = "";
  try {
    const body = await req.json();
    if (body?.dataInicio && body?.dataFim) {
      cliArgs = ` --inicio "${body.dataInicio}" --fim "${body.dataFim}"`;
    }
  } catch (e) {
    // Body vazio = conciliação geral
  }

  const cmd = `node scripts/processar_logs_reds.mjs${cliArgs}`;
  console.log(`Disparando conciliação: ${cmd}`);

  // Executa o script de processamento e conciliação em segundo plano
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

