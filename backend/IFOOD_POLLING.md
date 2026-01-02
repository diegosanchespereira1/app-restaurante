# Polling de Eventos do iFood

Este documento detalha a implementação do polling de eventos conforme a [documentação oficial do iFood](https://developer.ifood.com.br/pt-BR/docs/guides/modules/events/polling-overview?category=FOOD).

## Visão Geral

Polling é um método para receber atualizações da API do iFood. O sistema envia requisições regulares ao endpoint de polling e verifica se há novos eventos. A API retorna apenas eventos sem acknowledgment (ACK).

**URL Completa do Endpoint**:
- Base URL: `https://merchant-api.ifood.com.br/events/v1.0/`
- Endpoint: `events:polling?types=PLC,REC,CFM&groups=ORDER_STATUS,DELIVERY&categories=FOOD`
- URL Final: `https://merchant-api.ifood.com.br/events/v1.0/events:polling?types=PLC,REC,CFM&groups=ORDER_STATUS,DELIVERY&categories=FOOD`

### Respostas da API

- **200**: Retorna lista de eventos
- **204**: Nenhum evento novo disponível

## Intervalo Recomendado

Execute polling a cada **30 segundos** para:
- Manter a loja online na plataforma iFood (presença no polling)
- Receber eventos sem atrasos significativos
- Evitar timeout e perda de conexão

## Rate Limit

O limite absoluto é de **6000 requisições por minuto (RPM)** por token. Exceder esse limite resulta em erro **429 (Too Many Requests)** e possível bloqueio temporário da integração.

**Recomendações**:
- Mantenha o intervalo de 30 segundos sempre que possível
- Para múltiplos merchants, agrupe as requisições sequencialmente dentro do mesmo ciclo de 30 segundos
- Evite aproximar-se do limite de 6000 RPM

## Retenção de Eventos

A API mantém eventos por **até 8 horas após a entrega do pedido**. Após esse prazo, os eventos não são mais retornados.

## Ordenação de Eventos

**⚠️ IMPORTANTE**: A API pode entregar eventos fora de ordem. **Sempre ordene os eventos pelo campo `createdAt`** após recebê-los para garantir a sequência correta.

## Filtros

### Filtro por Categoria

Use o parâmetro `categories` para filtrar pedidos por categoria. Por padrão, a API retorna eventos das categorias FOOD e GROCERY.

**Exemplos**:
```
GET https://merchant-api.ifood.com.br/events/v1.0/events:polling?categories=FOOD,GROCERY,ANOTAI,FOOD_SELF_SERVICE
GET https://merchant-api.ifood.com.br/events/v1.0/events:polling?categories=ALL
```

**Nota**: O endpoint usa dois pontos (`:`) após `events`, não barra (`/`). O formato correto é `events:polling`.

`categories=ALL` retorna todas as categorias, incluindo novas categorias criadas futuramente.

**Categorias disponíveis**:
- `FOOD`: Pedidos de restaurantes (aplicativo/site iFood)
- `FOOD_SELF_SERVICE`: Pedidos via totens de autoatendimento
- `GROCERY`: Pedidos de supermercados, pet shops, farmácias
- `ANOTAI`: Pedidos originados do aplicativo Anota AI

### Filtro por Tipo de Evento

Use `types` e `groups` para filtrar eventos específicos.

**Exemplos**:
```
GET https://merchant-api.ifood.com.br/events/v1.0/events:polling?groups=STATUS,DELIVERY,TAKEOUT
GET https://merchant-api.ifood.com.br/events/v1.0/events:polling?types=PLC,CFM,CAN,AAO
GET https://merchant-api.ifood.com.br/events/v1.0/events:polling?groups=ORDER_STATUS&types=AAO,AAD
```

**Como funciona o filtro**:
- Quando você aplica filtros, eventos que não correspondem aos critérios recebem acknowledgment automático
- Eventos já confirmados não serão retornados em requisições futuras
- Se você alterar os filtros, eventos anteriormente confirmados não serão retornados novamente

**Recomendações**:
- Defina seus filtros desde o início
- Consuma todos os eventos em um único fluxo
- Repasse os eventos conforme sua lógica de negócio

**⚠️ AVISO**: Os `groups` já incluem os `types` correspondentes. Evite usar ambos simultaneamente para os mesmos eventos, pois isso cria filtros duplicados desnecessários.

### Filtro por Merchants

O endpoint retorna eventos de até **500 merchants** por requisição. Use o header `x-polling-merchants` para especificar quais lojas.

**Exemplo**:
```
GET https://merchant-api.ifood.com.br/events/v1.0/events:polling
--header 'x-polling-merchants: 0a0000aa-0aa0-00aa-aa00-0000aa000001,0a0000aa-0aa0-00aa-aa00-0000aa000002'
```

**Cenários de uso**:

| Merchants no token | Header obrigatório? | Comportamento |
|-------------------|---------------------|---------------|
| Até 500 | Opcional | Sem header: retorna eventos de todos os merchants |
| Mais de 500 | **Obrigatório** | Divida em lotes de até 100 merchants por requisição |

**Para aplicativos centralizados**:
- Sempre use `x-polling-merchants` para filtrar por merchant
- Limite: **100 merchant IDs por header**
- Sem o header em tokens com muitos merchants: erro "Bad request. Too many polling merchants"

**Erro 403 - Forbidden**:
- Causa: Token sem permissão para um ou mais merchants especificados no header
- Resposta da API inclui `unauthorizedMerchants`
- Solução: Remova os merchants listados e envie nova requisição

**Para aplicativos com mais de 500 merchants**, considere usar webhooks. Webhooks entregam eventos em tempo real e eliminam a necessidade de gerenciar múltiplas requisições de polling.

## Eventos Duplicados

**⚠️ IMPORTANTE**: A API pode retornar o mesmo evento mais de uma vez, incluindo eventos antigos de `PLACED`.

**Boas práticas**:
- Sempre verifique o ID do evento antes de processar
- Descarte eventos duplicados
- Não processe o mesmo evento mais de uma vez
- **Envie acknowledgment mesmo para eventos já processados**
- Se receber `PLACED` repetido, não crie novo pedido

## Acknowledgment de Eventos

**⚠️ OBRIGATÓRIO**: Envie `POST /events/acknowledgment` para **todos** os eventos recebidos (código 200). Isso evita receber os mesmos eventos novamente.

**Formato da requisição**:
- Envie array com IDs dos eventos ou o payload completo recebido no polling
- A API usa apenas o campo `id` para processar o acknowledgment
- Limite: até **2000 IDs por requisição**

**Regras**:
- Envie acknowledgment para cada polling que retornar eventos (código 200)
- Envie acknowledgment de **todos** os eventos, mesmo os não utilizados pelo seu sistema
- Envie acknowledgment apenas **uma vez** por evento
- Persista eventos **antes** de enviar acknowledgment (se a persistência falhar, você receberá o evento novamente)

## Presença no Polling

O merchant fica **online** enquanto sua integração realiza polling a cada 30 segundos. Se o polling parar, o merchant perde o status online.

**Importante para Integradoras Logísticas**: Use o parâmetro `excludeHeartbeat=true` no endpoint de polling para evitar abrir a loja indevidamente. Isso previne cancelamento de pedidos e penalização do merchant.

## Múltiplos Devices ou Aplicativos

Múltiplos aplicativos podem consumir eventos da mesma loja simultaneamente. A API gera um identificador único ("device") para cada aplicativo baseado nas credenciais.

**Como funciona**:
- Cada device tem controle independente de acknowledgment
- Você pode receber eventos de confirmação gerados por outros devices
- Registre e atualize o status do pedido com base em **todos os eventos recebidos**, independente da origem

## Implementação no Projeto

### Serviço de Polling

**Arquivo**: `backend/src/services/ifood-polling.ts`

**Funcionalidades implementadas**:
- ✅ Polling automático a cada 30 segundos (configurável)
- ✅ Ordenação de eventos por `createdAt`
- ✅ Verificação de IDs duplicados
- ✅ Acknowledgment de eventos processados
- ✅ Processamento de eventos de pedidos
- ✅ Criação de pedidos no sistema

**Método principal**: `pollOrders()`

### Serviço de API

**Arquivo**: `backend/src/services/ifood-service.ts`

**Métodos implementados**:
- `pollEvents()`: Busca eventos do endpoint `events:polling` usando base URL `https://merchant-api.ifood.com.br/events/v1.0/`
- `acknowledgeEvents(eventIds: string[])`: Envia acknowledgment para eventos processados

**Estrutura de URLs**:
- Base URL para eventos: `https://merchant-api.ifood.com.br/events/v1.0/`
- Endpoint de polling: `events:polling?types=PLC,REC,CFM&groups=ORDER_STATUS,DELIVERY&categories=FOOD`
- URL completa: `https://merchant-api.ifood.com.br/events/v1.0/events:polling?types=PLC,REC,CFM&groups=ORDER_STATUS,DELIVERY&categories=FOOD`

**Nota sobre Versionamento**: Para atualizar a versão da API de eventos no futuro, modifique a constante `IFOOD_API_VERSIONS.EVENTS` no arquivo `backend/src/services/ifood-service.ts`. A URL base será atualizada automaticamente.

### Configuração

**Filtros atuais**:
- `categories=FOOD`: Apenas eventos da categoria FOOD
- `types=PLC,REC,CFM`: Eventos de pedidos colocados, recebidos e confirmados
- `groups=ORDER_STATUS,DELIVERY`: Grupos de status de pedido e entrega

## Fluxo de Processamento

1. **Polling**: Buscar eventos via `GET https://merchant-api.ifood.com.br/events/v1.0/events:polling`
2. **Ordenação**: Ordenar eventos por `createdAt`
3. **Deduplicação**: Verificar IDs duplicados
4. **Processamento**: Para cada evento único:
   - Extrair ID do pedido
   - Verificar se pedido já existe no sistema
   - Buscar detalhes completos do pedido
   - Processar e criar pedido no sistema
   - Adicionar ID do evento à lista de acknowledgment
5. **Acknowledgment**: Enviar `POST /events/acknowledgment` com IDs dos eventos processados
6. **Atualização**: Atualizar timestamp da última sincronização

## Critérios de Homologação

Para passar na homologação do iFood, é obrigatório:

- ✅ Execute `GET https://merchant-api.ifood.com.br/events/v1.0/events:polling` a cada **30 segundos**
- ✅ Use header `x-polling-merchants` para filtrar eventos por merchant (quando aplicável)
- ✅ Filtre eventos por tipo e grupo conforme necessário
- ✅ Envie `POST /events/acknowledgment` imediatamente após receber eventos (código 200)

**Integradoras Logísticas**: Envie o parâmetro `excludeHeartbeat=true` no endpoint de polling para evitar abrir a loja indevidamente.

## Atualização de Status de Pedidos

### Endpoint para Confirmar/Cancelar Pedidos

**Endpoint**: `PATCH /merchants/{merchantId}/orders/{orderId}/status`

**Formato Alternativo**: `PATCH /order/v1.0/orders/{orderId}/status` (fallback se o primeiro falhar)

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

**Boas Práticas**:
- Sempre consulte os detalhes do pedido (`GET /order/v1.0/orders/{orderId}`) antes de confirmar ou cancelar
- Se receber 202, aguarde o evento de confirmação no polling antes de considerar o status atualizado
- Implemente retry para erros 5XX

**Documentação**: https://developer.ifood.com.br/pt-BR/docs/guides/modules/order/events/?category=FOOD

## Referências

- **Documentação Oficial**: https://developer.ifood.com.br/pt-BR/docs/guides/modules/events/polling-overview
- **Eventos de Pedidos**: https://developer.ifood.com.br/pt-BR/docs/guides/modules/order/events/?category=FOOD
- **Boas Práticas**: Veja `IFOOD_BEST_PRACTICES.md`
- **API Reference**: Veja `IFOOD_API_REFERENCE.md`

