-- Adicionar campo is_cold (bebida gelada) na tabela products
-- Este campo indica se o produto é uma bebida gelada (mostra ícone de floco de neve)
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS is_cold boolean DEFAULT NULL;

-- Adicionar comentário para documentação
COMMENT ON COLUMN public.products.is_cold IS 'Indica se o produto é uma bebida gelada (mostra ícone de floco de neve)';

-- Force schema cache reload
NOTIFY pgrst, 'reload config';

