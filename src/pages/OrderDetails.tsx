import { useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Button } from "../components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Badge } from "../components/ui/badge"
import { ArrowLeft, CreditCard, QrCode, Ticket, Clock, Printer, Wallet, Truck, CheckCircle, DollarSign, AlertCircle } from "lucide-react"
import { useRestaurant } from "../context/RestaurantContext"
import { useLanguage } from "../context/LanguageContext"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "../components/ui/dialog"
import { Label } from "../components/ui/label"
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group"

import { formatCurrency } from "../lib/utils"

export function OrderDetails() {
    const { id } = useParams()
    const navigate = useNavigate()
    const { orders, updateOrderStatus, processPayment } = useRestaurant()
    const { t } = useLanguage()
    const [note, setNote] = useState("")
    const [isPaymentOpen, setIsPaymentOpen] = useState(false)
    const [paymentMethod, setPaymentMethod] = useState<"Cash" | "Card" | "Voucher" | "PIX">("Cash")

    const order = orders.find(o => o.id === id)

    if (!order) {
        return <div className="p-8 text-center">{t("orderNotFound")}</div>
    }

    const getNextStatus = (currentStatus: typeof order.status) => {
        const flow = ["Pending", "Preparing", "Ready", "Delivered", "Closed"]
        const currentIndex = flow.indexOf(currentStatus)
        return flow[currentIndex + 1] as typeof order.status | undefined
    }

    const handleStatusUpdate = async () => {
        const nextStatus = getNextStatus(order.status)
        if (nextStatus) {
            const result = await updateOrderStatus(order.id, nextStatus)
            if (!result.success) {
                alert(`Failed to update status: ${result.error}`)
            }
        }
    }

    const handlePayment = async () => {
        const result = await processPayment(order.id, paymentMethod)
        if (result.success) {
            setIsPaymentOpen(false)
        } else {
            alert(`Failed to process payment: ${result.error}`)
        }
    }

    const handlePrint = () => {
        window.print()
    }

    return (
        <>
            <div className="space-y-8">
                <div className="flex items-center justify-between print:hidden">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => navigate("/orders")}>
                            <ArrowLeft className="h-6 w-6" />
                        </Button>
                        <div>
                            <div className="flex items-center gap-4">
                                <h2 className="text-3xl font-bold tracking-tight">{t("orderId")}: {order.id}</h2>
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
                                        className="flex items-center gap-1"
                                    >
                                        {order.status === "Closed" ? <DollarSign className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                                        {order.status === "Closed" ? t("paid") : t("paymentPending")}
                                    </Badge>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground mt-1">
                                <Clock className="h-4 w-4" />
                                <span>{order.time}</span>
                                <span>•</span>
                                <span>{order.table ? `${t("table")} ${order.table}` : (order.orderType ? t(order.orderType === 'dine_in' ? 'dineIn' : order.orderType) : t('dineIn'))}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={handlePrint}>
                            <Printer className="mr-2 h-4 w-4" />
                            {t("printReceipt")}
                        </Button>
                        {order.status !== "Closed" && (
                            <>
                                {order.status !== "Delivered" && (
                                    <Button onClick={handleStatusUpdate}>
                                        {t("updateStatus")} ({t(getNextStatus(order.status)?.toLowerCase() as any) || getNextStatus(order.status)})
                                    </Button>
                                )}
                                <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
                                    <DialogTrigger asChild>
                                        <Button variant="default">
                                            <CreditCard className="mr-2 h-4 w-4" />
                                            {t("payNow")}
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>{t("confirmPayment")}</DialogTitle>
                                            <DialogDescription>
                                                {t("selectPaymentMethod")} {formatCurrency(order.total * 1.1)}.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div className="grid gap-4 py-4">
                                            <RadioGroup
                                                value={paymentMethod}
                                                onValueChange={(value: "Cash" | "Card" | "Voucher" | "PIX") => setPaymentMethod(value)}
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
                                        <DialogFooter>
                                            <Button onClick={handlePayment}>{t("confirmPayment")}</Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            </>
                        )}
                    </div>
                </div>

                <div className="grid gap-6 md:grid-cols-3 print:hidden">
                    <div className="md:col-span-2 space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>{t("items")}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {order.items.map((item) => (
                                        <div key={item.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                                            <div className="flex items-center gap-4">
                                                <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center font-bold">
                                                    {item.quantity}
                                                </div>
                                                <div>
                                                    <div className="font-medium">{item.name}</div>
                                                    <div className="text-sm text-muted-foreground">{formatCurrency(item.price)}</div>
                                                </div>
                                            </div>
                                            <div className="font-bold">{formatCurrency(item.price * item.quantity)}</div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>{t("orderSummary")}</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">{t("subtotal")}</span>
                                    <span>{formatCurrency(order.total)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">{t("tax")} (10%)</span>
                                    <span>{formatCurrency(order.total * 0.1)}</span>
                                </div>
                                <div className="border-t pt-4 flex justify-between font-bold text-lg">
                                    <span>{t("total")}</span>
                                    <span>{formatCurrency(order.total * 1.1)}</span>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>{t("notes")}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    <textarea
                                        className="w-full min-h-[100px] rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                        placeholder={t("typeNote")}
                                        value={note}
                                        onChange={(e) => setNote(e.target.value)}
                                    />
                                    <Button className="w-full" variant="outline">
                                        {t("addNote")}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {/* Printable Receipt Layout */}
                <div className="hidden print:block p-8 max-w-[80mm] mx-auto">
                    <div className="text-center mb-6">
                        <h1 className="text-xl font-bold mb-2">{t("appTitle")}</h1>
                        <p className="text-sm text-muted-foreground">
                            {t("orderId")}: {order.id}<br />
                            {order.time}
                        </p>
                    </div>

                    <div className="border-b border-dashed pb-4 mb-4">
                        <div className="flex justify-between text-sm mb-1">
                            <span>{order.table ? t("table") : t("type")}:</span>
                            <span className="font-medium capitalize">{order.table || (order.orderType ? t(order.orderType === 'dine_in' ? 'dineIn' : order.orderType) : t('dineIn'))}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span>{t("customer")}:</span>
                            <span className="font-medium">{order.customer}</span>
                        </div>
                    </div>

                    <div className="space-y-2 mb-6">
                        {order.items.map((item) => (
                            <div key={item.id} className="flex justify-between text-sm">
                                <span>{item.quantity}x {item.name}</span>
                                <span>{formatCurrency(item.price * item.quantity)}</span>
                            </div>
                        ))}
                    </div>

                    <div className="border-t border-dashed pt-4 space-y-1">
                        <div className="flex justify-between text-sm">
                            <span>{t("subtotal")}</span>
                            <span>{formatCurrency(order.total)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span>{t("tax")} (10%)</span>
                            <span>{formatCurrency(order.total * 0.1)}</span>
                        </div>
                        <div className="flex justify-between font-bold text-lg mt-2">
                            <span>{t("total")}</span>
                            <span>{formatCurrency(order.total * 1.1)}</span>
                        </div>
                        {order.paymentMethod && (
                            <div className="flex justify-between text-sm mt-2 pt-2 border-t border-dashed">
                                <span>{t("paymentMethod")}:</span>
                                <span className="font-medium">{t(order.paymentMethod.toLowerCase() as any) || order.paymentMethod}</span>
                            </div>
                        )}
                        {order.closedAt && (
                            <div className="text-center text-xs text-muted-foreground mt-4">
                                {t("closed")}: {new Date(order.closedAt).toLocaleString()}
                            </div>
                        )}
                    </div>

                    <div className="text-center mt-8 text-sm text-muted-foreground">
                        Thank you for dining with us!
                    </div>
                </div>
            </div>
        </>
    )
}
