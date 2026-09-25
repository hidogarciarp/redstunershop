-- ==============================================================================
-- SINCRONIZAÇÃO DAS SEQUÊNCIAS DE TODAS AS TABELAS COM CHAVE PRIMÁRIA NUMÉRICA
-- Execute este script no SQL Editor do seu Supabase (sxrfkbjbyjdmyyxbzobb):
-- https://supabase.com/dashboard/project/sxrfkbjbyjdmyyxbzobb/sql/new
-- ==============================================================================

-- 1. notificacoes
SELECT setval(pg_get_serial_sequence('notificacoes', 'id'), COALESCE(MAX(id), 1) + 1, false) FROM notificacoes;

-- 2. servicos
SELECT setval(pg_get_serial_sequence('servicos', 'id'), COALESCE(MAX(id), 1) + 1, false) FROM servicos;

-- 3. clientes
SELECT setval(pg_get_serial_sequence('clientes', 'id'), COALESCE(MAX(id), 1) + 1, false) FROM clientes;

-- 4. pagamentos_semanais
SELECT setval(pg_get_serial_sequence('pagamentos_semanais', 'id'), COALESCE(MAX(id), 1) + 1, false) FROM pagamentos_semanais;

-- 5. blacklist
SELECT setval(pg_get_serial_sequence('blacklist', 'id'), COALESCE(MAX(id), 1) + 1, false) FROM blacklist;

-- 6. configuracoes
SELECT setval(pg_get_serial_sequence('configuracoes', 'id'), COALESCE(MAX(id), 1) + 1, false) FROM configuracoes;

-- 7. curso_configuracoes
SELECT setval(pg_get_serial_sequence('curso_configuracoes', 'id'), COALESCE(MAX(id), 1) + 1, false) FROM curso_configuracoes;

-- 8. log_ponto
SELECT setval(pg_get_serial_sequence('log_ponto', 'id'), COALESCE(MAX(id), 1) + 1, false) FROM log_ponto;
