import { useState, useEffect, useRef } from "react"
import { Button } from "../components/ui/button"
import { Search, Truck, CheckCircle, Clock, ShoppingBag, Armchair, Store, RefreshCw, AlertCircle, X, ChevronDown, ChevronUp, Loader2 } from "lucide-react"
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
    const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({})
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

    // Utilitários de exibição
    const formatOrderTime = (time?: string) => {
        if (!time) return "--:--"
        const date = new Date(time)
        if (!isNaN(date.getTime())) {
            return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
        }
        const parts = time.split(" ")
        return parts.length > 1 ? parts[1] : time
    }

    const getMobileStatusInfo = (status: string) => {
        const normalized = status?.toLowerCase() || ""
        switch (normalized) {
            case "pending":
                return { label: "Pendente", className: "bg-yellow-100 text-yellow-800", icon: Clock, spinner: false }
            case "preparing":
                return { label: "Em Preparo", className: "bg-blue-100 text-blue-800", icon: RefreshCw, spinner: true }
            case "ready":
                return { label: "Pronto", className: "bg-green-100 text-green-800", icon: CheckCircle, spinner: false }
            case "delivered":
            case "closed":
                return { label: "Entregue", className: "bg-green-100 text-green-800", icon: CheckCircle, spinner: false }
            case "cancelled":
                return { label: "Cancelado", className: "bg-red-100 text-red-700", icon: AlertCircle, spinner: false }
            default:
                return { label: status, className: "bg-gray-100 text-gray-700", icon: Clock, spinner: false }
        }
    }

    const getStatusInfo = (status: string) => {
        switch (status.toLowerCase()) {
            case "pending":
                return {
                    label: "Pendente",
                    className: "bg-destructive/10 text-destructive border-destructive/20",
                    icon: Clock
                }
            case "preparing":
                return {
                    label: "Em Preparo",
                    className: "bg-blue-100 text-blue-700 border-blue-200",
                    icon: RefreshCw
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

    const ErrorBanner = () => (
        errorMessage ? (
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
        ) : null
    )

    return (
        <>
            {/* Mobile layout */}
            <div className="md:hidden -mx-4">
                <div className="min-h-screen bg-slate-50 flex flex-col relative pb-28">
                    <header className="bg-white px-4 py-3 flex items-center justify-between sticky top-0 z-20 shadow-sm">
                        <div className="flex items-center gap-2">
                            <div className="flex flex-col items-center justify-center leading-none">
                                <span className="font-serif text-2xl font-black text-black leading-none" style={{ fontFamily: "'Times New Roman', serif" }}>JE</span>
                                <span className="font-sans text-[0.55rem] font-bold tracking-[0.2em] text-black uppercase leading-none -mt-1 block text-center">BEBIDAS</span>
                            </div>
                        </div>
                        <h1 className="text-sm font-semibold text-gray-900 absolute left-1/2 -translate-x-1/2">Gerenciamento de Pedidos</h1>
                        <button
                            className="text-primary p-1 rounded-full hover:bg-primary/10"
                            onClick={handleManualRefresh}
                            disabled={isRefreshing || isLoading}
                        >
                            {isRefreshing ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="text-lg" />}
                        </button>
                    </header>

                    <main className="flex-1 px-4 py-6 overflow-y-auto space-y-6">
                        <section className="mb-2">
                            <h2 className="text-2xl font-extrabold text-gray-900 leading-tight">
                                Gerenciamento de<br />Pedidos (Menu Editado)
                            </h2>
                        </section>

                        <ErrorBanner />

                        <section className="mb-4">
                            <div className="bg-gray-200/80 p-1 rounded-lg flex overflow-x-auto gap-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                                <button
                                    className={`flex-1 min-w-[90px] text-sm font-semibold py-1.5 px-3 rounded-md shadow-sm text-center whitespace-nowrap ${
                                        statusFilter === "all" ? "bg-white text-gray-900" : "text-gray-500 hover:bg-gray-100/70"
                                    }`}
                                    onClick={() => setStatusFilter("all")}
                                >
                                    Todos
                                </button>
                                <button
                                    className={`flex-1 min-w-[90px] text-sm font-medium py-1.5 px-3 rounded-md text-center whitespace-nowrap border-l border-gray-300 ${
                                        statusFilter === "delivery" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:bg-gray-100/70"
                                    }`}
                                    onClick={() => setStatusFilter(statusFilter === "delivery" ? "all" : "delivery")}
                                >
                                    Delivery
                                </button>
                                <button
                                    className={`flex-1 min-w-[90px] text-sm font-medium py-1.5 px-3 rounded-md text-center whitespace-nowrap border-l border-gray-300 ${
                                        statusFilter === "pickup" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:bg-gray-100/70"
                                    }`}
                                    onClick={() => setStatusFilter(statusFilter === "pickup" ? "all" : "pickup")}
                                >
                                    Retirada
                                </button>
                                {isIfoodEnabled && (
                                    <button
                                        className={`flex-1 min-w-[90px] text-sm font-medium py-1.5 px-3 rounded-md text-center whitespace-nowrap border-l border-gray-300 ${
                                            statusFilter === "ifood" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:bg-gray-100/70"
                                        }`}
                                        onClick={() => setStatusFilter(statusFilter === "ifood" ? "all" : "ifood")}
                                    >
                                        iFood
                                    </button>
                                )}
                            </div>
                        </section>

                        <section className="mb-2">
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Search className="w-5 h-5 text-gray-400" />
                                </div>
                                <input
                                    className="block w-full pl-10 pr-3 py-3 bg-gray-100 border-none rounded-xl text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary text-base"
                                    placeholder="Buscar por cliente ou ID..."
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </section>

                        <div className="space-y-4 pb-24">
                            {filteredOrders.length === 0 ? (
                                <div className="text-center text-muted-foreground py-10">Nenhum pedido encontrado</div>
                            ) : (
                                filteredOrders.map((order) => {
                                    const statusInfo = getMobileStatusInfo(order.status)
                                    const OrderTypeIcon = getOrderTypeIcon(order.orderType || "dine_in")
                                    const isExpanded = expandedOrders[order.id] || false
                                    const displayId = order.source === "ifood" && order.ifood_display_id
                                        ? order.ifood_display_id
                                        : order.id
                                    const totalItems = order.items.reduce((sum, item) => sum + (item.quantity || 0), 0)
                                    const itemsLabel = order.items
                                        .map(item => `${item.quantity}x ${item.name}`)
                                        .join(", ")

                                    return (
                                        <article
                                            key={order.id}
                                            className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 relative cursor-pointer"
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => navigate(`/orders/${order.id}`)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    e.preventDefault()
                                                    navigate(`/orders/${order.id}`)
                                                }
                                            }}
                                        >
                                            <div className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full mb-3 ${statusInfo.className}`}>
                                                <statusInfo.icon className={`w-3.5 h-3.5 ${statusInfo.spinner ? "animate-spin" : ""}`} />
                                                <span>{statusInfo.label}</span>
                                            </div>

                                            <button
                                                className="absolute top-5 right-5 text-gray-400"
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    setExpandedOrders((prev) => ({ ...prev, [order.id]: !isExpanded }))
                                                }}
                                                aria-label={isExpanded ? "Recolher" : "Expandir"}
                                            >
                                                {isExpanded ? <ChevronUp /> : <ChevronDown />}
                                            </button>

                                            <div className="mb-3">
                                                <h3 className="text-lg font-bold text-gray-900">{order.customer}</h3>
                                                <p className="text-sm text-gray-500">ID #{displayId}</p>
                                            </div>

                                            <div className="flex items-center justify-between text-sm text-gray-700 mb-4">
                                                <span className="font-medium">{totalItems} itens • {formatCurrency(order.total)}</span>
                                                <div className="flex items-center gap-1.5 text-gray-600">
                                                    <OrderTypeIcon className="w-4 h-4 text-gray-500" />
                                                    <span>{getOrderTypeLabel(order.orderType || "dine_in")} - {formatOrderTime(order.time)}</span>
                                                    {order.source === "ifood" && (
                                                        <span className="ml-2 text-red-600 italic font-black text-xs tracking-tight" aria-label="Pedido do iFood">
                                                            ifood
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {isExpanded && (
                                                <div className="pt-3 border-gray-100 space-y-2 border-t">
                                                    <p className="text-sm text-gray-800">
                                                        <span className="font-bold">Itens:</span> {itemsLabel || "Sem itens"}
                                                    </p>
                                                    {order.table && (
                                                        <p className="text-sm text-gray-800">
                                                            <span className="font-bold">Mesa:</span> {order.table}
                                                        </p>
                                                    )}
                                                    {order.status === "Cancelled" && order.cancellation_reason && (
                                                        <p className="text-sm text-red-600">
                                                            <span className="font-bold">Justificativa:</span> {order.cancellation_reason}
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                        </article>
                                    )
                                })
                            )}
                        </div>
                    </main>

                </div>
            </div>

            {/* Desktop layout (mantido) */}
            <div className="hidden md:block">
                <div className="space-y-8">
                    <ErrorBanner />

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

                    <section className="mb-8">
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
            </div>
        </>
    )
}
