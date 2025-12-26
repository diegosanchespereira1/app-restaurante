-- Create Stock Management Tables
-- Only admins can manage stock

-- Enable UUID extension if not already enabled
create extension if not exists "uuid-ossp";

-- 1. Inventory Items Table
-- Relaciona produtos do menu com controle de estoque
create table if not exists inventory_items (
  id serial primary key,
  menu_item_id int references menu_items(id) on delete set null,
  name text not null,
  unit text not null default 'UN', -- UN, KG, L, etc
  min_stock numeric not null default 0,
  current_stock numeric not null default 0,
  cost_price numeric,
  selling_price numeric,
  category text,
  -- Campos para Nota Fiscal e Impostos
  product_type text, -- Tipo: 'alimento', 'bebida', 'limpeza', 'outros'
  ncm text, -- Nomenclatura Comum do Mercosul (código fiscal)
  cst_icms text, -- Código de Situação Tributária ICMS
  cfop text, -- Código Fiscal de Operações e Prestações
  icms_rate numeric, -- Alíquota de ICMS (%)
  ipi_rate numeric, -- Alíquota de IPI (%)
  ean_code text, -- Código de barras EAN
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Purchase Invoices Table (Notas Fiscais de Compra)
create table if not exists purchase_invoices (
  id serial primary key,
  invoice_number text not null,
  invoice_series text,
  nfe_key text, -- Chave de acesso da NF-e
  supplier_name text not null,
  supplier_cnpj text,
  supplier_address text,
  invoice_date date not null,
  total_amount numeric not null,
  xml_file_path text, -- Caminho do arquivo XML (opcional)
  xml_content text, -- Conteúdo do XML para auditoria (opcional)
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. Invoice Items Table (Itens da Nota Fiscal)
create table if not exists invoice_items (
  id serial primary key,
  invoice_id int references purchase_invoices(id) on delete cascade,
  inventory_item_id int references inventory_items(id) on delete set null,
  product_name text not null, -- Nome do produto na nota (pode ser diferente do inventário)
  quantity numeric not null,
  unit text not null default 'UN',
  unit_price numeric not null,
  total_price numeric not null,
  created_at timestamptz default now()
);

-- 4. Stock Movements Table (Movimentações de Estoque)
create table if not exists stock_movements (
  id serial primary key,
  inventory_item_id int references inventory_items(id) on delete cascade,
  movement_type text not null check (movement_type in ('entry', 'exit', 'adjustment')),
  quantity numeric not null,
  reference_id int, -- ID da nota fiscal ou pedido
  reference_type text, -- 'invoice' ou 'order'
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- Create indexes for better performance
create index if not exists idx_inventory_items_menu_item_id on inventory_items(menu_item_id);
create index if not exists idx_inventory_items_category on inventory_items(category);
create index if not exists idx_purchase_invoices_invoice_number on purchase_invoices(invoice_number);
create index if not exists idx_purchase_invoices_invoice_date on purchase_invoices(invoice_date);
create index if not exists idx_invoice_items_invoice_id on invoice_items(invoice_id);
create index if not exists idx_invoice_items_inventory_item_id on invoice_items(inventory_item_id);
create index if not exists idx_stock_movements_inventory_item_id on stock_movements(inventory_item_id);
create index if not exists idx_stock_movements_created_at on stock_movements(created_at);
create index if not exists idx_stock_movements_movement_type on stock_movements(movement_type);

-- Enable Row Level Security
alter table inventory_items enable row level security;
alter table purchase_invoices enable row level security;
alter table invoice_items enable row level security;
alter table stock_movements enable row level security;

-- RLS Policies for inventory_items
-- Everyone can read
create policy "Anyone can view inventory items" on inventory_items
  for select using (true);

-- Only admins can insert/update/delete
create policy "Only admins can manage inventory items" on inventory_items
  for all using (
    exists (
      select 1 from user_profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- RLS Policies for purchase_invoices
-- Everyone can read
create policy "Anyone can view purchase invoices" on purchase_invoices
  for select using (true);

-- Only admins can insert/update/delete
create policy "Only admins can manage purchase invoices" on purchase_invoices
  for all using (
    exists (
      select 1 from user_profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- RLS Policies for invoice_items
-- Everyone can read
create policy "Anyone can view invoice items" on invoice_items
  for select using (true);

-- Only admins can insert/update/delete
create policy "Only admins can manage invoice items" on invoice_items
  for all using (
    exists (
      select 1 from user_profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- RLS Policies for stock_movements
-- Everyone can read
create policy "Anyone can view stock movements" on stock_movements
  for select using (true);

-- Only admins can insert/update/delete
create policy "Only admins can manage stock movements" on stock_movements
  for all using (
    exists (
      select 1 from user_profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Function to update updated_at timestamp
create or replace function update_inventory_items_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create or replace function update_purchase_invoices_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Triggers to update updated_at
create trigger update_inventory_items_updated_at_trigger
  before update on inventory_items
  for each row
  execute function update_inventory_items_updated_at();

create trigger update_purchase_invoices_updated_at_trigger
  before update on purchase_invoices
  for each row
  execute function update_purchase_invoices_updated_at();

-- Function to automatically update stock when movement is created
create or replace function update_stock_on_movement()
returns trigger as $$
begin
  if new.movement_type = 'entry' then
    update inventory_items
    set current_stock = current_stock + new.quantity
    where id = new.inventory_item_id;
  elsif new.movement_type = 'exit' then
    update inventory_items
    set current_stock = current_stock - new.quantity
    where id = new.inventory_item_id;
  elsif new.movement_type = 'adjustment' then
    -- For adjustments, we need to calculate the difference
    -- This is handled by the application logic
    null;
  end if;
  return new;
end;
$$ language plpgsql;

-- Trigger to update stock automatically
create trigger update_stock_on_movement_trigger
  after insert on stock_movements
  for each row
  execute function update_stock_on_movement();

-- Force schema cache reload
NOTIFY pgrst, 'reload config';

