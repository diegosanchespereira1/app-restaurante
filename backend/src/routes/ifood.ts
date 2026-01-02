import { Router, type Request, type Response } from 'express'
import { IfoodService } from '../services/ifood-service.js'
import { IfoodPollingService } from '../services/ifood-polling.js'

const router = Router()

// Singleton instance of polling service
let pollingService: IfoodPollingService | null = null

function getPollingService(): IfoodPollingService {
  if (!pollingService) {
    pollingService = new IfoodPollingService()
  }
  return pollingService
}

/**
 * POST /api/ifood/config
 * Configure iFood integration credentials
 */
router.post('/config', async (req: Request, res: Response) => {
  try {
    const { merchant_id, client_id, client_secret, authorization_code, authorization_code_verifier, polling_interval, is_active } = req.body

    if (!merchant_id || !client_id || !client_secret) {
      return res.status(400).json({
        success: false,
        message: 'Campos obrigatórios: merchant_id, client_id, client_secret'
      })
    }

    // Verificar se Supabase está configurado
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({
        success: false,
        message: 'Supabase não configurado. Configure as variáveis SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no backend.'
      })
    }

    let ifoodService: IfoodService
    try {
      ifoodService = new IfoodService()
    } catch (error) {
      console.error('Erro ao criar IfoodService:', error)
      return res.status(500).json({
        success: false,
        message: `Erro ao inicializar serviço: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
      })
    }

    const result = await ifoodService.saveConfig({
      merchant_id,
      client_id,
      client_secret,
      authorization_code: authorization_code || null,
      authorization_code_verifier: authorization_code_verifier || null,
      polling_interval: polling_interval || 30,
      is_active: is_active !== undefined ? is_active : false
    })

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: result.error || 'Falha ao salvar configuração'
      })
    }

    // Test authentication (opcional - pode falhar se credenciais estiverem erradas)
    // Pass authorizationCode and authorizationCodeVerifier from request body if provided
    const authResult = await ifoodService.authenticate(
      false, 
      authorization_code || undefined,
      authorization_code_verifier || undefined
    )
    if (!authResult.success) {
      // Ainda retorna sucesso, mas avisa sobre a autenticação
      return res.status(200).json({
        success: true,
        message: `Configuração salva, mas falha na autenticação com iFood: ${authResult.error}. Verifique as credenciais.`
      })
    }

    // Restart polling service if active
    try {
      const polling = getPollingService()
      polling.stop()
      if (is_active) {
        await polling.start()
      }
    } catch (pollingError) {
      console.error('Erro ao reiniciar polling service:', pollingError)
      // Não falha a requisição se o polling não iniciar
    }

    res.json({
      success: true,
      message: 'Configuração salva e autenticação realizada com sucesso'
    })
  } catch (error) {
    console.error('Erro ao configurar iFood:', error)
    res.status(500).json({
      success: false,
      message: `Erro interno: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
    })
  }
})

/**
 * GET /api/ifood/config
 * Get current iFood integration configuration
 */
router.get('/config', async (req: Request, res: Response) => {
  try {
    const ifoodService = new IfoodService()
    const config = await ifoodService.getConfig()

    if (!config) {
      return res.status(404).json({
        success: false,
        message: 'Configuração do iFood não encontrada'
      })
    }

    // Don't send client_secret in response
    const { client_secret, ...safeConfig } = config

    res.json({
      success: true,
      config: safeConfig
    })
  } catch (error) {
    console.error('Erro ao buscar configuração do iFood:', error)
    res.status(500).json({
      success: false,
      message: `Erro interno: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
    })
  }
})

/**
 * POST /api/ifood/sync
 * Force manual synchronization
 */
router.post('/sync', async (req: Request, res: Response) => {
  try {
    // Force manual synchronization - restart polling to fetch new events
    const polling = getPollingService()
    polling.stop()
    await polling.start()

    res.json({
      success: true,
      message: 'Sincronização iniciada'
    })
  } catch (error) {
    console.error('Erro ao sincronizar iFood:', error)
    res.status(500).json({
      success: false,
      message: `Erro interno: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
    })
  }
})

/**
 * GET /api/ifood/status
 * Get integration status
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const ifoodService = new IfoodService()
    const config = await ifoodService.getConfig()

    if (!config) {
      return res.json({
        success: true,
        status: {
          configured: false,
          active: false,
          last_sync: null,
          webhook_url: null
        }
      })
    }

    // Test authentication with detailed error
    let authResult = false
    let authError: string | null = null
    
    try {
      const authCheck = await ifoodService.ensureAuthenticated()
      authResult = authCheck.success
      if (!authCheck.success) {
        authError = authCheck.error || 'Falha na autenticação'
      }
    } catch (error: any) {
      authError = error.message || 'Erro desconhecido na autenticação'
      console.error('Erro ao verificar autenticação:', error)
    }
    
    // Se falhou, tentar autenticar novamente para obter erro detalhado
    if (!authResult) {
      const authAttempt = await ifoodService.authenticate()
      if (!authAttempt.success) {
        authError = authAttempt.error || authError || 'Falha na autenticação'
      } else {
        authResult = true
        authError = null
      }
    }

    // Build webhook URL
    // Try to get from environment variable first, then construct from request
    let backendUrl = process.env.BACKEND_URL || process.env.BACKEND_PUBLIC_URL
    
    if (!backendUrl) {
      // Fallback: try to construct from request
      const protocol = req.protocol || 'http'
      const host = req.get('host') || 'localhost:3000'
      backendUrl = `${protocol}://${host}`
    }
    
    // Remove trailing slash if present
    backendUrl = backendUrl.replace(/\/$/, '')
    const webhookUrl = `${backendUrl}/api/ifood/webhook`

    res.json({
      success: true,
      status: {
        configured: true,
        active: config.is_active || false,
        authenticated: authResult,
        auth_error: authError,
        last_sync: config.last_sync_at,
        polling_interval: config.polling_interval,
        webhook_url: webhookUrl
      }
    })
  } catch (error) {
    console.error('Erro ao buscar status do iFood:', error)
    res.status(500).json({
      success: false,
      message: `Erro interno: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
    })
  }
})

/**
 * POST /api/ifood/mapping
 * Create manual product mapping
 */
router.post('/mapping', async (req: Request, res: Response) => {
  try {
    const { ifood_product_id, ifood_sku, product_id } = req.body

    if (!ifood_product_id || !product_id) {
      return res.status(400).json({
        success: false,
        message: 'Campos obrigatórios: ifood_product_id, product_id'
      })
    }

    const ifoodService = new IfoodService()
    const result = await ifoodService.createProductMapping(
      ifood_product_id,
      ifood_sku || null,
      product_id
    )

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: result.error || 'Failed to create mapping'
      })
    }

    res.json({
      success: true,
      message: 'Mapeamento criado com sucesso'
    })
  } catch (error) {
    console.error('Erro ao criar mapeamento:', error)
    res.status(500).json({
      success: false,
      message: `Erro interno: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
    })
  }
})

/**
 * GET /api/ifood/mapping
 * List all product mappings
 */
router.get('/mapping', async (req: Request, res: Response) => {
  try {
    const ifoodService = new IfoodService()
    const result = await ifoodService.getProductMappings()

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: result.error || 'Failed to fetch mappings'
      })
    }

    res.json({
      success: true,
      mappings: result.mappings || []
    })
  } catch (error) {
    console.error('Erro ao buscar mapeamentos:', error)
    res.status(500).json({
      success: false,
      message: `Erro interno: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
    })
  }
})

/**
 * DELETE /api/ifood/mapping/:id
 * Delete a product mapping
 */
router.delete('/mapping/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'ID do mapeamento é obrigatório'
      })
    }

    const ifoodService = new IfoodService()
    const supabase = (ifoodService as any).supabase

    const { error } = await supabase
      .from('ifood_product_mapping')
      .delete()
      .eq('id', id)

    if (error) {
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to delete mapping'
      })
    }

    res.json({
      success: true,
      message: 'Mapeamento deletado com sucesso'
    })
  } catch (error) {
    console.error('Erro ao deletar mapeamento:', error)
    res.status(500).json({
      success: false,
      message: `Erro interno: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
    })
  }
})

/**
 * POST /api/ifood/user-code
 * Get authorization code verifier from iFood /oauth/userCode API
 * Requires clientId from frontend
 */
router.post('/user-code', async (req: Request, res: Response) => {
  try {
    const { clientId } = req.body

    if (!clientId) {
      return res.status(400).json({
        success: false,
        message: 'Campo obrigatório: clientId'
      })
    }

    const ifoodService = new IfoodService()
    const result = await ifoodService.getUserCodeVerifier(clientId)

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: result.error || 'Failed to fetch authorization code verifier'
      })
    }

    res.json({
      success: true,
      data: {
        authorizationCodeVerifier: result.verifier
      }
    })
  } catch (error) {
    console.error('Erro ao buscar authorization code verifier:', error)
    res.status(500).json({
      success: false,
      message: `Erro interno: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
    })
  }
})

/**
 * GET /api/ifood/products
 * Get products from iFood
 */
router.get('/products', async (req: Request, res: Response) => {
  try {
    const ifoodService = new IfoodService()
    const result = await ifoodService.getProducts()

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: result.error || 'Failed to fetch products'
      })
    }

    res.json({
      success: true,
      products: result.products || []
    })
  } catch (error) {
    console.error('Erro ao buscar produtos do iFood:', error)
    res.status(500).json({
      success: false,
      message: `Erro interno: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
    })
  }
})

/**
 * GET /api/ifood/modules
 * Get information about available and implemented modules
 */
router.get('/modules', async (req: Request, res: Response) => {
  try {
    const modules = {
      category: 'FOOD',
      available_modules: [
        {
          name: 'Authentication',
          description: 'Autenticação OAuth 2.0 com suporte a client_credentials, authorization_code e refresh_token',
          implemented: true,
          endpoints: [
            'POST /authentication/v1.0/oauth/token',
            'POST /authentication/v1.0/oauth/userCode'
          ],
          documentation: 'https://developer.ifood.com.br/pt-BR/docs/guides/modules/authentication/'
        },
        {
          name: 'Order',
          description: 'Gerenciamento de pedidos desde o recebimento até a entrega',
          implemented: true,
          endpoints: [
            'GET /order/v1.0/events/orders:{status}',
            'GET /merchants/{merchantId}/orders/{orderId}',
            'PATCH /merchants/{merchantId}/orders/{orderId}/status'
          ],
          documentation: 'https://developer.ifood.com.br/pt-BR/docs/guides/modules/order/'
        },
        {
          name: 'Events',
          description: 'Receba eventos de pedidos em tempo real via polling ou webhook',
          implemented: true,
          endpoints: [
            'POST /api/ifood/webhook'
          ],
          documentation: 'https://developer.ifood.com.br/pt-BR/docs/guides/modules/events/'
        },
        {
          name: 'Catalog',
          description: 'Gerenciamento de cardápios e produtos',
          implemented: true,
          endpoints: [
            'GET /merchants/{merchantId}/catalog/products',
            'GET /api/ifood/products',
            'POST /api/ifood/mapping',
            'GET /api/ifood/mapping',
            'DELETE /api/ifood/mapping/:id'
          ],
          documentation: 'https://developer.ifood.com.br/pt-BR/docs/guides/modules/catalog/'
        },
        {
          name: 'Merchant',
          description: 'Configuração de dados da loja, horários de funcionamento e disponibilidade',
          implemented: false,
          endpoints: [],
          documentation: 'https://developer.ifood.com.br/pt-BR/docs/guides/modules/merchant/'
        },
        {
          name: 'Review',
          description: 'Gerenciamento de avaliações de produtos e estabelecimentos',
          implemented: false,
          endpoints: [],
          documentation: 'https://developer.ifood.com.br/pt-BR/docs/guides/modules/review/'
        },
        {
          name: 'Shipping',
          description: 'Gerenciamento de envio, rastreamento e contratação de serviços de entregas',
          implemented: false,
          endpoints: [],
          documentation: 'https://developer.ifood.com.br/pt-BR/docs/guides/modules/shipping/'
        }
      ],
      implemented_modules: ['Authentication', 'Order', 'Events', 'Catalog'],
      not_implemented_modules: ['Merchant', 'Review', 'Shipping']
    }

    res.json({
      success: true,
      data: modules
    })
  } catch (error) {
    console.error('Erro ao buscar informações de módulos:', error)
    res.status(500).json({
      success: false,
      message: `Erro interno: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
    })
  }
})

