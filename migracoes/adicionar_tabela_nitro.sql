-- migração para criação da tabela de vendas/compras de nitro pela cidade

CREATE TABLE IF NOT EXISTS vendas_nitro_cidade (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  id_jogo INT NOT NULL,
  nome_personagem VARCHAR(255) NOT NULL,
  quantidade INT NOT NULL DEFAULT 1,
  preco VARCHAR(50),  -- guardando como texto para não perder '15.000' formato se precisar, ou NUMERIC
  data_compra TIMESTAMPTZ NOT NULL,
  uuid_log VARCHAR(255) UNIQUE NOT NULL,
  link_venda TEXT DEFAULT NULL,
  acao VARCHAR(50) DEFAULT 'buy',
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  importado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL
);

-- Indicar que o id_jogo pode ser rápido para buscar
CREATE INDEX IF NOT EXISTS vendas_nitro_id_jogo_idx ON vendas_nitro_cidade(id_jogo);
-- Ordenação padrão (compras recentes)
CREATE INDEX IF NOT EXISTS vendas_nitro_data_compra_idx ON vendas_nitro_cidade(data_compra DESC);
