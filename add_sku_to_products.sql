-- Migration to add SKU column to products table
-- This column is needed for iFood integration product mapping

ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS sku text;

-- Create index on sku for faster lookups
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(sku);

-- Update RLS policies to include the new column
-- The existing policies should work since they use USING (true) for SELECT
-- and check for admin role for ALL operations

-- Force schema cache reload
NOTIFY pgrst, 'reload config';