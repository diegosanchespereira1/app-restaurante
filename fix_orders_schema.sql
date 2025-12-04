-- Add missing columns to the orders table

-- Add order_type column if it doesn't exist
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS order_type text DEFAULT 'dine_in';

-- Add payment_method column if it doesn't exist
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS payment_method text;

-- Add closed_at column if it doesn't exist
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS closed_at timestamptz;

-- Force schema cache reload (optional, but good practice)
NOTIFY pgrst, 'reload config';
