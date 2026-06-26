-- Migração: Adicionar suporte a ocultamento de registros em ponto_cidade
-- Execute este SQL no SQL Editor do Supabase

ALTER TABLE ponto_cidade
  ADD COLUMN IF NOT EXISTS oculto                   BOOLEAN   DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS justificativa_ocultamento TEXT      DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS oculto_em                TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS oculto_por               BIGINT    DEFAULT NULL;

-- Índice para filtrar ocultos rapidamente
CREATE INDEX IF NOT EXISTS idx_ponto_cidade_oculto ON ponto_cidade (oculto);

-- Verificar:
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'ponto_cidade'
  AND column_name IN ('oculto', 'justificativa_ocultamento', 'oculto_em', 'oculto_por');
