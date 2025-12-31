-- Script para encontrar e corrigir pedidos duplicados do iFood
-- Execute este script no Supabase SQL Editor

-- 1. Encontrar pedidos duplicados por ifood_order_id
SELECT 
    ifood_order_id,
    COUNT(*) as duplicate_count,
    STRING_AGG(id::text, ', ') as order_ids,
    STRING_AGG(status::text, ', ') as statuses,
    STRING_AGG(created_at::text, ', ') as created_dates
FROM orders
WHERE ifood_order_id IS NOT NULL
GROUP BY ifood_order_id
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- 2. Ver detalhes dos pedidos duplicados (substitua 'SEU_IFOOD_ORDER_ID' pelo ID real)
-- SELECT * FROM orders WHERE ifood_order_id = 'SEU_IFOOD_ORDER_ID' ORDER BY created_at DESC;

-- 3. Remover pedidos duplicados, mantendo apenas o mais recente
-- ATENÇÃO: Faça backup antes de executar!
-- Este script mantém o pedido mais recente e remove os mais antigos

WITH duplicate_orders AS (
    SELECT 
        id,
        ifood_order_id,
        created_at,
        ROW_NUMBER() OVER (
            PARTITION BY ifood_order_id 
            ORDER BY created_at DESC
        ) as rn
    FROM orders
    WHERE ifood_order_id IS NOT NULL
)
DELETE FROM orders
WHERE id IN (
    SELECT id 
    FROM duplicate_orders 
    WHERE rn > 1
);

-- 4. Verificar se ainda há duplicados após a limpeza
SELECT 
    ifood_order_id,
    COUNT(*) as count
FROM orders
WHERE ifood_order_id IS NOT NULL
GROUP BY ifood_order_id
HAVING COUNT(*) > 1;

