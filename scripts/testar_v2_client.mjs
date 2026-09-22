import { supabase, isV2Mode } from "../app/utils/supabaseClient.js";

async function test() {
  console.log("Modo V2 ativo no node?", isV2Mode());
  
  // Testando consulta padrão (Produção)
  const { count: countProd, error: errProd } = await supabase.from("usuarios").select("*", { count: "exact", head: true });
  console.log("Consulta Usuários (Banco Padrão):", countProd, errProd?.message || "OK");

  // Simulando V2
  global.window = {
    location: { pathname: "/v2" },
    __REDS_V2_MODE__: true
  };

  console.log("Modo V2 ativo após simulação?", isV2Mode());
  
  // Testando consulta V2 no banco novo
  const { count: countV2, error: errV2 } = await supabase.from("usuarios").select("*", { count: "exact", head: true });
  console.log("Consulta Usuários (Banco Novo V2):", countV2, errV2?.message || "OK");

  // Testando redirecionamento de ponto_cidade -> log_ponto no banco novo
  const { count: countPonto, error: errPonto } = await supabase.from("ponto_cidade").select("*", { count: "exact", head: true });
  console.log("Consulta ponto_cidade -> log_ponto (Banco Novo V2):", countPonto, errPonto?.message || "OK");
}

test();
