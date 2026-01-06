-- Script para criar tabelas de promoções e produtos customizados
-- Permite criar produtos novos ou combinações de produtos existentes (kits)

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create Promotions Table
CREATE TABLE IF NOT EXISTS public.promotions (
  id serial primary key,
  
  -- Campos básicos
  name text not null,
  description text,
  image text,
  
  -- Tipo de promoção: 'product' (produto novo) ou 'kit' (combinação de produtos)
  type text not null default 'kit', -- 'product' | 'kit'
  
  -- Preço e desconto
  price numeric, -- Preço final (para produto novo) ou preço do kit
  discount_percentage numeric, -- Desconto percentual aplicado no final da compra (0-100)
  discount_amount numeric, -- Desconto fixo em valor (alternativa ao percentual)
  
  -- Status
  enabled boolean default true, -- Toggle para habilitar/desabilitar
  
  -- Categoria (opcional, para organização)
  category text,
  
  -- Timestamps
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Create Promotion Items Table (para kits - combinação de produtos)
CREATE TABLE IF NOT EXISTS public.promotion_items (
  id serial primary key,
  promotion_id int not null references public.promotions(id) on delete cascade,
  product_id int not null references public.products(id) on delete cascade,
  quantity numeric not null default 1, -- Quantidade do produto no kit
  created_at timestamptz default now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_promotions_type ON public.promotions(type);
CREATE INDEX IF NOT EXISTS idx_promotions_enabled ON public.promotions(enabled);
CREATE INDEX IF NOT EXISTS idx_promotions_category ON public.promotions(category);
CREATE INDEX IF NOT EXISTS idx_promotion_items_promotion_id ON public.promotion_items(promotion_id);
CREATE INDEX IF NOT EXISTS idx_promotion_items_product_id ON public.promotion_items(product_id);

-- Enable Row Level Security
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for promotions
DROP POLICY IF EXISTS "Anyone can view enabled promotions" ON public.promotions;
CREATE POLICY "Anyone can view enabled promotions" ON public.promotions
  FOR SELECT USING (enabled = true);

DROP POLICY IF EXISTS "Users and managers can view all promotions" ON public.promotions;
CREATE POLICY "Users and managers can view all promotions" ON public.promotions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'gerente', 'usuario')
    )
  );

DROP POLICY IF EXISTS "Users and managers can manage promotions" ON public.promotions;
CREATE POLICY "Users and managers can manage promotions" ON public.promotions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'gerente', 'usuario')
    )
  );

-- RLS Policies for promotion_items
DROP POLICY IF EXISTS "Anyone can view promotion items" ON public.promotion_items;
CREATE POLICY "Anyone can view promotion items" ON public.promotion_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.promotions
      WHERE id = promotion_items.promotion_id AND enabled = true
    ) OR EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'gerente', 'usuario')
    )
  );

DROP POLICY IF EXISTS "Users and managers can manage promotion items" ON public.promotion_items;
CREATE POLICY "Users and managers can manage promotion items" ON public.promotion_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'gerente', 'usuario')
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_promotions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at
DROP TRIGGER IF EXISTS update_promotions_updated_at_trigger ON public.promotions;
CREATE TRIGGER update_promotions_updated_at_trigger
  BEFORE UPDATE ON public.promotions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_promotions_updated_at();

-- Force schema cache reload
NOTIFY pgrst, 'reload config';



