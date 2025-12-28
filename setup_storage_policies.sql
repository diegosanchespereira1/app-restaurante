-- ============================================
-- CONFIGURAÇÃO DO BUCKET DE IMAGENS
-- ============================================
-- Execute este script no SQL Editor do Supabase Dashboard
-- Dashboard > SQL Editor > New Query > Cole este script > Run

-- PASSO 1: Criar o bucket (faça isso manualmente no Dashboard primeiro)
-- 1. Vá para Storage > Buckets
-- 2. Clique em "New bucket"
-- 3. Nome: "product-images"
-- 4. Marque "Public bucket" (para permitir acesso público às imagens)
-- 5. Clique em "Create bucket"

-- PASSO 2: Executar este script para criar as políticas RLS

-- Remover políticas antigas se existirem (opcional, mas recomendado)
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Permitir upload de imagens para usuários autenticados" ON storage.objects;
    DROP POLICY IF EXISTS "Permitir leitura pública de imagens" ON storage.objects;
    DROP POLICY IF EXISTS "Permitir atualização de imagens para usuários autenticados" ON storage.objects;
    DROP POLICY IF EXISTS "Permitir exclusão de imagens para usuários autenticados" ON storage.objects;
EXCEPTION 
    WHEN undefined_object THEN NULL;
END $$;

-- Política para INSERT (upload de arquivos)
-- Permite que usuários autenticados façam upload de imagens
CREATE POLICY "Permitir upload de imagens para usuários autenticados"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-images');

-- Política para SELECT (leitura/download de arquivos)
-- Permite acesso público para leitura de imagens
CREATE POLICY "Permitir leitura pública de imagens"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'product-images');

-- Política para UPDATE (atualização de arquivos)
-- Permite que usuários autenticados atualizem imagens
CREATE POLICY "Permitir atualização de imagens para usuários autenticados"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'product-images')
WITH CHECK (bucket_id = 'product-images');

-- Política para DELETE (exclusão de arquivos)
-- Permite que usuários autenticados excluam imagens
CREATE POLICY "Permitir exclusão de imagens para usuários autenticados"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'product-images');

