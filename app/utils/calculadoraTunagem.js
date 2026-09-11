// ===============================================================================
// MOTOR DE PRECIFICAÇÃO E AUDITORIA DE TUNAGEM (TABELA OFICIAL DA OFICINA)
// ===============================================================================

export const TABELA_PRECOS = {
  // 1. Performance por Nível [0: Padrão/Stock, 1: Nível 1, 2: Nível 2, 3: Nível 3, 4: Nível 4, 5: Nível 5]
  performance: {
    motor: [5000, 15360, 30720, 46080, 61440, 76800],
    freios: [5000, 10240, 20480, 30720, 40960, 51200],
    transmissao: [5000, 15360, 30720, 46080, 61440, 76800],
    suspensao: [5000, 10240, 20480, 30720, 40960, 51200],
    blindagem: [5000, 19200, 38400, 57600, 76800, 96000]
  },
  performancePainel: {
    motor: [500, 9600, 19200, 28800, 38400, 48000],
    freios: [500, 6400, 12800, 19200, 25600, 32000],
    transmissao: [500, 9600, 19200, 28800, 38400, 48000],
    suspensao: [500, 6400, 12800, 19200, 25600, 32000],
    blindagem: [500, 12000, 24000, 36000, 48000, 60000]
  },

  // 2. Upgrades Especiais
  turbo: 33600,
  turboPainel: 21000,
  hidraulico: 8000,
  hidraulicoPainel: 5000,

  // 3. Pinturas & Efeitos
  corCamaleao: 10000,
  corCamaleaoPainel: 500,
  pinturaComum: 5000,
  pinturaComumPainel: 500,
  fumacaPneu: 9000,
  fumacaPneuPainel: 5000,
  extraUnitario: 3500,
  extraUnitarioPainel: 1000,

  // 4. Iluminação
  farolXenon: 5000,
  farolXenonPainel: 500,
  corXenon: 5000,
  corXenonPainel: 500,
  instalacaoNeonPorLado: 5000,
  instalacaoNeonPorLadoPainel: 500,
  corNeon: 5000,
  corNeonPainel: 500,

  // 5. Estética Geral
  insulfilm: 5000,
  insulfilmPainel: 500,
  pecaGeral: 5000,
  pecaGeralPainel: 500,

  // 6. Itens e Serviços de Bancada / Inventário
  nitro: 25000,
  kitDrift: 25000,
  removedorDrift: 25000,
  reparoVeiculo: 4500,
  pneu: 2500
};

