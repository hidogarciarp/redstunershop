import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

// 1. Carregar variáveis de ambiente do .env.local
const envPath = path.resolve(process.cwd(), ".env.local");
let supabaseUrl = "";
let supabaseKey = "";

try {
  const envContent = fs.readFileSync(envPath, "utf8");
  const getEnvVar = (name) => {
    const match = envContent.match(new RegExp(`${name}="?([^"\\n]+)"?`));
    return match ? match[1] : null;
  };
  supabaseUrl = getEnvVar("NEXT_PUBLIC_SUPABASE_URL");
  supabaseKey = getEnvVar("NEXT_PUBLIC_SUPABASE_ANON_KEY");
} catch (e) {
  console.error("❌ Erro ao ler .env.local:", e.message);
  process.exit(1);
}

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Credenciais do Supabase não encontradas no arquivo .env.local.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// 2. Tabelas de preços e regras (cópia de app/utils/constants.js)
const TABELA_PRECOS = {
  Motor: [
    { id: "m0", nome: "Motor Padrão", preco: 5000, painel: 500 },
    { id: "m1", nome: "Motor Nível 1", preco: 15360, painel: 9600 },
    { id: "m2", nome: "Motor Nível 2", preco: 30720, painel: 19200 },
    { id: "m3", nome: "Motor Nível 3", preco: 46080, painel: 28800 },
    { id: "m4", nome: "Motor Nível 4", preco: 61440, painel: 38400 },
    { id: "m5", nome: "Motor Nível 5", preco: 76800, painel: 48000 },
  ],
  Transmissão: [
    { id: "t0", nome: "Transmissão Padrão", preco: 5000, painel: 500 },
    { id: "t1", nome: "Transmissão Nível 1", preco: 15360, painel: 9600 },
    { id: "t2", nome: "Transmissão Nível 2", preco: 30720, painel: 19200 },
    { id: "t3", nome: "Transmissão Nível 3", preco: 46080, painel: 28800 },
    { id: "t4", nome: "Transmissão Nível 4", preco: 61440, painel: 38400 },
    { id: "t5", nome: "Transmissão Nível 5", preco: 76800, painel: 48000 },
  ],
  Suspensão: [
    { id: "s0", nome: "Suspensão Padrão", preco: 5000, painel: 500 },
    { id: "s1", nome: "Suspensão Nível 1", preco: 10240, painel: 6400 },
    { id: "s2", nome: "Suspensão Nível 2", preco: 20480, painel: 12800 },
    { id: "s3", nome: "Suspensão Nível 3", preco: 30720, painel: 19200 },
    { id: "s4", nome: "Suspensão Nível 4", preco: 40960, painel: 25600 },
    { id: "s5", nome: "Suspensão Nível 5", preco: 51200, painel: 32000 },
  ],
  Blindagem: [
    { id: "b0", nome: "Blindagem Padrão", preco: 5000, painel: 500 },
    { id: "b1", nome: "Blindagem Nível 1", preco: 19200, painel: 12000 },
    { id: "b2", nome: "Blindagem Nível 2", preco: 38400, painel: 24000 },
    { id: "b3", nome: "Blindagem Nível 3", preco: 57600, painel: 36000 },
    { id: "b4", nome: "Blindagem Nível 4", preco: 76800, painel: 48000 },
    { id: "b5", nome: "Blindagem Nível 5", preco: 96000, painel: 60000 },
  ],
  Freios: [
    { id: "f0", nome: "Freios Padrão", preco: 5000, painel: 500 },
    { id: "f1", nome: "Freios Nível 1", preco: 10240, painel: 6400 },
    { id: "f2", nome: "Freios Nível 2", preco: 20480, painel: 12800 },
    { id: "f3", nome: "Freios Nível 3", preco: 30720, painel: 19200 },
    { id: "f4", nome: "Freios Nível 4", preco: 40960, painel: 25600 },
    { id: "f5", nome: "Freios Nível 5", preco: 51200, painel: 32000 },
  ],
  Outros: [
    { id: "h1", nome: "Hidráulico", preco: 8000, painel: 5000 },
    { id: "tu1", nome: "Turbo", preco: 33600, painel: 21000 },
    { id: "n1", nome: "Nitro", preco: 25000, painel: 0 },
    { id: "d1", nome: "Kit Drift", preco: 25000, painel: 0 },
    { id: "rd1", nome: "Removedor Kit Drift", preco: 25000, painel: 0 },
  ],
  Tunagens: [
    { id: "tf1", nome: "Tunagem Full Sem Blindagem", preco: 212800, painel: 181000 },
    { id: "tf2", nome: "Tunagem Full Com Blindagem", preco: 308800, painel: 241000 },
    { id: "tf3", nome: "Tunagem Full Sem Blindagem/Suspensão", preco: 171840, painel: 149000 },
  ],
};

