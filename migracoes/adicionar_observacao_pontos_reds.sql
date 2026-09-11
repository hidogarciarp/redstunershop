-- Execute no SQL Editor do Supabase para persistir observacoes e metadados na tabela pontos_reds

ALTER TABLE public.pontos_reds
  ADD COLUMN IF NOT EXISTS observacao TEXT,
  ADD COLUMN IF NOT EXISTS data DATE,
  ADD COLUMN IF NOT EXISTS mechanic_id TEXT DEFAULT 'reds',
  ADD COLUMN IF NOT EXISTS oculto BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_pontos_reds_data ON public.pontos_reds (data);
CREATE INDEX IF NOT EXISTS idx_pontos_reds_id ON public.pontos_reds (id);
CREATE INDEX IF NOT EXISTS idx_pontos_reds_entrada ON public.pontos_reds (entrada);
