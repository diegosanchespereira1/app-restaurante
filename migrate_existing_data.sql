-- Script para migrar dados de menu_items e inventory_items para products
-- Este script migra todos os dados existentes das tabelas antigas para products

-- 1. Verificar se há dados para migrar
SELECT 
    'Total menu_items' as info,
    COUNT(*) as quantidade
FROM public.menu_items;

SELECT 
    'Total inventory_items' as info,
    COUNT(*) as quantidade
FROM public.inventory_items;

SELECT 
    'Total products (antes da migração)' as info,
    COUNT(*) as quantidade
FROM public.products;

-- 2. Ajustar sequência de IDs para evitar conflitos
DO $$
DECLARE
  max_menu_id integer;
  max_inventory_id integer;
  max_product_id integer;
BEGIN
  SELECT COALESCE(MAX(id), 0) INTO max_menu_id FROM public.menu_items;
  SELECT COALESCE(MAX(id), 0) INTO max_inventory_id FROM public.inventory_items;
  SELECT COALESCE(MAX(id), 0) INTO max_product_id FROM public.products;
  
  -- Ajustar sequência para o maior ID + 1
  PERFORM setval('products_id_seq', GREATEST(max_menu_id, max_inventory_id, max_product_id) + 1);
END $$;

-- 3. Migrar menu_items para products (preservando IDs)
INSERT INTO public.products (
  id,
  name,
  price,
  description,
  category,
  status,
  image,
  created_at,
  updated_at
)
SELECT 
  id,
  name,
  price,
  description,
  category,
  COALESCE(status, 'Available'),
  COALESCE(image, 'materialApoio/imagem-nao-disponivel.gif'),
  now(),
  now()
FROM public.menu_items
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  price = EXCLUDED.price,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  status = COALESCE(EXCLUDED.status, products.status, 'Available'),
  image = COALESCE(EXCLUDED.image, products.image, 'materialApoio/imagem-nao-disponivel.gif'),
  updated_at = now();

-- 3. Atualizar products com dados de inventory_items que têm menu_item_id
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
  -- Manter image do product (inventory_items pode não ter coluna image)
  image = COALESCE(p.image, 'materialApoio/imagem-nao-disponivel.gif'),
  -- Se inventory tem category e product não tem, usar category do inventory
  category = COALESCE(p.category, i.category),
  updated_at = now()
FROM public.inventory_items i
WHERE i.menu_item_id = p.id;

-- 4. Criar products para inventory_items que NÃO têm menu_item_id
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
  ean_code,
  created_at,
  updated_at
)
SELECT 
  i.name,
  COALESCE(i.unit, 'UN'),
  COALESCE(i.min_stock, 0),
  COALESCE(i.current_stock, 0),
  i.cost_price,
  i.selling_price as price,
  i.category,
  'materialApoio/imagem-nao-disponivel.gif' as image,
  i.product_type,
  i.ncm,
  i.cst_icms,
  i.cfop,
  i.icms_rate,
  i.ipi_rate,
  i.ean_code,
  COALESCE(i.created_at, now()) as created_at,
  COALESCE(i.updated_at, now()) as updated_at
FROM public.inventory_items i
WHERE i.menu_item_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.products p 
    WHERE p.name = i.name 
      AND p.price IS NULL 
      AND p.unit = COALESCE(i.unit, 'UN')
  );

-- 5. Garantir que produtos com preço têm status Available
UPDATE public.products
SET status = 'Available'
WHERE price IS NOT NULL 
  AND price > 0
  AND (status IS NULL OR status = '' OR status != 'Available');

-- 6. Verificar resultado
SELECT 
    'Total products (após migração)' as info,
    COUNT(*) as quantidade
FROM public.products;

SELECT 
    'Produtos vendáveis (com preço e Available)' as info,
    COUNT(*) as quantidade
FROM public.products
WHERE price IS NOT NULL 
  AND price > 0
  AND status = 'Available';

-- 7. Listar produtos migrados que serão exibidos no menu
SELECT 
    id,
    name,
    price,
    status,
    category,
    current_stock,
    unit
FROM public.products
WHERE price IS NOT NULL 
  AND price > 0
  AND status = 'Available'
ORDER BY id
LIMIT 20;

-- Force schema cache reload
NOTIFY pgrst, 'reload config';

