import { useParams, useNavigate } from "react-router-dom"
import { Button } from "../components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Badge } from "../components/ui/badge"
import { ArrowLeft, Receipt } from "lucide-react"
import { useRestaurant } from "../context/RestaurantContext"
import { useLanguage } from "../context/LanguageContext"
import { formatCurrency } from "../lib/utils"

export function TableDetails() {
    const { id } = useParams()
    const navigate = useNavigate()
    const { tables, orders } = useRestaurant()
    const { t } = useLanguage()

    const table = tables.find(t => t.id === Number(id))
    const tableOrders = orders.filter(o => o.table === table?.number)

    if (!table) {
        return <div className="p-8 text-center">{t("tableNotFound")}</div>
    }

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">{t("tableDetails")} - {table.number}</h2>
                    <p className="text-muted-foreground">{t("manageOrders")}</p>
                </div>
                <Button variant="outline" onClick={() => navigate("/tables")}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    {t("back")}
                </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>{t("tableInfo")}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex justify-between items-center">
                            <span className="font-medium">{t("status")}</span>
                            <Badge
                                variant={
                                    table.status === "Available" ? "success" :
                                        table.status === "Occupied" ? "destructive" : "secondary"
                                }
                            >
                                {t(table.status.toLowerCase() as any) || table.status}
                            </Badge>
                        </div>
                        {table.status === "Occupied" && (
                            <div className="pt-4">
                                <Button className="w-full" onClick={() => navigate(`/tables/${table.id}/bill`)}>
                                    <Receipt className="mr-2 h-4 w-4" />
                                    {t("viewBill")}
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>{t("activeOrders")}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {tableOrders.length === 0 ? (
                            <div className="text-center text-muted-foreground py-8">
                                {t("noOrdersFound")}
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {tableOrders.map((order) => (
                                    <div
                                        key={order.id}
                                        className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                                        onClick={() => navigate(`/orders/${order.id}`, { replace: false })}
                                    >
                                        <div>
                                            <div className="font-medium">
                                                {order.source === 'ifood' && order.ifood_display_id 
                                                    ? order.ifood_display_id 
                                                    : order.id}
                                            </div>
                                            <div className="text-sm text-muted-foreground">
                                                {order.items.length} {t("items")} • {order.time.split(' ')[1]}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <Badge variant="outline">{t(order.status.toLowerCase() as any) || order.status}</Badge>
                                            <div className="font-bold w-20 text-right">{formatCurrency(order.total)}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
