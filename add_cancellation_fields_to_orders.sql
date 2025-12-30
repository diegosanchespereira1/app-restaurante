-- Add cancellation_reason column to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS cancellation_reason text;

-- Force schema cache reload
NOTIFY pgrst, 'reload config';

