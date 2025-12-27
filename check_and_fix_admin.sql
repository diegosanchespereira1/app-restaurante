-- Script para verificar e corrigir o role do admin
-- Execute no SQL Editor do Supabase

-- ============================================
-- 1. VERIFICAR TODOS OS PERFIS E SEUS ROLES
-- ============================================
SELECT 
  id,
  email,
  username,
  full_name,
  role,
  LOWER(role) as role_lowercase,
  created_at
FROM user_profiles
ORDER BY created_at DESC;

-- ============================================
-- 2. VERIFICAR SE HÁ ROLES COM MAIÚSCULAS
-- ============================================
SELECT 
  email,
  role,
  CASE 
    WHEN role != LOWER(role) THEN 'TEM MAIÚSCULAS'
    ELSE 'OK'
  END as status
FROM user_profiles
WHERE role != LOWER(role);

-- ============================================
-- 3. CORRIGIR ROLES PARA MINÚSCULAS
-- ============================================
UPDATE user_profiles
SET role = LOWER(role)
WHERE role != LOWER(role);

-- ============================================
-- 4. TORNAR UM USUÁRIO ESPECÍFICO ADMIN
-- ============================================
-- Substitua 'usuario@example.com' pelo email do usuário
UPDATE user_profiles
SET role = 'admin'
WHERE email = 'usuario@example.com';

-- ============================================
-- 5. VERIFICAR SE O USUÁRIO TEM PERFIL
-- ============================================
-- Se o usuário não aparecer na lista acima, pode não ter perfil
-- Execute este comando para ver usuários sem perfil:
SELECT 
  u.id,
  u.email,
  u.created_at
FROM auth.users u
LEFT JOIN user_profiles p ON u.id = p.id
WHERE p.id IS NULL;

-- ============================================
-- 6. CRIAR PERFIL ADMIN PARA USUÁRIO EXISTENTE
-- ============================================
-- Substitua 'usuario@example.com' pelo email
INSERT INTO user_profiles (id, email, username, full_name, role)
SELECT 
  u.id,
  u.email,
  SPLIT_PART(u.email, '@', 1) as username,
  'Admin User' as full_name,
  'admin' as role
FROM auth.users u
WHERE u.email = 'usuario@example.com'
  AND NOT EXISTS (
    SELECT 1 FROM user_profiles p WHERE p.id = u.id
  )
ON CONFLICT (id) DO UPDATE
SET role = 'admin';

-- ============================================
-- 7. LISTAR APENAS ADMINS
-- ============================================
SELECT 
  email,
  username,
  full_name,
  role
FROM user_profiles
WHERE LOWER(role) = 'admin';



