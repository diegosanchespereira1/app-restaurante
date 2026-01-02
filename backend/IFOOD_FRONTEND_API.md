# API iFood para Frontend

Este documento descreve todos os endpoints disponíveis para uso no frontend, facilitando a implementação sem necessidade de alterações no backend.

## Base URL

A URL base da API depende do ambiente:

- **Desenvolvimento**: `http://localhost:3000/api/ifood`
- **Produção**: Configure a variável `BACKEND_URL` ou `BACKEND_PUBLIC_URL`

## Autenticação

Todos os endpoints retornam JSON com a seguinte estrutura:

```typescript
{
  success: boolean
  message?: string
  data?: any
  error?: string
}
```

## Endpoints Disponíveis

### 1. Configuração

#### GET `/api/ifood/config`
Obter configuração atual (sem secrets)

**Resposta**:
```json
{
  "success": true,
  "config": {
    "id": 1,
    "merchant_id": "merchant-123",
    "client_id": "client-123",
    "authorization_code": null,
    "polling_interval": 30,
    "is_active": true,
    "last_sync_at": "2024-01-15T10:30:00Z"
  }
}
```

#### POST `/api/ifood/config`
Salvar/atualizar configuração

**Body**:
```json
{
  "merchant_id": "merchant-123",
  "client_id": "client-123",
  "client_secret": "secret-123",
  "authorization_code": "code-123",
  "polling_interval": 30,
  "is_active": true
}
```

**Resposta**:
```json
{
  "success": true,
  "message": "Configuração salva e autenticação realizada com sucesso"
}
```

### 2. Status da Integração

#### GET `/api/ifood/status`
Obter status completo da integração

**Resposta**:
```json
{
  "success": true,
  "status": {
    "configured": true,
    "active": true,
    "authenticated": true,
    "auth_error": null,
    "last_sync": "2024-01-15T10:30:00Z",
    "polling_interval": 30,
    "webhook_url": "https://seu-backend.com/api/ifood/webhook"
  }
}
```

### 3. Informações de Autenticação

#### GET `/api/ifood/auth-info`
Obter informações sobre a autenticação atual

**Resposta**:
```json
{
  "success": true,
  "data": {
    "grant_type": "authorization_code",
    "supports_refresh_token": true,
    "token_expires_at": "2024-01-15T16:30:00Z",
    "token_expires_in_seconds": 21600
  }
}
```

### 4. Módulos Disponíveis

#### GET `/api/ifood/modules`
Obter informações sobre módulos disponíveis e implementados

**Resposta**:
```json
{
  "success": true,
  "data": {
    "category": "FOOD",
    "available_modules": [
      {
        "name": "Authentication",
        "description": "Autenticação OAuth 2.0...",
        "implemented": true,
        "endpoints": ["POST /authentication/v1.0/oauth/token"],
        "documentation": "https://developer.ifood.com.br/..."
      }
    ],
    "implemented_modules": ["Authentication", "Order", "Events", "Catalog"],
    "not_implemented_modules": ["Merchant", "Review", "Shipping"]
  }
}
```

### 5. Status de Pedidos

#### GET `/api/ifood/order-statuses`
Obter informações sobre todos os status de pedidos e seus mapeamentos

**Resposta**:
```json
{
  "success": true,
  "data": [
    {
      "ifood_status": "PLACED",
      "ifood_code": "PLC",
      "system_status": "Pending",
      "description": "Novo pedido na plataforma",
      "is_final": false
    }
  ]
}
```

### 6. Estatísticas

#### GET `/api/ifood/stats`
Obter estatísticas da integração

**Resposta**:
```json
{
  "success": true,
  "data": {
    "total_orders": 150,
    "orders_today": 12,
    "orders_this_week": 45,
    "orders_this_month": 120,
    "mapped_products": 85,
    "unmapped_products": 15,
    "last_sync": "2024-01-15T10:30:00Z"
  }
}
```

### 7. Produtos

#### GET `/api/ifood/products`
Listar produtos do catálogo do iFood

**Resposta**:
```json
{
  "success": true,
  "products": [
    {
      "id": "product-123",
      "name": "Hambúrguer",
      "sku": "HB001",
      "externalCode": "EXT001"
    }
  ]
}
```

### 8. Mapeamento de Produtos

#### GET `/api/ifood/mapping`
Listar todos os mapeamentos de produtos

**Resposta**:
```json
{
  "success": true,
  "mappings": [
    {
      "id": 1,
      "ifood_product_id": "product-123",
      "ifood_sku": "HB001",
      "product_id": 5,
      "products": {
        "id": 5,
        "name": "Hambúrguer",
        "price": 25.00,
        "sku": "HB001"
      }
    }
  ]
}
```

#### POST `/api/ifood/mapping`
Criar mapeamento de produto

**Body**:
```json
{
  "ifood_product_id": "product-123",
  "ifood_sku": "HB001",
  "product_id": 5
}
```

**Resposta**:
```json
{
  "success": true,
  "message": "Mapeamento criado com sucesso"
}
```

