import axios, { AxiosInstance, AxiosError } from 'axios'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { encrypt, decrypt } from '../utils/encryption.js'
import { withRetry, isTimeoutError } from '../utils/retry.js'

// iFood API base URLs (sandbox and production)
const IFOOD_API_BASE_SANDBOX = 'https://merchant-api.ifood.com.br'
const IFOOD_API_BASE_PRODUCTION = 'https://merchant-api.ifood.com.br'

interface IfoodConfig {
  id?: number
  merchant_id: string
  client_id: string
  client_secret: string
  authorization_code?: string | null
  access_token?: string | null
  token_expires_at?: string | null
  refresh_token?: string | null
  polling_interval?: number
  is_active?: boolean
  last_sync_at?: string | null
}

interface IfoodTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token?: string
}

export interface IfoodOrder {
  id: string
  shortReference: string
  displayId: string
  orderTiming: string
  salesChannel: string
  createdAt: string
  preparationTimeInSeconds?: number
  items: IfoodOrderItem[]
  customer: {
    id: string
    name: string
    phoneNumber?: string
  }
  delivery?: {
    address: {
      street: string
      number: string
      complement?: string
      neighborhood: string
      city: string
      state: string
      zipCode: string
    }
  }
  totalPrice: {
    amount: number
    currency: string
  }
  payments: Array<{
    method: string
    value: number
  }>
}

export interface IfoodOrderItem {
  id: string
  name: string
  quantity: number
  unitPrice: number
  totalPrice: number
  externalCode?: string
  sku?: string
}

export interface IfoodProduct {
  id: string
  name: string
  sku?: string
  externalCode?: string
}

export class IfoodService {
  private supabase: SupabaseClient
  private apiClient: AxiosInstance | null = null
  private config: IfoodConfig | null = null
  private useSandbox: boolean

  constructor(useSandbox: boolean = false) {
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      const missing = []
      if (!supabaseUrl) missing.push('SUPABASE_URL')
      if (!supabaseServiceKey) missing.push('SUPABASE_SERVICE_ROLE_KEY')
      throw new Error(`Credenciais do Supabase não configuradas. Variáveis faltando: ${missing.join(', ')}`)
    }

