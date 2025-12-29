-- Script para adicionar campos de desconto por método de pagamento na tabela products
-- Desconto pode ser aplicado para pagamentos em dinheiro (Cash) e PIX

-- Adicionar campos de desconto
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS discount_type text DEFAULT NULL, -- 'fixed' (valor fixo em reais) ou 'percentage' (percentual)
ADD COLUMN IF NOT EXISTS discount_value numeric DEFAULT NULL, -- valor do desconto (em reais se fixed, em % se percentage)
ADD COLUMN IF NOT EXISTS discount_applies_to text[] DEFAULT NULL; -- array de métodos de pagamento: ['Cash', 'PIX']

-- Adicionar comentários para documentação
COMMENT ON COLUMN public.products.discount_type IS 'Tipo de desconto: fixed (valor fixo em reais) ou percentage (percentual)';
COMMENT ON COLUMN public.products.discount_value IS 'Valor do desconto: em reais se discount_type = fixed, em percentual se discount_type = percentage';
COMMENT ON COLUMN public.products.discount_applies_to IS 'Array de métodos de pagamento que o desconto se aplica: Cash, PIX, Card, Voucher';

-- Criar índice para melhor performance em consultas
CREATE INDEX IF NOT EXISTS idx_products_discount_applies_to ON public.products USING GIN (discount_applies_to);

-- Force schema cache reload
NOTIFY pgrst, 'reload config';

