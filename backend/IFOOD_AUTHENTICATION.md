# Autenticação iFood - OAuth 2.0

Este documento contém informações oficiais sobre o processo de autenticação OAuth 2.0 com as APIs do iFood.

## Visão Geral

As APIs do iFood utilizam autenticação OAuth 2.0 com tokens Bearer. Para acessar os recursos da API:

1. Obtenha um token de acesso para seu aplicativo
2. Inclua o token no cabeçalho `Authorization` de cada requisição
3. Use o formato: `Authorization: Bearer YOUR_ACCESS_TOKEN`

## Endpoint de Autenticação

**URL**: `https://merchant-api.ifood.com.br/authentication/v1.0/oauth/token`

**Método**: `POST`

**Headers**:
```
accept: application/json
Content-Type: application/x-www-form-urlencoded
```

**Body (form-urlencoded)**:
```
grantType=client_credentials|authorization_code|refresh_token
clientId=YOUR_CLIENT_ID
clientSecret=YOUR_CLIENT_SECRET
authorizationCode=<opcional - apenas para authorization_code flow>
authorizationCodeVerifier=<opcional - apenas para authorization_code flow>
refreshToken=<opcional - apenas para refresh_token flow>
```

## Exemplo de Requisição (cURL)

```bash
curl --location 'https://merchant-api.ifood.com.br/authentication/v1.0/oauth/token' \
--header 'accept: application/json' \
--header 'Content-Type: application/x-www-form-urlencoded' \
--data-urlencode 'grantType=client_credentials' \
--data-urlencode 'clientId=YOUR_CLIENT_ID' \
--data-urlencode 'clientSecret=YOUR_CLIENT_SECRET' \
--data-urlencode 'authorizationCode=<opcional>' \
--data-urlencode 'authorizationCodeVerifier=<opcional>' \
--data-urlencode 'refreshToken=<opcional>'
```

## Tipos de Grant Type

### 1. client_credentials

Usado para aplicativos centralizados. Não requer código de autorização do usuário.

**Parâmetros obrigatórios**:
- `grantType`: "client_credentials"
- `clientId`: ID do cliente
- `clientSecret`: Secret do cliente

**Quando usar**: Aplicações server-to-server que não precisam de autorização do usuário.

### 2. authorization_code

Usado para aplicativos distribuídos. Requer código de autorização do usuário.

**Parâmetros obrigatórios**:
- `grantType`: "authorization_code"
- `clientId`: ID do cliente
- `clientSecret`: Secret do cliente
- `code`: Código de autorização obtido do usuário
- `authorizationCode`: Código de autorização (mesmo valor do `code`)
- `authorizationCodeVerifier`: Verificador do código (obtido via `/oauth/userCode`)

**Quando usar**: Quando você precisa de autorização explícita do usuário.

### 3. refresh_token

Usado para renovar um token de acesso usando um refresh token existente.

**Parâmetros obrigatórios**:
- `grantType`: "refresh_token"
- `clientId`: ID do cliente
- `clientSecret`: Secret do cliente
- `refreshToken`: Token de refresh obtido em uma autenticação anterior
- `authorizationCodeVerifier`: Verificador do código (OBRIGATÓRIO - obtido via `/oauth/userCode`)

**Parâmetros opcionais**:
- `authorizationCode`: Código de autorização (se disponível)

**Quando usar**: Quando você tem um refresh token válido e precisa renovar o access token.

## Endpoint de User Code

**URL**: `https://merchant-api.ifood.com.br/authentication/v1.0/oauth/userCode`

**Método**: `POST`

**Headers**:
```
accept: application/json
Content-Type: application/x-www-form-urlencoded
```

**Body (form-urlencoded)**:
```
clientId=YOUR_CLIENT_ID
```

**Resposta**:
```json
{
  "authorizationCodeVerifier": "string"
}
```

Este endpoint retorna o `authorizationCodeVerifier` necessário para os flows `authorization_code` e `refresh_token`.

## Requisitos de Segurança

- **HTTPS obrigatório**: Use apenas HTTPS com TLS 1.2 ou superior
- **Rejeição de HTTP**: Requisições HTTP serão rejeitadas
- **Autenticação obrigatória**: Requisições sem autenticação serão rejeitadas

## Tempos de Expiração

**⚠️ IMPORTANTE**: Os tempos de expiração podem mudar. Implemente a renovação de tokens baseada no valor `expiresIn` recebido na resposta da API. Nunca dependa de tempos fixos.

### Tempos Padrão (podem variar)

| Código/Token | Expiração |
|-------------|-----------|
| Token de acesso | 3 horas |
| Refresh token | 168 horas (7 dias) |
| Código de vínculo | 10 minutos |
| Código de autorização | 5 minutos |

### Boas Práticas de Gerenciamento

