-- Migração: Adicionar flag de exclusão do relatório na tabela de usuários
-- Execute este SQL no SQL Editor do Supabase

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS excluir_relatorio BOOLEAN DEFAULT FALSE;

-- Verificar:
SELECT id, nome, excluir_relatorio FROM usuarios ORDER BY nome LIMIT 10;
