-- Fix: Ajusta foreign key constraint para permitir updates em menu_items
-- mesmo quando há order_items referenciando

-- Primeiro, vamos verificar se a constraint existe e qual é o nome exato
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
        
        -- Recriar com ON UPDATE CASCADE para permitir updates
        -- e ON DELETE SET NULL para permitir deletar (os pedidos mantêm o nome do item)
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

