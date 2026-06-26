-- Migração: Criar tabelas ponto_cidade_mecanica_2 e ponto_cidade_mecanica_3 para as outras mecânicas
-- Execute este SQL diretamente no SQL Editor do Supabase

CREATE TABLE IF NOT EXISTS ponto_cidade_mecanica_2 (
  id            BIGSERIAL PRIMARY KEY,
  usuario_id    BIGINT DEFAULT NULL,
  nome          TEXT NOT NULL,
  nome_personagem TEXT NOT NULL,
  id_jogo       TEXT NOT NULL,
  entrada       TIMESTAMPTZ,
  saida         TIMESTAMPTZ DEFAULT NULL,
  data          DATE NOT NULL,
  uuid_entrada  TEXT UNIQUE DEFAULT NULL,
  uuid_saida    TEXT DEFAULT NULL,
  importado_por BIGINT DEFAULT NULL,
  importado_em  TIMESTAMPTZ DEFAULT NOW(),
  observacao    TEXT DEFAULT NULL,
  oculto        BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS ponto_cidade_mecanica_3 (
  id            BIGSERIAL PRIMARY KEY,
  usuario_id    BIGINT DEFAULT NULL,
  nome          TEXT NOT NULL,
  nome_personagem TEXT NOT NULL,
  id_jogo       TEXT NOT NULL,
  entrada       TIMESTAMPTZ,
  saida         TIMESTAMPTZ DEFAULT NULL,
  data          DATE NOT NULL,
  uuid_entrada  TEXT UNIQUE DEFAULT NULL,
  uuid_saida    TEXT DEFAULT NULL,
  importado_por BIGINT DEFAULT NULL,
  importado_em  TIMESTAMPTZ DEFAULT NOW(),
  observacao    TEXT DEFAULT NULL,
  oculto        BOOLEAN DEFAULT FALSE
);

-- Índices para otimização
CREATE INDEX IF NOT EXISTS idx_ponto_cidade_m2_id_jogo ON ponto_cidade_mecanica_2 (id_jogo);
CREATE INDEX IF NOT EXISTS idx_ponto_cidade_m2_data ON ponto_cidade_mecanica_2 (data);

CREATE INDEX IF NOT EXISTS idx_ponto_cidade_m3_id_jogo ON ponto_cidade_mecanica_3 (id_jogo);
CREATE INDEX IF NOT EXISTS idx_ponto_cidade_m3_data ON ponto_cidade_mecanica_3 (data);
