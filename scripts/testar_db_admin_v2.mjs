import { supabase, isV2Mode } from "../app/utils/supabaseClient.js";

// Ativar V2
global.window = {
  location: { pathname: "/v2" },
  __REDS_V2_MODE__: true
};

async function testQueries() {
  console.log("Modo V2 ativo?", isV2Mode());

  const testTables = [
    "log_ponto_reds",
    "sessoes_ponto_auditoria_reds",
    "logs_tunagem_reds",
    "log_bancada_reds",
    "log_bau_reds"
  ];

  for (const t of testTables) {
    console.log(`\n--- Testando tabela: ${t} ---`);
    try {
      let query = supabase.from(t).select("*", { count: "exact" });
      
      // Simula a ordenação do DbAdminPage
      if (t === "sessoes_ponto_auditoria_reds") {
        query = query.order("entrada", { ascending: false });
      } else {
        query = query.order("timestampz", { ascending: false });
      }

      const { data, count, error } = await query.range(0, 9);
      if (error) {
        console.error(`❌ Erro em ${t}:`, error.message);
      } else {
        console.log(`✅ Sucesso em ${t}! Count: ${count}, linhas retornadas: ${data?.length}`);
      }
    } catch (e) {
      console.error(`❌ Exceção em ${t}:`, e.message);
    }
  }
}

testQueries();
