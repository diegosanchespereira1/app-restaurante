import { useState, useEffect, useMemo, useRef } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Button } from "../components/ui/button"
import { Clock, CheckCircle, CreditCard, QrCode, Ticket, Wallet, Printer, MapPin, Phone, Info, ShoppingBag, X } from "lucide-react"
import { useRestaurant, type Order } from "../context/RestaurantContext"
import { useLanguage } from "../context/LanguageContext"
import { useSettings } from "../context/SettingsContext"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "../components/ui/dialog"
import { Label } from "../components/ui/label"
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group"
import { Input } from "../components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select"

import { formatCurrency, calculatePriceWithDiscount, validatePaymentDiscount } from "../lib/utils"
import { printReceipt } from "../lib/printer"
import { supabase, isSupabaseConfigured } from "../lib/supabase"
import type { Product } from "../types/product"
import { useAuth } from "../context/AuthContext"
import { IfoodOrderBadge } from "../components/ifood/IfoodOrderBadge"
import { getBackendUrl } from "../lib/backend-config"
import type { IfoodOrderAddress, IfoodOrderDetails, IfoodOrderItemOption } from "../types/ifood"

export function OrderDetails() {
    const { id } = useParams()
    const navigate = useNavigate()
    const { orders, updateOrderStatus, processPayment, menuItems, cancelUnpaidOrder, refreshData, isLoading } = useRestaurant()
    const { t } = useLanguage()
    const { printerSettings, settings } = useSettings()
    const { hasPermission } = useAuth()
    const [note, setNote] = useState("")
    const [isPaymentOpen, setIsPaymentOpen] = useState(false)
    const [isCancelOpen, setIsCancelOpen] = useState(false)
    const [cancelPassword, setCancelPassword] = useState("")
    const [cancellationReason, setCancellationReason] = useState<string>("")
    const [cancelError, setCancelError] = useState<string | null>(null)
    const [paymentMethod, setPaymentMethod] = useState<"Cash" | "Card" | "Voucher" | "PIX">("Cash")
    const [products, setProducts] = useState<Product[]>([])
    const [paymentDiscountType, setPaymentDiscountType] = useState<"fixed" | "percentage" | null>(null)
    const [paymentDiscountValue, setPaymentDiscountValue] = useState<number | null>(null)
    const [discountError, setDiscountError] = useState<string | null>(null)
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
    const [optimisticStatus, setOptimisticStatus] = useState<{ status: string; ifood_status?: string } | null>(null)
    const [isCheckingOrder, setIsCheckingOrder] = useState(true)
    const hasCheckedRef = useRef(false)
    const ordersRef = useRef(orders)
    const [ifoodDetails, setIfoodDetails] = useState<IfoodOrderDetails | null>(null)
    const [isLoadingIfoodDetails, setIsLoadingIfoodDetails] = useState(false)
    const [ifoodDetailsError, setIfoodDetailsError] = useState<string | null>(null)

    // Garantir que o topo fique visível ao abrir no mobile (layout usa container scrollável)
    useEffect(() => {
        if (typeof window === 'undefined') return

        const scrollContainer = document.querySelector<HTMLElement>('.mobile-content')
        if (scrollContainer) {
            scrollContainer.scrollTo({ top: 0, behavior: 'auto' })
        } else {
            window.scrollTo({ top: 0, behavior: 'auto' })
        }
    }, [id])

    // Manter referência dos pedidos atualizada para consultas após refreshData
    useEffect(() => {
        ordersRef.current = orders
    }, [orders])

    const baseOrder = orders.find(o => o.id === id)
    
    // Verificar se o pedido existe após os dados serem carregados
    useEffect(() => {
        // Se encontrou o pedido, não precisa verificar mais
        if (baseOrder) {
            setIsCheckingOrder(false)
            hasCheckedRef.current = false
            return
        }

        // Se ainda está carregando os dados, aguardar
        if (isLoading) {
            return
        }

        // Aguardar um pouco para garantir que os dados foram carregados
        // Isso evita verificação prematura quando o componente monta
        const timeout = setTimeout(() => {
            // Verificar novamente após o timeout
            const foundOrder = ordersRef.current.find(o => o.id === id)
            if (foundOrder) {
                setIsCheckingOrder(false)
                return
            }

            // Se ainda não encontrou e ainda não verificou, fazer verificação adicional
            if (hasCheckedRef.current) {
                return
            }

            const checkOrder = async () => {
                hasCheckedRef.current = true
                
                // Se não encontrou o pedido localmente, tentar atualizar os dados primeiro
                try {
                    await refreshData()
                    // Aguardar para os dados serem atualizados no estado
                    // O segundo useEffect vai verificar se o pedido foi encontrado após o refresh
                    await new Promise(resolve => setTimeout(resolve, 2000))
                } catch (error) {
                    console.error('Erro ao atualizar dados:', error)
                }

                // Verificar se o pedido foi encontrado após o refresh
                const refreshedOrder = ordersRef.current.find(o => o.id === id)
                if (refreshedOrder) {
                    setIsCheckingOrder(false)
                    hasCheckedRef.current = false
                    return
                }

                // Se ainda não encontrou após atualizar, tentar buscar informações do iFood
                let errorMessage = `Pedido não encontrado: ${id}`
                let statusDetails = null

                // Verificar se pode ser um pedido do iFood
                const backendUrl = getBackendUrl()
                try {
                    const statusResponse = await fetch(`${backendUrl}/api/ifood/order-status/${id}`)
                    if (statusResponse.ok) {
                        const statusData = await statusResponse.json()
                        if (statusData.success) {
                            statusDetails = {
                                status: statusData.status,
                                ifoodStatus: statusData.ifoodStatus,
                                statusMessage: statusData.statusMessage
                            }
                            errorMessage = `Pedido do iFood não encontrado no sistema.\n\n${statusData.statusMessage}\n\nStatus atual: ${statusData.status || 'Desconhecido'}`
                        }
                    }
                } catch (error) {
                    console.error('Erro ao buscar status do pedido no iFood:', error)
                }

                // Redirecionar para página principal com mensagem de erro
                navigate('/orders', {
                    state: {
                        error: errorMessage,
                        orderId: id,
                        statusDetails: statusDetails
                    },
                    replace: true
                })
            }

            checkOrder()
        }, 500) // Aguardar 500ms antes de verificar

        return () => clearTimeout(timeout)
    }, [id, baseOrder, navigate, refreshData, isLoading, orders])


    // Usar status otimista se estiver atualizando
    const displayOrder = optimisticStatus && baseOrder ? {
        ...baseOrder,
        status: optimisticStatus.status as Order["status"],
        ifood_status: optimisticStatus.ifood_status || baseOrder.ifood_status
    } : baseOrder
    const isIfoodOrder = !!(displayOrder?.source === 'ifood' && displayOrder?.ifood_order_id)

    // Buscar detalhes completos do pedido do iFood para exibir pagamento/entrega
    useEffect(() => {
        if (!displayOrder || displayOrder.source !== 'ifood' || !displayOrder.ifood_order_id) {
            setIfoodDetails(null)
            setIfoodDetailsError(null)
            setIsLoadingIfoodDetails(false)
            return
        }

        let cancelled = false
        const fetchDetails = async () => {
            setIsLoadingIfoodDetails(true)
            setIfoodDetailsError(null)

            try {
                const backendUrl = getBackendUrl()
                const response = await fetch(`${backendUrl}/api/ifood/order-details/${displayOrder.ifood_order_id}`)

                if (!response.ok) {
                    const message = `Erro ao buscar detalhes do iFood (${response.status})`
                    throw new Error(message)
                }

                const result = await response.json()
                if (cancelled) return

                if (result.success && result.order) {
                    setIfoodDetails(result.order as IfoodOrderDetails)
                } else {
                    setIfoodDetailsError(result.message || result.error || 'Não foi possível carregar os detalhes do iFood.')
                    setIfoodDetails(null)
                }
            } catch (error) {
                if (cancelled) return
                const message = error instanceof Error ? error.message : 'Falha ao buscar detalhes do iFood.'
                setIfoodDetailsError(message)
                setIfoodDetails(null)
            } finally {
                if (!cancelled) {
                    setIsLoadingIfoodDetails(false)
                }
            }
        }

        fetchDetails()

        return () => {
            cancelled = true
        }
    }, [displayOrder?.ifood_order_id, displayOrder?.source])
    
    // Buscar produtos completos para aplicar desconto
    useEffect(() => {
        if (!isSupabaseConfigured || !displayOrder) return

        const fetchProducts = async () => {
            const productIds = displayOrder.items.map(item => item.id).filter(id => id != null)
            
            if (productIds.length === 0) return

            const { data, error } = await supabase
                .from('products')
                .select('*')
                .in('id', productIds)

            if (!error && data) {
                setProducts(data)
            }
        }

        fetchProducts()
    }, [displayOrder, isSupabaseConfigured])

    // Calcular subtotal com desconto por método de pagamento
    const subtotalWithPaymentDiscount = useMemo(() => {
        if (!displayOrder) return 0
        
        let subtotal = 0
        
        for (const item of displayOrder.items) {
            const product = products.find(p => p.id === item.id)
            const menuItem = menuItems.find(m => m.id === item.id)
            
            const basePrice = item.price
            const discountType = product?.discount_type || menuItem?.discount_type
            const discountValue = product?.discount_value || menuItem?.discount_value
            const discountAppliesTo = product?.discount_applies_to || menuItem?.discount_applies_to
            
            const priceWithDiscount = calculatePriceWithDiscount(
                basePrice,
                discountType,
                discountValue,
                discountAppliesTo,
                paymentMethod
            )
            
            subtotal += priceWithDiscount * item.quantity
        }
        
        return subtotal
    }, [displayOrder, products, menuItems, paymentMethod])

    // Calcular subtotal antes do desconto no pagamento (com desconto do pedido aplicado)
    const subtotalBeforePaymentDiscount = useMemo(() => {
        if (!displayOrder) return 0
        
        let total = subtotalWithPaymentDiscount
        
        // Aplicar desconto do pedido se existir
        if (displayOrder.order_discount_type && displayOrder.order_discount_value !== null && displayOrder.order_discount_value !== undefined && displayOrder.order_discount_value > 0) {
            if (displayOrder.order_discount_type === 'fixed') {
                total = Math.max(0, total - displayOrder.order_discount_value)
            } else if (displayOrder.order_discount_type === 'percentage') {
                const discountAmount = (total * displayOrder.order_discount_value) / 100
                total = Math.max(0, total - discountAmount)
            }
        }
        
        return total
    }, [displayOrder, subtotalWithPaymentDiscount])

    // Calcular total com desconto aplicado (incluindo desconto do pedido e desconto no pagamento)
    const totalWithDiscount = useMemo(() => {
        if (!displayOrder) return 0
        
        let total = subtotalBeforePaymentDiscount
        
        // Aplicar desconto no pagamento se existir
        if (paymentDiscountType && paymentDiscountValue !== null && paymentDiscountValue > 0) {
            if (paymentDiscountType === 'fixed') {
                total = Math.max(0, total - paymentDiscountValue)
            } else if (paymentDiscountType === 'percentage') {
                const discountAmount = (total * paymentDiscountValue) / 100
                total = Math.max(0, total - discountAmount)
            }
        }
        
        return total
    }, [displayOrder, subtotalBeforePaymentDiscount, paymentDiscountType, paymentDiscountValue])

    const ifoodOrderAmount = useMemo(() => {
        if (!ifoodDetails) return null
        if (ifoodDetails.total?.orderAmount != null) return ifoodDetails.total.orderAmount
        if (ifoodDetails.totalPrice?.amount != null) return ifoodDetails.totalPrice.amount
        return null
    }, [ifoodDetails])

    const isIfoodPaid = useMemo(() => {
        if (!isIfoodOrder) return false
        const pending = ifoodDetails?.payments?.pending
        const prepaid = ifoodDetails?.payments?.prepaid
        const total = ifoodOrderAmount ?? displayOrder?.total ?? 0

        if (typeof pending === 'number') {
            return pending <= 0.01
        }

        if (typeof prepaid === 'number') {
            return prepaid >= total
        }

        return false
    }, [displayOrder?.total, ifoodDetails, ifoodOrderAmount, isIfoodOrder])

    type DisplayItem = {
        name: string
        quantity: number
        unitPrice: number
        totalPrice: number
        observations?: string
        options?: IfoodOrderItemOption[]
    }

    const displayItems: DisplayItem[] = useMemo(() => {
        if (ifoodDetails?.items?.length) {
            return ifoodDetails.items.map((item) => {
                const unitPrice = item.unitPrice ?? item.price ?? (item.totalPrice && item.quantity ? item.totalPrice / item.quantity : 0)
                const totalPrice = item.totalPrice ?? (unitPrice * item.quantity)
                return {
                    name: item.name,
                    quantity: item.quantity,
                    unitPrice,
                    totalPrice,
                    observations: item.observations,
                    options: item.options
                }
            })
        }

        if (baseOrder) {
            return baseOrder.items.map((item) => ({
                name: item.name,
                quantity: item.quantity,
                unitPrice: item.price,
                totalPrice: item.price * item.quantity
            }))
        }

        return []
    }, [ifoodDetails?.items, baseOrder])

    // Validar desconto quando o valor mudar
    useEffect(() => {
        if (paymentDiscountType && paymentDiscountValue !== null && paymentDiscountValue > 0 && baseOrder) {
            const validation = validatePaymentDiscount(
                paymentDiscountType,
                paymentDiscountValue,
                settings.paymentDiscountLimitType,
                settings.paymentDiscountLimitValue,
                subtotalBeforePaymentDiscount
            )
            
            if (!validation.isValid) {
                setDiscountError(validation.errorMessage || null)
            } else {
                setDiscountError(null)
            }
        } else {
            setDiscountError(null)
        }
    }, [paymentDiscountType, paymentDiscountValue, settings.paymentDiscountLimitType, settings.paymentDiscountLimitValue, subtotalBeforePaymentDiscount, baseOrder])

    // Função para obter o próximo status baseado no tipo de pedido
    const getNextStatus = (currentStatus: Order["status"], isIfoodOrder: boolean, currentIfoodStatus?: string | null) => {
        if (isIfoodOrder) {
            // Fluxo específico do iFood baseado no status atual do iFood
            if (!currentIfoodStatus) {
                // Se não tem status do iFood, usar fluxo padrão
                const flow = ["Pending", "Preparing", "Ready", "Delivered", "Closed"]
                const currentIndex = flow.indexOf(currentStatus)
                return flow[currentIndex + 1] as Order["status"] | undefined
            }
            
            // Mapear status do iFood para próximo status do sistema
            switch (currentIfoodStatus) {
                case 'PLACED':
                    return "Preparing" // CONFIRMED → PREPARATION_STARTED
                case 'CONFIRMED':
                    return "Preparing" // PREPARATION_STARTED
                case 'PREPARATION_STARTED':
                    return "Ready" // READY_TO_PICKUP
                case 'READY_TO_PICKUP':
                    return "Delivered" // DISPATCHED
                case 'DISPATCHED':
                    return "Closed" // CONCLUDED
                default:
                    // Fallback para fluxo padrão
                    const flow = ["Pending", "Preparing", "Ready", "Delivered", "Closed"]
                    const currentIndex = flow.indexOf(currentStatus)
                    return flow[currentIndex + 1] as Order["status"] | undefined
            }
        } else {
            // Fluxo padrão para pedidos manuais
            const flow = ["Pending", "Preparing", "Ready", "Delivered", "Closed"]
            const currentIndex = flow.indexOf(currentStatus)
            return flow[currentIndex + 1] as Order["status"] | undefined
        }
    }

    // Função para atualizar status do pedido do iFood através da API específica
    const updateIfoodOrderStatus = async (orderId: string, nextStatus: string, currentIfoodStatus?: string | null) => {
        if (!baseOrder) {
            return { success: false, error: 'Pedido não encontrado' }
        }
        const backendUrl = getBackendUrl()
        
        // Mapear status do sistema para ação do iFood
        let ifoodAction: string | null = null
        let needsConfirmation = false
        
        switch (nextStatus) {
            case 'Preparing':
                if (currentIfoodStatus === 'PLACED') {
                    // Se ainda não foi confirmado, confirmar primeiro
                    needsConfirmation = true
                    ifoodAction = 'start-preparation'
                } else if (currentIfoodStatus === 'CONFIRMED') {
                    // Já confirmado, apenas iniciar preparação
                    ifoodAction = 'start-preparation'
                } else {
                    // Outros status, iniciar preparação
                    ifoodAction = 'start-preparation'
                }
                break
            case 'Ready':
                ifoodAction = 'ready-to-pickup'
                break
            case 'Delivered':
                ifoodAction = 'dispatch'
                break
            case 'Closed':
                // Para fechar, não precisa chamar API do iFood, apenas atualizar no sistema
                // O status CONCLUDED será atualizado automaticamente quando o pedido for concluído
                // Mas vamos atualizar o status localmente
                return await updateOrderStatus(orderId, nextStatus as Order["status"])
        }
        
        // Se precisa confirmar primeiro (status PLACED)
        if (needsConfirmation && baseOrder.ifood_order_id) {
            try {
                console.log(`[updateIfoodOrderStatus] Confirming order ${baseOrder.ifood_order_id} first...`)
                const confirmResponse = await fetch(`${backendUrl}/api/ifood/accept-order/${baseOrder.ifood_order_id}`, {
                    method: 'POST'
                })
                
                if (!confirmResponse.ok) {
                    const errorText = await confirmResponse.text()
                    let errorData
                    try {
                        errorData = JSON.parse(errorText)
                    } catch {
                        errorData = { message: errorText }
                    }
                    console.error(`[updateIfoodOrderStatus] Confirm failed: ${confirmResponse.status} - ${errorText}`)
                    
                    // Se houver informação de status atual, mostrar mensagem mais útil
                    if (errorData.statusMessage) {
                        alert(`Não foi possível confirmar o pedido no iFood.\n\n${errorData.statusMessage}\n\nStatus atual: ${errorData.currentStatus || 'Desconhecido'}`)
                    } else {
                        alert(`Erro ao confirmar pedido no iFood: ${errorData.message || errorData.error || confirmResponse.status}`)
                    }
                    return { success: false, error: errorData.statusMessage || errorData.message || errorData.error || `Erro ao confirmar pedido: ${confirmResponse.status}` }
                }
                
                const confirmResult = await confirmResponse.json()
                if (!confirmResult.success) {
                    console.error(`[updateIfoodOrderStatus] Confirm failed:`, confirmResult)
                    
                    // Se houver informação de status atual, mostrar mensagem mais útil
                    if (confirmResult.statusMessage) {
                        alert(`Não foi possível confirmar o pedido no iFood.\n\n${confirmResult.statusMessage}\n\nStatus atual: ${confirmResult.currentStatus || 'Desconhecido'}`)
                    } else {
                        alert(`Erro ao confirmar pedido no iFood: ${confirmResult.error || confirmResult.message}`)
                    }
                    return { success: false, error: confirmResult.statusMessage || confirmResult.error || confirmResult.message }
                }
                
                console.log(`[updateIfoodOrderStatus] Order confirmed successfully`)
                
                // Aguardar mais tempo para garantir que a confirmação foi processada e o banco atualizado
                // O iFood pode retornar 202 (async), então precisamos aguardar
                await new Promise(resolve => setTimeout(resolve, 2000))
            } catch (error) {
                console.error('[updateIfoodOrderStatus] Erro ao confirmar pedido:', error)
                // Tentar buscar status atual do pedido para mostrar informação útil
                try {
                    const statusResponse = await fetch(`${backendUrl}/api/ifood/order-status/${baseOrder.ifood_order_id}`)
                    if (statusResponse.ok) {
                        const statusData = await statusResponse.json()
                        if (statusData.success && statusData.statusMessage) {
                            alert(`Erro ao confirmar pedido no iFood.\n\n${statusData.statusMessage}\n\nStatus atual: ${statusData.status || 'Desconhecido'}`)
                            return { success: false, error: statusData.statusMessage }
                        }
                    }
                } catch (statusError) {
                    console.error('[updateIfoodOrderStatus] Erro ao buscar status do pedido:', statusError)
                }
                alert(`Erro ao confirmar pedido no iFood`)
                return { success: false, error: 'Erro ao confirmar pedido no iFood' }
            }
        }
        
        // Se há ação específica do iFood, chamar o endpoint correspondente
        if (ifoodAction && baseOrder.ifood_order_id) {
            try {
                let endpoint = ''
                switch (ifoodAction) {
                    case 'start-preparation':
                        endpoint = `${backendUrl}/api/ifood/start-preparation/${baseOrder.ifood_order_id}`
                        break
                    case 'ready-to-pickup':
                        endpoint = `${backendUrl}/api/ifood/ready-to-pickup/${baseOrder.ifood_order_id}`
                        break
                    case 'dispatch':
                        endpoint = `${backendUrl}/api/ifood/dispatch-order/${baseOrder.ifood_order_id}`
                        break
                }
                
                if (endpoint) {
                    console.log(`[updateIfoodOrderStatus] Calling endpoint: ${endpoint}`)
                    const response = await fetch(endpoint, {
                        method: 'POST'
                    })
                    
                    if (!response.ok) {
                        const errorText = await response.text()
                        console.error(`[updateIfoodOrderStatus] Endpoint failed: ${response.status} - ${errorText}`)
                        
                        let errorData
                        try {
                            errorData = JSON.parse(errorText)
                        } catch {
                            errorData = { message: errorText }
                        }
                        
                        // Se houver informação de status atual, mostrar mensagem mais útil
                        if (errorData.statusMessage) {
                            alert(`Não foi possível atualizar o status do pedido no iFood.\n\n${errorData.statusMessage}\n\nStatus atual: ${errorData.currentStatus || 'Desconhecido'}`)
                        } else {
                            alert(`Erro ao atualizar status no iFood: ${response.status}`)
                        }
                        return { success: false, error: errorData.statusMessage || `Erro ao atualizar status: ${response.status}` }
                    }
                    
                    const result = await response.json()
                    
                    if (!result.success) {
                        console.error(`[updateIfoodOrderStatus] Endpoint returned error:`, result)
                        
                        // Se houver informação de status atual, mostrar mensagem mais útil
                        if (result.statusMessage) {
                            alert(`Não foi possível atualizar o status do pedido no iFood.\n\n${result.statusMessage}\n\nStatus atual: ${result.currentStatus || 'Desconhecido'}`)
                        } else {
                            alert(`Erro ao atualizar status no iFood: ${result.error || result.message}`)
                        }
                        return { success: false, error: result.statusMessage || result.error || result.message }
                    }
                    
                    console.log(`[updateIfoodOrderStatus] Status updated successfully via endpoint`)
                    
                    // Os endpoints do backend já atualizam o banco de dados
                    // Não precisamos chamar updateOrderStatus novamente para evitar conflito
                    // O real-time subscription do Supabase deve atualizar automaticamente
                    return { success: true }
                }
            } catch (error) {
                console.error('[updateIfoodOrderStatus] Erro ao atualizar status no iFood:', error)
                // Tentar buscar status atual do pedido para mostrar informação útil
                try {
                    const statusResponse = await fetch(`${backendUrl}/api/ifood/order-status/${baseOrder.ifood_order_id}`)
                    if (statusResponse.ok) {
                        const statusData = await statusResponse.json()
                        if (statusData.success && statusData.statusMessage) {
                            alert(`Erro ao atualizar status no iFood.\n\n${statusData.statusMessage}\n\nStatus atual: ${statusData.status || 'Desconhecido'}`)
                            return { success: false, error: statusData.statusMessage }
                        }
                    }
                } catch (statusError) {
                    console.error('[updateIfoodOrderStatus] Erro ao buscar status do pedido:', statusError)
                }
                alert(`Erro ao atualizar status no iFood`)
                return { success: false, error: 'Erro ao atualizar status no iFood' }
            }
        }
        
        return { success: true }
    }

    const handleStatusUpdate = async () => {
        if (isUpdatingStatus || !displayOrder) {
            return
        }
        
        const isIfoodOrder = !!(displayOrder.source === 'ifood' && displayOrder.ifood_order_id)
        const nextStatus = getNextStatus(displayOrder.status, isIfoodOrder, displayOrder.ifood_status)
        
        if (!nextStatus) {
            return
        }
        
        setIsUpdatingStatus(true)
        
        // Atualização otimista - atualizar status imediatamente na UI
        let optimisticIfoodStatus = displayOrder.ifood_status
        if (isIfoodOrder) {
            switch (nextStatus) {
                case 'Preparing':
                    if (displayOrder.ifood_status === 'PLACED') {
                        optimisticIfoodStatus = 'CONFIRMED'
                    } else {
                        optimisticIfoodStatus = 'PREPARATION_STARTED'
                    }
                    break
                case 'Ready':
                    optimisticIfoodStatus = 'READY_TO_PICKUP'
                    break
                case 'Delivered':
                    optimisticIfoodStatus = 'DISPATCHED'
                    break
                case 'Closed':
                    optimisticIfoodStatus = 'CONCLUDED'
                    break
            }
        }
        
        setOptimisticStatus({
            status: nextStatus,
            ifood_status: optimisticIfoodStatus || undefined
        })
        
        try {
            if (isIfoodOrder) {
                // Usar fluxo específico do iFood
                const result = await updateIfoodOrderStatus(displayOrder.id, nextStatus, displayOrder.ifood_status)
                if (!result.success) {
                    // Reverter atualização otimista em caso de erro
                    setOptimisticStatus(null)
                    setIsUpdatingStatus(false)
                    alert(`Falha ao atualizar status: ${result.error}`)
                    return
                }
                
                // Os endpoints do backend já atualizam o banco de dados
                // Aguardar um pouco para garantir que a atualização foi processada
                // e então recarregar a página para mostrar o novo status
                setTimeout(() => {
                    window.location.reload()
                }, 1500)
            } else {
                // Usar fluxo padrão
                const result = await updateOrderStatus(displayOrder.id, nextStatus)
                if (!result.success) {
                    // Reverter atualização otimista em caso de erro
                    setOptimisticStatus(null)
                    setIsUpdatingStatus(false)
                    alert(`Falha ao atualizar status: ${result.error}`)
                    return
                }
                
                // Atualização bem-sucedida, limpar status otimista após um tempo
                setTimeout(() => {
                    setOptimisticStatus(null)
                    setIsUpdatingStatus(false)
                }, 1000)
            }
        } catch (error) {
            // Reverter atualização otimista em caso de erro
            setOptimisticStatus(null)
            setIsUpdatingStatus(false)
            alert(`Erro ao atualizar status: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
        }
    }

    const handlePayment = async () => {
        // Validar desconto antes de processar o pagamento
        if (paymentDiscountType && paymentDiscountValue !== null && paymentDiscountValue > 0 && baseOrder) {
            const validation = validatePaymentDiscount(
                paymentDiscountType,
                paymentDiscountValue,
                settings.paymentDiscountLimitType,
                settings.paymentDiscountLimitValue,
                subtotalBeforePaymentDiscount
            )
            
            if (!validation.isValid) {
                alert(validation.errorMessage || 'Limite de desconto maior do que o permitido.')
                return
            }
        }

        if (!baseOrder) return

        const result = await processPayment(baseOrder.id, paymentMethod)
        if (result.success) {
            setIsPaymentOpen(false)
        } else {
            alert(`Failed to process payment: ${result.error}`)
        }
    }

    const handleCancel = async () => {
        if (!baseOrder) return
        
        if (!cancelPassword) {
            setCancelError("Por favor, insira a senha de admin/gerente")
            return
        }

        if (!cancellationReason) {
            setCancelError("Por favor, selecione uma justificativa para o cancelamento")
            return
        }

        setCancelError(null)
        const result = await cancelUnpaidOrder(baseOrder.id, cancelPassword, cancellationReason)
        
        if (result.success) {
            setIsCancelOpen(false)
            setCancelPassword("")
            setCancellationReason("")
            navigate("/orders")
        } else {
            setCancelError(result.error || "Erro ao cancelar pedido")
        }
    }

    const handlePrint = async () => {
        if (!baseOrder) return

        if (printerSettings.enabled) {
            // Usa o módulo de impressão configurado
            const printData = {
                orderId: baseOrder.id,
                customer: baseOrder.customer,
                table: baseOrder.table,
                orderType: baseOrder.orderType,
                items: baseOrder.items.map(item => ({
                    name: item.name,
                    quantity: item.quantity,
                    price: item.price
                })),
                subtotal: baseOrder.total,
                total: baseOrder.total,
                paymentMethod: baseOrder.paymentMethod,
                notes: note || undefined,
                date: new Date().toLocaleDateString('pt-BR'),
                time: baseOrder.time || new Date().toLocaleTimeString('pt-BR')
            }
            
            const success = await printReceipt(printData, printerSettings)
            if (!success) {
                alert('Erro ao imprimir recibo. Verifique as configurações da impressora.')
            }
        } else {
            // Fallback para impressão padrão do navegador
            window.print()
        }
    }

    const getStatusColor = (status: Order["status"]) => {
        switch (status) {
            case "Pending": return "bg-orange-500"
            case "Preparing": return "bg-blue-500"
            case "Ready": return "bg-green-500"
            case "Delivered": return "bg-purple-500"
            case "Closed": return "bg-gray-500"
            case "Cancelled": return "bg-red-500"
            default: return "bg-gray-500"
        }
    }
    
    const getStatusLabel = (status: Order["status"], ifoodStatus?: string | null) => {
        if (displayOrder?.source === 'ifood' && ifoodStatus) {
            switch (ifoodStatus) {
                case 'PLACED': return 'Aguardando Confirmação'
                case 'CONFIRMED': return 'Confirmado'
                case 'PREPARATION_STARTED': return 'Em Preparação'
                case 'READY_TO_PICKUP': return 'Pronto para Retirada'
                case 'DISPATCHED': return 'Despachado'
                case 'CONCLUDED': return 'Concluído'
                case 'CANCELLED': return 'Cancelado'
                default: return status
            }
        }
        
        switch (status) {
            case "Pending": return "Pendente"
            case "Preparing": return "Em Preparação"
            case "Ready": return "Pronto"
            case "Delivered": return "Entregue"
            case "Closed": return "Fechado"
            case "Cancelled": return "Cancelado"
            default: return status
        }
    }

    const getStatusIcon = (status: Order["status"]) => {
        switch (status) {
            case "Ready": 
            case "Delivered": 
            case "Closed": return <CheckCircle className="h-6 w-6 text-white" />
            default: return <Clock className="h-6 w-6 text-white" />
        }
    }

    const getPaymentMethodIcon = (method: "Cash" | "Card" | "Voucher" | "PIX", className: string = "h-4 w-4") => {
        switch (method) {
            case 'Cash': return <Wallet className={className} />
            case 'Card': return <CreditCard className={className} />
            case 'Voucher': return <Ticket className={className} />
            case 'PIX': return <QrCode className={className} />
        }
    }

    const formatPaymentMethodLabel = (method?: string) => {
        if (!method) return 'Método não informado'
        switch (method.toUpperCase()) {
            case 'CREDIT': return 'Cartão de crédito'
            case 'DEBIT': return 'Cartão de débito'
            case 'PIX': return 'Pix'
            case 'CASH': return 'Dinheiro'
            case 'VOUCHER': return 'Voucher'
            default: return method
        }
    }

    const formatIfoodAddress = (address?: IfoodOrderAddress | null) => {
        if (!address) return ''
        const street = address.streetName || address.street || ''
        const number = address.streetNumber || address.number || ''
        const parts = [
            [street, number].filter(Boolean).join(', '),
            address.neighborhood,
            [address.city, address.state].filter(Boolean).join(' - '),
            address.postalCode || address.zipCode
        ].filter(Boolean)
        return parts.join(' | ')
    }

    // Mostrar loading enquanto verifica o pedido
    if (isCheckingOrder) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Verificando pedido...</p>
                </div>
            </div>
        )
    }
    
    // Garantir que displayOrder existe antes de usar
    if (!displayOrder) {
        return null // O useEffect já vai redirecionar
    }
    const order = displayOrder

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8">
            {/* BEGIN: MainHeader */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                {/* Header Left: Title and Metadata */}
                <div className="w-full space-y-3">
                    <div className="flex items-center flex-wrap gap-3">
                        {/* Back arrow icon */}
                        <button 
                            className="text-gray-500 hover:text-gray-800 text-2xl" 
                            onClick={() => navigate("/orders")}
                        >
                            ←
                        </button>
                        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 font-extrabold">
                            {t("orderId")}: {displayOrder && (displayOrder.source === 'ifood' && displayOrder.ifood_display_id 
                                ? displayOrder.ifood_display_id 
                                : displayOrder.id)}
                        </h1>
                        {displayOrder.source === 'ifood' && (
                            <IfoodOrderBadge ifoodStatus={displayOrder.ifood_status} />
                        )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 md:ml-10">
                        <div className="flex items-center gap-1.5">
                            <Clock className="h-4 w-4" />
                            <span>{order.time}</span>
                        </div>
                        <span className="hidden sm:inline">•</span>
                        <span>{order.table ? `${t("table")} ${order.table}` : (order.orderType ? t(order.orderType === 'dine_in' ? 'dineIn' : order.orderType) : t('dineIn'))}</span>
                        <span className="hidden sm:inline">•</span>
                        <span>{t("customer")}: {order.customer}</span>
                        {displayOrder.status === "Closed" && displayOrder.paymentMethod && (
                            <>
                                <span className="hidden sm:inline">•</span>
                                <div className="flex items-center gap-1.5">
                                    {getPaymentMethodIcon(displayOrder.paymentMethod)}
                                    <span>{t("paymentMethod")}: {t(displayOrder.paymentMethod.toLowerCase() as any)}</span>
                                </div>
                            </>
                        )}
                    </div>
                </div>
                {/* Header Right: Action Buttons */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mt-2 md:mt-0 w-full md:w-auto">
                    <Button 
                        variant="outline" 
                        onClick={handlePrint}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 hover:bg-gray-200 text-gray-700 border-gray-200 bg-gray-100"
                    >
                        <Printer className="h-5 w-5" />
                        {t("printReceipt")}
                    </Button>
                    {displayOrder && displayOrder.status !== "Closed" && displayOrder.status !== "Cancelled" && (
                        <>
                            {(() => {
                                const isIfoodOrder = !!(displayOrder.source === 'ifood' && displayOrder.ifood_order_id)
                                const currentStatus = displayOrder.status
                                const currentIfoodStatus = displayOrder.ifood_status
                                const nextStatus = getNextStatus(currentStatus, isIfoodOrder, currentIfoodStatus)
                                
                                // Para pedidos do iFood, verificar status específico do iFood
                                if (isIfoodOrder) {
                                    // Não mostrar botão se já está em DISPATCHED ou CONCLUDED
                                    if (currentIfoodStatus === 'DISPATCHED' || currentIfoodStatus === 'CONCLUDED') {
                                        return null
                                    }
                                } else {
                                    // Para pedidos manuais, não mostrar se está Delivered
                                    if (currentStatus === "Delivered") {
                                        return null
                                    }
                                }
                                
                                if (!nextStatus) {
                                    return null
                                }
                                
                                // Mapear próximo status para texto amigável
                                let statusLabel: string = nextStatus
                                let buttonColor = "bg-orange-500 hover:bg-orange-600"
                                
                                if (isIfoodOrder && currentIfoodStatus) {
                                    switch (nextStatus) {
                                        case 'Preparing':
                                            if (currentIfoodStatus === 'PLACED') {
                                                statusLabel = 'Confirmar e Iniciar Preparação'
                                                buttonColor = "bg-blue-500 hover:bg-blue-600"
                                            } else {
                                                statusLabel = 'Iniciar Preparação'
                                                buttonColor = "bg-indigo-500 hover:bg-indigo-600"
                                            }
                                            break
                                        case 'Ready':
                                            statusLabel = 'Marcar como Pronto para Retirada'
                                            buttonColor = "bg-green-500 hover:bg-green-600"
                                            break
                                        case 'Delivered':
                                            statusLabel = 'Despachar Pedido'
                                            buttonColor = "bg-purple-500 hover:bg-purple-600"
                                            break
                                        case 'Closed':
                                            statusLabel = 'Concluir Pedido'
                                            buttonColor = "bg-gray-500 hover:bg-gray-600"
                                            break
                                    }
                                } else {
                                    // Cores diferentes para pedidos manuais também
                                    switch (nextStatus) {
                                        case 'Preparing':
                                            buttonColor = "bg-blue-500 hover:bg-blue-600"
                                            break
                                        case 'Ready':
                                            buttonColor = "bg-green-500 hover:bg-green-600"
                                            break
                                        case 'Delivered':
                                            buttonColor = "bg-purple-500 hover:bg-purple-600"
                                            break
                                        case 'Closed':
                                            buttonColor = "bg-gray-500 hover:bg-gray-600"
                                            break
                                    }
                                }
                                
                                return (
                                    <Button 
                                        onClick={handleStatusUpdate}
                                        disabled={isUpdatingStatus}
                                        className={`flex-1 md:flex-none ${buttonColor} text-white ${isUpdatingStatus ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        {isUpdatingStatus ? (
                                            <>
                                                <Clock className="h-4 w-4 mr-2 animate-spin" />
                                                Atualizando...
                                            </>
                                        ) : (
                                            statusLabel
                                        )}
                                    </Button>
                                )
                            })()}
                            {hasPermission(['admin', 'gerente']) && (
                                <Dialog open={isCancelOpen} onOpenChange={setIsCancelOpen}>
                                    <DialogTrigger asChild>
                                        <Button className="flex-1 md:flex-none bg-red-600 hover:bg-red-700 text-white">
                                            <X className="h-4 w-4 mr-2" />
                                            {t("cancelOrder")}
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>{t("cancelOrderConfirmation")}</DialogTitle>
                                            <DialogDescription>
                                                {t("cancelOrderDescription") || "Esta ação não pode ser desfeita. O estoque será devolvido automaticamente."}
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div className="grid gap-4 py-4">
                                            <div className="space-y-2">
                                                <Label>{t("enterManagerPassword")}</Label>
                                                <Input
                                                    type="password"
                                                    value={cancelPassword}
                                                    onChange={(e) => {
                                                        setCancelPassword(e.target.value)
                                                        setCancelError(null)
                                                    }}
                                                    placeholder={t("enterManagerPassword")}
                                                    className={cancelError ? 'border-red-500' : ''}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>{t("cancellationReason")}</Label>
                                                <Select
                                                    value={cancellationReason}
                                                    onValueChange={(value) => {
                                                        setCancellationReason(value)
                                                        setCancelError(null)
                                                    }}
                                                >
                                                    <SelectTrigger className={cancelError && !cancellationReason ? 'border-red-500' : ''}>
                                                        <SelectValue placeholder={t("selectCancellationReason") || "Selecione uma justificativa"} />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="cliente desistiu">Cliente desistiu</SelectItem>
                                                        <SelectItem value="problema no pagamento do cliente">Problema no pagamento do cliente</SelectItem>
                                                        <SelectItem value="mercadoria danificada">Mercadoria danificada</SelectItem>
                                                        <SelectItem value="sem estoque">Sem estoque</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            {cancelError && (
                                                <div className="text-sm text-red-600 mt-1">
                                                    {cancelError}
                                                </div>
                                            )}
                                        </div>
                                        <DialogFooter>
                                            <Button variant="outline" onClick={() => {
                                                setIsCancelOpen(false)
                                                setCancelPassword("")
                                                setCancellationReason("")
                                                setCancelError(null)
                                            }}>
                                                {t("cancel") || "Cancelar"}
                                            </Button>
                                            <Button onClick={handleCancel} className="bg-red-600 hover:bg-red-700">
                                                {t("confirmCancel") || "Confirmar Cancelamento"}
                                            </Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            )}
                            {!(isIfoodOrder && isIfoodPaid) && (
                                <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
                                    <DialogTrigger asChild>
                                        <Button className="flex-1 md:flex-none bg-orange-600 hover:bg-orange-700 text-white">
                                            {t("payNow")}
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>{t("confirmPayment")}</DialogTitle>
                                            <DialogDescription>
                                                {t("selectPaymentMethod")} {formatCurrency(totalWithDiscount)}.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div className="grid gap-4 py-4">
                                            <div className="space-y-2">
                                                <Label>{t("paymentMethod")}</Label>
                                                <RadioGroup
                                                    value={paymentMethod}
                                                    onValueChange={(value: "Cash" | "Card" | "Voucher" | "PIX") => setPaymentMethod(value)}
                                                    className="grid grid-cols-2 gap-4"
                                                >
                                                    <div>
                                                        <RadioGroupItem value="Cash" id="cash" className="peer sr-only" />
                                                        <Label
                                                            htmlFor="cash"
                                                            className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-orange-600 peer-data-[state=checked]:bg-orange-50 peer-data-[state=checked]:text-orange-900 peer-data-[state=checked]:shadow-md [&:has([data-state=checked])]:border-orange-600 [&:has([data-state=checked])]:bg-orange-50 [&:has([data-state=checked])]:text-orange-900 [&:has([data-state=checked])]:shadow-md"
                                                        >
                                                            <Wallet className="mb-3 h-6 w-6" />
                                                            {t("cash")}
                                                        </Label>
                                                    </div>
                                                    <div>
                                                        <RadioGroupItem value="Card" id="card" className="peer sr-only" />
                                                        <Label
                                                            htmlFor="card"
                                                            className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-orange-600 peer-data-[state=checked]:bg-orange-50 peer-data-[state=checked]:text-orange-900 peer-data-[state=checked]:shadow-md [&:has([data-state=checked])]:border-orange-600 [&:has([data-state=checked])]:bg-orange-50 [&:has([data-state=checked])]:text-orange-900 [&:has([data-state=checked])]:shadow-md"
                                                        >
                                                            <CreditCard className="mb-3 h-6 w-6" />
                                                            {t("card")}
                                                        </Label>
                                                    </div>
                                                    <div>
                                                        <RadioGroupItem value="Voucher" id="voucher" className="peer sr-only" />
                                                        <Label
                                                            htmlFor="voucher"
                                                            className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-orange-600 peer-data-[state=checked]:bg-orange-50 peer-data-[state=checked]:text-orange-900 peer-data-[state=checked]:shadow-md [&:has([data-state=checked])]:border-orange-600 [&:has([data-state=checked])]:bg-orange-50 [&:has([data-state=checked])]:text-orange-900 [&:has([data-state=checked])]:shadow-md"
                                                        >
                                                            <Ticket className="mb-3 h-6 w-6" />
                                                            {t("voucher")}
                                                        </Label>
                                                    </div>
                                                    <div>
                                                        <RadioGroupItem value="PIX" id="pix" className="peer sr-only" />
                                                        <Label
                                                            htmlFor="pix"
                                                            className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-orange-600 peer-data-[state=checked]:bg-orange-50 peer-data-[state=checked]:text-orange-900 peer-data-[state=checked]:shadow-md [&:has([data-state=checked])]:border-orange-600 [&:has([data-state=checked])]:bg-orange-50 [&:has([data-state=checked])]:text-orange-900 [&:has([data-state=checked])]:shadow-md"
                                                        >
                                                            <QrCode className="mb-3 h-6 w-6" />
                                                            {t("pix")}
                                                        </Label>
                                                    </div>
                                                </RadioGroup>
                                            </div>

                                            {/* Campo de Desconto no Pagamento */}
                                            <div className="space-y-2">
                                                <Label>Desconto no Pagamento</Label>
                                                <div className="flex gap-2">
                                                    <Select
                                                        value={paymentDiscountType || 'none'}
                                                        onValueChange={(value) => {
                                                            if (value === 'none') {
                                                                setPaymentDiscountType(null)
                                                                setPaymentDiscountValue(null)
                                                                setDiscountError(null)
                                                            } else {
                                                                setPaymentDiscountType(value as "fixed" | "percentage")
                                                                if (paymentDiscountValue === null) {
                                                                    setPaymentDiscountValue(0)
                                                                }
                                                                // Validar se já há valor definido
                                                                if (paymentDiscountValue !== null && paymentDiscountValue > 0 && order) {
                                                                    const validation = validatePaymentDiscount(
                                                                        value as "fixed" | "percentage",
                                                                        paymentDiscountValue,
                                                                        settings.paymentDiscountLimitType,
                                                                        settings.paymentDiscountLimitValue,
                                                                        subtotalBeforePaymentDiscount
                                                                    )
                                                                    setDiscountError(validation.isValid ? null : (validation.errorMessage || null))
                                                                }
                                                            }
                                                        }}
                                                    >
                                                        <SelectTrigger className="flex-1">
                                                            <SelectValue placeholder="Tipo" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="none">Sem desconto</SelectItem>
                                                            <SelectItem value="fixed">Valor fixo (R$)</SelectItem>
                                                            <SelectItem value="percentage">Percentual (%)</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    {paymentDiscountType && (
                                                        <Input
                                                            type="number"
                                                            step={paymentDiscountType === 'fixed' ? "0.01" : "0.1"}
                                                            min="0"
                                                            max={paymentDiscountType === 'percentage' ? "100" : undefined}
                                                            value={paymentDiscountValue || ''}
                                                            onChange={(e) => {
                                                                const value = e.target.value
                                                                const numValue = value ? parseFloat(value) : null
                                                                setPaymentDiscountValue(numValue)
                                                                
                                                                // Validação em tempo real
                                                                if (numValue !== null && numValue > 0 && order) {
                                                                    const validation = validatePaymentDiscount(
                                                                        paymentDiscountType,
                                                                        numValue,
                                                                        settings.paymentDiscountLimitType,
                                                                        settings.paymentDiscountLimitValue,
                                                                        subtotalBeforePaymentDiscount
                                                                    )
                                                                    setDiscountError(validation.isValid ? null : (validation.errorMessage || null))
                                                                } else {
                                                                    setDiscountError(null)
                                                                }
                                                            }}
                                                            placeholder={paymentDiscountType === 'fixed' ? "0.00" : "0"}
                                                            className={`flex-1 ${discountError ? 'border-red-500' : ''}`}
                                                        />
                                                    )}
                                                </div>
                                                {discountError && (
                                                    <div className="text-sm text-red-600 mt-1">
                                                        {discountError}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Resumo de valores */}
                                            <div className="space-y-2 pt-2 border-t">
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-muted-foreground">Subtotal:</span>
                                                    <span>{formatCurrency(subtotalWithPaymentDiscount)}</span>
                                                </div>
                                                {order.order_discount_type && order.order_discount_value !== null && order.order_discount_value !== undefined && order.order_discount_value > 0 && (
                                                    <div className="flex justify-between text-sm text-green-600">
                                                        <span>Desconto do Pedido:</span>
                                                        <span>
                                                            {order.order_discount_type === 'fixed' 
                                                                ? `-${formatCurrency(order.order_discount_value)}`
                                                                : `-${formatCurrency((subtotalWithPaymentDiscount * order.order_discount_value) / 100)}`
                                                            }
                                                        </span>
                                                    </div>
                                                )}
                                                {paymentDiscountType && paymentDiscountValue !== null && paymentDiscountValue > 0 && (
                                                    <div className="flex justify-between text-sm text-green-600">
                                                        <span>Desconto no Pagamento:</span>
                                                        <span>
                                                            {paymentDiscountType === 'fixed' 
                                                                ? `-${formatCurrency(paymentDiscountValue)}`
                                                                : `-${formatCurrency((subtotalBeforePaymentDiscount * paymentDiscountValue) / 100)}`
                                                            }
                                                        </span>
                                                    </div>
                                                )}
                                                <div className="flex justify-between font-bold pt-2 border-t">
                                                    <span>Total:</span>
                                                    {(() => {
                                                        const hasDiscount = totalWithDiscount < subtotalBeforePaymentDiscount
                                                        return hasDiscount ? (
                                                            <div className="flex flex-col items-end">
                                                                <span className="line-through text-muted-foreground text-sm">
                                                                    {formatCurrency(subtotalBeforePaymentDiscount)}
                                                                </span>
                                                                <span className="text-green-600 text-lg">
                                                                    {formatCurrency(totalWithDiscount)}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <span>{formatCurrency(totalWithDiscount)}</span>
                                                        )
                                                    })()}
                                                </div>
                                            </div>
                                        </div>
                                        <DialogFooter>
                                            <Button onClick={handlePayment}>{t("confirmPayment")}</Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            )}
                        </>
                    )}
                </div>
            </header>
            {/* END: MainHeader */}

            {/* BEGIN: MainContent */}
            <main className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Summary Cards */}
                <div className="lg:col-span-1 flex flex-col space-y-6">
                    {/* Total Value Card - PROMINENT */}
                    <section className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
                        <h2 className="text-base font-medium text-gray-700 mb-1">{t("total")}</h2>
                        {(() => {
                            const hasDiscount = totalWithDiscount < order.total
                            return hasDiscount ? (
                                <div className="flex flex-col">
                                    <span className="line-through text-muted-foreground text-xl">
                                        {formatCurrency(order.total)}
                                    </span>
                                    <span className="text-4xl font-bold text-green-600">
                                        {formatCurrency(totalWithDiscount)}
                                    </span>
                                </div>
                            ) : (
                                <p className="text-4xl font-bold text-gray-900">{formatCurrency(order.total)}</p>
                            )
                        })()}
                    </section>

                    {/* Order Status Card */}
                    <section className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
                        <h3 className="text-base font-medium text-gray-700 mb-3">{t("status")} {t("orderType")}</h3>
                        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg font-semibold text-base text-white transition-all duration-300 ${getStatusColor(displayOrder.status)} ${isUpdatingStatus ? 'animate-pulse' : ''}`}>
                            {isUpdatingStatus ? (
                                <>
                                    <Clock className="h-6 w-6 text-white animate-spin" />
                                    <span>Atualizando...</span>
                                </>
                            ) : (
                                <>
                                    {getStatusIcon(displayOrder.status)}
                                    <span>{getStatusLabel(displayOrder.status, displayOrder.ifood_status)}</span>
                                </>
                            )}
                        </div>
                        {displayOrder.status === "Closed" && displayOrder.paymentMethod && (
                            <div className="mt-4 pt-4 border-t border-gray-200">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-gray-700">{t("paymentMethod")}:</span>
                                    <div className="flex items-center gap-2">
                                        {getPaymentMethodIcon(displayOrder.paymentMethod, "h-4 w-4 text-gray-600")}
                                        <span className="text-sm font-semibold text-gray-900">{t(displayOrder.paymentMethod.toLowerCase() as any)}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </section>

                    {/* Order Summary Card */}
                    <section className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
                        <h3 className="text-base font-medium text-gray-700 mb-4">{t("orderSummary")}</h3>
                        <div className="space-y-2 text-sm text-gray-600 mb-4">
                            <div className="flex justify-between">
                                <span>{t("subtotal")}</span>
                                <span>{formatCurrency(order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0))}</span>
                            </div>
                            {/* Desconto do pedido se existir */}
                            {order.order_discount_type && order.order_discount_value !== null && order.order_discount_value !== undefined && order.order_discount_value > 0 && (
                                <div className="flex justify-between text-green-600">
                                    <span>Desconto do Pedido:</span>
                                    <span>
                                        {order.order_discount_type === 'fixed' 
                                            ? `-${formatCurrency(order.order_discount_value || 0)}`
                                            : `-${formatCurrency((order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0) * (order.order_discount_value || 0)) / 100)}`
                                        }
                                    </span>
                                </div>
                            )}
                            {/* Desconto por método de pagamento */}
                            {(() => {
                                const subtotal = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0)
                                const orderDiscount = order.order_discount_type && order.order_discount_value !== null && order.order_discount_value !== undefined && order.order_discount_value > 0
                                    ? (order.order_discount_type === 'fixed' 
                                        ? order.order_discount_value 
                                        : (subtotal * order.order_discount_value) / 100)
                                    : 0
                                const subtotalAfterOrderDiscount = subtotal - orderDiscount
                                const hasPaymentDiscount = totalWithDiscount < subtotalAfterOrderDiscount
                                
                                if (hasPaymentDiscount) {
                                    return (
                                        <div className="flex justify-between text-green-600">
                                            <span>Desconto por Pagamento:</span>
                                            <span>-{formatCurrency(subtotalAfterOrderDiscount - totalWithDiscount)}</span>
                                        </div>
                                    )
                                }
                                return null
                            })()}
                            <div className="flex justify-between font-bold pt-2 border-t">
                                <span>{t("total")}:</span>
                                {(() => {
                                    const hasDiscount = totalWithDiscount < order.total
                                    return hasDiscount ? (
                                        <div className="flex flex-col items-end">
                                            <span className="line-through text-muted-foreground text-sm">
                                                {formatCurrency(order.total)}
                                            </span>
                                            <span className="text-green-600">{formatCurrency(totalWithDiscount)}</span>
                                        </div>
                                    ) : (
                                        <span>{formatCurrency(order.total)}</span>
                                    )
                                })()}
                            </div>
                        </div>
                        {order.status === "Closed" && order.paymentMethod && (
                            <div className="mt-4 pt-4 border-t border-gray-200">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-gray-700">{t("paymentMethod")}:</span>
                                    <div className="flex items-center gap-2">
                                        {getPaymentMethodIcon(order.paymentMethod, "h-4 w-4 text-gray-600")}
                                        <span className="text-sm font-semibold text-gray-900">{t(order.paymentMethod.toLowerCase() as any)}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                        {order.status !== "Closed" && !(isIfoodOrder && isIfoodPaid) && (
                            <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
                                <DialogTrigger asChild>
                                    <Button className="w-full bg-orange-600 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center space-x-2 text-base hover:bg-orange-700 transition-colors">
                                        <CreditCard className="h-5 w-5" />
                                        <span>{t("payNow")}</span>
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>{t("confirmPayment")}</DialogTitle>
                                        <DialogDescription>
                                            {t("selectPaymentMethod")} {formatCurrency(totalWithDiscount)}.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="grid gap-4 py-4">
                                        <div className="space-y-2">
                                            <Label>{t("paymentMethod")}</Label>
                                            <RadioGroup
                                                value={paymentMethod}
                                                onValueChange={(value: "Cash" | "Card" | "Voucher" | "PIX") => setPaymentMethod(value)}
                                                className="grid grid-cols-2 gap-4"
                                            >
                                                <div>
                                                    <RadioGroupItem value="Cash" id="cash" className="peer sr-only" />
                                                    <Label
                                                        htmlFor="cash"
                                                        className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-orange-600 peer-data-[state=checked]:bg-orange-50 peer-data-[state=checked]:text-orange-900 peer-data-[state=checked]:shadow-md [&:has([data-state=checked])]:border-orange-600 [&:has([data-state=checked])]:bg-orange-50 [&:has([data-state=checked])]:text-orange-900 [&:has([data-state=checked])]:shadow-md"
                                                    >
                                                        <Wallet className="mb-3 h-6 w-6" />
                                                        {t("cash")}
                                                    </Label>
                                                </div>
                                                <div>
                                                    <RadioGroupItem value="Card" id="card" className="peer sr-only" />
                                                    <Label
                                                        htmlFor="card"
                                                        className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-orange-600 peer-data-[state=checked]:bg-orange-50 peer-data-[state=checked]:text-orange-900 peer-data-[state=checked]:shadow-md [&:has([data-state=checked])]:border-orange-600 [&:has([data-state=checked])]:bg-orange-50 [&:has([data-state=checked])]:text-orange-900 [&:has([data-state=checked])]:shadow-md"
                                                    >
                                                        <CreditCard className="mb-3 h-6 w-6" />
                                                        {t("card")}
                                                    </Label>
                                                </div>
                                                <div>
                                                    <RadioGroupItem value="Voucher" id="voucher" className="peer sr-only" />
                                                    <Label
                                                        htmlFor="voucher"
                                                        className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-orange-600 peer-data-[state=checked]:bg-orange-50 peer-data-[state=checked]:text-orange-900 peer-data-[state=checked]:shadow-md [&:has([data-state=checked])]:border-orange-600 [&:has([data-state=checked])]:bg-orange-50 [&:has([data-state=checked])]:text-orange-900 [&:has([data-state=checked])]:shadow-md"
                                                    >
                                                        <Ticket className="mb-3 h-6 w-6" />
                                                        {t("voucher")}
                                                    </Label>
                                                </div>
                                                <div>
                                                    <RadioGroupItem value="PIX" id="pix" className="peer sr-only" />
                                                    <Label
                                                        htmlFor="pix"
                                                        className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-orange-600 peer-data-[state=checked]:bg-orange-50 peer-data-[state=checked]:text-orange-900 peer-data-[state=checked]:shadow-md [&:has([data-state=checked])]:border-orange-600 [&:has([data-state=checked])]:bg-orange-50 [&:has([data-state=checked])]:text-orange-900 [&:has([data-state=checked])]:shadow-md"
                                                    >
                                                        <QrCode className="mb-3 h-6 w-6" />
                                                        {t("pix")}
                                                    </Label>
                                                </div>
                                            </RadioGroup>
                                        </div>

                                        {/* Campo de Desconto no Pagamento */}
                                        <div className="space-y-2">
                                            <Label>Desconto no Pagamento</Label>
                                            <div className="flex gap-2">
                                                <Select
                                                    value={paymentDiscountType || 'none'}
                                                    onValueChange={(value) => {
                                                        if (value === 'none') {
                                                            setPaymentDiscountType(null)
                                                            setPaymentDiscountValue(null)
                                                            setDiscountError(null)
                                                        } else {
                                                            setPaymentDiscountType(value as "fixed" | "percentage")
                                                            if (paymentDiscountValue === null) {
                                                                setPaymentDiscountValue(0)
                                                            }
                                                            // Validar se já há valor definido
                                                            if (paymentDiscountValue !== null && paymentDiscountValue > 0 && order) {
                                                                const validation = validatePaymentDiscount(
                                                                    value as "fixed" | "percentage",
                                                                    paymentDiscountValue,
                                                                    settings.paymentDiscountLimitType,
                                                                    settings.paymentDiscountLimitValue,
                                                                    subtotalBeforePaymentDiscount
                                                                )
                                                                setDiscountError(validation.isValid ? null : (validation.errorMessage || null))
                                                            }
                                                        }
                                                    }}
                                                >
                                                    <SelectTrigger className="flex-1">
                                                        <SelectValue placeholder="Tipo" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="none">Sem desconto</SelectItem>
                                                        <SelectItem value="fixed">Valor fixo (R$)</SelectItem>
                                                        <SelectItem value="percentage">Percentual (%)</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                {paymentDiscountType && (
                                                    <Input
                                                        type="number"
                                                        step={paymentDiscountType === 'fixed' ? "0.01" : "0.1"}
                                                        min="0"
                                                        max={paymentDiscountType === 'percentage' ? "100" : undefined}
                                                        value={paymentDiscountValue || ''}
                                                        onChange={(e) => {
                                                            const value = e.target.value
                                                            const numValue = value ? parseFloat(value) : null
                                                            setPaymentDiscountValue(numValue)
                                                            
                                                            // Validação em tempo real
                                                            if (numValue !== null && numValue > 0 && order) {
                                                                const validation = validatePaymentDiscount(
                                                                    paymentDiscountType,
                                                                    numValue,
                                                                    settings.paymentDiscountLimitType,
                                                                    settings.paymentDiscountLimitValue,
                                                                    subtotalBeforePaymentDiscount
                                                                )
                                                                setDiscountError(validation.isValid ? null : (validation.errorMessage || null))
                                                            } else {
                                                                setDiscountError(null)
                                                            }
                                                        }}
                                                        placeholder={paymentDiscountType === 'fixed' ? "0.00" : "0"}
                                                        className={`flex-1 ${discountError ? 'border-red-500' : ''}`}
                                                    />
                                                )}
                                            </div>
                                            {discountError && (
                                                <div className="text-sm text-red-600 mt-1">
                                                    {discountError}
                                                </div>
                                            )}
                                        </div>

                                        {/* Resumo de valores */}
                                        <div className="space-y-2 pt-2 border-t">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-muted-foreground">Subtotal:</span>
                                                <span>{formatCurrency(subtotalWithPaymentDiscount)}</span>
                                            </div>
                                            {order.order_discount_type && order.order_discount_value !== null && order.order_discount_value !== undefined && order.order_discount_value > 0 && (
                                                <div className="flex justify-between text-sm text-green-600">
                                                    <span>Desconto do Pedido:</span>
                                                    <span>
                                                        {order.order_discount_type === 'fixed' 
                                                            ? `-${formatCurrency(order.order_discount_value)}`
                                                            : `-${formatCurrency((subtotalWithPaymentDiscount * order.order_discount_value) / 100)}`
                                                        }
                                                    </span>
                                                </div>
                                            )}
                                            {paymentDiscountType && paymentDiscountValue !== null && paymentDiscountValue > 0 && (
                                                <div className="flex justify-between text-sm text-green-600">
                                                    <span>Desconto no Pagamento:</span>
                                                    <span>
                                                        {paymentDiscountType === 'fixed' 
                                                            ? `-${formatCurrency(paymentDiscountValue)}`
                                                            : `-${formatCurrency((subtotalBeforePaymentDiscount * paymentDiscountValue) / 100)}`
                                                        }
                                                    </span>
                                                </div>
                                            )}
                                            <div className="flex justify-between font-bold pt-2 border-t">
                                                <span>Total:</span>
                                                {(() => {
                                                    const hasDiscount = totalWithDiscount < subtotalBeforePaymentDiscount
                                                    return hasDiscount ? (
                                                        <div className="flex flex-col items-end">
                                                            <span className="line-through text-muted-foreground text-sm">
                                                                {formatCurrency(subtotalBeforePaymentDiscount)}
                                                            </span>
                                                            <span className="text-green-600 text-lg">
                                                                {formatCurrency(totalWithDiscount)}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span>{formatCurrency(totalWithDiscount)}</span>
                                                    )
                                                })()}
                                            </div>
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button onClick={handlePayment}>{t("confirmPayment")}</Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        )}
                    </section>

                    {/* iFood Information Card */}
                    {order.source === 'ifood' && order.ifood_order_id && (
                        <section className="bg-blue-50 p-6 rounded-xl shadow-md border border-blue-200">
                            <div className="flex items-center gap-2 mb-3">
                                <ShoppingBag className="h-5 w-5 text-blue-600" />
                                <h3 className="text-base font-medium text-blue-900">Informações do iFood</h3>
                            </div>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-blue-700 font-medium">ID do Pedido iFood:</span>
                                    <span className="text-blue-900 font-mono">{order.ifood_display_id || order.ifood_order_id}</span>
                                </div>
                                {order.ifood_order_id && order.ifood_order_id !== order.ifood_display_id && (
                                    <div className="flex justify-between">
                                        <span className="text-blue-700 font-medium text-xs">ID Interno:</span>
                                        <span className="text-blue-900 font-mono text-xs">{order.ifood_order_id}</span>
                                    </div>
                                )}
                                {order.ifood_status && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-blue-700 font-medium">Status no iFood:</span>
                                        <IfoodOrderBadge ifoodStatus={order.ifood_status} />
                                    </div>
                                )}
                            </div>
                        </section>
                    )}

                    {isIfoodOrder && (
                        <section className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-base font-medium text-gray-700">Pagamento e entrega (iFood)</h3>
                                {isIfoodPaid && (
                                    <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-1 rounded-full">Pré-pago</span>
                                )}
                            </div>
                            {ifoodDetailsError && (
                                <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-2">
                                    {ifoodDetailsError}
                                </div>
                            )}
                            {isLoadingIfoodDetails && (
                                <p className="text-sm text-muted-foreground">Carregando detalhes do iFood...</p>
                            )}
                            {!isLoadingIfoodDetails && !ifoodDetails && !ifoodDetailsError && (
                                <p className="text-sm text-muted-foreground">Nenhum detalhe adicional retornado pelo iFood.</p>
                            )}
                            {ifoodDetails && (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium text-gray-700">Status de pagamento</span>
                                            <span className={`text-sm font-semibold ${isIfoodPaid ? 'text-green-700' : 'text-orange-600'}`}>
                                                {isIfoodPaid ? 'Pedido pago no iFood' : 'Pagamento pendente'}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm bg-gray-50 border border-gray-100 rounded-lg p-3">
                                            <div className="flex items-center justify-between">
                                                <span className="text-muted-foreground">Pré-pago</span>
                                                <span className="font-semibold">{formatCurrency(ifoodDetails.payments?.prepaid ?? 0)}</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-muted-foreground">Pendente</span>
                                                <span className="font-semibold">
                                                    {ifoodDetails.payments?.pending != null
                                                        ? formatCurrency(ifoodDetails.payments.pending)
                                                        : '—'}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-muted-foreground">Total pedido</span>
                                                <span className="font-semibold">
                                                    {formatCurrency(ifoodOrderAmount ?? displayOrder.total)}
                                                </span>
                                            </div>
                                        </div>
                                        {ifoodDetails.payments?.methods?.length ? (
                                            <div className="space-y-2">
                                                <p className="text-sm font-medium text-gray-700">Métodos informados</p>
                                                <div className="space-y-2">
                                                    {ifoodDetails.payments.methods.map((method, idx) => (
                                                        <div key={`${method.method || method.type || idx}-${idx}`} className="flex items-start justify-between rounded-lg border border-gray-100 bg-gray-50 p-3">
                                                            <div className="flex flex-col gap-1">
                                                                <span className="font-semibold text-gray-900">
                                                                    {formatPaymentMethodLabel(method.method || method.type)}
                                                                    {method.card?.brand ? ` · ${method.card.brand}` : ''}
                                                                </span>
                                                                {method.transaction?.authorizationCode && (
                                                                    <span className="text-xs text-muted-foreground">
                                                                        Autorização: {method.transaction.authorizationCode}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <span className="text-sm font-semibold text-gray-900">
                                                                {formatCurrency(method.value ?? 0)}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : null}
                                    </div>

                                    <div className="space-y-2 pt-2 border-t border-dashed">
                                        <p className="text-sm font-medium text-gray-700">Entrega / Retirada</p>
                                        <div className="space-y-1 text-sm text-gray-700">
                                            <div className="flex items-center gap-2">
                                                <Info className="h-4 w-4 text-gray-500" />
                                                <span>
                                                    {ifoodDetails.orderType === 'TAKEOUT' ? 'Retirada' : 'Entrega'} {ifoodDetails.delivery?.deliveredBy ? `• ${ifoodDetails.delivery.deliveredBy}` : ''}
                                                </span>
                                            </div>
                                            {ifoodDetails.delivery?.deliveryDateTime && (
                                                <div className="flex items-center gap-2 text-muted-foreground">
                                                    <Clock className="h-4 w-4" />
                                                    <span>Previsão: {new Date(ifoodDetails.delivery.deliveryDateTime).toLocaleString('pt-BR')}</span>
                                                </div>
                                            )}
                                            {ifoodDetails.takeout?.takeoutDateTime && (
                                                <div className="flex items-center gap-2 text-muted-foreground">
                                                    <Clock className="h-4 w-4" />
                                                    <span>Retirada: {new Date(ifoodDetails.takeout.takeoutDateTime).toLocaleString('pt-BR')}</span>
                                                </div>
                                            )}
                                            {formatIfoodAddress(ifoodDetails.delivery?.address || ifoodDetails.delivery?.deliveryAddress) && (
                                                <div className="flex items-center gap-2 text-muted-foreground">
                                                    <MapPin className="h-4 w-4" />
                                                    <span>{formatIfoodAddress(ifoodDetails.delivery?.address || ifoodDetails.delivery?.deliveryAddress)}</span>
                                                </div>
                                            )}
                                            {ifoodDetails.customer?.phone?.number || ifoodDetails.customer?.phoneNumber ? (
                                                <div className="flex items-center gap-2 text-muted-foreground">
                                                    <Phone className="h-4 w-4" />
                                                    <span>Contato: {ifoodDetails.customer?.phone?.number || ifoodDetails.customer?.phoneNumber}</span>
                                                </div>
                                            ) : null}
                                            {ifoodDetails.delivery?.pickupCode && (
                                                <div className="text-sm text-gray-700">
                                                    Código de retirada: <span className="font-semibold">{ifoodDetails.delivery.pickupCode}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-2 pt-2 border-t border-dashed">
                                        <p className="text-sm font-medium text-gray-700">Taxas e valores</p>
                                        <div className="space-y-1 text-sm text-gray-700">
                                            <div className="flex justify-between">
                                                <span>Subtotal</span>
                                                <span>{formatCurrency(ifoodDetails.total?.subTotal ?? ifoodDetails.total?.orderAmount ?? displayOrder.total)}</span>
                                            </div>
                                            {ifoodDetails.total?.deliveryFee != null && (
                                                <div className="flex justify-between">
                                                    <span>Taxa de entrega</span>
                                                    <span>{formatCurrency(ifoodDetails.total.deliveryFee)}</span>
                                                </div>
                                            )}
                                            {ifoodDetails.total?.additionalFees != null && (
                                                <div className="flex justify-between">
                                                    <span>Taxas adicionais</span>
                                                    <span>{formatCurrency(ifoodDetails.total.additionalFees)}</span>
                                                </div>
                                            )}
                                            {ifoodDetails.total?.benefits != null && (
                                                <div className="flex justify-between text-green-700">
                                                    <span>Benefícios/Descontos</span>
                                                    <span>-{formatCurrency(ifoodDetails.total.benefits)}</span>
                                                </div>
                                            )}
                                            <div className="flex justify-between font-semibold pt-1 border-t border-gray-200">
                                                <span>Total iFood</span>
                                                <span>{formatCurrency(ifoodOrderAmount ?? displayOrder.total)}</span>
                                            </div>
                                            {ifoodDetails.additionalFees?.length ? (
                                                <div className="text-xs text-muted-foreground">
                                                    <span className="font-semibold text-gray-700">Detalhes de taxas:</span>
                                                    <ul className="list-disc pl-5 space-y-1 mt-1">
                                                        {ifoodDetails.additionalFees.map((fee, idx) => (
                                                            <li key={`${fee.type || 'fee'}-${idx}`}>
                                                                {fee.type || 'Taxa'}: {formatCurrency(fee.value || 0)}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </section>
                    )}

                    {/* Observations Card */}
                    <section className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
                        <h3 className="text-base font-medium text-gray-700 mb-3">{t("notes")}</h3>
                        <textarea 
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition text-sm" 
                            placeholder={t("typeNote")} 
                            rows={4}
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                        />
                        <Button 
                            className="w-full mt-3 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-100 transition-colors bg-white text-gray-700" 
                            disabled={!note.trim()}
                        >
                            {t("addNote")}
                        </Button>
                    </section>
                </div>

                {/* Right Column: Order Items */}
                <section className="lg:col-span-2">
                    <div className="bg-white p-6 rounded-xl shadow-md h-full border border-gray-100">
                        <h2 className="text-xl font-semibold text-gray-900 mb-5">{t("items")}</h2>
                        <ul className="space-y-6">
                            {displayItems.map((item, index) => (
                                <li key={`${item.name}-${index}`} className="flex flex-col gap-2 pb-4 border-b border-gray-200 last:border-b-0">
                                    <div className="flex items-center">
                                        <div className="flex items-center justify-center h-8 w-8 bg-gray-100 rounded-full text-sm font-semibold text-gray-600 mr-4">
                                            {index + 1}
                                        </div>
                                        <div className="flex-grow">
                                            <p className="font-medium text-gray-900">{item.name}</p>
                                            <p className="text-sm text-gray-600">{formatCurrency(item.unitPrice)}</p>
                                        </div>
                                        <p className="text-gray-900 text-sm font-medium">
                                            {item.quantity}x {formatCurrency(item.totalPrice)}
                                        </p>
                                    </div>
                                    {item.observations && (
                                        <p className="text-xs text-muted-foreground pl-12">Obs.: {item.observations}</p>
                                    )}
                                    {item.options?.length ? (
                                        <div className="pl-12 text-xs text-gray-700 space-y-1">
                                            {item.options.map((option, idx) => (
                                                <div key={`${option.id || option.name}-${idx}`} className="flex justify-between">
                                                    <span>{option.groupName ? `${option.groupName}: ` : ''}{option.name}</span>
                                                    {option.price != null && (
                                                        <span className="text-muted-foreground">
                                                            {formatCurrency(option.price)}
                                                        </span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    ) : null}
                                </li>
                            ))}
                        </ul>
                    </div>
                </section>
            </main>
            {/* END: MainContent */}
        </div>
    )
}
