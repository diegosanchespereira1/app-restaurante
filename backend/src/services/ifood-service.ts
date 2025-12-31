import axios, { AxiosInstance, AxiosError } from 'axios'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { encrypt, decrypt } from '../utils/encryption.js'
import { withRetry, isTimeoutError } from '../utils/retry.js'

// iFood API base URLs (sandbox and production)
// Base URL for authentication endpoints
const IFOOD_API_BASE_SANDBOX = 'https://merchant-api.ifood.com.br/authentication/v1.0'
const IFOOD_API_BASE_PRODUCTION = 'https://merchant-api.ifood.com.br/authentication/v1.0'
// Base URL for other endpoints (order, merchants, catalog)
const IFOOD_API_BASE_OTHER = 'https://merchant-api.ifood.com.br'

interface IfoodConfig {
  id?: number
  merchant_id: string
  client_id: string
  client_secret: string
  authorization_code?: string | null
  authorization_code_verifier?: string | null
  access_token?: string | null
  token_expires_at?: string | null
  refresh_token?: string | null
  polling_interval?: number
  is_active?: boolean
  last_sync_at?: string | null
}

interface IfoodTokenResponse {
  accessToken?: string
  access_token?: string // Support both formats
  token_type?: string
  type?: string // Support both formats
  expiresIn?: number
  expires_in?: number // Support both formats
  refreshToken?: string
  refresh_token?: string // Support both formats
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
   * Get authorization code verifier from /oauth/userCode API
   * The API requires application/x-www-form-urlencoded format with only clientId in body
   * 
   * Documentation: See IFOOD_AUTHENTICATION.md for official authentication documentation
   */
  async getUserCodeVerifier(clientId: string): Promise<{ success: boolean; verifier?: string; error?: string }> {
    try {
      const baseUrl = this.useSandbox ? IFOOD_API_BASE_SANDBOX : IFOOD_API_BASE_PRODUCTION
      
      // The API requires only clientId as form data (x-www-form-urlencoded)
      const formData = new URLSearchParams()
      formData.append('clientId', clientId)
      
      const response = await axios.post<{ authorizationCodeVerifier: string }>(
        `${baseUrl}/oauth/userCode`,
        formData.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'accept': 'application/json'
          },
          timeout: 30000
        }
      )

