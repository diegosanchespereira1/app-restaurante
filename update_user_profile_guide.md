# Como Atualizar o Perfil de um Usuário no Supabase

Existem várias formas de atualizar o perfil de um usuário no Supabase. Aqui estão as principais:

## Método 1: Através do SQL Editor (Recomendado)

### 1.1. Atualizar por Email

```sql
-- Atualizar perfil por email
UPDATE user_profiles
SET 
  full_name = 'Novo Nome',
  username = 'novousername',
  role = 'admin'  -- ou 'gerente' ou 'usuario'
WHERE email = 'usuario@example.com';
```

### 1.2. Atualizar por ID do Usuário

Primeiro, encontre o ID do usuário:

```sql
-- Listar todos os usuários e seus perfis
SELECT 
  u.id,
  u.email,
  p.username,
  p.full_name,
  p.role
FROM auth.users u
LEFT JOIN user_profiles p ON u.id = p.id
ORDER BY u.created_at DESC;
```

Depois, atualize pelo ID:

```sql
-- Atualizar perfil por ID
UPDATE user_profiles
SET 
  full_name = 'Novo Nome',
  username = 'novousername',
  role = 'gerente'
WHERE id = 'uuid-do-usuario-aqui';
```

### 1.3. Atualizar apenas o Role

```sql
-- Mudar role de um usuário para admin
UPDATE user_profiles
SET role = 'admin'
WHERE email = 'usuario@example.com';
```

### 1.4. Atualizar apenas o Username

```sql
-- Atualizar username
UPDATE user_profiles
SET username = 'novousername'
WHERE email = 'usuario@example.com';
```

## Método 2: Através do Table Editor (Interface Gráfica)

1. Acesse o **Supabase Dashboard**
2. Vá em **Table Editor** no menu lateral
3. Selecione a tabela **`user_profiles`**
4. Encontre o usuário que deseja editar (use o filtro de busca)
5. Clique no registro para editar
6. Modifique os campos desejados:
   - `full_name`: Nome completo
   - `username`: Nome de usuário
   - `role`: admin, gerente ou usuario
7. Clique em **Save** para salvar

## Método 3: Através do Authentication (Apenas Email)

Para alterar o email do usuário:

1. Acesse **Authentication** > **Users**
2. Encontre o usuário
3. Clique nos três pontos (...) ao lado do usuário
4. Selecione **Edit user**
5. Altere o email
6. Salve

**Nota:** Alterar o email aqui não atualiza automaticamente o `user_profiles`. Você precisará atualizar manualmente:

```sql
UPDATE user_profiles
SET email = 'novo@email.com'
WHERE id = 'uuid-do-usuario';
```

## Método 4: Criar/Atualizar Perfil para Usuário Existente

Se um usuário já existe em `auth.users` mas não tem perfil em `user_profiles`:

```sql
-- Criar perfil para usuário existente
INSERT INTO user_profiles (id, email, username, full_name, role)
SELECT 
  id,
  email,
  'username_padrao',
  'Nome Completo',
  'usuario'
FROM auth.users
WHERE id = 'uuid-do-usuario'
ON CONFLICT (id) DO UPDATE
SET 
  username = EXCLUDED.username,
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role;
```

## Exemplos Práticos

### Exemplo 1: Tornar um usuário Admin

```sql
UPDATE user_profiles
SET role = 'admin'
WHERE email = 'admin@restaurante.com';
```

### Exemplo 2: Atualizar múltiplos campos

```sql
UPDATE user_profiles
SET 
  full_name = 'João Silva',
  username = 'joaosilva',
  role = 'gerente'
WHERE email = 'joao@restaurante.com';
```

### Exemplo 3: Listar todos os perfis

```sql
SELECT 
  id,
  email,
  username,
  full_name,
  role,
  created_at,
  updated_at
FROM user_profiles
ORDER BY created_at DESC;
```

### Exemplo 4: Buscar usuário específico

```sql
SELECT *
FROM user_profiles
WHERE email = 'usuario@example.com'
   OR username = 'nomeusuario';
```

## Verificando Mudanças

Após atualizar, você pode verificar se as mudanças foram aplicadas:

```sql
-- Ver perfil atualizado
SELECT * FROM user_profiles WHERE email = 'usuario@example.com';
```

## Importante

1. **Role**: Só pode ser 'admin', 'gerente' ou 'usuario'
2. **Username**: Deve ser único (não pode haver dois usuários com o mesmo username)
3. **ID**: Não pode ser alterado (é a chave primária que referencia auth.users)
4. **Email**: Se alterar no auth.users, atualize também no user_profiles
5. **RLS Policies**: As políticas de segurança podem impedir atualizações. Admins podem atualizar qualquer perfil.

## Troubleshooting

### Erro: "permission denied"
- Você precisa ser admin ou o próprio usuário para atualizar
- Admins podem atualizar qualquer perfil
- Usuários só podem atualizar seu próprio perfil (exceto role)

### Erro: "duplicate key value violates unique constraint"
- O username já está em uso por outro usuário
- Escolha um username diferente

### Perfil não aparece na aplicação
- Use a função `refreshProfile()` no código
- Ou faça logout e login novamente
- Ou recarregue a página (F5)






