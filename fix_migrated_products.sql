-- Script para corrigir produtos migrados que podem estar sem status ou preço
-- Execute este script APÓS a migração para garantir que os produtos estão corretos

-- 1. Verificar produtos sem status
SELECT 
    'Produtos sem status' as info,
    COUNT(*) as quantidade
FROM public.products
WHERE status IS NULL;

-- 2. Verificar produtos sem preço mas que eram menu_items (se a tabela ainda existir)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'menu_items') THEN
        PERFORM 1; -- menu_items ainda existe, podemos usar
    END IF;
END $$;

-- 3. Atualizar produtos que têm preço mas não têm status ou têm status incorreto
UPDATE public.products
SET status = 'Available'
WHERE price IS NOT NULL 
  AND price > 0
  AND (status IS NULL OR status = '' OR status != 'Available');

-- 4. Se a tabela menu_items ainda existe, atualizar produtos que eram menu_items
--    e não têm preço (copiar preço de menu_items)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'menu_items') THEN
        UPDATE public.products p
        SET price = (
            SELECT m.price 
            FROM public.menu_items m 
            WHERE m.id = p.id
        ),
        status = COALESCE(p.status, COALESCE((
            SELECT m.status FROM public.menu_items m WHERE m.id = p.id
        ), 'Available'))
        WHERE p.price IS NULL 
          AND EXISTS (
            SELECT 1 FROM public.menu_items m 
            WHERE m.id = p.id AND m.price IS NOT NULL
          );
    END IF;
END $$;

-- 5. Garantir que todos os produtos com preço têm status Available
UPDATE public.products
SET status = 'Available'
WHERE price IS NOT NULL 
  AND price > 0
  AND (status IS NULL OR status = '' OR status != 'Available');

-- 6. Verificar resultado
SELECT 
    'Produtos vendáveis após correção' as info,
    COUNT(*) as quantidade
FROM public.products
WHERE price IS NOT NULL 
  AND price > 0
  AND status = 'Available';

-- 7. Listar produtos que serão exibidos no menu
SELECT 
    id,
    name,
    price,
    status,
    category
FROM public.products
WHERE price IS NOT NULL 
  AND price > 0
  AND status = 'Available'
ORDER BY id
LIMIT 20;

-- Force schema cache reload
NOTIFY pgrst, 'reload config';

