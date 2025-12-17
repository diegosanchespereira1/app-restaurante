import { useState, useEffect } from "react"
import { Button } from "../components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Badge } from "../components/ui/badge"
import { Clock, CheckCircle, Truck, ShoppingBag, Armchair, RefreshCw, Wifi, WifiOff, Filter } from "lucide-react"
import { useRestaurant } from "../context/RestaurantContext"
import { useSettings } from "../context/SettingsContext"
import { formatCurrency } from "../lib/utils"

type StatusFilter = "all" | "pending" | "preparing" | "ready"

export function OrderDisplayStandalone() {
    const { orders, updateOrderStatus, isDemoMode } = useRestaurant()
    const { isOrderDisplayEnabled } = useSettings()
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [lastUpdate, setLastUpdate] = useState(new Date())
    const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'checking'>('connected')
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")

    // Auto-refresh every 30 seconds for demo mode, manual only for production
    useEffect(() => {
        if (isDemoMode) {
            const interval = setInterval(() => {
                console.log('Demo mode: Auto-refreshing orders...')
                window.location.reload()
            }, 30000) // 30 seconds in demo mode

            return () => clearInterval(interval)
        }
    }, [isDemoMode])

    // Filter orders based on status filter
    const filteredOrders = orders.filter(order => {
        // Exclude delivered/closed orders
        if (order.status === "Delivered" || order.status === "Closed") {
            return false
        }
        
        // Apply status filter
        switch (statusFilter) {
            case "pending":
                return order.status.toLowerCase() === "pending"
            case "preparing":
                return order.status.toLowerCase() === "preparing"
            case "ready":
                return order.status.toLowerCase() === "ready"
            default:
                return true
        }
    })

    // Get counts for each status
    const statusCounts = {
        all: orders.filter(order => order.status !== "Delivered" && order.status !== "Closed").length,
        pending: orders.filter(order => order.status.toLowerCase() === "pending").length,
        preparing: orders.filter(order => order.status.toLowerCase() === "preparing").length,
        ready: orders.filter(order => order.status.toLowerCase() === "ready").length,
    }

    const handleStatusUpdate = async (orderId: string, newStatus: typeof orders[0]["status"]) => {
        console.log(`Updating order ${orderId} to status: ${newStatus}`)
        setConnectionStatus('checking')
        
        try {
            const result = await updateOrderStatus(orderId, newStatus)
            console.log('Update result:', result)
            
            if (result.success) {
                setLastUpdate(new Date())
                setConnectionStatus('connected')
                console.log('Order status updated successfully')
            } else {
                console.error('Failed to update order:', result.error)
                setConnectionStatus('disconnected')
            }
        } catch (error) {
            console.error('Error updating order status:', error)
            setConnectionStatus('disconnected')
        }
    }

    const handleManualRefresh = async () => {
        console.log('Manual refresh triggered')
        setIsRefreshing(true)
        setConnectionStatus('checking')
        
        // Force a page reload to get the latest data
        window.location.reload()
    }

    const getNextStatus = (currentStatus: string) => {
        switch (currentStatus.toLowerCase()) {
            case "pending":
                return "Preparing"
            case "preparing":
                return "Ready"
            case "ready":
                return "Delivered"
            default:
                return "Delivered"
        }
    }

    const getStatusInfo = (status: string) => {
        switch (status.toLowerCase()) {
            case "pending":
                return {
                    label: "Pendente",
                    className: "bg-red-100 text-red-700 border-red-200",
                    icon: Clock,
                    nextAction: "Preparar"
                }
            case "preparing":
                return {
                    label: "Preparando",
                    className: "bg-yellow-100 text-yellow-700 border-yellow-200",
                    icon: Clock,
                    nextAction: "Pronto"
                }
            case "ready":
                return {
                    label: "Pronto",
                    className: "bg-green-100 text-green-700 border-green-200",
                    icon: CheckCircle,
                    nextAction: "Entregar"
                }
            default:
                return {
                    label: status,
                    className: "bg-gray-100 text-gray-700 border-gray-200",
                    icon: Clock,
                    nextAction: "Entregar"
                }
        }
    }

    const getOrderTypeIcon = (orderType: string) => {
        switch (orderType) {
            case "delivery":
                return Truck
            case "pickup":
                return ShoppingBag
            default:
                return Armchair
        }
    }

    const getOrderTypeLabel = (orderType: string) => {
        switch (orderType) {
            case "delivery":
                return "Delivery"
            case "pickup":
                return "Retirada"
            default:
                return "Mesa"
        }
    }

    // Check if running in a new window (standalone mode)
    const isStandalone = window.location !== window.parent.location

    // Show message if feature is disabled
    if (!isOrderDisplayEnabled) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <CardTitle className="text-center">Tela de Pedidos Desativada</CardTitle>
                    </CardHeader>
                    <CardContent className="text-center">
                        <p className="text-gray-600 mb-4">
                            Esta funcionalidade está desativada. Ative-a nas configurações para usar a tela dedicada de pedidos.
                        </p>
                        {isStandalone ? (
                            <Button onClick={() => window.close()}>
                                Fechar Janela
                            </Button>
                        ) : (
                            <Button onClick={() => window.history.back()}>
                                Voltar
                            </Button>
                        )}
                    </CardContent>
                </Card>
            </div>
        )
    }

    const getConnectionIcon = () => {
        switch (connectionStatus) {
            case 'connected':
                return <Wifi className="w-4 h-4 text-green-500" />
            case 'checking':
                return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />
            case 'disconnected':
                return <WifiOff className="w-4 h-4 text-red-500" />
        }
    }

    const getConnectionText = () => {
        switch (connectionStatus) {
            case 'connected':
                return isDemoMode ? "Modo Demo - Auto-refresh 30s" : "Conectado - Tempo Real"
            case 'checking':
                return "Atualizando..."
            case 'disconnected':
                return "Erro de conexão"
        }
    }

    return (
        <div className="min-h-screen bg-gray-100">
            {/* Header */}
            <header className="bg-white shadow-sm border-b">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Tela de Pedidos</h1>
                            <p className="text-sm text-gray-500">
                                Pedidos ativos • Última atualização: {lastUpdate.toLocaleTimeString()}
                            </p>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 text-sm">
                                {getConnectionIcon()}
                                <span className="text-gray-600">{getConnectionText()}</span>
                            </div>
                            <Badge variant="outline" className="text-lg px-3 py-1">
                                {statusCounts.all} pedidos ativos
                            </Badge>
                            <Button
                                variant="outline"
                                size="lg"
                                onClick={handleManualRefresh}
                                disabled={isRefreshing}
                                className="touch-manipulation min-h-[48px] min-w-[48px]"
                            >
                                <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
                            </Button>
                            {isStandalone && (
                                <Button
                                    variant="outline"
                                    size="lg"
                                    onClick={() => window.close()}
                                    className="ml-2 touch-manipulation min-h-[48px] min-w-[48px]"
                                >
                                    Fechar
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            {/* Status Filter Buttons */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                <div className="bg-white rounded-lg shadow-sm border p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Filter className="w-5 h-5 text-gray-500" />
                        <span className="font-medium text-gray-700">Filtrar por Status:</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <Button
                            variant={statusFilter === "all" ? "default" : "outline"}
                            onClick={() => setStatusFilter("all")}
                            className={`flex flex-col items-center gap-1 py-4 px-3 h-auto touch-manipulation min-h-[60px] ${
                                statusFilter === "all"
                                    ? "bg-blue-600 hover:bg-blue-700 text-white border-blue-600"
                                    : "hover:bg-gray-50"
                            }`}
                        >
                            <span className="font-semibold text-lg">{statusCounts.all}</span>
                            <span className="text-xs">Todos</span>
                        </Button>
                        <Button
                            variant={statusFilter === "pending" ? "default" : "outline"}
                            onClick={() => setStatusFilter("pending")}
                            className={`flex flex-col items-center gap-1 py-4 px-3 h-auto touch-manipulation min-h-[60px] ${
                                statusFilter === "pending"
                                    ? "bg-red-600 hover:bg-red-700 text-white border-red-600"
                                    : "hover:bg-gray-50"
                            }`}
                        >
                            <span className="font-semibold text-lg">{statusCounts.pending}</span>
                            <span className="text-xs">Pendente</span>
                        </Button>
                        <Button
                            variant={statusFilter === "preparing" ? "default" : "outline"}
                            onClick={() => setStatusFilter("preparing")}
                            className={`flex flex-col items-center gap-1 py-4 px-3 h-auto touch-manipulation min-h-[60px] ${
                                statusFilter === "preparing"
                                    ? "bg-yellow-600 hover:bg-yellow-700 text-white border-yellow-600"
                                    : "hover:bg-gray-50"
                            }`}
                        >
                            <span className="font-semibold text-lg">{statusCounts.preparing}</span>
                            <span className="text-xs">Preparando</span>
                        </Button>
                        <Button
                            variant={statusFilter === "ready" ? "default" : "outline"}
                            onClick={() => setStatusFilter("ready")}
                            className={`flex flex-col items-center gap-1 py-4 px-3 h-auto touch-manipulation min-h-[60px] ${
                                statusFilter === "ready"
                                    ? "bg-green-600 hover:bg-green-700 text-white border-green-600"
                                    : "hover:bg-gray-50"
                            }`}
                        >
                            <span className="font-semibold text-lg">{statusCounts.ready}</span>
                            <span className="text-xs">Pronto</span>
                        </Button>
                    </div>
                </div>
            </section>

            {/* Orders Grid - Touch-friendly layout */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
                {filteredOrders.length === 0 ? (
                    <div className="text-center py-16">
                        <div className="bg-white rounded-lg shadow-sm p-8">
                            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                            <h3 className="text-xl font-semibold text-gray-900 mb-2">
                                Nenhum pedido encontrado
                            </h3>
                            <p className="text-gray-600">
                                {statusFilter === "all" 
                                    ? "Todos os pedidos foram concluídos. 🎉"
                                    : `Não há pedidos com status "${statusFilter}".`
                                }
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-2 gap-6">
                        {filteredOrders
                            .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
                            .map((order) => {
                                const statusInfo = getStatusInfo(order.status)
                                const OrderTypeIcon = getOrderTypeIcon(order.orderType || "dine_in")
                                const StatusIcon = statusInfo.icon
                                const nextStatus = getNextStatus(order.status)

                                return (
                                    <Card
                                        key={order.id}
                                        className="relative overflow-hidden hover:shadow-lg transition-shadow touch-manipulation"
                                    >
                                        {/* Order Header */}
                                        <CardHeader className="pb-3">
                                            <div className="flex justify-between items-start gap-2">
                                                <div className="bg-orange-500 text-white px-4 py-2 rounded-full flex-shrink-0">
                                                    <span className="font-mono font-bold text-base">
                                                        #{order.id}
                                                    </span>
                                                </div>
                                                <Badge 
                                                    variant="outline" 
                                                    className={`${statusInfo.className} text-sm px-3 py-1 flex-shrink-0`}
                                                >
                                                    <StatusIcon className="w-4 h-4 mr-1" />
                                                    {statusInfo.label}
                                                </Badge>
                                            </div>
                                        </CardHeader>

                                        <CardContent className="space-y-5">
                                            {/* Customer Info */}
                                            <div>
                                                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                                                    {order.customer}
                                                </h3>
                                                <div className="flex items-center gap-3 text-base text-gray-600 mt-1">
                                                    <OrderTypeIcon className="w-5 h-5" />
                                                    {getOrderTypeLabel(order.orderType || "dine_in")}
                                                    {order.table && (
                                                        <>
                                                            <span>•</span>
                                                            <span>Mesa {order.table}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Items - Show ALL items with better spacing */}
                                            <div>
                                                <h4 className="font-medium text-gray-900 mb-3 text-base">Itens:</h4>
                                                <div className="space-y-2">
                                                    {order.items.map((item, index) => (
                                                        <div key={index} className="flex justify-between text-base py-1">
                                                            <span className="text-gray-600 flex-1">
                                                                {item.quantity}x {item.name}
                                                            </span>
                                                            <span className="text-gray-900 font-medium ml-2">
                                                                {formatCurrency(item.price * item.quantity)}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Time */}
                                            <div className="text-base text-gray-500 py-2">
                                                <Clock className="w-4 h-4 inline mr-2" />
                                                {order.time.split(' ')[1]} • {order.time.split(' ')[0]}
                                            </div>

                                            {/* Total */}
                                            <div className="border-t pt-4">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-lg font-bold text-gray-900">Total:</span>
                                                    <span className="text-xl font-bold text-gray-900">
                                                        {formatCurrency(order.total)}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Action Button - Larger touch target */}
                                            {order.status !== "Delivered" && order.status !== "Closed" && (
                                                <Button
                                                    onClick={() => handleStatusUpdate(order.id, nextStatus as any)}
                                                    className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white touch-manipulation min-h-[56px] text-base font-semibold"
                                                    size="lg"
                                                    disabled={isRefreshing || connectionStatus === 'checking'}
                                                >
                                                    {connectionStatus === 'checking' ? (
                                                        <RefreshCw className="w-5 h-5 mr-3 animate-spin" />
                                                    ) : null}
                                                    {statusInfo.nextAction}
                                                </Button>
                                            )}
                                        </CardContent>
                                    </Card>
                                )
                            })}
                    </div>
                )}
            </main>
        </div>
    )
}