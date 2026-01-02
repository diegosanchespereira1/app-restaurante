# Referência da API do iFood

Este documento contém referências à documentação oficial da API do iFood e como ela é implementada neste projeto.

## Documentação Oficial

A documentação completa da API do iFood está disponível em:
- **Swagger/Referência de API**: https://developer.ifood.com.br/pt-BR/docs/references/
- **Guia de Documentação**: https://developer.ifood.com.br/pt-BR/docs/guides/

## Endpoints Principais

### Autenticação OAuth

**Endpoint**: `POST /authentication/v1.0/oauth/token`

**Documentação**: https://developer.ifood.com.br/pt-BR/docs/references/#operations-OAuth-oauthTokenV1

**Documentação Completa**: Veja `IFOOD_AUTHENTICATION.md` para informações detalhadas sobre autenticação OAuth 2.0

**Parâmetros (camelCase, form-urlencoded)**:
- `grantType`: Tipo de fluxo (`client_credentials`, `authorization_code`, ou `refresh_token`)
- `clientId`: ID do cliente (obrigatório)
- `clientSecret`: Secret do cliente (obrigatório)
- `code`: Código de autorização (apenas para fluxo `authorization_code`)
- `authorizationCode`: Código de autorização (apenas para fluxos `authorization_code` e `refresh_token`)
- `authorizationCodeVerifier`: Verificador do código (obrigatório para `authorization_code` e `refresh_token`, obtido via `/oauth/userCode`)
- `refreshToken`: Token de refresh (apenas para fluxo `refresh_token`)

**Headers**:
- `Content-Type: application/x-www-form-urlencoded`
- `accept: application/json`

**Exemplo de requisição (client_credentials)**:
```bash
curl --location 'https://merchant-api.ifood.com.br/authentication/v1.0/oauth/token' \
--header 'accept: application/json' \
--header 'Content-Type: application/x-www-form-urlencoded' \
--data-urlencode 'grantType=client_credentials' \
--data-urlencode 'clientId=SEU_CLIENT_ID' \
--data-urlencode 'clientSecret=SEU_CLIENT_SECRET'
```

**Exemplo de requisição (refresh_token)**:
```bash
curl --location 'https://merchant-api.ifood.com.br/authentication/v1.0/oauth/token' \
--header 'accept: application/json' \
--header 'Content-Type: application/x-www-form-urlencoded' \
--data-urlencode 'grantType=refresh_token' \
--data-urlencode 'clientId=SEU_CLIENT_ID' \
--data-urlencode 'clientSecret=SEU_CLIENT_SECRET' \
--data-urlencode 'refreshToken=SEU_REFRESH_TOKEN' \
--data-urlencode 'authorizationCodeVerifier=SEU_VERIFIER'
```

### User Code (Authorization Code Verifier)

**Endpoint**: `POST /authentication/v1.0/oauth/userCode`

**Documentação**: Consultar documentação oficial do iFood

**Parâmetros (form-urlencoded)**:
- `clientId`: ID do cliente (obrigatório)

**Headers**:
- `Content-Type: application/x-www-form-urlencoded`
- `accept: application/json`

**Resposta**:
```json
{
  "authorizationCodeVerifier": "string"
}
```

**Implementação no projeto**: 
- `backend/src/services/ifood-service.ts` - método `authenticate()` e `getUserCodeVerifier()`
- `backend/src/routes/ifood.ts` - endpoint `POST /api/ifood/user-code`

### Pedidos

#### Buscar Pedidos

**Endpoint**: `GET /order/v1.0/events/orders:{status}`

**Documentação**: https://developer.ifood.com.br/pt-BR/docs/references/#operations-Order-getOrders

**Parâmetros**:
- `status`: Status do pedido (ex: `PLACED`, `CONFIRMED`, etc.)

**Implementação no projeto**: `backend/src/services/ifood-service.ts` - método `getOrders()`

#### Detalhes do Pedido

**Endpoint**: `GET /merchants/{merchantId}/orders/{orderId}`

**Documentação**: https://developer.ifood.com.br/pt-BR/docs/references/#operations-Order-getOrderDetails