      return {
        success: true,
        verifier: response.data.authorizationCodeVerifier
      }
    } catch (error: any) {
      console.error('Error fetching userCode verifier:', error.response?.data || error.message)
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Failed to fetch authorization code verifier'
      }
    }
  }

  /**
   * Authenticate with iFood API and get access token
   * Supports client_credentials, authorization_code, and refresh_token flows
   * 
   * Documentation: See IFOOD_AUTHENTICATION.md for official authentication documentation
   * API Reference: https://developer.ifood.com.br/pt-BR/docs/references/#operations-OAuth-oauthTokenV1
   */
  async authenticate(
    useRefreshToken: boolean = false, 
    authorizationCode?: string,
    authorizationCodeVerifier?: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.config) {
      const config = await this.getConfig()
      if (!config) {
        return { success: false, error: 'iFood config not found' }
      }
    }

    // Determine grant type based on available credentials (outside try for error handling)
    // refresh_token is the DEFAULT grant type when refresh_token is available
    // The authorizationCodeVerifier is required when using refresh_token
    let grantType: 'client_credentials' | 'authorization_code' | 'refresh_token' = 'client_credentials'
    
    // Get authorizationCodeVerifier from parameter or config
    let verifier: string | null | undefined = authorizationCodeVerifier || this.config!.authorization_code_verifier
    // Normalize: convert null/undefined to null, ensure it's a string if it exists
    if (verifier === undefined || verifier === null || (typeof verifier === 'string' && verifier.trim() === '')) {
      verifier = null
    }
    
    // refresh_token is the DEFAULT - use it if we have refresh_token
    if (this.config!.refresh_token) {
      grantType = 'refresh_token'
      // Validate that authorizationCodeVerifier is available when using refresh_token
      if (!verifier) {
        // Don't log error here - let ensureAuthenticated handle automatic retrieval
        // This allows graceful fallback to other flows
        return {
          success: false,
          error: 'authorizationCodeVerifier é obrigatório quando usar refresh_token. O sistema tentará obter automaticamente.'
        }
      }
    } else {
      // No refresh_token - use authorization_code or client_credentials
      const authCode = authorizationCode || this.config!.authorization_code
      const hasAuthorizationCode = authCode && authCode.trim() !== ''
      grantType = hasAuthorizationCode ? 'authorization_code' : 'client_credentials'
    }
    
    try {
      const baseUrl = this.useSandbox ? IFOOD_API_BASE_SANDBOX : IFOOD_API_BASE_PRODUCTION
      
      // Build params object using camelCase as per iFood API documentation
      // Keys must be exactly: grantType, clientId, clientSecret, refreshToken, authorizationCode, authorizationCodeVerifier
      // Reference: https://developer.ifood.com.br/pt-BR/docs/references/#operations-OAuth-oauthTokenV1
      const params: Record<string, string> = {
        grantType: grantType,
        clientId: String(this.config!.client_id || ''),
        clientSecret: String(this.config!.client_secret || '')
      }
      
      // Get authorization code (from parameter or config)
      const authCode = authorizationCode || this.config!.authorization_code
      
      // When using refresh_token flow, also include refreshToken and authorizationCodeVerifier in body
      // authorizationCodeVerifier is REQUIRED when using refresh_token
      // Keys must be exactly: grantType, clientId, clientSecret, refreshToken, authorizationCodeVerifier (and optionally authorizationCode)
      if (grantType === 'refresh_token' && this.config!.refresh_token) {
        params.refreshToken = String(this.config!.refresh_token)
        // authorizationCodeVerifier is REQUIRED for refresh_token flow - must be a valid non-empty string
        if (!verifier) {
          return {
            success: false,
            error: 'authorizationCodeVerifier é obrigatório quando usar refresh_token. Obtenha via /api/ifood/user-code primeiro.'
          }
        }
        params.authorizationCodeVerifier = String(verifier)
        // Include authorizationCode if available (optional)
        if (authCode && authCode.trim() !== '') {
          params.authorizationCode = String(authCode)
        }
      }
      
      // Add authorization code if using authorization_code flow
      if (grantType === 'authorization_code' && authCode) {
        params.code = String(authCode)
        // Also include authorizationCode in body (not just code)
        params.authorizationCode = String(authCode)
        // When using authorization_code flow, also include refreshToken in body if available
        if (this.config!.refresh_token) {
          params.refreshToken = String(this.config!.refresh_token)
        }
        // Include authorizationCodeVerifier if available (from parameter or config)
        if (verifier) {
          params.authorizationCodeVerifier = String(verifier)
        }
      }
      
      console.log(`Tentando autenticar com grantType: ${grantType}`)
      console.log(`Params sendo enviados:`, { 
        grantType: params.grantType,
        clientId: params.clientId,
        clientSecret: '***', 
        refreshToken: params.refreshToken ? '***' : undefined, 
        code: params.code ? '***' : undefined, 
        authorizationCode: params.authorizationCode ? '***' : undefined, 
        authorizationCodeVerifier: params.authorizationCodeVerifier ? '***' : 'MISSING' 
      })
      
      // Create URLSearchParams ensuring all values are strings
      // Keys must be exactly as expected: grantType, clientId, clientSecret, refreshToken, authorizationCode, authorizationCodeVerifier
      const searchParams = new URLSearchParams()
      searchParams.append('grantType', grantType)
      searchParams.append('clientId', params.clientId)
      searchParams.append('clientSecret', params.clientSecret)
      
      // Add refresh token if present (for refresh_token flow)
      if (params.refreshToken) {
        searchParams.append('refreshToken', params.refreshToken)
      }
      
      // Add authorization code if present (for authorization_code flow)
      if (params.code) {
        searchParams.append('code', params.code)
      }
      
      // Add authorizationCode in body (optional for refresh_token, required for authorization_code)
      if (params.authorizationCode) {
        searchParams.append('authorizationCode', params.authorizationCode)
      }
      
      // Add authorizationCodeVerifier in body (REQUIRED for refresh_token, optional for authorization_code)
      // This must be present when using refresh_token flow
      if (params.authorizationCodeVerifier) {
        searchParams.append('authorizationCodeVerifier', params.authorizationCodeVerifier)
      } else if (grantType === 'refresh_token') {
        // This should never happen because we validate earlier, but double-check
        // Don't log error here - already handled in earlier validation
        return {
          success: false,
          error: 'authorizationCodeVerifier é obrigatório quando usar refresh_token. O sistema tentará obter automaticamente.'
        }
      }
      
      // Log the final URLSearchParams (without sensitive data)
      const logParams = searchParams.toString().replace(/clientSecret=[^&]+/g, 'clientSecret=***').replace(/refreshToken=[^&]+/g, 'refreshToken=***').replace(/authorizationCodeVerifier=[^&]+/g, 'authorizationCodeVerifier=***')
      console.log(`URLSearchParams final (sanitized):`, logParams)
      
      // Build headers - grantType, authorizationCode and authorizationCodeVerifier go in body, not header
      const headers: Record<string, string> = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'accept': 'application/json'
      }
      
      const response = await axios.post<IfoodTokenResponse>(
        `${baseUrl}/oauth/token`,
        searchParams.toString(),
        {
          headers: headers,
          timeout: 30000
        }
      )

      // Handle both camelCase and snake_case response formats
      const accessToken = response.data.accessToken || response.data.access_token
      const expiresIn = response.data.expiresIn || response.data.expires_in
      const refreshToken = response.data.refreshToken || response.data.refresh_token

      if (!accessToken || !expiresIn) {
        return {
          success: false,
          error: 'Resposta inválida da API: accessToken e expiresIn são obrigatórios'
        }
      }

      // Calculate expiration time
      const expiresAt = new Date(Date.now() + expiresIn * 1000)

      // Preserve existing refresh_token if new one is not provided
      const finalRefreshToken = refreshToken || this.config!.refresh_token || null

      // Update config with new token
      await this.supabase
        .from('ifood_integration')
        .update({
          access_token: accessToken,
          token_expires_at: expiresAt.toISOString(),
          refresh_token: finalRefreshToken
        })
        .eq('id', this.config!.id)

      this.config!.access_token = accessToken
      this.config!.token_expires_at = expiresAt.toISOString()
      this.config!.refresh_token = finalRefreshToken

      // Initialize API client
      this.initializeApiClient(accessToken)

      return { success: true }
    } catch (error: any) {
      console.error('iFood authentication error:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
        url: error.config?.url
      })
      
      // Mensagens de erro mais específicas com informações de troubleshooting
      let errorMessage = 'Falha na autenticação com iFood'
      let troubleshootingTips: string[] = []
      
      if (error.response) {
        const status = error.response.status
        const data = error.response.data
        
        switch (status) {
          case 400:
            errorMessage = 'Credenciais inválidas ou parâmetros incorretos.'
            if (data?.error?.message) {
              errorMessage += ` Erro: ${data.error.message}`
            }
            if (data?.error_description) {
              errorMessage += ` Detalhes: ${data.error_description}`
            }
            troubleshootingTips.push('Verifique se o Client ID está correto')
            troubleshootingTips.push('Verifique se o Client Secret está correto')
            if (grantType === 'authorization_code') {
              troubleshootingTips.push('Verifique se o Authorization Code está válido e não expirou')
              troubleshootingTips.push('O Authorization Code pode ter sido usado apenas uma vez - gere um novo se necessário')
            }
            troubleshootingTips.push('Verifique se as credenciais estão ativas no painel do iFood')
            break
          case 401:
            errorMessage = 'Não autorizado. As credenciais fornecidas não foram aceitas.'
            troubleshootingTips.push('Verifique se o Client ID está correto')
            troubleshootingTips.push('Verifique se o Client Secret está correto')
            troubleshootingTips.push('Verifique se as credenciais não expiraram no painel do iFood')
            break
          case 403:
            errorMessage = 'Acesso negado. O merchant pode não ter permissão para usar a API.'
            troubleshootingTips.push('Verifique se o Merchant ID está correto')
            troubleshootingTips.push('Verifique se o merchant tem acesso à API do iFood')
            troubleshootingTips.push('Entre em contato com o suporte do iFood para verificar permissões')
            break
          case 404:
            errorMessage = 'Endpoint não encontrado. A URL da API do iFood pode estar incorreta.'
            troubleshootingTips.push('Verifique se está usando a URL correta da API do iFood')
            troubleshootingTips.push('Verifique se o ambiente (sandbox/produção) está correto')
            break
          case 500:
          case 502:
          case 503:
          case 504:
            errorMessage = `Erro no servidor do iFood (HTTP ${status}). O servidor pode estar temporariamente indisponível.`
            troubleshootingTips.push('Aguarde alguns minutos e tente novamente')
            troubleshootingTips.push('Verifique o status da API do iFood')
            break
          default:
            errorMessage = `Erro HTTP ${status}: ${error.response.statusText}`
            if (data?.message) {
              errorMessage += ` - ${data.message}`
            }
            if (data?.error_description) {
              errorMessage += ` - ${data.error_description}`
            }
        }
      } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        errorMessage = 'Não foi possível conectar ao servidor do iFood.'
        troubleshootingTips.push('Verifique sua conexão com a internet')
        troubleshootingTips.push('Verifique se o servidor do iFood está acessível')
        troubleshootingTips.push('Verifique se há firewall ou proxy bloqueando a conexão')
      } else if (isTimeoutError(error)) {
        errorMessage = 'Timeout na conexão com iFood. A requisição demorou muito para responder.'
        troubleshootingTips.push('Verifique sua conexão com a internet')
        troubleshootingTips.push('Tente novamente em alguns instantes')
        troubleshootingTips.push('Verifique se há problemas de rede ou firewall')
      } else {
        errorMessage = `Erro desconhecido: ${error.message || 'Erro na autenticação'}`
      }
      
      // Adicionar informações de contexto
      const contextInfo = []
      if (grantType) {
        contextInfo.push(`Grant Type: ${grantType}`)
      }
      if (this.config?.merchant_id) {
        contextInfo.push(`Merchant ID: ${this.config.merchant_id}`)
      }
      if (this.config?.client_id) {
        contextInfo.push(`Client ID: ${this.config.client_id.substring(0, 8)}...`)
      }
      
      if (contextInfo.length > 0) {
        errorMessage += ` (${contextInfo.join(', ')})`
      }
      
      // Adicionar dicas de troubleshooting se houver
      if (troubleshootingTips.length > 0) {
        errorMessage += `\n\nDicas para resolver:\n${troubleshootingTips.map((tip, i) => `${i + 1}. ${tip}`).join('\n')}`
      }
      
      return { 
        success: false, 
        error: errorMessage
      }
    }
  }

  /**
   * Check if token is valid and refresh if needed
   * Returns detailed error information for troubleshooting
   */
  async ensureAuthenticated(): Promise<{ success: boolean; error?: string }> {
    if (!this.config) {
      const config = await this.getConfig()
      if (!config) {
        return {
          success: false,
          error: 'Configuração do iFood não encontrada. Configure as credenciais primeiro.'
        }
      }
    }

    // Check if config has required fields
    if (!this.config?.client_id || !this.config?.client_secret) {
      return {
        success: false,
        error: 'Credenciais do iFood não configuradas. Verifique se Client ID e Client Secret estão preenchidos.'
      }
    }

    if (!this.config?.access_token) {
      const authResult = await this.authenticate()
      if (!authResult.success) {
        return {
          success: false,
          error: authResult.error || 'Falha na autenticação com iFood. Verifique as credenciais e tente novamente.'
        }
      }
      return { success: true }
    }

    // Check if token is expired (with 5 minute buffer)
    const expiresAt = this.config.token_expires_at
      ? new Date(this.config.token_expires_at)
      : null

    if (expiresAt && expiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
      // Token expired or about to expire, try refresh_token first, then fallback to full auth
      let authResult
      if (this.config!.refresh_token) {
        // When using refresh_token, we need authorizationCodeVerifier
        // Try to get verifier from config first, if not available, try to obtain it automatically
        let verifier = this.config!.authorization_code_verifier
        
        // If verifier is missing, try to obtain it automatically via /oauth/userCode API
        if (!verifier || verifier.trim() === '') {
          console.log('authorizationCodeVerifier não encontrado na config. Tentando obter automaticamente...')
          const verifierResult = await this.getUserCodeVerifier(this.config!.client_id)
          
          if (verifierResult.success && verifierResult.verifier) {
            verifier = verifierResult.verifier
            // Save verifier to config for future use
            await this.supabase
              .from('ifood_integration')
              .update({ authorization_code_verifier: verifier })
              .eq('id', this.config!.id)
            // Update in-memory config
            this.config!.authorization_code_verifier = verifier
            console.log('authorizationCodeVerifier obtido e salvo com sucesso')
          } else {
            console.warn('Não foi possível obter authorizationCodeVerifier automaticamente. Fazendo fallback para outros fluxos.')
          }
        }
        
        // Try refresh_token flow if we have verifier
        if (verifier && verifier.trim() !== '') {
          authResult = await this.authenticate(true, undefined, verifier) // Use refresh_token flow with verifier
        } else {
          console.log('authorizationCodeVerifier não disponível. Fazendo fallback para outros fluxos de autenticação.')
        }
      }
      
      // If refresh_token failed or doesn't exist, fallback to full authentication
      if (!authResult || !authResult.success) {
        authResult = await this.authenticate(false) // Use client_credentials or authorization_code
      }
      
      if (!authResult.success) {
        return {
          success: false,
          error: authResult.error || 'Falha ao renovar token de autenticação. Verifique as credenciais.'
        }
      }
      return { success: true }
    }

    // Initialize API client if not already done
    if (!this.apiClient) {
      this.initializeApiClient(this.config.access_token!)
    }

    return { success: true }
  }

  /**
   * Check if token is expired
   */
  async isTokenExpired(): Promise<boolean> {
    if (!this.config?.token_expires_at) {
      return true // No expiration time means expired
    }

    const expiresAt = new Date(this.config.token_expires_at)
    const now = new Date()
    
    // Token is expired if current time is after expiration time
    return now >= expiresAt
  }

  /**
   * Initialize API client with access token
   * Following iFood best practices: timeout configurável, retry para 5XX
   */
  private initializeApiClient(accessToken: string) {
    // Use base URL for other endpoints (not authentication)
    const baseUrl = IFOOD_API_BASE_OTHER
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
   * Poll events from iFood (polling endpoint)
   * Format: GET /events:polling?types=PLC,REC,CFM&groups=ORDER_STATUS,DELIVERY&categories=FOOD
   * Following iFood best practices: retry on 5XX, use Bearer token
   * Documentation: https://developer.ifood.com.br/pt-BR/docs/guides/modules/events/polling-overview
   */
  async pollEvents(): Promise<{ success: boolean; orders?: IfoodOrder[]; error?: string }> {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/b058c8da-e202-4622-9483-5c45531d7867',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ifood-service.ts:693',message:'pollEvents called',data:{before_auth:true},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    const authResult = await this.ensureAuthenticated()
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/b058c8da-e202-4622-9483-5c45531d7867',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ifood-service.ts:696',message:'auth result',data:{success:authResult.success,error:authResult.error||null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    if (!authResult.success) {
      return { 
        success: false, 
        error: authResult.error || 'Falha na autenticação com iFood ao buscar eventos.' 
      }
    }

    try {
      const merchantId = this.config!.merchant_id
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/b058c8da-e202-4622-9483-5c45531d7867',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ifood-service.ts:703',message:'starting polling',data:{merchantId,hasApiClient:!!this.apiClient},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      
      // According to iFood API documentation (https://developer.ifood.com.br/pt-BR/docs/guides/modules/events/polling-overview):
      // Endpoint format: GET /events/v1.0/polling?types=PLC,REC,CFM&groups=ORDER_STATUS,DELIVERY&categories=FOOD
      const endpoint = `/events/v1.0/polling?types=PLC,REC,CFM&groups=ORDER_STATUS,DELIVERY&categories=FOOD`
      
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/b058c8da-e202-4622-9483-5c45531d7867',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ifood-service.ts:714',message:'calling polling endpoint',data:{endpoint,fullUrl:`${this.apiClient!.defaults.baseURL}${endpoint}`},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      
      const response = await withRetry(
        () => this.apiClient!.get(endpoint),
        {
          maxRetries: 2,
          retryDelay: 500
        }
      )
      
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/b058c8da-e202-4622-9483-5c45531d7867',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ifood-service.ts:722',message:'polling endpoint response',data:{status:response.status,statusText:response.statusText,hasData:!!response.data,dataType:Array.isArray(response.data)?'array':typeof response.data},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion

      // Response codes: 200 = events available, 204 = no new events
      if (response.status === 204) {
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/b058c8da-e202-4622-9483-5c45531d7867',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ifood-service.ts:748',message:'204 no content - returning empty',data:{status:204},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        return { success: true, orders: [] }
      }

      // Response data may be an array of events or an object with events array
      // According to iFood API, events structure can vary:
      // - Direct array: [event1, event2, ...]
      // - Object with events property: { events: [event1, event2, ...] }
      // - Object with data property: { data: [event1, event2, ...] }
      let events: any[] = []
      
      if (Array.isArray(response.data)) {
        events = response.data
      } else if (response.data && typeof response.data === 'object') {
        // Try different possible structures
        events = response.data.events || response.data.data || response.data.items || []
        
        // If still empty, check if response.data itself is an event (single event)
        if (events.length === 0 && response.data.id) {
          events = [response.data]
        }
      }
      
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/b058c8da-e202-4622-9483-5c45531d7867',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ifood-service.ts:753',message:'events extracted',data:{eventsCount:events.length,isArray:Array.isArray(response.data),responseDataType:typeof response.data,hasEvents:!!response.data?.events,hasData:!!response.data?.data,hasItems:!!response.data?.items,responseDataKeys:response.data?Object.keys(response.data):null,firstEventSample:events[0]?JSON.stringify(events[0]).substring(0,500):null,fullResponseDataSample:response.data?JSON.stringify(response.data).substring(0,500):null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      
      return { success: true, orders: events }
    } catch (error: any) {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/b058c8da-e202-4622-9483-5c45531d7867',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ifood-service.ts:757',message:'pollEvents error',data:{errorMessage:error.message,status:error.response?.status,errorData:error.response?.data?JSON.stringify(error.response.data).substring(0,200):null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      console.error('Error polling events from iFood:', error.response?.data || error.message)
      
      // If timeout, notify about connectivity issues (iFood best practice)
      if (isTimeoutError(error)) {
        return {
          success: false,
          error: 'Timeout na conexão com iFood. Verifique sua conectividade.'
        }
      }

      return { 
        success: false, 
        error: error.response?.data?.message || error.message || 'Failed to poll events' 
      }
    }
  }

  /**
   * Get orders from iFood (legacy method - using status filter)
   * Following iFood best practices: retry on 5XX, use x-polling-merchants header when needed
   */
  async getOrders(status?: string): Promise<{ success: boolean; orders?: IfoodOrder[]; error?: string }> {
    const authResult = await this.ensureAuthenticated()
    if (!authResult.success) {
      return {
        success: false,
        error: authResult.error || 'Falha na autenticação com iFood ao buscar pedidos.'
      }
    }

    try {
      const merchantId = this.config!.merchant_id
      const endpoint = `/merchants/${merchantId}/orders?status=${status || 'PLACED'}`

      // Use retry for 5XX errors (iFood best practice)
      const response = await withRetry(
        () => this.apiClient!.get<IfoodOrder[]>(endpoint),
        {
          maxRetries: 3,
          retryDelay: 1000
        }
      )

      return { success: true, orders: Array.isArray(response.data) ? response.data : [] }
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
    const authResult = await this.ensureAuthenticated()
    if (!authResult.success) {
      return {
        success: false,
        error: authResult.error || `Falha na autenticação com iFood ao buscar detalhes do pedido ${orderId}.`
      }
    }

    try {
      // Use retry for 5XX errors
      // According to iFood API: GET /order/v1.0/orders/{orderId}
      // Verified working endpoint format (not /merchants/{merchantId}/orders/{orderId})
      const endpoint = `/order/v1.0/orders/${orderId}`

      const response = await withRetry(
        () => this.apiClient!.get<IfoodOrder>(endpoint),
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
      const statusCode = error.response?.status || error.status
      const errorMessage = error.response?.data?.message || error.message || 'Failed to fetch order details'
      
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/b058c8da-e202-4622-9483-5c45531d7867',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ifood-service.ts:913',message:'getOrderDetails error',data:{orderId,statusCode,errorMessage,hasResponse:!!error.response},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      
      console.error('Error fetching order details from iFood:', error.response?.data || error.message)
      
      // Preserve 404 status from iFood API
      if (statusCode === 404) {
        return { 
          success: false, 
          error: `Pedido não encontrado no iFood (404): ${errorMessage}`
        }
      }
      
      return { 
        success: false, 
        error: errorMessage
      }
    }
  }

  /**
   * Acknowledge events after processing
   * Following iFood best practices:
   * - Send acknowledgment after persisting events
   * - Send acknowledgment for all events, even unused ones
   * - Send acknowledgment only once per event
   * - Limit: up to 2000 IDs per request
   */
  async acknowledgeEvents(eventIds: string[]): Promise<{ success: boolean; error?: string }> {
    const authResult = await this.ensureAuthenticated()
    if (!authResult.success) {
      return { 
        success: false, 
        error: authResult.error || 'Falha na autenticação com iFood ao enviar acknowledgment.' 
      }
    }

    try {
      // iFood API: POST /events/acknowledgment
      // Can send array of event IDs or full event payloads (API uses only the 'id' field)
      // Limit: up to 2000 IDs per request
      const endpoint = `/events/acknowledgment`
      
      const response = await withRetry(
        () => this.apiClient!.post(endpoint, eventIds),
        {
          maxRetries: 3,
          retryDelay: 1000
        }
      )

      return { success: true }
    } catch (error: any) {
      console.error('Error acknowledging events:', error.response?.data || error.message)
      return { 
        success: false, 
        error: error.response?.data?.message || error.message || 'Failed to acknowledge events' 
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
    status: 'PLACED' | 'CONFIRMED' | 'PREPARATION_STARTED' | 'SEPARATION_STARTED' | 'SEPARATION_ENDED' | 'READY_TO_PICKUP' | 'DISPATCHED' | 'CONCLUDED' | 'CANCELLED'
  ): Promise<{ success: boolean; error?: string; isAsync?: boolean }> {
    const authResult = await this.ensureAuthenticated()
    if (!authResult.success) {
      return { 
        success: false, 
        error: authResult.error || `Falha na autenticação com iFood ao atualizar status do pedido ${orderId} para ${status}.` 
      }
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
    const authResult = await this.ensureAuthenticated()
    if (!authResult.success) {
      return { 
        success: false, 
        error: authResult.error || 'Falha na autenticação com iFood ao buscar produtos.' 
      }
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

