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
    const { merchant_id, client_id, client_secret, authorization_code, polling_interval, is_active } = req.body

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
    const authResult = await ifoodService.authenticate()
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
    const ifoodService = new IfoodService()
    const result = await ifoodService.getOrders('PLACED')

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: result.error || 'Failed to sync orders'
      })
    }

    // Restart polling service to process new orders
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

    // Test authentication
    const authResult = await ifoodService.ensureAuthenticated()

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

export default router

