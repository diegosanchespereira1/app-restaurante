# Setup iFood para Frontend - Guia Rápido

Este guia fornece todas as informações necessárias para implementar a integração com iFood no frontend **sem precisar alterar o backend**.

## 📦 O que foi criado

### 1. Tipos TypeScript (`src/types/ifood.ts`)
Todos os tipos necessários para type safety no frontend:
- Status de pedidos
- Configuração
- Estatísticas
- Módulos
- Autenticação
- E mais...

### 2. Novos Endpoints da API

#### Informações e Status
- `GET /api/ifood/modules` - Módulos disponíveis e implementados
- `GET /api/ifood/order-statuses` - Status de pedidos e mapeamentos
- `GET /api/ifood/stats` - Estatísticas da integração
- `GET /api/ifood/auth-info` - Informações sobre autenticação

#### Endpoints Existentes (melhorados)
- `GET /api/ifood/status` - Status completo com `auth_error`
- `GET /api/ifood/config` - Configuração (sem secrets)
- `POST /api/ifood/config` - Salvar configuração
- `GET /api/ifood/products` - Produtos do iFood
- `GET /api/ifood/mapping` - Mapeamentos
- `POST /api/ifood/mapping` - Criar mapeamento
- `DELETE /api/ifood/mapping/:id` - Deletar mapeamento
- `POST /api/ifood/sync` - Sincronização manual

### 3. Documentação Completa
- `IFOOD_FRONTEND_API.md` - Documentação completa de todos os endpoints
- `IFOOD_FOOD_CATEGORY.md` - Informações sobre categoria FOOD
- Este arquivo - Guia rápido

## 🚀 Como Usar

### 1. Importar Tipos

```typescript
import type {
  IfoodIntegrationStatus,
  IfoodStats,
  IfoodModulesInfo,
  IfoodOrderStatusInfo,
  IfoodConfig,
  IfoodAuthInfo
} from '../types/ifood'
```

### 2. Exemplo Básico - Obter Status

```typescript
async function getStatus() {
  const response = await fetch('/api/ifood/status')
  const data = await response.json()
  
  if (data.success) {
    const status: IfoodIntegrationStatus = data.status
    console.log('Configurado:', status.configured)
    console.log('Ativo:', status.active)
    console.log('Autenticado:', status.authenticated)
    if (status.auth_error) {
      console.error('Erro:', status.auth_error)
    }
  }
}
```

### 3. Exemplo - Obter Estatísticas

```typescript
async function getStats() {
  const response = await fetch('/api/ifood/stats')
  const data = await response.json()
  
  if (data.success) {
    const stats: IfoodStats = data.data
    console.log('Pedidos hoje:', stats.orders_today)
    console.log('Produtos mapeados:', stats.mapped_products)
  }
}
```

### 4. Exemplo - Obter Módulos

```typescript
async function getModules() {
  const response = await fetch('/api/ifood/modules')
  const data = await response.json()
  
  if (data.success) {
    const modules: IfoodModulesInfo = data.data
    console.log('Módulos implementados:', modules.implemented_modules)
    console.log('Módulos não implementados:', modules.not_implemented_modules)
  }
}
```

### 5. Exemplo - Obter Status de Pedidos

```typescript
async function getOrderStatuses() {
  const response = await fetch('/api/ifood/order-statuses')
  const data = await response.json()
  
  if (data.success) {
    const statuses: IfoodOrderStatusInfo[] = data.data
    statuses.forEach(status => {
      console.log(`${status.ifood_status} -> ${status.system_status}`)
    })
  }
}
```

## 🎣 Hook React Personalizado

Crie um hook para facilitar o uso:

```typescript
// hooks/useIfood.ts
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
    const interval = setInterval(fetchStatus, 30000) // Atualizar a cada 30s
    return () => clearInterval(interval)
  }, [])

  return { status, loading, error, refetch: () => fetchStatus() }
}
```

**Uso no componente**:

