-- ==============================================================================
-- MIGRAÇÃO: TABELAS CENTRALIZADAS DA CIDADE (PADRÃO OURO ARQUITETURAL)
-- ==============================================================================
-- Tabelas novas isoladas para operar em paralelo sem afetar a produção atual:
-- 1. log_ponto
-- 2. log_tunagem
-- 3. log_bancada
-- 4. log_bau
-- ==============================================================================

-- 1. TABELA log_ponto (Sessões inteligentes de ponto de todas as mecânicas)
DROP TABLE IF EXISTS log_ponto CASCADE;
CREATE TABLE log_ponto (
  id BIGSERIAL PRIMARY KEY,
  mecanica_id VARCHAR(50) NOT NULL, -- 'reds', 'harmony', 'dudark', 'vespucci'
  usuario_id INTEGER NOT NULL,
  nome VARCHAR(255) NOT NULL,
  data DATE NOT NULL,
  entrada TIMESTAMPTZ NOT NULL,
  uuid_entrada TEXT NOT NULL,
  saida TIMESTAMPTZ NOT NULL,
  uuid_saida TEXT NOT NULL,
  tipo_fechamento VARCHAR(50) NOT NULL, -- 'NORMAL', 'CRASH_COM_ATIVIDADE', 'CRASH_SEM_ATIVIDADE', 'REINICIO_09H', 'DUPLO_CLIQUE_CANCELADO'
  total_minutos INTEGER NOT NULL DEFAULT 0,
  total_segundos INTEGER NOT NULL DEFAULT 0,
  qtd_tunagens INTEGER NOT NULL DEFAULT 0,
  qtd_bancada INTEGER NOT NULL DEFAULT 0,
  total_atividades INTEGER NOT NULL DEFAULT 0,
  ultima_atividade_em TIMESTAMPTZ,
  tipo_ultima_atividade VARCHAR(50),
  detalhe_ultima_atividade TEXT,
  observacao TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_log_ponto_mecanica ON log_ponto(mecanica_id);
CREATE INDEX idx_log_ponto_usuario ON log_ponto(usuario_id);
CREATE INDEX idx_log_ponto_data ON log_ponto(data);
CREATE INDEX idx_log_ponto_entrada ON log_ponto(entrada);
CREATE INDEX idx_log_ponto_tipo ON log_ponto(tipo_fechamento);

ALTER TABLE log_ponto ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir leitura pública log_ponto" ON log_ponto FOR SELECT USING (true);
CREATE POLICY "Permitir gerenciamento total log_ponto" ON log_ponto FOR ALL USING (true) WITH CHECK (true);


-- 2. TABELA log_tunagem (Modificações de veículos de todas as mecânicas)
DROP TABLE IF EXISTS log_tunagem CASCADE;
CREATE TABLE log_tunagem (
  uuid TEXT PRIMARY KEY,
  mecanica_id VARCHAR(50) NOT NULL, -- 'reds', 'harmony', 'dudark', 'vespucci'
  tecnico_id TEXT NOT NULL,
  tecnico_nome TEXT NOT NULL,
  dono_id TEXT,
  dono_nome TEXT,
  veiculo_nome TEXT,
  veiculo_modelo TEXT,
  placa TEXT,
  valor_pago NUMERIC NOT NULL DEFAULT 0,
  antes_json JSONB,
  depois_json JSONB,
  data DATE NOT NULL,
  hora TIME NOT NULL,
  timestampz TIMESTAMPTZ NOT NULL,
  baia_nome TEXT,
  oficina_nome TEXT,
  foto_url TEXT,
  cobrado BOOLEAN DEFAULT FALSE,
  discord_message_id TEXT,
  discord_channel_id TEXT,
  raw_text TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_log_tunagem_mecanica ON log_tunagem(mecanica_id);
CREATE INDEX idx_log_tunagem_tecnico ON log_tunagem(tecnico_id);
CREATE INDEX idx_log_tunagem_data ON log_tunagem(data);
CREATE INDEX idx_log_tunagem_timestampz ON log_tunagem(timestampz);
CREATE INDEX idx_log_tunagem_placa ON log_tunagem(placa);

ALTER TABLE log_tunagem ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir leitura pública log_tunagem" ON log_tunagem FOR SELECT USING (true);
CREATE POLICY "Permitir gerenciamento total log_tunagem" ON log_tunagem FOR ALL USING (true) WITH CHECK (true);


-- 3. TABELA log_bancada (Crafts e ferramentas de todas as mecânicas)
DROP TABLE IF EXISTS log_bancada CASCADE;
CREATE TABLE log_bancada (
  uuid TEXT PRIMARY KEY,
  mecanica_id VARCHAR(50) NOT NULL, -- 'reds', 'harmony', 'dudark', 'vespucci'
  usuario_id TEXT NOT NULL,
  usuario_nome TEXT NOT NULL,
  item_craftado TEXT,
  quantidade INTEGER DEFAULT 1,
  data DATE NOT NULL,
  hora TIME NOT NULL,
  timestampz TIMESTAMPTZ NOT NULL,
  discord_message_id TEXT,
  discord_channel_id TEXT,
  raw_text TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_log_bancada_mecanica ON log_bancada(mecanica_id);
CREATE INDEX idx_log_bancada_usuario ON log_bancada(usuario_id);
CREATE INDEX idx_log_bancada_data ON log_bancada(data);
CREATE INDEX idx_log_bancada_timestampz ON log_bancada(timestampz);

ALTER TABLE log_bancada ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir leitura pública log_bancada" ON log_bancada FOR SELECT USING (true);
CREATE POLICY "Permitir gerenciamento total log_bancada" ON log_bancada FOR ALL USING (true) WITH CHECK (true);


-- 4. TABELA log_bau (Movimentações de baú/estoque de todas as mecânicas)
DROP TABLE IF EXISTS log_bau CASCADE;
CREATE TABLE log_bau (
  uuid TEXT PRIMARY KEY,
  mecanica_id VARCHAR(50) NOT NULL, -- 'reds', 'harmony', 'dudark', 'vespucci'
  usuario_id TEXT NOT NULL,
  usuario_nome TEXT NOT NULL,
  acao TEXT NOT NULL, -- 'GUARDOU', 'RETIROU'
  item TEXT NOT NULL,
  quantidade INTEGER DEFAULT 1,
  data DATE NOT NULL,
  hora TIME NOT NULL,
  timestampz TIMESTAMPTZ NOT NULL,
  discord_message_id TEXT,
  discord_channel_id TEXT,
  raw_text TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_log_bau_mecanica ON log_bau(mecanica_id);
CREATE INDEX idx_log_bau_usuario ON log_bau(usuario_id);
CREATE INDEX idx_log_bau_data ON log_bau(data);
CREATE INDEX idx_log_bau_timestampz ON log_bau(timestampz);

ALTER TABLE log_bau ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir leitura pública log_bau" ON log_bau FOR SELECT USING (true);
CREATE POLICY "Permitir gerenciamento total log_bau" ON log_bau FOR ALL USING (true) WITH CHECK (true);
