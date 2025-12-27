-- Adiciona campo enabled à tabela user_profiles para habilitar/desabilitar usuários
-- Execute este SQL no Supabase SQL Editor

-- Adicionar coluna enabled se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'user_profiles' 
        AND column_name = 'enabled'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN enabled BOOLEAN DEFAULT true NOT NULL;
        
        -- Marcar todos os usuários existentes como habilitados
        UPDATE user_profiles SET enabled = true WHERE enabled IS NULL;
    END IF;
END $$;

-- Comentário sobre o uso
COMMENT ON COLUMN user_profiles.enabled IS 'Indica se o usuário está habilitado (true) ou desabilitado (false). Usuários desabilitados não podem fazer login.';

