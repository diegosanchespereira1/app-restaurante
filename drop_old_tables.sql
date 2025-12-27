-- Script para remover tabelas antigas menu_items e inventory_items
-- ATENÇÃO: Execute este script APENAS após validar que toda a migração foi bem-sucedida
-- e que todos os dados foram migrados corretamente para a tabela products

-- IMPORTANTE: Este script remove as tabelas antigas. Certifique-se de ter:
-- 1. Executado create_products_table.sql
-- 2. Executado migrate_menu_and_inventory_to_products.sql
-- 3. Executado update_foreign_keys_to_products.sql
-- 4. Validado que todos os dados estão na tabela products
-- 5. Atualizado todo o código da aplicação para usar products

-- Remover colunas antigas (mantidas para backward compatibility durante transição)
-- Remover menu_item_id de order_items (se ainda existir e não for mais necessário)
-- ALTER TABLE public.order_items DROP COLUMN IF EXISTS menu_item_id;

-- Remover inventory_item_id de invoice_items (se ainda existir e não for mais necessário)
-- ALTER TABLE public.invoice_items DROP COLUMN IF EXISTS inventory_item_id;

-- Remover inventory_item_id de stock_movements (se ainda existir e não for mais necessário)
-- ALTER TABLE public.stock_movements DROP COLUMN IF EXISTS inventory_item_id;

-- Dropar tabelas antigas
-- ATENÇÃO: Isso irá remover permanentemente as tabelas antigas
-- Descomente as linhas abaixo APENAS após validação completa:

-- DROP TABLE IF EXISTS public.inventory_items CASCADE;
-- DROP TABLE IF EXISTS public.menu_items CASCADE;

-- Force schema cache reload
NOTIFY pgrst, 'reload config';

