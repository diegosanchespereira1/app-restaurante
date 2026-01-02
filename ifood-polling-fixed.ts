import cron from 'node-cron'
import { IfoodService, IfoodOrder, IfoodOrderItem } from './ifood-service.js'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'

interface ProcessedOrder {
  ifoodOrderId: string
  ifoodDisplayId?: string
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
   * Following iFood best practices:
   * - Poll every 30 seconds to keep merchant online
   * - Order events by createdAt (events may arrive out of order)
   * - Check for duplicate event IDs
   * - Send acknowledgment after processing
   */
  async pollOrders(): Promise<void> {
    try {
      // Use polling endpoint with correct format: events:polling?types=PLC,REC,CFM&groups=ORDER_STATUS,DELIVERY&categories=FOOD
      // This uses Bearer token authentication automatically
      const result = await this.ifoodService.pollEvents()
      
      if (!result.success || !result.orders || result.orders.length === 0) {
        // 204 No Content or empty array means no new events (this is normal)
        return
      }

      console.log(`Found ${result.orders.length} event(s) from iFood`)

      // Events from polling have a different structure than orders
      const events = result.orders as any[]

      // iFood best practice: Order events by createdAt (events may arrive out of order)
      events.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0
        return dateA - dateB
      })

      // Track processed event IDs to avoid duplicates
      const processedEventIds = new Set<string>()
      const eventsToAcknowledge: string[] = []

