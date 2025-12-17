import { useState, useEffect } from "react"
import { Button } from "../components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Badge } from "../components/ui/badge"
import { Clock, CheckCircle, Truck, ShoppingBag, Armchair, RefreshCw } from "lucide-react"
import { useRestaurant } from "../context/RestaurantContext"
import { useSettings } from "../context/SettingsContext"
import { formatCurrency } from "../lib/utils"

export function OrderDisplay() {
    const { orders, updateOrderStatus } = useRestaurant()
    const { isOrderDisplayEnabled } = useSettings()
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [lastUpdate, setLastUpdate] = useState(new Date())

    // Auto-refresh every 30 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            setIsRefreshing(true)
            setTimeout(() => setIsRefreshing(false), 1000)
            setLastUpdate(new Date())
        }, 30000)

        return () => clearInterval(interval)
    }, [])

    // Filter active orders (exclude delivered/closed)
    const activeOrders = orders.filter(order => 
        order.status !== "Delivered" && order.status !== "Closed"
    )

    const handleStatusUpdate = async (orderId: string, newStatus: typeof orders[0]["status"]) => {
        await updateOrderStatus(orderId, newStatus)
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
                        <Button onClick={() => window.history.back()}>
                            Voltar
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
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
                            <Badge variant="outline" className="text-lg px-3 py-1">
                                {activeOrders.length} pedidos ativos
                            </Badge>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    setIsRefreshing(true)
                                    setTimeout(() => setIsRefreshing(false), 1000)
                                    setLastUpdate(new Date())
                                }}
                                disabled={isRefreshing}
                            >
                                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                            </Button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Orders Grid - Fixed 2 columns */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {activeOrders.length === 0 ? (
                    <div className="text-center py-16">
                        <div className="bg-white rounded-lg shadow-sm p-8">
                            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                            <h3 className="text-xl font-semibold text-gray-900 mb-2">
                                Nenhum pedido ativo
                            </h3>
                            <p className="text-gray-600">
                                Todos os pedidos foram concluídos. 🎉
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-6">
                        {activeOrders
                            .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
                            .map((order) => {
                                const statusInfo = getStatusInfo(order.status)
                                const OrderTypeIcon = getOrderTypeIcon(order.orderType || "dine_in")
                                const StatusIcon = statusInfo.icon
                                const nextStatus = getNextStatus(order.status)

                                return (
                                    <Card
                                        key={order.id}
                                        className="relative overflow-hidden hover:shadow-lg transition-shadow"
                                    >
                                        {/* Order Header */}
                                        <CardHeader className="pb-3">
                                            <div className="flex justify-between items-start">
                                                <div className="bg-orange-500 text-white px-3 py-1 rounded-full">
                                                    <span className="font-mono font-bold text-sm">
                                                        #{order.id}
                                                    </span>
                                                </div>
                                                <Badge 
                                                    variant="outline" 
                                                    className={`${statusInfo.className} text-sm`}
                                                >
                                                    <StatusIcon className="w-3 h-3 mr-1" />
                                                    {statusInfo.label}
                                                </Badge>
                                            </div>
                                        </CardHeader>

                                        <CardContent className="space-y-4">
                                            {/* Customer Info */}
                                            <div>
                                                <h3 className="text-lg font-semibold text-gray-900">
                                                    {order.customer}
                                                </h3>
                                                <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                                                    <OrderTypeIcon className="w-4 h-4" />
                                                    {getOrderTypeLabel(order.orderType || "dine_in")}
                                                    {order.table && (
                                                        <>
                                                            <span>•</span>
                                                            <span>Mesa {order.table}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Items - Show ALL items */}
                                            <div>
                                                <h4 className="font-medium text-gray-900 mb-2">Itens:</h4>
                                                <div className="space-y-1">
                                                    {order.items.map((item, index) => (
                                                        <div key={index} className="flex justify-between text-sm">
                                                            <span className="text-gray-600">
                                                                {item.quantity}x {item.name}
                                                            </span>
                                                            <span className="text-gray-900 font-medium">
                                                                {formatCurrency(item.price * item.quantity)}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Time */}
                                            <div className="text-sm text-gray-500">
                                                <Clock className="w-4 h-4 inline mr-1" />
                                                {order.time.split(' ')[1]} • {order.time.split(' ')[0]}
                                            </div>

                                            {/* Total */}
                                            <div className="border-t pt-3">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-lg font-bold text-gray-900">Total:</span>
                                                    <span className="text-xl font-bold text-gray-900">
                                                        {formatCurrency(order.total)}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Action Button */}
                                            {order.status !== "Delivered" && order.status !== "Closed" && (
                                                <Button
                                                    onClick={() => handleStatusUpdate(order.id, nextStatus as any)}
                                                    className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white"
                                                    size="lg"
                                                >
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