-- Script completo para criar a tabela inventory_items (se não existir) e adicionar campos fiscais
-- Execute este script para garantir que a tabela existe com todos os campos necessários

-- 1. Criar a tabela inventory_items se não existir
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
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Adicionar campos fiscais se não existirem
DO $$ 
BEGIN
    -- Tipo de produto
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'inventory_items' 
                   AND column_name = 'product_type') THEN
        ALTER TABLE public.inventory_items ADD COLUMN product_type text;
    END IF;

    -- NCM (Nomenclatura Comum do Mercosul)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'inventory_items' 
                   AND column_name = 'ncm') THEN
        ALTER TABLE public.inventory_items ADD COLUMN ncm text;
    END IF;

    -- CST ICMS (Código de Situação Tributária)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'inventory_items' 
                   AND column_name = 'cst_icms') THEN
        ALTER TABLE public.inventory_items ADD COLUMN cst_icms text;
    END IF;

    -- CFOP (Código Fiscal de Operações e Prestações)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'inventory_items' 
                   AND column_name = 'cfop') THEN
        ALTER TABLE public.inventory_items ADD COLUMN cfop text;
    END IF;

    -- Alíquota de ICMS
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'inventory_items' 
                   AND column_name = 'icms_rate') THEN
        ALTER TABLE public.inventory_items ADD COLUMN icms_rate numeric;
    END IF;

    -- Alíquota de IPI
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'inventory_items' 
                   AND column_name = 'ipi_rate') THEN
        ALTER TABLE public.inventory_items ADD COLUMN ipi_rate numeric;
    END IF;

    -- Código de barras EAN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'inventory_items' 
                   AND column_name = 'ean_code') THEN
        ALTER TABLE public.inventory_items ADD COLUMN ean_code text;
    END IF;
END $$;

-- 3. Criar trigger para updated_at se não existir
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger se não existir
DROP TRIGGER IF EXISTS update_inventory_items_updated_at ON public.inventory_items;
CREATE TRIGGER update_inventory_items_updated_at
    BEFORE UPDATE ON public.inventory_items
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Habilitar RLS (Row Level Security) se não estiver habilitado
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

-- 5. Criar políticas RLS se não existirem
-- Política para leitura (todos os usuários autenticados podem ler)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'inventory_items' 
        AND policyname = 'Users can view inventory items'
    ) THEN
        CREATE POLICY "Users can view inventory items" 
        ON public.inventory_items 
        FOR SELECT 
        USING (auth.role() = 'authenticated');
    END IF;
END $$;

-- Política para inserção (apenas admins)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'inventory_items' 
        AND policyname = 'Admins can insert inventory items'
    ) THEN
        CREATE POLICY "Admins can insert inventory items" 
        ON public.inventory_items 
        FOR INSERT 
        WITH CHECK (
            EXISTS (
                SELECT 1 FROM public.user_profiles 
                WHERE id = auth.uid() 
                AND role = 'admin'
            )
        );
    END IF;
END $$;

-- Política para atualização (apenas admins)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'inventory_items' 
        AND policyname = 'Admins can update inventory items'
    ) THEN
        CREATE POLICY "Admins can update inventory items" 
        ON public.inventory_items 
        FOR UPDATE 
        USING (
            EXISTS (
                SELECT 1 FROM public.user_profiles 
                WHERE id = auth.uid() 
                AND role = 'admin'
            )
        );
    END IF;
END $$;

-- Política para exclusão (apenas admins)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'inventory_items' 
        AND policyname = 'Admins can delete inventory items'
    ) THEN
        CREATE POLICY "Admins can delete inventory items" 
        ON public.inventory_items 
        FOR DELETE 
        USING (
            EXISTS (
                SELECT 1 FROM public.user_profiles 
                WHERE id = auth.uid() 
                AND role = 'admin'
            )
        );
    END IF;
END $$;

-- Comentários nas colunas
COMMENT ON COLUMN public.inventory_items.product_type IS 'Tipo de produto: alimento, bebida, limpeza, embalagem, outros';
COMMENT ON COLUMN public.inventory_items.ncm IS 'Nomenclatura Comum do Mercosul - código fiscal de 8 dígitos';
COMMENT ON COLUMN public.inventory_items.cst_icms IS 'Código de Situação Tributária do ICMS';
COMMENT ON COLUMN public.inventory_items.cfop IS 'Código Fiscal de Operações e Prestações';
COMMENT ON COLUMN public.inventory_items.icms_rate IS 'Alíquota de ICMS em percentual';
COMMENT ON COLUMN public.inventory_items.ipi_rate IS 'Alíquota de IPI em percentual (apenas produtos industrializados)';
COMMENT ON COLUMN public.inventory_items.ean_code IS 'Código de barras EAN-13 (13 dígitos)';

-- Force schema cache reload
NOTIFY pgrst, 'reload config';
