-- migração para criação da tabela de vendas/compras de drift pela cidade

CREATE TABLE IF NOT EXISTS vendas_drift_cidade (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  id_jogo INT NOT NULL,
  nome_personagem VARCHAR(255) NOT NULL,
  item_key VARCHAR(50) NOT NULL,    -- 'drift' ou 'remdrift'
  item_name VARCHAR(255) NOT NULL,   -- 'Kit Drift' ou 'Removedor de Drift'
  quantidade INT NOT NULL DEFAULT 1,
  preco VARCHAR(50),                 -- ex: '15.000'
  data_compra TIMESTAMPTZ NOT NULL,
  uuid_log VARCHAR(255) UNIQUE NOT NULL,
  link_venda TEXT DEFAULT NULL,
  link_bancada TEXT DEFAULT NULL,    -- log da bancada
  acao VARCHAR(50) DEFAULT 'buy',
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  importado_por BIGINT REFERENCES usuarios(id) ON DELETE SET NULL
);

-- Índices de busca rápida
CREATE INDEX IF NOT EXISTS vendas_drift_id_jogo_idx ON vendas_drift_cidade(id_jogo);
CREATE INDEX IF NOT EXISTS vendas_drift_data_compra_idx ON vendas_drift_cidade(data_compra DESC);
