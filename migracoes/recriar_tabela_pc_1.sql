-- ==============================================================================
-- MIGRAÇÃO: RECRIAR TABELA pc_1 (NOVO SISTEMA DE PAREAMENTO INTELIGENTE - RED'S)
-- ==============================================================================

-- 1. Caso queira preservar os dados antigos como backup:
-- CREATE TABLE IF NOT EXISTS pc_1_backup AS SELECT * FROM pc_1;

-- 2. Recriar a tabela pc_1 com a nova estrutura completa
DROP TABLE IF EXISTS pc_1 CASCADE;

CREATE TABLE pc_1 (
  id BIGSERIAL PRIMARY KEY,
  usuario_id INTEGER,
  nome VARCHAR(255),
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
  tipo_ultima_atividade VARCHAR(50), -- 'TUNAGEM', 'BANCADA' ou NULL
  detalhe_ultima_atividade TEXT,
  observacao TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Índices para performance em buscas e relatórios
CREATE INDEX idx_pc_1_usuario_id ON pc_1(usuario_id);
CREATE INDEX idx_pc_1_data ON pc_1(data);
CREATE INDEX idx_pc_1_entrada ON pc_1(entrada);
CREATE INDEX idx_pc_1_uuid_entrada ON pc_1(uuid_entrada);
CREATE INDEX idx_pc_1_tipo_fechamento ON pc_1(tipo_fechamento);

-- 4. Habilitar RLS (Row Level Security) e políticas de acesso
ALTER TABLE pc_1 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir leitura pública pc_1" ON pc_1
  FOR SELECT USING (true);

CREATE POLICY "Permitir gerenciamento total pc_1" ON pc_1
  FOR ALL USING (true) WITH CHECK (true);
