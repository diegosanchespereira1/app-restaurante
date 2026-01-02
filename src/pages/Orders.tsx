import { useState, useEffect, useRef } from "react"
import { Button } from "../components/ui/button"
import { Search, Truck, CheckCircle, Clock, ShoppingBag, Armchair, Store, RefreshCw, AlertCircle, X } from "lucide-react"
import { useNavigate, useLocation } from "react-router-dom"
import { useRestaurant } from "../context/RestaurantContext"
import { useSettings } from "../context/SettingsContext"
import { Input } from "../components/ui/input"
import { IfoodOrderBadge } from "../components/ifood/IfoodOrderBadge"
import { getBackendUrl } from "../lib/backend-config"

import { formatCurrency } from "../lib/utils"

export function Orders() {
    const navigate = useNavigate()
    const location = useLocation()
    const { orders, refreshData, isLoading } = useRestaurant()
    const { isTablesEnabled } = useSettings()
    const [searchQuery, setSearchQuery] = useState("")
    const [statusFilter, setStatusFilter] = useState("all")
    const [isIfoodEnabled, setIsIfoodEnabled] = useState(false)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [statusDetails, setStatusDetails] = useState<{ status: string; ifoodStatus: string; statusMessage: string } | null>(null)
    const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null)

    // Verificar se há mensagem de erro no state da navegação
    useEffect(() => {
        if (location.state?.error) {
            setErrorMessage(location.state.error)
            setStatusDetails(location.state.statusDetails || null)
            // Limpar o state para não mostrar a mensagem novamente ao navegar
            window.history.replaceState({}, document.title)
        }
    }, [location.state])

    // Função para forçar atualização manual
    const handleManualRefresh = async () => {
        setIsRefreshing(true)
        try {
            // Evita spinner infinito caso a chamada demore ou fique pendente
            await Promise.race([
                refreshData(),
                new Promise(resolve => setTimeout(resolve, 12000)) // timeout de 12s
            ])
        } catch (error) {
            console.error('Erro ao atualizar pedidos:', error)
        } finally {
            setIsRefreshing(false)
        }
    }

    // Verificar se o iFood está habilitado
    useEffect(() => {
        const checkIfoodStatus = async () => {
            try {
                const backendUrl = getBackendUrl()
                const response = await fetch(`${backendUrl}/api/ifood/status`)
                if (response.ok) {
                    const result = await response.json()
                    // O endpoint retorna { success: true, status: { active: boolean, ... } }
                    setIsIfoodEnabled(result.status?.active || result.active || false)
                }
            } catch (error) {
                console.error('Erro ao verificar status do iFood:', error)
                setIsIfoodEnabled(false)
            }
        }
        checkIfoodStatus()
    }, [])

    // Atualização automática a cada 30 segundos
    useEffect(() => {
        // Limpar intervalo anterior se existir
        if (refreshIntervalRef.current) {
            clearInterval(refreshIntervalRef.current)
        }

        // Criar novo intervalo de 30 segundos
        refreshIntervalRef.current = setInterval(async () => {
            console.log('[Orders] Atualizando pedidos automaticamente...')
            try {
                await refreshData()
            } catch (error) {
                console.error('[Orders] Erro na atualização automática:', error)
            }
        }, 30000) // 30 segundos

        // Limpar intervalo ao desmontar o componente
        return () => {
            if (refreshIntervalRef.current) {
                clearInterval(refreshIntervalRef.current)
            }
        }
    }, [refreshData])

    // Resetar filtro "mesa" se a feature for desabilitada
    useEffect(() => {
        if (!isTablesEnabled && statusFilter === "mesa") {
            setStatusFilter("all")
        }
    }, [isTablesEnabled, statusFilter])

    // Resetar filtro "ifood" se a feature for desabilitada
    useEffect(() => {
        if (!isIfoodEnabled && statusFilter === "ifood") {
            setStatusFilter("all")
        }
    }, [isIfoodEnabled, statusFilter])

    const filteredOrders = orders.filter(order => {
        const orderDisplayId = order.source === 'ifood' && order.ifood_display_id 
            ? order.ifood_display_id 
            : order.id
        const matchesSearch = orderDisplayId.toLowerCase().includes(searchQuery.toLowerCase()) ||
            order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (order.table && order.table.toLowerCase().includes(searchQuery.toLowerCase())) ||
            order.customer.toLowerCase().includes(searchQuery.toLowerCase())
        
        const matchesStatus = statusFilter === "all" ||
            (statusFilter === "delivery" && order.orderType === "delivery") ||
            (statusFilter === "pickup" && order.orderType === "takeout") ||
            (statusFilter === "mesa" && order.orderType === "dine_in") ||
            (statusFilter === "ifood" && order.source === "ifood")
        
        return matchesSearch && matchesStatus
    })

    const getStatusInfo = (status: string) => {
        switch (status.toLowerCase()) {
            case "pending":
            case "preparing":
                return {
                    label: "Pendente",
                    className: "bg-destructive/10 text-destructive border-destructive/20",
                    icon: Clock
                }
            case "ready":
                return {
                    label: "Pronto",
                    className: "bg-green-100 text-green-700 border-green-200",
                    icon: CheckCircle
                }
            case "delivered":
            case "closed":
                return {
                    label: "Entregue",
                    className: "bg-green-100 text-green-700 border-green-200",
                    icon: CheckCircle
                }
            case "cancelled":
                return {
                    label: "CANCELADO",
                    className: "bg-red-100 text-red-700 border-red-200",
                    icon: Clock
                }
            default:
                return {
                    label: status,
                    className: "bg-muted text-muted-foreground border-border",
                    icon: Clock
                }
        }
    }

    const getOrderTypeIcon = (orderType: string) => {
        switch (orderType) {
            case "delivery":
                return Truck
            case "takeout":
                return ShoppingBag
            case "dine_in":
                return Armchair
            default:
                return ShoppingBag
        }
    }

    const getOrderTypeLabel = (orderType: string) => {
        switch (orderType) {
            case "delivery":
                return "Delivery"
            case "takeout":
                return "Retirada"
            case "dine_in":
                return "Mesa"
            default:
                return "Mesa"
        }
    }

    return (
        <div className="space-y-8">
            {/* Mensagem de erro se houver */}
            {errorMessage && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-4">
                    <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                            <AlertCircle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
                            <div className="flex-1">
                                <h3 className="font-semibold text-destructive mb-2">Erro ao acessar pedido</h3>
                                <p className="text-sm text-foreground whitespace-pre-line">{errorMessage}</p>
                                {statusDetails && (
                                    <div className="mt-3 pt-3 border-t border-destructive/20">
                                        <p className="text-xs text-muted-foreground mb-1">Detalhes do status:</p>
                                        <div className="space-y-1 text-sm">
                                            <p><span className="font-medium">Status no sistema:</span> {statusDetails.status}</p>
                                            <p><span className="font-medium">Status no iFood:</span> {statusDetails.ifoodStatus}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                setErrorMessage(null)
                                setStatusDetails(null)
                            }}
                            className="shrink-0"
                        >
                            <X className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            )}

            {/* Header */}
            <header className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center mb-8">
                <div>
                    <h1 className="text-4xl font-bold text-foreground">Pedidos</h1>
                    <p className="text-muted-foreground mt-1">Gerenciar pedidos desta mesa</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 sm:justify-end">
                    <Button 
                        onClick={() => navigate("/orders/new")}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-2 px-6 rounded-lg flex items-center shadow-sm justify-center"
                    >
                        <span className="text-2xl font-light mr-2">+</span>
                        Novo Pedido
                    </Button>
                    <Button 
                        onClick={handleManualRefresh}
                        disabled={isRefreshing || isLoading}
                        variant="outline"
                        className="flex items-center gap-2 justify-center"
                    >
                        <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                        {isRefreshing ? 'Atualizando...' : 'Atualizar'}
                    </Button>
                </div>
            </header>

            {/* Filters */}
            <section className="mb-8">
                {/* Search Input - First Line */}
                <div className="relative mb-4">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                        <Search className="w-5 h-5 text-muted-foreground" />
                    </span>
                    <Input
                        className="w-full pl-10 pr-4 py-3 border border-input rounded-lg focus:ring-primary focus:border-primary transition"
                        placeholder="Buscar por nome ou código..."
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                {/* Filter Buttons - Second Line */}
                <div className="border border-border rounded-lg p-2 bg-card">
                    <div className="flex flex-nowrap items-center gap-1 text-xs sm:text-sm w-full">
                        <Button
                            variant={statusFilter === "all" ? "default" : "ghost"}
                            className={`flex-1 min-w-0 justify-center flex items-center gap-1 px-2 py-1 rounded-md font-medium transition-colors text-xs sm:text-sm ${
                                statusFilter === "all"
                                    ? "text-primary bg-primary/10 border border-primary/20"
                                    : "text-muted-foreground hover:bg-accent"
                            }`}
                            onClick={() => setStatusFilter("all")}
                        >
                            Todos
                        </Button>
                        <Button
                            variant={statusFilter === "delivery" ? "default" : "ghost"}
                            className={`flex-1 min-w-0 justify-center flex items-center gap-1 px-2 py-1 rounded-md font-medium transition-colors text-xs sm:text-sm ${
                                statusFilter === "delivery"
                                    ? "text-primary bg-primary/10 border border-primary/20"
                                    : "text-muted-foreground hover:bg-accent"
                            }`}
                            onClick={() => setStatusFilter(statusFilter === "delivery" ? "all" : "delivery")}
                        >
                            <Truck className="w-3 h-3" />
                            Delivery
                        </Button>
                        <Button
                            variant={statusFilter === "pickup" ? "default" : "ghost"}
                            className={`flex-1 min-w-0 justify-center flex items-center gap-1 px-2 py-1 rounded-md font-medium transition-colors text-xs sm:text-sm ${
                                statusFilter === "pickup"
                                    ? "text-primary bg-primary/10 border border-primary/20"
                                    : "text-muted-foreground hover:bg-accent"
                            }`}
                            onClick={() => setStatusFilter(statusFilter === "pickup" ? "all" : "pickup")}
                        >
                            <ShoppingBag className="w-3 h-3" />
                            Retirada
                        </Button>
                        {isTablesEnabled && (
                            <Button
                                variant={statusFilter === "mesa" ? "default" : "ghost"}
                                className={`flex-1 min-w-0 justify-center flex items-center gap-1 px-2 py-1 rounded-md font-medium transition-colors text-xs sm:text-sm ${
                                    statusFilter === "mesa"
                                        ? "text-primary bg-primary/10 border border-primary/20"
                                        : "text-muted-foreground hover:bg-accent"
                                }`}
                                onClick={() => setStatusFilter(statusFilter === "mesa" ? "all" : "mesa")}
                            >
                                <Armchair className="w-3 h-3" />
                                Mesa
                            </Button>
                        )}
                        {isIfoodEnabled && (
                            <Button
                                variant={statusFilter === "ifood" ? "default" : "ghost"}
                                className={`flex-1 min-w-0 justify-center flex items-center gap-1 px-2 py-1 rounded-md font-medium transition-colors text-xs sm:text-sm ${
                                    statusFilter === "ifood"
                                        ? "text-primary bg-primary/10 border border-primary/20"
                                        : "text-muted-foreground hover:bg-accent"
                                }`}
                                onClick={() => setStatusFilter(statusFilter === "ifood" ? "all" : "ifood")}
                            >
                                <Store className="w-3 h-3" />
                                iFood
                            </Button>
                        )}
                    </div>
                </div>
            </section>

            {/* Orders Grid */}
            <main className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredOrders.length === 0 ? (
                    <div className="col-span-full text-center text-muted-foreground py-8">
                        Nenhum pedido encontrado
                    </div>
                ) : (
                    filteredOrders.map((order) => {
                        const statusInfo = getStatusInfo(order.status)
                        const OrderTypeIcon = getOrderTypeIcon(order.orderType || "dine_in")
                        const StatusIcon = statusInfo.icon

                        return (
                            <article
                                key={order.id}
                                className="bg-card rounded-xl p-6 shadow-[0_4px_6px_-1px_rgb(0_0_0_/_0.1),_0_2px_4px_-2px_rgb(0_0_0_/_0.1)] cursor-pointer hover:shadow-lg transition-shadow"
                                onClick={() => navigate(`/orders/${order.id}`)}
                            >
                                {/* Order ID - Highlighted */}
                                <div className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-lg p-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium text-primary">ID do Pedido</span>
                                        <div className="flex items-center gap-2">
                                            {order.source === 'ifood' && (
                                                <IfoodOrderBadge ifoodStatus={order.ifood_status} />
                                            )}
                                            <div className="bg-primary text-primary-foreground px-3 py-1 rounded-full">
                                                <span className="font-mono font-bold text-sm tracking-wider">
                                                    {order.source === 'ifood' && order.ifood_display_id 
                                                        ? order.ifood_display_id 
                                                        : order.id}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="space-y-4 my-2.5">
                                    <div className="space-y-3 text-muted-foreground">
                                        <div className="flex flex-col gap-2 mb-6">
                                            <h2 className="text-2xl font-bold text-foreground truncate">{order.customer}</h2>
                                            <span className={`flex items-center gap-2 text-sm font-medium px-3 py-1 rounded-full border w-fit ${statusInfo.className}`}>
                                                <StatusIcon className="w-4 h-4 shrink-0" />
                                                <span className="whitespace-nowrap">{statusInfo.label}</span>
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span>Tipo:</span>
                                            <span className="flex items-center gap-2">
                                                <OrderTypeIcon className="w-5 h-5" />
                                                {getOrderTypeLabel(order.orderType || "dine_in")}
                                            </span>
                                        </div>
                                        {order.table && (
                                            <div className="flex justify-between items-center">
                                                <span>Mesa:</span>
                                                <span className="font-medium">{order.table}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between items-center">
                                            <span>Itens:</span>
                                            <span>{order.items.length}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span>Hora:</span>
                                            <span className="font-mono">{order.time.split(' ')[1]}</span>
                                        </div>
                                        {order.status === "Cancelled" && order.cancellation_reason && (
                                            <div className="flex flex-col gap-1 pt-2 border-t border-border">
                                                <span className="text-xs text-muted-foreground">Justificativa:</span>
                                                <span className="text-sm font-medium text-red-600">{order.cancellation_reason}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                
                                <div className="border-t border-border pt-4 flex justify-between items-center">
                                    <span className="text-lg font-bold text-foreground">Total:</span>
                                    <span className="text-2xl font-bold text-primary">{formatCurrency(order.total)}</span>
                                </div>
                            </article>
                        )
                    })
                )}
            </main>
        </div>
    )
}
