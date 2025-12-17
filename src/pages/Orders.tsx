import { useState } from "react"
import { Button } from "../components/ui/button"
import { Search, Truck, CheckCircle, Clock, ShoppingBag, Armchair, Filter, List } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { useRestaurant } from "../context/RestaurantContext"
import { Input } from "../components/ui/input"

import { formatCurrency } from "../lib/utils"

export function Orders() {
    const navigate = useNavigate()
    const { orders } = useRestaurant()
    const [searchQuery, setSearchQuery] = useState("")
    const [statusFilter, setStatusFilter] = useState("all")
    const [typeFilter, setTypeFilter] = useState("all")

    const filteredOrders = orders.filter(order => {
        const matchesSearch = order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (order.table && order.table.toLowerCase().includes(searchQuery.toLowerCase())) ||
            order.customer.toLowerCase().includes(searchQuery.toLowerCase())
        
        const matchesStatus = statusFilter === "all" ||
            (statusFilter === "pending" && (order.status === "Pending" || order.status === "Preparing")) ||
            (statusFilter === "ready" && order.status === "Ready") ||
            (statusFilter === "delivered" && (order.status === "Delivered" || order.status === "Closed"))
        
        const matchesType = typeFilter === "all" ||
            (typeFilter === "delivery" && order.orderType === "delivery") ||
            (typeFilter === "pickup" && order.orderType === "takeout") ||
            (typeFilter === "mesa" && order.orderType === "dine_in")
        
        return matchesSearch && matchesStatus && matchesType
    })

    const getStatusInfo = (status: string) => {
        switch (status) {
            case "Pending":
            case "Preparing":
                return {
                    label: "Pendente",
                    className: "bg-red-100 text-red-700 border-red-200",
                    icon: Clock
                }
            case "Ready":
                return {
                    label: "Pronto",
                    className: "bg-yellow-100 text-yellow-700 border-yellow-200",
                    icon: CheckCircle
                }
            case "Delivered":
            case "Closed":
                return {
                    label: "Entregue",
                    className: "bg-green-100 text-green-700 border-green-200",
                    icon: CheckCircle
                }
            default:
                return {
                    label: status,
                    className: "bg-gray-100 text-gray-700 border-gray-200",
                    icon: Clock
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
                return ShoppingBag
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

    const clearFilters = () => {
        setStatusFilter("all")
        setTypeFilter("all")
        setSearchQuery("")
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <header className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-4xl font-bold text-gray-800">Pedidos</h1>
                    <p className="text-gray-500 mt-1">Gerenciar pedidos do restaurante</p>
                </div>
                <Button 
                    onClick={() => navigate("/orders/new")}
                    className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-8 rounded-xl flex items-center shadow-lg text-lg min-h-[56px] touch-manipulation"
                >
                    <span className="text-3xl font-light mr-3">+</span>
                    Novo Pedido
                </Button>
            </header>

            {/* Filters Section */}
            <section className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200">
                <div className="flex items-center gap-3 mb-6">
                    <Filter className="w-6 h-6 text-gray-600" />
                    <h2 className="text-xl font-semibold text-gray-800">Filtros</h2>
                    {(statusFilter !== "all" || typeFilter !== "all" || searchQuery) && (
                        <Button
                            variant="ghost"
                            onClick={clearFilters}
                            className="ml-auto text-sm text-gray-500 hover:text-gray-700 touch-manipulation"
                        >
                            Limpar Filtros
                        </Button>
                    )}
                </div>

                {/* Search Input */}
                <div className="relative mb-6">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-4">
                        <Search className="w-5 h-5 text-gray-400" />
                    </span>
                    <Input
                        className="w-full pl-12 pr-4 py-4 text-lg border-2 border-gray-300 rounded-xl focus:ring-orange-500 focus:border-orange-500 transition min-h-[56px] touch-manipulation"
                        placeholder="Buscar por nome, código ou mesa..."
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                {/* Status Filter Buttons */}
                <div className="mb-6">
                    <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Status do Pedido
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <Button
                            variant={statusFilter === "all" ? "default" : "outline"}
                            className={`flex flex-col items-center gap-2 py-4 px-6 rounded-xl font-medium transition-colors min-h-[80px] touch-manipulation ${
                                statusFilter === "all"
                                    ? "bg-orange-500 text-white border-orange-500 shadow-lg"
                                    : "bg-white text-gray-700 border-2 border-gray-300 hover:bg-gray-50 hover:border-gray-400"
                            }`}
                            onClick={() => setStatusFilter("all")}
                        >
                            <List className="w-6 h-6" />
                            <span className="text-sm font-semibold">Todos</span>
                        </Button>
                        <Button
                            variant={statusFilter === "pending" ? "default" : "outline"}
                            className={`flex flex-col items-center gap-2 py-4 px-6 rounded-xl font-medium transition-colors min-h-[80px] touch-manipulation ${
                                statusFilter === "pending"
                                    ? "bg-red-500 text-white border-red-500 shadow-lg"
                                    : "bg-white text-gray-700 border-2 border-gray-300 hover:bg-gray-50 hover:border-gray-400"
                            }`}
                            onClick={() => setStatusFilter(statusFilter === "pending" ? "all" : "pending")}
                        >
                            <Clock className="w-6 h-6" />
                            <span className="text-sm font-semibold">Pendente</span>
                        </Button>
                        <Button
                            variant={statusFilter === "ready" ? "default" : "outline"}
                            className={`flex flex-col items-center gap-2 py-4 px-6 rounded-xl font-medium transition-colors min-h-[80px] touch-manipulation ${
                                statusFilter === "ready"
                                    ? "bg-yellow-500 text-white border-yellow-500 shadow-lg"
                                    : "bg-white text-gray-700 border-2 border-gray-300 hover:bg-gray-50 hover:border-gray-400"
                            }`}
                            onClick={() => setStatusFilter(statusFilter === "ready" ? "all" : "ready")}
                        >
                            <CheckCircle className="w-6 h-6" />
                            <span className="text-sm font-semibold">Pronto</span>
                        </Button>
                        <Button
                            variant={statusFilter === "delivered" ? "default" : "outline"}
                            className={`flex flex-col items-center gap-2 py-4 px-6 rounded-xl font-medium transition-colors min-h-[80px] touch-manipulation ${
                                statusFilter === "delivered"
                                    ? "bg-green-500 text-white border-green-500 shadow-lg"
                                    : "bg-white text-gray-700 border-2 border-gray-300 hover:bg-gray-50 hover:border-gray-400"
                            }`}
                            onClick={() => setStatusFilter(statusFilter === "delivered" ? "all" : "delivered")}
                        >
                            <CheckCircle className="w-6 h-6" />
                            <span className="text-sm font-semibold">Entregue</span>
                        </Button>
                    </div>
                </div>

                {/* Type Filter Buttons */}
                <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                        <Armchair className="w-4 h-4" />
                        Tipo de Pedido
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <Button
                            variant={typeFilter === "all" ? "default" : "outline"}
                            className={`flex flex-col items-center gap-2 py-4 px-6 rounded-xl font-medium transition-colors min-h-[80px] touch-manipulation ${
                                typeFilter === "all"
                                    ? "bg-blue-500 text-white border-blue-500 shadow-lg"
                                    : "bg-white text-gray-700 border-2 border-gray-300 hover:bg-gray-50 hover:border-gray-400"
                            }`}
                            onClick={() => setTypeFilter("all")}
                        >
                            <List className="w-6 h-6" />
                            <span className="text-sm font-semibold">Todos</span>
                        </Button>
                        <Button
                            variant={typeFilter === "delivery" ? "default" : "outline"}
                            className={`flex flex-col items-center gap-2 py-4 px-6 rounded-xl font-medium transition-colors min-h-[80px] touch-manipulation ${
                                typeFilter === "delivery"
                                    ? "bg-purple-500 text-white border-purple-500 shadow-lg"
                                    : "bg-white text-gray-700 border-2 border-gray-300 hover:bg-gray-50 hover:border-gray-400"
                            }`}
                            onClick={() => setTypeFilter(typeFilter === "delivery" ? "all" : "delivery")}
                        >
                            <Truck className="w-6 h-6" />
                            <span className="text-sm font-semibold">Delivery</span>
                        </Button>
                        <Button
                            variant={typeFilter === "pickup" ? "default" : "outline"}
                            className={`flex flex-col items-center gap-2 py-4 px-6 rounded-xl font-medium transition-colors min-h-[80px] touch-manipulation ${
                                typeFilter === "pickup"
                                    ? "bg-indigo-500 text-white border-indigo-500 shadow-lg"
                                    : "bg-white text-gray-700 border-2 border-gray-300 hover:bg-gray-50 hover:border-gray-400"
                            }`}
                            onClick={() => setTypeFilter(typeFilter === "pickup" ? "all" : "pickup")}
                        >
                            <ShoppingBag className="w-6 h-6" />
                            <span className="text-sm font-semibold">Retirada</span>
                        </Button>
                        <Button
                            variant={typeFilter === "mesa" ? "default" : "outline"}
                            className={`flex flex-col items-center gap-2 py-4 px-6 rounded-xl font-medium transition-colors min-h-[80px] touch-manipulation ${
                                typeFilter === "mesa"
                                    ? "bg-teal-500 text-white border-teal-500 shadow-lg"
                                    : "bg-white text-gray-700 border-2 border-gray-300 hover:bg-gray-50 hover:border-gray-400"
                            }`}
                            onClick={() => setTypeFilter(typeFilter === "mesa" ? "all" : "mesa")}
                        >
                            <Armchair className="w-6 h-6" />
                            <span className="text-sm font-semibold">Mesa</span>
                        </Button>
                    </div>
                </div>
            </section>

            {/* Results Summary */}
            <div className="flex justify-between items-center">
                <p className="text-gray-600">
                    {filteredOrders.length === 0 
                        ? "Nenhum pedido encontrado" 
                        : `${filteredOrders.length} pedido${filteredOrders.length > 1 ? 's' : ''} encontrado${filteredOrders.length > 1 ? 's' : ''}`
                    }
                </p>
                {(statusFilter !== "all" || typeFilter !== "all" || searchQuery) && (
                    <div className="flex flex-wrap gap-2">
                        {searchQuery && (
                            <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                                Busca: "{searchQuery}"
                            </span>
                        )}
                        {statusFilter !== "all" && (
                            <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm">
                                Status: {statusFilter === "pending" ? "Pendente" : statusFilter === "ready" ? "Pronto" : "Entregue"}
                            </span>
                        )}
                        {typeFilter !== "all" && (
                            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                                Tipo: {typeFilter === "delivery" ? "Delivery" : typeFilter === "pickup" ? "Retirada" : "Mesa"}
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* Orders Grid */}
            <main className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredOrders.length === 0 ? (
                    <div className="col-span-full text-center text-muted-foreground py-16">
                        <div className="text-gray-400 mb-4">
                            <List className="w-16 h-16 mx-auto" />
                        </div>
                        <h3 className="text-xl font-semibold text-gray-600 mb-2">Nenhum pedido encontrado</h3>
                        <p className="text-gray-500">Tente ajustar os filtros ou criar um novo pedido</p>
                    </div>
                ) : (
                    filteredOrders.map((order) => {
                        const statusInfo = getStatusInfo(order.status)
                        const OrderTypeIcon = getOrderTypeIcon(order.orderType || "dine_in")
                        const StatusIcon = statusInfo.icon

                        return (
                            <article
                                key={order.id}
                                className="bg-white rounded-xl p-6 shadow-[0_4px_6px_-1px_rgb(0_0_0_/_0.1),_0_2px_4px_-2px_rgb(0_0_0_/_0.1)] cursor-pointer hover:shadow-xl transition-all duration-200 hover:scale-105 border-2 border-gray-100 touch-manipulation"
                                onClick={() => navigate(`/orders/${order.id}`)}
                            >
                                {/* Order ID - Highlighted */}
                                <div className="bg-gradient-to-r from-orange-50 to-orange-100 border border-orange-200 rounded-lg p-3 mb-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium text-orange-700">ID do Pedido</span>
                                        <div className="bg-orange-500 text-white px-3 py-1 rounded-full">
                                            <span className="font-mono font-bold text-sm tracking-wider">{order.id}</span>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="space-y-4">
                                    <div className="space-y-3 text-gray-600">
                                        <div className="flex justify-between items-start mb-4">
                                            <h2 className="text-xl font-bold text-gray-800">{order.customer}</h2>
                                            <span className={`flex items-center gap-2 text-sm font-medium px-3 py-1 rounded-full border ${statusInfo.className}`}>
                                                <StatusIcon className="w-4 h-4" />
                                                {statusInfo.label}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span>Tipo:</span>
                                            <span className="flex items-center gap-2 font-medium">
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
                                            <span className="font-medium">{order.items.length}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span>Hora:</span>
                                            <span className="font-mono">{order.time.split(' ')[1]}</span>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="border-t pt-4 flex justify-between items-center">
                                    <span className="text-lg font-bold text-gray-800">Total:</span>
                                    <span className="text-2xl font-bold text-gray-900">{formatCurrency(order.total)}</span>
                                </div>
                            </article>
                        )
                    })
                )}
            </main>
        </div>
    )
}
