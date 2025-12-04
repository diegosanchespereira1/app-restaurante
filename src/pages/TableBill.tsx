import { useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Button } from "../components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { ArrowLeft, Wallet, CreditCard, QrCode, Ticket } from "lucide-react"
import { useRestaurant } from "../context/RestaurantContext"
import { useLanguage } from "../context/LanguageContext"
import { formatCurrency } from "../lib/utils"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "../components/ui/dialog"
import { Label } from "../components/ui/label"
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group"

export function TableBill() {
    const { id } = useParams()
    const navigate = useNavigate()
    const { tables, orders, closeTable } = useRestaurant()
    const { t } = useLanguage()

    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<"Cash" | "Card" | "Voucher" | "PIX">("Cash")

    const table = tables.find(t => t.id === Number(id))
    const activeOrders = orders.filter(o => o.table === table?.number && o.status !== "Closed")

    const totalAmount = activeOrders.reduce((sum, order) => sum + order.total, 0)

    const handleCloseTable = async () => {
        if (table) {
            const result = await closeTable(table.id, selectedPaymentMethod)
            if (result.success) {
                navigate("/tables")
            } else {
                alert(`Failed to close table: ${result.error}`)
            }
        }
    }

    if (!table) return <div>{t("tableNotFound")}</div>

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate(`/tables/${id}`)}>
                    <ArrowLeft className="h-6 w-6" />
                </Button>
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">{t("billForTable")} {table.number}</h2>
                    <p className="text-muted-foreground">{t("consolidatedView")}</p>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-6">
                    {activeOrders.map((order) => (
                        <Card key={order.id}>
                            <CardHeader className="pb-2">
                                <div className="flex justify-between items-center">
                                    <CardTitle className="text-base">{t("orderId")}: {order.id}</CardTitle>
                                    <span className="text-sm text-muted-foreground">{order.time}</span>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {order.items.map((item: any) => (
                                        <div key={item.id} className="flex justify-between text-sm">
                                            <span>{item.quantity}x {item.name}</span>
                                            <span>{formatCurrency(item.price * item.quantity)}</span>
                                        </div>
                                    ))}
                                    <div className="border-t pt-2 mt-2 flex justify-between font-bold">
                                        <span>{t("subtotal")}: {formatCurrency(order.total)}</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>{t("orderSummary")}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex justify-between items-center text-lg font-bold">
                                <span>{t("totalAmountDue")}</span>
                                <span className="text-2xl">{formatCurrency(totalAmount)}</span>
                            </div>

                            {activeOrders.length > 0 ? (
                                <div className="space-y-4 pt-4 border-t">
                                    <div className="space-y-2">
                                        <Label>{t("paymentMethod")}</Label>
                                        <RadioGroup
                                            value={selectedPaymentMethod}
                                            onValueChange={(value) => setSelectedPaymentMethod(value as any)}
                                            className="grid grid-cols-2 gap-4"
                                        >
                                            <div>
                                                <RadioGroupItem value="Cash" id="cash" className="peer sr-only" />
                                                <Label
                                                    htmlFor="cash"
                                                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                                                >
                                                    <Wallet className="mb-3 h-6 w-6" />
                                                    {t("cash")}
                                                </Label>
                                            </div>
                                            <div>
                                                <RadioGroupItem value="Card" id="card" className="peer sr-only" />
                                                <Label
                                                    htmlFor="card"
                                                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                                                >
                                                    <CreditCard className="mb-3 h-6 w-6" />
                                                    {t("card")}
                                                </Label>
                                            </div>
                                            <div>
                                                <RadioGroupItem value="Voucher" id="voucher" className="peer sr-only" />
                                                <Label
                                                    htmlFor="voucher"
                                                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                                                >
                                                    <Ticket className="mb-3 h-6 w-6" />
                                                    {t("voucher")}
                                                </Label>
                                            </div>
                                            <div>
                                                <RadioGroupItem value="PIX" id="pix" className="peer sr-only" />
                                                <Label
                                                    htmlFor="pix"
                                                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                                                >
                                                    <QrCode className="mb-3 h-6 w-6" />
                                                    {t("pix")}
                                                </Label>
                                            </div>
                                        </RadioGroup>
                                    </div>

                                    <Dialog>
                                        <DialogTrigger asChild>
                                            <Button className="w-full" size="lg">
                                                {t("closeTableAndPay")}
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent>
                                            <DialogHeader>
                                                <DialogTitle>{t("confirmPayment")}</DialogTitle>
                                                <DialogDescription>
                                                    {t("selectPaymentMethod")} {formatCurrency(totalAmount)}.
                                                    <br />
                                                    {t("closeTableWarning")}
                                                </DialogDescription>
                                            </DialogHeader>
                                            <DialogFooter>
                                                <Button onClick={handleCloseTable}>{t("confirmPayment")}</Button>
                                            </DialogFooter>
                                        </DialogContent>
                                    </Dialog>
                                </div>
                            ) : (
                                <div className="text-center text-muted-foreground py-4">
                                    {t("noActiveOrders")}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
