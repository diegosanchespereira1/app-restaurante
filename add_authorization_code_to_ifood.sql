-- Add authorization_code column to ifood_integration table
ALTER TABLE public.ifood_integration 
ADD COLUMN IF NOT EXISTS authorization_code text;

-- Add comment explaining the field
COMMENT ON COLUMN public.ifood_integration.authorization_code IS 'Código de autorização do iFood usado no fluxo OAuth';

-- Force schema cache reload
NOTIFY pgrst, 'reload config';

