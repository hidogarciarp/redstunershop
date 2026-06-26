-- Migração: Adicionar colunas para suporte à importação de logs de ponto
-- Execute este SQL diretamente no SQL Editor do Supabase

-- Adiciona campos de UUID para deduplicação e rastreio de importação
ALTER TABLE ponto_horas
  ADD COLUMN IF NOT EXISTS uuid_entrada TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS uuid_saida TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS importado_por BIGINT DEFAULT NULL;

-- Índice único para evitar duplicatas de UUID (opcional mas recomendado)
CREATE UNIQUE INDEX IF NOT EXISTS ponto_horas_uuid_entrada_unique
  ON ponto_horas (uuid_entrada)
  WHERE uuid_entrada IS NOT NULL;

-- Verificar se as colunas foram criadas com sucesso:
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'ponto_horas'
  AND column_name IN ('uuid_entrada', 'uuid_saida', 'importado_por');
