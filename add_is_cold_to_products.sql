-- Adicionar campo is_cold (bebida gelada) na tabela products
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS is_cold boolean DEFAULT false;

-- Force schema cache reload
NOTIFY pgrst, 'reload config';