```typescript
function IfoodStatusCard() {
  const { status, loading, error } = useIfoodStatus()

  if (loading) return <div>Carregando...</div>
  if (error) return <div>Erro: {error}</div>
  if (!status) return <div>Não configurado</div>

  return (
    <div>
      <p>Configurado: {status.configured ? 'Sim' : 'Não'}</p>
      <p>Ativo: {status.active ? 'Sim' : 'Não'}</p>
      <p>Autenticado: {status.authenticated ? 'Sim' : 'Não'}</p>
      {status.auth_error && <p>Erro: {status.auth_error}</p>}
    </div>
  )
}
```

## 📊 Exemplo Completo - Dashboard

```typescript
import { useState, useEffect } from 'react'
import type { IfoodStats, IfoodIntegrationStatus } from '../types/ifood'

function IfoodDashboard() {
  const [stats, setStats] = useState<IfoodStats | null>(null)
  const [status, setStatus] = useState<IfoodIntegrationStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const [statsRes, statusRes] = await Promise.all([
          fetch('/api/ifood/stats'),
          fetch('/api/ifood/status')
        ])

        const statsData = await statsRes.json()
        const statusData = await statusRes.json()

        if (statsData.success) setStats(statsData.data)
        if (statusData.success) setStatus(statusData.status)
      } catch (error) {
        console.error('Erro ao buscar dados:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 60000) // Atualizar a cada minuto
    return () => clearInterval(interval)
  }, [])

  if (loading) return <div>Carregando...</div>

  return (
    <div>
      <h2>Integração iFood</h2>
      
      {status && (
        <div>
          <p>Status: {status.active ? 'Ativo' : 'Inativo'}</p>
          <p>Autenticado: {status.authenticated ? 'Sim' : 'Não'}</p>
          {status.auth_error && <p className="error">{status.auth_error}</p>}
        </div>
      )}

      {stats && (
        <div>
          <h3>Estatísticas</h3>
          <p>Pedidos hoje: {stats.orders_today}</p>
          <p>Pedidos esta semana: {stats.orders_this_week}</p>
          <p>Pedidos este mês: {stats.orders_this_month}</p>
          <p>Produtos mapeados: {stats.mapped_products}</p>
          <p>Produtos não mapeados: {stats.unmapped_products}</p>
        </div>
      )}
    </div>
  )
}
```

## 🔧 Configuração

### Variáveis de Ambiente Necessárias

No backend, configure:
- `SUPABASE_URL` - URL do Supabase
- `SUPABASE_SERVICE_ROLE_KEY` - Service Role Key do Supabase
- `BACKEND_URL` ou `BACKEND_PUBLIC_URL` - URL pública do backend (para webhook)

### Base URL da API

- **Desenvolvimento**: `http://localhost:3000/api/ifood`
- **Produção**: Configure `BACKEND_URL` ou use a URL do seu backend

## 📚 Documentação Completa

Para informações detalhadas sobre cada endpoint, consulte:
- **`IFOOD_FRONTEND_API.md`** - Documentação completa de todos os endpoints
- **`IFOOD_FOOD_CATEGORY.md`** - Informações sobre categoria FOOD
- **`IFOOD_BEST_PRACTICES.md`** - Boas práticas
- **`TROUBLESHOOTING_IFOOD.md`** - Resolução de problemas

## ✅ Checklist de Implementação

- [ ] Importar tipos de `src/types/ifood.ts`
- [ ] Criar hooks personalizados (opcional)
- [ ] Implementar componente de status
- [ ] Implementar dashboard com estatísticas
- [ ] Configurar polling/atualização automática
- [ ] Tratamento de erros
- [ ] Loading states
- [ ] Testar todos os endpoints

## 🎯 Próximos Passos

1. **Implementar UI de Configuração**: Use `POST /api/ifood/config`
2. **Dashboard de Estatísticas**: Use `GET /api/ifood/stats`
3. **Gerenciamento de Mapeamentos**: Use endpoints de mapping
4. **Monitoramento**: Use `GET /api/ifood/status` com polling

Tudo está pronto para uso no frontend! 🚀