/**
 * GET /api/ifood/order-statuses
 * Get information about order statuses and their mappings
 */
router.get('/order-statuses', async (req: Request, res: Response) => {
  try {
    const statuses = [
      {
        ifood_status: 'PLACED',
        ifood_code: 'PLC',
        system_status: 'Pending',
        description: 'Novo pedido na plataforma',
        is_final: false
      },
      {
        ifood_status: 'CONFIRMED',
        ifood_code: 'CFM',
        system_status: 'Preparing',
        description: 'Pedido foi confirmado e será preparado',
        is_final: false
      },
      {
        ifood_status: 'SEPARATION_STARTED',
        ifood_code: 'SPS',
        system_status: 'Preparing',
        description: 'Início do processo de separação (Exclusivo para pedidos de Mercado)',
        is_final: false
      },
      {
        ifood_status: 'SEPARATION_ENDED',
        ifood_code: 'SPE',
        system_status: 'Preparing',
        description: 'Conclusão da separação (Exclusivo para pedidos de Mercado)',
        is_final: false
      },
      {
        ifood_status: 'READY_TO_PICKUP',
        ifood_code: 'RTP',
        system_status: 'Ready',
        description: 'Pedido está pronto para ser retirado',
        is_final: false
      },
      {
        ifood_status: 'DISPATCHED',
        ifood_code: 'DSP',
        system_status: 'Delivered',
        description: 'Pedido saiu para entrega (Delivery)',
        is_final: false
      },
      {
        ifood_status: 'CONCLUDED',
        ifood_code: 'CON',
        system_status: 'Closed',
        description: 'Pedido foi concluído',
        is_final: true
      },
      {
        ifood_status: 'CANCELLED',
        ifood_code: 'CAN',
        system_status: 'Cancelled',
        description: 'Pedido foi cancelado',
        is_final: true
      }
    ]

    res.json({
      success: true,
      data: statuses
    })
  } catch (error) {
    console.error('Erro ao buscar status de pedidos:', error)
    res.status(500).json({
      success: false,
      message: `Erro interno: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
    })
  }
})

/**
 * GET /api/ifood/stats
 * Get statistics about iFood integration
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({
        success: false,
        message: 'Supabase não configurado'
      })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const ifoodService = new IfoodService()
    const config = await ifoodService.getConfig()

    // Estatísticas de pedidos
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)

    // Total de pedidos do iFood
    const { count: totalOrders } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('source', 'ifood')

    // Pedidos hoje
    const { count: ordersToday } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('source', 'ifood')
      .gte('created_at', today.toISOString())

    // Pedidos esta semana
    const { count: ordersThisWeek } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('source', 'ifood')
      .gte('created_at', weekAgo.toISOString())

    // Pedidos este mês
    const { count: ordersThisMonth } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('source', 'ifood')
      .gte('created_at', monthAgo.toISOString())

    // Produtos mapeados
    const { count: mappedProducts } = await supabase
      .from('ifood_product_mapping')
      .select('*', { count: 'exact', head: true })

    // Produtos do iFood não mapeados (se houver produtos do iFood)
    const productsResult = await ifoodService.getProducts()
    const totalIfoodProducts = productsResult.success ? (productsResult.products?.length || 0) : 0
    const unmappedProducts = Math.max(0, totalIfoodProducts - (mappedProducts || 0))

    const stats = {
      total_orders: totalOrders || 0,
      orders_today: ordersToday || 0,
      orders_this_week: ordersThisWeek || 0,
      orders_this_month: ordersThisMonth || 0,
      mapped_products: mappedProducts || 0,
      unmapped_products: unmappedProducts,
      last_sync: config?.last_sync_at || null
    }

    res.json({
      success: true,
      data: stats
    })
  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error)
    res.status(500).json({
      success: false,
      message: `Erro interno: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
    })
  }
})

/**
 * GET /api/ifood/auth-info
 * Get information about current authentication
 */
router.get('/auth-info', async (req: Request, res: Response) => {
  try {
    const ifoodService = new IfoodService()
    const config = await ifoodService.getConfig()

    if (!config) {
      return res.json({
        success: true,
        data: {
          grant_type: null,
          supports_refresh_token: false,
          token_expires_at: null,
          token_expires_in_seconds: null
        }
      })
    }

    const hasAuthorizationCode = config.authorization_code && config.authorization_code.trim() !== ''
    const grantType: 'client_credentials' | 'authorization_code' | 'refresh_token' = 
      hasAuthorizationCode ? 'authorization_code' : 'client_credentials'

    let tokenExpiresInSeconds: number | null = null
    if (config.token_expires_at) {
      const expiresAt = new Date(config.token_expires_at)
      const now = new Date()
      tokenExpiresInSeconds = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000))
    }

    res.json({
      success: true,
      data: {
        grant_type: grantType,
        supports_refresh_token: !!config.refresh_token,
        token_expires_at: config.token_expires_at,
        token_expires_in_seconds: tokenExpiresInSeconds
      }
    })
  } catch (error) {
    console.error('Erro ao buscar informações de autenticação:', error)
    res.status(500).json({
      success: false,
      message: `Erro interno: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
    })
  }
})

/**
 * POST /api/ifood/webhook
 * Receive webhook events from iFood
 */
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const webhookData = req.body
    
    console.log('Webhook recebido do iFood:', JSON.stringify(webhookData, null, 2))

    // Validar estrutura básica do webhook
    if (!webhookData || !webhookData.code) {
      return res.status(400).json({
        success: false,
        message: 'Formato de webhook inválido'
      })
    }

    const polling = getPollingService()
    
    // Processar webhook baseado no código do evento
    // Status do iFood:
    // - PLACED/PLC: Novo pedido
    // - CONFIRMED/CFM: Pedido confirmado
    // - SEPARATION_STARTED/SPS: Separação iniciada (Mercado)
    // - SEPARATION_ENDED/SPE: Separação concluída (Mercado)
    // - READY_TO_PICKUP/RTP: Pronto para retirada
    // - DISPATCHED/DSP: Saiu para entrega
    // - CONCLUDED/CON: Pedido concluído
    // - CANCELLED/CAN: Pedido cancelado
    
    const { createClient } = await import('@supabase/supabase-js')
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({
        success: false,
        message: 'Supabase não configurado'
      })
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const ifoodService = new IfoodService()
    
    // Normalizar código do evento (pode vir como código ou nome)
    const eventCode = webhookData.code?.toUpperCase() || webhookData.event?.toUpperCase()
    const orderId = webhookData.orderId || webhookData.id
    
    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: 'orderId não encontrado no webhook'
      })
    }
    
    // Buscar pedido pelo ifood_order_id
    const { data: order } = await supabase
      .from('orders')
      .select('id, status')
      .eq('ifood_order_id', orderId)
      .single()
    
    // iFood best practice: Processar eventos desconhecidos sem interromper
    const knownEvents = ['PLACED', 'PLC', 'REQUESTED', 'CONFIRMED', 'CFM', 'SEPARATION_STARTED', 'SPS', 
                         'SEPARATION_ENDED', 'SPE', 'READY_TO_PICKUP', 'RTP', 'DISPATCHED', 'DSP', 
                         'CONCLUDED', 'CON', 'CANCELLED', 'CAN',
                         'CAR', 'CANCELLATION_REQUESTED',
                         'CARF', 'CANCELLATION_REQUEST_FAILED']
    
    if (!knownEvents.includes(eventCode)) {
      // iFood best practice: Enviar acknowledgment e descartar eventos desconhecidos
      console.log(`Evento desconhecido recebido: ${eventCode}. Descartando e continuando processamento.`)
      return res.status(200).json({
        success: true,
        message: 'Evento desconhecido descartado'
      })
    }

    if (eventCode === 'PLACED' || eventCode === 'PLC' || eventCode === 'REQUESTED') {
      // iFood best practice: Consultar detalhes antes de processar
      const orderResult = await ifoodService.getOrderDetails(orderId)
      
      if (orderResult.success && orderResult.order) {
        // iFood best practice: Verificar duplicação usando ID único
        if (!order) {
          // iFood best practice: Persistir antes de acknowledgment
          const processedOrder = await polling.processOrder(orderResult.order)
          
          if (processedOrder) {
            // Persistir no banco primeiro
            await polling.createOrder(processedOrder)
            
            // IMPORTANT: Do NOT automatically confirm orders
            // Orders must be manually accepted by the user via the frontend
            // The order is created with status PLACED and waits for manual confirmation
            
            // Atualizar última sincronização
            await ifoodService.updateLastSync()
            
            console.log(`Pedido ${orderId} processado via webhook com status PLACED. Aguardando aceitação manual.`)
          }
        } else {
          // Pedido já existe (duplicação detectada) - apenas atualizar status
          await supabase
            .from('orders')
            .update({ ifood_status: 'PLACED' })
            .eq('id', order.id)
        }
      }
    } else if (order) {
      // Atualizar status do pedido existente
      let systemStatus = order.status
      let ifoodStatus = eventCode
      
      // Mapear status do iFood para status do sistema
      switch (eventCode) {
        case 'CONFIRMED':
        case 'CFM':
          systemStatus = 'Preparing'
          ifoodStatus = 'CONFIRMED'
          break
        case 'SEPARATION_STARTED':
        case 'SPS':
          systemStatus = 'Preparing'
          ifoodStatus = 'SEPARATION_STARTED'
          break
        case 'SEPARATION_ENDED':
        case 'SPE':
          systemStatus = 'Preparing'
          ifoodStatus = 'SEPARATION_ENDED'
          break
        case 'READY_TO_PICKUP':
        case 'RTP':
          systemStatus = 'Ready'
          ifoodStatus = 'READY_TO_PICKUP'
          break
        case 'DISPATCHED':
        case 'DSP':
          systemStatus = 'Delivered'
          ifoodStatus = 'DISPATCHED'
          break
        case 'CONCLUDED':
        case 'CON':
          systemStatus = 'Closed'
          ifoodStatus = 'CONCLUDED'
          break
        case 'CANCELLED':
        case 'CAN':
          systemStatus = 'Cancelled'
          ifoodStatus = 'CANCELLED'
          break
        case 'CANCELLATION_REQUESTED':
        case 'CAR':
          // Cancellation requested - keep current status (pending confirmation)
          systemStatus = existingOrder?.status || 'Preparing'
          ifoodStatus = existingOrder?.ifood_status || 'CONFIRMED'
          break
        case 'CANCELLATION_REQUEST_FAILED':
        case 'CARF':
          // Cancellation failed - keep current status
          systemStatus = existingOrder?.status || 'Preparing'
          ifoodStatus = existingOrder?.ifood_status || 'CONFIRMED'
          break
      }
      
      await supabase
        .from('orders')
        .update({ 
          status: systemStatus,
          ifood_status: ifoodStatus
        })
        .eq('id', order.id)
      
      console.log(`Pedido ${order.id} atualizado para status ${ifoodStatus} via webhook`)
    }

    // Sempre responder 200 OK para o iFood
    // O iFood espera uma resposta rápida, processamento pode ser assíncrono
    res.status(200).json({
      success: true,
      message: 'Webhook recebido e processado'
    })
  } catch (error) {
    console.error('Erro ao processar webhook do iFood:', error)
    // Sempre responder 200 para evitar retentativas desnecessárias
    res.status(200).json({
      success: false,
      message: `Erro ao processar webhook: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
    })
  }
})

