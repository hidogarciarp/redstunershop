export const CARGOS_HIERARQUIA = [
  { value: "jovem_aprendiz", label: "Jovem Aprendiz", nivel: 1 },
  { value: "estagiario", label: "Estagiário", nivel: 1 },
  { value: "mecanico", label: "Mecânico", nivel: 2 },
  { value: "mecanico_senior", label: "Mecânico Sênior", nivel: 3 },
  { value: "supervisor", label: "Supervisor", nivel: 4 },
  { value: "gerente", label: "Gerente", nivel: 5 },
  { value: "gerente_rh", label: "Gerente RH", nivel: 6 },
  { value: "gerente_geral", label: "Gerente Geral", nivel: 6 },
  { value: "dono", label: "Dono", nivel: 7 },
  { value: "admin", label: "Admin (sistema)", nivel: 8 },
];

export const ATRIBUICOES_DISPONIVEIS = [
  { value: "gerente_rh", label: "Gerente RH" },
  { value: "resp_rh", label: "Resp. RH" },
  { value: "resp_ponto", label: "Resp. Ponto" },
  { value: "resp_eventos", label: "Resp. Eventos" },
  { value: "resp_tunagem", label: "Resp. Tunagem" },
  { value: "resp_parcerias", label: "Resp. Parcerias" },
  { value: "resp_financas", label: "Resp. Finanças" },
  { value: "dono_secundario", label: "Dono Secundário" },
];

export const TABELA_PRECOS = {
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
    { id: "tf1", nome: "Tunagem Full Sem Blindagem", preco: 212800 },
    { id: "tf2", nome: "Tunagem Full Com Blindagem", preco: 308800 },
    { id: "tf3", nome: "Tunagem Full Sem Blindagem/Suspensão", preco: 171840 },
  ],
};

export const REGRAS_PRECOS = {
  guincho: {
    valor_fixo: 2000,
    valor_km: 2500,
    valor_reparo: 4500,
    valor_pneu: 2500
  },
  estetica: {
    // Proporção personalizada pelo usuário: "A cada X no painel, cobramos Y do cliente"
    painel_referencia: 500,
    valor_cliente_referencia: 5000,

    // Valores Finais (Cliente)
    valor_cliente_fumaca: 9000,
    valor_cliente_extra: 3500,
    valor_cliente_camaleao: 10000,

    // Custos Referência (Painel In-Game) para dedução
    painel_fumaca: 5000,
    painel_extra: 1000,
    painel_camaleao: 500
  }
};

