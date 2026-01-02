# Boas Práticas de Integração com iFood

Este documento contém as práticas recomendadas pelo iFood para integração com suas APIs. **SEMPRE consulte este documento antes de fazer alterações no código de integração.**

## Referências

- **Documentação Oficial**: https://developer.ifood.com.br/pt-BR/docs/
- **Categoria FOOD**: https://developer.ifood.com.br/pt-BR/docs/categories/?category=FOOD
- **Swagger/API Reference**: https://developer.ifood.com.br/pt-BR/docs/references/
- **Referência de API Detalhada**: Veja `IFOOD_API_REFERENCE.md` para links específicos de cada endpoint
- **Categoria FOOD Detalhada**: Veja `IFOOD_FOOD_CATEGORY.md` para informações específicas sobre a categoria FOOD
- **Autenticação Detalhada**: Veja `IFOOD_AUTHENTICATION.md` para informações completas sobre OAuth 2.0

## Práticas Gerais

### Conexão e Tolerância a Falhas

- **Timeout**: Teste a conectividade automaticamente quando ocorrer timeout. Notifique o usuário sobre problemas de conexão.
- **Erros 5XX**: Implemente retry automático para erros de servidor (500, 502, 503, 504). Se o problema persistir por mais de 5 minutos, contate o suporte.
- **Monitoramento**: Configure alertas para identificar problemas recorrentes.

### Processamento

- **Paralelização**: Processe cada merchant isoladamente para evitar que falhas ou alto volume afetem outros usuários.
- **Campos desconhecidos**: Configure sua aplicação para aceitar novos enums sem quebrar. Descarte eventos com enums desconhecidos em vez de interromper o processamento.

### Rate Limit

- Todos os endpoints têm limites de requisições por período. Respeite esses limites para evitar bloqueios temporários.
- **⚠️ IMPORTANTE**: Evite excesso de solicitações de autenticação. Não gere um novo token antes da expiração do atual.
- Solicitações excessivas podem resultar em bloqueio do seu aplicativo.

## Autenticação

### Gerenciamento de Token

- **Reutilize tokens**: Solicite novo token apenas quando o atual estiver prestes a expirar.
- **Erro 401**: Verifique se o token expirou. Se sim, solicite um novo token. Status 401 indica token expirado.
- **Erro 403**: Confirme se você tem acesso autorizado ao merchant e se não há solicitações pendentes.

### Tempos de Expiração

**⚠️ IMPORTANTE**: Os tempos de expiração podem mudar. Implemente a renovação de tokens baseada no valor `expiresIn` recebido na resposta da API. Nunca dependa de tempos fixos.

| Código/Token | Expiração Padrão |
|-------------|------------------|
| Token de acesso | 3 horas |
| Refresh token | 168 horas (7 dias) |
| Código de vínculo | 10 minutos |
| Código de autorização | 5 minutos |

### Boas Práticas de Renovação

- **Agende renovações automáticas**: Baseie-se no `expiresIn` recebido com o `accessToken`
- **Prepare para 401**: Quando receber status 401, solicite um novo token
- **Renovação antes da expiração**: Renove tokens antes que expirem (recomendado: buffer de 5 minutos)
- **Token de acesso expirado**: Use o `refresh_token` para obter um novo token de acesso
- **Refresh token expirado**: Solicite um novo token completo via API de Autenticação usando `client_credentials` ou `authorization_code`

### Requisitos de Segurança

- **HTTPS obrigatório**: Use apenas HTTPS com TLS 1.2 ou superior
- **Rejeição de HTTP**: Requisições HTTP serão rejeitadas
- **Autenticação obrigatória**: Requisições sem autenticação serão rejeitadas

### Atualização de Tokens Após Novas Permissões

Quando seu aplicativo receber uma nova permissão de algum merchant, é necessário solicitar um novo `access_token`. Este token incluirá as permissões para todos os merchants autorizados.

**Tempo de propagação**: Pode demorar até 10 minutos para que novas permissões sejam propagadas. Se um novo merchant não aparecer na listagem, aguarde 10 minutos e gere um novo `access_token`.

## Pedidos

### Polling

**Documentação completa**: https://developer.ifood.com.br/pt-BR/docs/guides/modules/events/polling-overview

