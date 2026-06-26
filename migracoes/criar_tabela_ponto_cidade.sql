-- Migração: Criar tabela ponto_cidade para registros importados dos logs da cidade
-- Execute este SQL diretamente no SQL Editor do Supabase
-- Esta tabela é INDEPENDENTE da ponto_horas (declarações dos funcionários)

CREATE TABLE IF NOT EXISTS ponto_cidade (
  id            BIGSERIAL PRIMARY KEY,
  usuario_id    BIGINT DEFAULT NULL,         -- ID do usuário no banco (se encontrado)
  nome          TEXT NOT NULL,               -- Nome usado no banco (ou nome do personagem)
  nome_personagem TEXT NOT NULL,             -- Nome exato do personagem no jogo
  id_jogo       TEXT NOT NULL,               -- ID do personagem no jogo (ex: "3503")
  entrada       TIMESTAMPTZ NOT NULL,        -- Timestamp de entrada em serviço
  saida         TIMESTAMPTZ DEFAULT NULL,   -- Timestamp de saída (null = ponto aberto/sem saída)
  data          DATE NOT NULL,              -- Data da entrada (para facilitar filtros)
  uuid_entrada  TEXT UNIQUE DEFAULT NULL,  -- UUID do evento de entrada (deduplicação)
  uuid_saida    TEXT DEFAULT NULL,          -- UUID do evento de saída
  importado_por BIGINT DEFAULT NULL,        -- ID do admin que importou
  importado_em  TIMESTAMPTZ DEFAULT NOW(),  -- Quando foi importado
  observacao    TEXT DEFAULT NULL           -- Campo livre para anotações
);

-- Índice para busca por funcionário e data
CREATE INDEX IF NOT EXISTS idx_ponto_cidade_id_jogo ON ponto_cidade (id_jogo);
CREATE INDEX IF NOT EXISTS idx_ponto_cidade_data ON ponto_cidade (data);
CREATE INDEX IF NOT EXISTS idx_ponto_cidade_usuario_id ON ponto_cidade (usuario_id);

-- Verificar se a tabela foi criada:
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'ponto_cidade'
ORDER BY ordinal_position;
