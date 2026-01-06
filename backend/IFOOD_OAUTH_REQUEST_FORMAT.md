# Formato das Requisições para API oauth/token

Este documento mostra como as requisições estão sendo enviadas para a API `/oauth/token` do iFood.

**Documentação Completa**: Para informações detalhadas sobre autenticação OAuth 2.0, consulte `IFOOD_AUTHENTICATION.md`.

## ⚠️ Importante

A API usa `application/x-www-form-urlencoded` (não JSON), mas aqui mostramos o formato como JSON para facilitar o entendimento. Na prática, os dados são enviados como form data.

**Requisitos de Segurança**:
- Use apenas HTTPS com TLS 1.2 ou superior
- Requisições HTTP serão rejeitadas
- Requisições sem autenticação serão rejeitadas

## Headers

```
Content-Type: application/x-www-form-urlencoded
Accept: application/json
```

**Nota**: O `grantType` é enviado apenas no body, não no header.

## Cenários

### 1. Client Credentials Flow

**Quando**: Não há `refresh_token` nem `authorization_code`

**Body (form-urlencoded)**:
```
grantType=client_credentials
clientId=<client_id>
clientSecret=<client_secret>
```

**Representação JSON** (apenas para visualização):
```json
{
  "grantType": "client_credentials",
  "clientId": "0211ee55-999a-47b5-a453-d47b6c81a5d5",
  "clientSecret": "fqjfdiute4iry4b4po9p1qmm9zobk7aa405k2kzp6ams06zyt1mh80j0s4yyyboqb1ik1j1vsm4wrsudtiyeadwlwqahkry3tm3"
}
```

### 2. Authorization Code Flow

**Quando**: Há `authorization_code` mas não há `refresh_token` ou não há `authorizationCodeVerifier`

**Body (form-urlencoded)**:
```
grantType=authorization_code
clientId=<client_id>
clientSecret=<client_secret>
code=<authorization_code>
authorizationCode=<authorization_code>
refreshToken=<refresh_token> (se disponível)
authorizationCodeVerifier=<verifier> (se disponível)
```

**Representação JSON** (apenas para visualização):
```json
{
  "grantType": "authorization_code",
  "clientId": "0211ee55-999a-47b5-a453-d47b6c81a5d5",
  "clientSecret": "fqjfdiute4iry4b4po9p1qmm9zobk7aa405k2kzp6ams06zyt1mh80j0s4yyyboqb1ik1j1vsm4wrsudtiyeadwlwqahkry3tm3",
  "code": "KQMP-DCSP",
  "authorizationCode": "KQMP-DCSP",
  "refreshToken": "eyJraWQiOiJlZGI4NWY2Mi00ZWY5LTExZTktODY0Ny1kNjYzYmQ4NzNkOTMiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzUxMiJ9...",
  "authorizationCodeVerifier": "1c6qdlj9artsbsyjyff9h29m1s43d0sdjkzedj89u0raam9y3m8crfd9jsl06e297l67lcft3ni451tkzqyy000h1pum9uo13it"
}
```

### 3. Refresh Token Flow

**Quando**: Há `refresh_token` E `authorizationCodeVerifier` disponível

**Body (form-urlencoded)**:
```
grantType=refresh_token
clientId=<client_id>
clientSecret=<client_secret>
refreshToken=<refresh_token>
authorizationCode=<authorization_code> (se disponível)
authorizationCodeVerifier=<verifier> (OBRIGATÓRIO)
```

**Representação JSON** (apenas para visualização):
```json
{
  "grantType": "refresh_token",
  "clientId": "0211ee55-999a-47b5-a453-d47b6c81a5d5",
  "clientSecret": "fqjfdiute4iry4b4po9p1qmm9zobk7aa405k2kzp6ams06zyt1mh80j0s4yyyboqb1ik1j1vsm4wrsudtiyeadwlwqahkry3tm3",
  "refreshToken": "eyJraWQiOiJlZGI4NWY2Mi00ZWY5LTExZTktODY0Ny1kNjYzYmQ4NzNkOTMiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzUxMiJ9.eyJzdWIiOiIwZmNjZTI2NC1lODE0LTQzMDQtODVlNC01YTM5MWNhYmRkYzciLCJpc3MiOiJpRm9vZCIsImV4cCI6MTc2NzcxODE3MiwiaWF0IjoxNzY3MTEzMzcyLCJjbGllbnRfaWQiOiIwMjExZWU1NS05OTlhLTQ3YjUtYTQ1My1kNDdiNmM4MWE1ZDUifQ.Sd6uhzXYfOQojfxCldjXtg-IMcryyPmdRvg4PaS8quayF7r1RcpIGr_sqs1EUY3NhVdnElhIPDGEJpQJQBOK3i8C_3mGirZR7VWaO6WFJel7KYjXgMbtACiL30T_l3vMortPD_97guCdeLMn5HxpERoBAmUb3kOFatwBy_PykKc",
  "authorizationCode": "KQMP-DCSP",
  "authorizationCodeVerifier": "1c6qdlj9artsbsyjyff9h29m1s43d0sdjkzedj89u0raam9y3m8crfd9jsl06e297l67lcft3ni451tkzqyy000h1pum9uo13it"
}
```

## Lógica de Seleção do Grant Type

A lógica atual segue esta ordem de prioridade:

1. **refresh_token**: **PADRÃO** - Usado quando há `refresh_token` disponível (requer `authorizationCodeVerifier`)
2. **authorization_code**: Usado quando há `authorization_code` mas não há `refresh_token`
3. **client_credentials**: Usado quando não há `refresh_token` nem `authorization_code`