/**
 * GET /api/ifood/pending-orders
 * Get pending orders from iFood (orders not yet processed)
 */
router.get('/pending-orders', async (req: Request, res: Response) => {
  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/b058c8da-e202-4622-9483-5c45531d7867',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ifood.ts:924',message:'pending-orders endpoint called',data:{timestamp:new Date().toISOString(),method:req.method,url:req.url,path:req.path,originalUrl:req.originalUrl},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  
  // Log request details for debugging
  console.log('[pending-orders] Request recebido:', {
    method: req.method,
    url: req.url,
    path: req.path,
    originalUrl: req.originalUrl,
    query: req.query,
    params: req.params
  })
  
  try {
    const ifoodService = new IfoodService()
    
    // Poll for new events
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/b058c8da-e202-4622-9483-5c45531d7867',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ifood.ts:929',message:'calling pollEvents',data:{before_call:true},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    const result = await ifoodService.pollEvents()
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/b058c8da-e202-4622-9483-5c45531d7867',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ifood.ts:931',message:'pollEvents result',data:{success:result.success,hasOrders:!!result.orders,ordersLength:result.orders?.length||0,ordersType:Array.isArray(result.orders)?'array':typeof result.orders,error:result.error||null,firstEventSample:result.orders?.[0]?JSON.stringify(result.orders[0]).substring(0,500):null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    if (!result.success) {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/b058c8da-e202-4622-9483-5c45531d7867',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ifood.ts:933',message:'returning empty orders - pollEvents failed',data:{success:result.success,error:result.error},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      
      // Check if error message contains "no Route matched" (Vercel routing error)
      const errorMessage = result.error || 'Falha ao buscar eventos do iFood'
      if (errorMessage.includes('no Route matched') || errorMessage.includes('Route matched')) {
        console.error('[pending-orders] Erro de roteamento detectado no pollEvents:', errorMessage)
        return res.status(404).json({
          success: false,
          orders: [],
          message: 'Erro de roteamento na API do iFood. Verifique a configuração.',
          error: errorMessage
        })
      }
      
      return res.status(200).json({
        success: true,
        orders: [],
        message: errorMessage
      })
    }
    
    // If no events returned, return empty array
    if (!result.orders || result.orders.length === 0) {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/b058c8da-e202-4622-9483-5c45531d7867',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ifood.ts:940',message:'returning empty orders - no events',data:{success:result.success,hasOrders:!!result.orders,ordersLength:result.orders?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      console.log('[pending-orders] Nenhum evento retornado do polling')
      return res.status(200).json({
        success: true,
        orders: [],
        message: 'Nenhum evento novo disponível'
      })
    }

    // Filter out orders that already exist in our system
    const { createClient } = await import('@supabase/supabase-js')
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseUrl || !supabaseServiceKey) {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/b058c8da-e202-4622-9483-5c45531d7867',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ifood.ts:944',message:'Supabase not configured',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      return res.status(500).json({
        success: false,
        message: 'Supabase não configurado'
      })
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Get existing iFood order IDs with their status
    const { data: existingOrders } = await supabase
      .from('orders')
      .select('ifood_order_id, ifood_status')
      .not('ifood_order_id', 'is', null)
    
    const existingIds = new Set(existingOrders?.map(o => o.ifood_order_id) || [])
    // Map of orderId -> ifood_status for quick lookup
    const existingOrdersStatusMap = new Map<string, string>()
    existingOrders?.forEach((o: any) => {
      if (o.ifood_order_id) {
        existingOrdersStatusMap.set(o.ifood_order_id, o.ifood_status || '')
      }
    })
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/b058c8da-e202-4622-9483-5c45531d7867',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ifood.ts:958',message:'existing orders check',data:{existingOrdersCount:existingIds.size},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    // Events from polling need to be processed - extract order IDs and fetch full order details
    // Ensure events is an array
    let events: any[] = []
    if (Array.isArray(result.orders)) {
      events = result.orders
    } else if (result.orders && typeof result.orders === 'object') {
      // Try to extract events from object structure
      events = result.orders.events || result.orders.data || result.orders.items || [result.orders]
    } else {
      console.warn('[pending-orders] Formato inesperado de eventos:', typeof result.orders, result.orders)
      events = []
    }
    
    console.log(`[pending-orders] Processando ${events.length} eventos do polling`)
    const pendingOrders: any[] = []
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/b058c8da-e202-4622-9483-5c45531d7867',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ifood.ts:962',message:'processing events',data:{eventsCount:events.length,firstEventKeys:events[0]?Object.keys(events[0]):null,firstEventSample:events[0]?JSON.stringify(events[0]).substring(0,300):null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    
    // Extract order IDs from events first (faster) - remove duplicates
    // Focus on PLC (Place Order) events which are the pending orders
    const orderIdsSet = new Set<string>()
    const eventDetails: any[] = []
    
    // Helper function to extract orderId from event (more robust)
    const extractOrderId = (event: any): string | null => {
      // Try direct orderId field first (most common)
      if (event.orderId && typeof event.orderId === 'string' && event.orderId.trim() !== '') {
        return event.orderId.trim()
      }
      
      // Try payload.orderId (common structure)
      if (event.payload?.orderId && typeof event.payload.orderId === 'string' && event.payload.orderId.trim() !== '') {
        return event.payload.orderId.trim()
      }
      
      // Try payload.order.id or payload.order.orderId
      if (event.payload?.order) {
        const orderId = event.payload.order.id || event.payload.order.orderId
        if (orderId && typeof orderId === 'string' && orderId.trim() !== '') {
          return orderId.trim()
        }
      }
      
      // Try data.orderId
      if (event.data?.orderId && typeof event.data.orderId === 'string' && event.data.orderId.trim() !== '') {
        return event.data.orderId.trim()
      }
      
      // Try data.order.id or data.order.orderId
      if (event.data?.order) {
        const orderId = event.data.order.id || event.data.order.orderId
        if (orderId && typeof orderId === 'string' && orderId.trim() !== '') {
          return orderId.trim()
        }
      }
      
      // Try order.id or order.orderId (direct)
      if (event.order) {
        const orderId = event.order.id || event.order.orderId
        if (orderId && typeof orderId === 'string' && orderId.trim() !== '') {
          return orderId.trim()
        }
      }
      
      // Try payload.id (sometimes the order ID is directly in payload)
      if (event.payload?.id && typeof event.payload.id === 'string' && event.payload.id.trim() !== '') {
        // Only use if it looks like a UUID (iFood order IDs are UUIDs)
        const id = event.payload.id.trim()
        if (id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
          return id
        }
      }
      
      // Last resort: try event.id if it looks like a UUID (but be careful - this might be event ID, not order ID)
      if (event.id && typeof event.id === 'string') {
        const id = event.id.trim()
        // Only use if it looks like a UUID and we don't have a better match
        if (id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
          // Check if this might be an event ID by looking for event-specific fields
          // If it has 'code' or 'type', it's likely an event, not an order
          if (!event.code && !event.type && !event.eventType) {
            return id
          }
        }
      }
      
      return null
    }
    
    // Process status update events for existing orders
    for (const event of events) {
      // Log event structure for debugging
      const eventType = event.type || event.eventType || event.code || 'unknown'
      const eventStatus = event.status || event.eventStatus || 'unknown'
      
      // Extract event code and order ID
      const eventCode = (event.code || event.fullCode || eventType || '').toUpperCase()
      const orderId = extractOrderId(event)
      
      eventDetails.push({
        type: eventType,
        status: eventStatus,
        code: eventCode,
        hasOrderId: !!orderId,
        orderId: orderId || null,
        eventKeys: Object.keys(event),
        eventStructure: JSON.stringify(event).substring(0, 500),
        // Add more details for debugging
        payloadKeys: event.payload ? Object.keys(event.payload) : null,
        dataKeys: event.data ? Object.keys(event.data) : null,
        orderKeys: event.order ? Object.keys(event.order) : null
      })
      
      // Log warning if event doesn't have orderId (for debugging)
      if (!orderId) {
        console.warn(`[pending-orders] Event sem orderId detectado:`, {
          code: eventCode,
          type: eventType,
          keys: Object.keys(event),
          sample: JSON.stringify(event).substring(0, 500)
        })
      }
      
      // Process status update events for existing orders (DISPATCHED, CONCLUDED, etc.)
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/b058c8da-e202-4622-9483-5c45531d7867',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ifood.ts:1035',message:'checking if status update needed',data:{orderId,eventCode,hasOrderId:!!orderId,orderIdExists:orderId&&existingIds.has(orderId),eventCodeValue:eventCode},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      
      if (orderId && typeof orderId === 'string' && orderId.trim() !== '' && existingIds.has(orderId)) {
        const isStatusUpdateEvent = ['DSP', 'DISPATCHED', 'CON', 'CONCLUDED', 'CFM', 'CONFIRMED', 
                                    'SPS', 'SEPARATION_STARTED', 'SPE', 'SEPARATION_ENDED', 
                                    'RTP', 'READY_TO_PICKUP', 'CAN', 'CANCELLED',
                                    'CAR', 'CANCELLATION_REQUESTED',
                                    'CARF', 'CANCELLATION_REQUEST_FAILED'].includes(eventCode)
        
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/b058c8da-e202-4622-9483-5c45531d7867',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ifood.ts:1041',message:'status update check result',data:{orderId,eventCode,isStatusUpdateEvent,orderIdExists:true},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
        // #endregion
        
        if (isStatusUpdateEvent) {
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/b058c8da-e202-4622-9483-5c45531d7867',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ifood.ts:1044',message:'status update event detected - will update order',data:{orderId,eventCode},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
          // #endregion
          // Get the existing order to update
          const { data: existingOrder } = await supabase
            .from('orders')
            .select('id, status, ifood_status')
            .eq('ifood_order_id', orderId)
            .single()
          
          if (existingOrder) {
            // Map event code to system status and iFood status (same logic as webhook and polling)
            let systemStatus = existingOrder.status
            let ifoodStatus = eventCode
            
            switch (eventCode) {
              case 'CONFIRMED':
              case 'CFM':
                systemStatus = 'Preparing'
                ifoodStatus = 'CONFIRMED'
                break
              case 'SEPARATION_STARTED':
              case 'SPS':
                systemStatus = 'Preparing'
                ifoodStatus = 'SEPARATION_STARTED'
                break
              case 'SEPARATION_ENDED':
              case 'SPE':
                systemStatus = 'Preparing'
                ifoodStatus = 'SEPARATION_ENDED'
                break
              case 'READY_TO_PICKUP':
              case 'RTP':
                systemStatus = 'Ready'
                ifoodStatus = 'READY_TO_PICKUP'
                break
              case 'DISPATCHED':
              case 'DSP':
                systemStatus = 'Delivered'
                ifoodStatus = 'DISPATCHED'
                break
              case 'CONCLUDED':
              case 'CON':
                systemStatus = 'Closed'
                ifoodStatus = 'CONCLUDED'
                break
              case 'CANCELLED':
              case 'CAN':
                systemStatus = 'Cancelled'
                ifoodStatus = 'CANCELLED'
                break
              case 'CANCELLATION_REQUESTED':
              case 'CAR':
                // Cancellation was requested - keep current status (pending)
                systemStatus = existingOrder.status
                ifoodStatus = existingOrder.ifood_status || 'CONFIRMED'
                break
              case 'CANCELLATION_REQUEST_FAILED':
              case 'CARF':
                // Cancellation failed - keep current status
                systemStatus = existingOrder.status
                ifoodStatus = existingOrder.ifood_status || 'CONFIRMED'
                break
            }
            
            // Update order status in database
            const updateData: { status: string; ifood_status: string; closed_at?: string; notes?: string } = {
              status: systemStatus,
              ifood_status: ifoodStatus
            }
            
            // Add notes for cancellation events
            if (eventCode === 'CAR' || eventCode === 'CANCELLATION_REQUESTED') {
              const requestReason = event.metadata?.details || event.metadata?.reason_code || 'N/A'
              const requestCode = event.metadata?.reason_code || 'N/A'
              updateData.notes = `Cancelamento solicitado: ${requestReason} (código: ${requestCode})`
            } else if (eventCode === 'CARF' || eventCode === 'CANCELLATION_REQUEST_FAILED') {
              const failureReason = event.metadata?.CANCELLATION_REQUEST_FAILED_REASON || 'Unknown reason'
              const cancelCode = event.metadata?.CANCEL_CODE || 'N/A'
              updateData.notes = `Tentativa de cancelamento falhou: ${failureReason} (código: ${cancelCode})`
            }
            
            // Set closed_at timestamp for CONCLUDED status
            if (ifoodStatus === 'CONCLUDED') {
              updateData.closed_at = new Date().toISOString()
            }
            
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/b058c8da-e202-4622-9483-5c45531d7867',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ifood.ts:1103',message:'updating order status in database',data:{orderId,eventCode,existingOrderId:existingOrder.id,systemStatus,ifoodStatus,updateData},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
            // #endregion
            
            const { error: updateError } = await supabase
              .from('orders')
              .update(updateData)
              .eq('id', existingOrder.id)
            
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/b058c8da-e202-4622-9483-5c45531d7867',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ifood.ts:1110',message:'order status update result',data:{orderId,eventCode,existingOrderId:existingOrder.id,systemStatus,ifoodStatus,hasError:!!updateError,errorMessage:updateError?.message||null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
            // #endregion
            
            if (updateError) {
              console.error(`[pending-orders] Error updating order ${existingOrder.id} status:`, updateError)
            } else {
              console.log(`[pending-orders] Order ${existingOrder.id} (iFood ${orderId}) updated to status ${ifoodStatus}`)
            }
          }
          
          // Continue to next event (don't add to orderIdsSet as it's not a new order)
          continue
        }
      }
      
      // For PLC (PLACED) events, we want to show them if:
      // 1. Order doesn't exist in our system, OR
      // 2. Order exists but still has PLACED status (pending acceptance)
      const isPlacedEvent = eventCode === 'PLC' || eventCode === 'PLACED' || eventType === 'PLACED'
      
      if (orderId && typeof orderId === 'string' && orderId.trim() !== '') {
        if (isPlacedEvent) {
          const existingStatus = existingOrdersStatusMap.get(orderId)
          // Include if order doesn't exist OR if it exists but still has PLACED status
          if (!existingIds.has(orderId) || existingStatus === 'PLACED' || existingStatus === 'PLC' || !existingStatus) {
            orderIdsSet.add(orderId)
            console.log(`[pending-orders] Adding PLACED order ${orderId} to fetch list (exists: ${existingIds.has(orderId)}, status: ${existingStatus})`)
          } else {
            console.log(`[pending-orders] Skipping PLACED order ${orderId} - already exists with status: ${existingStatus}`)
          }
        } else {
          // For non-PLC events, only add if order doesn't exist
          if (!existingIds.has(orderId)) {
            orderIdsSet.add(orderId)
          }
        }
      } else if (!orderId) {
        // Log events without orderId for debugging
        console.warn(`[pending-orders] Event without orderId:`, {
          type: eventType,
          status: eventStatus,
          keys: Object.keys(event),
          sample: JSON.stringify(event).substring(0, 200)
        })
      }
    }
    const orderIdsToFetch = Array.from(orderIdsSet)
    
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/b058c8da-e202-4622-9483-5c45531d7867',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ifood.ts:1018',message:'orderIds extraction details',data:{eventsCount:events.length,orderIdsExtracted:orderIdsToFetch.length,existingIdsCount:existingIds.size,orderIds:orderIdsToFetch,eventDetails:eventDetails.slice(0,5)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    
    // Log to console for easier debugging
    console.log(`[pending-orders] Processing ${events.length} events`)
    console.log(`[pending-orders] Event details:`, JSON.stringify(eventDetails.slice(0, 3), null, 2))
    console.log(`[pending-orders] Extracted ${orderIdsToFetch.length} order IDs:`, orderIdsToFetch)
    console.log(`[pending-orders] Existing orders status map:`, Array.from(existingOrdersStatusMap.entries()).slice(0, 5))
    
    // If no order IDs found in events, return empty
    if (orderIdsToFetch.length === 0) {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/b058c8da-e202-4622-9483-5c45531d7867',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ifood.ts:1000',message:'no orderIds found in events',data:{eventsCount:events.length,existingIdsCount:existingIds.size,eventDetails:eventDetails.slice(0,3)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      
      // Log detailed information for debugging
      const eventsWithoutOrderId = eventDetails.filter(e => !e.hasOrderId)
      const eventsWithOrderId = eventDetails.filter(e => e.hasOrderId)
      
      console.log(`[pending-orders] Nenhum orderId novo encontrado:`, {
        totalEvents: events.length,
        eventsWithOrderId: eventsWithOrderId.length,
        eventsWithoutOrderId: eventsWithoutOrderId.length,
        existingOrdersCount: existingIds.size,
        sampleEventsWithoutOrderId: eventsWithoutOrderId.slice(0, 2)
      })
      
      return res.status(200).json({
        success: true,
        orders: [],
        message: events.length === 0 
          ? 'Nenhum evento disponível' 
          : eventsWithoutOrderId.length > 0
            ? `Nenhum pedido novo encontrado. ${eventsWithoutOrderId.length} eventos sem orderId.`
            : 'Nenhum pedido novo encontrado nos eventos',
        debug: {
          eventsCount: events.length,
          eventsWithOrderId: eventsWithOrderId.length,
          eventsWithoutOrderId: eventsWithoutOrderId.length,
          existingOrdersCount: existingIds.size
        }
      })
    }
    
    // Limit to 20 orders at a time to prevent timeout and reduce load
    const maxOrders = 20
    const limitedOrderIds = orderIdsToFetch.slice(0, maxOrders)
    
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/b058c8da-e202-4622-9483-5c45531d7867',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ifood.ts:1001',message:'fetching order details',data:{totalOrderIds:orderIdsToFetch.length,limitedOrderIds:limitedOrderIds.length,orderIds:limitedOrderIds},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    
    // Helper function to fetch order details with retry for 404 (pedido ainda não disponível)
    // According to iFood docs: retry with exponential backoff when receiving 404
    // For pending-orders endpoint, we do quick retries (1-2 attempts) to avoid long waits
    // If order is not available, it will be fetched in the next polling cycle
    const fetchOrderDetailsWithRetry = async (orderId: string, maxRetries: number = 3): Promise<any> => {
      let attempt = 0
      let delay = 1000 // Start with 1 second
      
      while (attempt < maxRetries) {
        try {
          const orderDetailsResult = await ifoodService.getOrderDetails(orderId)
          
          if (orderDetailsResult.success && orderDetailsResult.order) {
            const order = orderDetailsResult.order
            // Ensure all required fields are present and properly formatted
            const sanitizedOrder = {
              id: order.id,
              shortReference: order.shortReference || order.id,
              displayId: order.displayId || order.shortReference || order.id,
              orderType: order.orderType,
              orderTiming: order.orderTiming || 'IMMEDIATE',
              salesChannel: order.salesChannel || 'IFOOD',
              category: order.category,
              createdAt: order.createdAt || new Date().toISOString(),
              preparationStartDateTime: order.preparationStartDateTime,
              preparationTimeInSeconds: order.preparationTimeInSeconds,
              isTest: order.isTest,
              extraInfo: order.extraInfo,
              items: order.items || [],
              customer: order.customer || { id: '', name: 'Cliente iFood' },
              delivery: order.delivery,
              takeout: order.takeout,
              dineIn: order.dineIn,
              indoor: order.indoor,
              schedule: order.schedule,
              total: order.total,
              totalPrice: order.totalPrice || (order.total ? { amount: order.total.orderAmount || 0, currency: 'BRL' } : { amount: 0, currency: 'BRL' }),
              payments: order.payments,
              benefits: order.benefits,
              additionalFees: order.additionalFees,
              picking: order.picking,
              additionalInfo: order.additionalInfo
            }
            
            // Log específico para displayId 9746
            if (sanitizedOrder.displayId === '9746' || sanitizedOrder.shortReference === '9746') {
              console.log(`[pending-orders] Found order with displayId 9746:`, {
                id: sanitizedOrder.id,
                displayId: sanitizedOrder.displayId,
                shortReference: sanitizedOrder.shortReference,
                orderType: sanitizedOrder.orderType,
                customer: sanitizedOrder.customer,
                hasItems: !!(sanitizedOrder.items && sanitizedOrder.items.length > 0),
                total: sanitizedOrder.total,
                totalPrice: sanitizedOrder.totalPrice
              })
            }
            if (attempt > 0) {
              console.log(`[pending-orders] Successfully fetched order ${orderId} after ${attempt} retries`)
            }
            return sanitizedOrder
          }
          
          // Check if it's a 404 error (pedido ainda não disponível)
          const is404 = orderDetailsResult.error?.includes('404') || orderDetailsResult.error?.includes('não encontrado')
          
          if (is404 && attempt < maxRetries - 1) {
            // Quick exponential backoff: 1s, 2s (only 2 retries for pending-orders)
            attempt++
            console.log(`[pending-orders] Order ${orderId} not available yet (404), retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`)
            await new Promise(resolve => setTimeout(resolve, delay))
            delay = delay * 2 // 1s -> 2s
            continue
          } else {
            // Not a 404 or max retries reached
            if (is404) {
              console.log(`[pending-orders] Order ${orderId} still not available after ${attempt} retries. Will try again in next polling cycle.`)
            } else {
              console.log(`[pending-orders] Order ${orderId} fetch failed: ${orderDetailsResult.error}`)
            }
            return null
          }
        } catch (error) {
          if (attempt < maxRetries - 1) {
            attempt++
            console.log(`[pending-orders] Error fetching order ${orderId}, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`)
            await new Promise(resolve => setTimeout(resolve, delay))
            delay = delay * 2
            continue
          } else {
            console.error(`[pending-orders] Error processing order ${orderId} after ${attempt} retries:`, error)
            return null
          }
        }
      }
      
      return null
    }
    
    // Fetch order details in parallel (but limit concurrency to avoid overwhelming the API)
    const orderPromises = limitedOrderIds.map(async (orderId) => {
      try {
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/b058c8da-e202-4622-9483-5c45531d7867',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ifood.ts:983',message:'calling getOrderDetails with retry',data:{orderId,before_call:true},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        
        const sanitizedOrder = await fetchOrderDetailsWithRetry(orderId)
        
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/b058c8da-e202-4622-9483-5c45531d7867',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ifood.ts:985',message:'getOrderDetails result after retry',data:{orderId,success:!!sanitizedOrder,hasOrder:!!sanitizedOrder},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        
        return sanitizedOrder
      } catch (error) {
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/b058c8da-e202-4622-9483-5c45531d7867',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ifood.ts:992',message:'error processing event',data:{orderId,error:error instanceof Error?error.message:String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        console.error(`Error processing order ${orderId} for pending orders:`, error)
        return null
      }
    })
    
    // Wait for all orders to be fetched (with timeout protection)
    // Use Promise.allSettled to ensure all promises complete even if some fail
    let validOrders: any[] = []
    
    try {
      const timeoutPromise = new Promise<any[]>((resolve) => {
        setTimeout(() => {
          console.warn('Timeout ao buscar detalhes dos pedidos (30s). Retornando pedidos já processados.')
          resolve([])
        }, 30000) // 30 second timeout (increased to accommodate retries: 3 orders * 3 retries * ~3s = ~27s max)
      })
      
      const ordersResults = await Promise.race([
        Promise.allSettled(orderPromises).then(results => 
          results.map(r => r.status === 'fulfilled' ? r.value : null)
        ),
        timeoutPromise
      ])
      
      // Filter out null results and remove duplicates by order ID
      validOrders = (ordersResults || []).filter((order): order is any => order !== null)
      
      // Filter only orders with status PLACED for the pending orders container
      // This endpoint is specifically for pending orders, so we only return PLACED status
      console.log(`[pending-orders] Filtering ${validOrders.length} valid orders for PLACED status`)
      console.log(`[pending-orders] Valid orders details:`, validOrders.map((o: any) => ({
        id: o.id,
        displayId: o.displayId,
        shortReference: o.shortReference,
        status: o.status,
        orderStatus: o.orderStatus,
        ifoodStatus: o.ifoodStatus,
        keys: Object.keys(o)
      })))
      
      const placedOrders = validOrders.filter((order: any) => {
        // Check status from API response (most reliable)
        // Note: API do iFood pode não retornar status diretamente no objeto order
        // Vamos assumir que se chegou aqui via evento PLC, é PLACED
        const orderId = order.id
        const displayId = order.displayId || order.shortReference
        const dbStatus = orderId ? existingOrdersStatusMap.get(orderId) : null
        
        // Log detalhado para debug
        console.log(`[pending-orders] Checking order ${orderId} (displayId: ${displayId}):`, {
          dbStatus,
          orderStatus: order.status,
          orderOrderStatus: order.orderStatus,
          orderIfoodStatus: order.ifoodStatus,
          hasDbStatus: !!dbStatus
        })
        
        // Se o pedido existe no banco, verificar o status lá
        // Se não existe, assumir que é PLACED (veio de evento PLC)
        if (dbStatus) {
          const isPlaced = dbStatus === 'PLACED' || dbStatus === 'PLC'
          console.log(`[pending-orders] Order ${orderId} (displayId: ${displayId}) exists in DB with status ${dbStatus}, isPlaced: ${isPlaced}`)
          return isPlaced
        } else {
          // Pedido não existe no banco, veio de evento PLC, então é PLACED
          console.log(`[pending-orders] Order ${orderId} (displayId: ${displayId}) not in DB, assuming PLACED (from PLC event)`)
          return true
        }
      })
      
      console.log(`[pending-orders] After filtering: ${placedOrders.length} orders with PLACED status`)
      
      // Remove duplicates by order ID and ifood_order_id (keep first occurrence)
      // Use ifood_order_id as primary key for deduplication if available
      const uniqueOrdersMap = new Map<string, any>()
      const seenIfoodIds = new Set<string>()
      
      for (const order of placedOrders) {
        if (!order) continue
        
        // Use ifood_order_id as primary deduplication key for iFood orders
        const dedupKey = order.ifood_order_id || order.id
        
        if (dedupKey) {
          // Check both maps to prevent duplicates
          if (order.ifood_order_id && seenIfoodIds.has(order.ifood_order_id)) {
            console.log(`[pending-orders] Skipping duplicate order with ifood_order_id: ${order.ifood_order_id}`)
            continue
          }
          
          if (!uniqueOrdersMap.has(dedupKey)) {
            uniqueOrdersMap.set(dedupKey, order)
            if (order.ifood_order_id) {
              seenIfoodIds.add(order.ifood_order_id)
            }
          } else {
            console.log(`[pending-orders] Skipping duplicate order with key: ${dedupKey}`)
          }
        }
      }
      const uniqueOrders = Array.from(uniqueOrdersMap.values())
      
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/b058c8da-e202-4622-9483-5c45531d7867',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ifood.ts:1045',message:'removing duplicates and filtering PLACED',data:{validOrdersCount:validOrders.length,placedOrdersCount:placedOrders.length,uniqueOrdersCount:uniqueOrders.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      
      pendingOrders.push(...uniqueOrders)
    } catch (error) {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/b058c8da-e202-4622-9483-5c45531d7867',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ifood.ts:1035',message:'error in Promise.race',data:{error:error instanceof Error?error.message:String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      console.error('Error fetching order details in parallel:', error)
      // Continue with empty array - don't fail the entire request
    }
    
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/b058c8da-e202-4622-9483-5c45531d7867',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ifood.ts:1057',message:'orders fetched and processed',data:{pendingOrdersCount:pendingOrders.length,eventsProcessed:events.length,orderIdsFetched:limitedOrderIds.length,validOrdersCount:validOrders.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/b058c8da-e202-4622-9483-5c45531d7867',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ifood.ts:1090',message:'returning response',data:{pendingOrdersCount:pendingOrders.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    // Log final summary for debugging
    console.log(`[pending-orders] Summary: ${events.length} events, ${orderIdsToFetch.length} new order IDs, ${pendingOrders.length} pending orders returned`)
    console.log(`[pending-orders] Event types found:`, eventDetails.map(e => e.type).filter((v, i, a) => a.indexOf(v) === i))
    
    const responseData = {
      success: true,
      orders: pendingOrders,
      debug: {
        eventsCount: events.length,
        orderIdsFound: orderIdsToFetch.length,
        ordersFetched: limitedOrderIds.length,
        ordersReturned: pendingOrders.length,
        eventTypes: eventDetails.map(e => e.type).filter((v, i, a) => a.indexOf(v) === i),
        eventsWithOrderId: eventDetails.filter(e => e.hasOrderId).length,
        eventsWithoutOrderId: eventDetails.filter(e => !e.hasOrderId).length,
        sampleEvent: events[0] ? {
          keys: Object.keys(events[0]),
          type: events[0].type || events[0].eventType || events[0].code || 'unknown',
          structure: JSON.stringify(events[0]).substring(0, 500)
        } : null
      }
    }
    
    console.log(`[pending-orders] Sending response:`, {
      success: responseData.success,
      ordersCount: responseData.orders.length,
      firstOrder: responseData.orders[0] ? {
        id: responseData.orders[0].id,
        displayId: responseData.orders[0].displayId,
        shortReference: responseData.orders[0].shortReference,
        customer: responseData.orders[0].customer?.name,
        customerType: typeof responseData.orders[0].customer,
        keys: Object.keys(responseData.orders[0])
      } : null,
      allOrderIds: responseData.orders.map((o: any) => o.id)
    })
    
    // Log full response data structure (first order only to avoid too much output)
    if (responseData.orders.length > 0) {
      console.log(`[pending-orders] First order full structure:`, JSON.stringify(responseData.orders[0], null, 2))
    } else {
      console.log(`[pending-orders] No orders to return. Response structure:`, JSON.stringify(responseData, null, 2))
    }
    
    // Set explicit headers
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Cache-Control', 'no-cache')
    
    // Send response
    res.json(responseData)
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/b058c8da-e202-4622-9483-5c45531d7867',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ifood.ts:995',message:'error in pending-orders endpoint',data:{error:error instanceof Error?error.message:String(error),errorName:error instanceof Error?error.name:'unknown',errorStack:error instanceof Error?error.stack?.substring(0,500):null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    // Log detailed error information
    console.error('[pending-orders] Erro ao buscar pedidos pendentes do iFood:', {
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : 'Unknown',
      stack: error instanceof Error ? error.stack : undefined
    })
    
    // Check if error message contains "no Route matched" (Vercel routing error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    if (errorMessage.includes('no Route matched') || errorMessage.includes('Route matched')) {
      console.error('[pending-orders] Erro de roteamento detectado - possível problema com configuração do Vercel')
      return res.status(404).json({
        success: false,
        message: 'Rota não encontrada. Verifique se a URL está correta.',
        error: 'Roteamento falhou',
        path: req.path,
        method: req.method
      })
    }
    
    res.status(500).json({
      success: false,
      message: `Erro interno: ${errorMessage}`,
      error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined
    })
  }
})

/**
 * GET /api/ifood/order-details/:orderId
 * Get order details from iFood by order UUID
 */
router.get('/order-details/:orderId', async (req: Request, res: Response) => {
  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/b058c8da-e202-4622-9483-5c45531d7867',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ifood.ts:1101',message:'order-details endpoint called',data:{orderId:req.params.orderId,url:req.url,method:req.method},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  try {
    const { orderId } = req.params
    
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/b058c8da-e202-4622-9483-5c45531d7867',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ifood.ts:1107',message:'order-details params extracted',data:{orderId,hasOrderId:!!orderId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: 'orderId é obrigatório'
      })
    }
    
    const ifoodService = new IfoodService()
    
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/b058c8da-e202-4622-9483-5c45531d7867',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ifood.ts:1018',message:'calling getOrderDetails',data:{orderId,before_call:true},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    const result = await ifoodService.getOrderDetails(orderId)
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/b058c8da-e202-4622-9483-5c45531d7867',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ifood.ts:1122',message:'getOrderDetails result',data:{orderId,success:result.success,hasOrder:!!result.order,error:result.error||null,is404:result.error?.includes('404')||result.error?.includes('not found')||false},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    if (!result.success) {
      // Check if error is 404 from iFood API
      const errorLower = result.error?.toLowerCase() || ''
      const is404 = errorLower.includes('404') || 
                    errorLower.includes('not found') || 
                    errorLower.includes('não encontrado') ||
                    errorLower.includes('pedido não encontrado')
      
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/b058c8da-e202-4622-9483-5c45531d7867',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ifood.ts:1130',message:'getOrderDetails failed',data:{orderId,error:result.error,is404,errorLower},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      
      if (is404) {
        return res.status(404).json({
          success: false,
          message: 'Pedido não encontrado no iFood'
        })
      }
      
      return res.status(500).json({
        success: false,
        message: result.error || 'Falha ao buscar detalhes do pedido'
      })
    }
    
    if (!result.order) {
      return res.status(404).json({
        success: false,
        message: 'Pedido não encontrado'
      })
    }
    
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/b058c8da-e202-4622-9483-5c45531d7867',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ifood.ts:1035',message:'returning order details',data:{orderId,orderDisplayId:result.order.displayId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    res.json({
      success: true,
      order: result.order
    })
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/b058c8da-e202-4622-9483-5c45531d7867',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ifood.ts:1042',message:'order-details error',data:{error:error instanceof Error?error.message:String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    console.error('Erro ao buscar detalhes do pedido do iFood:', error)
    res.status(500).json({
      success: false,
      message: `Erro interno: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
    })
  }
})

/**
 * GET /api/ifood/poll-events
 * Get events from iFood polling (raw events)
 */
router.get('/poll-events', async (req: Request, res: Response) => {
  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/b058c8da-e202-4622-9483-5c45531d7867',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ifood.ts:1007',message:'poll-events endpoint called',data:{timestamp:new Date().toISOString()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  try {
    const ifoodService = new IfoodService()
    
    // Poll for new events
    const result = await ifoodService.pollEvents()
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/b058c8da-e202-4622-9483-5c45531d7867',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ifood.ts:1012',message:'poll-events result',data:{success:result.success,hasOrders:!!result.orders,ordersLength:result.orders?.length||0,error:result.error||null,firstEventSample:result.orders?.[0]?JSON.stringify(result.orders[0]).substring(0,500):null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: result.error || 'Failed to poll events'
      })
    }

    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/b058c8da-e202-4622-9483-5c45531d7867',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ifood.ts:1021',message:'poll-events returning response',data:{eventsCount:result.orders?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    res.json({
      success: true,
      events: result.orders || []
    })
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/b058c8da-e202-4622-9483-5c45531d7867',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ifood.ts:1026',message:'poll-events error',data:{error:error instanceof Error?error.message:String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    console.error('Erro ao buscar eventos do iFood:', error)
    res.status(500).json({
      success: false,
      message: `Erro interno: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
    })
  }
})

/**
 * POST /api/ifood/accept-order/:orderId
 * Accept an iFood order and create it in the system
 */
router.post('/accept-order/:orderId', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params
    console.log(`[accept-order] Starting to accept order ${orderId}`)
    
    const ifoodService = new IfoodService()
    const pollingService = getPollingService()
    
    // Get order details from iFood
    console.log(`[accept-order] Getting iFood config...`)
    const config = await ifoodService.getConfig()
    if (!config) {
      console.error(`[accept-order] Config not found`)
      return res.status(500).json({
        success: false,
        message: 'Configuração do iFood não encontrada'
      })
    }
    
    console.log(`[accept-order] Fetching order details from iFood API...`)
    const orderDetailsResult = await ifoodService.getOrderDetails(orderId)
    
    if (!orderDetailsResult.success || !orderDetailsResult.order) {
      console.error(`[accept-order] Order details fetch failed:`, orderDetailsResult.error)
      return res.status(404).json({
        success: false,
        message: orderDetailsResult.error || 'Pedido não encontrado no iFood'
      })
    }
    
    console.log(`[accept-order] Order details fetched successfully. Processing order...`)
    console.log(`[accept-order] Order structure:`, {
      id: orderDetailsResult.order.id,
      displayId: orderDetailsResult.order.displayId,
      itemsCount: orderDetailsResult.order.items?.length || 0,
      hasCustomer: !!orderDetailsResult.order.customer,
      orderType: orderDetailsResult.order.orderType,
      orderTiming: orderDetailsResult.order.orderTiming
    })
    
    // NEW LOGIC: First confirm order with iFood, then create in system
    // According to workflow: PLACED → CONFIRMED
    // This is BIDIRECTIONAL: System → iFood API
    console.log(`[accept-order] Step 1: Confirming order ${orderId} with iFood API FIRST...`)
    console.log(`[accept-order] Config before updateOrderStatus:`, {
      hasConfig: !!config,
      merchantId: config.merchant_id,
      hasAccessToken: !!config.access_token
    })
    
    let confirmResult
    try {
      console.log(`[accept-order] Calling updateOrderStatus...`)
      confirmResult = await ifoodService.updateOrderStatus(orderId, 'CONFIRMED')
      console.log(`[accept-order] updateOrderStatus returned:`, confirmResult)
    } catch (confirmError: any) {
      console.error(`[accept-order] Exception during updateOrderStatus:`, confirmError)
      console.error(`[accept-order] Error type:`, typeof confirmError)
      console.error(`[accept-order] Error instanceof Error:`, confirmError instanceof Error)
      console.error(`[accept-order] Error message:`, confirmError?.message)
      console.error(`[accept-order] Error stack:`, confirmError instanceof Error ? confirmError.stack : 'No stack trace')
      console.error(`[accept-order] Error response:`, confirmError?.response?.data)
      return res.status(500).json({
        success: false,
        message: `Falha ao confirmar pedido no iFood: ${confirmError instanceof Error ? confirmError.message : 'Erro desconhecido'}`,
        error: confirmError instanceof Error ? confirmError.message : String(confirmError),
        details: confirmError?.response?.data || null
      })
    }
    
    if (!confirmResult || !confirmResult.success) {
      console.error(`[accept-order] iFood confirmation failed:`, confirmResult)
      // Tentar buscar status atual do pedido para retornar informação mais útil
      const orderDetailsResult = await ifoodService.getOrderDetails(orderId)
      if (orderDetailsResult.success && orderDetailsResult.order) {
        // Extrair status atual do pedido
        const currentStatus = extractOrderStatus(orderDetailsResult.order)
        return res.status(500).json({
          success: false,
          message: `Falha ao confirmar pedido no iFood: ${confirmResult?.error || 'Erro desconhecido'}`,
          error: confirmResult?.error || 'updateOrderStatus retornou resultado inválido',
          currentStatus: currentStatus.status,
          currentIfoodStatus: currentStatus.ifoodStatus,
          statusMessage: getStatusMessage(currentStatus.ifoodStatus)
        })
      }
      
      return res.status(500).json({
        success: false,
        message: `Falha ao confirmar pedido no iFood: ${confirmResult?.error || 'Erro desconhecido'}`,
        error: confirmResult?.error || 'updateOrderStatus retornou resultado inválido'
      })
    }
    
    console.log(`[accept-order] Order confirmed successfully with iFood API`)
    if (confirmResult.isAsync) {
      console.log(`[accept-order] Order confirmation is async (202). Will wait for confirmation event in polling.`)
    }
    
    // Only create order in system if iFood confirmation was successful
    console.log(`[accept-order] Step 2: Processing order for system...`)
    let processedOrder
    try {
      processedOrder = await (pollingService as any).processOrder(orderDetailsResult.order)
    } catch (processError) {
      console.error(`[accept-order] Error in processOrder:`, processError)
      console.error(`[accept-order] Error stack:`, processError instanceof Error ? processError.stack : 'No stack trace')
      // Order was confirmed in iFood but failed to process - this is a problem
      // We should log this but the order is already confirmed in iFood
      return res.status(500).json({
        success: false,
        message: `Pedido confirmado no iFood, mas erro ao processar para o sistema: ${processError instanceof Error ? processError.message : 'Erro desconhecido'}`,
        error: processError instanceof Error ? processError.message : String(processError)
      })
    }
    
    if (!processedOrder) {
      console.error(`[accept-order] Order processing failed - processedOrder is null`)
      // Order was confirmed in iFood but failed to process
      return res.status(500).json({
        success: false,
        message: 'Pedido confirmado no iFood, mas erro ao processar pedido: processOrder retornou null'
      })
    }
    
    console.log(`[accept-order] Order processed successfully:`, {
      ifoodOrderId: processedOrder.ifoodOrderId,
      ifoodDisplayId: processedOrder.ifoodDisplayId,
      customer: processedOrder.customer,
      itemsCount: processedOrder.items?.length || 0,
      total: processedOrder.total
    })
    
    console.log(`[accept-order] Step 3: Creating order in system...`)
    // Create order in system (only if iFood confirmation was successful)
    let createOrderResult
    try {
      createOrderResult = await (pollingService as any).createOrder(processedOrder)
    } catch (createError) {
      console.error(`[accept-order] Error creating order in system:`, createError)
      console.error(`[accept-order] Error stack:`, createError instanceof Error ? createError.stack : 'No stack trace')
      // Order was confirmed in iFood but failed to create in system
      return res.status(500).json({
        success: false,
        message: `Pedido confirmado no iFood, mas erro ao criar no sistema: ${createError instanceof Error ? createError.message : 'Erro desconhecido'}`,
        error: createError instanceof Error ? createError.message : String(createError)
      })
    }
    
    if (!createOrderResult || !createOrderResult.success) {
      console.error(`[accept-order] Order creation failed:`, createOrderResult?.error)
      // Order was confirmed in iFood but failed to create in system
      return res.status(500).json({
        success: false,
        message: `Pedido confirmado no iFood, mas erro ao criar no sistema: ${createOrderResult?.error || 'Erro desconhecido'}`,
        error: createOrderResult?.error
      })
    }
    
    console.log(`[accept-order] Order created successfully in system with ID: ${createOrderResult.orderId}`)
    
    // Update database to reflect CONFIRMED status (order was already confirmed in iFood before creation)
    console.log(`[accept-order] Updating order status in database to CONFIRMED...`)
    const { createClient } = await import('@supabase/supabase-js')
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (supabaseUrl && supabaseServiceKey) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey)
      const updateResult = await supabase
        .from('orders')
        .update({ ifood_status: 'CONFIRMED' })
        .eq('ifood_order_id', orderId)
      
      if (updateResult.error) {
        console.error(`[accept-order] Error updating order status in database:`, updateResult.error)
        // Don't fail the request, just log the error
      } else {
        console.log(`[accept-order] Order status updated to CONFIRMED in database`)
      }
    }
    
    // If async operation, inform that we'll wait for confirmation event
    if (confirmResult.isAsync) {
      console.log(`[accept-order] Order ${orderId} confirmation is async. Waiting for confirmation event in polling.`)
    }
    
    res.json({
      success: true,
      message: 'Pedido aceito e confirmado no iFood com sucesso',
      isAsync: confirmResult.isAsync || false,
      orderId: createOrderResult.orderId
    })
  } catch (error: any) {
    console.error('[accept-order] Unexpected error:', error)
    console.error('[accept-order] Error type:', typeof error)
    console.error('[accept-order] Error instanceof Error:', error instanceof Error)
    console.error('[accept-order] Error message:', error?.message)
    console.error('[accept-order] Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    console.error('[accept-order] Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2))
    
    const errorMessage = error?.message || error?.error || 'Erro desconhecido'
    
    res.status(500).json({
      success: false,
      message: `Erro interno: ${errorMessage}`,
      error: errorMessage
    })
  }
})

/**
 * POST /api/ifood/cancel-order/:orderId
 * Cancel an iFood order (reject it)
 */
router.post('/cancel-order/:orderId', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params
    const ifoodService = new IfoodService()
    
    // Get order details from iFood to verify it exists
    const config = await ifoodService.getConfig()
    if (!config) {
      return res.status(500).json({
        success: false,
        message: 'Configuração do iFood não encontrada'
      })
    }
    
    // Cancel order with iFood API (BIDIRECTIONAL: System → iFood API)
    // According to iFood workflow: PLACED → CANCELLED (when rejected)
    console.log(`[cancel-order] Starting cancellation process for order ${orderId}`)
    console.log(`[cancel-order] Config found:`, {
      hasMerchantId: !!config.merchant_id,
      merchantId: config.merchant_id,
      hasAccessToken: !!config.access_token
    })
    
    // Get cancellation code and reason from request body (optional - will be fetched automatically if not provided)
    const cancellationCode = req.body?.cancellationCode
    const cancellationReason = req.body?.cancellationReason || req.body?.reason
    
    let cancelResult
    try {
      if (cancellationCode) {
        console.log(`[cancel-order] Calling updateOrderStatus for order ${orderId} with cancellationCode: ${cancellationCode}${cancellationReason ? ` and reason: ${cancellationReason}` : ''}`)
      } else {
        console.log(`[cancel-order] Calling updateOrderStatus for order ${orderId} (will fetch valid cancellation codes automatically)`)
      }
      cancelResult = await ifoodService.updateOrderStatus(orderId, 'CANCELLED', cancellationCode, cancellationReason)
      console.log(`[cancel-order] updateOrderStatus result:`, cancelResult)
    } catch (cancelError: any) {
      console.error(`[cancel-order] Exception during updateOrderStatus:`, cancelError)
      console.error(`[cancel-order] Error type:`, typeof cancelError)
      console.error(`[cancel-order] Error instanceof Error:`, cancelError instanceof Error)
      console.error(`[cancel-order] Error message:`, cancelError?.message)
      console.error(`[cancel-order] Error stack:`, cancelError instanceof Error ? cancelError.stack : 'No stack trace')
      return res.status(500).json({
        success: false,
        message: `Erro ao cancelar pedido no iFood: ${cancelError?.message || 'Erro desconhecido'}`,
        error: cancelError?.message || String(cancelError)
      })
    }
    
    if (!cancelResult.success) {
      console.error(`[cancel-order] Failed to cancel order ${orderId} with iFood:`, cancelResult.error)
      return res.status(500).json({
        success: false,
        message: cancelResult.error || 'Erro ao cancelar pedido no iFood',
        error: cancelResult.error
      })
    }
    
    console.log(`[cancel-order] Order ${orderId} successfully cancelled with iFood API`)
    if (cancelResult.isAsync) {
      console.log(`[cancel-order] Order ${orderId} cancellation is async. Waiting for confirmation event in polling.`)
    }
    
    // If order exists in our system, update its status
    const { createClient } = await import('@supabase/supabase-js')
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (supabaseUrl && supabaseServiceKey) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey)
      
      // Check if order exists in our system
      const { data: existingOrder } = await supabase
        .from('orders')
        .select('id')
        .eq('ifood_order_id', orderId)
        .single()
      
      if (existingOrder) {
        // Update order status to Cancelled
        await supabase
          .from('orders')
          .update({ 
            status: 'Cancelled',
            ifood_status: 'CANCELLED',
            closed_at: new Date().toISOString()
          })
          .eq('id', existingOrder.id)
      }
    }
    
    res.json({
      success: true,
      message: 'Pedido cancelado com sucesso'
    })
  } catch (error: any) {
    console.error('[cancel-order] Unexpected error:', error)
    console.error('[cancel-order] Error type:', typeof error)
    console.error('[cancel-order] Error instanceof Error:', error instanceof Error)
    console.error('[cancel-order] Error message:', error?.message)
    console.error('[cancel-order] Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    console.error('[cancel-order] Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2))
    
    const errorMessage = error?.message || error?.error || 'Erro desconhecido'
    
    res.status(500).json({
      success: false,
      message: `Erro interno: ${errorMessage}`,
      error: errorMessage
    })
  }
})

/**
 * GET /api/ifood/active-orders
 * Get active orders from iFood (CONFIRMED and PREPARATION_STARTED status)
 */
router.get('/active-orders', async (req: Request, res: Response) => {
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({
        success: false,
        message: 'Supabase não configurado'
      })
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Get orders from iFood that are CONFIRMED or PREPARATION_STARTED
    const { data: orders, error } = await supabase
      .from('orders')
      .select('*, items:order_items(*)')
      .eq('source', 'ifood')
      .in('ifood_status', ['CONFIRMED', 'PREPARATION_STARTED'])
      .in('status', ['Pending', 'Preparing'])
      .order('created_at', { ascending: false })
    
    if (error) {
      return res.status(500).json({
        success: false,
        message: error.message
      })
    }
    
    // Format orders to match frontend structure
    const formattedOrders = (orders || []).map((o: any) => ({
      id: o.id,
      customer: o.customer,
      table: o.table_number,
      orderType: o.order_type || 'delivery',
      total: o.total,
      status: o.status,
      time: new Date(o.created_at).toLocaleString('pt-BR'),
      created_at: o.created_at,
      closedAt: o.closed_at,
      notes: o.notes,
      paymentMethod: o.payment_method,
      source: o.source || 'manual',
      ifood_order_id: o.ifood_order_id || null,
      ifood_display_id: o.ifood_display_id || null,
      ifood_status: o.ifood_status || null,
      items: (o.items || []).map((i: any) => ({
        id: i.product_id || i.menu_item_id,
        name: i.name,
        price: i.price,
        quantity: i.quantity
      }))
    }))
    
    res.json({
      success: true,
      orders: formattedOrders
    })
  } catch (error) {
    console.error('Erro ao buscar pedidos ativos do iFood:', error)
    res.status(500).json({
      success: false,
      message: `Erro interno: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
    })
  }
})

/**
 * GET /api/ifood/dispatched-orders
 * Get dispatched orders from iFood (DISPATCHED status)
 */
router.get('/dispatched-orders', async (req: Request, res: Response) => {
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({
        success: false,
        message: 'Supabase não configurado'
      })
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Get orders from iFood that are DISPATCHED
    // Note: DISPATCHED orders can have different internal statuses (Delivered, In Progress, etc.)
    const { data: orders, error } = await supabase
      .from('orders')
      .select('*, items:order_items(*)')
      .eq('source', 'ifood')
      .eq('ifood_status', 'DISPATCHED')
      .order('created_at', { ascending: false })
    
    console.log(`[dispatched-orders] Found ${orders?.length || 0} dispatched orders`)
    
    if (error) {
      console.error('[dispatched-orders] Supabase error:', error)
      return res.status(500).json({
        success: false,
        message: error.message
      })
    }
    
    // Format orders to match frontend structure
    const formattedOrders = (orders || []).map((o: any) => ({
      id: o.id,
      customer: o.customer,
      table: o.table_number,
      orderType: o.order_type || 'delivery',
      total: o.total,
      status: o.status,
      time: new Date(o.created_at).toLocaleString('pt-BR'),
      created_at: o.created_at,
      closedAt: o.closed_at,
      notes: o.notes,
      paymentMethod: o.payment_method,
      source: o.source || 'manual',
      ifood_order_id: o.ifood_order_id || null,
      ifood_display_id: o.ifood_display_id || null,
      ifood_status: o.ifood_status || null,
      items: (o.items || []).map((i: any) => ({
        id: i.product_id || i.menu_item_id,
        name: i.name,
        price: i.price,
        quantity: i.quantity
      }))
    }))
    
    console.log(`[dispatched-orders] Returning ${formattedOrders.length} formatted orders`)
    if (formattedOrders.length > 0) {
      console.log(`[dispatched-orders] First order sample:`, {
        id: formattedOrders[0].id,
        customer: formattedOrders[0].customer,
        ifood_status: formattedOrders[0].ifood_status,
        itemsCount: formattedOrders[0].items?.length || 0
      })
    }
    
    res.json({
      success: true,
      orders: formattedOrders
    })
  } catch (error) {
    console.error('Erro ao buscar pedidos despachados do iFood:', error)
    res.status(500).json({
      success: false,
      message: `Erro interno: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
    })
  }
})

