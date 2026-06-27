-- ===== TABELA: relatorios_compartilhados =====
CREATE TABLE IF NOT EXISTS relatorios_compartilhados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL, -- 'comparativo_mecanicas'
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  excluir_manuais BOOLEAN DEFAULT true,
  criado_por TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);
