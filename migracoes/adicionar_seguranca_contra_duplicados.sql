-- ==========================================
-- SCRIPT DE SEGURANÇA CONTRA PONTOS DUPLICADOS
-- ==========================================
-- Como rodar:
-- 1. Acesse o painel do seu Supabase.
-- 2. Vá em "SQL Editor" -> "New Query".
-- 3. Cole este código e clique em "Run".
--
-- ATENÇÃO: Caso haja algum ponto duplicado ativo no banco de dados,
-- remova-o antes de aplicar este script, pois o Postgres não permite
-- criar regras de unicidade se já existirem dados repetidos.
-- ==========================================

-- 1. Adiciona regra de unicidade para a tabela principal (Reds)
ALTER TABLE ponto_cidade 
ADD CONSTRAINT unique_funcionario_entrada UNIQUE (id_jogo, entrada);

-- 2. Adiciona regra de unicidade para a tabela da Mecânica 2 (Harmony)
ALTER TABLE ponto_cidade_mecanica_2 
ADD CONSTRAINT unique_funcionario_entrada_m2 UNIQUE (id_jogo, entrada);

-- 3. Adiciona regra de unicidade para a tabela da Mecânica 3 (Dudark)
ALTER TABLE ponto_cidade_mecanica_3 
ADD CONSTRAINT unique_funcionario_entrada_m3 UNIQUE (id_jogo, entrada);
