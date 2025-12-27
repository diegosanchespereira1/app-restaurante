-- Fix: Adiciona coluna image na tabela inventory_items se não existir
-- e força atualização do cache do schema

-- Adicionar coluna image se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'inventory_items' 
        AND column_name = 'image'
    ) THEN
        ALTER TABLE public.inventory_items 
        ADD COLUMN image text DEFAULT 'materialApoio/imagem-nao-disponivel.gif';
        
        -- Atualizar itens existentes sem imagem
        UPDATE public.inventory_items
        SET image = 'materialApoio/imagem-nao-disponivel.gif'
        WHERE image IS NULL OR image = '';
    END IF;
END $$;

-- Garantir que a coluna não seja NULL
ALTER TABLE public.inventory_items 
ALTER COLUMN image SET DEFAULT 'materialApoio/imagem-nao-disponivel.gif';

-- Comentário na coluna
COMMENT ON COLUMN public.inventory_items.image IS 'URL ou caminho da imagem do produto';

-- Force schema cache reload do PostgREST (usado pelo Supabase)
NOTIFY pgrst, 'reload config';

-- Também tentar forçar reload via função (se disponível)
DO $$
BEGIN
    PERFORM pg_notify('pgrst', 'reload config');
EXCEPTION
    WHEN OTHERS THEN
        -- Ignora se não funcionar
        NULL;
END $$;

