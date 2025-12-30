import { useState, useEffect } from "react"
import { Button } from "../components/ui/button"
import { Search, Truck, CheckCircle, Clock, ShoppingBag, Armchair } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { useRestaurant } from "../context/RestaurantContext"
import { useSettings } from "../context/SettingsContext"
import { Input } from "../components/ui/input"

import { formatCurrency } from "../lib/utils"

export function Orders() {
    const navigate = useNavigate()
    const { orders } = useRestaurant()
    const { isTablesEnabled } = useSettings()
    const [searchQuery, setSearchQuery] = useState("")
    const [statusFilter, setStatusFilter] = useState("all")

    // Resetar filtro "mesa" se a feature for desabilitada
    useEffect(() => {
        if (!isTablesEnabled && statusFilter === "mesa") {
            setStatusFilter("all")
        }
    }, [isTablesEnabled, statusFilter])

    const filteredOrders = orders.filter(order => {
        const matchesSearch = order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (order.table && order.table.toLowerCase().includes(searchQuery.toLowerCase())) ||
            order.customer.toLowerCase().includes(searchQuery.toLowerCase())
        
        const matchesStatus = statusFilter === "all" ||
            (statusFilter === "delivery" && order.orderType === "delivery") ||
            (statusFilter === "pickup" && order.orderType === "takeout") ||
            (statusFilter === "mesa" && order.orderType === "dine_in")
        
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
            {/* Header */}
            <header className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-4xl font-bold text-foreground">Pedidos</h1>
                    <p className="text-muted-foreground mt-1">Gerenciar pedidos desta mesa</p>
                </div>
                <Button 
                    onClick={() => navigate("/orders/new")}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-2 px-6 rounded-lg flex items-center shadow-sm"
                >
                    <span className="text-2xl font-light mr-2">+</span>
                    Novo Pedido
                </Button>
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
                <div className="flex justify-between items-center gap-2 border border-border rounded-lg p-2 bg-card">
                    <Button
                        variant={statusFilter === "all" ? "default" : "ghost"}
                        className={`flex items-center gap-2 px-3 py-2 rounded-md font-medium transition-colors ${
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
                        className={`flex items-center gap-2 px-3 py-2 rounded-md font-medium transition-colors ${
                            statusFilter === "delivery"
                                ? "text-primary bg-primary/10 border border-primary/20"
                                : "text-muted-foreground hover:bg-accent"
                        }`}
                        onClick={() => setStatusFilter(statusFilter === "delivery" ? "all" : "delivery")}
                    >
                        <Truck className="w-4 h-4" />
                        Delivery
                    </Button>
                    <Button
                        variant={statusFilter === "pickup" ? "default" : "ghost"}
                        className={`flex items-center gap-2 px-3 py-2 rounded-md font-medium transition-colors ${
                            statusFilter === "pickup"
                                ? "text-primary bg-primary/10 border border-primary/20"
                                : "text-muted-foreground hover:bg-accent"
                        }`}
                        onClick={() => setStatusFilter(statusFilter === "pickup" ? "all" : "pickup")}
                    >
                        <ShoppingBag className="w-4 h-4" />
                        Retirada
                    </Button>
                    {isTablesEnabled && (
                        <Button
                            variant={statusFilter === "mesa" ? "default" : "ghost"}
                            className={`flex items-center gap-2 px-3 py-2 rounded-md font-medium transition-colors ${
                                statusFilter === "mesa"
                                    ? "text-primary bg-primary/10 border border-primary/20"
                                    : "text-muted-foreground hover:bg-accent"
                            }`}
                            onClick={() => setStatusFilter(statusFilter === "mesa" ? "all" : "mesa")}
                        >
                            <Armchair className="w-4 h-4" />
                            Mesa
                        </Button>
                    )}
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
                                        <div className="bg-primary text-primary-foreground px-3 py-1 rounded-full">
                                            <span className="font-mono font-bold text-sm tracking-wider">{order.id}</span>
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
