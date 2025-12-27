-- Script para criar perfis para usuários que não têm perfil
-- Execute no SQL Editor do Supabase

-- ============================================
-- 1. VERIFICAR USUÁRIOS SEM PERFIL
-- ============================================
SELECT 
  u.id,
  u.email,
  u.created_at as user_created
FROM auth.users u
LEFT JOIN user_profiles p ON u.id = p.id
WHERE p.id IS NULL
ORDER BY u.created_at DESC;

-- ============================================
-- 2. CRIAR PERFIS PARA TODOS OS USUÁRIOS SEM PERFIL
-- ============================================
INSERT INTO user_profiles (id, email, username, full_name, role)
SELECT 
  u.id,
  u.email,
  SPLIT_PART(u.email, '@', 1) as username,
  COALESCE(u.raw_user_meta_data->>'full_name', '') as full_name,
  'usuario'::text as role  -- Always default to non-privileged role; admin roles must be assigned separately
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM user_profiles p WHERE p.id = u.id
)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 3. VERIFICAR RESULTADO
-- ============================================
SELECT 
  u.id,
  u.email,
  p.username,
  p.full_name,
  p.role,
  CASE 
    WHEN p.id IS NULL THEN 'SEM PERFIL'
    ELSE 'OK'
  END as status
FROM auth.users u
LEFT JOIN user_profiles p ON u.id = p.id
ORDER BY u.created_at DESC;

-- ============================================
-- 4. CRIAR PERFIL PARA USUÁRIO ESPECÍFICO
-- ============================================
-- Substitua 'usuario@example.com' pelo email
INSERT INTO user_profiles (id, email, username, full_name, role)
SELECT 
  u.id,
  u.email,
  SPLIT_PART(u.email, '@', 1) as username,
  'Nome Completo' as full_name,
  'usuario' as role
FROM auth.users u
WHERE u.email = 'usuario@example.com'
  AND NOT EXISTS (
    SELECT 1 FROM user_profiles p WHERE p.id = u.id
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 5. CRIAR PERFIL ADMIN PARA USUÁRIO ESPECÍFICO
-- ============================================
-- Substitua 'admin@example.com' pelo email
INSERT INTO user_profiles (id, email, username, full_name, role)
SELECT 
  u.id,
  u.email,
  SPLIT_PART(u.email, '@', 1) as username,
  'Admin User' as full_name,
  'admin' as role
FROM auth.users u
WHERE u.email = 'admin@example.com'
  AND NOT EXISTS (
    SELECT 1 FROM user_profiles p WHERE p.id = u.id
  )
ON CONFLICT (id) DO UPDATE
SET role = 'admin';



