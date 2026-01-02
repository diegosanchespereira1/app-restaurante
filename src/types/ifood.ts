/**
 * Tipos TypeScript para integração com iFood
 * Esses tipos podem ser usados no frontend para tipagem forte
 */

// Status de pedidos do iFood
export type IfoodOrderStatus = 
  | 'PLACED' 
  | 'CONFIRMED' 
  | 'SEPARATION_STARTED' 
  | 'SEPARATION_ENDED' 
  | 'READY_TO_PICKUP' 
  | 'DISPATCHED' 
  | 'CONCLUDED' 
  | 'CANCELLED'

// Códigos abreviados de status
export type IfoodOrderStatusCode = 
  | 'PLC' 
  | 'CFM' 
  | 'SPS' 
  | 'SPE' 
  | 'RTP' 
  | 'DSP' 
  | 'CON' 
  | 'CAN'

// Mapeamento de status do iFood para status do sistema
export type SystemOrderStatus = 
  | 'Pending' 
  | 'Preparing' 
  | 'Ready' 
  | 'Delivered' 
  | 'Closed' 
  | 'Cancelled'

// Tipos de grant OAuth
export type IfoodGrantType = 
  | 'client_credentials' 
  | 'authorization_code' 
  | 'refresh_token'

// Configuração do iFood (sem secrets)
export interface IfoodConfig {
  id?: number
  merchant_id: string
  client_id: string
  authorization_code?: string | null
  polling_interval?: number
  is_active?: boolean
  last_sync_at?: string | null
}

// Status da integração
export interface IfoodIntegrationStatus {
  configured: boolean
  active: boolean
  authenticated: boolean
  auth_error?: string | null
  last_sync?: string | null
  polling_interval?: number
  webhook_url?: string | null
}

// Produto do iFood
export interface IfoodProduct {
  id: string
  name: string
  sku?: string
  externalCode?: string
}

// Mapeamento de produto
export interface IfoodProductMapping {
  id: number
  ifood_product_id: string
  ifood_sku?: string | null
  product_id: number
  products?: {
    id: number
    name: string
    price: number
    sku?: string | null
  }
}

// Informações sobre módulos disponíveis
export interface IfoodModule {
  name: string
  description: string
  implemented: boolean
  endpoints?: string[]
  documentation?: string
}

// Informações sobre módulos do iFood
export interface IfoodModulesInfo {
  category: 'FOOD'
  available_modules: IfoodModule[]
  implemented_modules: string[]
  not_implemented_modules: string[]
}

// Estatísticas da integração
export interface IfoodStats {
  total_orders: number
  orders_today: number
  orders_this_week: number
  orders_this_month: number
  mapped_products: number
  unmapped_products: number
  last_sync?: string | null
}

// Resposta padrão da API
export interface IfoodApiResponse<T = any> {
  success: boolean
  message?: string
  data?: T
  error?: string
}

// Status de pedido do iFood com mapeamento
export interface IfoodOrderStatusInfo {
  ifood_status: IfoodOrderStatus
  ifood_code: IfoodOrderStatusCode
  system_status: SystemOrderStatus
  description: string
  is_final: boolean
}

// Informações sobre autenticação
export interface IfoodAuthInfo {
  grant_type: IfoodGrantType
  supports_refresh_token: boolean
  token_expires_at?: string | null
  token_expires_in_seconds?: number | null
}


