-- Migração: Criar Tabela logs_excluidos_reds para registrar UUIDs deletados
-- Execute este script no SQL Editor do Supabase.

CREATE TABLE IF NOT EXISTS logs_excluidos_reds (
  uuid TEXT PRIMARY KEY,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);
