-- Fix: Permite que admins criem perfis de usuários
-- Execute este SQL no Supabase SQL Editor

-- Função para permitir admins inserir perfis de outros usuários
CREATE OR REPLACE FUNCTION public.admin_insert_user_profile(
    target_user_id uuid,
    target_email text,
    target_username text,
    target_full_name text,
    target_role text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Verificar se o usuário atual é admin
    IF NOT EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE id = auth.uid() AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Apenas administradores podem criar perfis de usuários';
    END IF;
    
    -- Inserir ou atualizar perfil
    INSERT INTO user_profiles (id, email, username, full_name, role)
    VALUES (target_user_id, target_email, target_username, target_full_name, target_role)
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        username = EXCLUDED.username,
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role;
END;
$$;

-- Função para permitir admins atualizar perfis de outros usuários (incluindo role)
CREATE OR REPLACE FUNCTION public.admin_update_user_profile(
    target_user_id uuid,
    target_email text,
    target_username text,
    target_full_name text,
    target_role text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Verificar se o usuário atual é admin
    IF NOT EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE id = auth.uid() AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Apenas administradores podem atualizar perfis de usuários';
    END IF;
    
    -- Atualizar perfil
    UPDATE user_profiles SET
        email = target_email,
        username = target_username,
        full_name = target_full_name,
        role = target_role,
        updated_at = now()
    WHERE id = target_user_id;
END;
$$;

-- Comentários
COMMENT ON FUNCTION public.admin_insert_user_profile IS 'Permite que administradores criem perfis de usuários, bypassando RLS';
COMMENT ON FUNCTION public.admin_update_user_profile IS 'Permite que administradores atualizem perfis de usuários, incluindo role';

