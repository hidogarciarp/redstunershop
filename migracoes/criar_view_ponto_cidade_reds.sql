-- Migração: Criar View ponto_cidade_reds para unificar a leitura do Banco: Reds
-- Execute este script no SQL Editor do Supabase.

CREATE OR REPLACE VIEW ponto_cidade_reds AS
SELECT 
  (row_number() OVER ())::bigint AS id,
  (CASE WHEN id ~ '^[0-9]+$' THEN id::bigint ELSE NULL END) AS usuario_id,
  nome AS nome,
  nome AS nome_personagem,
  id AS id_jogo,
  entrada,
  saida,
  entrada::date AS data,
  uuid_entrada,
  uuid_saida,
  null::bigint AS importado_por,
  criado_em AS importado_em,
  null::text AS observacao,
  false::boolean AS oculto
FROM pontos_reds;
