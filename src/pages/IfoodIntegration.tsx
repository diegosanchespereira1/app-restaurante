import { useState, useEffect, useCallback, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Switch } from "../components/ui/switch"
import { Badge } from "../components/ui/badge"
import { Save, RefreshCw, CheckCircle, XCircle, Clock, ShoppingBag, Copy, ExternalLink, Check, X, MapPin, Phone, User, Calendar, Package, CreditCard, Info, ChevronDown, ChevronUp } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../components/ui/dialog"
import { useAuth } from "../context/AuthContext"
import { getBackendUrl } from "../lib/backend-config"
import { formatCurrency } from "../lib/utils"

interface IfoodConfig {
  merchant_id: string
  client_id: string
  client_secret: string
  authorization_code?: string
  polling_interval: number
  is_active: boolean
}

interface IfoodStatus {
  configured: boolean
  active: boolean
  authenticated: boolean
  auth_error?: string | null
  last_sync: string | null
  polling_interval: number | null
  webhook_url: string | null
}

interface ProductMapping {
  id: number
  ifood_product_id: string
  ifood_sku: string | null
  product_id: number
  products: {
    id: number
    name: string
    price: number
    sku: string | null
  } | null
}

// Interface completa baseada na documentação do iFood
// https://developer.ifood.com.br/pt-BR/docs/guides/modules/order/details?category=FOOD
interface IfoodPendingOrder {
  id: string
  displayId: string
  shortReference?: string
  orderType?: 'DELIVERY' | 'TAKEOUT' | 'DINE_IN' | 'INDOOR'
  orderTiming: 'IMMEDIATE' | 'SCHEDULED'
  salesChannel?: string
  category?: string
  createdAt: string
  preparationStartDateTime?: string
  isTest?: boolean
  extraInfo?: string
  merchant?: {
    id: string
    name: string
  }
  customer: {
    id: string
    name: string
    documentNumber?: string
    documentType?: string
    ordersCountOnMerchant?: number
    phone?: {
      number: string
      localizer?: string
      localizerExpiration?: string
    }
    phoneNumber?: string // Compatibilidade com formato antigo
    segmentation?: string
  }
  items: Array<{
    index?: number
    id: string
    uniqueId?: string
    name: string
    imageUrl?: string
    externalCode?: string
    ean?: string
    unit?: string
    quantity: number
    unitPrice: number
    price: number
    optionsPrice?: number
    totalPrice: number
    observations?: string
    options?: Array<{
      index?: number
      id: string
      name: string
      type?: string
      groupName?: string
      externalCode?: string
      ean?: string
      unit?: string
      quantity: number
      unitPrice: number
      addition?: number
      price: number
      customizations?: Array<{
        id: string
        externalCode?: string
        name: string
        groupName?: string
        type?: string
        quantity: number
        unitPrice: number
        addition?: number
        price: number
      }>
    }>
    sku?: string // Compatibilidade
  }>
  benefits?: Array<{
    value: number
    sponsorshipValues?: Array<{
      name: string
      value: number
    }>
    target: string
    targetId?: string
    campaign?: {
      id: string
      name: string
    }
  }>
  additionalFees?: Array<{
    type: string
    value: number
  }>
  total?: {
    subTotal: number
    deliveryFee?: number
    additionalFees?: number
    benefits?: number
    orderAmount: number
  }
  totalPrice?: {
    amount: number
    currency: string
  }
  payments?: {
    prepaid?: number
    pending?: number
    methods?: Array<{
      value: number
      currency: string
      method: string
      type: string
      prepaid: boolean
      card?: {
        brand: string
      }
      transaction?: {
        authorizationCode: string
        acquirerDocument: string
      }
    }>
  }
  picking?: {
    picker?: string
    replacementOptions?: string
  }
  delivery?: {
    mode?: string
    description?: string
    deliveredBy?: string
    deliveryDateTime?: string
    observations?: string
    address?: {
      streetName?: string
      street?: string // Compatibilidade
      streetNumber?: string
      number?: string // Compatibilidade
      formattedAddress?: string
      neighborhood: string
      complement?: string
      reference?: string
      postalCode?: string
      zipCode?: string // Compatibilidade
      city: string
      state: string
      country?: string
      coordinates?: {
        latitude: number
        longitude: number
      }
    }
    deliveryAddress?: {
      streetName?: string
      street?: string // Compatibilidade
      streetNumber?: string
      number?: string // Compatibilidade
      formattedAddress?: string
      neighborhood: string
      complement?: string
      reference?: string
      postalCode?: string
      zipCode?: string // Compatibilidade
      city: string
      state: string
      country?: string
      coordinates?: {
        latitude: number
        longitude: number
      }
    }
    pickupCode?: string
  }
  takeout?: {
    mode?: string
    description?: string
    takeoutDateTime?: string
    observations?: string
  }
  dineIn?: {
    mode?: string
    table?: string
    deliveryDateTime?: string
    observations?: string
  }
  indoor?: {
    mode?: string
    table?: string
    deliveryDateTime?: string
    observations?: string
  }
  schedule?: {
    deliveryDateTimeStart?: string
    deliveryDateTimeEnd?: string
  }
  additionalInfo?: {
    metadata?: Record<string, string>
  }
  preparationTimeInSeconds?: number // Compatibilidade
}

