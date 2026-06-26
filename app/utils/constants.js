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