**Implementação no projeto**: `backend/src/services/ifood-service.ts` - método `getOrderDetails()`

#### Atualizar Status do Pedido

**Endpoint Principal**: `PATCH /merchants/{merchantId}/orders/{orderId}/status`

**Endpoint Alternativo** (fallback): `PATCH /order/v1.0/orders/{orderId}/status`

**Payload**:
```json
{
  "status": "CONFIRMED" | "CANCELLED" | "PREPARATION_STARTED" | "READY_TO_PICKUP" | "DISPATCHED" | "CONCLUDED"
}
```

**Status Possíveis**:
- `CONFIRMED` (CFM): Pedido foi confirmado e será preparado
- `CANCELLED` (CAN): Pedido foi cancelado  
- `PREPARATION_STARTED` (PRS): Pedido começou a ser preparado
- `READY_TO_PICKUP` (RTP): Pedido está pronto para retirada
- `DISPATCHED` (DSP): Pedido saiu para entrega
- `CONCLUDED` (CON): Pedido foi concluído

**Respostas**:
- **200**: Status atualizado com sucesso (síncrono)
- **202**: Operação assíncrona - aguardar evento de confirmação no polling
- **404**: Pedido não encontrado ou rota inválida
- **500**: Erro interno do servidor

**Documentação**: 
- https://developer.ifood.com.br/pt-BR/docs/references/#operations-Order-updateOrderStatus
- https://developer.ifood.com.br/pt-BR/docs/guides/modules/order/events/?category=FOOD

**Implementação no projeto**: `backend/src/services/ifood-service.ts` - método `updateOrderStatus()`

**Nota**: A implementação tenta primeiro o formato `/merchants/{merchantId}/orders/{orderId}/status` e, se falhar com 404 ou erro de rota, tenta automaticamente o formato alternativo `/order/v1.0/orders/{orderId}/status`.

### Produtos

**Endpoint**: `GET /merchants/{merchantId}/catalog/products`

**Documentação**: https://developer.ifood.com.br/pt-BR/docs/references/#operations-Catalog-getProducts

**Implementação no projeto**: `backend/src/services/ifood-service.ts` - método `getProducts()`

## Fluxos de Autenticação

Para informações completas sobre autenticação, consulte `IFOOD_AUTHENTICATION.md`.

### Client Credentials (Aplicativos Centralizados)

**Documentação**: https://developer.ifood.com.br/pt-BR/docs/guides/modules/authentication/centralized

Usado quando você tem apenas `clientId` e `clientSecret`. É o fluxo padrão para integrações server-to-server.

**Parâmetros necessários**:
- `grantType: "client_credentials"`
- `clientId`
- `clientSecret`

### Authorization Code (Aplicativos Distribuídos)

**Documentação**: https://developer.ifood.com.br/pt-BR/docs/guides/modules/authentication/distributed

Usado quando você precisa de um código de autorização do usuário.

**Parâmetros necessários**:
- `grantType: "authorization_code"`
- `clientId`
- `clientSecret`
- `code`: Código de autorização obtido do usuário
- `authorizationCode`: Código de autorização (mesmo valor do `code`)
- `authorizationCodeVerifier`: Verificador do código (obtido via `/oauth/userCode`)

### Refresh Token

Usado para renovar um token de acesso usando um refresh token existente.

**Parâmetros necessários**:
- `grantType: "refresh_token"`
- `clientId`
- `clientSecret`
- `refreshToken`: Token de refresh obtido em uma autenticação anterior
- `authorizationCodeVerifier`: Verificador do código (OBRIGATÓRIO - obtido via `/oauth/userCode`)

**Parâmetros opcionais**:
- `authorizationCode`: Código de autorização (se disponível)

## Status dos Pedidos

Referência completa: https://developer.ifood.com.br/pt-BR/docs/guides/modules/order/status

