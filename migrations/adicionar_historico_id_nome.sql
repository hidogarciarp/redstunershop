-- Execute este comando no SQL Editor do Supabase para adicionar as colunas de histórico
ALTER TABLE usuarios ADD COLUMN ids_antigos TEXT DEFAULT '';
ALTER TABLE usuarios ADD COLUMN nomes_antigos TEXT DEFAULT '';
