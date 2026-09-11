-- Execute no SQL Editor do Supabase para habilitar o salvamento de fotos, status e comprovantes de tunagem

ALTER TABLE public.logs_tunagem
  ADD COLUMN IF NOT EXISTS foto_url TEXT,
  ADD COLUMN IF NOT EXISTS cobrado BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS valor_cobrado NUMERIC DEFAULT 0;

-- Criar índice para busca rápida de tunagens pendentes / cobradas
CREATE INDEX IF NOT EXISTS idx_logs_tunagem_cobrado ON public.logs_tunagem (cobrado);
CREATE INDEX IF NOT EXISTS idx_logs_tunagem_status ON public.logs_tunagem (status);
