# Integração iFood - Categoria FOOD

Este documento contém informações específicas sobre a integração com APIs do iFood para a categoria **FOOD** (Restaurantes).

## Referência Oficial

- **Documentação Principal**: https://developer.ifood.com.br/pt-BR/docs/categories/?category=FOOD
- **Swagger/API Reference**: https://developer.ifood.com.br/pt-BR/docs/references/

## Categoria FOOD

A categoria **FOOD** é destinada a aplicativos de restaurantes parceiros do iFood. Esta categoria determina quais módulos de API estão disponíveis e influencia o processo de homologação.

### Módulos Disponíveis para FOOD

Para aplicativos da categoria FOOD, os seguintes módulos estão disponíveis:

1. **Merchant** - Configuração de dados da loja, horários de funcionamento, disponibilidade e outras operações comerciais essenciais
2. **Events** - Receba eventos de pedidos em tempo real via polling ou webhook
3. **Order** - Gerencie pedidos desde o recebimento até a entrega
4. **Catalog** - Gerencie cardápios e produtos, incluindo categorias, itens, preços, disponibilidade e descrições
5. **Review** - Gerencie avaliações de produtos e estabelecimentos
6. **Shipping** - Gerencie envio, rastreamento e contratação de serviços de entregas

### Módulos Implementados

Este projeto implementa os seguintes módulos:

#### ✅ Authentication (OAuth 2.0)
- **Fluxos suportados**:
  - `client_credentials` - Para aplicativos centralizados
  - `authorization_code` - Para aplicativos distribuídos
  - `refresh_token` - Para renovação de tokens
- **Endpoints**:
  - `POST /authentication/v1.0/oauth/token` - Obter token de acesso
  - `POST /authentication/v1.0/oauth/userCode` - Obter authorization code verifier
- **Implementação**: `backend/src/services/ifood-service.ts`
- **Documentação**: Veja `IFOOD_AUTHENTICATION.md` para informações completas sobre autenticação OAuth 2.0

#### ✅ Order (Pedidos)
- **Funcionalidades**:
  - Buscar pedidos por status
  - Obter detalhes de pedidos
  - Atualizar status de pedidos
  - Processar novos pedidos automaticamente
- **Endpoints**:
  - `GET /order/v1.0/events/orders:{status}` - Buscar pedidos
  - `GET /merchants/{merchantId}/orders/{orderId}` - Detalhes do pedido
  - `PATCH /merchants/{merchantId}/orders/{orderId}/status` - Atualizar status
- **Implementação**: 
  - `backend/src/services/ifood-service.ts` - Métodos de API
  - `backend/src/services/ifood-polling.ts` - Polling automático
  - `backend/src/routes/ifood.ts` - Webhook handler

#### ✅ Events (Eventos)
- **Funcionalidades**:
  - Polling de eventos a cada 30 segundos
  - Webhook para receber eventos em tempo real
  - Processamento de eventos de pedidos
- **Endpoints**:
  - `POST /api/ifood/webhook` - Receber eventos via webhook
- **Implementação**: 
  - `backend/src/services/ifood-polling.ts` - Polling service
  - `backend/src/routes/ifood.ts` - Webhook endpoint

#### ✅ Catalog (Catálogo)
- **Funcionalidades**:
  - Buscar produtos do catálogo do iFood
  - Mapear produtos do iFood para produtos do sistema
  - Gerenciar mapeamentos de produtos
- **Endpoints**:
  - `GET /merchants/{merchantId}/catalog/products` - Listar produtos
  - `GET /api/ifood/products` - Listar produtos (endpoint interno)
  - `POST /api/ifood/mapping` - Criar mapeamento
  - `GET /api/ifood/mapping` - Listar mapeamentos
  - `DELETE /api/ifood/mapping/:id` - Deletar mapeamento
- **Implementação**: `backend/src/services/ifood-service.ts`

### Módulos Não Implementados (Disponíveis)

Os seguintes módulos estão disponíveis para FOOD mas ainda não foram implementados:

#### ⚠️ Merchant
- Configuração de dados da loja
- Horários de funcionamento
- Disponibilidade
- Operações comerciais

**Documentação**: https://developer.ifood.com.br/pt-BR/docs/guides/modules/merchant/

