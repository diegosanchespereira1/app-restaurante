-- Script para adicionar campos de desconto na tabela orders
-- Permite aplicar desconto manual no pedido (em reais ou percentual)

-- Adicionar campos de desconto do pedido
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS order_discount_type text DEFAULT NULL, -- 'fixed' (valor fixo em reais) ou 'percentage' (percentual)
ADD COLUMN IF NOT EXISTS order_discount_value numeric DEFAULT NULL; -- valor do desconto (em reais se fixed, em % se percentage)

-- Adicionar comentários para documentação
COMMENT ON COLUMN public.orders.order_discount_type IS 'Tipo de desconto do pedido: fixed (valor fixo em reais) ou percentage (percentual)';
COMMENT ON COLUMN public.orders.order_discount_value IS 'Valor do desconto do pedido: em reais se order_discount_type = fixed, em percentual se order_discount_type = percentage';

-- Force schema cache reload
NOTIFY pgrst, 'reload config';

