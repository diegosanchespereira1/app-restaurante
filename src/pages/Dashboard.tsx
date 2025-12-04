import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { DollarSign, ShoppingBag, Users, Clock } from "lucide-react"
import { useRestaurant } from "../context/RestaurantContext"
import { useLanguage } from "../context/LanguageContext"
import { formatCurrency } from "../lib/utils"
import { useNavigate } from "react-router-dom"
import { Button } from "../components/ui/button"
import { Plus } from "lucide-react"

export function Dashboard() {
    const navigate = useNavigate()
    const { orders, tables } = useRestaurant()
    const { t } = useLanguage()

    const totalRevenue = orders
        .filter(o => o.status !== "Closed")
        .reduce((sum, order) => sum + order.total, 0)

    const activeOrdersCount = orders.filter(o => o.status !== "Delivered" && o.status !== "Closed").length
    const availableTablesCount = tables.filter(t => t.status === "Available").length

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">{t("dashboard")}</h2>
                    <p className="text-muted-foreground">{t("manageOrders")}</p>
                </div>
                <Button onClick={() => navigate("/orders/new")}>
                    <Plus className="mr-2 h-4 w-4" /> {t("newOrder")}
                </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{t("totalRevenue")}</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{t("activeOrders")}</CardTitle>
                        <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{activeOrdersCount}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{t("availableTables")}</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{availableTablesCount}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{t("recentOrders")}</CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{orders.length}</div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle>Recent Revenue</CardTitle>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                            Chart Placeholder
                        </div>
                    </CardContent>
                </Card>
                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle>{t("recentOrders")}</CardTitle>
                        <p className="text-sm text-muted-foreground">
                            {t("recentOrdersDescription") || "Latest completed transactions."}
                        </p>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-8">
                            {orders
                                .filter(order => order.status === "Closed")
                                .slice(0, 5)
                                .map(order => (
                                    <div key={order.id} className="flex items-center">
                                        <div className="space-y-1">
                                            <p className="text-sm font-medium leading-none">{order.customer}</p>
                                            <p className="text-sm text-muted-foreground">
                                                {order.id} • {order.table ? `${t("table")} ${order.table}` : (order.orderType ? t(order.orderType === 'dine_in' ? 'dineIn' : order.orderType) : t('dineIn'))}
                                            </p>
                                        </div>
                                        <div className="ml-auto font-medium">+{formatCurrency(order.total)}</div>
                                    </div>
                                ))}
                            {orders.filter(order => order.status === "Closed").length === 0 && (
                                <div className="text-center text-muted-foreground py-4">
                                    {t("noOrders")}
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
