import { sincronizarLogsUnificados } from "../app/utils/sincronizadorLogs.js";

async function test() {
  console.log("🚀 Executando sincronizarLogsUnificados(2) no Banco Novo...");
  const inicio = Date.now();
  try {
    const relatorio = await sincronizarLogsUnificados(2);
    const tempo = ((Date.now() - inicio) / 1000).toFixed(2);
    console.log(`\n🎉 Sincronização concluída em ${tempo}s!`);
    console.log("Relatório:", relatorio);
  } catch (e) {
    console.error("❌ Erro no teste:", e);
  }
}

test();
