-- Script de migração para mover dados de menu_items e inventory_items para products
-- IMPORTANTE: Execute create_products_table.sql primeiro!
-- ATENÇÃO: Este script assume que você já executou create_products_table.sql

-- Passo 1: Migrar todos os menu_items para products (preservando IDs)
INSERT INTO public.products (
  id,
  name,
  price,
  description,
  category,
  status,
  image
)
SELECT 
  id,
  name,
  price,
  description,
  category,
  COALESCE(status, 'Available'),
  image
FROM public.menu_items
ON CONFLICT (id) DO NOTHING;

-- Ajustar sequência para evitar conflitos
DO $$
DECLARE
  max_menu_id integer;
BEGIN
  SELECT COALESCE(MAX(id), 0) INTO max_menu_id FROM public.menu_items;
  IF max_menu_id > 0 THEN
    PERFORM setval('products_id_seq', GREATEST(max_menu_id, (SELECT COALESCE(MAX(id), 0) FROM public.products)) + 1);
  END IF;
END $$;

-- Passo 2: Atualizar products com dados de inventory_items que têm menu_item_id
-- Isso consolida produtos que estavam vinculados
UPDATE public.products p
SET
  unit = COALESCE(i.unit, p.unit, 'UN'),
  min_stock = COALESCE(i.min_stock, p.min_stock, 0),
  current_stock = COALESCE(i.current_stock, p.current_stock, 0),
  cost_price = COALESCE(i.cost_price, p.cost_price),
  price = COALESCE(p.price, i.selling_price),
  -- Campos fiscais (só atualiza se não existir no product)
  product_type = COALESCE(p.product_type, i.product_type),
  ncm = COALESCE(p.ncm, i.ncm),
  cst_icms = COALESCE(p.cst_icms, i.cst_icms),
  cfop = COALESCE(p.cfop, i.cfop),
  icms_rate = COALESCE(p.icms_rate, i.icms_rate),
  ipi_rate = COALESCE(p.ipi_rate, i.ipi_rate),
  ean_code = COALESCE(p.ean_code, i.ean_code),
  -- Se inventory tem image e product não tem, usar image do inventory
  image = COALESCE(p.image, i.image),
  -- Se inventory tem category e product não tem, usar category do inventory
  category = COALESCE(p.category, i.category),
  updated_at = now()
FROM public.inventory_items i
WHERE i.menu_item_id = p.id;

-- Passo 3: Criar products para inventory_items que NÃO têm menu_item_id
-- Esses são produtos de estoque que não estavam no menu
INSERT INTO public.products (
  name,
  unit,
  min_stock,
  current_stock,
  cost_price,
  price,
  category,
  image,
  product_type,
  ncm,
  cst_icms,
  cfop,
  icms_rate,
  ipi_rate,
  ean_code
)
SELECT 
  i.name,
  COALESCE(i.unit, 'UN'),
  COALESCE(i.min_stock, 0),
  COALESCE(i.current_stock, 0),
  i.cost_price,
  i.selling_price as price,
  i.category,
  COALESCE(i.image, 'materialApoio/imagem-nao-disponivel.gif'),
  i.product_type,
  i.ncm,
  i.cst_icms,
  i.cfop,
  i.icms_rate,
  i.ipi_rate,
  i.ean_code
FROM public.inventory_items i
WHERE i.menu_item_id IS NULL;

-- Nota: O mapeamento de inventory_items sem menu_item_id para products será feito
-- no script update_foreign_keys_to_products.sql usando match por nome.
-- Por isso não precisamos criar o mapeamento aqui.

-- Force schema cache reload
NOTIFY pgrst, 'reload config';