#### DELETE `/api/ifood/mapping/:id`
Deletar mapeamento

**Resposta**:
```json
{
  "success": true,
  "message": "Mapeamento deletado com sucesso"
}
```

### 9. Sincronização

#### POST `/api/ifood/sync`
Forçar sincronização manual de pedidos

**Resposta**:
```json
{
  "success": true,
  "message": "Sincronização iniciada"
}
```

## Exemplos de Uso no Frontend

### React/TypeScript

```typescript
import type { 
  IfoodIntegrationStatus, 
  IfoodStats, 
  IfoodModulesInfo,
  IfoodOrderStatusInfo 
} from '../types/ifood'

// Obter status da integração
async function getIfoodStatus(): Promise<IfoodIntegrationStatus> {
  const response = await fetch('/api/ifood/status')
  const data = await response.json()
  return data.status
}

// Obter estatísticas
async function getIfoodStats(): Promise<IfoodStats> {
  const response = await fetch('/api/ifood/stats')
  const data = await response.json()
  return data.data
}

// Obter módulos disponíveis
async function getIfoodModules(): Promise<IfoodModulesInfo> {
  const response = await fetch('/api/ifood/modules')
  const data = await response.json()
  return data.data
}

// Obter status de pedidos
async function getOrderStatuses(): Promise<IfoodOrderStatusInfo[]> {
  const response = await fetch('/api/ifood/order-statuses')
  const data = await response.json()
  return data.data
}

// Configurar integração
async function saveIfoodConfig(config: {
  merchant_id: string
  client_id: string
  client_secret: string
  authorization_code?: string
  polling_interval?: number
  is_active?: boolean
}): Promise<void> {
  const response = await fetch('/api/ifood/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config)
  })
  const data = await response.json()
  if (!data.success) {
    throw new Error(data.message || data.error)
  }
}
```

### Hook React Personalizado

```typescript
import { useState, useEffect } from 'react'
import type { IfoodIntegrationStatus } from '../types/ifood'

export function useIfoodStatus() {
  const [status, setStatus] = useState<IfoodIntegrationStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchStatus() {
      try {
        const response = await fetch('/api/ifood/status')
        const data = await response.json()
        if (data.success) {
          setStatus(data.status)
        } else {
          setError(data.message || data.error)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro desconhecido')
      } finally {
        setLoading(false)
      }
    }

    fetchStatus()
    // Atualizar a cada 30 segundos
    const interval = setInterval(fetchStatus, 30000)
    return () => clearInterval(interval)
  }, [])

  return { status, loading, error }
}
```

## Tipos TypeScript

Todos os tipos estão disponíveis em `src/types/ifood.ts`:

- `IfoodOrderStatus` - Status de pedidos do iFood
- `IfoodOrderStatusCode` - Códigos abreviados
- `SystemOrderStatus` - Status do sistema
- `IfoodGrantType` - Tipos de grant OAuth
- `IfoodConfig` - Configuração (sem secrets)
- `IfoodIntegrationStatus` - Status da integração
- `IfoodProduct` - Produto do iFood
- `IfoodProductMapping` - Mapeamento de produto
- `IfoodModule` - Informações sobre módulo
- `IfoodModulesInfo` - Informações sobre módulos
- `IfoodStats` - Estatísticas
- `IfoodApiResponse<T>` - Resposta padrão da API
- `IfoodOrderStatusInfo` - Informações sobre status
- `IfoodAuthInfo` - Informações de autenticação

## Tratamento de Erros

Todos os endpoints seguem o padrão:

```typescript
{
  success: boolean
  message?: string  // Mensagem de sucesso ou erro
  data?: any        // Dados quando success = true
  error?: string    // Erro quando success = false
}
```

**Exemplo de tratamento**:

```typescript
async function handleRequest() {
  try {
    const response = await fetch('/api/ifood/config')
    const data = await response.json()
    
    if (data.success) {
      // Sucesso
      console.log(data.config)
    } else {
      // Erro
      console.error(data.error || data.message)
    }
  } catch (error) {
    // Erro de rede
    console.error('Erro de conexão:', error)
  }
}
```

## Boas Práticas

1. **Cache de Status**: Cache o status da integração e atualize periodicamente (ex: a cada 30 segundos)
2. **Tratamento de Erros**: Sempre verifique `success` antes de usar `data`
3. **Loading States**: Use estados de loading durante requisições
4. **Tipos TypeScript**: Use os tipos fornecidos para type safety
5. **Polling**: Para dados que mudam frequentemente, use polling ou WebSocket se disponível

## Documentação Adicional

- **Boas Práticas**: `backend/IFOOD_BEST_PRACTICES.md`
- **Troubleshooting**: `backend/TROUBLESHOOTING_IFOOD.md`
- **Categoria FOOD**: `backend/IFOOD_FOOD_CATEGORY.md`
- **Referência de API**: `backend/IFOOD_API_REFERENCE.md`
- **Documentação Oficial**: https://developer.ifood.com.br/pt-BR/docs/categories/?category=FOOD


