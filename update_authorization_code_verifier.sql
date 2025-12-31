-- Update authorization_code_verifier with the provided value
-- Execute this script after running add_authorization_code_verifier_to_ifood.sql
-- Replace the WHERE clause if you need to update a specific record

UPDATE public.ifood_integration 
SET authorization_code_verifier = '1c6qdlj9artsbsyjyff9h29m1s43d0sdjkzedj89u0raam9y3m8crfd9jsl06e297l67lcft3ni451tkzqyy000h1pum9uo13it'
WHERE authorization_code_verifier IS NULL OR authorization_code_verifier = '';

-- Or update a specific record by merchant_id (uncomment and adjust as needed):
-- UPDATE public.ifood_integration 
-- SET authorization_code_verifier = '1c6qdlj9artsbsyjyff9h29m1s43d0sdjkzedj89u0raam9y3m8crfd9jsl06e297l67lcft3ni451tkzqyy000h1pum9uo13it'
-- WHERE merchant_id = 'YOUR_MERCHANT_ID';

-- Force schema cache reload
NOTIFY pgrst, 'reload config';

