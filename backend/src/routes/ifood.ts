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
                         'CONCLUDED', 'CON', 'CANCELLED', 'CAN']
    
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
            
            // iFood best practice: Consultar detalhes antes de confirmar
            // (já consultamos acima, então podemos confirmar)
            const confirmResult = await ifoodService.updateOrderStatus(orderId, 'CONFIRMED')
            
            if (confirmResult.isAsync) {
              console.log(`Confirmação do pedido ${orderId} é assíncrona. Aguardando evento de confirmação no polling.`)
            }
            
            // Atualizar última sincronização
            await ifoodService.updateLastSync()
            
            console.log(`Pedido ${orderId} processado via webhook`)
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
  fetch('http://127.0.0.1:7243/ingest/b058c8da-e202-4622-9483-5c45531d7867',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ifood.ts:924',message:'pending-orders endpoint called',data:{timestamp:new Date().toISOString()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
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
      return res.status(200).json({
        success: true,
        orders: [],
        message: result.error || 'Falha ao buscar eventos do iFood'
      })
    }
    
    // If no events returned, return empty array
    if (!result.orders || result.orders.length === 0) {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/b058c8da-e202-4622-9483-5c45531d7867',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ifood.ts:940',message:'returning empty orders - no events',data:{success:result.success,hasOrders:!!result.orders,ordersLength:result.orders?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      return res.status(200).json({
        success: true,
        orders: []
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
    
    // Get existing iFood order IDs
    const { data: existingOrders } = await supabase
      .from('orders')
      .select('ifood_order_id')
      .not('ifood_order_id', 'is', null)
    
    const existingIds = new Set(existingOrders?.map(o => o.ifood_order_id) || [])
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/b058c8da-e202-4622-9483-5c45531d7867',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ifood.ts:958',message:'existing orders check',data:{existingOrdersCount:existingIds.size},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    // Events from polling need to be processed - extract order IDs and fetch full order details
    const events = result.orders as any[]
    const pendingOrders: any[] = []
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/b058c8da-e202-4622-9483-5c45531d7867',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ifood.ts:962',message:'processing events',data:{eventsCount:events.length,firstEventKeys:events[0]?Object.keys(events[0]):null,firstEventSample:events[0]?JSON.stringify(events[0]).substring(0,300):null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    
    // Extract order IDs from events first (faster) - remove duplicates
    // Focus on PLC (Place Order) events which are the pending orders
    const orderIdsSet = new Set<string>()
    const eventDetails: any[] = []
    
    // Process status update events for existing orders
    for (const event of events) {
      // Log event structure for debugging
      const eventType = event.type || event.eventType || event.code || 'unknown'
      const eventStatus = event.status || event.eventStatus || 'unknown'
      
      // Extract event code and order ID
      const eventCode = (event.code || event.fullCode || eventType || '').toUpperCase()
      const orderId = event.orderId || 
                     event.id || 
                     event.payload?.orderId || 
                     event.payload?.id ||
                     event.payload?.orderId ||
                     event.order?.id ||
                     event.order?.orderId ||
                     event.data?.orderId ||
                     event.data?.id ||
                     event.data?.order?.id ||
                     event.data?.order?.orderId ||
                     (event.payload?.order && (event.payload.order.id || event.payload.order.orderId)) ||
                     (event.order && (event.order.id || event.order.orderId)) ||
                     (typeof event === 'string' ? event : null) // Sometimes the event itself is the ID
      
      eventDetails.push({
        type: eventType,
        status: eventStatus,
        code: eventCode,
        hasOrderId: !!orderId,
        orderId: orderId || null,
        eventKeys: Object.keys(event),
        eventStructure: JSON.stringify(event).substring(0, 300)
      })
      
      // Process status update events for existing orders (DISPATCHED, CONCLUDED, etc.)
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/b058c8da-e202-4622-9483-5c45531d7867',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ifood.ts:1035',message:'checking if status update needed',data:{orderId,eventCode,hasOrderId:!!orderId,orderIdExists:orderId&&existingIds.has(orderId),eventCodeValue:eventCode},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      
      if (orderId && typeof orderId === 'string' && orderId.trim() !== '' && existingIds.has(orderId)) {
        const isStatusUpdateEvent = ['DSP', 'DISPATCHED', 'CON', 'CONCLUDED', 'CFM', 'CONFIRMED', 
                                    'SPS', 'SEPARATION_STARTED', 'SPE', 'SEPARATION_ENDED', 
                                    'RTP', 'READY_TO_PICKUP', 'CAN', 'CANCELLED'].includes(eventCode)
        
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
            }
            
            // Update order status in database
            const updateData: { status: string; ifood_status: string; closed_at?: string } = {
              status: systemStatus,
              ifood_status: ifoodStatus
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
      
      if (orderId && typeof orderId === 'string' && orderId.trim() !== '' && !existingIds.has(orderId)) {
        // Add all events that have a valid orderId and don't exist in our system
        // PLC = Place Order (novo pedido) - these are the pending orders we want to show
        // We'll process all events and let getOrderDetails determine if it's a valid order
        orderIdsSet.add(orderId)
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
    
    // If no order IDs found in events, return empty
    if (orderIdsToFetch.length === 0) {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/b058c8da-e202-4622-9483-5c45531d7867',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ifood.ts:1000',message:'no orderIds found in events',data:{eventsCount:events.length,existingIdsCount:existingIds.size},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      return res.status(200).json({
        success: true,
        orders: [],
        message: 'Nenhum pedido novo encontrado nos eventos'
      })
    }
    
    // Limit to 5 orders at a time to prevent timeout and reduce load
    const maxOrders = 5
    const limitedOrderIds = orderIdsToFetch.slice(0, maxOrders)
    
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/b058c8da-e202-4622-9483-5c45531d7867',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ifood.ts:1001',message:'fetching order details',data:{totalOrderIds:orderIdsToFetch.length,limitedOrderIds:limitedOrderIds.length,orderIds:limitedOrderIds},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    
    // Fetch order details in parallel (but limit concurrency to avoid overwhelming the API)
    const orderPromises = limitedOrderIds.map(async (orderId) => {
      try {
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/b058c8da-e202-4622-9483-5c45531d7867',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ifood.ts:983',message:'calling getOrderDetails',data:{orderId,before_call:true},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        const orderDetailsResult = await ifoodService.getOrderDetails(orderId)
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/b058c8da-e202-4622-9483-5c45531d7867',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ifood.ts:985',message:'getOrderDetails result',data:{orderId,success:orderDetailsResult.success,hasOrder:!!orderDetailsResult.order,error:orderDetailsResult.error||null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        
        if (orderDetailsResult.success && orderDetailsResult.order) {
          return orderDetailsResult.order
        }
        return null
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
          console.warn('Timeout ao buscar detalhes dos pedidos (20s). Retornando pedidos já processados.')
          resolve([])
        }, 20000) // 20 second timeout (reduced from 30s to fail faster)
      })
      
      const ordersResults = await Promise.race([
        Promise.allSettled(orderPromises).then(results => 
          results.map(r => r.status === 'fulfilled' ? r.value : null)
        ),
        timeoutPromise
      ])
      
      // Filter out null results and remove duplicates by order ID
      validOrders = (ordersResults || []).filter((order): order is any => order !== null)
      
      // Remove duplicates by order ID (keep first occurrence)
      const uniqueOrdersMap = new Map<string, any>()
      for (const order of validOrders) {
        if (order && order.id && !uniqueOrdersMap.has(order.id)) {
          uniqueOrdersMap.set(order.id, order)
        }
      }
      const uniqueOrders = Array.from(uniqueOrdersMap.values())
      
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/b058c8da-e202-4622-9483-5c45531d7867',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ifood.ts:1045',message:'removing duplicates',data:{validOrdersCount:validOrders.length,uniqueOrdersCount:uniqueOrders.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
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
        customer: responseData.orders[0].customer?.name
      } : null
    })
    
    // Set explicit headers
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Cache-Control', 'no-cache')
    
    res.json(responseData)
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/b058c8da-e202-4622-9483-5c45531d7867',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ifood.ts:995',message:'error in pending-orders endpoint',data:{error:error instanceof Error?error.message:String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    console.error('Erro ao buscar pedidos pendentes do iFood:', error)
    res.status(500).json({
      success: false,
      message: `Erro interno: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
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
    const ifoodService = new IfoodService()
    const pollingService = getPollingService()
    
    // Get order details from iFood
    const config = await ifoodService.getConfig()
    if (!config) {
      return res.status(500).json({
        success: false,
        message: 'Configuração do iFood não encontrada'
      })
    }
    
    const orderDetailsResult = await ifoodService.getOrderDetails(orderId)
    
    if (!orderDetailsResult.success || !orderDetailsResult.order) {
      return res.status(404).json({
        success: false,
        message: orderDetailsResult.error || 'Pedido não encontrado no iFood'
      })
    }
    
    // Process the order (map products, etc.)
    const processedOrder = await (pollingService as any).processOrder(orderDetailsResult.order)
    
    if (!processedOrder) {
      return res.status(500).json({
        success: false,
        message: 'Erro ao processar pedido'
      })
    }
    
    // Create order in system
    await (pollingService as any).createOrder(processedOrder)
    
    // Confirm order with iFood after creating in system (iFood best practice)
    // According to workflow: PLACED → CONFIRMED
    const confirmResult = await ifoodService.updateOrderStatus(orderId, 'CONFIRMED')
    if (confirmResult.success) {
      // Update ifood_status in database
      const { createClient } = await import('@supabase/supabase-js')
      const supabaseUrl = process.env.SUPABASE_URL
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      
      if (supabaseUrl && supabaseServiceKey) {
        const supabase = createClient(supabaseUrl, supabaseServiceKey)
        await supabase
          .from('orders')
          .update({ ifood_status: 'CONFIRMED' })
          .eq('ifood_order_id', orderId)
      }
    }
    
    res.json({
      success: true,
      message: 'Pedido aceito e criado no sistema com sucesso'
    })
  } catch (error) {
    console.error('Erro ao aceitar pedido do iFood:', error)
    res.status(500).json({
      success: false,
      message: `Erro interno: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
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
    
    // Get orders from iFood that are CONCLUDED
    const { data: orders, error } = await supabase
      .from('orders')
      .select('*, items:order_items(*)')
      .eq('source', 'ifood')
      .eq('ifood_status', 'CONCLUDED')
      .in('status', ['Closed'])
      .order('closed_at', { ascending: false })
      .limit(50) // Limit to last 50 concluded orders
    
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

export default router