**Nota**: `refresh_token` é sempre o padrão quando há um `refresh_token` disponível. Se não houver `authorizationCodeVerifier`, será retornado um erro solicitando que seja obtido via `/api/ifood/user-code`.

## Campos Obrigatórios por Flow

### Client Credentials
- ✅ `grantType`: "client_credentials"
- ✅ `clientId`
- ✅ `clientSecret`

### Authorization Code
- ✅ `grantType`: "authorization_code"
- ✅ `clientId`
- ✅ `clientSecret`
- ✅ `code`: authorization code
- ✅ `authorizationCode`: authorization code (mesmo valor do `code`)
- ⚪ `refreshToken`: opcional (se disponível)
- ⚪ `authorizationCodeVerifier`: opcional (se disponível)

### Refresh Token
- ✅ `grantType`: "refresh_token"
- ✅ `clientId`
- ✅ `clientSecret`
- ✅ `refreshToken`: token de refresh
- ✅ `authorizationCodeVerifier`: **OBRIGATÓRIO** (obtido via `/oauth/userCode`)
- ⚪ `authorizationCode`: opcional (se disponível)

## Exemplo Real (Refresh Token)

Baseado no exemplo fornecido:

```json
{
  "grantType": "refresh_token",
  "clientId": "0211ee55-999a-47b5-a453-d47b6c81a5d5",
  "clientSecret": "fqjfdiute4iry4b4po9p1qmm9zobk7aa405k2kzp6ams06zyt1mh80j0s4yyyboqb1ik1j1vsm4wrsudtiyeadwlwqahkry3tm3",
  "refreshToken": "eyJraWQiOiJlZGI4NWY2Mi00ZWY5LTExZTktODY0Ny1kNjYzYmQ4NzNkOTMiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzUxMiJ9.eyJzdWIiOiIwZmNjZTI2NC1lODE0LTQzMDQtODVlNC01YTM5MWNhYmRkYzciLCJpc3MiOiJpRm9vZCIsImV4cCI6MTc2NzcxODE3MiwiaWF0IjoxNzY3MTEzMzcyLCJjbGllbnRfaWQiOiIwMjExZWU1NS05OTlhLTQ3YjUtYTQ1My1kNDdiNmM4MWE1ZDUifQ.Sd6uhzXYfOQojfxCldjXtg-IMcryyPmdRvg4PaS8quayF7r1RcpIGr_sqs1EUY3NhVdnElhIPDGEJpQJQBOK3i8C_3mGirZR7VWaO6WFJel7KYjXgMbtACiL30T_l3vMortPD_97guCdeLMn5HxpERoBAmUb3kOFatwBy_PykKc",
  "authorizationCode": "KQMP-DCSP",
  "authorizationCodeVerifier": "1c6qdlj9artsbsyjyff9h29m1s43d0sdjkzedj89u0raam9y3m8crfd9jsl06e297l67lcft3ni451tkzqyy000h1pum9uo13it"
}
```

## Formato Real Enviado (URLSearchParams)

Na prática, os dados são enviados como `application/x-www-form-urlencoded`:

```
grantType=refresh_token&clientId=0211ee55-999a-47b5-a453-d47b6c81a5d5&clientSecret=fqjfdiute4iry4b4po9p1qmm9zobk7aa405k2kzp6ams06zyt1mh80j0s4yyyboqb1ik1j1vsm4wrsudtiyeadwlwqahkry3tm3&refreshToken=eyJraWQiOiJlZGI4NWY2Mi00ZWY5LTExZTktODY0Ny1kNjYzYmQ4NzNkOTMiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzUxMiJ9...&authorizationCode=KQMP-DCSP&authorizationCodeVerifier=1c6qdlj9artsbsyjyff9h29m1s43d0sdjkzedj89u0raam9y3m8crfd9jsl06e297l67lcft3ni451tkzqyy000h1pum9uo13it
```

## URL Completa

```
POST https://merchant-api.ifood.com.br/authentication/v1.0/oauth/token
```

## Observações Importantes

1. **grantType no Body**: O `grantType` é enviado apenas no body da requisição, não no header
2. **authorizationCodeVerifier**: É obrigatório quando usar `refresh_token` ou `authorization_code` (obtido via `/oauth/userCode`)
3. **authorizationCode**: Pode estar presente em ambos os flows (`authorization_code` e `refresh_token`)
4. **Formato**: Todos os valores são strings no formato `application/x-www-form-urlencoded`
5. **Tempos de Expiração**: 
   - Token de acesso: 3 horas (padrão)
   - Refresh token: 168 horas / 7 dias (padrão)
   - Código de autorização: 5 minutos (padrão)
   - Código de vínculo: 10 minutos (padrão)
   - ⚠️ **IMPORTANTE**: Implemente renovação baseada no `expiresIn` recebido, não em tempos fixos
6. **Rate Limit**: Evite excesso de solicitações. Não gere um novo token antes da expiração do atual
7. **Status 401**: Indica token expirado. Renove o token quando receber este status

## Referências

- **Documentação Completa de Autenticação**: `IFOOD_AUTHENTICATION.md`
- **Documentação Oficial**: https://developer.ifood.com.br/pt-BR/docs/guides/modules/authentication/
- **API Reference**: https://developer.ifood.com.br/pt-BR/docs/references/#operations-OAuth-oauthTokenV1

