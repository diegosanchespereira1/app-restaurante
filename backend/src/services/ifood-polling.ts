import cron from 'node-cron'
import { IfoodService, IfoodOrder, IfoodOrderItem } from './ifood-service.js'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

interface ProcessedOrder {
  ifoodOrderId: string
  customer: string
  orderType: 'delivery' | 'takeout'
  items: Array<{
    productId: number
    name: string
    price: number
    quantity: number
  }>
  total: number
  ifoodStatus: string
  deliveryAddress?: string
  customerPhone?: string
}

export class IfoodPollingService {
  private ifoodService: IfoodService
  private supabase: SupabaseClient
  private cronJob: cron.ScheduledTask | null = null
  private isRunning: boolean = false

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase credentials not configured')
    }

    this.supabase = createClient(supabaseUrl, supabaseServiceKey)
    this.ifoodService = new IfoodService()
  }

  /**
   * Start polling service
   */
  async start(): Promise<void> {
    const config = await this.ifoodService.getConfig()
    
    if (!config || !config.is_active) {
      console.log('iFood integration is not active. Polling service not started.')
      return
    }

    // iFood best practice: polling a cada 30 segundos para manter merchant ativo
    const interval = config.polling_interval || 30 // seconds (default 30s per iFood recommendation)
    const cronExpression = `*/${interval} * * * * *` // Every N seconds

    console.log(`Starting iFood polling service (interval: ${interval}s)`)

    this.cronJob = cron.schedule(cronExpression, async () => {
      if (this.isRunning) {
        console.log('iFood polling already running, skipping...')
        return
      }

      this.isRunning = true
      try {
        await this.pollOrders()
      } catch (error) {
        console.error('Error in iFood polling:', error)
      } finally {
        this.isRunning = false
      }
    })

    // Run immediately on start
    this.pollOrders().catch(error => {
      console.error('Error in initial iFood poll:', error)
    })
  }

  /**
   * Stop polling service
   */
  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop()
      this.cronJob = null
      console.log('iFood polling service stopped')
    }
  }

  /**
   * Poll for new orders from iFood
   */
  async pollOrders(): Promise<void> {
    try {
      // Get orders with status PLACED (new orders)
      // PLACED = Novo pedido na plataforma
      const result = await this.ifoodService.getOrders('PLACED')
      
      if (!result.success || !result.orders) {
        console.log('No new orders from iFood or error occurred')
        return
      }

      console.log(`Found ${result.orders.length} new order(s) from iFood`)

      for (const ifoodOrder of result.orders) {
        try {
          // Check if order already exists
          const { data: existingOrder } = await this.supabase
            .from('orders')
            .select('id')
            .eq('ifood_order_id', ifoodOrder.id)
            .single()

          if (existingOrder) {
            console.log(`Order ${ifoodOrder.id} already exists, skipping...`)
            continue
          }

          // iFood best practice: Consultar detalhes antes de confirmar
          // (já temos os detalhes do pedido do polling)
          // Process and create order
          const processedOrder = await this.processOrder(ifoodOrder)
          
          if (processedOrder) {
            // iFood best practice: Persistir antes de acknowledgment
            await this.createOrder(processedOrder)
            
            // iFood best practice: Consultar detalhes antes de confirmar
            // Como já temos os detalhes do polling, podemos confirmar
            const confirmResult = await this.ifoodService.updateOrderStatus(ifoodOrder.id, 'CONFIRMED')
            
            if (confirmResult.isAsync) {
              console.log(`Confirmação do pedido ${ifoodOrder.id} é assíncrona. Aguardando evento de confirmação.`)
            }
            
            console.log(`Order ${ifoodOrder.id} created successfully`)
          }
        } catch (error) {
          console.error(`Error processing order ${ifoodOrder.id}:`, error)
        }
      }

      // Update last sync time
      await this.ifoodService.updateLastSync()
    } catch (error) {
      console.error('Error polling iFood orders:', error)
    }
  }

  /**
   * Process iFood order and map products
   */
  async processOrder(ifoodOrder: IfoodOrder): Promise<ProcessedOrder | null> {
    try {
      const items: ProcessedOrder['items'] = []

      // Process each item in the order
      for (const ifoodItem of ifoodOrder.items) {
        // Try to map product by SKU
        let productId: number | null = null

        if (ifoodItem.sku || ifoodItem.externalCode) {
          const sku = ifoodItem.sku || ifoodItem.externalCode!
          const mappingResult = await this.ifoodService.mapProductBySku(
            ifoodItem.id,
            sku
          )

          if (mappingResult.success && mappingResult.productId) {
            productId = mappingResult.productId
          } else {
            // Try to find product by SKU directly
            const { data: product } = await this.supabase
              .from('products')
              .select('id')
              .eq('sku', sku)
              .single()

            if (product && product.id) {
              productId = product.id
              // Create mapping for future use
              await this.ifoodService.createProductMapping(
                ifoodItem.id,
                sku,
                product.id
              )
            }
          }
        }

        // If no mapping found, we still create the order item but without product_id
        // The user can manually map it later
        items.push({
          productId: productId || 0, // 0 indicates unmapped
          name: ifoodItem.name,
          price: ifoodItem.unitPrice,
          quantity: ifoodItem.quantity
        })
      }

      // Determine order type
      const orderType: 'delivery' | 'takeout' = 
        ifoodOrder.orderTiming === 'DELIVERY' ? 'delivery' : 'takeout'

      // Build delivery address string if available
      let deliveryAddress: string | undefined
      if (ifoodOrder.delivery?.address) {
        const addr = ifoodOrder.delivery.address
        deliveryAddress = `${addr.street}, ${addr.number}${addr.complement ? ` - ${addr.complement}` : ''}, ${addr.neighborhood}, ${addr.city} - ${addr.state}, ${addr.zipCode}`
      }

      return {
        ifoodOrderId: ifoodOrder.id,
        customer: ifoodOrder.customer.name || 'Cliente iFood',
        orderType,
        items,
        total: ifoodOrder.totalPrice.amount,
        ifoodStatus: 'PLACED',
        deliveryAddress,
        customerPhone: ifoodOrder.customer.phoneNumber
      }
    } catch (error) {
      console.error('Error processing iFood order:', error)
      return null
    }
  }

  /**
   * Create order in system database
   */
  async createOrder(processedOrder: ProcessedOrder): Promise<void> {
    try {
      // Generate order ID
      const now = new Date()
      const day = String(now.getDate()).padStart(2, '0')
      const month = String(now.getMonth() + 1).padStart(2, '0')
      const year = now.getFullYear()
      const hours = String(now.getHours()).padStart(2, '0')
      const minutes = String(now.getMinutes()).padStart(2, '0')
      
      // Get next order number
      const { data: orders } = await this.supabase
        .from('orders')
        .select('id')
        .order('created_at', { ascending: false })
        .limit(1)

      let nextNumber = 1
      if (orders && orders.length > 0) {
        const lastId = orders[0].id
        const match = lastId.match(/\d+$/)
        if (match) {
          nextNumber = parseInt(match[0], 10) + 1
        }
      }

      const orderId = `ORD-${day}${month}${year}-${String(nextNumber).padStart(4, '0')}`
      const formattedDate = `${day}/${month}/${year} ${hours}:${minutes}`

      // Create order
      const { error: orderError } = await this.supabase
        .from('orders')
        .insert({
          id: orderId,
          customer: processedOrder.customer,
          order_type: processedOrder.orderType,
          total: processedOrder.total,
          status: 'Pending',
          source: 'ifood',
          ifood_order_id: processedOrder.ifoodOrderId,
          ifood_status: processedOrder.ifoodStatus,
          notes: processedOrder.deliveryAddress 
            ? `Endereço: ${processedOrder.deliveryAddress}${processedOrder.customerPhone ? ` | Telefone: ${processedOrder.customerPhone}` : ''}`
            : processedOrder.customerPhone 
              ? `Telefone: ${processedOrder.customerPhone}`
              : null
        })

      if (orderError) {
        throw new Error(`Failed to create order: ${orderError.message}`)
      }

      // Create order items
      for (const item of processedOrder.items) {
        // Use product_id if mapped, otherwise null
        const productId: number | null = item.productId > 0 ? item.productId : null

        const { error: itemError } = await this.supabase
          .from('order_items')
          .insert({
            order_id: orderId,
            product_id: productId,
            menu_item_id: null, // Always null, using products now
            name: item.name,
            price: item.price,
            quantity: item.quantity
          })

        if (itemError) {
          console.error(`Failed to create order item: ${itemError.message}`)
        }
      }
    } catch (error) {
      console.error('Error creating order:', error)
      throw error
    }
  }

  /**
   * Sync order status to iFood when status changes in system
   */
  async syncOrderStatusToIfood(orderId: string, systemStatus: string): Promise<void> {
    try {
      // Get order with iFood ID
      const { data: order } = await this.supabase
        .from('orders')
        .select('ifood_order_id, ifood_status')
        .eq('id', orderId)
        .single()

      if (!order?.ifood_order_id) {
        return // Not an iFood order
      }

      // Map system status to iFood status
      let ifoodStatus: 'PLACED' | 'CONFIRMED' | 'SEPARATION_STARTED' | 'SEPARATION_ENDED' | 'READY_TO_PICKUP' | 'DISPATCHED' | 'CONCLUDED' | 'CANCELLED' | null = null

      switch (systemStatus.toUpperCase()) {
        case 'PENDING':
          ifoodStatus = 'PLACED'
          break
        case 'PREPARING':
          ifoodStatus = 'CONFIRMED'
          break
        case 'READY':
          ifoodStatus = 'READY_TO_PICKUP'
          break
        case 'DELIVERED':
          ifoodStatus = 'DISPATCHED'
          break
        case 'CLOSED':
          ifoodStatus = 'CONCLUDED'
          break
        case 'CANCELLED':
          ifoodStatus = 'CANCELLED'
          break
      }

      if (ifoodStatus && ifoodStatus !== order.ifood_status) {
        const result = await this.ifoodService.updateOrderStatus(
          order.ifood_order_id,
          ifoodStatus
        )

        if (result.success) {
          // Update ifood_status in database
          await this.supabase
            .from('orders')
            .update({ ifood_status: ifoodStatus })
            .eq('id', orderId)
        }
      }
    } catch (error) {
      console.error('Error syncing order status to iFood:', error)
    }
  }
}