#### ⚠️ Review
- Gerenciar avaliações de produtos
- Gerenciar avaliações de estabelecimentos
- Moderação de conteúdo
- Resposta a feedbacks

**Documentação**: https://developer.ifood.com.br/pt-BR/docs/guides/modules/review/

#### ⚠️ Shipping
- Gerenciar envio de pedidos
- Rastreamento de entregas
- Contratação de serviços de entregas

**Documentação**: https://developer.ifood.com.br/pt-BR/docs/guides/modules/shipping/

## Autenticação OAuth 2.0

### Fluxos Suportados

#### 1. Client Credentials (Aplicativos Centralizados)
Usado quando você tem apenas `clientId` e `clientSecret`. É o fluxo padrão para integrações server-to-server.

**Parâmetros no Body**:
- `grantType: "client_credentials"`
- `clientId`
- `clientSecret`

**Headers**:
- `Content-Type: application/x-www-form-urlencoded`
- `accept: application/json`
- `grantType: client_credentials`

**Documentação**: https://developer.ifood.com.br/pt-BR/docs/guides/modules/authentication/centralized

#### 2. Authorization Code (Aplicativos Distribuídos)
Usado quando você precisa de um código de autorização do usuário.

**Parâmetros no Body**:
- `grantType: "authorization_code"`
- `clientId`
- `clientSecret`
- `code`: Código de autorização obtido do usuário
- `refreshToken`: Token de refresh (se disponível)

**Headers**:
- `Content-Type: application/x-www-form-urlencoded`
- `accept: application/json`
- `grantType: authorization_code`
- `authorizationCode`: Código de autorização (do frontend)
- `authorizationCodeVerifier`: Verifier obtido da API `/oauth/userCode`

**Documentação**: https://developer.ifood.com.br/pt-BR/docs/guides/modules/authentication/distributed

#### 3. Refresh Token
Usado para renovar tokens de acesso sem precisar reautenticar.

**Parâmetros no Body**:
- `grantType: "refresh_token"`
- `clientId`
- `clientSecret`
- `refreshToken`: Token de refresh obtido anteriormente

**Headers**:
- `Content-Type: application/x-www-form-urlencoded`
- `accept: application/json`
- `grantType: refresh_token`

### Formato de Resposta

A API retorna tokens no formato **camelCase**:

```json
{
  "accessToken": "eyJraWQiOi...",
  "refreshToken": "eyJraWQiOi...",
  "type": "bearer",
  "expiresIn": 21600
}
```

**Nota**: O código implementado suporta tanto camelCase quanto snake_case para compatibilidade.

### Obter Authorization Code Verifier

Para usar o fluxo `authorization_code`, é necessário obter o `authorizationCodeVerifier` primeiro:

**Endpoint**: `POST /authentication/v1.0/oauth/userCode`

**Body**:
```json
{
  "clientId": "seu_client_id"
}
```

**Resposta**:
```json
{
  "authorizationCodeVerifier": "verifier_string"
}
```

## Status dos Pedidos

### Códigos de Status

- **PLACED (PLC)**: Novo pedido na plataforma
- **CONFIRMED (CFM)**: Pedido foi confirmado e será preparado
- **SEPARATION_STARTED (SPS)**: Início do processo de separação (Exclusivo para pedidos de Mercado)
- **SEPARATION_ENDED (SPE)**: Conclusão da separação (Exclusivo para pedidos de Mercado)
- **READY_TO_PICKUP (RTP)**: Pedido está pronto para ser retirado
- **DISPATCHED (DSP)**: Pedido saiu para entrega (Delivery)
- **CONCLUDED (CON)**: Pedido foi concluído
- **CANCELLED (CAN)**: Pedido foi cancelado

### Mapeamento de Status

O sistema mapeia os status do iFood para status internos:

| Status iFood | Status Sistema |
|--------------|----------------|
| PLACED | Pending |
| CONFIRMED | Preparing |
| SEPARATION_STARTED | Preparing |
| SEPARATION_ENDED | Preparing |
| READY_TO_PICKUP | Ready |
| DISPATCHED | Delivered |
| CONCLUDED | Closed |
| CANCELLED | Cancelled |