      for (const event of events) {
        // Extract event ID for acknowledgment and duplicate checking
        const eventId = event.id
        
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/b058c8da-e202-4622-9483-5c45531d7867',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ifood-polling.ts:124',message:'processing event',data:{eventId,eventCode:event.code,eventFullCode:event.fullCode,eventOrderId:event.orderId,eventStructure:JSON.stringify(event).substring(0,500)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        
        if (!eventId) {
          console.log('Event does not contain ID, skipping...', JSON.stringify(event))
          continue
        }

        try {

          // iFood best practice: Check for duplicate events (API may return same event multiple times)
          if (processedEventIds.has(eventId)) {
            console.log(`Event ${eventId} already processed, skipping duplicate...`)
            // Still acknowledge duplicate events
            eventsToAcknowledge.push(eventId)
            continue
          }

          processedEventIds.add(eventId)

          // Events from polling have a different structure - extract order ID
          // The event structure may vary, but typically contains orderId or id field
          const orderId = event.orderId || event.payload?.orderId || event.order?.id
          
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/b058c8da-e202-4622-9483-5c45531d7867',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ifood-polling.ts:147',message:'extracted orderId',data:{eventId,orderId,eventCode:event.code,eventFullCode:event.fullCode},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
          // #endregion
          
          if (!orderId) {
            console.log(`Event ${eventId} does not contain order ID, skipping...`)
            // Acknowledge events without order ID (even if we can't process them)
            eventsToAcknowledge.push(eventId)
            continue
          }

          // Extract event code to determine event type
          const eventCode = (event.code || event.fullCode || '').toUpperCase()
          
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/b058c8da-e202-4622-9483-5c45531d7867',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ifood-polling.ts:156',message:'checking existing order',data:{eventId,orderId,eventCode,isStatusUpdateEvent:['DSP','DISPATCHED','CON','CONCLUDED','CFM','CONFIRMED','SPS','SEPARATION_STARTED','SPE','SEPARATION_ENDED','RTP','READY_TO_PICKUP','CAN','CANCELLED'].includes(eventCode)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
          // #endregion

          // Check if order already exists
          const { data: existingOrder } = await this.supabase
            .from('orders')
            .select('id, status, ifood_status')
            .eq('ifood_order_id', orderId)
            .single()

          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/b058c8da-e202-4622-9483-5c45531d7867',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ifood-polling.ts:163',message:'existing order check result',data:{eventId,orderId,eventCode,orderExists:!!existingOrder,existingOrderId:existingOrder?.id,existingStatus:existingOrder?.status,existingIfoodStatus:existingOrder?.ifood_status},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
          // #endregion

          if (existingOrder) {
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/b058c8da-e202-4622-9483-5c45531d7867',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ifood-polling.ts:167',message:'order exists - checking if status update needed',data:{eventId,orderId,eventCode,isStatusUpdateEvent:['DSP','DISPATCHED','CON','CONCLUDED','CFM','CONFIRMED','SPS','SEPARATION_STARTED','SPE','SEPARATION_ENDED','RTP','READY_TO_PICKUP','CAN','CANCELLED'].includes(eventCode),currentStatus:existingOrder.status,currentIfoodStatus:existingOrder.ifood_status},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
            // #endregion
            
            // Check if this is a status update event (not PLACED/PLC which creates orders)
            // CAR = CANCELLATION_REQUESTED - cancellation was requested (pending confirmation)
            // CARF = CANCELLATION_REQUEST_FAILED - cancellation request failed
            const isStatusUpdateEvent = ['DSP', 'DISPATCHED', 'CON', 'CONCLUDED', 'CFM', 'CONFIRMED', 
                                        'SPS', 'SEPARATION_STARTED', 'SPE', 'SEPARATION_ENDED', 
                                        'RTP', 'READY_TO_PICKUP', 'CAN', 'CANCELLED', 
                                        'CAR', 'CANCELLATION_REQUESTED',
                                        'CARF', 'CANCELLATION_REQUEST_FAILED'].includes(eventCode)
            
            if (isStatusUpdateEvent) {
              // This is a status update event - update the existing order
              // #region agent log
              fetch('http://127.0.0.1:7243/ingest/b058c8da-e202-4622-9483-5c45531d7867',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ifood-polling.ts:192',message:'status update event detected - updating order',data:{eventId,orderId,eventCode,existingOrderId:existingOrder.id,currentStatus:existingOrder.status,currentIfoodStatus:existingOrder.ifood_status},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
              // #endregion
              
              // Map event code to system status and iFood status (same logic as webhook)
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
                  // Cancellation was requested - this is a pending state
                  // Don't change status yet, wait for CAN (cancelled) or CARF (failed)
                  // But we can log that cancellation was requested
                  const requestReason = event.metadata?.reason_code || event.metadata?.details || 'N/A'
                  const requestCode = event.metadata?.reason_code || event.metadata?.cancellationCode || 'N/A'
                  
                  console.log(`[CANCELLATION_REQUESTED] Order ${orderId} cancellation requested:`, {
                    reason: requestReason,
                    code: requestCode,
                    eventId: eventId
                  })
                  
                  // Keep current status - cancellation is pending
                  systemStatus = existingOrder.status
                  ifoodStatus = existingOrder.ifood_status || 'CONFIRMED'
                  
                  // Could add a note that cancellation is pending
                  break
                case 'CANCELLATION_REQUEST_FAILED':
                case 'CARF':
                  // Cancellation failed - don't change status, but log the failure
                  // Extract failure reason from metadata if available
                  const failureReason = event.metadata?.CANCELLATION_REQUEST_FAILED_REASON || 
                                       event.metadata?.reason || 
                                       'Unknown reason'
                  const cancelCode = event.metadata?.CANCEL_CODE || event.metadata?.cancellationCode
                  
                  console.warn(`[CANCELLATION_REQUEST_FAILED] Order ${orderId} cancellation failed:`, {
                    reason: failureReason,
                    cancelCode: cancelCode,
                    eventId: eventId,
                    requestedEventId: event.metadata?.CANCELLATION_REQUESTED_EVENT_ID
                  })
                  
                  // Keep current status (don't change to cancelled)
                  systemStatus = existingOrder.status
                  ifoodStatus = existingOrder.ifood_status || 'CONFIRMED' // Keep current or default to CONFIRMED
                  
                  // Log the failure - could store in a cancellation_attempts table or notes field
                  // For now, we'll just log and acknowledge
                  break
              }
              
              // Update order status in database
              // For CARF, we might want to add a note or not update at all
              const updateData: { status: string; ifood_status: string; closed_at?: string; notes?: string } = {
                status: systemStatus,
                ifood_status: ifoodStatus
              }
              
              // Add note for cancellation events
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
              fetch('http://127.0.0.1:7243/ingest/b058c8da-e202-4622-9483-5c45531d7867',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ifood-polling.ts:235',message:'updating order status in database',data:{eventId,orderId,eventCode,existingOrderId:existingOrder.id,systemStatus,ifoodStatus,updateData},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
              // #endregion
              
              const { error: updateError } = await this.supabase
                .from('orders')
                .update(updateData)
                .eq('id', existingOrder.id)
              
              if (updateError) {
                console.error(`Error updating order ${existingOrder.id} status:`, updateError)
                // #region agent log
                fetch('http://127.0.0.1:7243/ingest/b058c8da-e202-4622-9483-5c45531d7867',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ifood-polling.ts:243',message:'order status update error',data:{eventId,orderId,eventCode,existingOrderId:existingOrder.id,updateError:updateError.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
                // #endregion
              } else {
                if (eventCode === 'CAR' || eventCode === 'CANCELLATION_REQUESTED') {
                  const requestReason = event.metadata?.details || event.metadata?.reason_code || 'N/A'
                  console.log(`Order ${existingOrder.id} (iFood ${orderId}) cancellation requested: ${requestReason}. Status maintained (pending).`)
                } else if (eventCode === 'CARF' || eventCode === 'CANCELLATION_REQUEST_FAILED') {
                  const failureReason = event.metadata?.CANCELLATION_REQUEST_FAILED_REASON || 'Unknown reason'
                  console.warn(`Order ${existingOrder.id} (iFood ${orderId}) cancellation failed: ${failureReason}. Status maintained.`)
                } else {
                  console.log(`Order ${existingOrder.id} (iFood ${orderId}) updated to status ${ifoodStatus} via polling`)
                }
                // #region agent log
                fetch('http://127.0.0.1:7243/ingest/b058c8da-e202-4622-9483-5c45531d7867',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ifood-polling.ts:247',message:'order status updated successfully',data:{eventId,orderId,eventCode,existingOrderId:existingOrder.id,systemStatus,ifoodStatus,isCancellationFailure:eventCode === 'CARF' || eventCode === 'CANCELLATION_REQUEST_FAILED'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
                // #endregion
              }
              
              // Acknowledge the event
              eventsToAcknowledge.push(eventId)
              continue
            } else {
              // Not a status update event and order exists - skip
              console.log(`Order ${orderId} already exists, skipping event ${eventCode}...`)
              eventsToAcknowledge.push(eventId)
              continue
            }
          }

          // iFood best practice: Consultar detalhes antes de confirmar
          // Polling returns events, not full order details, so we need to fetch order details
          const orderDetailsResult = await this.ifoodService.getOrderDetails(orderId)
          
          if (!orderDetailsResult.success || !orderDetailsResult.order) {
            console.log(`Failed to fetch order details for ${orderId}, skipping...`)
            // Still acknowledge event even if we can't fetch details
            eventsToAcknowledge.push(eventId)
            continue
          }

          const ifoodOrder = orderDetailsResult.order

          // Process and create order
          const processedOrder = await this.processOrder(ifoodOrder)
          
          if (processedOrder) {
            // iFood best practice: Persistir antes de acknowledgment
            const createResult = await this.createOrder(processedOrder)
            
            if (!createResult.success) {
              console.error(`Failed to create order ${orderId}:`, createResult.error)
              // Continue processing other orders even if one fails
            } else {
              // IMPORTANT: Do NOT automatically confirm orders
              // Orders must be manually accepted by the user via the frontend
              // The order is created with status PLACED and waits for manual confirmation
              console.log(`Order ${orderId} created successfully with status PLACED. Waiting for manual acceptance.`)
            }
          }
          
          // Add event ID to acknowledgment list (even if processing failed, we acknowledge)
          eventsToAcknowledge.push(eventId)
        } catch (error) {
          console.error(`Error processing event:`, error)
          // Still acknowledge events that failed to process
          if (eventId) {
            eventsToAcknowledge.push(eventId)
          }
        }
      }

      // iFood best practice: Send acknowledgment for all events after processing
      // This prevents receiving the same events again in future polling
      if (eventsToAcknowledge.length > 0) {
        try {
          // Split into batches of 2000 (iFood limit per request)
          const batchSize = 2000
          for (let i = 0; i < eventsToAcknowledge.length; i += batchSize) {
            const batch = eventsToAcknowledge.slice(i, i + batchSize)
            const ackResult = await this.ifoodService.acknowledgeEvents(batch)
            if (ackResult.success) {
              console.log(`Acknowledged ${batch.length} event(s)`)
            } else {
              console.error(`Failed to acknowledge events: ${ackResult.error}`)
            }
          }
        } catch (error) {
          console.error('Error acknowledging events:', error)
          // Don't fail the entire polling cycle if acknowledgment fails
        }
      }

      // Update last sync time
      await this.ifoodService.updateLastSync()
      
      // Sync all orders status to ensure consistency
      // This runs after processing new events to catch any status changes
      console.log('[pollOrders] Running status synchronization for all orders...')
      const syncResult = await this.syncAllOrdersStatus()
      console.log(`[pollOrders] Status sync result: ${syncResult.synced} checked, ${syncResult.updated} updated, ${syncResult.errors} errors`)
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

      // Ensure items is an array
      if (!ifoodOrder.items || !Array.isArray(ifoodOrder.items)) {
        console.error('Order items is not an array:', ifoodOrder.items)
        return null
      }

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
            // Try to find product by SKU using the mapping table
            const { data: mapping } = await this.supabase
              .from('ifood_product_mapping')
              .select('product_id')
              .eq('ifood_sku', sku)
              .single()

            if (mapping && mapping.product_id) {
              productId = mapping.product_id
            } else {
              // Fallback: try to find product by SKU directly (if sku column exists)
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
      // Use orderType if available, otherwise infer from orderTiming
      let orderType: 'delivery' | 'takeout' = 'delivery'
      if (ifoodOrder.orderType === 'TAKEOUT' || ifoodOrder.orderType === 'DINE_IN' || ifoodOrder.orderType === 'INDOOR') {
        orderType = 'takeout'
      } else if (ifoodOrder.orderType === 'DELIVERY') {
        orderType = 'delivery'
      } else if (ifoodOrder.orderTiming === 'DELIVERY') {
        orderType = 'delivery'
      } else {
        orderType = 'takeout'
      }

      // Build delivery address string if available
      let deliveryAddress: string | undefined
      const deliveryAddr = ifoodOrder.delivery?.deliveryAddress || ifoodOrder.delivery?.address
      if (deliveryAddr) {
        const street = deliveryAddr.streetName || deliveryAddr.street || ''
        const number = deliveryAddr.streetNumber || deliveryAddr.number || ''
        const complement = deliveryAddr.complement || ''
        const neighborhood = deliveryAddr.neighborhood || ''
        const city = deliveryAddr.city || ''
        const state = deliveryAddr.state || ''
        const zipCode = deliveryAddr.postalCode || deliveryAddr.zipCode || ''
        
        deliveryAddress = `${street}, ${number}${complement ? ` - ${complement}` : ''}, ${neighborhood}, ${city} - ${state}${zipCode ? `, ${zipCode}` : ''}`.trim()
      }

      // Calculate total - use total.orderAmount if available, otherwise totalPrice.amount, otherwise calculate from items
      let total = 0
      if ((ifoodOrder as any).total?.orderAmount) {
        total = (ifoodOrder as any).total.orderAmount
      } else if (ifoodOrder.totalPrice?.amount) {
        total = ifoodOrder.totalPrice.amount
      } else {
        // Fallback: calculate total from items
        total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0)
        console.warn(`Order ${ifoodOrder.id} missing total.orderAmount and totalPrice.amount, calculated from items: ${total}`)
      }

      return {
        ifoodOrderId: ifoodOrder.id,
        ifoodDisplayId: ifoodOrder.displayId || ifoodOrder.shortReference || ifoodOrder.id,
        customer: ifoodOrder.customer?.name || 'Cliente iFood',
        orderType,
        items,
        total,
        ifoodStatus: 'PLACED',
        deliveryAddress,
        customerPhone: ifoodOrder.customer?.phone?.number || ifoodOrder.customer?.phoneNumber
      }
    } catch (error) {
      console.error('Error processing iFood order:', error)
      return null
    }
  }

  /**
   * Create order in system database
   * FIXED: Now uses UUID for order IDs to prevent duplicate key conflicts
   */
  async createOrder(processedOrder: ProcessedOrder): Promise<{ success: boolean; orderId?: string; error?: string }> {
    try {
      // IMPORTANT: Check if order already exists by ifood_order_id to prevent duplicates
      if (processedOrder.ifoodOrderId) {
        const { data: existingOrder } = await this.supabase
          .from('orders')
          .select('id, status, ifood_status')
          .eq('ifood_order_id', processedOrder.ifoodOrderId)
          .single()

        if (existingOrder) {
          console.log(`Order with ifood_order_id ${processedOrder.ifoodOrderId} already exists with ID ${existingOrder.id}. Skipping creation.`)
          return {
            success: true,
            orderId: existingOrder.id
          }
        }
      }

      // FIXED: Use UUID instead of sequential ID to prevent race conditions
      // Generate a unique UUID for the order ID
      const orderId = `ORD-${uuidv4()}`
      
      // Get current date/time for display purposes
      const now = new Date()
      const day = String(now.getDate()).padStart(2, '0')
      const month = String(now.getMonth() + 1).padStart(2, '0')
      const year = now.getFullYear()
      const hours = String(now.getHours()).padStart(2, '0')
      const minutes = String(now.getMinutes()).padStart(2, '0')
      const formattedDate = `${day}/${month}/${year} ${hours}:${minutes}`

      // Create order with UUID-based ID
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
          ifood_display_id: processedOrder.ifoodDisplayId || null,
          ifood_status: processedOrder.ifoodStatus,
          notes: processedOrder.deliveryAddress 
            ? `Endereço: ${processedOrder.deliveryAddress}${processedOrder.customerPhone ? ` | Telefone: ${processedOrder.customerPhone}` : ''}`
            : processedOrder.customerPhone 
              ? `Telefone: ${processedOrder.customerPhone}`
              : null
        })

      if (orderError) {
        // Check if error is due to duplicate ifood_order_id (unique constraint violation)
        if (orderError.code === '23505' || orderError.message?.includes('duplicate') || orderError.message?.includes('unique')) {
          console.log(`Order with ifood_order_id ${processedOrder.ifoodOrderId} already exists (unique constraint). Fetching existing order...`)
          // Fetch the existing order
          const { data: existingOrder } = await this.supabase
            .from('orders')
            .select('id')
            .eq('ifood_order_id', processedOrder.ifoodOrderId)
            .single()
          
          if (existingOrder) {
            return {
              success: true,
              orderId: existingOrder.id
            }
          }
        }
        
        console.error('Error creating order:', orderError)
        return { 
          success: false, 
          error: `Failed to create order: ${orderError.message}` 
        }
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
          // Continue creating other items even if one fails
        }
      }

      console.log(`Successfully created order ${orderId} with UUID-based ID`)
      return { success: true, orderId }
    } catch (error) {
      console.error('Error creating order:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error creating order' 
      }
    }
  }

