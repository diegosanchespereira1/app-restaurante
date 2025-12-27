-- Fix: Permite NULL em menu_item_id para permitir itens de estoque sem vínculo ao menu
-- Isso é necessário porque itens de estoque podem ser vendidos sem estar vinculados a itens do menu

-- Primeiro, verificar se a coluna já permite NULL
DO $$
BEGIN
    -- Se a coluna não permite NULL, alterar para permitir
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'order_items' 
        AND column_name = 'menu_item_id'
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE public.order_items 
        ALTER COLUMN menu_item_id DROP NOT NULL;
        
        RAISE NOTICE 'Coluna menu_item_id agora permite NULL';
    ELSE
        RAISE NOTICE 'Coluna menu_item_id já permite NULL';
    END IF;
END $$;

-- Verificar e atualizar a foreign key constraint se necessário
DO $$
DECLARE
    constraint_name text;
BEGIN
    -- Encontrar o nome da constraint
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'order_items'::regclass
    AND confrelid = 'menu_items'::regclass
    AND contype = 'f';
    
    IF constraint_name IS NOT NULL THEN
        -- Dropar a constraint antiga
        EXECUTE format('ALTER TABLE order_items DROP CONSTRAINT IF EXISTS %I', constraint_name);
        
        -- Recriar com ON UPDATE CASCADE e ON DELETE SET NULL
        -- Isso permite que menu_item_id seja NULL para itens de estoque sem vínculo
        ALTER TABLE order_items
        ADD CONSTRAINT order_items_menu_item_id_fkey
        FOREIGN KEY (menu_item_id)
        REFERENCES menu_items(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL;
        
        RAISE NOTICE 'Constraint atualizada: %', constraint_name;
    ELSE
        RAISE NOTICE 'Constraint não encontrada, criando nova...';
        -- Se não existir, criar nova
        ALTER TABLE order_items
        ADD CONSTRAINT order_items_menu_item_id_fkey
        FOREIGN KEY (menu_item_id)
        REFERENCES menu_items(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL;
    END IF;
END $$;

-- Force schema cache reload do PostgREST (usado pelo Supabase)
NOTIFY pgrst, 'reload config';