export const REGRAS_PRECOS = {
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

// Catálogo de Serviços e Itens de Bancada / Inventário Aplicáveis Manualmente
export const ITENS_BANCADA_OPCOES = [
  { id: "nitro", nome: "Instalação de Nitro (NOS)", icone: "🚀", valor: 25000, categoria: "Performance" },
  { id: "kitDrift", nome: "Instalação de Kit Drift", icone: "🏎️", valor: 25000, categoria: "Performance" },
  { id: "removedorDrift", nome: "Removedor de Kit Drift", icone: "🔧", valor: 25000, categoria: "Serviço" },
  { id: "reparoVeiculo", nome: "Reparo de Veículo (Caixa de Ferramentas)", icone: "🧰", valor: 4500, categoria: "Serviço", permiteQtd: true },
  { id: "pneu", nome: "Pneu Avulso (Troca / Reparo)", icone: "🛞", valor: 2500, categoria: "Serviço", permiteQtd: true }
];

// Catálogo de Serviços e Peças Estéticas Tabeladas da Oficina (Para seleção manual ou correção de logs)
export const CATALOGO_PECAS_ESTETICAS = [
  // Lataria & Carroceria Externa (R$ 5.000 cliente / R$ 500 painel)
  { id: "aerofolio", slot: 0, nome: "Aerofólio / Spoiler", icone: "🏎️", secao: "Lataria", categoria: "Estética", custoPainel: 500, valor: 5000 },
  { id: "parachoque_d", slot: 1, nome: "Para-choque Dianteiro", icone: "🛡️", secao: "Lataria", categoria: "Estética", custoPainel: 500, valor: 5000 },
  { id: "parachoque_t", slot: 2, nome: "Para-choque Traseiro", icone: "🛡️", secao: "Lataria", categoria: "Estética", custoPainel: 500, valor: 5000 },
  { id: "saias", slot: 3, nome: "Saias Laterais", icone: "⚡", secao: "Lataria", categoria: "Estética", custoPainel: 500, valor: 5000 },
  { id: "escapamento", slot: 4, nome: "Escapamento Esportivo", icone: "💨", secao: "Lataria", categoria: "Estética", custoPainel: 500, valor: 5000 },
  { id: "grade", slot: 6, nome: "Grade Dianteira", icone: "🚘", secao: "Lataria", categoria: "Estética", custoPainel: 500, valor: 5000 },
  { id: "capo", slot: 7, nome: "Capô Personalizado", icone: "🚘", secao: "Lataria", categoria: "Estética", custoPainel: 500, valor: 5000 },
  { id: "paralama_d", slot: 8, nome: "Para-lama Dianteiro", icone: "🚗", secao: "Lataria", categoria: "Estética", custoPainel: 500, valor: 5000 },
  { id: "paralama_t", slot: 9, nome: "Para-lama Traseiro", icone: "🚗", secao: "Lataria", categoria: "Estética", custoPainel: 500, valor: 5000 },
  { id: "teto", slot: 10, nome: "Teto / Sunroof", icone: "🔲", secao: "Lataria", categoria: "Estética", custoPainel: 500, valor: 5000 },
  { id: "gaiola", slot: 5, nome: "Gaiola de Proteção / Roll Cage", icone: "🏁", secao: "Lataria", categoria: "Estética", custoPainel: 500, valor: 5000 },
  { id: "buzina", slot: 14, nome: "Buzina Personalizada", icone: "📢", secao: "Lataria", categoria: "Estética", custoPainel: 500, valor: 5000 },
  { id: "livery", slot: 48, nome: "Adesivos / Livery", icone: "🏁", secao: "Lataria", categoria: "Estética", custoPainel: 500, valor: 5000 },
  { id: "placa", slot: 25, nome: "Estilo / Troca de Placa", icone: "🪪", secao: "Lataria", categoria: "Estética", custoPainel: 500, valor: 5000 },

  // Rodas & Vidros
  { id: "rodas_custom", slot: 23, nome: "Troca de Rodas Personalizadas", icone: "🛞", secao: "Rodas & Vidros", categoria: "Estética", custoPainel: 500, valor: 5000 },
  { id: "insulfilm", nome: "Aplicação de Insulfilm", icone: "🪟", secao: "Rodas & Vidros", categoria: "Estética", custoPainel: 500, valor: 5000 },

  // Pinturas & Efeitos
  { id: "pintura_prim", nome: "Pintura Primária (Metálica/Fosca)", icone: "🎨", secao: "Pintura", categoria: "Pintura", custoPainel: 500, valor: 5000 },
  { id: "pintura_sec", nome: "Pintura Secundária (Metálica/Fosca)", icone: "🎨", secao: "Pintura", categoria: "Pintura", custoPainel: 500, valor: 5000 },
  { id: "pintura_rodas", nome: "Pintura das Rodas", icone: "🛞", secao: "Pintura", categoria: "Pintura", custoPainel: 500, valor: 5000 },
  { id: "perolado", nome: "Perolado / Verniz", icone: "✨", secao: "Pintura", categoria: "Pintura", custoPainel: 500, valor: 5000 },
  { id: "camaleao", nome: "Pintura Camaleão (Especial)", icone: "🦄", secao: "Pintura", categoria: "Pintura", custoPainel: 500, valor: 10000 },

  // Iluminação
  { id: "xenon", nome: "Instalação de Farol Xênon", icone: "💡", secao: "Iluminação", categoria: "Iluminação", custoPainel: 500, valor: 5000 },
  { id: "cor_xenon", nome: "Troca de Cor do Xênon", icone: "💡", secao: "Iluminação", categoria: "Iluminação", custoPainel: 500, valor: 5000 },
  { id: "neon", nome: "Instalação de Neon (por lado)", icone: "✨", secao: "Iluminação", categoria: "Iluminação", custoPainel: 500, valor: 5000 },
  { id: "cor_neon", nome: "Troca de Cor do Neon RGB", icone: "🌈", secao: "Iluminação", categoria: "Iluminação", custoPainel: 500, valor: 5000 },

  // Interior & Cabine
  { id: "bancos", slot: 32, nome: "Bancos de Corrida / Concha", icone: "💺", secao: "Interior", categoria: "Interior", custoPainel: 500, valor: 5000 },
  { id: "volante", slot: 33, nome: "Volante Customizado", icone: "🎯", secao: "Interior", categoria: "Interior", custoPainel: 500, valor: 5000 },
  { id: "painel_int", slot: 28, nome: "Painel Interno / Acabamento", icone: "🎛️", secao: "Interior", categoria: "Interior", custoPainel: 500, valor: 5000 },
  { id: "cambio", slot: 34, nome: "Alavanca de Câmbio", icone: "🕹️", secao: "Interior", categoria: "Interior", custoPainel: 500, valor: 5000 }
];

// Dicionário Oficial de Cores Camaleão do GTA V / FiveM (DLCs E&E)
export const TABELA_CAMALEAO = {
  // Anodized
  161: { nome: "Anodized Red", gradiente: "linear-gradient(135deg, #a80000 0%, #ff4d4d 50%, #4a0000 100%)" },
  162: { nome: "Anodized Wine", gradiente: "linear-gradient(135deg, #580020 0%, #a81040 50%, #200008 100%)" },
  163: { nome: "Anodized Purple", gradiente: "linear-gradient(135deg, #4b0082 0%, #9400d3 50%, #200030 100%)" },
  164: { nome: "Anodized Blue", gradiente: "linear-gradient(135deg, #001f7a 0%, #0077ff 50%, #000c30 100%)" },
  165: { nome: "Anodized Green", gradiente: "linear-gradient(135deg, #005510 0%, #00bb30 50%, #002005 100%)" },
  166: { nome: "Anodized Lime", gradiente: "linear-gradient(135deg, #336600 0%, #73e600 50%, #153000 100%)" },
  167: { nome: "Anodized Copper", gradiente: "linear-gradient(135deg, #8a3a00 0%, #d86820 50%, #401800 100%)" },
  168: { nome: "Anodized Bronze", gradiente: "linear-gradient(135deg, #664411 0%, #aa7722 50%, #302005 100%)" },
  169: { nome: "Anodized Champagne", gradiente: "linear-gradient(135deg, #7a6e50 0%, #d9c89e 50%, #3d3525 100%)" },
  170: { nome: "Anodized Gold", gradiente: "linear-gradient(135deg, #8a7000 0%, #ffd700 50%, #403200 100%)" },

  // Flips & Dual Tone
  171: { nome: "Green/Blue Flip", gradiente: "linear-gradient(135deg, #00ff88 0%, #0077ff 100%)" },
  172: { nome: "Green/Red Flip", gradiente: "linear-gradient(135deg, #00ff66 0%, #ff2244 100%)" },
  173: { nome: "Green/Brown Flip", gradiente: "linear-gradient(135deg, #00cc55 0%, #663300 100%)" },
  174: { nome: "Green/Turquoise Flip", gradiente: "linear-gradient(135deg, #00ffaa 0%, #00cccc 100%)" },
  175: { nome: "Green/Purple Flip", gradiente: "linear-gradient(135deg, #00e676 0%, #9c27b0 100%)" },
  176: { nome: "Teal/Purple Flip", gradiente: "linear-gradient(135deg, #00b4d8 0%, #7209b7 100%)" },
  177: { nome: "Turquoise/Red Flip", gradiente: "linear-gradient(135deg, #00f5d4 0%, #f72585 100%)" },
  178: { nome: "Turquoise/Purple Flip", gradiente: "linear-gradient(135deg, #48cae4 0%, #7b2cbf 100%)" },
  179: { nome: "Cyan/Purple Flip", gradiente: "linear-gradient(135deg, #00ffff 0%, #8338ec 100%)" },
  180: { nome: "Blue/Pink Flip", gradiente: "linear-gradient(135deg, #3a86ff 0%, #ff006e 100%)" },
  181: { nome: "Blue/Green Flip", gradiente: "linear-gradient(135deg, #0077b6 0%, #38b000 100%)" },
  182: { nome: "Purple/Red Flip", gradiente: "linear-gradient(135deg, #7b2cbf 0%, #e63946 100%)" },
  183: { nome: "Purple/Green Flip", gradiente: "linear-gradient(135deg, #9d4edd 0%, #55a630 100%)" },
  184: { nome: "Magenta/Green Flip", gradiente: "linear-gradient(135deg, #d81159 0%, #38b000 100%)" },
  185: { nome: "Magenta/Yellow Flip", gradiente: "linear-gradient(135deg, #e01e37 0%, #ffb703 100%)" },
  186: { nome: "Burgundy/Green Flip", gradiente: "linear-gradient(135deg, #6b0f1a 0%, #2dc653 100%)" },
  187: { nome: "Magenta/Cyan Flip", gradiente: "linear-gradient(135deg, #f72585 0%, #4cc9f0 100%)" },
  188: { nome: "Copper/Purple Flip", gradiente: "linear-gradient(135deg, #c36b32 0%, #6f2dbd 100%)" },
  189: { nome: "Magenta/Orange Flip", gradiente: "linear-gradient(135deg, #d81159 0%, #fb8500 100%)" },
  190: { nome: "Red/Orange Flip", gradiente: "linear-gradient(135deg, #d00000 0%, #ffba08 100%)" },
  191: { nome: "Orange/Purple Flip", gradiente: "linear-gradient(135deg, #f77f00 0%, #560bad 100%)" },
  192: { nome: "Orange/Light Green Flip", gradiente: "linear-gradient(135deg, #f77f00 0%, #9ef01a 100%)" },
  193: { nome: "Light Green/Red Flip", gradiente: "linear-gradient(135deg, #a7c957 0%, #6a040f 100%)" },
  194: { nome: "Light Green/Blue Flip", gradiente: "linear-gradient(135deg, #9ef01a 0%, #0077b6 100%)" },
  195: { nome: "Yellow/Orange Flip", gradiente: "linear-gradient(135deg, #ffea00 0%, #ff5400 100%)" },
  196: { nome: "Yellow/White Flip", gradiente: "linear-gradient(135deg, #ffd60a 0%, #ffffff 100%)" },
  197: { nome: "Gold/Purple Flip", gradiente: "linear-gradient(135deg, #ffd700 0%, #5a189a 100%)" },
  198: { nome: "Red/Rainbow Flip", gradiente: "linear-gradient(135deg, #ff0055 0%, #ffaa00 35%, #00e5ff 70%, #9900ff 100%)" },

  // Pearls & Special
  199: { nome: "Dark Green Pearl", gradiente: "linear-gradient(135deg, #0b2512 0%, #1b5e20 50%, #43a047 100%)" },
  200: { nome: "Dark Teal Pearl", gradiente: "linear-gradient(135deg, #001f24 0%, #006064 50%, #00acc1 100%)" },
  201: { nome: "Dark Blue Pearl", gradiente: "linear-gradient(135deg, #050e24 0%, #0d47a1 50%, #2196f3 100%)" },
  202: { nome: "Dark Purple Pearl", gradiente: "linear-gradient(135deg, #1f0529 0%, #4a148c 50%, #ab47bc 100%)" },
  203: { nome: "Oil Slick Pearl", gradiente: "linear-gradient(135deg, #111111 0%, #3f0071 35%, #1572a1 70%, #9ad0ec 100%)" },
  204: { nome: "Light Green Pearl", gradiente: "linear-gradient(135deg, #bbf7d0 0%, #4ade80 50%, #ffffff 100%)" },
  205: { nome: "Light Blue Pearl", gradiente: "linear-gradient(135deg, #bae6fd 0%, #38bdf8 50%, #ffffff 100%)" },
  206: { nome: "Light Purple Pearl", gradiente: "linear-gradient(135deg, #f5d0fe 0%, #c084fc 50%, #ffffff 100%)" },

  // Prismatics & E&E
  207: { nome: "Prismatic Pearl", gradiente: "linear-gradient(135deg, #ffffff 0%, #ffcbf2 30%, #e2eafc 70%, #d8f3dc 100%)" },
  208: { nome: "Prismatic Graphite", gradiente: "linear-gradient(135deg, #2b2d42 0%, #8d99ae 50%, #edf2f4 100%)" },
  209: { nome: "Prismatic Blue", gradiente: "linear-gradient(135deg, #0052d4 0%, #4364f7 50%, #6fb1fc 100%)" },
  210: { nome: "Cosmic Blue Flip", gradiente: "linear-gradient(135deg, #000428 0%, #004e92 50%, #26d0ce 100%)" },
  211: { nome: "Forest Green Flip", gradiente: "linear-gradient(135deg, #09203f 0%, #537895 50%, #00b4db 100%)" },
  212: { nome: "Deep Teal Flip", gradiente: "linear-gradient(135deg, #003940 0%, #00818a 50%, #40e0d0 100%)" },
  213: { nome: "Petrol Blue Flip", gradiente: "linear-gradient(135deg, #031b26 0%, #0f4c5c 50%, #32b5b5 100%)" },
  214: { nome: "Galaxy Purple Flip", gradiente: "linear-gradient(135deg, #1b002c 0%, #5e17eb 50%, #ff4b91 100%)" },
  215: { nome: "Cosmic Rainbow Flip", gradiente: "linear-gradient(135deg, #0f2027 0%, #203a43 25%, #2c5364 50%, #b388ff 75%, #00e676 100%)" },
  216: { nome: "Prismatic Black", gradiente: "linear-gradient(135deg, #0a0a0a 0%, #2d1b69 35%, #0c356a 70%, #ffffff 100%)" },
  217: { nome: "Pearl White Flip", gradiente: "linear-gradient(135deg, #ffffff 0%, #ff9ebb 25%, #a0c4ff 50%, #caffbf 75%, #fdffb6 100%)" },
  218: { nome: "Pure Rainbow Flip", gradiente: "linear-gradient(135deg, #ff0000 0%, #ff7f00 17%, #ffff00 33%, #00ff00 50%, #0000ff 67%, #4b0082 83%, #8f00ff 100%)" },
  219: { nome: "Sunset Flip", gradiente: "linear-gradient(135deg, #0b093b 0%, #4c1a57 30%, #a8204e 60%, #e06c3a 85%, #f1c40f 100%)" },
  220: { nome: "The Seven Flip", gradiente: "linear-gradient(135deg, #03001e 0%, #7303c0 33%, #ec38bc 66%, #fdeff9 100%)" },
  221: { nome: "Kamen Rider Flip", gradiente: "linear-gradient(135deg, #ff0844 0%, #ffb199 50%, #00ffcc 100%)" },
  222: { nome: "Synthwave Flip", gradiente: "linear-gradient(135deg, #2b1055 0%, #7597de 30%, #f72585 70%, #4cc9f0 100%)" },
  223: { nome: "Night & Day Flip", gradiente: "linear-gradient(135deg, #000000 0%, #141e30 40%, #243b55 70%, #fdfbfb 100%)" },
  224: { nome: "Verlierer Flip", gradiente: "linear-gradient(135deg, #3a1c71 0%, #d76d77 50%, #ffaf7b 100%)" }
};

// Nomes amigáveis para slots de GTA V / FiveM
export const NOMES_SLOTS = {
  0: "Aerofólio / Spoiler",
  1: "Para-choque Dianteiro",
  2: "Para-choque Traseiro",
  3: "Saias Laterais",
  4: "Escapamento",
  5: "Gaiola de Proteção / Roll Cage",
  6: "Grade Dianteira",
  7: "Capô",
  8: "Para-lama Dianteiro",
  9: "Para-lama Traseiro",
  10: "Teto",
  11: "Motor",
  12: "Freios",
  13: "Transmissão",
  14: "Buzina Personalizada",
  15: "Suspensão",
  16: "Blindagem",
  18: "Turbo",
  21: "Suspensão Hidráulica",
  22: "Farol Xênon",
  23: "Rodas / Rodas Dianteiras",
  24: "Rodas Traseiras",
  25: "Suporte de Placa",
  27: "Acabamentos / Trim",
  28: "Painel Interno",
  30: "Velocímetro / Mostradores",
  31: "Detalhes de Portas",
  32: "Bancos de Corrida",
  33: "Volante Customizado",
  34: "Alavanca de Câmbio",
  35: "Placa Decorativa",
  38: "Suspensão Hidráulica",
  39: "Bloco do Motor",
  40: "Filtro de Ar",
  41: "Barra Anti-Torção (Strut Brace)",
  42: "Cobertura de Faróis",
  43: "Antenas",
  45: "Cobertura de Tanque",
  48: "Adesivos / Livery"
};

// Dicionário Oficial Original de Cores do GTA V / FiveM em Inglês (IDs 0 a 160)
export const TABELA_CORES_GTA = {
  // Blacks & Grays
  0: { nome: "Metallic Black", hex: "#0d1116", tipo: "Metallic" },
  1: { nome: "Metallic Graphite Black", hex: "#1c1d21", tipo: "Metallic" },
  2: { nome: "Metallic Black Steel", hex: "#32383e", tipo: "Metallic" },
  3: { nome: "Metallic Dark Silver", hex: "#454b4f", tipo: "Metallic" },
  4: { nome: "Metallic Silver", hex: "#999da0", tipo: "Metallic" },
  5: { nome: "Metallic Blue Silver", hex: "#c2c4c6", tipo: "Metallic" },
  6: { nome: "Metallic Steel Gray", hex: "#979a97", tipo: "Metallic" },
  7: { nome: "Metallic Shadow Silver", hex: "#637380", tipo: "Metallic" },
  8: { nome: "Metallic Stone Silver", hex: "#63625c", tipo: "Metallic" },
  9: { nome: "Metallic Midnight Silver", hex: "#3c3f47", tipo: "Metallic" },
  10: { nome: "Metallic Gun Metal", hex: "#444e54", tipo: "Metallic" },
  11: { nome: "Metallic Anthracite Grey", hex: "#1d2129", tipo: "Metallic" },
  12: { nome: "Matte Black", hex: "#13181f", tipo: "Matte" },
  13: { nome: "Matte Gray", hex: "#26282a", tipo: "Matte" },
  14: { nome: "Matte Light Gray", hex: "#515554", tipo: "Matte" },
  15: { nome: "Util Black", hex: "#151921", tipo: "Util" },
  16: { nome: "Util Black Poly", hex: "#1e2429", tipo: "Util" },
  17: { nome: "Util Dark Silver", hex: "#333a3c", tipo: "Util" },
  18: { nome: "Util Silver", hex: "#8c9095", tipo: "Util" },
  19: { nome: "Util Gun Metal", hex: "#39434d", tipo: "Util" },
  20: { nome: "Util Shadow Silver", hex: "#506272", tipo: "Util" },
  21: { nome: "Worn Black", hex: "#1e232f", tipo: "Worn" },
  22: { nome: "Worn Graphite", hex: "#363a3e", tipo: "Worn" },
  23: { nome: "Worn Silver Gray", hex: "#a0a199", tipo: "Worn" },
  24: { nome: "Worn Silver", hex: "#d3d3d3", tipo: "Worn" },
  25: { nome: "Worn Blue Silver", hex: "#b7bfca", tipo: "Worn" },
  26: { nome: "Worn Shadow Silver", hex: "#778794", tipo: "Worn" },

  // Reds & Oranges
  27: { nome: "Metallic Red", hex: "#c00e1a", tipo: "Metallic" },
  28: { nome: "Metallic Torino Red", hex: "#da1918", tipo: "Metallic" },
  29: { nome: "Metallic Formula Red", hex: "#b6111b", tipo: "Metallic" },
  30: { nome: "Metallic Blaze Red", hex: "#a51e23", tipo: "Metallic" },
  31: { nome: "Metallic Graceful Red", hex: "#7b1a22", tipo: "Metallic" },
  32: { nome: "Metallic Garnet Red", hex: "#8e1b1f", tipo: "Metallic" },
  33: { nome: "Metallic Desert Red", hex: "#6f1818", tipo: "Metallic" },
  34: { nome: "Metallic Cabernet Red", hex: "#49111d", tipo: "Metallic" },
  35: { nome: "Metallic Candy Red", hex: "#b60f25", tipo: "Metallic" },
  36: { nome: "Metallic Sunrise Orange", hex: "#d44a17", tipo: "Metallic" },
  37: { nome: "Metallic Classic Gold", hex: "#c2944f", tipo: "Metallic" },
  38: { nome: "Metallic Orange", hex: "#f78616", tipo: "Metallic" },
  39: { nome: "Matte Red", hex: "#cf1f21", tipo: "Matte" },
  40: { nome: "Matte Dark Red", hex: "#732021", tipo: "Matte" },
  41: { nome: "Matte Orange", hex: "#f27d20", tipo: "Matte" },
  42: { nome: "Matte Yellow", hex: "#ffc91f", tipo: "Matte" },
  43: { nome: "Util Red", hex: "#9c1016", tipo: "Util" },
  44: { nome: "Util Bright Red", hex: "#de0f18", tipo: "Util" },
  45: { nome: "Util Garnet Red", hex: "#8f1e17", tipo: "Util" },
  46: { nome: "Worn Red", hex: "#a94744", tipo: "Worn" },
  47: { nome: "Worn Golden Red", hex: "#b16c51", tipo: "Worn" },
  48: { nome: "Worn Dark Red", hex: "#371c25", tipo: "Worn" },

  // Greens
  49: { nome: "Metallic Dark Green", hex: "#132428", tipo: "Metallic" },
  50: { nome: "Metallic Racing Green", hex: "#122e2b", tipo: "Metallic" },
  51: { nome: "Metallic Sea Green", hex: "#12383c", tipo: "Metallic" },
  52: { nome: "Metallic Olive Green", hex: "#31423f", tipo: "Metallic" },
  53: { nome: "Metallic Green", hex: "#155c2d", tipo: "Metallic" },
  54: { nome: "Metallic Gasoline Blue Green", hex: "#1b6770", tipo: "Metallic" },
  55: { nome: "Matte Lime Green", hex: "#66b235", tipo: "Matte" },
  56: { nome: "Util Dark Green", hex: "#22383e", tipo: "Util" },
  57: { nome: "Util Green", hex: "#1d5a3f", tipo: "Util" },
  58: { nome: "Worn Dark Green", hex: "#2d423f", tipo: "Worn" },
  59: { nome: "Worn Green", hex: "#45594b", tipo: "Worn" },
  60: { nome: "Worn Sea Wash", hex: "#65867f", tipo: "Worn" },

  // Blues
  61: { nome: "Metallic Midnight Blue", hex: "#222e46", tipo: "Metallic" },
  62: { nome: "Metallic Dark Blue", hex: "#233155", tipo: "Metallic" },
  63: { nome: "Metallic Saxony Blue", hex: "#304c7e", tipo: "Metallic" },
  64: { nome: "Metallic Blue", hex: "#475f7e", tipo: "Metallic" },
  65: { nome: "Metallic Mariner Blue", hex: "#637d98", tipo: "Metallic" },
  66: { nome: "Metallic Harbor Blue", hex: "#394762", tipo: "Metallic" },
  67: { nome: "Metallic Diamond Blue", hex: "#d6e7f1", tipo: "Metallic" },
  68: { nome: "Metallic Surf Blue", hex: "#769cb6", tipo: "Metallic" },
  69: { nome: "Metallic Nautical Blue", hex: "#344e5d", tipo: "Metallic" },
  70: { nome: "Metallic Bright Blue", hex: "#0b9cf1", tipo: "Metallic" },
  71: { nome: "Metallic Purple Blue", hex: "#2f2d52", tipo: "Metallic" },
  72: { nome: "Metallic Spinnaker Blue", hex: "#282c4d", tipo: "Metallic" },
  73: { nome: "Metallic Ultra Blue", hex: "#2354a1", tipo: "Metallic" },
  74: { nome: "Metallic Bright Blue", hex: "#6ea3c8", tipo: "Metallic" },
  75: { nome: "Matte Dark Blue", hex: "#1c2437", tipo: "Matte" },
  76: { nome: "Matte Midnight Blue", hex: "#1e2d4b", tipo: "Matte" },
  77: { nome: "Util Dark Blue", hex: "#172740", tipo: "Util" },
  78: { nome: "Util Midnight Blue", hex: "#184464", tipo: "Util" },
  79: { nome: "Util Blue", hex: "#476e82", tipo: "Util" },
  80: { nome: "Util Sea Foam Blue", hex: "#2b3b59", tipo: "Util" },
  81: { nome: "Util Lightning Blue", hex: "#86a6c4", tipo: "Util" },
  82: { nome: "Util Maui Blue Poly", hex: "#27374b", tipo: "Util" },
  83: { nome: "Util Bright Blue", hex: "#49637c", tipo: "Util" },
  84: { nome: "Matte Flagger Blue", hex: "#70899b", tipo: "Matte" },
  85: { nome: "Worn Dark Blue", hex: "#94b1c8", tipo: "Worn" },
  86: { nome: "Worn Blue", hex: "#3e5b87", tipo: "Worn" },
  87: { nome: "Worn Light Blue", hex: "#5d84a7", tipo: "Worn" },

  // Yellows, Golds & Browns
  88: { nome: "Metallic Taxi Yellow", hex: "#ffcc00", tipo: "Metallic" },
  89: { nome: "Metallic Race Yellow", hex: "#fbe212", tipo: "Metallic" },
  90: { nome: "Metallic Bronze", hex: "#916532", tipo: "Metallic" },
  91: { nome: "Metallic Yellow Bird", hex: "#e0e13d", tipo: "Metallic" },
  92: { nome: "Metallic Lime", hex: "#98d223", tipo: "Metallic" },
  93: { nome: "Metallic Champagne", hex: "#9b8b76", tipo: "Metallic" },
  94: { nome: "Metallic Pueblo Beige", hex: "#503218", tipo: "Metallic" },
  95: { nome: "Metallic Dark Ivory", hex: "#473f2b", tipo: "Metallic" },
  96: { nome: "Metallic Choco Brown", hex: "#221b19", tipo: "Metallic" },
  97: { nome: "Metallic Golden Brown", hex: "#653f23", tipo: "Metallic" },
  98: { nome: "Metallic Light Brown", hex: "#775c4c", tipo: "Metallic" },
  99: { nome: "Metallic Straw Beige", hex: "#ac9975", tipo: "Metallic" },
  100: { nome: "Metallic Moss Brown", hex: "#6c6b4b", tipo: "Metallic" },
  101: { nome: "Metallic Biston Brown", hex: "#402e2b", tipo: "Metallic" },
  102: { nome: "Metallic Beechwood", hex: "#a49479", tipo: "Metallic" },
  103: { nome: "Metallic Dark Beechwood", hex: "#715c44", tipo: "Metallic" },
  104: { nome: "Metallic Choco Orange", hex: "#422819", tipo: "Metallic" },
  105: { nome: "Metallic Beach Sand", hex: "#c2b192", tipo: "Metallic" },
  106: { nome: "Metallic Sun Bleeched Sand", hex: "#685848", tipo: "Metallic" },
  107: { nome: "Metallic Cream", hex: "#ebd7b2", tipo: "Metallic" },
  108: { nome: "Util Brown", hex: "#3f2d21", tipo: "Util" },
  109: { nome: "Util Medium Brown", hex: "#785f43", tipo: "Util" },
  110: { nome: "Util Light Brown", hex: "#b5a386", tipo: "Util" },

  // Whites, Metals & Special
  111: { nome: "Metallic White", hex: "#ffffff", tipo: "Metallic" },
  112: { nome: "Metallic Frost White", hex: "#f0f0f0", tipo: "Metallic" },
  113: { nome: "Worn Honey Beige", hex: "#bfae9b", tipo: "Worn" },
  114: { nome: "Worn Brown", hex: "#5d4e41", tipo: "Worn" },
  115: { nome: "Worn Dark Brown", hex: "#382c23", tipo: "Worn" },
  116: { nome: "Worn Straw Beige", hex: "#98846c", tipo: "Worn" },
  117: { nome: "Brushed Steel", hex: "#6a747c", tipo: "Metals" },
  118: { nome: "Brushed Black Steel", hex: "#35383e", tipo: "Metals" },
  119: { nome: "Brushed Aluminium", hex: "#9ba5b1", tipo: "Metals" },
  120: { nome: "Chrome", hex: "#e0e6ed", tipo: "Chrome" },
  121: { nome: "Worn Off White", hex: "#eaeaea", tipo: "Worn" },
  122: { nome: "Util Off White", hex: "#dfddd7", tipo: "Util" },
  123: { nome: "Worn Orange", hex: "#f2721e", tipo: "Worn" },
  124: { nome: "Worn Light Orange", hex: "#fca855", tipo: "Worn" },
  125: { nome: "Metallic Securicor Green", hex: "#5a6652", tipo: "Metallic" },
  126: { nome: "Worn Taxi Yellow", hex: "#fdbf10", tipo: "Worn" },
  127: { nome: "Police Car Blue", hex: "#2a548e", tipo: "Util" },
  128: { nome: "Matte Green", hex: "#4b5338", tipo: "Matte" },
  129: { nome: "Matte Brown", hex: "#5b4a39", tipo: "Matte" },
  130: { nome: "Worn Orange", hex: "#32392d", tipo: "Worn" },
  131: { nome: "Matte White", hex: "#ffffff", tipo: "Matte" },
  132: { nome: "Worn White", hex: "#f9f9fb", tipo: "Worn" },
  133: { nome: "Worn Army Green", hex: "#5d6e52", tipo: "Worn" },
  134: { nome: "Pure White", hex: "#f5f5f5", tipo: "Metallic" },
  135: { nome: "Hot Pink", hex: "#f21d7b", tipo: "Metallic" },
  136: { nome: "Salmon Pink", hex: "#f87171", tipo: "Metallic" },
  137: { nome: "Metallic Vermillion Pink", hex: "#fda4af", tipo: "Metallic" },
  138: { nome: "Orange", hex: "#ea580c", tipo: "Metallic" },
  139: { nome: "Green", hex: "#84cc16", tipo: "Metallic" },
  140: { nome: "Blue", hex: "#06b6d4", tipo: "Metallic" },
  141: { nome: "Metallic Black Blue", hex: "#0a192f", tipo: "Metallic" },
  142: { nome: "Metallic Black Purple", hex: "#170326", tipo: "Metallic" },
  143: { nome: "Metallic Black Red", hex: "#4c0519", tipo: "Metallic" },
  144: { nome: "Hunter Green", hex: "#374151", tipo: "Metallic" },
  145: { nome: "Metallic Purple", hex: "#7e22ce", tipo: "Metallic" },
  146: { nome: "Metallic V Dark Blue", hex: "#1e3a8a", tipo: "Metallic" },
  147: { nome: "Carbon Black", hex: "#111111", tipo: "Metallic" },
  148: { nome: "Matte Purple", hex: "#6b21a8", tipo: "Matte" },
  149: { nome: "Matte Dark Purple", hex: "#3b0764", tipo: "Matte" },
  150: { nome: "Metallic Lava Red", hex: "#b91c1c", tipo: "Metallic" },
  151: { nome: "Matte Forest Green", hex: "#4ade80", tipo: "Matte" },
  152: { nome: "Matte Olive Drab", hex: "#3f6212", tipo: "Matte" },
  153: { nome: "Matte Desert Brown", hex: "#78350f", tipo: "Matte" },
  154: { nome: "Matte Desert Tan", hex: "#c2410c", tipo: "Matte" },
  155: { nome: "Matte Foilage Green", hex: "#15803d", tipo: "Matte" },
  156: { nome: "Default Alloy Color", hex: "#1f2937", tipo: "Metallic" },
  157: { nome: "Epsilon Blue", hex: "#1d4ed8", tipo: "Metallic" },
  158: { nome: "Pure Gold", hex: "#eab308", tipo: "Metals" },
  159: { nome: "Brushed Gold", hex: "#ca8a04", tipo: "Metals" },
  160: { nome: "Secret Gold", hex: "#a16207", tipo: "Metals" }
};

/**
 * Identifica se uma pintura é camaleão e extrai seus dados visuais (nome e gradiente CSS)
 */
export function obterInfoPintura(paintObj, colorId) {
  const id = colorId !== undefined && colorId !== null ? Number(colorId) : (paintObj?.i !== undefined ? Number(paintObj.i) : null);
  const tipo = paintObj?.t !== undefined ? (typeof paintObj.t === "string" ? paintObj.t : Number(paintObj.t)) : (paintObj?.pt !== undefined ? Number(paintObj.pt) : null);

  // No GTA V / FiveM, cores Camaleão oficiais pertencem estritamente aos IDs 161 a 224
  const isIdCam = id !== null && id >= 161 && id <= 224;
  const isTabelaCam = id !== null && Boolean(TABELA_CAMALEAO[id]);
  const isTipoCam = (tipo === "chameleon" || tipo === "camaleao") && (id === null || id >= 161);

  if (isIdCam || isTabelaCam || isTipoCam) {
    const infoTabela = id !== null ? TABELA_CAMALEAO[id] : null;
    const nomeCor = infoTabela?.nome || `Camaleão #${id ?? "Especial"}`;
    const gradiente = infoTabela?.gradiente || "linear-gradient(135deg, #ff007f 0%, #7928ca 50%, #00f0ff 100%)";
    return {
      isCamaleao: true,
      nomeCor,
      gradiente,
      id: id ?? "Chameleon",
      tipo: "Chameleon"
    };
  }

  // Pintura Clássica / Metálica / Fosca / Perolada / Cromada (IDs 0 a 160)
  const infoGTA = id !== null ? TABELA_CORES_GTA[id] : null;
  const tipoLabel = tipo === 3 ? "Matte" : tipo === 1 ? "Metallic" : tipo === 2 ? "Pearlescent" : tipo === 5 ? "Chrome" : (infoGTA?.tipo || "Classic");
  
  // Se for ID >= 1000 ou cor customizada RGB do FiveM
  let nomeCor = infoGTA ? `${infoGTA.nome}` : (id !== null ? `Color #${id}` : "Custom RGB");
  let corHex = infoGTA?.hex || "#374151";

  if (paintObj?.r !== undefined && paintObj?.g !== undefined && paintObj?.b !== undefined) {
    nomeCor = `RGB (${paintObj.r}, ${paintObj.g}, ${paintObj.b})`;
    corHex = `rgb(${paintObj.r}, ${paintObj.g}, ${paintObj.b})`;
  } else if (id !== null && id >= 1000) {
    nomeCor = `🎨 Custom RGB Color (${id})`;
  }

  return {
    isCamaleao: false,
    nomeCor,
    gradiente: `linear-gradient(135deg, ${corHex} 0%, #111827 100%)`,
    hex: corHex,
    id: id ?? 0,
    tipo: (id !== null && id >= 1000) ? "Custom (RGB)" : tipoLabel
  };
}

/**
 * Identifica se uma pintura é camaleão (tipo de tinta ou range de ID)
 */
function isCamaleao(paintObj, colorId) {
  const info = obterInfoPintura(paintObj, colorId);
  return info.isCamaleao;
}

function isMesmaPintura(p1, p2) {
  if (!p1 && !p2) return true;
  if (!p1 || !p2) return false;

  const info1 = obterInfoPintura(p1, p1?.i);
  const info2 = obterInfoPintura(p2, p2?.i);

  // Se ambas forem a mesma cor hexadecimal visual (ex: #000000 === #000000) e mesmo status camaleão
  if (info1.hex && info2.hex && info1.hex.toLowerCase() === info2.hex.toLowerCase() && info1.isCamaleao === info2.isCamaleao) {
    return true;
  }

  // Se ambos tiverem RGB personalizado
  const hasRgb1 = p1.r !== undefined && p1.g !== undefined && p1.b !== undefined;
  const hasRgb2 = p2.r !== undefined && p2.g !== undefined && p2.b !== undefined;
  if (hasRgb1 && hasRgb2) {
    if (p1.r === p2.r && p1.g === p2.g && p1.b === p2.b) {
      return true;
    }
  }

  const i1 = p1.i !== undefined && p1.i !== null ? Number(p1.i) : null;
  const i2 = p2.i !== undefined && p2.i !== null ? Number(p2.i) : null;

  // Se ambos forem IDs padrão do jogo e iguais
  if (i1 !== null && i2 !== null && i1 < 1000 && i2 < 1000) {
    return i1 === i2;
  }

  return false;
}

/**
 * Motor de Comparação e Auditoria do Serviço (Antes x Depois)
 */
export function analisarServicoTunagem(arg1 = {}, arg2 = {}, arg3 = 0) {
  let antes = arg1;
  let depois = arg2;
  let valorPagoPainel = arg3;

  if (arg1 && typeof arg1 === "object" && (arg1.antes_json !== undefined || arg1.depois_json !== undefined || arg1.antes !== undefined || arg1.depois !== undefined)) {
    antes = arg1.antes_json || arg1.antes || {};
    depois = arg1.depois_json || arg1.depois || {};
    valorPagoPainel = arg1.valor_pago !== undefined ? arg1.valor_pago : (arg1.valorPago || 0);
  }

  const valorPagoNum = Number(valorPagoPainel) || 0;
  let itensCobrados = [];

  const slotsAntes = antes?.slots || {};
  const slotsDepois = depois?.slots || {};

  // -------------------------------------------------------------------------
  // 1. PERFORMANCE: Motor (11), Freios (12), Transmissão (13), Suspensão (15), Blindagem (16)
  // -------------------------------------------------------------------------
  const perfMap = [
    { key: "11", nome: "Motor", array: TABELA_PRECOS.performance.motor, arrayPainel: TABELA_PRECOS.performancePainel.motor, icone: "⚡" },
    { key: "12", nome: "Freios", array: TABELA_PRECOS.performance.freios, arrayPainel: TABELA_PRECOS.performancePainel.freios, icone: "🛑" },
    { key: "13", nome: "Transmissão", array: TABELA_PRECOS.performance.transmissao, arrayPainel: TABELA_PRECOS.performancePainel.transmissao, icone: "⚙️" },
    { key: "15", nome: "Suspensão", array: TABELA_PRECOS.performance.suspensao, arrayPainel: TABELA_PRECOS.performancePainel.suspensao, icone: "🛞" },
    { key: "16", nome: "Blindagem", array: TABELA_PRECOS.performance.blindagem, arrayPainel: TABELA_PRECOS.performancePainel.blindagem, icone: "🛡️" }
  ];

  for (const p of perfMap) {
    const valAntes = slotsAntes[p.key] !== undefined ? Number(slotsAntes[p.key]) : null;
    const valDepois = slotsDepois[p.key] !== undefined ? Number(slotsDepois[p.key]) : null;

    if (valDepois !== null && valDepois !== valAntes) {
      // No GTA V / FiveM: -1 é Stock/Padrão (Nível 0), 0 é Nível 1, 1 é Nível 2, 2 é Nível 3, 3 é Nível 4, 4 é Nível 5
      const nivelReal = valDepois === -1 ? 0 : valDepois + 1;
      const nivelIndex = Math.min(nivelReal, p.array.length - 1);
      const valorItem = p.array[nivelIndex] || p.array[p.array.length - 1] || 5000;
      const custoPainelItem = p.arrayPainel ? (p.arrayPainel[nivelIndex] || 500) : 500;
      const labelNivel = nivelReal === 0 ? "Padrão / Stock (Nível 0)" : `Nível ${nivelReal}`;

      const nivelAntesReal = valAntes !== null ? (valAntes === -1 ? 0 : valAntes + 1) : null;

      itensCobrados.push({
        categoria: "Performance",
        icone: p.icone,
        descricao: `${p.nome} - ${labelNivel}`,
        detalhe: nivelReal === 0 
          ? `Restaurado para Padrão / Stock (Nível 0)` 
          : nivelAntesReal !== null 
            ? `Antes: Nível ${nivelAntesReal} ➔ Depois: ${labelNivel}` 
            : `Instalado: ${labelNivel}`,
        custoPainel: custoPainelItem,
        valor: valorItem
      });
    }
  }

  // -------------------------------------------------------------------------
  // 2. TURBO
  // -------------------------------------------------------------------------
  const turboAntes = Boolean(antes?.turbo || slotsAntes["18"] === 1 || slotsAntes["18"] === 0);
  const turboDepois = Boolean(depois?.turbo || slotsDepois["18"] === 1 || slotsDepois["18"] === 0);

  if (turboDepois && (!turboAntes || slotsDepois["18"] !== slotsAntes["18"])) {
    itensCobrados.push({
      categoria: "Performance",
      icone: "🚀",
      descricao: "Instalação de Turbo Compressor",
      detalhe: "Turbo instalado e configurado",
      custoPainel: TABELA_PRECOS.turboPainel || 21000,
      valor: TABELA_PRECOS.turbo
    });
  }

  // -------------------------------------------------------------------------
  // 3. SUSPENSÃO HIDRÁULICA (Slot 21 ou Slot 38)
  // -------------------------------------------------------------------------
  const hidraulicoAntes = slotsAntes["21"] !== undefined ? slotsAntes["21"] : slotsAntes["38"];
  const hidraulicoDepois = slotsDepois["21"] !== undefined ? slotsDepois["21"] : slotsDepois["38"];

  if (hidraulicoDepois !== undefined && hidraulicoDepois !== hidraulicoAntes) {
    itensCobrados.push({
      categoria: "Performance",
      icone: "💧",
      descricao: "Suspensão Hidráulica",
      detalhe: "Instalação / Ativação de Hidráulica",
      custoPainel: TABELA_PRECOS.hidraulicoPainel || 5000,
      valor: TABELA_PRECOS.hidraulico
    });
  }

  // -------------------------------------------------------------------------
  // 4. PINTURAS (respray: primária, secundária, perolado, rodas)
  // -------------------------------------------------------------------------
  const resprayAntes = antes?.respray || {};
  const resprayDepois = depois?.respray || {};

  // 4.1 Pintura Primária
  if (resprayDepois.p && !isMesmaPintura(resprayAntes.p, resprayDepois.p)) {
    const info = obterInfoPintura(resprayDepois.p, resprayDepois.p?.i);
    itensCobrados.push({
      categoria: "Pintura",
      icone: "🎨",
      descricao: `Pintura Primária ${info.isCamaleao ? `(Camaleão: ${info.nomeCor})` : "(Metálica / Fosca / Comum)"}`,
      detalhe: `${info.nomeCor} · Cor ID: ${resprayDepois.p.i ?? "Custom"} (Tipo ${resprayDepois.p.t ?? 0})`,
      gradiente: info.gradiente,
      isCamaleao: info.isCamaleao,
      nomeCor: info.nomeCor,
      custoPainel: info.isCamaleao ? TABELA_PRECOS.corCamaleaoPainel : TABELA_PRECOS.pinturaComumPainel,
      valor: info.isCamaleao ? TABELA_PRECOS.corCamaleao : TABELA_PRECOS.pinturaComum
    });
  }

  // 4.2 Pintura Secundária
  if (resprayDepois.s && !isMesmaPintura(resprayAntes.s, resprayDepois.s)) {
    const info = obterInfoPintura(resprayDepois.s, resprayDepois.s?.i);
    itensCobrados.push({
      categoria: "Pintura",
      icone: "🎨",
      descricao: `Pintura Secundária ${info.isCamaleao ? `(Camaleão: ${info.nomeCor})` : "(Metálica / Fosca / Comum)"}`,
      detalhe: `${info.nomeCor} · Cor ID: ${resprayDepois.s.i ?? "Custom"} (Tipo ${resprayDepois.s.t ?? 0})`,
      gradiente: info.gradiente,
      isCamaleao: info.isCamaleao,
      nomeCor: info.nomeCor,
      custoPainel: info.isCamaleao ? TABELA_PRECOS.corCamaleaoPainel : TABELA_PRECOS.pinturaComumPainel,
      valor: info.isCamaleao ? TABELA_PRECOS.corCamaleao : TABELA_PRECOS.pinturaComum
    });
  }

  // 4.3 Perolado
  if (resprayDepois.pe !== undefined && resprayDepois.pe !== resprayAntes.pe) {
    const info = obterInfoPintura(null, resprayDepois.pe);
    itensCobrados.push({
      categoria: "Pintura",
      icone: "✨",
      descricao: `Perolado / Verniz ${info.isCamaleao ? `(Camaleão: ${info.nomeCor})` : "Custom"}`,
      detalhe: `${info.nomeCor} · Perolado Cor ID: ${resprayDepois.pe}`,
      gradiente: info.gradiente,
      isCamaleao: info.isCamaleao,
      nomeCor: info.nomeCor,
      custoPainel: info.isCamaleao ? TABELA_PRECOS.corCamaleaoPainel : TABELA_PRECOS.pinturaComumPainel,
      valor: info.isCamaleao ? TABELA_PRECOS.corCamaleao : TABELA_PRECOS.pinturaComum
    });
  }

  // 4.4 Cor das Rodas
  if (resprayDepois.wheels) {
    const wcAntes = resprayAntes.wheels?.c !== undefined && resprayAntes.wheels?.c !== null ? String(resprayAntes.wheels.c) : (antes?.wheelColor !== undefined ? String(antes.wheelColor) : null);
    const wcDepois = resprayDepois.wheels?.c !== undefined && resprayDepois.wheels?.c !== null ? String(resprayDepois.wheels.c) : (depois?.wheelColor !== undefined ? String(depois.wheelColor) : null);

    if (wcDepois !== null && wcAntes !== null && wcDepois !== wcAntes) {
      const info = obterInfoPintura(resprayDepois.wheels, Number(wcDepois));
      itensCobrados.push({
        categoria: "Pintura",
        icone: "🛞",
        descricao: `Pintura das Rodas ${info.isCamaleao ? `(Camaleão: ${info.nomeCor})` : ""}`,
        detalhe: `${info.nomeCor} · Cor ID: ${wcDepois}`,
        gradiente: info.gradiente,
        isCamaleao: info.isCamaleao,
        nomeCor: info.nomeCor,
        custoPainel: info.isCamaleao ? TABELA_PRECOS.corCamaleaoPainel : TABELA_PRECOS.pinturaComumPainel,
        valor: info.isCamaleao ? TABELA_PRECOS.corCamaleao : TABELA_PRECOS.pinturaComum
      });
    }
  }

  // -------------------------------------------------------------------------
  // 5. FUMAÇA DE PNEU (Tyre Smoke)
  // -------------------------------------------------------------------------
  const smokeAntes = antes?.tyreSmoke || antes?.tyresmoke || antes?.wheels?.smoke || slotsAntes["20"];
  const smokeDepois = depois?.tyreSmoke || depois?.tyresmoke || depois?.wheels?.smoke || slotsDepois["20"];

  const getSmokeRgb = (s) => (s && typeof s === "object" ? `${s.r ?? 255},${s.g ?? 255},${s.b ?? 255}` : s ? String(s) : null);
  const rgbSmokeA = getSmokeRgb(smokeAntes);
  const rgbSmokeD = getSmokeRgb(smokeDepois);

  const mudouFumaca = rgbSmokeD && rgbSmokeD !== rgbSmokeA;
  const eraPadraoEContinuouPadrao = (!smokeAntes || rgbSmokeA === "255,255,255" || rgbSmokeA === "0,0,0") && (!rgbSmokeD || rgbSmokeD === "255,255,255" || rgbSmokeD === "0,0,0");

  if (mudouFumaca && !eraPadraoEContinuouPadrao) {
    const r = smokeDepois?.r ?? 255;
    const g = smokeDepois?.g ?? 255;
    const b = smokeDepois?.b ?? 255;
    const isVoltouPadrao = rgbSmokeD === "255,255,255" || rgbSmokeD === "0,0,0";

    itensCobrados.push({
      categoria: "Efeitos",
      icone: "💨",
      descricao: isVoltouPadrao ? "Remoção / Restauração de Fumaça (Branco Padrão)" : "Fumaça de Pneu Personalizada",
      detalhe: rgbSmokeA ? `Antes: (${rgbSmokeA}) ➔ Depois: (${rgbSmokeD})` : `Fumaça RGB: (${rgbSmokeD})`,
      corVisual: `rgb(${r}, ${g}, ${b})`,
      boxGlow: `0 0 10px rgba(${r}, ${g}, ${b}, 0.8)`,
      custoPainel: TABELA_PRECOS.fumacaPneuPainel,
      valor: TABELA_PRECOS.fumacaPneu
    });
  }

  // -------------------------------------------------------------------------
  // 6. EXTRAS DO VEÍCULO
  // -------------------------------------------------------------------------
  const extrasAntes = antes?.extras || {};
  const extrasDepois = depois?.extras || {};
  let qtdExtrasAlterados = 0;

  const todasAsChavesExtras = Array.from(new Set([...Object.keys(extrasAntes), ...Object.keys(extrasDepois)]));

  for (const k of todasAsChavesExtras) {
    const a = extrasAntes[k] !== undefined ? Boolean(extrasAntes[k] === true || extrasAntes[k] === 1 || extrasAntes[k] === "true") : false;
    const d = extrasDepois[k] !== undefined ? Boolean(extrasDepois[k] === true || extrasDepois[k] === 1 || extrasDepois[k] === "true") : false;

    if (a !== d) {
      qtdExtrasAlterados++;
    }
  }

  if (qtdExtrasAlterados > 0) {
    itensCobrados.push({
      categoria: "Acessórios",
      icone: "🧩",
      descricao: `${qtdExtrasAlterados}x Extra(s) Instalado(s)`,
      detalhe: `${qtdExtrasAlterados} acessório(s) alterado(s) a R$ 3.500 cada`,
      custoPainel: qtdExtrasAlterados * TABELA_PRECOS.extraUnitarioPainel,
      valor: qtdExtrasAlterados * TABELA_PRECOS.extraUnitario
    });
  }

  // -------------------------------------------------------------------------
  // 7. ILUMINAÇÃO: FARÓIS XÊNON & NEONS
  // -------------------------------------------------------------------------
  const TABELA_XENON = {
    0: { nome: "Branco Puro", cor: "#ffffff" },
    1: { nome: "Azul Elétrico", cor: "#0088ff" },
    2: { nome: "Azul Claro", cor: "#38bdf8" },
    3: { nome: "Verde Menta", cor: "#34d399" },
    4: { nome: "Verde Limão", cor: "#84cc16" },
    5: { nome: "Amarelo", cor: "#facc15" },
    6: { nome: "Dourado", cor: "#eab308" },
    7: { nome: "Laranja", cor: "#f97316" },
    8: { nome: "Vermelho", cor: "#ef4444" },
    9: { nome: "Rosa Pônei", cor: "#f472b6" },
    10: { nome: "Rosa Choque (Hot Pink)", cor: "#ec4899" },
    11: { nome: "Roxo", cor: "#a855f7" },
    12: { nome: "Luz Negra / UV", cor: "#6366f1" }
  };

  const xenonAntes = antes?.xenons || (slotsAntes["22"] !== undefined ? { e: true, c: slotsAntes["22"] } : null);
  const xenonDepois = depois?.xenons || (slotsDepois["22"] !== undefined ? { e: true, c: slotsDepois["22"] } : null);

  const xenonAtivoAntes = Boolean(xenonAntes && (xenonAntes.e === true || xenonAntes.enabled === true));
  const xenonAtivoDepois = Boolean(xenonDepois && (xenonDepois.e === true || xenonDepois.enabled === true));

  if (xenonAtivoDepois && !xenonAtivoAntes) {
    itensCobrados.push({
      categoria: "Iluminação",
      icone: "💡",
      descricao: "Instalação de Farol Xênon",
      detalhe: "Farol xênon de alta intensidade",
      corVisual: "#ffffff",
      boxGlow: "0 0 10px rgba(255, 255, 255, 0.9)",
      custoPainel: TABELA_PRECOS.farolXenonPainel,
      valor: TABELA_PRECOS.farolXenon
    });

    if (xenonDepois.c !== undefined && xenonDepois.c !== null && xenonDepois.c !== 255 && xenonDepois.c !== 0) {
      const infoXenon = TABELA_XENON[xenonDepois.c];
      const corHex = infoXenon?.cor || "#00e5ff";
      itensCobrados.push({
        categoria: "Iluminação",
        icone: "💡",
        descricao: `Troca de Cor do Farol Xênon (${infoXenon?.nome || `#${xenonDepois.c}`})`,
        detalhe: `Cor do xênon: #${xenonDepois.c}`,
        corVisual: corHex,
        boxGlow: `0 0 10px ${corHex}`,
        custoPainel: TABELA_PRECOS.corXenonPainel,
        valor: TABELA_PRECOS.corXenon
      });
    }
  } else if (xenonAtivoDepois && xenonAtivoAntes) {
    if (xenonDepois.c !== undefined && xenonAntes.c !== undefined && xenonDepois.c !== xenonAntes.c) {
      const infoXenon = TABELA_XENON[xenonDepois.c];
      const corHex = infoXenon?.cor || "#00e5ff";
      itensCobrados.push({
        categoria: "Iluminação",
        icone: "💡",
        descricao: `Troca de Cor do Farol Xênon (${infoXenon?.nome || `#${xenonDepois.c}`})`,
        detalhe: `Cor do xênon: #${xenonDepois.c}`,
        corVisual: corHex,
        boxGlow: `0 0 10px ${corHex}`,
        custoPainel: TABELA_PRECOS.corXenonPainel,
        valor: TABELA_PRECOS.corXenon
      });
    }
  }

  // 7.2 Neons (Lados e Cor)
  const neonsAntes = antes?.neons || {};
  const neonsDepois = depois?.neons || {};

  const ladosCheck = [
    { key: "f", alt: "0" },
    { key: "b", alt: "1" },
    { key: "l", alt: "2" },
    { key: "ri", alt: "3" }
  ];

  let ladosNovos = 0;
  for (const lado of ladosCheck) {
    const antesAtivo = Boolean(neonsAntes[lado.key] === true || neonsAntes[lado.key] === 1 || neonsAntes[lado.alt] === 1 || neonsAntes[lado.alt] === true);
    const depoisAtivo = Boolean(neonsDepois[lado.key] === true || neonsDepois[lado.key] === 1 || neonsDepois[lado.alt] === 1 || neonsDepois[lado.alt] === true);
    if (depoisAtivo && !antesAtivo) {
      ladosNovos++;
    }
  }

  if (ladosNovos > 0) {
    itensCobrados.push({
      categoria: "Iluminação",
      icone: "✨",
      descricao: `Instalação de Neon (${ladosNovos} ${ladosNovos === 1 ? "lado" : "lados"})`,
      detalhe: `Frente/Trás/Laterais instalados (R$ 5.000 por lado)`,
      custoPainel: ladosNovos * TABELA_PRECOS.instalacaoNeonPorLadoPainel,
      valor: ladosNovos * TABELA_PRECOS.instalacaoNeonPorLado
    });
  }

  // Mudança de Cor do Neon
  const rgbAntes = `${neonsAntes.cr || 0},${neonsAntes.cg || 0},${neonsAntes.cb || 0}`;
  const rgbDepois = `${neonsDepois.cr || 0},${neonsDepois.cg || 0},${neonsDepois.cb || 0}`;

  const temNeonLigado = Object.values(neonsDepois).some((v) => Boolean(v === true || v === 1));
  if (temNeonLigado && rgbDepois !== "0,0,0" && rgbDepois !== rgbAntes && ladosNovos === 0) {
    const nr = neonsDepois.cr ?? 255;
    const ng = neonsDepois.cg ?? 255;
    const nb = neonsDepois.cb ?? 255;
    itensCobrados.push({
      categoria: "Iluminação",
      icone: "🌈",
      descricao: "Troca de Cor do Neon RGB",
      detalhe: `RGB: (${nr}, ${ng}, ${nb})`,
      corVisual: `rgb(${nr}, ${ng}, ${nb})`,
      boxGlow: `0 0 10px rgba(${nr}, ${ng}, ${nb}, 0.9)`,
      custoPainel: TABELA_PRECOS.corNeonPainel,
      valor: TABELA_PRECOS.corNeon
    });
  }

  // -------------------------------------------------------------------------
  // 8. INSULFILM (tint)
  // -------------------------------------------------------------------------
  if (depois?.tint !== undefined && depois?.tint !== antes?.tint && depois?.tint > 0) {
    const tiposTint = { 1: "Preto Puro / G5", 2: "Fumê Escuro", 3: "Fumê Claro", 4: "Stock", 5: "Limousine" };
    itensCobrados.push({
      categoria: "Estética",
      icone: "🪟",
      descricao: "Aplicação de Insulfilm",
      detalhe: tiposTint[depois.tint] || `Nível ${depois.tint}`,
      custoPainel: TABELA_PRECOS.insulfilmPainel,
      valor: TABELA_PRECOS.insulfilm
    });
  }

  // -------------------------------------------------------------------------
  // 9. RODAS CUSTOM / MODELO DE RODA (wheels)
  // -------------------------------------------------------------------------
  const wheelsAntes = antes?.wheels || {};
  const wheelsDepois = depois?.wheels || {};

  const wTipoA = wheelsAntes.t ?? null;
  const wTipoD = wheelsDepois.t ?? null;
  const wIdA = wheelsAntes.i ?? (slotsAntes["23"] !== undefined ? Number(slotsAntes["23"]) : null);
  const wIdD = wheelsDepois.i ?? (slotsDepois["23"] !== undefined ? Number(slotsDepois["23"]) : null);

  if (wIdD !== null && (wIdA === null || wIdD !== wIdA || (wTipoD !== null && wTipoA !== null && wTipoD !== wTipoA))) {
    if (wIdA === null || wIdD !== wIdA) {
      itensCobrados.push({
        categoria: "Estética",
        icone: "🛞",
        descricao: "Troca de Rodas Personalizadas",
        detalhe: `Tipo ${wTipoD ?? 0} · Modelo ${wIdD ?? 0}`,
        custoPainel: TABELA_PRECOS.pecaGeralPainel,
        valor: TABELA_PRECOS.pecaGeral
      });
    }
  }

  // -------------------------------------------------------------------------
  // 10. DEMAIS PEÇAS ESTÉTICAS GERAIS (Slots Cosméticos)
  // -------------------------------------------------------------------------
  // O slot 23 é tratado como modelo principal de rodas acima. O slot 24
  // representa as rodas traseiras e precisa continuar na lista cosmética.
  const slotsPerformanceIgnore = ["11", "12", "13", "15", "16", "18", "21", "22", "23", "38", "20"];

  const todasAsChavesSlots = Array.from(new Set([...Object.keys(slotsAntes), ...Object.keys(slotsDepois)]));

  for (const slotKey of todasAsChavesSlots) {
    if (slotsPerformanceIgnore.includes(slotKey)) continue;

    const valAntes = slotsAntes[slotKey] !== undefined ? Number(slotsAntes[slotKey]) : -1;
    const valDepois = slotsDepois[slotKey] !== undefined ? Number(slotsDepois[slotKey]) : -1;

    if (valDepois !== valAntes) {
      const nomePeca = NOMES_SLOTS[slotKey] || `Peça Cosmética (Slot ${slotKey})`;
      const iconePeca = slotKey === "48" ? "🏁" : "🛠️";
      const detalhe = valDepois === -1 
        ? "Removido / Restaurado para Padrão" 
        : valAntes === -1 
          ? `Instalado / Alterado: #${valDepois}` 
          : `Antes: #${valAntes} ➔ Depois: #${valDepois}`;

      itensCobrados.push({
        categoria: "Estética",
        icone: iconePeca,
        descricao: nomePeca,
        detalhe: detalhe,
        custoPainel: TABELA_PRECOS.pecaGeralPainel,
        valor: TABELA_PRECOS.pecaGeral
      });
    }
  }

  // Também verificar livery direto fora de slots caso algum script mande `livery`
  const liveryAntes = antes?.livery ?? antes?.livery2 ?? null;
  const liveryDepois = depois?.livery ?? depois?.livery2 ?? null;
  if (liveryDepois !== null && liveryDepois !== liveryAntes && slotsDepois["48"] === undefined && slotsAntes["48"] === undefined) {
    itensCobrados.push({
      categoria: "Estética",
      icone: "🏁",
      descricao: "Adesivos / Livery",
      detalhe: `Adesivo alterado para #${liveryDepois}`,
      custoPainel: TABELA_PRECOS.pecaGeralPainel,
      valor: TABELA_PRECOS.pecaGeral
    });
  }

  // -------------------------------------------------------------------------
  // 11. ESTILO DE PLACA / TROCA DE PLACA (plateStyle / plateIndex)
  // -------------------------------------------------------------------------
  const plateAntes = antes?.plateStyle !== undefined ? antes.plateStyle : (antes?.plateIndex !== undefined ? antes.plateIndex : antes?.plate_index);
  const plateDepois = depois?.plateStyle !== undefined ? depois.plateStyle : (depois?.plateIndex !== undefined ? depois.plateIndex : depois?.plate_index);

  const mudouPlaca = plateDepois !== undefined && plateDepois !== null && (plateAntes !== undefined && plateAntes !== null ? plateDepois !== plateAntes : plateDepois !== 0);

  if (mudouPlaca) {
    const TABELA_ESTILOS_PLACA = {
      0: "Azul em Branco (Padrão)",
      1: "Amarelo em Preto (San Andreas Black)",
      2: "Amarelo em Azul (Blue on Yellow)",
      3: "Azul em Branco (Estilo 2)",
      4: "Azul em Branco (Estilo 3)",
      5: "North Yankton (Yankton)",
      6: "Personalizada E&E"
    };
    const nomeEstilo = TABELA_ESTILOS_PLACA[plateDepois] || `Estilo #${plateDepois}`;
    const nomeAntes = plateAntes !== undefined && plateAntes !== null ? (TABELA_ESTILOS_PLACA[plateAntes] || `#${plateAntes}`) : null;

    itensCobrados.push({
      categoria: "Estética",
      icone: "🪪",
      descricao: `Troca de Placa (${nomeEstilo})`,
      detalhe: nomeAntes ? `Antes: ${nomeAntes} ➔ Depois: ${nomeEstilo}` : `Estilo de placa instalado: ${nomeEstilo}`,
      custoPainel: TABELA_PRECOS.pecaGeralPainel || 500,
      valor: TABELA_PRECOS.pecaGeral || 5000
    });
  }

  // -------------------------------------------------------------------------
  // 12. PINTURA DO INTERIOR & PAINEL (interiorColor / dashboardColor)
  // -------------------------------------------------------------------------
  if (depois?.interiorColor !== undefined && depois?.interiorColor !== antes?.interiorColor && depois?.interiorColor !== -1 && depois?.interiorColor !== null) {
    const info = obterInfoPintura(null, Number(depois.interiorColor));
    itensCobrados.push({
      categoria: "Pintura",
      icone: "💺",
      descricao: `Pintura do Interior ${info.isCamaleao ? `(Camaleão: ${info.nomeCor})` : ""}`,
      detalhe: `${info.nomeCor} · Cor ID: ${depois.interiorColor}`,
      custoPainel: TABELA_PRECOS.pecaGeralPainel || 500,
      valor: TABELA_PRECOS.pecaGeral || 5000
    });
  }
  if (depois?.dashboardColor !== undefined && depois?.dashboardColor !== antes?.dashboardColor && depois?.dashboardColor !== -1 && depois?.dashboardColor !== null) {
    const info = obterInfoPintura(null, Number(depois.dashboardColor));
    itensCobrados.push({
      categoria: "Pintura",
      icone: "📟",
      descricao: `Pintura do Painel (Dashboard) ${info.isCamaleao ? `(Camaleão: ${info.nomeCor})` : ""}`,
      detalhe: `${info.nomeCor} · Cor ID: ${depois.dashboardColor}`,
      custoPainel: TABELA_PRECOS.pecaGeralPainel || 500,
      valor: TABELA_PRECOS.pecaGeral || 5000
    });
  }

  // -------------------------------------------------------------------------
  // CASO ESPECIAL: SNAPSHOT ANTES/DEPOIS IDÊNTICO OU VAZIO, MAS COM CUSTO NO PAINEL
  // Reconstrói as peças reais instaladas no veículo (depois) até atingir o custo do painel
  // -------------------------------------------------------------------------
  let isFallbackPainel = false;
  let candidatosValidos = [];
  if (itensCobrados.length === 0 && valorPagoNum > 0) {
    isFallbackPainel = true;
    const candidatos = [];

    // 1. Performance por Nível
    for (const p of perfMap) {
      const val = slotsDepois[p.key] !== undefined ? Number(slotsDepois[p.key]) : -1;
      if (val >= 0) {
        const nivelReal = val + 1;
        const idx = Math.min(nivelReal, p.array.length - 1);
        candidatos.push({
          categoria: "Performance",
          icone: p.icone,
          descricao: `${p.nome} - Nível ${nivelReal}`,
          detalhe: `Instalado: Nível ${nivelReal}`,
          custoPainel: p.arrayPainel ? (p.arrayPainel[idx] || 0) : 0,
          valor: p.array[idx] || 0,
          prioridade: 1
        });
      }
    }

    // 2. Turbo
    if (depois?.turbo || slotsDepois["18"] === 1 || slotsDepois["18"] === 0) {
      candidatos.push({
        categoria: "Performance",
        icone: "🚀",
        descricao: "Instalação de Turbo Compressor",
        detalhe: "Turbo instalado e configurado",
        custoPainel: TABELA_PRECOS.turboPainel,
        valor: TABELA_PRECOS.turbo,
        prioridade: 2
      });
    }

    // 3. Suspensão Hidráulica
    if (slotsDepois["21"] !== undefined || slotsDepois["38"] !== undefined) {
      const hVal = slotsDepois["21"] ?? slotsDepois["38"];
      if (Number(hVal) >= 0) {
        candidatos.push({
          categoria: "Performance",
          icone: "💧",
          descricao: "Suspensão Hidráulica",
          detalhe: "Instalação / Ativação de Hidráulica",
          custoPainel: TABELA_PRECOS.hidraulicoPainel,
          valor: TABELA_PRECOS.hidraulico,
          prioridade: 3
        });
      }
    }

    // 4. Fumaça de Pneu Personalizada
    if (depois?.tyreSmoke && (depois.tyreSmoke.r !== 255 || depois.tyreSmoke.g !== 255 || depois.tyreSmoke.b !== 255)) {
      candidatos.push({
        categoria: "Efeitos",
        icone: "💨",
        descricao: "Fumaça de Pneu Personalizada",
        detalhe: `RGB (${depois.tyreSmoke.r ?? 255}, ${depois.tyreSmoke.g ?? 255}, ${depois.tyreSmoke.b ?? 255})`,
        corVisual: `rgb(${depois.tyreSmoke.r ?? 255}, ${depois.tyreSmoke.g ?? 255}, ${depois.tyreSmoke.b ?? 255})`,
        custoPainel: TABELA_PRECOS.fumacaPneuPainel,
        valor: TABELA_PRECOS.fumacaPneu,
        prioridade: 4
      });
    }

    // 5. Faróis Xênon & Cor
    if (depois?.xenons && (depois.xenons.e || slotsDepois["22"] !== undefined)) {
      candidatos.push({
        categoria: "Iluminação",
        icone: "💡",
        descricao: "Instalação de Farol Xênon",
        detalhe: "Farol xênon de alta intensidade",
        custoPainel: TABELA_PRECOS.farolXenonPainel,
        valor: TABELA_PRECOS.farolXenon,
        prioridade: 5
      });
      if (depois.xenons.c !== undefined && depois.xenons.c !== 255 && depois.xenons.c !== 0) {
        candidatos.push({
          categoria: "Iluminação",
          icone: "💡",
          descricao: `Troca de Cor do Farol Xênon (#${depois.xenons.c})`,
          detalhe: `Cor do xênon: #${depois.xenons.c}`,
          custoPainel: TABELA_PRECOS.corXenonPainel,
          valor: TABELA_PRECOS.corXenon,
          prioridade: 6
        });
      }
    }

    // 6. Neons
    if (depois?.neons) {
      const temNeonLado = ["f", "b", "l", "ri"].filter((k) => Boolean(depois.neons[k] === 1 || depois.neons[k] === true)).length;
      if (temNeonLado > 0) {
        candidatos.push({
          categoria: "Iluminação",
          icone: "✨",
          descricao: `Instalação de Neon (${temNeonLado} lados)`,
          detalhe: "Neons instalados",
          custoPainel: temNeonLado * TABELA_PRECOS.instalacaoNeonPorLadoPainel,
          valor: temNeonLado * TABELA_PRECOS.instalacaoNeonPorLado,
          prioridade: 7
        });
      }
      if (depois.neons.cr || depois.neons.cg || depois.neons.cb) {
        candidatos.push({
          categoria: "Iluminação",
          icone: "🌈",
          descricao: "Troca de Cor do Neon RGB",
          detalhe: `RGB: (${depois.neons.cr || 0}, ${depois.neons.cg || 0}, ${depois.neons.cb || 0})`,
          custoPainel: TABELA_PRECOS.corNeonPainel,
          valor: TABELA_PRECOS.corNeon,
          prioridade: 8
        });
      }
    }

    // 7. Insulfilm
    if (depois?.tint !== undefined && depois.tint > 0) {
      candidatos.push({
        categoria: "Estética",
        icone: "🪟",
        descricao: "Aplicação de Insulfilm",
        detalhe: `Nível ${depois.tint}`,
        custoPainel: TABELA_PRECOS.insulfilmPainel,
        valor: TABELA_PRECOS.insulfilm,
        prioridade: 9
      });
    }

    // 8. Pinturas (Primária, Secundária, Perolado, Rodas)
    if (depois?.respray?.p) {
      const infoP = obterInfoPintura(depois.respray.p, depois.respray.p.i);
      candidatos.push({
        categoria: "Pintura",
        icone: "🎨",
        descricao: `Pintura Primária ${infoP.isCamaleao ? `(Camaleão: ${infoP.nomeCor})` : "(Metálica / Fosca / Comum)"}`,
        detalhe: `${infoP.nomeCor} · ID: ${depois.respray.p.i ?? "Custom"}`,
        gradiente: infoP.gradiente,
        custoPainel: infoP.isCamaleao ? TABELA_PRECOS.corCamaleaoPainel : TABELA_PRECOS.pinturaComumPainel,
        valor: infoP.isCamaleao ? TABELA_PRECOS.corCamaleao : TABELA_PRECOS.pinturaComum,
        prioridade: 10
      });
    }
    if (depois?.respray?.s) {
      const infoS = obterInfoPintura(depois.respray.s, depois.respray.s.i);
      candidatos.push({
        categoria: "Pintura",
        icone: "🎨",
        descricao: `Pintura Secundária ${infoS.isCamaleao ? `(Camaleão: ${infoS.nomeCor})` : "(Metálica / Fosca / Comum)"}`,
        detalhe: `${infoS.nomeCor} · ID: ${depois.respray.s.i ?? "Custom"}`,
        gradiente: infoS.gradiente,
        custoPainel: infoS.isCamaleao ? TABELA_PRECOS.corCamaleaoPainel : TABELA_PRECOS.pinturaComumPainel,
        valor: infoS.isCamaleao ? TABELA_PRECOS.corCamaleao : TABELA_PRECOS.pinturaComum,
        prioridade: 11
      });
    }
    if (depois?.respray?.pe !== undefined && depois.respray.pe !== 0) {
      candidatos.push({
        categoria: "Pintura",
        icone: "✨",
        descricao: "Perolado / Verniz",
        detalhe: `Perolado Cor ID: ${depois.respray.pe}`,
        custoPainel: TABELA_PRECOS.pinturaComumPainel,
        valor: TABELA_PRECOS.pinturaComum,
        prioridade: 12
      });
    }
    if (depois?.respray?.wheels?.c !== undefined) {
      candidatos.push({
        categoria: "Pintura",
        icone: "🛞",
        descricao: "Pintura das Rodas",
        detalhe: `Cor ID: ${depois.respray.wheels.c}`,
        custoPainel: TABELA_PRECOS.pinturaComumPainel,
        valor: TABELA_PRECOS.pinturaComum,
        prioridade: 13
      });
    }

    // 9. Rodas Custom
    if (depois?.wheels && (depois.wheels.i !== undefined || depois.wheels.t !== undefined)) {
      candidatos.push({
        categoria: "Estética",
        icone: "🛞",
        descricao: "Troca de Rodas Personalizadas",
        detalhe: `Tipo ${depois.wheels.t ?? 0} · Modelo ${depois.wheels.i ?? 0}`,
        custoPainel: TABELA_PRECOS.pecaGeralPainel,
        valor: TABELA_PRECOS.pecaGeral,
        prioridade: 14
      });
    }

    // 10. Peças Cosméticas nos Slots
    for (const [sKey, sVal] of Object.entries(slotsDepois)) {
      if (slotsPerformanceIgnore.includes(sKey) || Number(sVal) < 0) continue;
      candidatos.push({
        categoria: "Estética",
        icone: sKey === "48" ? "🏁" : "🛠️",
        descricao: NOMES_SLOTS[sKey] || `Peça Cosmética (Slot ${sKey})`,
        detalhe: `Instalado: #${sVal}`,
        custoPainel: TABELA_PRECOS.pecaGeralPainel,
        valor: TABELA_PRECOS.pecaGeral,
        prioridade: 15
      });
    }

    // 11. Estilo de Placa
    const pD = depois?.plateStyle ?? depois?.plateIndex ?? depois?.plate_index ?? null;
    if (pD !== null && pD !== 0) {
      const TABELA_ESTILOS_PLACA = {
        0: "Azul em Branco (Padrão)",
        1: "Amarelo em Preto (San Andreas Black)",
        2: "Amarelo em Azul (Blue on Yellow)",
        3: "Azul em Branco (Estilo 2)",
        4: "Azul em Branco (Estilo 3)",
        5: "North Yankton (Yankton)",
        6: "Personalizada E&E"
      };
      candidatos.push({
        categoria: "Estética",
        icone: "🪪",
        descricao: `Troca de Placa (${TABELA_ESTILOS_PLACA[pD] || `#${pD}`})`,
        detalhe: `Estilo de placa: #${pD}`,
        custoPainel: TABELA_PRECOS.pecaGeralPainel || 500,
        valor: TABELA_PRECOS.pecaGeral || 5000,
        prioridade: 16
      });
    }

    // Atribuir IDs únicos e filtrar apenas candidatos cujo custo individual cabe no valor pago no painel
    candidatosValidos = candidatos
      .filter(c => c.custoPainel <= valorPagoNum)
      .map((c, idx) => ({ ...c, id: c.id || `cand_${idx}` }));

    // Ordenar por prioridade (Performance primeiro se couber, depois estética e cosméticos)
    candidatosValidos.sort((a, b) => (a.prioridade || 99) - (b.prioridade || 99));

    // Selecionar os itens estritamente até atingir o custo do painel
    let acumuladoPainel = 0;
    for (const c of candidatosValidos) {
      if (acumuladoPainel + c.custoPainel <= valorPagoNum) {
        itensCobrados.push(c);
        acumuladoPainel += c.custoPainel;
      }
    }
  }

  // -------------------------------------------------------------------------
  // RECONCILIAÇÃO COM O CUSTO DO PAINEL IN-GAME (valorPagoPainel)
  // -------------------------------------------------------------------------
  if (valorPagoNum > 0 && itensCobrados.length > 0 && !isFallbackPainel) {
    let somaPainel = itensCobrados.reduce((acc, item) => acc + (item.custoPainel || 0), 0);
    if (somaPainel > valorPagoNum) {
      let acumulado = 0;
      const filtrados = [];
      for (const item of itensCobrados) {
        const cPainel = item.custoPainel || 0;
        if (acumulado + cPainel <= valorPagoNum) {
          filtrados.push(item);
          acumulado += cPainel;
        }
      }
      if (filtrados.length > 0) {
        itensCobrados = filtrados;
      }
    }
  }

  // Garantir IDs únicos em todos os itens cobrados
  itensCobrados = itensCobrados.map((item, idx) => ({
    ...item,
    id: item.id || `item_${idx}`
  }));

  // -------------------------------------------------------------------------
  // CÁLCULO DOS TOTAIS
  // -------------------------------------------------------------------------
  const totalACobrar = itensCobrados.reduce((acc, item) => acc + item.valor, 0);
  const totalCustoPainel = itensCobrados.reduce((acc, item) => acc + (item.custoPainel || 0), 0);

  return {
    itensCobrados,
    candidatosDisponiveis: isFallbackPainel ? candidatosValidos : itensCobrados,
    totalACobrar,
    totalCustoPainel,
    // Compatibilidade com os componentes e testes que usam o nome oficial.
    custoPainelIdentificado: totalCustoPainel,
    valorPagoPainel: valorPagoNum,
    quantidadeItens: itensCobrados.length,
    isFallbackPainel
  };
}

/**
 * Formata um recibo/comanda em texto pronto para colar no Discord
 */
export function formatarReciboDiscord({
  mecanicaNome = "RED'S TUNERSHOP",
  baia = "Tunagem I",
  tecnicoNome = "",
  tecnicoId = "",
  donoNome = "",
  donoId = "",
  veiculoNome = "",
  placa = "",
  itensCobrados = [],
  totalACobrar = 0,
  valorPagoPainel = 0,
  dataStr = "",
  fotoUrl = ""
}) {
  const dataFormatada = dataStr || new Date().toLocaleString("pt-BR");

  let texto = `🔧 **FICHA DE COBRANÇA DE SERVIÇO - ${mecanicaNome.toUpperCase()}** 🔧\n`;
  texto += `📍 **Baia:** ${baia || "Tunagem"} | 📅 **Data:** ${dataFormatada}\n`;
  texto += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  texto += `🧑‍🔧 **Mecânico:** ${tecnicoNome} ${tecnicoId ? `(Passaporte: ${tecnicoId})` : ""}\n`;
  texto += `👤 **Cliente:** ${donoNome} ${donoId ? `(Passaporte: ${donoId})` : ""}\n`;
  texto += `🚗 **Veículo:** ${veiculoNome} | 🏷️ **Placa:** \`${placa}\`\n`;
  texto += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  texto += `📋 **ITENS E SERVIÇOS REALIZADOS:**\n`;

  if (itensCobrados.length === 0) {
    texto += `• *Serviço de manutenção geral / Sem peças adicionadas*\n`;
  } else {
    for (const item of itensCobrados) {
      texto += `• ${item.icone || "🛠️"} **${item.descricao}**: R$ ${Number(item.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}\n`;
    }
  }

  texto += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  texto += `💰 **TOTAL A COBRAR DO CLIENTE:** **R$ ${Number(totalACobrar).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}**\n`;
  if (valorPagoPainel > 0) {
    texto += `⚙️ *(Custo do Painel in-game: R$ ${Number(valorPagoPainel).toLocaleString("pt-BR")})*\n`;
  }
  if (fotoUrl) {
    texto += `📸 **Foto do Registro:** ${fotoUrl}\n`;
  }
  texto += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

  return texto;
}

/**
 * Extrai objetos JSON balanceados dentro de um texto a partir de uma posição ou tag
 */
export function extrairJsonBalanceado(texto, inicioBusca = 0) {
  if (!texto) return null;
  const start = texto.indexOf("{", inicioBusca);
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < texto.length; i++) {
    const char = texto[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (char === "\\") {
      escape = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (char === "{") depth++;
      else if (char === "}") {
        depth--;
        if (depth === 0) {
          const jsonStr = texto.substring(start, i + 1);
          try {
            return {
              json: JSON.parse(jsonStr),
              raw: jsonStr,
              start,
              end: i + 1
            };
          } catch (e) {
            // Se falhou o parse deste bloco, tenta a partir do próximo '{'
            return extrairJsonBalanceado(texto, start + 1);
          }
        }
      }
    }
  }
  return null;
}

/**
 * Parser de texto bruto de logs de tunagem e simulador de orçamentos
 */
export function parseLogsTunagemTexto(rawText) {
  if (!rawText || !rawText.trim()) return [];
  const logs = [];

  // Se tiver a tag padrão [TUNAGEM DE VEÍCULO], quebra nos blocos múltiplos
  const temTagMultiplos = /\[TUNAGEM DE VE[ÍI]CULO\]/i.test(rawText);
  const blocos = temTagMultiplos
    ? rawText.split(/(?=\[TUNAGEM DE VE[ÍI]CULO\])/i)
    : [rawText];

  for (let idx = 0; idx < blocos.length; idx++) {
    const bloco = blocos[idx].trim();
    if (!bloco) continue;

    const matchOficina = bloco.match(/\[Oficina\]:\s*(.+)/i);
    const matchBaia = bloco.match(/\[Baia\]:\s*(.+)/i);
    const matchTecnico = bloco.match(/\[T[ée]cnico\]:\s*(.+?)(?:\s*\(ID:\s*(\d+)\))?$/m);
    const matchDono = bloco.match(/\[Dono\]:\s*(.+?)(?:\s*\(ID:\s*(\d+)\))?$/m);
    const matchVeiculo = bloco.match(/\[Ve[íi]culo\]:\s*(.+?)(?:\s*\(([^)]+)\))?$/m);
    const matchPlaca = bloco.match(/\[Placa\]:\s*(.+)/i);
    const matchValor = bloco.match(/\[Valor Pago\]:\s*R?\$?\s*([\d\.\,]+)/i);
    const matchData = bloco.match(/\[DATA\]:\s*(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)(?:,\s*(\d{1,2}:\d{2}(?::\d{2})?))?/i);
    const matchUuid = bloco.match(/\[UUID\]:\s*([a-f0-9\-]+)/i);

    // Extrair JSON de Antes e Depois
    let antesJson = {};
    let depoisJson = {};

    // 1. Procurar tag [Antes] ou [Antes de Modificação]
    const idxAntes = bloco.search(/\[Antes(?: de Modifica[çc][ãa]o)?\]/i);
    if (idxAntes !== -1) {
      const extraido = extrairJsonBalanceado(bloco, idxAntes);
      if (extraido) antesJson = extraido.json;
    }

    // 2. Procurar tag [Depois] ou [Depois de Modificação]
    const idxDepois = bloco.search(/\[Depois(?: de Modifica[çc][ãa]o)?\]/i);
    if (idxDepois !== -1) {
      const extraido = extrairJsonBalanceado(bloco, idxDepois);
      if (extraido) depoisJson = extraido.json;
    }

    // 3. Fallback: Se não encontrou nem antes nem depois por tag, mas existe JSON no texto
    if (idxAntes === -1 && idxDepois === -1) {
      const primeiroJson = extrairJsonBalanceado(bloco, 0);
      if (primeiroJson) {
        depoisJson = primeiroJson.json;
        // Se houver um segundo JSON no texto, o primeiro é Antes e o segundo é Depois
        const segundoJson = extrairJsonBalanceado(bloco, primeiroJson.end);
        if (segundoJson) {
          antesJson = primeiroJson.json;
          depoisJson = segundoJson.json;
        }
      }
    }

    const temJsonValido =
      (antesJson && typeof antesJson === "object" && Object.keys(antesJson).length > 0) ||
      (depoisJson && typeof depoisJson === "object" && Object.keys(depoisJson).length > 0);

    // Se é log do Discord ou se tem dados suficientes (comanda, JSON ou técnico)
    if (matchTecnico || matchUuid || temJsonValido) {
      let valorNum = 0;
      if (matchValor && matchValor[1]) {
        valorNum = Number(matchValor[1].replace(/\./g, "").replace(",", ".")) || 0;
      }

      let dataStr = new Date().toISOString().split("T")[0];
      let hora = new Date().toTimeString().split(" ")[0];
      if (matchData) {
        const parts = matchData[1].split("/");
        if (parts.length >= 2) {
          const dd = String(parts[0]).padStart(2, "0");
          const mm = String(parts[1]).padStart(2, "0");
          const yyyy = parts[2] ? (parts[2].length === 2 ? `20${parts[2]}` : parts[2]) : "2026";
          dataStr = `${yyyy}-${mm}-${dd}`;
        }
        if (matchData[2]) {
          hora = matchData[2].length === 5 ? `${matchData[2]}:00` : matchData[2];
        }
      }

      logs.push({
        uuid: matchUuid ? matchUuid[1].trim() : `sim-${Date.now()}-${idx}`,
        oficina_nome: matchOficina ? matchOficina[1].trim() : "RED'S TUNERSHOP",
        baia_nome: matchBaia ? matchBaia[1].trim() : null,
        tecnico_id: matchTecnico && matchTecnico[2] ? matchTecnico[2].trim() : "0",
        tecnico_nome: matchTecnico && matchTecnico[1] ? matchTecnico[1].trim() : "Simulador / Orçamento",
        dono_id: matchDono && matchDono[2] ? matchDono[2].trim() : null,
        dono_nome: matchDono && matchDono[1] ? matchDono[1].trim() : null,
        veiculo_nome: matchVeiculo && matchVeiculo[1] ? matchVeiculo[1].trim() : "Veículo Simulado",
        veiculo_modelo: matchVeiculo && matchVeiculo[2] ? matchVeiculo[2].trim() : null,
        placa: matchPlaca ? matchPlaca[1].trim() : "SIM-2026",
        valor_pago: valorNum,
        antes_json: antesJson,
        depois_json: depoisJson,
        data: dataStr,
        hora: hora,
        raw_text: bloco
      });
    }
  }

  return logs;
}