/**
 * GET /api/ifood/concluded-orders
 * Get concluded orders from iFood (CONCLUDED status)
 */
router.get('/concluded-orders', async (req: Request, res: Response) => {
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({
        success: false,
        message: 'Supabase não configurado'
      })
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Get orders from iFood that are CONCLUDED or CANCELLED
    const { data: orders, error } = await supabase
      .from('orders')
      .select('*, items:order_items(*)')
      .eq('source', 'ifood')
      .in('ifood_status', ['CONCLUDED', 'CANCELLED'])
      .in('status', ['Closed', 'Cancelled'])
      .limit(100) // Get more to sort properly, then limit to 50
    
    if (error) {
      return res.status(500).json({
        success: false,
        message: error.message
      })
    }
    
    // Format orders to match frontend structure
    let formattedOrders = (orders || []).map((o: any) => ({
      id: o.id,
      customer: o.customer,
      table: o.table_number,
      orderType: o.order_type || 'delivery',
      total: o.total,
      status: o.status,
      time: new Date(o.created_at).toLocaleString('pt-BR'),
      created_at: o.created_at,
      closedAt: o.closed_at,
      notes: o.notes,
      paymentMethod: o.payment_method,
      source: o.source || 'manual',
      ifood_order_id: o.ifood_order_id || null,
      ifood_display_id: o.ifood_display_id || null,
      ifood_status: o.ifood_status || null,
      items: (o.items || []).map((i: any) => ({
        id: i.product_id || i.menu_item_id,
        name: i.name,
        price: i.price,
        quantity: i.quantity
      }))
    }))
    
    // Sort by last state change: closed_at (when status changed to Closed/Cancelled) 
    // with fallback to created_at, descending (most recent first)
    formattedOrders.sort((a: any, b: any) => {
      const dateA = a.closedAt ? new Date(a.closedAt).getTime() : new Date(a.created_at).getTime()
      const dateB = b.closedAt ? new Date(b.closedAt).getTime() : new Date(b.created_at).getTime()
      return dateB - dateA // Descending order (most recent first)
    })
    
    // Limit to last 50 orders after sorting
    formattedOrders = formattedOrders.slice(0, 50)
    
    res.json({
      success: true,
      orders: formattedOrders
    })
  } catch (error) {
    console.error('Erro ao buscar pedidos finalizados do iFood:', error)
    res.status(500).json({
      success: false,
      message: `Erro interno: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
    })
  }
})

/**
 * POST /api/ifood/sync-order-status/:orderId
 * Sync order status to iFood when status changes in system
 */
router.post('/sync-order-status/:orderId', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params
    const { status } = req.body
    
    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status é obrigatório'
      })
    }
    
    const pollingService = getPollingService()
    await pollingService.syncOrderStatusToIfood(orderId, status)
    
    res.json({
      success: true,
      message: 'Status sincronizado com iFood'
    })
  } catch (error) {
    console.error('Erro ao sincronizar status do pedido com iFood:', error)
    res.status(500).json({
      success: false,
      message: `Erro interno: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
    })
  }
})

