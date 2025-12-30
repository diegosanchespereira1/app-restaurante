-- Add ifood fields to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS ifood_order_id text;

ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS ifood_status text;

ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual' CHECK (source IN ('manual', 'ifood'));

-- Create index on ifood_order_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_orders_ifood_order_id ON public.orders(ifood_order_id);

-- Create index on source for filtering
CREATE INDEX IF NOT EXISTS idx_orders_source ON public.orders(source);

-- Force schema cache reload
NOTIFY pgrst, 'reload config';

