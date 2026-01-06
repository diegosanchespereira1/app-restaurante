-- Remove pedidos com ifood_order_id inválido que não existe no iFood
-- ID: ef66be89-b4b7-45ce-9eb0-5bc3f20b9bd4

-- Primeiro, vamos verificar se existe algum pedido com esse ID
SELECT id, ifood_order_id, customer, status, created_at 
FROM public.orders 
WHERE ifood_order_id = 'ef66be89-b4b7-45ce-9eb0-5bc3f20b9bd4';

-- Remover itens do pedido primeiro (devido à foreign key constraint)
DELETE FROM public.order_items 
WHERE order_id IN (
    SELECT id FROM public.orders 
    WHERE ifood_order_id = 'ef66be89-b4b7-45ce-9eb0-5bc3f20b9bd4'
);

-- Remover o pedido
DELETE FROM public.orders 
WHERE ifood_order_id = 'ef66be89-b4b7-45ce-9eb0-5bc3f20b9bd4';

-- Verificar se foi removido
SELECT COUNT(*) as remaining_orders 
FROM public.orders 
WHERE ifood_order_id = 'ef66be89-b4b7-45ce-9eb0-5bc3f20b9bd4';



