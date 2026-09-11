-- Migração: Criar tabelas tratadas exclusivas para a Reds
-- Execute este script no SQL Editor do Supabase para criar as tabelas.

-- 1. Tabela: log_ponto_reds
CREATE TABLE IF NOT EXISTS log_ponto_reds (
  uuid        TEXT PRIMARY KEY,           -- UUID do log original
  id          TEXT NOT NULL,              -- ID do jogador no jogo (ex: "3503")
  nome        TEXT NOT NULL,              -- Nome do personagem
  tipo        TEXT NOT NULL,              -- "entrada" ou "saida"
  data        DATE NOT NULL,              -- Data do registro
  hora        TIME NOT NULL,              -- Horário do registro
  timestampz  TIMESTAMPTZ NOT NULL,       -- Data e Hora completas com fuso horário
  criado_em   TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabela: log_bau_reds
CREATE TABLE IF NOT EXISTS log_bau_reds (
  uuid        TEXT PRIMARY KEY,
  id          TEXT NOT NULL,
  nome        TEXT NOT NULL,
  data        DATE NOT NULL,
  hora        TIME NOT NULL,
  timestampz  TIMESTAMPTZ NOT NULL,
  criado_em   TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabela: log_bancada_reds
CREATE TABLE IF NOT EXISTS log_bancada_reds (
  uuid        TEXT PRIMARY KEY,
  id          TEXT NOT NULL,
  nome        TEXT NOT NULL,
  data        DATE NOT NULL,
  hora        TIME NOT NULL,
  timestampz  TIMESTAMPTZ NOT NULL,
  criado_em   TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabela: pontos_reds
CREATE TABLE IF NOT EXISTS pontos_reds (
  uuid_entrada  TEXT PRIMARY KEY,                         -- UUID do evento de entrada
  uuid_saida    TEXT DEFAULT NULL,                        -- UUID do evento de saída
  entrada       TIMESTAMPTZ NOT NULL,                     -- Data/Hora de entrada
  saida         TIMESTAMPTZ DEFAULT NULL,                 -- Data/Hora de saída
  tempo         INTEGER DEFAULT 0,                        -- Tempo trabalhado em minutos
  id            TEXT NOT NULL,                            -- ID do jogador no jogo
  nome          TEXT NOT NULL,                            -- Nome do personagem
  criado_em     TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para otimizar buscas rápidas
CREATE INDEX IF NOT EXISTS idx_log_ponto_reds_id ON log_ponto_reds (id);
CREATE INDEX IF NOT EXISTS idx_log_ponto_reds_data ON log_ponto_reds (data);

CREATE INDEX IF NOT EXISTS idx_log_bau_reds_id ON log_bau_reds (id);
CREATE INDEX IF NOT EXISTS idx_log_bau_reds_data ON log_bau_reds (data);

CREATE INDEX IF NOT EXISTS idx_log_bancada_reds_id ON log_bancada_reds (id);
CREATE INDEX IF NOT EXISTS idx_log_bancada_reds_data ON log_bancada_reds (data);

CREATE INDEX IF NOT EXISTS idx_pontos_reds_id ON pontos_reds (id);
CREATE INDEX IF NOT EXISTS idx_pontos_reds_entrada ON pontos_reds (entrada);
