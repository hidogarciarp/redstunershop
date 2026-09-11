-- ==============================================================================
-- MIGRAÇÃO: TABELA DE AUDITORIA E HISTÓRICO DE SESSÕES DE PONTO (RED'S TUNERSHOP)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS sessoes_ponto_auditoria_reds (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  uuid_sessao TEXT UNIQUE,
  id_jogo TEXT NOT NULL,
  nome TEXT NOT NULL,
  oficina TEXT NOT NULL DEFAULT 'Red''s Tunershop',
  oficina_id TEXT NOT NULL DEFAULT 'reds',
  entrada TIMESTAMPTZ NOT NULL,
  saida TIMESTAMPTZ,
  duracao_min INTEGER DEFAULT 0,
  status_ponto TEXT NOT NULL DEFAULT 'normal', -- 'normal' | 'duplo_clique' | 'manual_crash' | 'auto_inatividade' | 'aberto'
  motivo_crash TEXT,
  justificativa TEXT,
  comprovante_img TEXT,
  fechado_por TEXT,
  total_tunagens INTEGER DEFAULT 0,
  valor_tunagens NUMERIC DEFAULT 0,
  total_bancada INTEGER DEFAULT 0,
  valor_bancada NUMERIC DEFAULT 0,
  total_bau INTEGER DEFAULT 0,
  infracao_30min BOOLEAN DEFAULT FALSE,
  detalhes_json JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessoes_ponto_reds_id_jogo ON sessoes_ponto_auditoria_reds(id_jogo);
CREATE INDEX IF NOT EXISTS idx_sessoes_ponto_reds_entrada ON sessoes_ponto_auditoria_reds(entrada);
CREATE INDEX IF NOT EXISTS idx_sessoes_ponto_reds_status ON sessoes_ponto_auditoria_reds(status_ponto);
CREATE INDEX IF NOT EXISTS idx_sessoes_ponto_reds_infracao ON sessoes_ponto_auditoria_reds(infracao_30min);

-- Habilitar RLS e criar políticas de leitura e escrita públicas/autenticadas
ALTER TABLE sessoes_ponto_auditoria_reds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leitura pública de sessões auditoria reds" ON sessoes_ponto_auditoria_reds
  FOR SELECT USING (true);

CREATE POLICY "Inserção pública/autenticada de sessões auditoria reds" ON sessoes_ponto_auditoria_reds
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Atualização pública/autenticada de sessões auditoria reds" ON sessoes_ponto_auditoria_reds
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Exclusão pública/autenticada de sessões auditoria reds" ON sessoes_ponto_auditoria_reds
  FOR DELETE USING (true);
