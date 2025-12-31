# Implementação do Workflow de Pedidos do iFood

Este documento detalha a implementação do workflow de pedidos do iFood conforme a [documentação oficial](https://developer.ifood.com.br/pt-BR/docs/guides/modules/order/workflow/?category=FOOD).

## Ciclo de Vida do Pedido (Categoria FOOD)

Conforme a documentação, o ciclo de vida de um pedido FOOD segue esta sequência:

```
PLACED → CONFIRMED → PREPARATION_STARTED → DISPATCHED/READY_TO_PICKUP → CONCLUDED
                              ↓
                          CANCELLED (pode ocorrer em qualquer momento)
```

## Status Implementados

### Status do iFood (ifood_status)

- ✅ `PLACED` - Pedido colocado na plataforma
- ✅ `CONFIRMED` - Pedido confirmado
- ✅ `PREPARATION_STARTED` - Preparação iniciada
- ✅ `READY_TO_PICKUP` - Pronto para retirada
- ✅ `DISPATCHED` - Despachado (em entrega)
- ✅ `CONCLUDED` - Concluído
- ✅ `CANCELLED` - Cancelado

**Nota**: `SEPARATION_STARTED` e `SEPARATION_ENDED` são exclusivos para categoria GROCERY (Mercado), não FOOD.

### Mapeamento de Status

O sistema mapeia os status internos para os status do iFood da seguinte forma:

| Status do Sistema | Status iFood | Observação |
|-------------------|--------------|------------|
| `Pending` | `PLACED` | Pedido recebido, aguardando confirmação |
| `Preparing` | `PREPARATION_STARTED` | Em preparação (conforme workflow FOOD) |
| `Ready` | `READY_TO_PICKUP` | Pronto para retirada |
| `Delivered` | `DISPATCHED` | Despachado/Entregue |
| `Closed` | `CONCLUDED` | Concluído |
| `Cancelled` | `CANCELLED` | Cancelado |

## Fluxo de Integração Implementado

### 1. Recepção de Pedidos

✅ **Polling de Eventos**
- Endpoint: `/events/polling?types=PLC,REC,CFM&groups=ORDER_STATUS,DELIVERY&categories=FOOD`
- Formato correto implementado
- Bearer token authentication implementado
- Polling automático a cada 30 segundos (configurável)

✅ **Webhook**
- Endpoint: `POST /api/ifood/webhook`
- Implementado para receber eventos em tempo real

### 2. Detalhes do Pedido

✅ **Consulta de Detalhes**
- Método: `getOrderDetails(orderId)`
- Validação de pedidos antigos (>8 horas) implementada
- Retry mechanism implementado (conforme best practices)

### 3. Confirmação de Pedido

✅ **Aceitar Pedido**
- Endpoint: `POST /api/ifood/accept-order/:orderId`
- Processa o pedido e cria no sistema
- Confirma automaticamente no iFood com status `CONFIRMED`
- Atualiza `ifood_status` no banco de dados

### 4. Atualização de Status

✅ **Sincronização de Status**
- Método: `syncOrderStatusToIfood()` no polling service
- Sincroniza status do sistema com iFood quando status muda
- Mapeamento correto de status implementado

### 5. Cancelamento

⚠️ **Cancelamento pelo Restaurante**
- Parcialmente implementado
- Precisa: Endpoint para solicitar cancelamento (`POST /orders/{id}/requestCancellation`)
- Precisa: Consultar motivos de cancelamento (`GET /orders/{id}/cancellationReasons`)

⚠️ **Cancelamento pelo Cliente**
- Eventos de cancelamento são recebidos via polling
- Precisa: Tratamento de eventos de cancelamento do cliente

⚠️ **Cancelamento pelo iFood**
- Eventos de cancelamento são recebidos via polling
- Implementado

⚠️ **Cancelamento Parcial**
- Eventos `ORDER_PATCHED` podem ser recebidos
- Precisa: Tratamento de eventos `CHANGE_ITEMS` e `DELETE_ITEMS`

## Funcionalidades Implementadas

### Backend

1. ✅ Polling de eventos com formato correto
2. ✅ Autenticação Bearer token
3. ✅ Obtenção de detalhes do pedido
4. ✅ Confirmação de pedidos
5. ✅ Atualização de status (sincronização)
6. ✅ Criação de pedidos no sistema
7. ✅ Mapeamento de produtos
8. ✅ Endpoint para listar pedidos pendentes
9. ✅ Endpoint para listar pedidos ativos (CONFIRMED e PREPARATION_STARTED)
10. ✅ Endpoint para aceitar pedidos

### Frontend

1. ✅ Card de pedidos pendentes (aguardando aceitação)
2. ✅ Card de pedidos em andamento (aceitos e em preparação)
3. ✅ Filtro "iFood" na página de pedidos
4. ✅ Badge de status do iFood nos pedidos
5. ✅ Botão para aceitar pedidos
6. ✅ Auto-refresh a cada 30 segundos
7. ✅ Campo `source` registrado no banco de dados

## Funcionalidades Pendentes

### Cancelamento

1. ⚠️ **Solicitar Cancelamento**
   - Endpoint: `POST /orders/{id}/requestCancellation`
   - Consultar motivos: `GET /orders/{id}/cancellationReasons`
   - Implementar validações de prazo

2. ⚠️ **Tratar Cancelamento Parcial**
   - Eventos `ORDER_PATCHED` com tipos:
     - `CHANGE_ITEMS` - Alteração de quantidade/unidade
     - `DELETE_ITEMS` - Remoção de itens
   - Atualizar valores do pedido no sistema
   - Impacto em faturamento e conciliação

3. ⚠️ **Rota de Devolução**
   - Tratar eventos:
     - `DELIVERY_RETURNING_TO_ORIGIN`
     - `DELIVERY_RETURN_CODE_REQUESTED`
     - `DELIVERY_RETURNED_TO_ORIGIN`
   - Exibir código de devolução quando solicitado

### Rastreamento

1. ⚠️ **Rastrear Entregador**
   - Obter localização do entregador (se disponível)
   - Exibir no frontend

### Agendamento

1. ⚠️ **Pedidos Agendados**
   - Tratar `orderTiming: SCHEDULED`
   - Respeitar horário agendado
   - Não iniciar preparo antes do horário

## Boas Práticas Implementadas

1. ✅ Polling a cada 30 segundos
2. ✅ Consultar detalhes antes de confirmar/cancelar
3. ✅ Persistir eventos antes de acknowledgment
4. ✅ Retry para erros 5XX
5. ✅ Timeout configurável
6. ✅ Não consultar pedidos antigos (>8 horas)
7. ✅ Tratamento de status 202 (operações assíncronas)
8. ✅ Validação de pedidos antes de processar
9. ✅ Mapeamento correto de status conforme workflow FOOD

## Campos no Banco de Dados

A tabela `orders` possui os seguintes campos relacionados ao iFood:

- `source`: `'manual'` ou `'ifood'` (com índice)
- `ifood_order_id`: ID do pedido no iFood (com índice)
- `ifood_status`: Status atual do pedido no iFood

## Endpoints Disponíveis

### Backend

- `GET /api/ifood/pending-orders` - Lista pedidos pendentes (PLACED)
- `GET /api/ifood/active-orders` - Lista pedidos ativos (CONFIRMED, PREPARATION_STARTED)
- `POST /api/ifood/accept-order/:orderId` - Aceita um pedido e confirma no iFood
- `POST /api/ifood/webhook` - Recebe eventos via webhook

### Frontend

- Página `/ifood` - Configuração e visualização de pedidos
  - Card: Pedidos em Andamento (CONFIRMED, PREPARATION_STARTED)
  - Card: Pedidos Pendentes (PLACED)
  - Filtro: iFood na página de pedidos

## Referências

- [Documentação Oficial do Workflow](https://developer.ifood.com.br/pt-BR/docs/guides/modules/order/workflow/?category=FOOD)
- [Documentação de Autenticação](./IFOOD_AUTHENTICATION.md)
- [Melhores Práticas](./IFOOD_BEST_PRACTICES.md)

