-- Script para corrigir políticas RLS e evitar recursão infinita
-- Execute no SQL Editor do Supabase

-- ============================================
-- 1. REMOVER POLÍTICAS PROBLEMÁTICAS
-- ============================================
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;

-- ============================================
-- 2. CRIAR FUNÇÃO HELPER PARA VERIFICAR ROLE
-- ============================================
-- Esta função bypassa RLS para verificar o role
CREATE OR REPLACE FUNCTION public.get_user_role(user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  user_role text;
BEGIN
  SELECT role INTO user_role
  FROM user_profiles
  WHERE id = user_id;
  
  RETURN COALESCE(user_role, 'usuario');
END;
$$;

-- ============================================
-- 3. CRIAR POLÍTICAS CORRIGIDAS
-- ============================================

-- Policy: Usuários podem ver seu próprio perfil
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Policy: Usuários podem inserir seu próprio perfil
CREATE POLICY "Users can insert own profile" ON user_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Policy: Usuários podem atualizar seu próprio perfil
-- Nota: A restrição de não mudar role será feita via trigger ou aplicação
CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Policy: Admins podem fazer tudo (usando função para evitar recursão)
CREATE POLICY "Admins can manage all profiles" ON user_profiles
  FOR ALL
  USING (public.get_user_role(auth.uid()) = 'admin')
  WITH CHECK (public.get_user_role(auth.uid()) = 'admin');

-- ============================================
-- 4. CRIAR TRIGGER PARA PREVENIR MUDANÇA DE ROLE
-- ============================================
-- Trigger para prevenir que usuários não-admin mudem seu próprio role
CREATE OR REPLACE FUNCTION public.prevent_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Se o role está sendo mudado
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    -- Verificar se o usuário é admin
    IF public.get_user_role(auth.uid()) != 'admin' THEN
      -- Não permitir mudança de role para não-admins
      RAISE EXCEPTION 'Apenas administradores podem alterar roles';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS prevent_role_change_trigger ON user_profiles;

-- Create trigger
CREATE TRIGGER prevent_role_change_trigger
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_role_change();

-- ============================================
-- 5. VERIFICAR POLÍTICAS CRIADAS
-- ============================================
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'user_profiles'
ORDER BY policyname;

