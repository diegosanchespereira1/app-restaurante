-- Add ifood_display_id field to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS ifood_display_id text;

-- Create index on ifood_display_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_orders_ifood_display_id ON public.orders(ifood_display_id);

-- Force schema cache reload
NOTIFY pgrst, 'reload config';

