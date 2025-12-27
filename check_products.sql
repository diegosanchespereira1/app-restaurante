-- Script para verificar produtos e diagnosticar problemas

-- 1. Verificar se há produtos na tabela products
SELECT 
    'Total de produtos' as info,
    COUNT(*) as quantidade
FROM public.products;

-- 2. Verificar produtos com price (itens vendáveis)
SELECT 
    'Produtos com preço (vendáveis)' as info,
    COUNT(*) as quantidade
FROM public.products
WHERE price IS NOT NULL;

-- 3. Verificar produtos sem price (apenas estoque)
SELECT 
    'Produtos sem preço (apenas estoque)' as info,
    COUNT(*) as quantidade
FROM public.products
WHERE price IS NULL;

-- 4. Listar alguns produtos com preço para verificar
SELECT 
    id,
    name,
    price,
    category,
    status,
    current_stock
FROM public.products
WHERE price IS NOT NULL
ORDER BY id
LIMIT 10;

-- 5. Verificar se há produtos com status Available
SELECT 
    'Produtos disponíveis (status = Available)' as info,
    COUNT(*) as quantidade
FROM public.products
WHERE price IS NOT NULL 
  AND status = 'Available';

-- 6. Listar todos os produtos com seus preços (para debug)
SELECT 
    id,
    name,
    price,
    status,
    category,
    current_stock,
    created_at
FROM public.products
ORDER BY id;