- **Frequência**: Execute polling a cada **30 segundos** para manter o merchant ativo na plataforma (presença no polling).
- **Intervalo recomendado**: 30 segundos
- **Rate Limit**: 6000 requisições por minuto (RPM) por token. Exceder resulta em erro 429.
- **Retenção**: A API mantém eventos por até 8 horas após a entrega do pedido.

**Endpoint**: `GET /events:polling`

**Filtros disponíveis**:
- `categories`: Filtrar por categoria (FOOD, GROCERY, ANOTAI, FOOD_SELF_SERVICE, ALL)
- `types`: Filtrar por tipo de evento (PLC, CFM, CAN, etc.)
- `groups`: Filtrar por grupo (ORDER_STATUS, DELIVERY, TAKEOUT)
- `x-polling-merchants` header: Filtrar por merchant IDs (obrigatório para >500 merchants)

**Respostas da API**:
- **200**: Retorna lista de eventos
- **204**: Nenhum evento novo disponível

**Limites de merchants**:
- Para aplicações com mais de 500 merchants, use obrigatoriamente o header `x-polling-merchants`.
- Limite: até 100 merchant IDs por header
- Para >500 merchants, divida em lotes de até 100 merchants por requisição

**Códigos de erro**:
- **403 Forbidden**: Token sem permissão para um ou mais merchants especificados no header. A resposta inclui `unauthorizedMerchants`.

### Processamento de Eventos

- **Ordenação**: A API pode entregar eventos fora de ordem. **Sempre ordene eventos pelo campo `createdAt`** após recebê-los.
- **Persistência**: Persista eventos **antes** de enviar acknowledgment. Se a persistência falhar, você receberá o evento novamente no próximo polling.
- **Duplicação**: A API pode retornar o mesmo evento mais de uma vez. **Sempre verifique o ID do evento antes de processar** e descarte duplicados.
- **Acknowledgment**: 
  - Envie `POST /events/acknowledgment` para **todos** os eventos recebidos (código 200)
  - Envie acknowledgment mesmo para eventos já processados, não utilizados ou desconhecidos
  - Envie acknowledgment apenas **uma vez** por evento
  - Limite: até **2000 IDs por requisição**
  - Formato: Array de IDs de eventos ou payload completo (a API usa apenas o campo `id`)
- **Eventos desconhecidos**: Envie acknowledgment e descarte eventos desconhecidos. Continue processando eventos subsequentes.

### Operações com Pedidos

- **Consulta obrigatória**: Consulte os detalhes do pedido antes de confirmar ou cancelar.
- **Confirmação assíncrona**: A confirmação retorna status 202 (assíncrono). O pedido só é efetivamente confirmado quando o evento de confirmação aparece no polling.
- **Uma consulta apenas**: Consulte os detalhes do pedido apenas uma vez. Os detalhes são imutáveis.
- **Pedidos antigos**: Não consulte nem atualize pedidos após 8 horas do horário de entrega. A API não é um backup de dados.

## Status do Pedido

### Códigos de Status

- **PLACED (PLC)**: Novo pedido na plataforma
- **CONFIRMED (CFM)**: Pedido foi confirmado e será preparado
- **SEPARATION_STARTED (SPS)**: Início do processo de separação (Exclusivo para pedidos de Mercado)
- **SEPARATION_ENDED (SPE)**: Conclusão da separação (Exclusivo para pedidos de Mercado)
- **READY_TO_PICKUP (RTP)**: Pedido está pronto para ser retirado
- **DISPATCHED (DSP)**: Pedido saiu para entrega (Delivery)
- **CONCLUDED (CON)**: Pedido foi concluído
- **CANCELLED (CAN)**: Pedido foi cancelado

## Checklist de Implementação

Ao implementar ou modificar código de integração, verifique:

- [ ] Timeout configurado e testado
- [ ] Retry implementado para erros 5XX
- [ ] Tokens são reutilizados (não solicitados desnecessariamente)
- [ ] Polling configurado para 30 segundos
- [ ] Duplicação verificada usando ID único
- [ ] Eventos são persistidos antes de acknowledgment
- [ ] Detalhes do pedido consultados antes de confirmar/cancelar
- [ ] Eventos desconhecidos são descartados sem interromper processamento
- [ ] Rate limit respeitado
- [ ] Monitoramento e alertas configurados

