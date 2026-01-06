-- Script para corrigir pedidos duplicados e problemas de sequência
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

-- 2. Remover pedidos duplicados, mantendo apenas o mais recente
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

-- 3. Remover itens de pedidos órfãos (itens que pertencem a pedidos que não existem mais)
DELETE FROM order_items
WHERE order_id NOT IN (
    SELECT id FROM orders
);

-- 4. Verificar se ainda há duplicados após a limpeza
SELECT 
    ifood_order_id,
    COUNT(*) as count
FROM orders
WHERE ifood_order_id IS NOT NULL
GROUP BY ifood_order_id
HAVING COUNT(*) > 1;

-- 5. Resetar a sequência de IDs para evitar conflitos
-- Primeiro, encontrar o maior ID atual
SELECT MAX(id) as max_id FROM orders;

-- Depois, resetar a sequência (você precisará executar este comando separadamente)
-- ALTER SEQUENCE orders_id_seq RESTART WITH [max_id + 1];

-- 6. Verificar a integridade dos dados
SELECT COUNT(*) as total_orders FROM orders;
SELECT COUNT(*) as total_order_items FROM order_items;

-- 7. Verificar se há pedidos com IDs duplicados na tabela principal
SELECT 
    id,
    COUNT(*) as count
FROM orders
GROUP BY id
HAVING COUNT(*) > 1
ORDER BY count DESC;