import { useState } from "react"
import { Button } from "../components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Badge } from "../components/ui/badge"
import { Plus, Search, Truck, CheckCircle, Clock, ShoppingBag } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { useRestaurant } from "../context/RestaurantContext"
import { Input } from "../components/ui/input"
import { useLanguage } from "../context/LanguageContext"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select"

import { formatCurrency } from "../lib/utils"

export function Orders() {
    const navigate = useNavigate()
    const { orders } = useRestaurant()
    const { t } = useLanguage()
    const [searchQuery, setSearchQuery] = useState("")
    const [typeFilter, setTypeFilter] = useState("all")
    const [statusFilter, setStatusFilter] = useState("all")

    const filteredOrders = orders.filter(order => {
        const matchesSearch = order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (order.table && order.table.toLowerCase().includes(searchQuery.toLowerCase())) ||
            order.customer.toLowerCase().includes(searchQuery.toLowerCase())
        
        const matchesType = typeFilter === "all" || 
            (typeFilter === "delivery" && order.orderType === "delivery") ||
            (typeFilter === "takeout" && order.orderType === "takeout") ||
            (typeFilter === "dine_in" && order.orderType === "dine_in")
        
        const matchesStatus = statusFilter === "all" ||
            (statusFilter === "delivery" && order.orderType === "delivery") ||
            (statusFilter === "pickup" && order.orderType === "takeout")
        
        return matchesSearch && matchesType && matchesStatus
    })

    const getStatusInfo = (status: string) => {
        switch (status.toLowerCase()) {
            case "pending":
            case "preparing":
                return {
                    label: "Pendente",
                    className: "bg-red-100 text-red-700 border-red-200",
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

    return (
        <div className="space-y-8">
            {/* Header */}
            <header className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-4xl font-bold text-gray-800">Pedidos</h1>
                    <p className="text-gray-500 mt-1">Gerenciar pedidos desta mesa</p>
                </div>
                <Button 
                    onClick={() => navigate("/orders/new")}
                    className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-6 rounded-lg flex items-center shadow-sm"
                >
                    <span className="text-2xl font-light mr-2">+</span>
                    Novo Pedido
                </Button>
            </header>

            {/* Filters */}
            <section className="flex items-center space-x-4 mb-8">
                {/* Search Input */}
                <div className="relative flex-grow">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                        <Search className="w-5 h-5 text-gray-400" />
                    </span>
                    <Input
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition"
                        placeholder="Buscar por nome ou código..."
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                {/* Type Filter Dropdown */}
                <div className="w-64 relative">
                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                        <SelectTrigger className="w-full py-3 px-4 border border-gray-300 rounded-lg bg-white focus:ring-blue-500 focus:border-blue-500 transition">
                            <SelectValue placeholder="Tipo de Pedido" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Tipo de Pedido</SelectItem>
                            <SelectItem value="delivery">Delivery</SelectItem>
                            <SelectItem value="pickup">Retirada</SelectItem>
                            <SelectItem value="dine_in">Mesa</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Filter Buttons */}
                <div className="flex items-center border border-gray-300 rounded-lg p-1 bg-white">
                    <Button
                        variant={statusFilter === "all" ? "default" : "ghost"}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors ${
                            statusFilter === "delivery" 
                                ? "text-blue-600 bg-blue-50 border border-blue-200" 
                                : "text-gray-600 hover:bg-gray-100"
                        }`}
                        onClick={() => setStatusFilter(statusFilter === "delivery" ? "all" : "delivery")}
                    >
                        <Truck className="w-5 h-5" />
                        Delivery
                    </Button>
                    <Button
                        variant={statusFilter === "pickup" ? "default" : "ghost"}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors ${
                            statusFilter === "pickup" 
                                ? "text-blue-600 bg-blue-50 border border-blue-200" 
                                : "text-gray-600 hover:bg-gray-100"
                        }`}
                        onClick={() => setStatusFilter(statusFilter === "pickup" ? "all" : "pickup")}
                    >
                        <ShoppingBag className="w-5 h-5" />
                        Retirada
                    </Button>
                </div>
            </section>

            {/* Orders Grid */}
            <main className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                                className="bg-white rounded-xl p-6 shadow-[0_4px_6px_-1px_rgb(0_0_0_/_0.1),_0_2px_4px_-2px_rgb(0_0_0_/_0.1)] cursor-pointer hover:shadow-lg transition-shadow"
                                onClick={() => navigate(`/orders/${order.id}`)}
                            >
                                <div className="flex justify-between items-start mb-4 mb-6">
                                    <h2 className="text-2xl font-bold text-gray-800">{order.customer}</h2>
                                    <span className={`flex items-center gap-2 text-sm font-medium px-3 py-1 rounded-full border ${statusInfo.className}`}>
                                        <StatusIcon className="w-4 h-4" />
                                        {statusInfo.label}
                                    </span>
                                </div>
                                
                                <div className="space-y-4">
                                    {/* Order ID - Highlighted */}
                                    <div className="bg-gradient-to-r from-orange-50 to-orange-100 border border-orange-200 rounded-lg p-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium text-orange-700">ID do Pedido</span>
                                            <div className="bg-orange-500 text-white px-3 py-1 rounded-full">
                                                <span className="font-mono font-bold text-sm tracking-wider">{order.id}</span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-3 text-gray-600">
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