  /**
   * Sync all iFood orders status by checking API and comparing with database
   * This ensures status consistency between iFood API and local database
   */
  async syncAllOrdersStatus(): Promise<{ synced: number; updated: number; errors: number }> {
    try {
      console.log('[syncAllOrdersStatus] Starting status synchronization for all iFood orders...')
      
      // Get all iFood orders from database
      const { data: orders, error } = await this.supabase
        .from('orders')
        .select('id, ifood_order_id, status, ifood_status')
        .eq('source', 'ifood')
        .not('ifood_order_id', 'is', null)
      
      if (error) {
        console.error('[syncAllOrdersStatus] Error fetching orders:', error)
        return { synced: 0, updated: 0, errors: 0 }
      }
      
      if (!orders || orders.length === 0) {
        console.log('[syncAllOrdersStatus] No iFood orders found to sync')
        return { synced: 0, updated: 0, errors: 0 }
      }
      
      console.log(`[syncAllOrdersStatus] Found ${orders.length} iFood orders to sync`)
      
      let updated = 0
      let errors = 0
      
      // Check each order status from iFood API
      for (const order of orders) {
        try {
          if (!order.ifood_order_id) {
            continue
          }
          
          // Fetch current status from iFood API
          // First try to get order details
          const orderDetailsResult = await this.ifoodService.getOrderDetails(order.ifood_order_id)
          
          if (!orderDetailsResult.success || !orderDetailsResult.order) {
            // If order details fail, try to get status from polling events
            console.log(`[syncAllOrdersStatus] Order details not available for ${order.ifood_order_id}, checking events...`)
            
            // Try to get latest events for this order
            const eventsResult = await this.ifoodService.pollEvents()
            if (eventsResult.success && eventsResult.orders) {
              const orderEvents = (eventsResult.orders as any[]).filter((e: any) => 
                (e.orderId || e.payload?.orderId) === order.ifood_order_id
              )
              
              if (orderEvents.length > 0) {
                // Get the latest status event
                const statusEvents = orderEvents
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
                  const eventCode = (latestEvent.fullCode || latestEvent.code || '').toUpperCase()
                  
                  // Map event code to normalized status
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
                  
                  const currentIfoodStatus = statusMap[eventCode] || eventCode
                  
                  // Update order status based on event
                  let systemStatus = order.status
                  let ifoodStatus = currentIfoodStatus
                  
                  switch (currentIfoodStatus) {
                    case 'PLACED':
                      systemStatus = 'Pending'
                      break
                    case 'CONFIRMED':
                    case 'PREPARATION_STARTED':
                    case 'SEPARATION_ENDED':
                      systemStatus = 'Preparing'
                      break
                    case 'READY_TO_PICKUP':
                      systemStatus = 'Ready'
                      break
                    case 'DISPATCHED':
                      systemStatus = 'Delivered'
                      break
                    case 'CONCLUDED':
                      systemStatus = 'Closed'
                      break
                    case 'CANCELLED':
                      systemStatus = 'Cancelled'
                      break
                  }
                  
                  // Check if status needs to be updated
                  if (order.ifood_status !== ifoodStatus || order.status !== systemStatus) {
                    console.log(`[syncAllOrdersStatus] Updating order ${order.id} (iFood ${order.ifood_order_id}) from events: ${order.ifood_status} → ${ifoodStatus}, ${order.status} → ${systemStatus}`)
                    
                    const updateData: { status: string; ifood_status: string; closed_at?: string } = {
                      status: systemStatus,
                      ifood_status: ifoodStatus
                    }
                    
                    if (ifoodStatus === 'CONCLUDED') {
                      updateData.closed_at = new Date().toISOString()
                    }
                    
                    const { error: updateError } = await this.supabase
                      .from('orders')
                      .update(updateData)
                      .eq('id', order.id)
                    
                    if (updateError) {
                      console.error(`[syncAllOrdersStatus] Error updating order ${order.id}:`, updateError)
                      errors++
                    } else {
                      updated++
                    }
                  }
                  
                  continue // Skip to next order
                }
              }
            }
            
            console.warn(`[syncAllOrdersStatus] Failed to fetch order ${order.ifood_order_id} details and no events found:`, orderDetailsResult.error)
            errors++
            continue
          }
        
        const ifoodOrder = orderDetailsResult.order
        
        // Extract current status from iFood order
        // The status can be in different places depending on API response structure
        let currentIfoodStatus: string | null = null
        
        // Try multiple ways to get the status
        // 1. Check if order has a direct status field
        if ((ifoodOrder as any).status) {
          currentIfoodStatus = String((ifoodOrder as any).status).toUpperCase()
        }
        // 2. Check if order has events array and get latest status event
        else if ((ifoodOrder as any).events && Array.isArray((ifoodOrder as any).events)) {
          const events = (ifoodOrder as any).events
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
        else if ((ifoodOrder as any).lastEvent) {
          const lastEvent = (ifoodOrder as any).lastEvent
          currentIfoodStatus = (lastEvent.fullCode || lastEvent.code || '').toUpperCase()
        }
        
        // If we still couldn't determine status, try to infer from order state
        // Some APIs return status in different formats
        if (!currentIfoodStatus) {
          // Check for common status field names
          const possibleStatusFields = ['orderStatus', 'currentStatus', 'state', 'orderState']
          for (const field of possibleStatusFields) {
            if ((ifoodOrder as any)[field]) {
              currentIfoodStatus = String((ifoodOrder as any)[field]).toUpperCase()
              break
            }
          }
        }
        
        // If we still couldn't determine status, log and skip this order
        if (!currentIfoodStatus) {
          console.warn(`[syncAllOrdersStatus] Could not determine status for order ${order.ifood_order_id}. Order structure:`, JSON.stringify(ifoodOrder).substring(0, 500))
          continue
        }
        
        // Normalize status codes (handle both short and full codes)
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
        
        currentIfoodStatus = statusMap[currentIfoodStatus] || currentIfoodStatus
        
        // Map iFood status to system status
        let systemStatus = order.status
        let ifoodStatus = currentIfoodStatus
        
        switch (currentIfoodStatus.toUpperCase()) {
          case 'PLACED':
          case 'PLC':
            systemStatus = 'Pending'
            ifoodStatus = 'PLACED'
            break
          case 'CONFIRMED':
          case 'CFM':
            systemStatus = 'Preparing'
            ifoodStatus = 'CONFIRMED'
            break
          case 'PREPARATION_STARTED':
          case 'SEPARATION_STARTED':
          case 'SPS':
            systemStatus = 'Preparing'
            ifoodStatus = 'PREPARATION_STARTED'
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
          default:
            // Keep current status if unknown
            systemStatus = order.status
            ifoodStatus = currentIfoodStatus
        }
        
        // Check if status needs to be updated
        if (order.ifood_status !== ifoodStatus || order.status !== systemStatus) {
          console.log(`[syncAllOrdersStatus] Updating order ${order.id} (iFood ${order.ifood_order_id}): ${order.ifood_status} → ${ifoodStatus}, ${order.status} → ${systemStatus}`)
          
          const updateData: { status: string; ifood_status: string; closed_at?: string } = {
            status: systemStatus,
            ifood_status: ifoodStatus
          }
          
          // Set closed_at timestamp for CONCLUDED status
          if (ifoodStatus === 'CONCLUDED') {
            updateData.closed_at = new Date().toISOString()
          }
          
          const { error: updateError } = await this.supabase
            .from('orders')
            .update(updateData)
            .eq('id', order.id)
          
          if (updateError) {
            console.error(`[syncAllOrdersStatus] Error updating order ${order.id}:`, updateError)
            errors++
          } else {
            updated++
            console.log(`[syncAllOrdersStatus] Successfully updated order ${order.id} to ${ifoodStatus}`)
          }
        }
      } catch (error) {
        console.error(`[syncAllOrdersStatus] Error processing order ${order.ifood_order_id}:`, error)
        errors++
      }
    }
  }
  
  console.log(`[syncAllOrdersStatus] Synchronization complete: ${orders.length} checked, ${updated} updated, ${errors} errors`)
  return { synced: orders.length, updated, errors }
} catch (error) {
  console.error('[syncAllOrdersStatus] Error syncing orders status:', error)
  return { synced: 0, updated: 0, errors: 0 }
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
      // According to iFood workflow: PLACED → CONFIRMED → PREPARATION_STARTED → DISPATCHED/READY_TO_PICKUP → CONCLUDED
      let ifoodStatus: 'PLACED' | 'CONFIRMED' | 'PREPARATION_STARTED' | 'SEPARATION_STARTED' | 'SEPARATION_ENDED' | 'READY_TO_PICKUP' | 'DISPATCHED' | 'CONCLUDED' | 'CANCELLED' | null = null

      switch (systemStatus.toUpperCase()) {
        case 'PENDING':
          ifoodStatus = 'PLACED'
          break
        case 'PREPARING':
          // Use PREPARATION_STARTED according to iFood workflow for FOOD category
          ifoodStatus = 'PREPARATION_STARTED'
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