1. **Agende renovações automáticas**: Baseie-se no `expiresIn` recebido com o `accessToken`
2. **Prepare para 401**: Quando receber status 401, solicite um novo token
3. **Renovação antes da expiração**: Renove tokens antes que expirem (recomendado: buffer de 5 minutos)

## Validade e Renovação

### Tokens Expirados

- **Token de acesso expirado**: Use o `refresh_token` para obter um novo token de acesso
- **Refresh token expirado**: Solicite um novo token completo via API de Autenticação usando `client_credentials` ou `authorization_code`

### Códigos Expirados

- **Código de autorização expirado**: Solicite um novo código de autorização do usuário
- **Código de vínculo expirado**: Solicite um novo código de vínculo

## Identificação de Tokens Expirados

Quando um token de acesso expira, as APIs retornam **status 401**. Este código indica que você deve renovar o token antes de continuar.

## Rate Limit

**⚠️ IMPORTANTE**: Evite excesso de solicitações.

- **Não gere um novo token antes da expiração do atual**
- Solicitações excessivas podem resultar em bloqueio do seu aplicativo
- **Recomendado**: Reutilize tokens até que expirem ou estejam prestes a expirar

## Atualização de Tokens Após Novas Permissões

Quando seu aplicativo receber uma nova permissão de algum merchant, é necessário solicitar um novo `access_token`. Este token incluirá as permissões para todos os merchants autorizados.

### Verificação de Permissões (Opcional)

Para ter certeza que as permissões de acesso ao novo merchant estão válidas:

1. Certifique-se que seu aplicativo tenha permissão no módulo `merchant`
2. Consulte o endpoint de listagem de merchants
3. Verifique se o novo merchant aparece na lista retornada

Esta verificação confirma que seu `access_token` tem as permissões corretas para o merchant recém adicionado.

### Tempo de Propagação de Novas Permissões

Quando uma nova permissão é autorizada/revogada, pode demorar até **10 minutos** para que esse dado seja propagado para toda a plataforma. 

Se o novo merchant ainda não for retornado na listagem:
1. Aguarde 10 minutos
2. Gere um novo `access_token`

## Fluxos de Autenticação

### Fluxo para Aplicativos Centralizados

Consulte: https://developer.ifood.com.br/pt-BR/docs/guides/modules/authentication/centralized

### Fluxo para Aplicativos Distribuídos

Consulte: https://developer.ifood.com.br/pt-BR/docs/guides/modules/authentication/distributed

Para mais informações sobre aplicativos centralizados ou distribuídos, consulte a [documentação oficial](https://developer.ifood.com.br/pt-BR/docs/).

## Implementação no Projeto

### Código

- **Serviço**: `backend/src/services/ifood-service.ts`
- **Métodos principais**:
  - `authenticate()` - Autenticação e obtenção de tokens
  - `getUserCodeVerifier()` - Obtenção do authorization code verifier
  - `ensureAuthenticated()` - Garantir autenticação válida

### Endpoints da API Backend

- `POST /api/ifood/config` - Configurar credenciais e autenticar
- `POST /api/ifood/user-code` - Obter authorization code verifier

## Resposta da API

### Sucesso

```json
{
  "accessToken": "string",
  "expiresIn": 10800,
  "refreshToken": "string",
  "tokenType": "Bearer"
}
```

**Campos**:
- `accessToken`: Token de acesso (usar no header `Authorization: Bearer <token>`)
- `expiresIn`: Tempo de expiração em segundos (padrão: 10800 = 3 horas)
- `refreshToken`: Token para renovação (padrão: válido por 168 horas = 7 dias)
- `tokenType`: Tipo do token (sempre "Bearer")

### Erro

```json
{
  "error": "string",
  "error_description": "string"
}
```

**Códigos de erro comuns**:
- `400`: Requisição inválida (parâmetros faltando ou incorretos)
- `401`: Token expirado ou inválido
- `403`: Acesso negado (sem permissão)
- `429`: Rate limit excedido

## Observações Importantes

1. **Formato dos Parâmetros**: Use `camelCase` (ex: `grantType`, `clientId`, `clientSecret`)
2. **Content-Type**: Sempre use `application/x-www-form-urlencoded` para requisições de autenticação
3. **grantType**: Enviado apenas no body, NÃO no header
4. **authorizationCodeVerifier**: Obrigatório para flows `refresh_token` e `authorization_code`
5. **Renovação automática**: Implemente renovação automática baseada em `expiresIn`
6. **Reutilização**: Reutilize tokens até que expirem para evitar rate limit

## Referências

- **Documentação Oficial de Autenticação**: https://developer.ifood.com.br/pt-BR/docs/guides/modules/authentication/
- **Fluxo Centralizado**: https://developer.ifood.com.br/pt-BR/docs/guides/modules/authentication/centralized
- **Fluxo Distribuído**: https://developer.ifood.com.br/pt-BR/docs/guides/modules/authentication/distributed
- **API Reference**: https://developer.ifood.com.br/pt-BR/docs/references/#operations-OAuth-oauthTokenV1



