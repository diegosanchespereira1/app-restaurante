-- Adiciona campo de imagem na tabela inventory_items
-- Execute este script para adicionar o campo image

-- Adicionar coluna image se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'inventory_items' 
        AND column_name = 'image'
    ) THEN
        ALTER TABLE public.inventory_items ADD COLUMN image text;
    END IF;
END $$;

-- Atualizar itens existentes sem imagem para usar a imagem padrão
UPDATE public.inventory_items
SET image = 'materialApoio/imagem-nao-disponivel.gif'
WHERE image IS NULL OR image = '';

-- Comentário na coluna
COMMENT ON COLUMN public.inventory_items.image IS 'URL ou caminho da imagem do produto';

-- Force schema cache reload
NOTIFY pgrst, 'reload config';