/**
 * POST /api/ifood/sync-all-orders-status
 * Sync all iFood orders status by checking API and comparing with database
 * This ensures status consistency between iFood API and local database
 */
router.post('/sync-all-orders-status', async (req: Request, res: Response) => {
  try {
    const pollingService = getPollingService()
    const result = await pollingService.syncAllOrdersStatus()
    
    res.json({
      success: true,
      message: `Sincronização concluída: ${result.synced} pedidos verificados, ${result.updated} atualizados, ${result.errors} erros`,
      ...result
    })
  } catch (error) {
    console.error('Erro ao sincronizar status de todos os pedidos:', error)
    res.status(500).json({
      success: false,
      message: `Erro interno: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
    })
  }
})

/**
 * POST /api/ifood/start-preparation/:orderId
 * Start preparation of an iFood order (PREPARATION_STARTED)
 */
router.post('/start-preparation/:orderId', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params
    const ifoodService = new IfoodService()
    
    console.log(`[start-preparation] Starting preparation for order ${orderId}`)
    
    const result = await ifoodService.updateOrderStatus(orderId, 'PREPARATION_STARTED')
    
    if (!result.success) {
      // Tentar buscar status atual do pedido para retornar informação mais útil
      const orderDetailsResult = await ifoodService.getOrderDetails(orderId)
      if (orderDetailsResult.success && orderDetailsResult.order) {
        // Extrair status atual do pedido
        const currentStatus = extractOrderStatus(orderDetailsResult.order)
        return res.status(500).json({
          success: false,
          message: result.error || 'Erro ao iniciar preparação do pedido no iFood',
          currentStatus: currentStatus.status,
          currentIfoodStatus: currentStatus.ifoodStatus,
          statusMessage: getStatusMessage(currentStatus.ifoodStatus)
        })
      }
      
      return res.status(500).json({
        success: false,
        message: result.error || 'Erro ao iniciar preparação do pedido no iFood'
      })
    }
    
    // Update database
    const { createClient } = await import('@supabase/supabase-js')
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (supabaseUrl && supabaseServiceKey) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey)
      
      const { data: existingOrder } = await supabase
        .from('orders')
        .select('id')
        .eq('ifood_order_id', orderId)
        .single()
      
      if (existingOrder) {
        await supabase
          .from('orders')
          .update({ 
            status: 'Preparing',
            ifood_status: 'PREPARATION_STARTED'
          })
          .eq('id', existingOrder.id)
      }
    }
    
    res.json({
      success: true,
      message: 'Preparação iniciada com sucesso',
      isAsync: result.isAsync
    })
  } catch (error: any) {
    console.error('[start-preparation] Error:', error)
    res.status(500).json({
      success: false,
      message: `Erro interno: ${error?.message || 'Erro desconhecido'}`
    })
  }
})

/**
 * POST /api/ifood/ready-to-pickup/:orderId
 * Mark an iFood order as ready to pickup (READY_TO_PICKUP)
 */
router.post('/ready-to-pickup/:orderId', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params
    const ifoodService = new IfoodService()
    
    console.log(`[ready-to-pickup] Marking order ${orderId} as ready to pickup`)
    
    const result = await ifoodService.updateOrderStatus(orderId, 'READY_TO_PICKUP')
    
    if (!result.success) {
      // Tentar buscar status atual do pedido para retornar informação mais útil
      const orderDetailsResult = await ifoodService.getOrderDetails(orderId)
      if (orderDetailsResult.success && orderDetailsResult.order) {
        // Extrair status atual do pedido
        const currentStatus = extractOrderStatus(orderDetailsResult.order)
        return res.status(500).json({
          success: false,
          message: result.error || 'Erro ao marcar pedido como pronto para retirada no iFood',
          currentStatus: currentStatus.status,
          currentIfoodStatus: currentStatus.ifoodStatus,
          statusMessage: getStatusMessage(currentStatus.ifoodStatus)
        })
      }
      
      return res.status(500).json({
        success: false,
        message: result.error || 'Erro ao marcar pedido como pronto para retirada no iFood'
      })
    }
    
    // Update database
    const { createClient } = await import('@supabase/supabase-js')
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (supabaseUrl && supabaseServiceKey) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey)
      
      const { data: existingOrder } = await supabase
        .from('orders')
        .select('id')
        .eq('ifood_order_id', orderId)
        .single()
      
      if (existingOrder) {
        await supabase
          .from('orders')
          .update({ 
            status: 'Ready',
            ifood_status: 'READY_TO_PICKUP'
          })
          .eq('id', existingOrder.id)
      }
    }
    
    res.json({
      success: true,
      message: 'Pedido marcado como pronto para retirada',
      isAsync: result.isAsync
    })
  } catch (error: any) {
    console.error('[ready-to-pickup] Error:', error)
    res.status(500).json({
      success: false,
      message: `Erro interno: ${error?.message || 'Erro desconhecido'}`
    })
  }
})

/**
 * POST /api/ifood/dispatch-order/:orderId
 * Dispatch an iFood order (DISPATCHED)
 */
router.post('/dispatch-order/:orderId', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params
    const ifoodService = new IfoodService()
    
    console.log(`[dispatch-order] Dispatching order ${orderId}`)
    
    const result = await ifoodService.updateOrderStatus(orderId, 'DISPATCHED')
    
    if (!result.success) {
      // Tentar buscar status atual do pedido para retornar informação mais útil
      const orderDetailsResult = await ifoodService.getOrderDetails(orderId)
      if (orderDetailsResult.success && orderDetailsResult.order) {
        // Extrair status atual do pedido
        const currentStatus = extractOrderStatus(orderDetailsResult.order)
        return res.status(500).json({
          success: false,
          message: result.error || 'Erro ao despachar pedido no iFood',
          currentStatus: currentStatus.status,
          currentIfoodStatus: currentStatus.ifoodStatus,
          statusMessage: getStatusMessage(currentStatus.ifoodStatus)
        })
      }
      
      return res.status(500).json({
        success: false,
        message: result.error || 'Erro ao despachar pedido no iFood'
      })
    }
    
    // Update database
    const { createClient } = await import('@supabase/supabase-js')
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (supabaseUrl && supabaseServiceKey) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey)
      
      const { data: existingOrder } = await supabase
        .from('orders')
        .select('id')
        .eq('ifood_order_id', orderId)
        .single()
      
      if (existingOrder) {
        await supabase
          .from('orders')
          .update({ 
            status: 'Delivered',
            ifood_status: 'DISPATCHED'
          })
          .eq('id', existingOrder.id)
      }
    }
    
    res.json({
      success: true,
      message: 'Pedido despachado com sucesso',
      isAsync: result.isAsync
    })
  } catch (error: any) {
    console.error('[dispatch-order] Error:', error)
    res.status(500).json({
      success: false,
      message: `Erro interno: ${error?.message || 'Erro desconhecido'}`
    })
  }
})

/**
 * GET /api/ifood/order-status/:orderId
 * Get current status of an iFood order
 */
router.get('/order-status/:orderId', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params
    const ifoodService = new IfoodService()
    
    console.log(`[order-status] Fetching status for order ${orderId}`)
    
    const orderDetailsResult = await ifoodService.getOrderDetails(orderId)
    
    if (!orderDetailsResult.success || !orderDetailsResult.order) {
      return res.status(404).json({
        success: false,
        message: orderDetailsResult.error || 'Pedido não encontrado no iFood'
      })
    }
    
    const status = extractOrderStatus(orderDetailsResult.order)
    
    res.json({
      success: true,
      status: status.status,
      ifoodStatus: status.ifoodStatus,
      statusMessage: getStatusMessage(status.ifoodStatus),
      order: orderDetailsResult.order
    })
  } catch (error: any) {
    console.error('[order-status] Error:', error)
    res.status(500).json({
      success: false,
      message: `Erro interno: ${error?.message || 'Erro desconhecido'}`
    })
  }
})

/**
 * Helper function to extract order status from iFood order object
 */
function extractOrderStatus(order: any): { status: string; ifoodStatus: string } {
  // Try multiple ways to get the status
  let currentIfoodStatus: string | null = null
  
  // 1. Check if order has a direct status field
  if (order.status) {
    currentIfoodStatus = String(order.status).toUpperCase()
  }
  // 2. Check if order has events array and get latest status event
  else if (order.events && Array.isArray(order.events)) {
    const events = order.events
    const statusEvents = events
      .filter((e: any) => {
        const code = (e.code || e.fullCode || '').toUpperCase()
        return ['PLC', 'PLACED', 'CFM', 'CONFIRMED', 'SPS', 'SEPARATION_STARTED', 
                'SPE', 'SEPARATION_ENDED', 'RTP', 'READY_TO_PICKUP', 
                'DSP', 'DISPATCHED', 'CON', 'CONCLUDED', 'CAN', 'CANCELLED'].includes(code)
      })
      .sort((a: any, b: any) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0
        return dateB - dateA // Most recent first
      })
    
    if (statusEvents.length > 0) {
      const latestEvent = statusEvents[0]
      currentIfoodStatus = (latestEvent.fullCode || latestEvent.code || '').toUpperCase()
    }
  }
  // 3. Check if order has a lastEvent field
  else if (order.lastEvent) {
    const lastEvent = order.lastEvent
    currentIfoodStatus = (lastEvent.fullCode || lastEvent.code || '').toUpperCase()
  }
  
  // Normalize status codes
  const statusMap: Record<string, string> = {
    'PLC': 'PLACED',
    'PLACED': 'PLACED',
    'CFM': 'CONFIRMED',
    'CONFIRMED': 'CONFIRMED',
    'SPS': 'PREPARATION_STARTED',
    'SEPARATION_STARTED': 'PREPARATION_STARTED',
    'PREPARATION_STARTED': 'PREPARATION_STARTED',
    'SPE': 'SEPARATION_ENDED',
    'SEPARATION_ENDED': 'SEPARATION_ENDED',
    'RTP': 'READY_TO_PICKUP',
    'READY_TO_PICKUP': 'READY_TO_PICKUP',
    'DSP': 'DISPATCHED',
    'DISPATCHED': 'DISPATCHED',
    'CON': 'CONCLUDED',
    'CONCLUDED': 'CONCLUDED',
    'CAN': 'CANCELLED',
    'CANCELLED': 'CANCELLED'
  }
  
  currentIfoodStatus = currentIfoodStatus ? (statusMap[currentIfoodStatus] || currentIfoodStatus) : 'UNKNOWN'
  
  // Map iFood status to system status
  let systemStatus = 'Unknown'
  switch (currentIfoodStatus.toUpperCase()) {
    case 'PLACED':
    case 'PLC':
      systemStatus = 'Pending'
      break
    case 'CONFIRMED':
    case 'CFM':
      systemStatus = 'Preparing'
      break
    case 'PREPARATION_STARTED':
    case 'SEPARATION_STARTED':
    case 'SPS':
      systemStatus = 'Preparing'
      break
    case 'SEPARATION_ENDED':
    case 'SPE':
      systemStatus = 'Preparing'
      break
    case 'READY_TO_PICKUP':
    case 'RTP':
      systemStatus = 'Ready'
      break
    case 'DISPATCHED':
    case 'DSP':
      systemStatus = 'Delivered'
      break
    case 'CONCLUDED':
    case 'CON':
      systemStatus = 'Closed'
      break
    case 'CANCELLED':
    case 'CAN':
      systemStatus = 'Cancelled'
      break
  }
  
  return { status: systemStatus, ifoodStatus: currentIfoodStatus }
}

/**
 * Helper function to get user-friendly status message
 */
function getStatusMessage(ifoodStatus: string): string {
  const statusMessages: Record<string, string> = {
    'PLACED': 'Pedido foi realizado e está aguardando confirmação',
    'CONFIRMED': 'Pedido foi confirmado e está sendo preparado',
    'PREPARATION_STARTED': 'Preparação do pedido foi iniciada',
    'SEPARATION_STARTED': 'Separação do pedido foi iniciada',
    'SEPARATION_ENDED': 'Separação do pedido foi finalizada',
    'READY_TO_PICKUP': 'Pedido está pronto para retirada',
    'DISPATCHED': 'Pedido foi despachado para entrega',
    'CONCLUDED': 'Pedido foi concluído',
    'CANCELLED': 'Pedido foi cancelado'
  }
  
  return statusMessages[ifoodStatus] || `Status atual: ${ifoodStatus}`
}

export default router