const REGRAS_PRECOS = {
  guincho: {
    valor_fixo: 2000,
    valor_km: 2500,
    valor_reparo: 4500,
    valor_pneu: 2500
  },
  estetica: {
    painel_referencia: 500,
    valor_cliente_referencia: 5000,
    valor_cliente_fumaca: 9000,
    valor_cliente_extra: 3500,
    valor_cliente_camaleao: 10000,
    painel_fumaca: 5000,
    painel_extra: 1000,
    painel_camaleao: 500
  }
};

const todasPecasFlat = Object.values(TABELA_PRECOS).flat();

// Função auxiliar para reverter o custo da cidade/painel a partir do registro de serviço
function calcularCustoCidade(servico) {
  const { tipo, valor_total, detalhes } = servico;
  const detString = detalhes || "";
  const totalCliente = Number(valor_total) || 0;

  let somaPecasCliente = 0;
  let somaPecasPainel = 0;

  // 1. Detectar peças de performance ou pacotes
  todasPecasFlat.forEach((peca) => {
    // Busca a peça pelo nome exato nos detalhes
    if (detString.includes(peca.nome)) {
      somaPecasCliente += peca.preco;
      somaPecasPainel += peca.painel || 0;
    }
  });

  // 2. Se for Guincho
  if (tipo === "guincho") {
    // Guincho normalmente não tem custo direto de painel para a cidade registrado
    return {
      cidade: 0,
      cliente: totalCliente,
      detalhesCalculo: "Guincho (Custo cidade: $0)"
    };
  }

  // 3. Se for Venda
  if (tipo === "venda") {
    // Venda de itens de estoque
    return {
      cidade: 0,
      cliente: totalCliente,
      detalhesCalculo: "Venda (Custo cidade: $0)"
    };
  }

  // 4. Estética ou Tunagem
  // Parsear extras de estética
  let qtdCamaleao = 0;
  const camaleaoMatch = detString.match(/Camaleão \((\d+)x\)/i);
  if (camaleaoMatch) {
    qtdCamaleao = parseInt(camaleaoMatch[1], 10);
  } else if (detString.includes("Camaleão")) {
    qtdCamaleao = 1;
  }

  let qtdExtras = 0;
  const extraMatch = detString.match(/Extra \((\d+)x\)/i);
  if (extraMatch) {
    qtdExtras = parseInt(extraMatch[1], 10);
  } else if (detString.includes("Extra")) {
    qtdExtras = 1;
  }

  const temFumaca = detString.includes("Fumaça");

  // Calcular custos fixos de extras do cliente
  const somaCamaleaoCliente = qtdCamaleao * REGRAS_PRECOS.estetica.valor_cliente_camaleao;
  const somaExtrasCliente = qtdExtras * REGRAS_PRECOS.estetica.valor_cliente_extra;
  const somaFumacaCliente = temFumaca ? REGRAS_PRECOS.estetica.valor_cliente_fumaca : 0;

  // Custos fixos no painel
  const somaCamaleaoPainel = qtdCamaleao * REGRAS_PRECOS.estetica.painel_camaleao;
  const somaExtrasPainel = qtdExtras * REGRAS_PRECOS.estetica.painel_extra;
  const somaFumacaPainel = temFumaca ? REGRAS_PRECOS.estetica.painel_fumaca : 0;

  // Tentar deduzir o valorEsteticaFinal cobrado do cliente
  // Preço total = EsteticaBaseCliente + PeçasPerformanceCliente + ExtrasCliente
  const esteticaBaseCliente = Math.max(
    0,
    totalCliente - (somaCamaleaoCliente + somaExtrasCliente + somaFumacaCliente + somaPecasCliente)
  );

  // Converter EsteticaBaseCliente para o painel
  // Como valorEsteticaFinal = valorBaseEsteticaPainel * 10
  const valorBaseEsteticaPainel = esteticaBaseCliente / 10;

  // Valor total in-game / painel cobrado pela cidade
  const totalCidade = somaPecasPainel + valorBaseEsteticaPainel + somaCamaleaoPainel + somaExtrasPainel + somaFumacaPainel;

  const descritivo = [];
  if (somaPecasPainel > 0) descritivo.push(`Peças Performance: $${somaPecasPainel}`);
  if (valorBaseEsteticaPainel > 0) descritivo.push(`Estética Base Painel: $${valorBaseEsteticaPainel}`);
  if (somaCamaleaoPainel > 0) descritivo.push(`Camaleão Painel: $${somaCamaleaoPainel}`);
  if (somaExtrasPainel > 0) descritivo.push(`Extras Painel: $${somaExtrasPainel}`);
  if (somaFumacaPainel > 0) descritivo.push(`Fumaça Painel: $${somaFumacaPainel}`);

  return {
    cidade: Math.round(totalCidade),
    cliente: totalCliente,
    detalhesCalculo: descritivo.join(" | ") || "Apenas base/Padrão"
  };
}

