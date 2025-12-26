-- Script completo para criar todas as tabelas de estoque
-- Execute este script se as tabelas ainda não existirem

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Inventory Items Table
CREATE TABLE IF NOT EXISTS public.inventory_items (
  id serial primary key,
  menu_item_id int references public.menu_items(id) on delete set null,
  name text not null,
  unit text not null default 'UN',
  min_stock numeric not null default 0,
  current_stock numeric not null default 0,
  cost_price numeric,
  selling_price numeric,
  category text,
  -- Campos para Nota Fiscal e Impostos
  product_type text,
  ncm text,
  cst_icms text,
  cfop text,
  icms_rate numeric,
  ipi_rate numeric,
  ean_code text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Purchase Invoices Table
CREATE TABLE IF NOT EXISTS public.purchase_invoices (
  id serial primary key,
  invoice_number text not null,
  invoice_series text,
  nfe_key text,
  supplier_name text not null,
  supplier_cnpj text,
  supplier_address text,
  invoice_date date not null,
  total_amount numeric not null,
  xml_file_path text,
  xml_content text,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. Invoice Items Table
CREATE TABLE IF NOT EXISTS public.invoice_items (
  id serial primary key,
  invoice_id int references public.purchase_invoices(id) on delete cascade,
  inventory_item_id int references public.inventory_items(id) on delete set null,
  product_name text not null,
  quantity numeric not null,
  unit text not null default 'UN',
  unit_price numeric not null,
  total_price numeric not null,
  created_at timestamptz default now()
);

-- 4. Stock Movements Table
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id serial primary key,
  inventory_item_id int references public.inventory_items(id) on delete cascade,
  movement_type text not null check (movement_type in ('entry', 'exit', 'adjustment')),
  quantity numeric not null,
  reference_id int,
  reference_type text,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_inventory_items_menu_item_id ON public.inventory_items(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON public.inventory_items(category);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_invoice_number ON public.purchase_invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_invoice_date ON public.purchase_invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON public.invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_inventory_item_id ON public.invoice_items(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_inventory_item_id ON public.stock_movements(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON public.stock_movements(created_at);
CREATE INDEX IF NOT EXISTS idx_stock_movements_movement_type ON public.stock_movements(movement_type);

-- Enable Row Level Security
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- RLS Policies for inventory_items
DROP POLICY IF EXISTS "Anyone can view inventory items" ON public.inventory_items;
CREATE POLICY "Anyone can view inventory items" ON public.inventory_items
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Only admins can manage inventory items" ON public.inventory_items;
CREATE POLICY "Only admins can manage inventory items" ON public.inventory_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for purchase_invoices
DROP POLICY IF EXISTS "Anyone can view purchase invoices" ON public.purchase_invoices;
CREATE POLICY "Anyone can view purchase invoices" ON public.purchase_invoices
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Only admins can manage purchase invoices" ON public.purchase_invoices;
CREATE POLICY "Only admins can manage purchase invoices" ON public.purchase_invoices
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for invoice_items
DROP POLICY IF EXISTS "Anyone can view invoice items" ON public.invoice_items;
CREATE POLICY "Anyone can view invoice items" ON public.invoice_items
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Only admins can manage invoice items" ON public.invoice_items;
CREATE POLICY "Only admins can manage invoice items" ON public.invoice_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for stock_movements
DROP POLICY IF EXISTS "Anyone can view stock movements" ON public.stock_movements;
CREATE POLICY "Anyone can view stock movements" ON public.stock_movements
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Only admins can manage stock movements" ON public.stock_movements;
CREATE POLICY "Only admins can manage stock movements" ON public.stock_movements
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Functions to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_inventory_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.update_purchase_invoices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to update updated_at
DROP TRIGGER IF EXISTS update_inventory_items_updated_at_trigger ON public.inventory_items;
CREATE TRIGGER update_inventory_items_updated_at_trigger
  BEFORE UPDATE ON public.inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_inventory_items_updated_at();

DROP TRIGGER IF EXISTS update_purchase_invoices_updated_at_trigger ON public.purchase_invoices;
CREATE TRIGGER update_purchase_invoices_updated_at_trigger
  BEFORE UPDATE ON public.purchase_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_purchase_invoices_updated_at();

-- Function to automatically update stock when movement is created
CREATE OR REPLACE FUNCTION public.update_stock_on_movement()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.movement_type = 'entry' THEN
    UPDATE public.inventory_items
    SET current_stock = current_stock + NEW.quantity
    WHERE id = NEW.inventory_item_id;
  ELSIF NEW.movement_type = 'exit' THEN
    UPDATE public.inventory_items
    SET current_stock = current_stock - NEW.quantity
    WHERE id = NEW.inventory_item_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update stock automatically
DROP TRIGGER IF EXISTS update_stock_on_movement_trigger ON public.stock_movements;
CREATE TRIGGER update_stock_on_movement_trigger
  AFTER INSERT ON public.stock_movements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_stock_on_movement();

-- Force schema cache reload
NOTIFY pgrst, 'reload config';

