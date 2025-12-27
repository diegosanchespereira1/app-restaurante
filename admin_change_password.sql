-- Função SQL para alterar senha de usuário
-- Esta função deve ser executada no Supabase Dashboard > SQL Editor
-- IMPORTANTE: Esta função NÃO funciona sem Service Role Key configurado no frontend

-- Função para alterar senha do usuário (REQUER Service Role Key)
CREATE OR REPLACE FUNCTION admin_change_user_password(
    target_user_id UUID,
    new_password TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $
DECLARE
    current_user_role TEXT;
    result JSON;
BEGIN
    -- Verificar se o usuário atual está autenticado
    IF auth.uid() IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Usuário não autenticado'
        );
    END IF;

    -- Verificar se o usuário atual tem permissão de admin
    SELECT role INTO current_user_role
    FROM user_profiles 
    WHERE id = auth.uid();
    
    IF current_user_role IS NULL OR current_user_role != 'admin' THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Acesso negado. Apenas administradores podem alterar senhas.'
        );
    END IF;

    -- Verificar se o usuário alvo existe
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = target_user_id) THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Usuário não encontrado'
        );
    END IF;

    -- ATENÇÃO: Esta função não pode alterar senhas diretamente
    -- É necessário usar a API administrativa do Supabase
    -- com Service Role Key configurada no frontend
    
    RETURN json_build_object(
        'success', false,
        'error', 'Esta função requer Service Role Key configurada no frontend. Use a função changeUserPassword() do TypeScript.'
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$;

-- Permissões para a função
GRANT EXECUTE ON FUNCTION admin_change_user_password(UUID, TEXT) TO authenticated;

-- Função para listar usuários (auxiliar)
CREATE OR REPLACE FUNCTION admin_list_users()
RETURNS TABLE (
    id UUID,
    email TEXT,
    username TEXT,
    full_name TEXT,
    role TEXT,
    enabled BOOLEAN,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Verificar se o usuário tem permissão de admin
    IF NOT EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE id = auth.uid() 
        AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Acesso negado. Apenas administradores podem listar usuários.';
    END IF;

    RETURN QUERY
    SELECT 
        up.id,
        up.email,
        up.username,
        up.full_name,
        up.role,
        COALESCE((up).enabled, true) as enabled,
        up.created_at,
        up.updated_at
    FROM user_profiles up
    ORDER BY up.created_at DESC;
END;
$$;

-- Permissões
GRANT EXECUTE ON FUNCTION admin_list_users() TO authenticated;