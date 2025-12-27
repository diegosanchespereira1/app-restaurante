-- Script de validação para verificar se a migração foi bem-sucedida

-- 1. Verificar se todos os menu_items foram migrados
SELECT 
    'menu_items não migrados' as tipo,
    COUNT(*) as quantidade
FROM public.menu_items m
WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.id = m.id);

-- 2. Verificar quantidade de products vs menu_items + inventory_items
SELECT 
    'Total menu_items' as tipo,
    COUNT(*) as quantidade
FROM public.menu_items
UNION ALL
SELECT 
    'Total inventory_items' as tipo,
    COUNT(*) as quantidade
FROM public.inventory_items
UNION ALL
SELECT 
    'Total products' as tipo,
    COUNT(*) as quantidade
FROM public.products;

-- 3. Verificar order_items com product_id NULL (pode ser normal se produto foi deletado)
SELECT 
    'order_items com product_id NULL' as tipo,
    COUNT(*) as quantidade
FROM public.order_items
WHERE product_id IS NULL AND menu_item_id IS NOT NULL;

-- 4. Verificar invoice_items com product_id NULL
SELECT 
    'invoice_items com product_id NULL' as tipo,
    COUNT(*) as quantidade
FROM public.invoice_items
WHERE product_id IS NULL AND inventory_item_id IS NOT NULL;

-- 5. Verificar stock_movements com product_id NULL
SELECT 
    'stock_movements com product_id NULL' as tipo,
    COUNT(*) as quantidade
FROM public.stock_movements
WHERE product_id IS NULL AND inventory_item_id IS NOT NULL;

-- 6. Listar alguns produtos para verificar
SELECT 
    id,
    name,
    price,
    category,
    current_stock,
    unit
FROM public.products
ORDER BY id
LIMIT 10;