## Endpoints da API Interna

### Configuração

- **POST** `/api/ifood/config` - Configurar credenciais do iFood
- **GET** `/api/ifood/config` - Obter configuração atual
- **GET** `/api/ifood/status` - Obter status da integração

### Sincronização

- **POST** `/api/ifood/sync` - Forçar sincronização manual

### Produtos e Mapeamento

- **GET** `/api/ifood/products` - Listar produtos do iFood
- **POST** `/api/ifood/mapping` - Criar mapeamento de produto
- **GET** `/api/ifood/mapping` - Listar mapeamentos
- **DELETE** `/api/ifood/mapping/:id` - Deletar mapeamento

### Webhook

- **POST** `/api/ifood/webhook` - Receber eventos do iFood

## Boas Práticas

### Polling

- **Frequência**: Execute polling a cada 30 segundos para manter o merchant ativo
- **Filtros**: Use o header `x-polling-merchants` para filtrar eventos (recomendado para 100+ merchants, obrigatório para 500+)

### Processamento de Pedidos

- **Duplicação**: Use o ID único (`ifood_order_id`) para evitar processar o mesmo pedido duas vezes
- **Persistência**: Sempre persista o pedido no banco antes de enviar acknowledgment
- **Consulta**: Consulte os detalhes do pedido antes de confirmar ou cancelar
- **Pedidos Antigos**: Não consulte pedidos após 8 horas do horário de entrega

### Autenticação

- **Reutilização**: Reutilize tokens até próximo da expiração (buffer de 5 minutos)
- **Refresh Token**: Use refresh_token quando disponível para renovar tokens
- **Rate Limit**: O endpoint `/oauth/token` permite até 20 requisições por minuto

### Tratamento de Erros

- **5XX**: Implemente retry automático para erros de servidor
- **401**: Token expirado - renove o token automaticamente
- **403**: Verifique permissões do merchant
- **Timeout**: Teste conectividade e notifique o usuário

## Homologação

Antes de disponibilizar seu aplicativo para clientes, é necessário homologá-lo.

### Requisitos para Homologação

1. **Aplicativo Completo**: O aplicativo deve estar completo e funcional
2. **Testes Abrangentes**: Os testes abrangem o aplicativo como um todo, não apenas chamadas de API
3. **Categoria Correta**: Certifique-se de que o aplicativo está cadastrado como categoria FOOD

### Processo de Homologação

1. Acesse o Portal do Desenvolvedor: https://developer.ifood.com.br
2. Crie um aplicativo do tipo FOOD
3. Complete a integração com todos os módulos necessários
4. Submeta para homologação
5. Aguarde aprovação

**Documentação**: https://developer.ifood.com.br/pt-BR/docs/getting-started/homologation/categories

## Rate Limits

Todos os endpoints têm limites de requisições por período:

- **Autenticação**: Até 20 requisições por minuto
- **Pedidos**: Consulte a documentação oficial para limites específicos
- **Catálogo**: Consulte a documentação oficial para limites específicos

**Importante**: Respeite os rate limits para evitar bloqueios temporários.

## Referências Adicionais

- **Boas Práticas**: Veja `IFOOD_BEST_PRACTICES.md`
- **Troubleshooting**: Veja `TROUBLESHOOTING_IFOOD.md`
- **Referência de API**: Veja `IFOOD_API_REFERENCE.md`
- **Documentação Oficial**: https://developer.ifood.com.br/pt-BR/docs/categories/?category=FOOD

## Changelog

### Versão Atual

- ✅ Autenticação OAuth 2.0 (client_credentials, authorization_code, refresh_token)
- ✅ Polling de pedidos a cada 30 segundos
- ✅ Webhook para receber eventos em tempo real
- ✅ Processamento automático de novos pedidos
- ✅ Mapeamento de produtos do iFood para produtos do sistema
- ✅ Atualização de status de pedidos
- ✅ Suporte a refresh_token para renovação automática de tokens
- ✅ Headers customizados (grantType, authorizationCode, authorizationCodeVerifier)

### Próximas Implementações

- ⏳ Módulo Merchant (configuração de loja)
- ⏳ Módulo Review (avaliações)
- ⏳ Módulo Shipping (envio e rastreamento)