// 3. Obter período com base em argumentos
function obterFiltrosData() {
  const args = process.argv.slice(2);
  let dataInicio = null;
  let dataFim = null;
  let tipoPeriodo = "tudo";

  // Parse de argumentos simples (--inicio, --fim, --periodo)
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--inicio" && args[i + 1]) {
      dataInicio = args[i + 1];
    }
    if (args[i] === "--fim" && args[i + 1]) {
      dataFim = args[i + 1];
    }
    if (args[i] === "--periodo" && args[i + 1]) {
      tipoPeriodo = args[i + 1].toLowerCase();
    }
  }

  const hoje = new Date();
  
  if (tipoPeriodo === "hoje") {
    const dataStr = hoje.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    dataInicio = dataStr;
    dataFim = dataStr;
  } else if (tipoPeriodo === "semana") {
    // Últimos 7 dias
    const inicio = new Date();
    inicio.setDate(hoje.getDate() - 7);
    dataInicio = inicio.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    dataFim = hoje.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  } else if (tipoPeriodo === "mes") {
    // Últimos 30 dias
    const inicio = new Date();
    inicio.setDate(hoje.getDate() - 30);
    dataInicio = inicio.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    dataFim = hoje.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  }

  return { dataInicio, dataFim, tipoPeriodo };
}

async function executar() {
  const { dataInicio, dataFim, tipoPeriodo } = obterFiltrosData();

  console.log("====================================================");
  console.log("📊 ANÁLISE DE TAXAS PAGAS PARA A CIDADE");
  console.log("====================================================");
  
  if (dataInicio || dataFim) {
    console.log(`Filtro aplicado: ${dataInicio || "Início"} até ${dataFim || "Fim"}`);
  } else {
    console.log(`Período analisado: Todo o histórico (tipoPeriodo: ${tipoPeriodo})`);
  }
  console.log("Conectando ao banco de dados...");

  let query = supabase.from("servicos").select("*");
  if (dataInicio) query = query.gte("data", dataInicio);
  if (dataFim) query = query.lte("data", dataFim);

  const { data: servicos, error } = await query.order("data", { ascending: true });

  if (error) {
    console.error("❌ Erro ao buscar registros:", error.message);
    process.exit(1);
  }

  if (!servicos || servicos.length === 0) {
    console.log("⚠️ Nenhum serviço registrado encontrado neste período.");
    process.exit(0);
  }

  let totalFaturadoCliente = 0;
  let totalPagoCidade = 0;
  
  const estatisticasPorTipo = {
    tunagem: { cliente: 0, cidade: 0, count: 0 },
    estetica: { cliente: 0, cidade: 0, count: 0 },
    guincho: { cliente: 0, cidade: 0, count: 0 },
    venda: { cliente: 0, cidade: 0, count: 0 }
  };

  servicos.forEach((s) => {
    const calc = calcularCustoCidade(s);
    totalFaturadoCliente += calc.cliente;
    totalPagoCidade += calc.cidade;

    const t = s.tipo || "tunagem";
    if (estatisticasPorTipo[t]) {
      estatisticasPorTipo[t].cliente += calc.cliente;
      estatisticasPorTipo[t].cidade += calc.cidade;
      estatisticasPorTipo[t].count++;
    }
  });

  const totalLucroLiquido = totalFaturadoCliente - totalPagoCidade;

  console.log("\n=================== RESULTADOS =====================");
  console.log(`Total de Serviços Analisados: ${servicos.length}`);
  console.log(`💰 Faturamento Total (Bruto Cliente): R$ ${totalFaturadoCliente.toLocaleString("pt-BR")}`);
  console.log(`🏢 Valor Total Pago à Cidade (Painel): R$ ${totalPagoCidade.toLocaleString("pt-BR")}`);
  console.log(`📈 Lucro Líquido (Mecânica):          R$ ${totalLucroLiquido.toLocaleString("pt-BR")}`);
  console.log(`📉 Margem de Lucro:                   ${((totalLucroLiquido / totalFaturadoCliente) * 100).toFixed(2)}%`);
  
  console.log("\n================ POR CATEGORIA =====================");
  Object.keys(estatisticasPorTipo).forEach((tipo) => {
    const dados = estatisticasPorTipo[tipo];
    const tipoNome = tipo.toUpperCase();
    console.log(`\n🔹 [${tipoNome}] - ${dados.count} registros`);
    console.log(`   Cobrado do Cliente: R$ ${dados.cliente.toLocaleString("pt-BR")}`);
    console.log(`   Pago para a Cidade: R$ ${dados.cidade.toLocaleString("pt-BR")}`);
    const lucro = dados.cliente - dados.cidade;
    console.log(`   Líquido:            R$ ${lucro.toLocaleString("pt-BR")}`);
  });
  
  console.log("\n====================================================");
  console.log("💡 Como usar filtros adicionais no console:");
  console.log("  node scripts/calcular_taxas_cidade.mjs --periodo hoje");
  console.log("  node scripts/calcular_taxas_cidade.mjs --periodo semana");
  console.log("  node scripts/calcular_taxas_cidade.mjs --periodo mes");
  console.log("  node scripts/calcular_taxas_cidade.mjs --inicio 2026-07-01 --fim 2026-07-31");
  console.log("====================================================");
}

executar();
