-- ==============================================================================
-- MIGRAÇÃO: RECRIAR pc_2, pc_3 E CRIAR pc_4 (SISTEMA UNIFICADO DE PAREAMENTO)
-- ==============================================================================

-- 1. TABELA pc_2 (Harmony Custom)
DROP TABLE IF EXISTS pc_2 CASCADE;
CREATE TABLE pc_2 (
  id BIGSERIAL PRIMARY KEY,
  usuario_id INTEGER,
  nome VARCHAR(255),
  data DATE NOT NULL,
  entrada TIMESTAMPTZ NOT NULL,
  uuid_entrada TEXT NOT NULL,
  saida TIMESTAMPTZ NOT NULL,
  uuid_saida TEXT NOT NULL,
  tipo_fechamento VARCHAR(50) NOT NULL,
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
CREATE INDEX idx_pc_2_usuario_id ON pc_2(usuario_id);
CREATE INDEX idx_pc_2_data ON pc_2(data);
CREATE INDEX idx_pc_2_entrada ON pc_2(entrada);
CREATE INDEX idx_pc_2_uuid_entrada ON pc_2(uuid_entrada);
CREATE INDEX idx_pc_2_tipo_fechamento ON pc_2(tipo_fechamento);
ALTER TABLE pc_2 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir leitura pública pc_2" ON pc_2 FOR SELECT USING (true);
CREATE POLICY "Permitir gerenciamento total pc_2" ON pc_2 FOR ALL USING (true) WITH CHECK (true);

-- 2. TABELA pc_3 (Dudark Motors)
DROP TABLE IF EXISTS pc_3 CASCADE;
CREATE TABLE pc_3 (
  id BIGSERIAL PRIMARY KEY,
  usuario_id INTEGER,
  nome VARCHAR(255),
  data DATE NOT NULL,
  entrada TIMESTAMPTZ NOT NULL,
  uuid_entrada TEXT NOT NULL,
  saida TIMESTAMPTZ NOT NULL,
  uuid_saida TEXT NOT NULL,
  tipo_fechamento VARCHAR(50) NOT NULL,
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
CREATE INDEX idx_pc_3_usuario_id ON pc_3(usuario_id);
CREATE INDEX idx_pc_3_data ON pc_3(data);
CREATE INDEX idx_pc_3_entrada ON pc_3(entrada);
CREATE INDEX idx_pc_3_uuid_entrada ON pc_3(uuid_entrada);
CREATE INDEX idx_pc_3_tipo_fechamento ON pc_3(tipo_fechamento);
ALTER TABLE pc_3 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir leitura pública pc_3" ON pc_3 FOR SELECT USING (true);
CREATE POLICY "Permitir gerenciamento total pc_3" ON pc_3 FOR ALL USING (true) WITH CHECK (true);

-- 3. TABELA pc_4 (Vespucci Tunershop / Beach)
DROP TABLE IF EXISTS pc_4 CASCADE;
CREATE TABLE pc_4 (
  id BIGSERIAL PRIMARY KEY,
  usuario_id INTEGER,
  nome VARCHAR(255),
  data DATE NOT NULL,
  entrada TIMESTAMPTZ NOT NULL,
  uuid_entrada TEXT NOT NULL,
  saida TIMESTAMPTZ NOT NULL,
  uuid_saida TEXT NOT NULL,
  tipo_fechamento VARCHAR(50) NOT NULL,
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
CREATE INDEX idx_pc_4_usuario_id ON pc_4(usuario_id);
CREATE INDEX idx_pc_4_data ON pc_4(data);
CREATE INDEX idx_pc_4_entrada ON pc_4(entrada);
CREATE INDEX idx_pc_4_uuid_entrada ON pc_4(uuid_entrada);
CREATE INDEX idx_pc_4_tipo_fechamento ON pc_4(tipo_fechamento);
ALTER TABLE pc_4 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir leitura pública pc_4" ON pc_4 FOR SELECT USING (true);
CREATE POLICY "Permitir gerenciamento total pc_4" ON pc_4 FOR ALL USING (true) WITH CHECK (true);