export const CURSOS_OBRIGATORIOS = [
  {
    id: "estagiario",
    titulo: "Curso Estagiário",
    subtitulo: "Libera os serviços de estética no sistema.",
    campo: "curso_estagiario_concluido",
    cor: "#b40d0d",
    simuladoMinimo: 70,
    modulos: [
      {
        id: "est-1",
        titulo: "Uniforme e Identidade Visual",
        descricao: "Importância do uniforme durante o expediente, regras de identificação da mecânica e situações em que o uniforme é obrigatório.",
        topicos: [
          "Importância do uniforme durante o expediente",
          "Regras de identificação da mecânica",
          "Situações em que o uniforme é obrigatório",
        ],
        youtubeId: "dQw4w9WgXcQ",
      },
      {
        id: "est-2",
        titulo: "Uso do Rádio",
        descricao: "Frequência oficial da mecânica e comunicação clara, objetiva e profissional durante o expediente.",
        topicos: [
          "Frequência oficial da mecânica",
          "Comunicação clara e objetiva",
        ],
        youtubeId: "dQw4w9WgXcQ",
      },
      {
        id: "est-3",
        titulo: "Sistema de Ponto e Horas Trabalhadas",
        descricao: "Tempo mínimo de expediente, funcionamento do ponto, regra das horas e recomendação de fechar e abrir o ponto a cada 30 minutos para evitar perdas por crash.",
        topicos: [
          "Tempo mínimo de expediente",
          "Funcionamento do ponto",
          "Fechar e abrir o ponto a cada 30 minutos para evitar perdas por crash",
          "Regras para contabilização das horas",
        ],
        youtubeId: "dQw4w9WgXcQ",
      },
      {
        id: "est-4",
        titulo: "Registradora e Vendas",
        descricao: "Uso da registradora, venda de pneus, caixas de ferramentas, chave, aplicações, restrições e registro correto de vendas de nitro e kit drift.",
        topicos: [
          "Como utilizar a registradora",
          "Venda de pneus",
          "Venda de caixas de ferramentas, aplicações e restrições",
          "Venda de chave e seu uso",
          "Registro correto das vendas de nitro e kit drift",
        ],
        youtubeId: "dQw4w9WgXcQ",
      },
      {
        id: "est-5",
        titulo: "Raspadinha e Economia da Cidade",
        descricao: "O que é a raspadinha, como funciona essa parte da economia da cidade e boas práticas de atendimento ao cliente.",
        topicos: [
          "O que é a raspadinha",
          "Como funciona essa parte da economia da cidade",
          "Boas práticas de atendimento ao cliente",
        ],
        youtubeId: "dQw4w9WgXcQ",
      },
      {
        id: "est-6",
        titulo: "Reparo Básico e Atendimento Inicial",
        descricao: "Prioridade dos estagiários em serviços básicos, agilidade no atendimento, verificação do veículo, troca de pneus com chave, reparo de motor e quando chamar um mecânico mais experiente.",
        topicos: [
          "Prioridade dos estagiários nos serviços básicos",
          "Agilidade no atendimento",
          "Como verificar o estado do veículo",
          "Troca de pneus com a chave em mãos",
          "Reparo de motor",
          "Quando encaminhar o cliente para um mecânico mais experiente",
        ],
        youtubeId: "dQw4w9WgXcQ",
      },
      {
        id: "est-7",
        titulo: "Serviços Estéticos",
        descricao: "Livery, extras, pintura comum, camaleão, cuidados ao modificar veículos e regra especial para veículos oficiais: alterações somente quando devidamente uniformizado.",
        topicos: [
          "Aplicação e alteração de livery",
          "Instalação e remoção de extras",
          "Pintura comum e camaleão",
          "Cuidados ao modificar veículos",
          "Veículos oficiais: somente alterar quando devidamente uniformizado",
        ],
        youtubeId: "dQw4w9WgXcQ",
      },
      {
        id: "est-8",
        titulo: "Guincho e Atendimentos Externos",
        descricao: "Registro de QRU, funcionamento do guincho, cobrança do serviço, quantidade mínima de mecânicos no atendimento externo e obrigação de ligar para o cliente antes do deslocamento.",
        topicos: [
          "Como registrar um QRU",
          "Funcionamento do guincho",
          "Cobrança do serviço",
          "Quantidade mínima de mecânicos para atendimento externo",
          "Obrigatoriedade de ligar para o cliente antes do deslocamento",
        ],
        youtubeId: "dQw4w9WgXcQ",
      },
      {
        id: "est-9",
        titulo: "Sistema de Promoções",
        descricao: "Tempo mínimo para promoção, bonificações, incentivos e o que é esperado de cada cargo dentro da mecânica.",
        topicos: [
          "Tempo mínimo para promoção",
          "Bonificações e incentivos",
          "O que é esperado de cada cargo",
        ],
        youtubeId: "dQw4w9WgXcQ",
      },
      {
        id: "est-10",
        titulo: "Regras das Mecânicas da Cidade",
        descricao: "Normas gerais, conduta profissional e regras específicas do servidor para atuação correta na cidade.",
        topicos: [
          "Normas gerais",
          "Conduta profissional",
          "Regras específicas do servidor",
        ],
        youtubeId: "dQw4w9WgXcQ",
      },
    ],
    praticaEstetica: {
      titulo: "Prática de Registro de Estética",
      descricao: "Simule o preenchimento do registro de estética. Atenção especial para fumaça, extras, camaleão e valor do painel.",
      cenarios: [
        {
          id: "estetica-fumaca-extra",
          veiculo: "Cliente pediu pintura, fumaça e 2 extras",
          contexto: "O painel do VTuning mostra R$ 17.000. No atendimento foram aplicados fumaça e dois extras.",
          correto: {
            valorPainel: 17000,
            quantidadeExtras: 2,
            fumaca: true,
            camaleao1: false,
            camaleao2: false,
            camaleaoRodas: false,
          },
          dica: "Se fumaça ou extras foram aplicados, eles precisam ser marcados no registro.",
        },
        {
          id: "estetica-camaleao-rodas",
          veiculo: "Cliente pediu camaleão nas rodas",
          contexto: "O painel mostra R$ 8.500. A única alteração especial foi camaleão nas rodas.",
          correto: {
            valorPainel: 8500,
            quantidadeExtras: 0,
            fumaca: false,
            camaleao1: false,
            camaleao2: false,
            camaleaoRodas: true,
          },
          dica: "Camaleão nas rodas não é a mesma coisa que camaleão primária ou secundária.",
        },
        {
          id: "estetica-simples-sem-extra",
          veiculo: "Pintura comum sem extras",
          contexto: "O cliente pediu apenas pintura comum. Não houve fumaça, extras ou camaleão.",
          correto: {
            valorPainel: 5000,
            quantidadeExtras: 0,
            fumaca: false,
            camaleao1: false,
            camaleao2: false,
            camaleaoRodas: false,
          },
          dica: "Não marque opções especiais quando elas não foram aplicadas.",
        },
      ],
    },
    simulado: [
      {
        id: "est-q1",
        pergunta: "Quando o uniforme da mecânica deve ser usado?",
        opcoes: [
          "Durante o expediente e nos atendimentos obrigatórios",
          "Somente quando houver fiscalização",
          "Apenas em serviços externos",
        ],
        correta: 0,
      },
      {
        id: "est-q2",
        pergunta: "Qual é a melhor forma de comunicação pelo rádio?",
        opcoes: [
          "Clara, objetiva e profissional",
          "Com conversas longas e informais",
          "Sem identificar o assunto do chamado",
        ],
        correta: 0,
      },
      {
        id: "est-q3",
        pergunta: "Por que é recomendado fechar e abrir o ponto a cada 30 minutos?",
        opcoes: [
          "Para evitar perdas de horas em caso de crash",
          "Para zerar o expediente",
          "Para trocar automaticamente de cargo",
        ],
        correta: 0,
      },
      {
        id: "est-q4",
        pergunta: "Em serviços básicos, qual deve ser a postura do estagiário?",
        opcoes: [
          "Atender com agilidade e chamar um mecânico experiente quando necessário",
          "Fazer qualquer tunagem sem autorização",
          "Ignorar clientes quando houver fila",
        ],
        correta: 0,
      },
      {
        id: "est-q5",
        pergunta: "Em veículos oficiais, quando alterações estéticas podem ser feitas?",
        opcoes: [
          "Somente quando devidamente uniformizado e seguindo a regra da mecânica",
          "Sempre, mesmo fora de expediente",
          "Apenas se o cliente pagar em dobro",
        ],
        correta: 0,
      },
      {
        id: "est-q6",
        pergunta: "Antes de se deslocar para um atendimento externo, o que é obrigatório?",
        opcoes: [
          "Ligar para o cliente antes do deslocamento",
          "Registrar tunagem no sistema",
          "Fechar a mecânica",
        ],
        correta: 0,
      },
    ],
  },
  {
    id: "tunagem",
    titulo: "Curso de Tunagem",
    subtitulo: "Libera instalação de performance e peças de tunagem.",
    campo: "curso_tunagem_concluido",
    cor: "#ef4444",
    simuladoMinimo: 70,
    modulos: [
      {
        id: "tun-1",
        titulo: "Sistema de Tunagem",
        descricao: "VTuning, registro correto de tunagem, verificação da aplicação, nitro, drift, regras de venda/aplicação e o que cada upgrade altera no veículo.",
        topicos: [
          "VTuning: como registrar uma tunagem corretamente",
          "Verificar se a aplicação foi bem sucedida",
          "Nitro: instalação e regras de venda/aplicação",
          "Drift: instalação e regras de venda/aplicação",
          "Upgrades: o que cada peça altera no veículo",
        ],
        youtubeId: "dQw4w9WgXcQ",
      },
      {
        id: "tun-2",
        titulo: "Encerramento e Boas Práticas",
        descricao: "Atendimento ao cliente, trabalho em equipe, organização do ambiente e postura profissional ao representar a RED's Tunershop.",
        topicos: [
          "Atendimento ao cliente",
          "Trabalho em equipe",
          "Organização do ambiente",
          "Representar a RED's Tunershop com profissionalismo",
        ],
        youtubeId: "dQw4w9WgXcQ",
      },
    ],
    praticaDashboard: {
      titulo: "Prática de preenchimento da Dashboard",
      descricao: "Simule uma tunagem real. Nem todo veículo aceita opções máximas; confira o carro antes de selecionar as peças.",
      cenarios: [
        {
          id: "sedan-basico",
          veiculo: "Sedan urbano de cliente novo",
          contexto: "Cliente pediu uma melhoria simples. O veículo não possui suporte para blindagem máxima e não deve receber setup full.",
          corretas: ["m2", "t2", "f2", "s1"],
          dica: "Evite marcar níveis máximos sem confirmar disponibilidade no VTuning.",
        },
        {
          id: "esportivo-full-sem-blindagem",
          veiculo: "Esportivo com suporte a performance completa, sem blindagem",
          contexto: "O cliente autorizou uma tunagem forte, mas este veículo não permite blindagem.",
          corretas: ["m5", "t5", "f5", "s5"],
          dica: "Full sem blindagem não deve incluir Blindagem Nível 5.",
        },
        {
          id: "veiculo-com-drift",
          veiculo: "Projeto drift",
          contexto: "Cliente quer preparação para drift, com kit drift e upgrades coerentes. Nitro não foi solicitado.",
          corretas: ["m4", "t4", "f3", "s3", "d1"],
          dica: "Não adicione nitro quando o cliente não pediu e não force todas as peças no máximo.",
        },
      ],
    },
    simulado: [
      {
        id: "tun-q1",
        pergunta: "No VTuning, o que deve ser feito após registrar uma tunagem?",
        opcoes: [
          "Verificar se a aplicação foi bem sucedida",
          "Encerrar o atendimento sem conferir",
          "Remover o print do relatório",
        ],
        correta: 0,
      },
      {
        id: "tun-q2",
        pergunta: "Nitro e drift devem seguir qual orientação?",
        opcoes: [
          "Regras de venda e aplicação da mecânica",
          "Instalação livre, sem registro",
          "Uso apenas para teste pessoal",
        ],
        correta: 0,
      },
      {
        id: "tun-q3",
        pergunta: "Antes de finalizar uma tunagem, o mecânico deve entender que:",
        opcoes: [
          "Cada upgrade altera algo no comportamento do veículo",
          "Todas as peças fazem exatamente a mesma coisa",
          "A escolha das peças não precisa ser registrada",
        ],
        correta: 0,
      },
      {
        id: "tun-q4",
        pergunta: "Qual postura representa melhor a RED's Tunershop?",
        opcoes: [
          "Atendimento profissional, equipe organizada e cuidado com o cliente",
          "Pressa sem conferência",
          "Falta de comunicação com a equipe",
        ],
        correta: 0,
      },
    ],
  },
];
