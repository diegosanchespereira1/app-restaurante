-- Scripts SQL úteis para atualizar perfis de usuários
-- Execute no SQL Editor do Supabase

-- ============================================
-- 1. LISTAR TODOS OS USUÁRIOS E PERFIS
-- ============================================
SELECT 
  u.id,
  u.email,
  p.username,
  p.full_name,
  p.role,
  u.created_at as user_created,
  p.updated_at as profile_updated
FROM auth.users u
LEFT JOIN user_profiles p ON u.id = p.id
ORDER BY u.created_at DESC;

-- ============================================
-- 2. ATUALIZAR PERFIL POR EMAIL
-- ============================================
-- Substitua 'usuario@example.com' pelo email do usuário
UPDATE user_profiles
SET 
  full_name = 'Nome Completo',
  username = 'nomeusuario',
  role = 'admin'  -- 'admin', 'gerente' ou 'usuario'
WHERE email = 'usuario@example.com';

-- ============================================
-- 3. ATUALIZAR APENAS O ROLE
-- ============================================
UPDATE user_profiles
SET role = 'gerente'
WHERE email = 'usuario@example.com';

-- ============================================
-- 4. ATUALIZAR APENAS O USERNAME
-- ============================================
UPDATE user_profiles
SET username = 'novousername'
WHERE email = 'usuario@example.com';

-- ============================================
-- 5. ATUALIZAR APENAS O NOME
-- ============================================
UPDATE user_profiles
SET full_name = 'Novo Nome'
WHERE email = 'usuario@example.com';

-- ============================================
-- 6. CRIAR PERFIL PARA USUÁRIO QUE NÃO TEM
-- ============================================
-- Substitua 'uuid-do-usuario' pelo ID do usuário
INSERT INTO user_profiles (id, email, username, full_name, role)
SELECT 
  id,
  email,
  'username_padrao',
  'Nome Completo',
  'usuario'
FROM auth.users
WHERE id = 'uuid-do-usuario'
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 7. BUSCAR USUÁRIO POR EMAIL OU USERNAME
-- ============================================
SELECT *
FROM user_profiles
WHERE email = 'usuario@example.com'
   OR username = 'nomeusuario';

-- ============================================
-- 8. LISTAR APENAS ADMINS
-- ============================================
SELECT email, username, full_name, role
FROM user_profiles
WHERE role = 'admin';

-- ============================================
-- 9. LISTAR APENAS GERENTES
-- ============================================
SELECT email, username, full_name, role
FROM user_profiles
WHERE role = 'gerente';

-- ============================================
-- 10. TORNAR PRIMEIRO USUÁRIO ADMIN
-- ============================================
UPDATE user_profiles
SET role = 'admin'
WHERE id = (
  SELECT id FROM user_profiles 
  ORDER BY created_at ASC 
  LIMIT 1
);

-- ============================================
-- 11. VERIFICAR USUÁRIOS SEM PERFIL
-- ============================================
SELECT u.id, u.email, u.created_at
FROM auth.users u
LEFT JOIN user_profiles p ON u.id = p.id
WHERE p.id IS NULL;

-- ============================================
-- 12. ATUALIZAR EMAIL NO PERFIL (se mudou no auth.users)
-- ============================================
UPDATE user_profiles
SET email = (
  SELECT email FROM auth.users WHERE id = user_profiles.id
)
WHERE email != (
  SELECT email FROM auth.users WHERE id = user_profiles.id
);

