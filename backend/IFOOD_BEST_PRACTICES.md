# Boas Práticas de Integração com iFood

Este documento contém as práticas recomendadas pelo iFood para integração com suas APIs. **SEMPRE consulte este documento antes de fazer alterações no código de integração.**

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

## Autenticação

### Gerenciamento de Token

- **Reutilize tokens**: Solicite novo token apenas quando o atual estiver prestes a expirar.
- **Erro 401**: Verifique se o token expirou. Se sim, solicite um novo token.
- **Erro 403**: Confirme se você tem acesso autorizado ao merchant e se não há solicitações pendentes.

## Pedidos

### Polling

- **Frequência**: Execute polling a cada 30 segundos para manter o merchant ativo na plataforma.
- **Filtros**: Use o header `x-polling-merchants` para filtrar eventos por merchant, tipo ou grupo.
- **Limites de merchants**: 
  - Para aplicações com mais de 500 merchants, use obrigatoriamente o header `x-polling-merchants`.
  - Implemente o header quando atingir 100 merchants.

### Processamento de Eventos

- **Frequência**: Persista eventos antes de enviar acknowledgment. Se a persistência falhar, você receberá o evento novamente no próximo polling.
- **Duplicação**: Use o ID único para garantir que pedidos e eventos não sejam processados mais de uma vez.
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

