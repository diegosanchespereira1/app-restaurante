-- Script para criar a tabela products unificada
-- Esta tabela unifica menu_items e inventory_items em uma única estrutura

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create Products Table
CREATE TABLE IF NOT EXISTS public.products (
  id serial primary key,
  
  -- Campos básicos
  name text not null,
  category text,
  image text,
  
  -- Campos de venda (pode ser NULL se produto não é vendido diretamente)
  price numeric, -- preço de venda
  description text,
  status text default 'Available', -- 'Available' | 'Sold Out'
  
  -- Campos de estoque (pode ser NULL se produto não tem controle de estoque)
  unit text default 'UN',
  min_stock numeric default 0,
  current_stock numeric default 0,
  cost_price numeric, -- preço de custo
  
  -- Campos fiscais (opcionais)
  product_type text,
  ncm text,
  cst_icms text,
  cfop text,
  icms_rate numeric,
  ipi_rate numeric,
  ean_code text,
  
  -- Timestamps
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_products_status ON public.products(status);
CREATE INDEX IF NOT EXISTS idx_products_name ON public.products(name);

-- Enable Row Level Security
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- RLS Policies for products
DROP POLICY IF EXISTS "Anyone can view products" ON public.products;
CREATE POLICY "Anyone can view products" ON public.products
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Only admins can manage products" ON public.products;
CREATE POLICY "Only admins can manage products" ON public.products
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at
DROP TRIGGER IF EXISTS update_products_updated_at_trigger ON public.products;
CREATE TRIGGER update_products_updated_at_trigger
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_products_updated_at();

-- Force schema cache reload
NOTIFY pgrst, 'reload config';

