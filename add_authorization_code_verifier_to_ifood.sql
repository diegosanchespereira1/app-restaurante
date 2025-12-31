-- Add authorization_code_verifier column to ifood_integration table
ALTER TABLE public.ifood_integration 
ADD COLUMN IF NOT EXISTS authorization_code_verifier text;

-- Add comment explaining the field
COMMENT ON COLUMN public.ifood_integration.authorization_code_verifier IS 'Verificador do código de autorização obtido via /oauth/userCode API do iFood';

-- Force schema cache reload
NOTIFY pgrst, 'reload config';

