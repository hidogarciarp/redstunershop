-- Migração: Substituir excluir_relatorio por status
-- Execute este SQL no SQL Editor do Supabase

-- Adicionar o campo de status (pode ser "ativo", "inativo", "outros")
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'ativo';

-- (Opcional) Atualizar registros existentes, removendo excluir_relatorio
-- Se excluir_relatorio era true, talvez eles devessem ser 'outros' ou 'inativo'
UPDATE usuarios SET status = 'outros' WHERE excluir_relatorio IS TRUE;

ALTER TABLE usuarios
  DROP COLUMN IF EXISTS excluir_relatorio;

-- Verificar:
SELECT id, nome, status FROM usuarios ORDER BY nome LIMIT 10;
