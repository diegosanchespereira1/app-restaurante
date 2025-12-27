-- Script para atualizar foreign keys para usar products ao invés de menu_items e inventory_items
-- IMPORTANTE: Execute create_products_table.sql e migrate_menu_and_inventory_to_products.sql primeiro!

-- ============================================================
-- 1. Atualizar order_items: menu_item_id -> product_id
-- ============================================================

-- Adicionar nova coluna product_id
ALTER TABLE public.order_items 
ADD COLUMN IF NOT EXISTS product_id integer;

-- Migrar dados: menu_item_id já aponta para products (IDs preservados)
-- Mas só atualizar se o product_id existe na tabela products
UPDATE public.order_items oi
SET product_id = oi.menu_item_id
WHERE oi.menu_item_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.products p WHERE p.id = oi.menu_item_id);

-- Limpar product_id para itens que não têm correspondência em products
UPDATE public.order_items
SET product_id = NULL
WHERE product_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.products p WHERE p.id = order_items.product_id);

-- Remover NOT NULL constraint se existir (já deve permitir NULL de acordo com fix_order_items_menu_item_id_nullable.sql)
ALTER TABLE public.order_items 
ALTER COLUMN product_id DROP NOT NULL;

-- Criar foreign key para products
ALTER TABLE public.order_items
DROP CONSTRAINT IF EXISTS order_items_product_id_fkey;

ALTER TABLE public.order_items
ADD CONSTRAINT order_items_product_id_fkey
FOREIGN KEY (product_id)
REFERENCES public.products(id)
ON UPDATE CASCADE
ON DELETE SET NULL;

-- Criar índice
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON public.order_items(product_id);

-- Manter menu_item_id por enquanto para backward compatibility (será removido depois)

-- ============================================================
-- 2. Atualizar invoice_items: inventory_item_id -> product_id
-- ============================================================

-- Adicionar nova coluna product_id
ALTER TABLE public.invoice_items
ADD COLUMN IF NOT EXISTS product_id integer;

-- Migrar dados: precisa mapear inventory_item_id para product_id
-- Se inventory_item tem menu_item_id, usar o ID do product (que é o mesmo menu_item_id)
-- Se não tem, precisa buscar no mapeamento ou criar um mapeamento baseado no nome

-- Primeiro, atualizar para inventory_items que têm menu_item_id
UPDATE public.invoice_items ii
SET product_id = i.menu_item_id
FROM public.inventory_items i
WHERE ii.inventory_item_id = i.id 
  AND i.menu_item_id IS NOT NULL;

-- Para inventory_items sem menu_item_id, vamos tentar fazer match por nome
-- (Esta é uma aproximação - em produção, seria melhor ter uma tabela de mapeamento)
UPDATE public.invoice_items ii
SET product_id = p.id
FROM public.inventory_items i
JOIN public.products p ON p.name = i.name
WHERE ii.inventory_item_id = i.id 
  AND i.menu_item_id IS NULL
  AND ii.product_id IS NULL
  AND NOT EXISTS (
    -- Garantir que não estamos duplicando (pegar o primeiro match)
    SELECT 1 FROM public.products p2 
    WHERE p2.name = i.name AND p2.id < p.id
  );

-- Remover NOT NULL constraint
ALTER TABLE public.invoice_items
ALTER COLUMN product_id DROP NOT NULL;

-- Criar foreign key para products
ALTER TABLE public.invoice_items
DROP CONSTRAINT IF EXISTS invoice_items_product_id_fkey;

ALTER TABLE public.invoice_items
ADD CONSTRAINT invoice_items_product_id_fkey
FOREIGN KEY (product_id)
REFERENCES public.products(id)
ON UPDATE CASCADE
ON DELETE SET NULL;

-- Criar índice
CREATE INDEX IF NOT EXISTS idx_invoice_items_product_id ON public.invoice_items(product_id);

-- Manter inventory_item_id por enquanto para backward compatibility (será removido depois)

-- ============================================================
-- 3. Atualizar stock_movements: inventory_item_id -> product_id
-- ============================================================

-- Adicionar nova coluna product_id
ALTER TABLE public.stock_movements
ADD COLUMN IF NOT EXISTS product_id integer;

-- Migrar dados: precisa mapear inventory_item_id para product_id
-- Se inventory_item tem menu_item_id, usar o ID do product (que é o mesmo menu_item_id)
UPDATE public.stock_movements sm
SET product_id = i.menu_item_id
FROM public.inventory_items i
WHERE sm.inventory_item_id = i.id 
  AND i.menu_item_id IS NOT NULL;

-- Para inventory_items sem menu_item_id, fazer match por nome
UPDATE public.stock_movements sm
SET product_id = p.id
FROM public.inventory_items i
JOIN public.products p ON p.name = i.name
WHERE sm.inventory_item_id = i.id 
  AND i.menu_item_id IS NULL
  AND sm.product_id IS NULL
  AND NOT EXISTS (
    -- Garantir que não estamos duplicando (pegar o primeiro match)
    SELECT 1 FROM public.products p2 
    WHERE p2.name = i.name AND p2.id < p.id
  );

-- Remover NOT NULL constraint (pode ser NULL em alguns casos)
ALTER TABLE public.stock_movements
ALTER COLUMN product_id DROP NOT NULL;

-- Criar foreign key para products
ALTER TABLE public.stock_movements
DROP CONSTRAINT IF EXISTS stock_movements_product_id_fkey;

ALTER TABLE public.stock_movements
ADD CONSTRAINT stock_movements_product_id_fkey
FOREIGN KEY (product_id)
REFERENCES public.products(id)
ON UPDATE CASCADE
ON DELETE CASCADE;

-- Criar índice
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON public.stock_movements(product_id);

-- Manter inventory_item_id por enquanto para backward compatibility (será removido depois)

-- ============================================================
-- 4. Atualizar função update_stock_on_movement para usar products
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_stock_on_movement()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.movement_type = 'entry' THEN
    UPDATE public.products
    SET current_stock = current_stock + NEW.quantity
    WHERE id = NEW.product_id;
  ELSIF NEW.movement_type = 'exit' THEN
    UPDATE public.products
    SET current_stock = current_stock - NEW.quantity
    WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- O trigger já existe, apenas a função foi atualizada

-- Force schema cache reload
NOTIFY pgrst, 'reload config';

