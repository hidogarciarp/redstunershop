-- ===== TABELA: missoes =====
CREATE TABLE IF NOT EXISTS missoes (
  id SERIAL PRIMARY KEY,
  titulo TEXT NOT NULL,
  descricao TEXT,
  meta INTEGER NOT NULL DEFAULT 100,
  progresso INTEGER NOT NULL DEFAULT 0,
  pontos_recompensa INTEGER DEFAULT 150,
  data_expiracao TIMESTAMPTZ,
  ativa BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  criado_por INTEGER
);

-- ===== TABELA: missao_participacoes =====
CREATE TABLE IF NOT EXISTS missao_participacoes (
  id SERIAL PRIMARY KEY,
  missao_id INTEGER REFERENCES missoes(id) ON DELETE CASCADE,
  usuario_id INTEGER NOT NULL,
  nome_usuario TEXT,
  observacao TEXT,
  foto_base64 TEXT,
  aprovado BOOLEAN DEFAULT false,
  aprovado_por INTEGER,
  aprovado_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- ===== DADOS INICIAIS: Missão de Doação de Sangue =====
INSERT INTO missoes (titulo, descricao, meta, progresso, pontos_recompensa, data_expiracao, ativa)
VALUES (
  'Gilson do Sangue Bom',
  'Preciso que a equipe se organize para doar 100 bolsas de sangue. É pela cidade e eu quero todo mundo colaborando.',
  100,
  21,
  150,
  '2026-05-11 23:59:00-03:00',
  true
);
