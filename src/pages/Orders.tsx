import { useState } from "react"
import { Button } from "../components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Badge } from "../components/ui/badge"
import { Plus, Search, Truck, CheckCircle, Clock, DollarSign, AlertCircle } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { useRestaurant } from "../context/RestaurantContext"
import { Input } from "../components/ui/input"
import { useLanguage } from "../context/LanguageContext"

import { formatCurrency } from "../lib/utils"

export function Orders() {
    const navigate = useNavigate()
    const { orders } = useRestaurant()
    const { t } = useLanguage()
    const [searchQuery, setSearchQuery] = useState("")

    const filteredOrders = orders.filter(order =>
        order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (order.table && order.table.toLowerCase().includes(searchQuery.toLowerCase())) ||
        order.customer.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">{t("orders")}</h2>
                    <p className="text-muted-foreground">{t("manageOrders")}</p>
                </div>
                <Button onClick={() => navigate("/orders/new")}>
                    <Plus className="mr-2 h-4 w-4" /> {t("newOrder")}
                </Button>
            </div>

            <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder={t("searchPlaceholder")}
                        className="pl-8"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredOrders.length === 0 ? (
                    <div className="col-span-full text-center text-muted-foreground py-8">
                        {t("noOrders")}
                    </div>
                ) : (
                    filteredOrders.map((order) => (
                        <Card
                            key={order.id}
                            className="cursor-pointer hover:border-primary transition-colors"
                            onClick={() => navigate(`/orders/${order.id}`)}
                        >
                            <CardHeader className="flex flex-col space-y-2 pb-2">
                                <CardTitle className="text-base font-bold">{order.id}</CardTitle>
                                <div className="flex gap-2">
                                    <Badge
                                        variant={
                                            order.status === "Delivered" ? "success" :
                                                order.status === "Ready" ? "default" :
                                                    order.status === "Closed" ? "secondary" : "destructive"
                                        }
                                        className="flex items-center gap-1"
                                    >
                                        {order.status === "Delivered" && <Truck className="h-3 w-3" />}
                                        {order.status === "Ready" && <CheckCircle className="h-3 w-3" />}
                                        {(order.status === "Pending" || order.status === "Preparing") && <Clock className="h-3 w-3" />}
                                        {order.status === "Closed" && <CheckCircle className="h-3 w-3" />}
                                        {t(order.status.toLowerCase() as any) || order.status}
                                    </Badge>
                                    <Badge
                                        variant={order.status === "Closed" ? "success" : "destructive"}
                                        className="flex items-center gap-1 ml-2"
                                    >
                                        {order.status === "Closed" ? <DollarSign className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                                        {order.status === "Closed" ? t("paid") : t("paymentPending")}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="grid gap-2 text-sm mt-2">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">{t("type")}</span>
                                        <span className="font-medium capitalize">{order.orderType ? t(order.orderType === 'dine_in' ? 'dineIn' : order.orderType) : t('dineIn')}</span>
                                    </div>
                                    {order.table && (
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">{t("table")}</span>
                                            <span className="font-medium">{order.table}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">{t("customer")}</span>
                                        <span className="font-medium truncate max-w-[120px]" title={order.customer}>{order.customer}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">{t("items")}</span>
                                        <span className="font-medium">{order.items.length}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">{t("time")}</span>
                                        <span className="font-medium">{order.time.split(' ')[1]}</span>
                                    </div>
                                    <div className="pt-2 mt-2 border-t flex justify-between items-center">
                                        <span className="font-semibold">{t("total")}</span>
                                        <span className="font-bold text-lg">{formatCurrency(order.total)}</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        </div>
    )
}
