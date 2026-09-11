/**
 * @typedef {Object} Usuario
 * @property {number} id
 * @property {string} nome
 * @property {string} role - formato "cargo|atribuicao1|atribuicao2"
 * @property {string} [senha]
 * @property {string} [status] - "ativo"|"inativo"|"ferias"
 * @property {string} [telefone]
 * @property {string} [avatar_url]
 * @property {string} [data_admissao]
 * @property {string} [data_vencimento]
 * @property {number} [valor_semanal]
 * @property {boolean} [bloqueado_financeiro]
 * @property {string} [credito_24h_disponivel]
 * @property {string} [credito_24h_usado_em]
 * @property {string} [ids_antigos]
 * @property {string} [nomes_antigos]
 */

/**
 * @typedef {Object} Cliente
 * @property {number} id
 * @property {string} nome
 * @property {number} [total_gasto]
 * @property {string} [ultima_alteracao]
 * @property {string} [data_ultimo_servico]
 */

/**
 * @typedef {Object} Servico
 * @property {number} id
 * @property {number} funcionario_id
 * @property {string} funcionario_nome
 * @property {number} cliente_id
 * @property {string} cliente_nome
 * @property {string} tipo
 * @property {number} valor_total
 * @property {string} data
 * @property {string} [criado_em]
 * @property {string} [link_imagem]
 * @property {string} [detalhes]
 */

/**
 * @typedef {Object} PontoRegistro
 * @property {number} id
 * @property {number} usuario_id
 * @property {string} nome
 * @property {string} entrada
 * @property {string} [saida]
 * @property {string} data
 * @property {boolean} [verificado]
 * @property {number} [verificado_por]
 * @property {boolean} [estrela]
 * @property {boolean} [oculto]
 * @property {string} [uuid_entrada]
 * @property {string} [uuid_saida]
 * @property {number} [importado_por]
 */

/**
 * @typedef {Object} Notificacao
 * @property {number} id
 * @property {number} admin_id
 * @property {string} admin_nome
 * @property {number} [admin_id_real]
 * @property {boolean} [anonimo]
 * @property {number} funcionario_id
 * @property {string} funcionario_nome
 * @property {string} mensagem
 * @property {string} criado_em
 * @property {string} [lido_em]
 * @property {boolean} [lida]
 */

/**
 * @typedef {Object} Cargo
 * @property {string} value
 * @property {string} label
 * @property {number} nivel
 */

/**
 * @typedef {Object} Atribuicao
 * @property {string} value
 * @property {string} label
 */

/**
 * @typedef {Object} PrecoServico
 * @property {string} id
 * @property {string} nome
 * @property {number} preco
 * @property {number} [painel]
 */

/**
 * @callback SetState
 * @template T
 * @param {T | ((prev: T) => T)} value
 */

export {};
