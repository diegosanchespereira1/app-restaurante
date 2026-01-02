-- Script para corrigir o erro "duplicate key value violates unique constraint 'orders_pkey'"
-- Este erro ocorre quando há IDs duplicados na tabela orders
-- Execute este script no Supabase SQL Editor

-- 1. Verificar se há IDs duplicados na tabela orders (este é o problema principal)
SELECT 
    id,
    COUNT(*) as duplicate_count
FROM orders
GROUP BY id
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- 2. Se houver IDs duplicados, remover os registros duplicados
-- Mantendo apenas um registro por ID
WITH numbered_orders AS (
    SELECT 
        id,
        ROW_NUMBER() OVER (PARTITION BY id ORDER BY created_at DESC) as rn
    FROM orders
)
DELETE FROM orders
WHERE id IN (
    SELECT id FROM numbered_orders WHERE rn > 1
);

-- 3. Verificar se o problema foi resolvido
SELECT 
    id,
    COUNT(*) as count
FROM orders
GROUP BY id
HAVING COUNT(*) > 1;

-- 4. Se você deletou todos os pedidos manualmente e está com problemas de sequência,
-- este comando pode ajudar a resetar a sequência (execute separadamente):
-- ALTER SEQUENCE IF EXISTS orders_id_seq RESTART WITH 1;

-- 5. Verificar a integridade geral dos dados
SELECT 
    COUNT(*) as total_orders,
    COUNT(DISTINCT id) as unique_order_ids,
    COUNT(DISTINCT ifood_order_id) as unique_ifood_order_ids
FROM orders;

-- 6. Verificar se há pedidos com ifood_order_id duplicados
SELECT 
    ifood_order_id,
    COUNT(*) as count
FROM orders
WHERE ifood_order_id IS NOT NULL
GROUP BY ifood_order_id
HAVING COUNT(*) > 1;