- **PLACED (PLC)**: Novo pedido na plataforma
- **CONFIRMED (CFM)**: Pedido foi confirmado e será preparado
- **SEPARATION_STARTED (SPS)**: Início do processo de separação (Mercado)
- **SEPARATION_ENDED (SPE)**: Conclusão da separação (Mercado)
- **READY_TO_PICKUP (RTP)**: Pedido está pronto para ser retirado
- **DISPATCHED (DSP)**: Pedido saiu para entrega (Delivery)
- **CONCLUDED (CON)**: Pedido foi concluído
- **CANCELLED (CAN)**: Pedido foi cancelado

## Rate Limits

Todos os endpoints têm limites de requisições por período. Consulte a documentação oficial para limites específicos.

**⚠️ IMPORTANTE para Autenticação**: 
- Evite excesso de solicitações. Não gere um novo token antes da expiração do atual.
- Solicitações excessivas podem resultar em bloqueio do seu aplicativo.
- Reutilize tokens até que expirem ou estejam prestes a expirar.

## Boas Práticas

Consulte também:
- `IFOOD_AUTHENTICATION.md` - Documentação completa sobre autenticação OAuth 2.0
- `IFOOD_BEST_PRACTICES.md` - Práticas recomendadas pelo iFood
- `TROUBLESHOOTING_IFOOD.md` - Guia de resolução de problemas

## Categoria FOOD

Este projeto é configurado para a categoria **FOOD** (Restaurantes).

**Documentação da Categoria FOOD**: https://developer.ifood.com.br/pt-BR/docs/categories/?category=FOOD

Para informações detalhadas sobre módulos disponíveis, implementações e boas práticas específicas da categoria FOOD, consulte:
- **IFOOD_FOOD_CATEGORY.md** - Documentação completa sobre a categoria FOOD

### Módulos Disponíveis para FOOD

- **Merchant** - Configuração de loja
- **Events** - Eventos em tempo real (polling e webhook)
- **Order** - Gerenciamento de pedidos
- **Catalog** - Gerenciamento de catálogo
- **Review** - Avaliações
- **Shipping** - Envio e rastreamento

## Links Úteis

- **Documentação Principal**: https://developer.ifood.com.br/pt-BR/docs/
- **Categoria FOOD**: https://developer.ifood.com.br/pt-BR/docs/categories/?category=FOOD
- **Swagger/API Reference**: https://developer.ifood.com.br/pt-BR/docs/references/
- **Guia de Autenticação Centralizada**: https://developer.ifood.com.br/pt-BR/docs/guides/modules/authentication/centralized
- **Guia de Autenticação Distribuída**: https://developer.ifood.com.br/pt-BR/docs/guides/modules/authentication/distributed
- **Guia de Pedidos**: https://developer.ifood.com.br/pt-BR/docs/guides/modules/order/
- **Guia de Polling**: https://developer.ifood.com.br/pt-BR/docs/guides/modules/events/polling-overview
- **Changelog**: https://developer.ifood.com.br/pt-BR/docs/changelog

## Documentação Adicional do Projeto

- **IFOOD_POLLING.md** - Documentação completa sobre polling de eventos
- **IFOOD_BEST_PRACTICES.md** - Boas práticas e recomendações
- **IFOOD_FOOD_CATEGORY.md** - Informações específicas da categoria FOOD
- **IFOOD_AUTHENTICATION.md** - Detalhes sobre autenticação OAuth 2.0
- **IFOOD_WORKFLOW_IMPLEMENTATION.md** - Implementação do workflow de pedidos

## Notas Importantes

1. **Formato dos Parâmetros**: A API do iFood usa **camelCase** para parâmetros (ex: `grantType`, `clientId`, `clientSecret`), não snake_case.

2. **Content-Type**: Sempre use `application/x-www-form-urlencoded` para requisições de autenticação.

3. **Headers**: Inclua `accept: application/json` nas requisições.

4. **Ambiente**: A URL da API é a mesma para sandbox e produção: `https://merchant-api.ifood.com.br`

5. **Tokens**: Tokens expiram e devem ser renovados automaticamente. O sistema implementa renovação automática com buffer de 5 minutos.

## Atualizações da API

A documentação oficial é a fonte de verdade. Sempre consulte:
- O Swagger para ver a especificação exata dos endpoints
- O Changelog para verificar mudanças recentes na API
- Os guias para entender melhor os fluxos e boas práticas

