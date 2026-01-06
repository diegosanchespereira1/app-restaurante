# Troubleshooting - Integração iFood

## Referências

- **Documentação Oficial**: https://developer.ifood.com.br/pt-BR/docs/
- **Swagger/API Reference**: https://developer.ifood.com.br/pt-BR/docs/references/#operations-OAuth-oauthTokenV1
- **Referência de API Detalhada**: Veja `IFOOD_API_REFERENCE.md`

## Erro: "Failed to authenticate with iFood"

### Possíveis Causas e Soluções

#### 1. Credenciais Incorretas

**Sintomas:**
- Erro 400 (Bad Request)
- Mensagem: "Credenciais inválidas"

**Solução:**
- Verifique se o **Client ID** está correto (sem espaços extras)
- Verifique se o **Client Secret** está correto (é uma string longa)
- Certifique-se de copiar as credenciais completas do painel do iFood
- Não use credenciais de outro ambiente (sandbox vs produção)

#### 2. Merchant Não Autorizado

**Sintomas:**
- Erro 403 (Forbidden)
- Mensagem: "Acesso negado"

**Solução:**
- Verifique se o **Merchant ID** está correto
- Confirme que o merchant tem permissão para usar a API
- Verifique se há solicitações pendentes no painel do iFood
- Entre em contato com o suporte do iFood se necessário

#### 3. Fluxo de Autenticação Incorreto

**Sintomas:**
- Erro 400 com "Invalid grant type null" ou "invalid_grant"
- Autenticação falha mesmo com credenciais corretas

**Solução:**
- A API do iFood usa **camelCase** para parâmetros:
  - `grantType` (não `grant_type`)
  - `clientId` (não `client_id`)
  - `clientSecret` (não `client_secret`)
  
- O iFood pode usar dois fluxos:
  - **Client Credentials**: Apenas Client ID e Client Secret
    - Documentação: https://developer.ifood.com.br/pt-BR/docs/guides/modules/authentication/centralized
  - **Authorization Code**: Requer Authorization Code além das credenciais
    - Documentação: https://developer.ifood.com.br/pt-BR/docs/guides/modules/authentication/distributed
  
- Se você tem um **Authorization Code** do iFood:
  1. Preencha o campo "Authorization Code" na configuração
  2. O sistema tentará usar o fluxo `authorization_code` automaticamente
  
- Se não tem Authorization Code:
  1. Deixe o campo em branco
  2. O sistema usará o fluxo `client_credentials`

**Referência da API**: https://developer.ifood.com.br/pt-BR/docs/references/#operations-OAuth-oauthTokenV1

#### 4. Problemas de Conexão

**Sintomas:**
- Timeout
- Erro de conexão
- "Não foi possível conectar ao servidor"

**Solução:**
- Verifique sua conexão com a internet
- Verifique se o firewall não está bloqueando
- Tente novamente após alguns instantes
- Verifique se a URL da API do iFood está acessível

#### 5. Rate Limit Excedido

**Sintomas:**
- Erro 429 (Too Many Requests)
- Muitas tentativas de autenticação

**Solução:**
- O endpoint `/oauth/token` permite até 20 requisições por minuto
- Aguarde alguns minutos antes de tentar novamente
- O sistema reutiliza tokens automaticamente para evitar excesso de requisições

#### 6. Token Expirado

**Sintomas:**
- Erro 401 (Unauthorized)
- Funcionava antes, mas parou de funcionar

**Solução:**
- O sistema renova tokens automaticamente
- Se persistir, tente salvar a configuração novamente
- Verifique se as credenciais ainda estão válidas no painel do iFood

### Como Verificar as Credenciais

1. **Acesse o Painel do iFood:**
   - https://developer.ifood.com.br
   - Faça login na sua conta

2. **Verifique as Credenciais:**
   - Vá em "Minhas Aplicações"
   - Selecione sua aplicação
   - Verifique Client ID e Client Secret
   - Copie exatamente como aparecem (sem espaços)

3. **Verifique o Merchant:**
   - Confirme que o Merchant ID está correto
   - Verifique se o merchant está ativo

### Logs para Debug

O sistema agora mostra mensagens de erro mais detalhadas:

1. **No Frontend:**
   - A página de configuração mostra o erro específico
   - Verifique a seção "Erro de Autenticação" no card de status

2. **No Backend (Console):**
   - Logs detalhados são exibidos no console
   - Procure por "iFood authentication error"
   - Verifique o status HTTP e a mensagem de erro

### Teste Rápido

1. Verifique se o backend está rodando:
```bash
cd backend
npm run dev
```

2. Verifique as variáveis de ambiente:
```bash
# No arquivo backend/.env deve ter:
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

3. Tente salvar a configuração novamente:
   - Preencha todos os campos obrigatórios
   - Clique em "Salvar Configuração"
   - Veja a mensagem de erro específica

### Suporte

Se o problema persistir:
1. Verifique os logs do backend
2. Copie a mensagem de erro exata
3. Entre em contato com o suporte do iFood
4. Forneça: Client ID, Merchant ID e mensagem de erro (sem o Client Secret)