export function IfoodIntegration() {
  const { hasPermission } = useAuth()
  const [config, setConfig] = useState<IfoodConfig>({
    merchant_id: "",
    client_id: "",
    client_secret: "",
    authorization_code: "",
    polling_interval: 30,
    is_active: false
  })
  const [status, setStatus] = useState<IfoodStatus | null>(null)
  const [mappings, setMappings] = useState<ProductMapping[]>([])
  const [pendingOrders, setPendingOrders] = useState<IfoodPendingOrder[]>([])
  const pendingOrdersRef = useRef<IfoodPendingOrder[]>([])
  
  // Keep ref in sync with state
  useEffect(() => {
    pendingOrdersRef.current = pendingOrders
  }, [pendingOrders])
  const [activeOrders, setActiveOrders] = useState<any[]>([])
  const [dispatchedOrders, setDispatchedOrders] = useState<any[]>([])
  const [concludedOrders, setConcludedOrders] = useState<any[]>([])
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [loadingActiveOrders, setLoadingActiveOrders] = useState(false)
  const [loadingDispatchedOrders, setLoadingDispatchedOrders] = useState(false)
  const [loadingConcludedOrders, setLoadingConcludedOrders] = useState(false)
  const [acceptingOrder, setAcceptingOrder] = useState<string | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<IfoodPendingOrder | null>(null)
  const [isOrderDetailOpen, setIsOrderDetailOpen] = useState(false)
  const [cancellingOrder, setCancellingOrder] = useState<string | null>(null)
  const [selectedDashboardOrder, setSelectedDashboardOrder] = useState<any | null>(null)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)
  const [orderUuid, setOrderUuid] = useState("")
  const [orderDetails, setOrderDetails] = useState<IfoodPendingOrder | null>(null)
  const [loadingOrderDetails, setLoadingOrderDetails] = useState(false)
  const [orderDetailsError, setOrderDetailsError] = useState<string | null>(null)
  const [isWebhookCollapsed, setIsWebhookCollapsed] = useState(true)
  const [isConfigCollapsed, setIsConfigCollapsed] = useState(true)
  const [isMappingsCollapsed, setIsMappingsCollapsed] = useState(true)

  const backendUrl = getBackendUrl()

  // Função auxiliar para extrair mensagem de erro (pode ser string ou objeto)
  const extractErrorMessage = (error: any): string => {
    if (!error) return 'Erro desconhecido'
    if (typeof error === 'string') return error
    if (error.message) return error.message
    if (error.error) return extractErrorMessage(error.error)
    if (error.code && error.message) return error.message
    if (typeof error === 'object') return JSON.stringify(error)
    return String(error)
  }

  useEffect(() => {
    if (hasPermission('admin')) {
      loadConfig()
      loadStatus()
      loadMappings()
      loadPendingOrders()
      loadActiveOrders()
      loadDispatchedOrders()
      loadConcludedOrders()
    }
  }, [hasPermission])

  // Auto-refresh all orders every 30 seconds (executa imediatamente ao carregar)
  useEffect(() => {
    if (!hasPermission('admin') || !status?.active) return

    // Executa imediatamente ao carregar a página
    const refreshOrders = () => {
      loadPendingOrders()
      loadActiveOrders()
      loadDispatchedOrders()
      loadConcludedOrders()
    }

    // Executa imediatamente
    refreshOrders()

    // Depois executa a cada 30 segundos
    const interval = setInterval(refreshOrders, 30000) // 30 seconds

    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasPermission, status?.active])

  // Recarregar pedidos quando a página recebe foco (usuário volta para a página)
  useEffect(() => {
    if (!hasPermission('admin') || !status?.active) return

    const handleFocus = () => {
      console.log('[IfoodIntegration] Page focused, reloading orders...')
      loadPendingOrders()
      loadActiveOrders()
      loadDispatchedOrders()
      loadConcludedOrders()
    }

    // Recarregar quando a página recebe foco
    window.addEventListener('focus', handleFocus)
    
    // Também recarregar quando a página fica visível (tab volta ao foco)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('[IfoodIntegration] Page visible, reloading orders...')
        loadPendingOrders()
        loadActiveOrders()
        loadDispatchedOrders()
        loadConcludedOrders()
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasPermission, status?.active])

  const loadConfig = async () => {
    try {
      const response = await fetch(`${backendUrl}/api/ifood/config`)
      const result = await response.json()
      
      if (result.success && result.config) {
        setConfig({
          merchant_id: result.config.merchant_id || "",
          client_id: result.config.client_id || "",
          client_secret: "", // Never load secret back
          authorization_code: result.config.authorization_code || "",
          polling_interval: result.config.polling_interval || 30,
          is_active: result.config.is_active || false
        })
      }
    } catch (error) {
      console.error('Error loading config:', error)
    }
  }

  const loadStatus = async () => {
    try {
      const response = await fetch(`${backendUrl}/api/ifood/status`)
      const result = await response.json()
      
      if (result.success) {
        setStatus(result.status)
      }
    } catch (error) {
      console.error('Error loading status:', error)
    }
  }

  const loadMappings = async () => {
    try {
      const response = await fetch(`${backendUrl}/api/ifood/mapping`)
      const result = await response.json()
      
      if (result.success) {
        setMappings(result.mappings || [])
      }
    } catch (error) {
      console.error('Error loading mappings:', error)
    }
  }

  const loadPendingOrders = useCallback(async () => {
    if (!status?.active) return
    
    // Prevent multiple simultaneous calls
    if (loadingOrders) {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/b058c8da-e202-4622-9483-5c45531d7867',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'IfoodIntegration.tsx:189',message:'loadPendingOrders already in progress, skipping',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      return
    }
    
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/b058c8da-e202-4622-9483-5c45531d7867',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'IfoodIntegration.tsx:195',message:'loadPendingOrders called',data:{statusActive:status?.active,loadingOrders,hasBackendUrl:!!backendUrl},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    
    setLoadingOrders(true)
    try {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/b058c8da-e202-4622-9483-5c45531d7867',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'IfoodIntegration.tsx:193',message:'frontend calling pending-orders',data:{url:`${backendUrl}/api/ifood/pending-orders`,before_fetch:true},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      
      // Add timeout to prevent hanging
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 35000) // 35 second timeout
      
      const response = await fetch(`${backendUrl}/api/ifood/pending-orders`, {
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/b058c8da-e202-4622-9483-5c45531d7867',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'IfoodIntegration.tsx:202',message:'frontend response received',data:{status:response.status,statusText:response.statusText,ok:response.ok},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Erro HTTP ${response.status}: ${errorText || response.statusText}`)
      }
      
      // Get response text first to debug
      const responseText = await response.text()
      console.log('[Frontend] Raw response text:', responseText.substring(0, 2000))
      
      // Parse JSON
      let result
      try {
        result = JSON.parse(responseText)
      } catch (parseError) {
        console.error('[Frontend] JSON parse error:', parseError)
        console.error('[Frontend] Response text:', responseText)
        throw new Error(`Erro ao fazer parse do JSON: ${parseError}`)
      }
      
      // Log full response for debugging
      console.log('[Frontend] Pending orders response:', {
        success: result.success,
        ordersCount: result.orders?.length || 0,
        hasOrders: !!result.orders,
        isArray: Array.isArray(result.orders),
        debug: result.debug,
        firstOrderSample: result.orders?.[0] ? {
          id: result.orders[0].id,
          displayId: result.orders[0].displayId,
          shortReference: result.orders[0].shortReference,
          customer: result.orders[0].customer,
          keys: Object.keys(result.orders[0])
        } : null,
        fullResult: JSON.stringify(result).substring(0, 2000)
      })
      
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/b058c8da-e202-4622-9483-5c45531d7867',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'IfoodIntegration.tsx:205',message:'frontend result parsed',data:{success:result.success,ordersCount:result.orders?.length||0,hasOrders:!!result.orders,resultSample:JSON.stringify(result).substring(0,500)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      
      if (result.success) {
        const newOrders = Array.isArray(result.orders) ? result.orders : []
        
        console.log('[Frontend] Processing orders:', {
          newOrdersCount: newOrders.length,
          firstOrder: newOrders[0] ? {
            id: newOrders[0].id,
            displayId: newOrders[0].displayId,
            customer: newOrders[0].customer
          } : null
        })
        
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/b058c8da-e202-4622-9483-5c45531d7867',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'IfoodIntegration.tsx:228',message:'before setPendingOrders',data:{newOrdersCount:newOrders.length,newOrderIds:newOrders.filter((o: any) => o && o.id).map((o: any) => o.id).join(',')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
        // #endregion
        
        // Always update state with the orders received from API
        // This ensures the UI reflects the current state from backend
        console.log('[Frontend] Updating pending orders state:', {
          newOrdersCount: newOrders.length,
          currentOrdersCount: pendingOrdersRef.current.length,
          newOrders: newOrders.map((o: any) => ({
            id: o.id,
            displayId: o.displayId,
            customer: typeof o.customer === 'object' ? o.customer?.name : o.customer
          }))
        })
        
        // Log específico para displayId 9746
        const order9746 = newOrders.find((o: any) => 
          o.displayId === '9746' || o.shortReference === '9746' || o.id?.includes('9746')
        )
        if (order9746) {
          console.log('[Frontend] Found order with displayId 9746 in response:', {
            id: order9746.id,
            displayId: order9746.displayId,
            shortReference: order9746.shortReference,
            customer: order9746.customer,
            hasItems: !!(order9746.items && order9746.items.length > 0),
            keys: Object.keys(order9746)
          })
        } else {
          console.log('[Frontend] Order with displayId 9746 NOT found in response. Orders received:', 
            newOrders.map((o: any) => ({
              id: o.id,
              displayId: o.displayId,
              shortReference: o.shortReference
            }))
          )
        }
        
        // Always set the orders, even if empty (to clear old ones)
        setPendingOrders(newOrders)
        
        if (newOrders.length === 0) {
          console.log('[Frontend] No pending orders received from API')
        } else {
          console.log('[Frontend] Successfully set', newOrders.length, 'pending orders')
        }
      } else {
        console.error('[Frontend] API returned error:', result.message || result.error)
        const errorMessage = extractErrorMessage(result.error || result.message)
        setMessage({ type: 'error', text: errorMessage || 'Erro ao buscar pedidos' })
        setTimeout(() => setMessage(null), 5000)
      }
    } catch (error) {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/b058c8da-e202-4622-9483-5c45531d7867',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'IfoodIntegration.tsx:212',message:'frontend error loading orders',data:{error:error instanceof Error?error.message:String(error),isAbortError:error instanceof Error && error.name === 'AbortError'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      console.error('Error loading pending orders:', error)
      if (error instanceof Error && error.name === 'AbortError') {
        setMessage({ type: 'error', text: 'Timeout ao buscar pedidos. A requisição demorou muito para responder.' })
      } else {
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao buscar pedidos'
        setMessage({ type: 'error', text: errorMessage })
        // Clear message after 5 seconds
        setTimeout(() => setMessage(null), 5000)
      }
    } finally {
      setLoadingOrders(false)
    }
  }, [status?.active, backendUrl, loadingOrders])

  const loadActiveOrders = useCallback(async () => {
    if (!status?.active) return
    
    setLoadingActiveOrders(true)
    try {
      const response = await fetch(`${backendUrl}/api/ifood/active-orders`)
      const result = await response.json()
      
      if (result.success) {
        setActiveOrders(result.orders || [])
      }
    } catch (error) {
      console.error('Error loading active orders:', error)
    } finally {
      setLoadingActiveOrders(false)
    }
  }, [status?.active, backendUrl])

  const loadDispatchedOrders = useCallback(async () => {
    if (!status?.active) return
    
    setLoadingDispatchedOrders(true)
    try {
      const response = await fetch(`${backendUrl}/api/ifood/dispatched-orders`)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Error loading dispatched orders - HTTP error:', response.status, errorText)
        setDispatchedOrders([])
        return
      }
      
      const result = await response.json()
      
      if (result.success) {
        console.log('Dispatched orders loaded:', result.orders?.length || 0, 'orders')
        setDispatchedOrders(Array.isArray(result.orders) ? result.orders : [])
      } else {
        console.error('Error loading dispatched orders - API error:', result.message || 'Unknown error')
        setDispatchedOrders([])
      }
    } catch (error) {
      console.error('Error loading dispatched orders:', error)
      setDispatchedOrders([])
    } finally {
      setLoadingDispatchedOrders(false)
    }
  }, [status?.active, backendUrl])

  const loadConcludedOrders = useCallback(async () => {
    if (!status?.active) return
    
    setLoadingConcludedOrders(true)
    try {
      const response = await fetch(`${backendUrl}/api/ifood/concluded-orders`)
      const result = await response.json()
      
      if (result.success) {
        setConcludedOrders(result.orders || [])
      }
    } catch (error) {
      console.error('Error loading concluded orders:', error)
    } finally {
      setLoadingConcludedOrders(false)
    }
  }, [status?.active, backendUrl])

  const handleCancelOrder = useCallback(async (orderId: string) => {
    setCancellingOrder(orderId)
    setMessage(null)
    
    try {
      const response = await fetch(`${backendUrl}/api/ifood/cancel-order/${orderId}`, {
        method: 'POST'
      })
      
      const result = await response.json()
      
      if (result.success) {
        setMessage({ type: 'success', text: 'Pedido cancelado com sucesso' })
        setIsOrderDetailOpen(false)
        setSelectedOrder(null)
        // Recarregar pedidos pendentes
        await loadPendingOrders()
      } else {
        const errorMessage = extractErrorMessage(result.error || result.message)
        setMessage({ type: 'error', text: errorMessage || 'Erro ao cancelar pedido' })
      }
    } catch (error) {
      console.error('Error canceling order:', error)
      setMessage({ type: 'error', text: 'Erro ao cancelar pedido' })
    } finally {
      setCancellingOrder(null)
      setTimeout(() => setMessage(null), 5000)
    }
  }, [backendUrl, loadPendingOrders])

  const handleAcceptOrder = useCallback(async (orderId: string) => {
    setAcceptingOrder(orderId)
    setMessage(null)
    
    try {
      const response = await fetch(`${backendUrl}/api/ifood/accept-order/${orderId}`, {
        method: 'POST'
      })
      
      const result = await response.json()
      
      if (result.success) {
        setMessage({ type: 'success', text: 'Pedido aceito e criado no sistema com sucesso!' })
        setIsOrderDetailOpen(false)
        setSelectedOrder(null)
        // Reload all orders
        await loadPendingOrders()
        await loadActiveOrders()
        await loadDispatchedOrders()
        await loadConcludedOrders()
        // Clear message after 3 seconds
        setTimeout(() => setMessage(null), 3000)
      } else {
        const errorMessage = extractErrorMessage(result.error || result.message)
        setMessage({ type: 'error', text: errorMessage || 'Erro ao aceitar pedido' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Erro de conexão com o servidor' })
    } finally {
      setAcceptingOrder(null)
    }
  }, [backendUrl, loadPendingOrders, loadActiveOrders, loadDispatchedOrders, loadConcludedOrders])
  
  // Função para calcular tempo decorrido
  const getElapsedTime = (dateString: string | null | undefined): string => {
    if (!dateString) return '0min'
    try {
      const now = new Date()
      const date = new Date(dateString)
      if (isNaN(date.getTime())) return '0min'
      
      const diffMs = now.getTime() - date.getTime()
      if (diffMs < 0) return '0min'
      
      const diffMins = Math.floor(diffMs / 60000)
      
      if (diffMins < 1) return 'há menos de 1min'
      if (diffMins < 60) return `${diffMins}min`
      
      const hours = Math.floor(diffMins / 60)
      const mins = diffMins % 60
      return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`
    } catch (error) {
      return '0min'
    }
  }

  // Função para calcular tempo decorrido formatado para "há Xmin"
  const getElapsedTimeFormatted = (dateString: string | null | undefined): string => {
    if (!dateString) return 'há 0min'
    try {
      const now = new Date()
      const date = new Date(dateString)
      if (isNaN(date.getTime())) return 'há 0min'
      
      const diffMs = now.getTime() - date.getTime()
      if (diffMs < 0) return 'há 0min'
      
      const diffMins = Math.floor(diffMs / 60000)
      
      if (diffMins < 1) return 'há menos de 1min'
      return `há ${diffMins}min`
    } catch (error) {
      return 'há 0min'
    }
  }

  // Organizar pedidos por status
  const preparingOrders = activeOrders.filter((order: any) => 
    order.ifood_status === 'CONFIRMED' || order.ifood_status === 'PREPARATION_STARTED'
  )

  const readyOrders = activeOrders.filter((order: any) => 
    order.ifood_status === 'READY_TO_PICKUP' || order.status === 'Ready'
  )

  const routeOrders = dispatchedOrders

  const finishedOrders = concludedOrders

  // Em mobile, limita a altura das listas quando houver mais de 10 cards e habilita scroll interno
  const getMobileOrderListScrollClass = (count: number) => 
    count > 10 
      ? 'max-h-[75vh] overflow-y-auto pr-2 md:max-h-none md:overflow-visible' 
      : ''
 
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR')
  }

  const handleSave = async () => {
    if (!config.merchant_id || !config.client_id || !config.client_secret) {
      setMessage({ type: 'error', text: 'Preencha todos os campos obrigatórios' })
      return
    }

    setSaving(true)
    setMessage(null)

    try {
      console.log('Enviando configuração para:', `${backendUrl}/api/ifood/config`)
      
      const response = await fetch(`${backendUrl}/api/ifood/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config)
      })

      console.log('Resposta recebida:', response.status, response.statusText)

      if (!response.ok) {
        // Tentar ler o erro da resposta
        let errorMessage = `Erro HTTP ${response.status}: ${response.statusText}`
        try {
          const errorData = await response.json()
          errorMessage = errorData.message || errorMessage
        } catch (e) {
          // Se não conseguir ler JSON, usar mensagem padrão
        }
        setMessage({ type: 'error', text: errorMessage })
        return
      }

      const result = await response.json()
      console.log('Resultado:', result)

      if (result.success) {
        const successMessage = typeof result.message === 'string' ? result.message : 'Configuração salva com sucesso!'
        setMessage({ type: 'success', text: successMessage })
        setConfig(prev => ({ ...prev, client_secret: "" })) // Clear secret after saving
        await loadStatus()
      } else {
        const errorMessage = extractErrorMessage(result.error || result.message)
        setMessage({ type: 'error', text: errorMessage || 'Erro ao salvar configuração' })
      }
    } catch (error) {
      console.error('Erro ao salvar configuração:', error)
      let errorMessage = 'Erro de conexão com o servidor. Verifique se o backend está rodando.'
      
      if (error instanceof Error) {
        // Se a URL do backend não for a padrão/localhost, mostrar na mensagem
        if (backendUrl && !backendUrl.includes('localhost') && !backendUrl.includes('127.0.0.1')) {
          errorMessage = `Erro de conexão: ${error.message}. Verifique se o backend está rodando em ${backendUrl}`
        } else {
          errorMessage = `Erro de conexão: ${error.message}. Verifique se o backend está rodando.`
        }
      }
      
      setMessage({ type: 'error', text: errorMessage })
    } finally {
      setSaving(false)
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    setMessage(null)

    try {
      const response = await fetch(`${backendUrl}/api/ifood/sync`, {
        method: 'POST'
      })

      const result = await response.json()

      if (result.success) {
        setMessage({ type: 'success', text: 'Sincronização iniciada' })
        setTimeout(() => {
          loadStatus()
          loadMappings()
        }, 2000)
      } else {
        const errorMessage = extractErrorMessage(result.error || result.message)
        setMessage({ type: 'error', text: errorMessage || 'Erro ao sincronizar' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Erro de conexão com o servidor' })
    } finally {
      setSyncing(false)
    }
  }

  const formatDateString = (dateString: string | null) => {
    if (!dateString) return 'Nunca'
    return new Date(dateString).toLocaleString('pt-BR')
  }

  const handleFetchOrderDetails = async () => {
    if (!orderUuid.trim()) {
      setOrderDetailsError('Por favor, informe o UUID do pedido')
      return
    }

    setLoadingOrderDetails(true)
    setOrderDetailsError(null)
    setOrderDetails(null)

    try {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/b058c8da-e202-4622-9483-5c45531d7867',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'IfoodIntegration.tsx:489',message:'fetching order details',data:{orderUuid:orderUuid.trim(),url:`${backendUrl}/api/ifood/order-details/${orderUuid.trim()}`},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
      // #endregion
      
      const response = await fetch(`${backendUrl}/api/ifood/order-details/${orderUuid.trim()}`)
      
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/b058c8da-e202-4622-9483-5c45531d7867',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'IfoodIntegration.tsx:494',message:'order details response received',data:{status:response.status,statusText:response.statusText,ok:response.ok,contentType:response.headers.get('content-type')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
      // #endregion
      
      if (!response.ok) {
        // Try to parse error message
        let errorMessage = `Erro ${response.status}: ${response.statusText}`
        try {
          const errorResult = await response.json()
          errorMessage = errorResult.message || errorMessage
        } catch {
          // If response is not JSON, use status text
        }
        
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/b058c8da-e202-4622-9483-5c45531d7867',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'IfoodIntegration.tsx:505',message:'order details error response',data:{status:response.status,errorMessage},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
        // #endregion
        
        setOrderDetailsError(errorMessage)
        setOrderDetails(null)
        return
      }
      
      const result = await response.json()
      
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/b058c8da-e202-4622-9483-5c45531d7867',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'IfoodIntegration.tsx:515',message:'order details result parsed',data:{success:result.success,hasOrder:!!result.order,message:result.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
      // #endregion

      if (result.success && result.order) {
        setOrderDetails(result.order)
        setOrderDetailsError(null)
      } else {
        const errorMessage = extractErrorMessage(result.error || result.message)
        setOrderDetailsError(errorMessage || 'Erro ao buscar detalhes do pedido')
        setOrderDetails(null)
      }
    } catch (error) {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/b058c8da-e202-4622-9483-5c45531d7867',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'IfoodIntegration.tsx:525',message:'order details fetch error',data:{error:error instanceof Error?error.message:String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
      // #endregion
      console.error('Error fetching order details:', error)
      setOrderDetailsError('Erro de conexão com o servidor')
      setOrderDetails(null)
    } finally {
      setLoadingOrderDetails(false)
    }
  }

  if (!hasPermission('admin')) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Você não tem permissão para acessar esta página.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Integração iFood</h1>
        <p className="text-muted-foreground mt-2">
          Configure e gerencie a integração com o iFood para receber pedidos automaticamente
        </p>
      </div>

      {/* Banner de Mensagem no topo direito */}
      {message && (
        <div 
          className={`fixed top-4 right-4 z-50 max-w-md p-4 rounded-lg shadow-lg border animate-slideInRight ${
            message.type === 'success' 
              ? 'bg-green-50 text-green-800 border-green-200' 
              : message.type === 'info'
              ? 'bg-blue-50 text-blue-800 border-blue-200'
              : 'bg-red-50 text-red-800 border-red-200'
          }`}
          role="alert"
        >
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <p className="font-medium text-sm">
                {typeof message.text === 'string' ? message.text : extractErrorMessage(message.text)}
              </p>
            </div>
            <button
              onClick={() => setMessage(null)}
              className="flex-shrink-0 rounded-md p-1 hover:bg-black/5 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent focus:ring-gray-400"
              aria-label="Fechar mensagem"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Status Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Status da Integração</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Status badges em linha */}
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col items-center gap-1">
              <span className="text-xs text-muted-foreground">Configurado</span>
              {status?.configured ? (
                <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200 text-xs px-2 py-0.5">
                  <CheckCircle className="h-2.5 w-2.5 mr-1" />
                  Sim
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-gray-100 text-gray-700 border-gray-200 text-xs px-2 py-0.5">
                  <XCircle className="h-2.5 w-2.5 mr-1" />
                  Não
                </Badge>
              )}
            </div>
            
            <div className="flex flex-col items-center gap-1">
              <span className="text-xs text-muted-foreground">Ativo</span>
              {status?.active ? (
                <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200 text-xs px-2 py-0.5">
                  <CheckCircle className="h-2.5 w-2.5 mr-1" />
                  Sim
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-gray-100 text-gray-700 border-gray-200 text-xs px-2 py-0.5">
                  <XCircle className="h-2.5 w-2.5 mr-1" />
                  Não
                </Badge>
              )}
            </div>

            <div className="flex flex-col items-center gap-1">
              <span className="text-xs text-muted-foreground">Autenticado</span>
              {status?.authenticated ? (
                <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200 text-xs px-2 py-0.5">
                  <CheckCircle className="h-2.5 w-2.5 mr-1" />
                  Sim
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200 text-xs px-2 py-0.5">
                  <XCircle className="h-2.5 w-2.5 mr-1" />
                  Não
                </Badge>
              )}
            </div>
          </div>

          {status?.auth_error && (
            <div className="p-2 bg-red-50 border border-red-200 rounded text-xs">
              <p className="font-medium text-red-800 mb-1">Erro: {status.auth_error}</p>
              <p className="text-red-600">Verifique as credenciais no painel do iFood</p>
            </div>
          )}

          {/* Informações em linha compacta */}
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t">
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>{formatDateString(status?.last_sync || null)}</span>
            </div>
            {status?.polling_interval && (
              <span>Polling: {status.polling_interval}s</span>
            )}
          </div>

          <Button 
            onClick={handleSync} 
            disabled={syncing || !status?.configured}
            size="sm"
            className="w-full"
          >
            <RefreshCw className={`h-3 w-3 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Sincronizando...' : 'Sincronizar Agora'}
          </Button>
        </CardContent>
      </Card>

      {/* Dashboard de Pedidos */}
      {status?.active && (
        <div className="space-y-6">
          {/* Header com botão de atualizar */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Dashboard de Pedidos</h2>
              <p className="text-sm text-muted-foreground">Gerencie todos os pedidos do iFood</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                loadPendingOrders()
                loadActiveOrders()
                loadDispatchedOrders()
                loadConcludedOrders()
              }}
              disabled={loadingOrders || loadingActiveOrders || loadingDispatchedOrders || loadingConcludedOrders}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${(loadingOrders || loadingActiveOrders || loadingDispatchedOrders || loadingConcludedOrders) ? 'animate-spin' : ''}`} />
              Atualizar Tudo
            </Button>
          </div>

          {/* Layout com duas colunas quando pedido está selecionado */}
          <div className={`grid gap-6 ${selectedDashboardOrder ? 'lg:grid-cols-[2fr_1fr]' : 'lg:grid-cols-2'}`}>
            {/* Coluna Esquerda - Seções de Pedidos */}
            <div className={`space-y-6 ${selectedDashboardOrder ? '' : 'lg:col-span-2'}`}>
              {/* Seção: Pedidos Pendentes (sempre visível, mesmo vazio) */}
              <Card className="bg-gray-50">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">Pedidos Pendentes</CardTitle>
                      <Badge className="bg-gray-700 text-white">{pendingOrders.length}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={loadPendingOrders}
                        disabled={loadingOrders}
                      >
                        <RefreshCw className={`h-4 w-4 mr-2 ${loadingOrders ? 'animate-spin' : ''}`} />
                        Atualizar
                      </Button>
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                  <CardDescription className="mt-1">
                    Pedidos recebidos do iFood aguardando aceitação
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingOrders ? (
                    <div className="text-center py-8">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Carregando pedidos...</p>
                    </div>
                  ) : pendingOrders.length === 0 ? (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      Nenhum pedido pendente no momento.
                    </div>
                  ) : (
                    <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 ${getMobileOrderListScrollClass(pendingOrders.length)}`}>
                      {pendingOrders.map((order) => {
                          try {
                            console.log('[Frontend] Rendering order:', {
                              id: order.id,
                              displayId: order.displayId,
                              shortReference: order.shortReference,
                              customer: order.customer,
                              hasItems: !!(order.items && order.items.length > 0)
                            })
                            
                            const orderType = order.orderType || 'DELIVERY'
                            const isDelivery = orderType === 'DELIVERY'
                            const isTakeout = orderType === 'TAKEOUT'
                            const totalAmount = order.total?.orderAmount || order.totalPrice?.amount || 0
                            
                            const orderDisplayId = order.displayId || order.shortReference || order.id
                            const createdAt = order.createdAt
                            const elapsedTime = createdAt ? getElapsedTime(createdAt) : '0min'
                            
                            return (
                              <div
                                key={order.id}
                                className="bg-white border rounded-lg p-3 min-w-[140px] flex-1 max-w-[200px] cursor-pointer hover:shadow-md transition-shadow"
                                onClick={() => {
                                  setSelectedOrder(order)
                                  setIsOrderDetailOpen(true)
                                }}
                              >
                                <div className="flex items-start gap-2 mb-2">
                                  <input
                                    type="checkbox"
                                    className="mt-1"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground flex-1">
                                    <ShoppingBag className="h-3 w-3" />
                                    <span>{isDelivery ? 'Delivery' : isTakeout ? 'Retirada' : 'Própria'}</span>
                                  </div>
                                </div>
                                <div className="text-2xl font-bold mb-1">{orderDisplayId}</div>
                                <div className="text-xs text-muted-foreground mb-2">Pedido P.</div>
                                <div className="bg-orange-100 text-orange-700 text-xs px-2 py-1 rounded text-center mb-2">
                                  {elapsedTime}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {formatCurrency(totalAmount)}
                                </div>
                              </div>
                            )
                          } catch (error) {
                            // #region agent log
                            fetch('http://127.0.0.1:7243/ingest/b058c8da-e202-4622-9483-5c45531d7867',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'IfoodIntegration.tsx:1045',message:'error rendering order',data:{orderId:order.id,error:error instanceof Error?error.message:String(error),errorStack:error instanceof Error?error.stack:undefined,orderDisplayId:order.displayId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
                            // #endregion
                            console.error('Error rendering order:', error, order)
                            console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
                            // Return a simple card with minimal rendering to avoid cascading errors
                            return (
                              <div key={order.id || `error-${Math.random()}`} className="border rounded-lg p-4 bg-red-50">
                                <p className="text-red-800 text-sm font-semibold">Erro ao renderizar pedido</p>
                                <p className="text-red-600 text-xs mt-1">ID: {order.id || 'Desconhecido'}</p>
                                <p className="text-red-600 text-xs">Display ID: {order.displayId || order.shortReference || 'N/A'}</p>
                                <p className="text-red-500 text-xs mt-2">Erro: {error instanceof Error ? error.message : String(error)}</p>
                              </div>
                            )
                          }
                        })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Seção: Em Preparo */}
              <Card className="bg-gray-50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">Em preparo</CardTitle>
                    <Badge className="bg-gray-700 text-white">{preparingOrders.length}</Badge>
                  </div>
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                {loadingActiveOrders ? (
                  <div className="text-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Carregando...</p>
                  </div>
                ) : preparingOrders.length === 0 ? (
                  <div className="text-center py-8">
                    <ShoppingBag className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <p className="text-sm text-muted-foreground">Nenhum pedido em preparo</p>
                  </div>
                ) : (
                  <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 ${getMobileOrderListScrollClass(preparingOrders.length)} ${preparingOrders.length > 5 ? 'md:max-h-[500px] md:overflow-y-auto md:pr-2' : ''}`}>
                    {preparingOrders.map((order: any) => {
                      const orderDisplayId = order.ifood_display_id || order.id
                      const createdAt = order.created_at || order.createdAt || order.time
                      const elapsedTime = createdAt ? getElapsedTime(createdAt) : '0min'
                      const isSelected = selectedDashboardOrder?.id === order.id
                      
                      return (
                        <div
                          key={order.id}
                          className={`bg-white border rounded-lg p-3 min-w-[140px] flex-1 max-w-[200px] cursor-pointer hover:shadow-md transition-shadow ${
                            isSelected ? 'border-red-500 border-2' : ''
                          }`}
                          onClick={() => setSelectedDashboardOrder(order)}
                        >
                          <div className="flex items-start gap-2 mb-2">
                            <input
                              type="checkbox"
                              className="mt-1"
                              onClick={(e) => e.stopPropagation()}
                            />
                            <div className="flex items-center gap-1 text-xs text-muted-foreground flex-1">
                              <ShoppingBag className="h-3 w-3" />
                              <span>Própria</span>
                            </div>
                          </div>
                          <div className="text-2xl font-bold mb-1">{orderDisplayId}</div>
                          <div className="text-xs text-muted-foreground mb-2">Pedido P.</div>
                          <div className="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded text-center">
                            {elapsedTime}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

              {/* Seção: Pronto */}
              <Card className="bg-gray-50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">Pronto</CardTitle>
                    <Badge className="bg-gray-700 text-white">{readyOrders.length}</Badge>
                  </div>
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                {loadingActiveOrders ? (
                  <div className="text-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Carregando...</p>
                  </div>
                ) : readyOrders.length === 0 ? (
                  <div className="text-center py-12">
                    <ShoppingBag className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-30" />
                    <p className="text-sm text-muted-foreground">Aqui ficarão seus pedidos prontos para coleta</p>
                  </div>
                ) : (
                  <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 ${getMobileOrderListScrollClass(readyOrders.length)}`}>
                    {readyOrders.map((order: any) => {
                      const orderDisplayId = order.ifood_display_id || order.id
                      const isSelected = selectedDashboardOrder?.id === order.id
                      
                      return (
                        <div
                          key={order.id}
                          className={`bg-white border rounded-lg p-3 min-w-[140px] flex-1 max-w-[200px] cursor-pointer hover:shadow-md transition-shadow ${
                            isSelected ? 'border-red-500 border-2' : ''
                          }`}
                          onClick={() => setSelectedDashboardOrder(order)}
                        >
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                            <ShoppingBag className="h-3 w-3" />
                            <span>Própria</span>
                          </div>
                          <div className="text-2xl font-bold mb-1">{orderDisplayId}</div>
                          <div className="text-xs text-muted-foreground mb-2">Pedido P.</div>
                          <div className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded text-center">
                            Pronto
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

              {/* Seção: Em Rota */}
              <Card className="bg-gray-50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg">Em rota</CardTitle>
                  <Badge className="bg-gray-700 text-white">{routeOrders.length}</Badge>
                </div>
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              {loadingDispatchedOrders ? (
                <div className="text-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Carregando...</p>
                </div>
              ) : routeOrders.length === 0 ? (
                <div className="text-center py-8">
                  <ShoppingBag className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-sm text-muted-foreground">Nenhum pedido em rota</p>
                </div>
              ) : (
                <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 ${getMobileOrderListScrollClass(routeOrders.length)}`}>
                  {routeOrders.map((order: any) => {
                    const orderDisplayId = order.ifood_display_id || order.id
                    const createdAt = order.created_at || order.createdAt || order.closedAt
                    const elapsedTime = createdAt ? getElapsedTimeFormatted(createdAt) : 'há 0min'
                    const isSelected = selectedDashboardOrder?.id === order.id
                    
                    return (
                      <div
                        key={order.id}
                        className={`bg-white border rounded-lg p-3 min-w-[140px] flex-1 max-w-[200px] cursor-pointer hover:shadow-md transition-shadow ${
                          isSelected ? 'border-red-500 border-2' : ''
                        }`}
                        onClick={() => setSelectedDashboardOrder(order)}
                      >
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                          <ShoppingBag className="h-3 w-3" />
                          <span>Própria</span>
                        </div>
                        <div className="text-2xl font-bold mb-1">{orderDisplayId}</div>
                        <div className="text-xs text-muted-foreground mb-2">Pedido P.</div>
                        <div className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded text-center">
                          {elapsedTime}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

              {/* Seção: Finalizados */}
              <Card className="bg-gray-50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg">Finalizados</CardTitle>
                  <Badge className="bg-gray-700 text-white">{finishedOrders.length}</Badge>
                </div>
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              {loadingConcludedOrders ? (
                <div className="text-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Carregando...</p>
                </div>
              ) : finishedOrders.length === 0 ? (
                <div className="text-center py-8">
                  <ShoppingBag className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-sm text-muted-foreground">Nenhum pedido finalizado</p>
                </div>
              ) : (
                <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 ${getMobileOrderListScrollClass(finishedOrders.length)}`}>
                  {finishedOrders.map((order: any) => {
                    const orderDisplayId = order.ifood_display_id || order.id
                    const isCancelled = order.status === 'Cancelled' || order.ifood_status === 'CANCELLED'
                    const isSelected = selectedDashboardOrder?.id === order.id
                    
                    return (
                      <div
                        key={order.id}
                        className={`bg-white border rounded-lg p-3 cursor-pointer hover:shadow-md transition-shadow ${
                          isSelected ? 'border-red-500 border-2' : ''
                        }`}
                        onClick={() => setSelectedDashboardOrder(order)}
                      >
                        <div className="text-xl font-bold mb-2">{orderDisplayId}</div>
                        {isCancelled && (
                          <div className="flex items-center gap-1 text-xs text-red-600">
                            <X className="h-3 w-3" />
                            <span>Cancelado</span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
            </div>

            {/* Painel de Detalhes do Pedido Selecionado */}
            {selectedDashboardOrder && (
              <Card className="bg-white sticky top-4 h-fit max-h-[calc(100vh-2rem)] overflow-y-auto">
                <CardHeader className="pb-3 border-b">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-white border-2 border-gray-300 text-gray-700 text-lg px-3 py-1">
                        {selectedDashboardOrder.ifood_display_id || selectedDashboardOrder.id}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                      >
                        <Phone className="h-4 w-4 text-red-500" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => setSelectedDashboardOrder(null)}
                      >
                        <X className="h-4 w-4 text-gray-500" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-2">
                    <h3 className="font-semibold text-lg">
                      {typeof selectedDashboardOrder.customer === 'object' 
                        ? selectedDashboardOrder.customer.name 
                        : selectedDashboardOrder.customer || 'Cliente'}
                    </h3>
                  </div>
                </CardHeader>
              <CardContent className="pt-4 space-y-4">
                {/* Informações do Pedido */}
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>Feito às {selectedDashboardOrder.created_at 
                      ? new Date(selectedDashboardOrder.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                      : selectedDashboardOrder.time || 'N/A'}</span>
                  </div>
                  {selectedDashboardOrder.ifood_order_id && (
                    <div>
                      <span className="text-red-600 font-medium">Localizador</span>{' '}
                      {selectedDashboardOrder.ifood_order_id.split('').join(' ')}
                    </div>
                  )}
                  <div>
                    <Badge variant="outline" className="text-xs">via iFood</Badge>
                  </div>
                </div>

                {/* Entrega */}
                {selectedDashboardOrder.orderType === 'delivery' && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>Entrega prevista: {selectedDashboardOrder.created_at 
                        ? (() => {
                            const created = new Date(selectedDashboardOrder.created_at)
                            const estimated = new Date(created.getTime() + 45 * 60000) // +45 minutos
                            return estimated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                          })()
                        : 'N/A'}</span>
                    </div>
                    {selectedDashboardOrder.customer && typeof selectedDashboardOrder.customer === 'object' && selectedDashboardOrder.customer.ordersCountOnMerchant === 1 && (
                      <Badge variant="outline" className="text-xs bg-gray-100">1º pedido</Badge>
                    )}
                  </div>
                )}

                {/* Contato */}
                {selectedDashboardOrder.customer && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {typeof selectedDashboardOrder.customer === 'object' 
                        ? (selectedDashboardOrder.customer.phone?.number || selectedDashboardOrder.customer.phoneNumber || 'N/A')
                        : 'N/A'}
                      {selectedDashboardOrder.ifood_order_id && ` ID: ${selectedDashboardOrder.ifood_order_id}`}
                    </span>
                  </div>
                )}

                {/* Status do Pedido */}
                <div className="border-t pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">Pedido em preparo</span>
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {(() => {
                      const createdAt = selectedDashboardOrder.created_at || selectedDashboardOrder.createdAt
                      if (!createdAt) return 'Há alguns minutos.'
                      const elapsed = getElapsedTime(createdAt)
                      return `Há ${elapsed}.`
                    })()}
                  </div>
                </div>

                {/* Endereço */}
                {selectedDashboardOrder.orderType === 'delivery' && (
                  <div className="border-t pt-3 space-y-1 text-sm">
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div className="flex-1">
                        <div>Rua {selectedDashboardOrder.delivery?.deliveryAddress?.streetName || selectedDashboardOrder.delivery?.address?.streetName || 'N/A'}, {selectedDashboardOrder.delivery?.deliveryAddress?.streetNumber || selectedDashboardOrder.delivery?.address?.streetNumber || ''}</div>
                        <div>{selectedDashboardOrder.delivery?.deliveryAddress?.neighborhood || selectedDashboardOrder.delivery?.address?.neighborhood || ''} - {selectedDashboardOrder.delivery?.deliveryAddress?.city || selectedDashboardOrder.delivery?.address?.city || ''} • {selectedDashboardOrder.delivery?.deliveryAddress?.postalCode || selectedDashboardOrder.delivery?.address?.postalCode || ''}</div>
                        {selectedDashboardOrder.delivery?.deliveryAddress?.complement && (
                          <div>Complemento {selectedDashboardOrder.delivery.deliveryAddress.complement}</div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Observações */}
                {selectedDashboardOrder.notes && (
                  <div className="border-t pt-3">
                    <div className="bg-gray-50 rounded-lg p-3 text-sm">
                      <p>{selectedDashboardOrder.notes}</p>
                      <div className="mt-2">
                        <Badge variant="outline" className="text-xs">Entrega própria</Badge>
                      </div>
                    </div>
                  </div>
                )}

                {/* Itens do Pedido */}
                {selectedDashboardOrder.items && selectedDashboardOrder.items.length > 0 && (
                  <div className="border-t pt-3">
                    <h4 className="font-medium text-sm mb-2">Itens do Pedido</h4>
                    <div className="space-y-2">
                      {selectedDashboardOrder.items.map((item: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{item.quantity}x</span>
                            <span>{item.name}</span>
                          </div>
                          <span className="text-muted-foreground">
                            {formatCurrency((item.price || 0) * (item.quantity || 0))}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 pt-3 border-t flex items-center justify-between">
                      <span className="font-bold">Total</span>
                      <span className="font-bold text-lg">{formatCurrency(selectedDashboardOrder.total || 0)}</span>
                    </div>
                  </div>
                )}

                {/* Ações */}
                <div className="border-t pt-4 space-y-3">
                  <div>
                    <h4 className="font-medium text-sm mb-2">Problemas com este pedido?</h4>
                    <Button variant="ghost" size="sm" className="text-red-600 p-0 h-auto">
                      <Phone className="h-4 w-4 mr-2" />
                      Fale com o iFood
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1">
                      <Package className="h-4 w-4 mr-2" />
                      Imprimir
                    </Button>
                    {selectedDashboardOrder.ifood_status === 'PREPARATION_STARTED' || selectedDashboardOrder.ifood_status === 'CONFIRMED' ? (
                      <Button 
                        className="flex-1 bg-green-600 hover:bg-green-700"
                        size="sm"
                        onClick={async () => {
                          // Implementar despacho do pedido
                          try {
                            const response = await fetch(`${backendUrl}/api/ifood/dispatch-order/${selectedDashboardOrder.id}`, {
                              method: 'POST'
                            })
                            const result = await response.json()
                            if (result.success) {
                              await loadActiveOrders()
                              await loadDispatchedOrders()
                              setSelectedDashboardOrder(null)
                            }
                          } catch (error) {
                            console.error('Erro ao despachar pedido:', error)
                          }
                        }}
                      >
                        Despachar
                      </Button>
                    ) : null}
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full border-red-500 text-red-600 hover:bg-red-50"
                    onClick={async () => {
                      if (confirm('Tem certeza que deseja cancelar este pedido?')) {
                        try {
                          const response = await fetch(`${backendUrl}/api/ifood/cancel-order/${selectedDashboardOrder.id}`, {
                            method: 'POST'
                          })
                          const result = await response.json()
                          if (result.success) {
                            await loadActiveOrders()
                            await loadDispatchedOrders()
                            await loadConcludedOrders()
                            setSelectedDashboardOrder(null)
                          }
                        } catch (error) {
                          console.error('Erro ao cancelar pedido:', error)
                        }
                      }
                    }}
                  >
                    Cancelar pedido
                  </Button>
                </div>
              </CardContent>
            </Card>
            )}
          </div>
        </div>
      )}



      {/* Modal de Detalhes do Pedido Pendente */}
      <Dialog open={isOrderDetailOpen} onOpenChange={setIsOrderDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedOrder && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span>Pedido #{selectedOrder.displayId || selectedOrder.shortReference || selectedOrder.id}</span>
                  <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                    Aguardando Confirmação
                  </Badge>
                </DialogTitle>
                <DialogDescription>
                  Revise os detalhes do pedido antes de aceitar ou cancelar
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 mt-4">
                {/* Informações Gerais */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Data/Hora:</span>
                      <span>{formatDate(selectedOrder.createdAt)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Info className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Tipo:</span>
                      <span>
                        {selectedOrder.orderType === 'DELIVERY' ? 'Delivery' :
                         selectedOrder.orderType === 'TAKEOUT' ? 'Retirada' :
                         selectedOrder.orderType === 'DINE_IN' ? 'Consumir no local' :
                         selectedOrder.orderType === 'INDOOR' ? 'Indoor' : 'Desconhecido'}
                      </span>
                    </div>
                    {selectedOrder.orderTiming && (
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Entrega:</span>
                        <span>{selectedOrder.orderTiming === 'IMMEDIATE' ? 'Imediata' : 'Agendada'}</span>
                      </div>
                    )}
                    {selectedOrder.salesChannel && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium">Canal:</span>
                        <span>{selectedOrder.salesChannel}</span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    {selectedOrder.preparationStartDateTime && (
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Início Preparo:</span>
                        <span>{formatDate(selectedOrder.preparationStartDateTime || '')}</span>
                      </div>
                    )}
                    {selectedOrder.preparationTimeInSeconds && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium">Tempo Preparo:</span>
                        <span>{Math.ceil(selectedOrder.preparationTimeInSeconds / 60)} minutos</span>
                      </div>
                    )}
                    {selectedOrder.isTest && (
                      <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                        Pedido de Teste
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Informações do Cliente */}
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Informações do Cliente
                  </h3>
                  {(() => {
                    // Calcular variáveis para exibição
                    const customerName = typeof selectedOrder.customer === 'object' && selectedOrder.customer?.name 
                      ? selectedOrder.customer.name 
                      : typeof selectedOrder.customer === 'string' 
                        ? selectedOrder.customer 
                        : 'Cliente iFood'
                    const customerPhone = typeof selectedOrder.customer === 'object' 
                      ? (selectedOrder.customer?.phone?.number || selectedOrder.customer?.phoneNumber)
                      : null
                    const itemsCount = (selectedOrder.items || []).reduce((sum: number, item: any) => {
                      const qty = item.quantity || 0
                      return sum + (typeof qty === 'number' ? qty : 0)
                    }, 0)
                    
                    return (
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Nome do Cliente:</span>
                          <span className="ml-2">{customerName}</span>
                        </div>
                        {customerPhone && (
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">Tel do Cliente:</span>
                            <span>{customerPhone}</span>
                            {typeof selectedOrder.customer === 'object' && selectedOrder.customer.phone?.localizer && (
                              <span className="text-xs text-muted-foreground">
                                (Localizador: {selectedOrder.customer.phone.localizer})
                              </span>
                            )}
                          </div>
                        )}
                        <div>
                          <span className="font-medium">Quantidade dos itens:</span>
                          <span className="ml-2">{itemsCount}</span>
                        </div>
                      </div>
                    )
                  })()}
                  <div className="grid grid-cols-2 gap-4 text-sm mt-4">
                    {(typeof selectedOrder.customer === 'object' && selectedOrder.customer.documentNumber) && (
                      <div>
                        <span className="font-medium">Documento:</span>
                        <span className="ml-2">{selectedOrder.customer.documentNumber}</span>
                      </div>
                    )}
                    {(typeof selectedOrder.customer === 'object' && selectedOrder.customer.ordersCountOnMerchant) && (
                      <div>
                        <span className="font-medium">Pedidos anteriores:</span>
                        <span className="ml-2">{selectedOrder.customer.ordersCountOnMerchant}</span>
                      </div>
                    )}
                    {(typeof selectedOrder.customer === 'object' && selectedOrder.customer.segmentation) && (
                      <div>
                        <span className="font-medium">Segmentação:</span>
                        <span className="ml-2">{selectedOrder.customer.segmentation}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Endereço de Entrega */}
                {(selectedOrder.delivery?.deliveryAddress || selectedOrder.delivery?.address) && (
                  <div className="border rounded-lg p-4">
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Endereço de Entrega
                    </h3>
                    <div className="text-sm space-y-1">
                      {(() => {
                        const address = selectedOrder.delivery?.deliveryAddress || selectedOrder.delivery?.address
                        if (!address) return null
                        return (
                          <>
                            <div>
                              <span className="font-medium">Endereço:</span>
                              <span className="ml-2">
                                {address.streetName || address.street || ''}, 
                                {address.streetNumber || address.number || ''}
                                {address.complement && ` - ${address.complement}`}
                              </span>
                            </div>
                            <div>
                              <span className="font-medium">Bairro:</span>
                              <span className="ml-2">{address.neighborhood || ''}</span>
                            </div>
                            <div>
                              <span className="font-medium">Cidade/Estado:</span>
                              <span className="ml-2">
                                {address.city || ''} - {address.state || ''}
                              </span>
                            </div>
                            {(address.postalCode || address.zipCode) && (
                              <div>
                                <span className="font-medium">CEP:</span>
                                <span className="ml-2">{address.postalCode || address.zipCode}</span>
                              </div>
                            )}
                            {address.reference && (
                              <div>
                                <span className="font-medium">Referência:</span>
                                <span className="ml-2">{address.reference}</span>
                              </div>
                            )}
                          </>
                        )
                      })()}
                      {selectedOrder.delivery.pickupCode && (
                        <div className="mt-2 p-2 bg-blue-50 rounded">
                          <span className="font-medium">Código de Retirada:</span>
                          <span className="ml-2 font-mono text-lg">{selectedOrder.delivery.pickupCode}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Informações de Retirada */}
                {selectedOrder.takeout && (
                  <div className="border rounded-lg p-4">
                    <h3 className="font-semibold mb-3">Informações de Retirada</h3>
                    <div className="text-sm space-y-1">
                      {selectedOrder.takeout.mode && (
                        <div>
                          <span className="font-medium">Modo:</span>
                          <span className="ml-2">{selectedOrder.takeout.mode}</span>
                        </div>
                      )}
                      {selectedOrder.takeout.takeoutDateTime && (
                        <div>
                          <span className="font-medium">Data/Hora:</span>
                          <span className="ml-2">{formatDate(selectedOrder.takeout.takeoutDateTime)}</span>
                        </div>
                      )}
                      {selectedOrder.takeout.observations && (
                        <div>
                          <span className="font-medium">Observações:</span>
                          <span className="ml-2">{selectedOrder.takeout.observations}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Itens do Pedido */}
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Itens do Pedido ({(selectedOrder.items || []).length})
                  </h3>
                  <div className="space-y-4">
                    {(selectedOrder.items || []).map((item: any, idx: number) => (
                      <div key={item.id || idx} className="border-b pb-3 last:border-0">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{item.quantity}x</span>
                              <span className="font-medium">{item.name}</span>
                              {item.externalCode && (
                                <Badge variant="outline" className="text-xs">
                                  {item.externalCode}
                                </Badge>
                              )}
                            </div>
                            {item.observations && (
                              <div className="text-sm text-muted-foreground mt-1 italic">
                                Obs: {item.observations}
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="font-semibold">
                              {formatCurrency(item.totalPrice || item.price || (item.unitPrice * item.quantity) || 0)}
                            </div>
                            {item.unitPrice && (
                              <div className="text-xs text-muted-foreground">
                                {formatCurrency(item.unitPrice)} cada
                              </div>
                            )}
                          </div>
                        </div>
                        {/* Opções/Complementos do Item */}
                        {item.options && Array.isArray(item.options) && item.options.length > 0 && (
                          <div className="ml-6 mt-2 space-y-1">
                            <div className="text-xs font-medium text-muted-foreground">Complementos:</div>
                            {item.options.map((option: any, optIdx: number) => (
                              <div key={option.id || `opt-${optIdx}`} className="space-y-1">
                                <div className="flex items-center justify-between text-sm">
                                  <span className="ml-2">
                                    {option.quantity || 1}x {option.name || 'Complemento'}
                                  </span>
                                  <span className="text-muted-foreground">
                                    {formatCurrency(option.price || (option.unitPrice ? (option.unitPrice * (option.quantity || 1)) : 0) || 0)}
                                  </span>
                                </div>
                                {/* Customizações dentro de opções (terceiro nível) */}
                                {option.customizations && Array.isArray(option.customizations) && option.customizations.length > 0 && (
                                  <div className="ml-4 mt-1 space-y-0.5">
                                    {option.customizations.map((customization: any, custIdx: number) => (
                                      <div key={customization.id || `cust-${custIdx}`} className="flex items-center justify-between text-xs text-muted-foreground">
                                        <span className="ml-2">
                                          • {customization.quantity || 1}x {customization.name || 'Customização'}
                                        </span>
                                        <span>
                                          {formatCurrency(customization.price || (customization.unitPrice ? (customization.unitPrice * (customization.quantity || 1)) : 0) || 0)}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Benefícios e Descontos */}
                {selectedOrder.benefits && selectedOrder.benefits.length > 0 && (
                  <div className="border rounded-lg p-4">
                    <h3 className="font-semibold mb-3">Benefícios e Descontos</h3>
                    <div className="space-y-2">
                      {selectedOrder.benefits.map((benefit: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between text-sm">
                          <div>
                            <span className="font-medium">{benefit.target === 'CART' ? 'Carrinho' : benefit.target === 'ITEM' ? 'Item' : benefit.target}:</span>
                            {benefit.campaign && (
                              <span className="ml-2 text-muted-foreground">({benefit.campaign.name})</span>
                            )}
                          </div>
                          <span className="text-green-600 font-semibold">
                            -{formatCurrency(benefit.value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Taxas Adicionais */}
                {selectedOrder.additionalFees && selectedOrder.additionalFees.length > 0 && (
                  <div className="border rounded-lg p-4">
                    <h3 className="font-semibold mb-3">Taxas Adicionais</h3>
                    <div className="space-y-2">
                      {selectedOrder.additionalFees.map((fee: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between text-sm">
                          <span>{fee.type}</span>
                          <span>{formatCurrency(fee.value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Resumo Financeiro */}
                <div className="border rounded-lg p-4 bg-muted/50">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Resumo Financeiro
                  </h3>
                  <div className="space-y-2">
                    {selectedOrder.total && (
                      <>
                        <div className="flex items-center justify-between text-sm">
                          <span>Subtotal:</span>
                          <span>{formatCurrency(selectedOrder.total.subTotal || 0)}</span>
                        </div>
                        {selectedOrder.total.deliveryFee !== undefined && selectedOrder.total.deliveryFee > 0 && (
                          <div className="flex items-center justify-between text-sm">
                            <span>Taxa de Entrega:</span>
                            <span>{formatCurrency(selectedOrder.total.deliveryFee)}</span>
                          </div>
                        )}
                        {selectedOrder.total.additionalFees !== undefined && selectedOrder.total.additionalFees > 0 && (
                          <div className="flex items-center justify-between text-sm">
                            <span>Taxas Adicionais:</span>
                            <span>{formatCurrency(selectedOrder.total.additionalFees)}</span>
                          </div>
                        )}
                        {selectedOrder.total.benefits !== undefined && selectedOrder.total.benefits > 0 && (
                          <div className="flex items-center justify-between text-sm text-green-600">
                            <span>Descontos:</span>
                            <span>-{formatCurrency(selectedOrder.total.benefits)}</span>
                          </div>
                        )}
                        <div className="border-t pt-2 mt-2 flex items-center justify-between font-bold text-lg">
                          <span>Total:</span>
                          <span className="text-primary">{formatCurrency(selectedOrder.total.orderAmount || 0)}</span>
                        </div>
                      </>
                    )}
                    {!selectedOrder.total && (
                      <div className="flex items-center justify-between font-bold text-lg">
                        <span>Total:</span>
                        <span className="text-primary">
                          {formatCurrency(selectedOrder.totalPrice?.amount || 0)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Formas de Pagamento */}
                {selectedOrder.payments && (
                  <div className="border rounded-lg p-4">
                    <h3 className="font-semibold mb-3">Formas de Pagamento</h3>
                    <div className="space-y-2">
                      {selectedOrder.payments.prepaid !== undefined && selectedOrder.payments.prepaid > 0 && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-green-600">Pago Online:</span>
                          <span className="font-semibold">{formatCurrency(selectedOrder.payments.prepaid)}</span>
                        </div>
                      )}
                      {selectedOrder.payments.pending !== undefined && selectedOrder.payments.pending > 0 && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-orange-600">Pendente:</span>
                          <span className="font-semibold">{formatCurrency(selectedOrder.payments.pending)}</span>
                        </div>
                      )}
                      {selectedOrder.payments.methods && selectedOrder.payments.methods.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {selectedOrder.payments.methods.map((method: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between text-sm border-l-2 pl-2 border-muted">
                              <div>
                                <span className="font-medium">
                                  {method.method === 'CASH' ? 'Dinheiro' :
                                   method.method === 'CREDIT' ? 'Cartão de Crédito' :
                                   method.method === 'DEBIT' ? 'Cartão de Débito' :
                                   method.method === 'PIX' ? 'PIX' :
                                   method.method === 'VOUCHER' ? 'Vale' :
                                   method.method}
                                </span>
                                {method.type && (
                                  <span className="ml-2 text-xs text-muted-foreground">
                                    ({method.type === 'ONLINE' ? 'Online' : 'Offline'})
                                  </span>
                                )}
                                {method.prepaid && (
                                  <Badge variant="outline" className="ml-2 text-xs bg-green-50 text-green-700">
                                    Pago
                                  </Badge>
                                )}
                              </div>
                              <span className="font-semibold">{formatCurrency(method.value)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Informações Adicionais */}
                {selectedOrder.extraInfo && (
                  <div className="border rounded-lg p-4 bg-yellow-50">
                    <h3 className="font-semibold mb-2">Informações Adicionais</h3>
                    <p className="text-sm">{selectedOrder.extraInfo}</p>
                  </div>
                )}

                {/* Informações de Agendamento */}
                {selectedOrder.schedule && (
                  <div className="border rounded-lg p-4">
                    <h3 className="font-semibold mb-3">Agendamento</h3>
                    <div className="text-sm space-y-1">
                      <div>
                        <span className="font-medium">Início:</span>
                        <span className="ml-2">{formatDate(selectedOrder.schedule.deliveryDateTimeStart || '')}</span>
                      </div>
                      <div>
                        <span className="font-medium">Fim:</span>
                        <span className="ml-2">{formatDate(selectedOrder.schedule.deliveryDateTimeEnd || '')}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter className="mt-6">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsOrderDetailOpen(false)
                    setSelectedOrder(null)
                  }}
                >
                  Fechar
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => selectedOrder && handleCancelOrder(selectedOrder.id)}
                  disabled={cancellingOrder === selectedOrder.id}
                >
                  {cancellingOrder === selectedOrder.id ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Cancelando...
                    </>
                  ) : (
                    <>
                      <X className="h-4 w-4 mr-2" />
                      Cancelar Pedido
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => selectedOrder && handleAcceptOrder(selectedOrder.id)}
                  disabled={acceptingOrder === selectedOrder.id}
                >
                  {acceptingOrder === selectedOrder.id ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Aceitar Pedido
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Buscar Detalhes do Pedido */}
      {status?.configured && (
        <Card>
          <CardHeader>
            <CardTitle>Buscar Detalhes do Pedido</CardTitle>
            <CardDescription>
              Busque os detalhes de um pedido do iFood usando o UUID do pedido
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="order_uuid">UUID do Pedido (iFood)</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="order_uuid"
                  type="text"
                  placeholder="Ex: 269a9284-76f9-4846-a04c-c564bb10868d"
                  value={orderUuid}
                  onChange={(e) => setOrderUuid(e.target.value)}
                  className="font-mono text-sm"
                />
                <Button
                  onClick={handleFetchOrderDetails}
                  disabled={loadingOrderDetails || !orderUuid.trim()}
                >
                  {loadingOrderDetails ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Buscando...
                    </>
                  ) : (
                    <>
                      <ShoppingBag className="h-4 w-4 mr-2" />
                      Buscar
                    </>
                  )}
                </Button>
              </div>
            </div>
            {orderDetails && (
              <div className="mt-4 p-4 border rounded-lg bg-gray-50">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Pedido #{orderDetails.displayId || orderDetails.shortReference}</span>
                    <Badge variant="outline">
                      {orderDetails.orderType === 'DELIVERY' ? 'Delivery' : 
                       orderDetails.orderType === 'TAKEOUT' ? 'Retirada' :
                       orderDetails.orderType === 'DINE_IN' ? 'Consumir no local' : 'Pedido'}
                    </Badge>
                  </div>
                  <div className="text-sm space-y-1">
                    <div><span className="font-medium">Cliente:</span> {orderDetails.customer?.name}</div>
                    <div><span className="font-medium">Total:</span> {formatCurrency(orderDetails.totalPrice?.amount || 0)}</div>
                    <div><span className="font-medium">Criado em:</span> {formatDate(orderDetails.createdAt)}</div>
                    {orderDetails.items && orderDetails.items.length > 0 && (
                      <div className="mt-2">
                        <span className="font-medium">Itens ({orderDetails.items.length}):</span>
                        <ul className="list-disc list-inside ml-2 mt-1">
                          {orderDetails.items.slice(0, 5).map((item: any, idx: number) => (
                            <li key={idx} className="text-xs">
                              {item.quantity}x {item.name} - {formatCurrency(item.totalPrice)}
                            </li>
                          ))}
                          {orderDetails.items.length > 5 && (
                            <li className="text-xs text-muted-foreground">
                              +{orderDetails.items.length - 5} mais item(ns)
                            </li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            {orderDetailsError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">{orderDetailsError}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Webhook URL Card */}
      {status?.configured && status?.webhook_url && (
        <Card>
          <CardHeader 
            className="cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => setIsWebhookCollapsed(!isWebhookCollapsed)}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <CardTitle>URL do Webhook</CardTitle>
                <CardDescription>
                  Configure esta URL no painel do iFood para receber pedidos via webhook
                </CardDescription>
              </div>
              {isWebhookCollapsed ? (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronUp className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
          </CardHeader>
          {!isWebhookCollapsed && (
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>URL do Webhook</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={status.webhook_url}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    navigator.clipboard.writeText(status.webhook_url || '')
                    setMessage({ type: 'success', text: 'URL copiada para a área de transferência!' })
                    setTimeout(() => setMessage(null), 3000)
                  }}
                  title="Copiar URL"
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => window.open(status.webhook_url || '', '_blank')}
                  title="Abrir URL"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Copie esta URL e configure no painel do iFood em "Configurações de Integração" → "Webhooks"
              </p>
            </div>
          </CardContent>
          )}
        </Card>
      )}

      {/* Configuration Card */}
      <Card>
        <CardHeader 
          className="cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => setIsConfigCollapsed(!isConfigCollapsed)}
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <CardTitle>Configuração</CardTitle>
              <CardDescription>
                Configure suas credenciais do iFood. O client_secret será criptografado antes de ser armazenado.
              </CardDescription>
            </div>
            {isConfigCollapsed ? (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        </CardHeader>
        {!isConfigCollapsed && (
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="merchant_id">Merchant ID *</Label>
            <Input
              id="merchant_id"
              type="text"
              value={config.merchant_id}
              onChange={(e) => setConfig(prev => ({ ...prev, merchant_id: e.target.value }))}
              placeholder="ID do estabelecimento no iFood"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="client_id">Client ID *</Label>
            <Input
              id="client_id"
              type="text"
              value={config.client_id}
              onChange={(e) => setConfig(prev => ({ ...prev, client_id: e.target.value }))}
              placeholder="Client ID da API do iFood"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="client_secret">Client Secret *</Label>
            <Input
              id="client_secret"
              type="password"
              value={config.client_secret}
              onChange={(e) => setConfig(prev => ({ ...prev, client_secret: e.target.value }))}
              placeholder="Client Secret da API do iFood"
            />
            <p className="text-xs text-muted-foreground">
              Deixe em branco para manter o secret atual. Será criptografado antes de ser armazenado.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="authorization_code">Authorization Code (Código de Autorização)</Label>
            <Input
              id="authorization_code"
              type="text"
              value={config.authorization_code || ""}
              onChange={(e) => setConfig(prev => ({ ...prev, authorization_code: e.target.value }))}
              placeholder="Código de autorização do iFood (opcional)"
            />
            <p className="text-xs text-muted-foreground">
              Código de autorização fornecido pelo iFood durante o processo de integração OAuth.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="polling_interval">Intervalo de Polling (segundos)</Label>
            <Input
              id="polling_interval"
              type="number"
              min="10"
              max="300"
              value={config.polling_interval}
              onChange={(e) => setConfig(prev => ({ ...prev, polling_interval: parseInt(e.target.value) || 30 }))}
            />
            <p className="text-xs text-muted-foreground">
              Intervalo em segundos para verificar novos pedidos (mínimo: 10s, máximo: 300s)
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="is_active">Ativar Integração</Label>
              <p className="text-xs text-muted-foreground">
                Quando ativado, o sistema buscará pedidos automaticamente
              </p>
            </div>
            <Switch
              id="is_active"
              checked={config.is_active}
              onCheckedChange={(checked) => setConfig(prev => ({ ...prev, is_active: checked }))}
            />
          </div>

          <Button 
            onClick={handleSave} 
            disabled={saving}
            className="w-full"
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Salvando...' : 'Salvar Configuração'}
          </Button>
        </CardContent>
        )}
      </Card>

      {/* Product Mappings Card */}
      <Card>
        <CardHeader 
          className="cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => setIsMappingsCollapsed(!isMappingsCollapsed)}
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <CardTitle>Mapeamento de Produtos</CardTitle>
              <CardDescription>
                Produtos do iFood mapeados para produtos do sistema
              </CardDescription>
            </div>
            {isMappingsCollapsed ? (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        </CardHeader>
        {!isMappingsCollapsed && (
        <CardContent>
          {mappings.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum mapeamento encontrado. Os produtos serão mapeados automaticamente por SKU quando os pedidos chegarem.
            </p>
          ) : (
            <div className="space-y-4">
              {mappings.map((mapping) => (
                <div 
                  key={mapping.id} 
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">
                        {mapping.products?.name || `Produto ID: ${mapping.product_id}`}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      <span>iFood ID: {mapping.ifood_product_id}</span>
                      {mapping.ifood_sku && (
                        <span className="ml-4">SKU: {mapping.ifood_sku}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">
                      R$ {mapping.products?.price?.toFixed(2) || '0.00'}
                    </div>
                    {mapping.products?.sku && (
                      <div className="text-xs text-muted-foreground">
                        SKU: {mapping.products.sku}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
        )}
      </Card>
    </div>
  )
}