    this.supabase = createClient(supabaseUrl, supabaseServiceKey)
    this.useSandbox = useSandbox
  }

  /**
   * Get or create iFood integration config
   */
  async getConfig(): Promise<IfoodConfig | null> {
    try {
      const { data, error } = await this.supabase
        .from('ifood_integration')
        .select('*')
        .limit(1)
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error fetching ifood config:', error)
        return null
      }

      if (data) {
        // Decrypt client_secret
        if (data.client_secret) {
          try {
            data.client_secret = decrypt(data.client_secret)
          } catch (e) {
            console.error('Error decrypting client_secret:', e)
          }
        }
        this.config = data
        return data
      }

      return null
    } catch (error) {
      console.error('Error in getConfig:', error)
      return null
    }
  }

  /**
   * Save or update iFood integration config
   */
  async saveConfig(config: Omit<IfoodConfig, 'id'>): Promise<{ success: boolean; error?: string }> {
    try {
      // Encrypt client_secret before saving
      const encryptedSecret = encrypt(config.client_secret)

      const configToSave = {
        ...config,
        client_secret: encryptedSecret
      }

      // Check if config exists
      const existing = await this.getConfig()

      let result
      if (existing?.id) {
        // Update existing
        const { error } = await this.supabase
          .from('ifood_integration')
          .update(configToSave)
          .eq('id', existing.id)
        result = { error }
      } else {
        // Insert new
        const { error } = await this.supabase
          .from('ifood_integration')
          .insert([configToSave])
        result = { error }
      }

      if (result.error) {
        return { success: false, error: result.error.message }
      }

      // Reload config
      await this.getConfig()
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to save config' }
    }
  }

  /**
   * Authenticate with iFood API and get access token
   */
  async authenticate(): Promise<{ success: boolean; error?: string }> {
    if (!this.config) {
      const config = await this.getConfig()
      if (!config) {
        return { success: false, error: 'iFood config not found' }
      }
    }

    try {
      const baseUrl = this.useSandbox ? IFOOD_API_BASE_SANDBOX : IFOOD_API_BASE_PRODUCTION
      
      const response = await axios.post<IfoodTokenResponse>(
        `${baseUrl}/authentication/v1.0/oauth/token`,
        new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.config!.client_id,
          client_secret: this.config!.client_secret
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      )

      const { access_token, expires_in, refresh_token } = response.data

      // Calculate expiration time
      const expiresAt = new Date(Date.now() + expires_in * 1000)

      // Update config with new token
      await this.supabase
        .from('ifood_integration')
        .update({
          access_token: access_token,
          token_expires_at: expiresAt.toISOString(),
          refresh_token: refresh_token || null
        })
        .eq('id', this.config!.id)

      this.config!.access_token = access_token
      this.config!.token_expires_at = expiresAt.toISOString()
      if (refresh_token) {
        this.config!.refresh_token = refresh_token
      }

      // Initialize API client
      this.initializeApiClient(access_token)

      return { success: true }
    } catch (error: any) {
      console.error('iFood authentication error:', error.response?.data || error.message)
      return { 
        success: false, 
        error: error.response?.data?.message || error.message || 'Authentication failed' 
      }
    }
  }

  /**
   * Check if token is valid and refresh if needed
   */
  async ensureAuthenticated(): Promise<boolean> {
    if (!this.config) {
      await this.getConfig()
    }

    if (!this.config?.access_token) {
      const authResult = await this.authenticate()
      return authResult.success
    }

    // Check if token is expired (with 5 minute buffer)
    const expiresAt = this.config.token_expires_at 
      ? new Date(this.config.token_expires_at)
      : null

    if (expiresAt && expiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
      // Token expired or about to expire, refresh
      return (await this.authenticate()).success
    }

    // Initialize API client if not already done
    if (!this.apiClient) {
      this.initializeApiClient(this.config.access_token!)
    }

    return true
  }

  /**
   * Initialize API client with access token
   * Following iFood best practices: timeout configurável, retry para 5XX
   */
  private initializeApiClient(accessToken: string) {
    const baseUrl = this.useSandbox ? IFOOD_API_BASE_SANDBOX : IFOOD_API_BASE_PRODUCTION
    const timeout = parseInt(process.env.IFOOD_API_TIMEOUT || '30000', 10)

    this.apiClient = axios.create({
      baseURL: baseUrl,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      timeout: timeout
    })

    // Add response interceptor for error handling
    this.apiClient.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        // Handle 401 - Token expired
        if (error.response?.status === 401) {
          console.log('Token expired (401), refreshing...')
          const authResult = await this.authenticate()
          if (authResult.success && this.apiClient) {
            // Retry original request with new token
            const config = error.config
            if (config) {
              config.headers.Authorization = `Bearer ${this.config?.access_token}`
              return this.apiClient.request(config)
            }
          }
        }

        // Handle 403 - Access denied
        if (error.response?.status === 403) {
          console.error('Access denied (403). Check merchant access and pending requests.')
        }

        // Handle timeout
        if (isTimeoutError(error)) {
          console.error('Connection timeout. Test connectivity and notify user.')
        }

        return Promise.reject(error)
      }
    )
  }

  /**
   * Get orders from iFood
   * Following iFood best practices: retry on 5XX, use x-polling-merchants header when needed
   */
  async getOrders(status?: string): Promise<{ success: boolean; orders?: IfoodOrder[]; error?: string }> {
    const authenticated = await this.ensureAuthenticated()
    if (!authenticated) {
      return { success: false, error: 'Failed to authenticate with iFood' }
    }

    try {
      const merchantId = this.config!.merchant_id
      const endpoint = status 
        ? `/order/v1.0/events/orders:${status}`
        : `/order/v1.0/events/orders:placed`

      // Use retry for 5XX errors (iFood best practice)
      const response = await withRetry(
        () => this.apiClient!.get<IfoodOrder[]>(
          `/merchants/${merchantId}${endpoint}`,
          {
            // Add x-polling-merchants header if needed (for 100+ merchants)
            // headers: {
            //   'x-polling-merchants': merchantId
            // }
          }
        ),
        {
          maxRetries: 3,
          retryDelay: 1000
        }
      )

      return { success: true, orders: response.data }
    } catch (error: any) {
      console.error('Error fetching orders from iFood:', error.response?.data || error.message)
      
      // If timeout, notify about connectivity issues (iFood best practice)
      if (isTimeoutError(error)) {
        return {
          success: false,
          error: 'Timeout na conexão com iFood. Verifique sua conectividade.'
        }
      }

      return { 
        success: false, 
        error: error.response?.data?.message || error.message || 'Failed to fetch orders' 
      }
    }
  }

  /**
   * Get order details
   * iFood best practice: Consultar apenas uma vez. Detalhes são imutáveis.
   * Não consultar pedidos após 8 horas do horário de entrega.
   */
  async getOrderDetails(orderId: string): Promise<{ success: boolean; order?: IfoodOrder; error?: string }> {
    const authenticated = await this.ensureAuthenticated()
    if (!authenticated) {
      return { success: false, error: 'Failed to authenticate with iFood' }
    }

    try {
      const merchantId = this.config!.merchant_id
      
      // Use retry for 5XX errors
      const response = await withRetry(
        () => this.apiClient!.get<IfoodOrder>(
          `/merchants/${merchantId}/orders/${orderId}`
        ),
        {
          maxRetries: 3,
          retryDelay: 1000
        }
      )

      // iFood best practice: Verificar se pedido não é muito antigo (8 horas)
      const order = response.data
      if (order.createdAt) {
        const orderDate = new Date(order.createdAt)
        const hoursSinceOrder = (Date.now() - orderDate.getTime()) / (1000 * 60 * 60)
        
        if (hoursSinceOrder > 8) {
          console.warn(`Pedido ${orderId} tem mais de 8 horas. Não deve ser consultado/atualizado.`)
          return {
            success: false,
            error: 'Pedido muito antigo (mais de 8 horas). A API não é um backup de dados.'
          }
        }
      }

      return { success: true, order }
    } catch (error: any) {
      console.error('Error fetching order details from iFood:', error.response?.data || error.message)
      return { 
        success: false, 
        error: error.response?.data?.message || error.message || 'Failed to fetch order details' 
      }
    }
  }

  /**
   * Update order status in iFood
   * Following iFood best practices:
   * - Consult order details before confirming/canceling (should be done by caller)
   * - Status 202 means async operation - wait for confirmation event in polling
   * - Use retry for 5XX errors
   */
  async updateOrderStatus(
    orderId: string, 
    status: 'PLACED' | 'CONFIRMED' | 'SEPARATION_STARTED' | 'SEPARATION_ENDED' | 'READY_TO_PICKUP' | 'DISPATCHED' | 'CONCLUDED' | 'CANCELLED'
  ): Promise<{ success: boolean; error?: string; isAsync?: boolean }> {
    const authenticated = await this.ensureAuthenticated()
    if (!authenticated) {
      return { success: false, error: 'Failed to authenticate with iFood' }
    }

    try {
      const merchantId = this.config!.merchant_id
      
      // Use retry for 5XX errors
      const response = await withRetry(
        () => this.apiClient!.patch(
          `/merchants/${merchantId}/orders/${orderId}/status`,
          { status }
        ),
        {
          maxRetries: 3,
          retryDelay: 1000
        }
      )

      // Status 202 means async operation (iFood best practice)
      const isAsync = response.status === 202
      if (isAsync) {
        console.log(`Order ${orderId} status update is async. Wait for confirmation event in polling.`)
      }

      return { success: true, isAsync }
    } catch (error: any) {
      console.error('Error updating order status in iFood:', error.response?.data || error.message)
      return { 
        success: false, 
        error: error.response?.data?.message || error.message || 'Failed to update order status' 
      }
    }
  }

  /**
   * Get products from iFood
   */
  async getProducts(): Promise<{ success: boolean; products?: IfoodProduct[]; error?: string }> {
    const authenticated = await this.ensureAuthenticated()
    if (!authenticated) {
      return { success: false, error: 'Failed to authenticate with iFood' }
    }

    try {
      const merchantId = this.config!.merchant_id
      const response = await this.apiClient!.get<IfoodProduct[]>(
        `/merchants/${merchantId}/catalog/products`
      )

      return { success: true, products: response.data }
    } catch (error: any) {
      console.error('Error fetching products from iFood:', error.response?.data || error.message)
      return { 
        success: false, 
        error: error.response?.data?.message || error.message || 'Failed to fetch products' 
      }
    }
  }

  /**
   * Map iFood product to system product by SKU
   */
  async mapProductBySku(ifoodProductId: string, ifoodSku: string): Promise<{ success: boolean; productId?: number; error?: string }> {
    try {
      // First, check if mapping already exists
      const { data: existingMapping } = await this.supabase
        .from('ifood_product_mapping')
        .select('product_id')
        .eq('ifood_product_id', ifoodProductId)
        .single()

      if (existingMapping) {
        return { success: true, productId: existingMapping.product_id }
      }

      // Try to find product by SKU in system
      const { data: product } = await this.supabase
        .from('products')
        .select('id')
        .eq('sku', ifoodSku)
        .single()

      if (product) {
        // Create mapping
        await this.supabase
          .from('ifood_product_mapping')
          .insert({
            ifood_product_id: ifoodProductId,
            ifood_sku: ifoodSku,
            product_id: product.id
          })

        return { success: true, productId: product.id }
      }

      return { success: false, error: 'Product not found by SKU' }
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to map product' }
    }
  }

  /**
   * Create manual product mapping
   */
  async createProductMapping(
    ifoodProductId: string,
    ifoodSku: string | null,
    productId: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase
        .from('ifood_product_mapping')
        .insert({
          ifood_product_id: ifoodProductId,
          ifood_sku: ifoodSku,
          product_id: productId
        })

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to create mapping' }
    }
  }

  /**
   * Get product mappings
   */
  async getProductMappings(): Promise<{ success: boolean; mappings?: any[]; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from('ifood_product_mapping')
        .select(`
          *,
          products (
            id,
            name,
            price,
            sku
          )
        `)

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, mappings: data || [] }
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to fetch mappings' }
    }
  }

  /**
   * Update last sync time
   */
  async updateLastSync(): Promise<void> {
    if (this.config?.id) {
      await this.supabase
        .from('ifood_integration')
        .update({ last_sync_at: new Date().toISOString() })
        .eq('id', this.config.id)
    }
  }
}

