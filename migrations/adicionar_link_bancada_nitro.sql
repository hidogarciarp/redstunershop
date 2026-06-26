-- migração para adicionar a coluna link_bancada na tabela de nitro

ALTER TABLE vendas_nitro_cidade ADD COLUMN IF NOT EXISTS link_bancada TEXT DEFAULT NULL;
