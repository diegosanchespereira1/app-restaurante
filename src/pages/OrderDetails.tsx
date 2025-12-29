import { useState, useEffect, useMemo } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Button } from "../components/ui/button"
import { Clock, CheckCircle, CreditCard, QrCode, Ticket, Wallet, Printer } from "lucide-react"
import { useRestaurant } from "../context/RestaurantContext"
import { useLanguage } from "../context/LanguageContext"
import { useSettings } from "../context/SettingsContext"
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
import { Input } from "../components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select"

import { formatCurrency, calculatePriceWithDiscount } from "../lib/utils"
import { printReceipt } from "../lib/printer"
import { supabase, isSupabaseConfigured } from "../lib/supabase"
import type { Product } from "../types/product"

export function OrderDetails() {
    const { id } = useParams()
    const navigate = useNavigate()
    const { orders, updateOrderStatus, processPayment, menuItems } = useRestaurant()
    const { t } = useLanguage()
    const { printerSettings } = useSettings()
    const [note, setNote] = useState("")
    const [isPaymentOpen, setIsPaymentOpen] = useState(false)
    const [paymentMethod, setPaymentMethod] = useState<"Cash" | "Card" | "Voucher" | "PIX">("Cash")
    const [products, setProducts] = useState<Product[]>([])
    const [paymentDiscountType, setPaymentDiscountType] = useState<"fixed" | "percentage" | null>(null)
    const [paymentDiscountValue, setPaymentDiscountValue] = useState<number | null>(null)

    const order = orders.find(o => o.id === id)

    // Buscar produtos completos para aplicar desconto
    useEffect(() => {
        if (!isSupabaseConfigured || !order) return

        const fetchProducts = async () => {
            const productIds = order.items.map(item => item.id).filter(id => id != null)
            
            if (productIds.length === 0) return

            const { data, error } = await supabase
                .from('products')
                .select('*')
                .in('id', productIds)

            if (!error && data) {
                setProducts(data)
            }
        }

        fetchProducts()
    }, [order, isSupabaseConfigured])

    // Calcular subtotal com desconto por método de pagamento
    const subtotalWithPaymentDiscount = useMemo(() => {
        if (!order) return 0
        
        let subtotal = 0
        
        for (const item of order.items) {
            const product = products.find(p => p.id === item.id)
            const menuItem = menuItems.find(m => m.id === item.id)
            
            const basePrice = item.price
            const discountType = product?.discount_type || menuItem?.discount_type
            const discountValue = product?.discount_value || menuItem?.discount_value
            const discountAppliesTo = product?.discount_applies_to || menuItem?.discount_applies_to
            
            const priceWithDiscount = calculatePriceWithDiscount(
                basePrice,
                discountType,
                discountValue,
                discountAppliesTo,
                paymentMethod
            )
            
            subtotal += priceWithDiscount * item.quantity
        }
        
        return subtotal
    }, [order, products, menuItems, paymentMethod])

    // Calcular total com desconto aplicado (incluindo desconto do pedido e desconto no pagamento)
    const totalWithDiscount = useMemo(() => {
        if (!order) return 0
        
        let total = subtotalWithPaymentDiscount
        
        // Aplicar desconto do pedido se existir
        if (order.order_discount_type && order.order_discount_value !== null && order.order_discount_value !== undefined && order.order_discount_value > 0) {
            if (order.order_discount_type === 'fixed') {
                total = Math.max(0, total - order.order_discount_value)
            } else if (order.order_discount_type === 'percentage') {
                const discountAmount = (total * order.order_discount_value) / 100
                total = Math.max(0, total - discountAmount)
            }
        }
        
        // Aplicar desconto no pagamento se existir
        if (paymentDiscountType && paymentDiscountValue !== null && paymentDiscountValue > 0) {
            if (paymentDiscountType === 'fixed') {
                total = Math.max(0, total - paymentDiscountValue)
            } else if (paymentDiscountType === 'percentage') {
                const discountAmount = (total * paymentDiscountValue) / 100
                total = Math.max(0, total - discountAmount)
            }
        }
        
        return total
    }, [order, subtotalWithPaymentDiscount, paymentDiscountType, paymentDiscountValue])

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

    const handlePrint = async () => {
        if (printerSettings.enabled) {
            // Usa o módulo de impressão configurado
            const printData = {
                orderId: order.id,
                customer: order.customer,
                table: order.table,
                orderType: order.orderType,
                items: order.items.map(item => ({
                    name: item.name,
                    quantity: item.quantity,
                    price: item.price
                })),
                subtotal: order.total,
                total: order.total,
                paymentMethod: order.paymentMethod,
                notes: note || undefined,
                date: new Date().toLocaleDateString('pt-BR'),
                time: order.time || new Date().toLocaleTimeString('pt-BR')
            }
            
            const success = await printReceipt(printData, printerSettings)
            if (!success) {
                alert('Erro ao imprimir recibo. Verifique as configurações da impressora.')
            }
        } else {
            // Fallback para impressão padrão do navegador
            window.print()
        }
    }

    const getStatusColor = (status: typeof order.status) => {
        switch (status) {
            case "Pending": return "bg-yellow-500"
            case "Preparing": return "bg-yellow-500"
            case "Ready": return "bg-green-500"
            case "Delivered": return "bg-blue-500"
            case "Closed": return "bg-gray-500"
            default: return "bg-gray-500"
        }
    }

    const getStatusIcon = (status: typeof order.status) => {
        switch (status) {
            case "Ready": 
            case "Delivered": 
            case "Closed": return <CheckCircle className="h-6 w-6 text-white" />
            default: return <Clock className="h-6 w-6 text-white" />
        }
    }

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8">
            {/* BEGIN: MainHeader */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
                {/* Header Left: Title and Metadata */}
                <div>
                    <div className="flex items-center gap-4">
                        {/* Back arrow icon */}
                        <button 
                            className="text-gray-500 hover:text-gray-800 text-2xl" 
                            onClick={() => navigate("/orders")}
                        >
                            ←
                        </button>
                        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 font-extrabold">
                            {t("orderId")}: {order.id}
                        </h1>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600 mt-2 ml-10">
                        <div className="flex items-center gap-1.5">
                            <Clock className="h-4 w-4" />
                            <span>{order.time}</span>
                        </div>
                        <span>•</span>
                        <span>{order.table ? `${t("table")} ${order.table}` : (order.orderType ? t(order.orderType === 'dine_in' ? 'dineIn' : order.orderType) : t('dineIn'))}</span>
                        <span>•</span>
                        <span>{t("customer")}: {order.customer}</span>
                    </div>
                </div>
                {/* Header Right: Action Buttons */}
                <div className="flex items-center gap-2 mt-4 md:mt-0 w-full md:w-auto">
                    <Button 
                        variant="outline" 
                        onClick={handlePrint}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 hover:bg-gray-200 text-gray-700 border-gray-200 bg-gray-100"
                    >
                        <Printer className="h-5 w-5" />
                        {t("printReceipt")}
                    </Button>
                    {order.status !== "Closed" && (
                        <>
                            {order.status !== "Delivered" && (
                                <Button 
                                    onClick={handleStatusUpdate}
                                    className="flex-1 md:flex-none bg-orange-500 hover:bg-opacity-90 text-white"
                                >
                                    {t("updateStatus")} ({t(getNextStatus(order.status)?.toLowerCase() as any) || getNextStatus(order.status)})
                                </Button>
                            )}
                            <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
                                <DialogTrigger asChild>
                                    <Button className="flex-1 md:flex-none bg-orange-600 hover:bg-orange-700 text-white">
                                        {t("payNow")}
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>{t("confirmPayment")}</DialogTitle>
                                        <DialogDescription>
                                            {t("selectPaymentMethod")} {formatCurrency(totalWithDiscount)}.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="grid gap-4 py-4">
                                        <div className="space-y-2">
                                            <Label>{t("paymentMethod")}</Label>
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

                                        {/* Campo de Desconto no Pagamento */}
                                        <div className="space-y-2">
                                            <Label>Desconto no Pagamento</Label>
                                            <div className="flex gap-2">
                                                <Select
                                                    value={paymentDiscountType || 'none'}
                                                    onValueChange={(value) => {
                                                        if (value === 'none') {
                                                            setPaymentDiscountType(null)
                                                            setPaymentDiscountValue(null)
                                                        } else {
                                                            setPaymentDiscountType(value as "fixed" | "percentage")
                                                            if (paymentDiscountValue === null) {
                                                                setPaymentDiscountValue(0)
                                                            }
                                                        }
                                                    }}
                                                >
                                                    <SelectTrigger className="flex-1">
                                                        <SelectValue placeholder="Tipo" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="none">Sem desconto</SelectItem>
                                                        <SelectItem value="fixed">Valor fixo (R$)</SelectItem>
                                                        <SelectItem value="percentage">Percentual (%)</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                {paymentDiscountType && (
                                                    <Input
                                                        type="number"
                                                        step={paymentDiscountType === 'fixed' ? "0.01" : "0.1"}
                                                        min="0"
                                                        max={paymentDiscountType === 'percentage' ? "100" : undefined}
                                                        value={paymentDiscountValue || ''}
                                                        onChange={(e) => setPaymentDiscountValue(e.target.value ? parseFloat(e.target.value) : null)}
                                                        placeholder={paymentDiscountType === 'fixed' ? "0.00" : "0"}
                                                        className="flex-1"
                                                    />
                                                )}
                                            </div>
                                        </div>

                                        {/* Resumo de valores */}
                                        <div className="space-y-2 pt-2 border-t">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-muted-foreground">Subtotal:</span>
                                                <span>{formatCurrency(subtotalWithPaymentDiscount)}</span>
                                            </div>
                                            {order.order_discount_type && order.order_discount_value !== null && order.order_discount_value !== undefined && order.order_discount_value > 0 && (
                                                <div className="flex justify-between text-sm text-green-600">
                                                    <span>Desconto do Pedido:</span>
                                                    <span>
                                                        {order.order_discount_type === 'fixed' 
                                                            ? `-${formatCurrency(order.order_discount_value)}`
                                                            : `-${formatCurrency((subtotalWithPaymentDiscount * order.order_discount_value) / 100)}`
                                                        }
                                                    </span>
                                                </div>
                                            )}
                                            {paymentDiscountType && paymentDiscountValue !== null && paymentDiscountValue > 0 && (
                                                <div className="flex justify-between text-sm text-green-600">
                                                    <span>Desconto no Pagamento:</span>
                                                    <span>
                                                        {paymentDiscountType === 'fixed' 
                                                            ? `-${formatCurrency(paymentDiscountValue)}`
                                                            : `-${formatCurrency(((() => {
                                                                let base = subtotalWithPaymentDiscount
                                                                if (order.order_discount_type && order.order_discount_value !== null && order.order_discount_value !== undefined && order.order_discount_value > 0) {
                                                                    if (order.order_discount_type === 'fixed') {
                                                                        base = Math.max(0, base - order.order_discount_value)
                                                                    } else {
                                                                        base = Math.max(0, base - (base * order.order_discount_value) / 100)
                                                                    }
                                                                }
                                                                return base
                                                            })() * paymentDiscountValue) / 100)}`
                                                        }
                                                    </span>
                                                </div>
                                            )}
                                            <div className="flex justify-between font-bold pt-2 border-t">
                                                <span>Total:</span>
                                                {(() => {
                                                    const hasDiscount = totalWithDiscount < subtotalWithPaymentDiscount
                                                    return hasDiscount ? (
                                                        <div className="flex flex-col items-end">
                                                            <span className="line-through text-muted-foreground text-sm">
                                                                {formatCurrency(subtotalWithPaymentDiscount)}
                                                            </span>
                                                            <span className="text-green-600 text-lg">
                                                                {formatCurrency(totalWithDiscount)}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span>{formatCurrency(totalWithDiscount)}</span>
                                                    )
                                                })()}
                                            </div>
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button onClick={handlePayment}>{t("confirmPayment")}</Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </>
                    )}
                </div>
            </header>
            {/* END: MainHeader */}

            {/* BEGIN: MainContent */}
            <main className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Summary Cards */}
                <div className="lg:col-span-1 flex flex-col space-y-6">
                    {/* Total Value Card - PROMINENT */}
                    <section className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
                        <h2 className="text-base font-medium text-gray-700 mb-1">{t("total")}</h2>
                        {(() => {
                            const hasDiscount = totalWithDiscount < order.total
                            return hasDiscount ? (
                                <div className="flex flex-col">
                                    <span className="line-through text-muted-foreground text-xl">
                                        {formatCurrency(order.total)}
                                    </span>
                                    <span className="text-4xl font-bold text-green-600">
                                        {formatCurrency(totalWithDiscount)}
                                    </span>
                                </div>
                            ) : (
                                <p className="text-4xl font-bold text-gray-900">{formatCurrency(order.total)}</p>
                            )
                        })()}
                    </section>

                    {/* Order Status Card */}
                    <section className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
                        <h3 className="text-base font-medium text-gray-700 mb-3">{t("status")} {t("orderType")}</h3>
                        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg font-semibold text-base text-white ${getStatusColor(order.status)}`}>
                            {getStatusIcon(order.status)}
                            <span>{t(order.status.toLowerCase() as any) || order.status}</span>
                        </div>
                    </section>

                    {/* Order Summary Card */}
                    <section className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
                        <h3 className="text-base font-medium text-gray-700 mb-4">{t("orderSummary")}</h3>
                        <div className="space-y-2 text-sm text-gray-600 mb-4">
                            <div className="flex justify-between">
                                <span>{t("subtotal")}</span>
                                <span>{formatCurrency(order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0))}</span>
                            </div>
                            {/* Desconto do pedido se existir */}
                            {order.order_discount_type && order.order_discount_value !== null && order.order_discount_value !== undefined && order.order_discount_value > 0 && (
                                <div className="flex justify-between text-green-600">
                                    <span>Desconto do Pedido:</span>
                                    <span>
                                        {order.order_discount_type === 'fixed' 
                                            ? `-${formatCurrency(order.order_discount_value || 0)}`
                                            : `-${formatCurrency((order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0) * (order.order_discount_value || 0)) / 100)}`
                                        }
                                    </span>
                                </div>
                            )}
                            {/* Desconto por método de pagamento */}
                            {(() => {
                                const subtotal = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0)
                                const orderDiscount = order.order_discount_type && order.order_discount_value !== null && order.order_discount_value !== undefined && order.order_discount_value > 0
                                    ? (order.order_discount_type === 'fixed' 
                                        ? order.order_discount_value 
                                        : (subtotal * order.order_discount_value) / 100)
                                    : 0
                                const subtotalAfterOrderDiscount = subtotal - orderDiscount
                                const hasPaymentDiscount = totalWithDiscount < subtotalAfterOrderDiscount
                                
                                if (hasPaymentDiscount) {
                                    return (
                                        <div className="flex justify-between text-green-600">
                                            <span>Desconto por Pagamento:</span>
                                            <span>-{formatCurrency(subtotalAfterOrderDiscount - totalWithDiscount)}</span>
                                        </div>
                                    )
                                }
                                return null
                            })()}
                            <div className="flex justify-between font-bold pt-2 border-t">
                                <span>{t("total")}:</span>
                                {(() => {
                                    const hasDiscount = totalWithDiscount < order.total
                                    return hasDiscount ? (
                                        <div className="flex flex-col items-end">
                                            <span className="line-through text-muted-foreground text-sm">
                                                {formatCurrency(order.total)}
                                            </span>
                                            <span className="text-green-600">{formatCurrency(totalWithDiscount)}</span>
                                        </div>
                                    ) : (
                                        <span>{formatCurrency(order.total)}</span>
                                    )
                                })()}
                            </div>
                        </div>
                        {order.status !== "Closed" && (
                            <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
                                <DialogTrigger asChild>
                                    <Button className="w-full bg-orange-600 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center space-x-2 text-base hover:bg-orange-700 transition-colors">
                                        <CreditCard className="h-5 w-5" />
                                        <span>{t("payNow")}</span>
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>{t("confirmPayment")}</DialogTitle>
                                        <DialogDescription>
                                            {t("selectPaymentMethod")} {formatCurrency(totalWithDiscount)}.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="grid gap-4 py-4">
                                        <div className="space-y-2">
                                            <Label>{t("paymentMethod")}</Label>
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

                                        {/* Campo de Desconto no Pagamento */}
                                        <div className="space-y-2">
                                            <Label>Desconto no Pagamento</Label>
                                            <div className="flex gap-2">
                                                <Select
                                                    value={paymentDiscountType || 'none'}
                                                    onValueChange={(value) => {
                                                        if (value === 'none') {
                                                            setPaymentDiscountType(null)
                                                            setPaymentDiscountValue(null)
                                                        } else {
                                                            setPaymentDiscountType(value as "fixed" | "percentage")
                                                            if (paymentDiscountValue === null) {
                                                                setPaymentDiscountValue(0)
                                                            }
                                                        }
                                                    }}
                                                >
                                                    <SelectTrigger className="flex-1">
                                                        <SelectValue placeholder="Tipo" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="none">Sem desconto</SelectItem>
                                                        <SelectItem value="fixed">Valor fixo (R$)</SelectItem>
                                                        <SelectItem value="percentage">Percentual (%)</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                {paymentDiscountType && (
                                                    <Input
                                                        type="number"
                                                        step={paymentDiscountType === 'fixed' ? "0.01" : "0.1"}
                                                        min="0"
                                                        max={paymentDiscountType === 'percentage' ? "100" : undefined}
                                                        value={paymentDiscountValue || ''}
                                                        onChange={(e) => setPaymentDiscountValue(e.target.value ? parseFloat(e.target.value) : null)}
                                                        placeholder={paymentDiscountType === 'fixed' ? "0.00" : "0"}
                                                        className="flex-1"
                                                    />
                                                )}
                                            </div>
                                        </div>

                                        {/* Resumo de valores */}
                                        <div className="space-y-2 pt-2 border-t">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-muted-foreground">Subtotal:</span>
                                                <span>{formatCurrency(subtotalWithPaymentDiscount)}</span>
                                            </div>
                                            {order.order_discount_type && order.order_discount_value !== null && order.order_discount_value !== undefined && order.order_discount_value > 0 && (
                                                <div className="flex justify-between text-sm text-green-600">
                                                    <span>Desconto do Pedido:</span>
                                                    <span>
                                                        {order.order_discount_type === 'fixed' 
                                                            ? `-${formatCurrency(order.order_discount_value)}`
                                                            : `-${formatCurrency((subtotalWithPaymentDiscount * order.order_discount_value) / 100)}`
                                                        }
                                                    </span>
                                                </div>
                                            )}
                                            {paymentDiscountType && paymentDiscountValue !== null && paymentDiscountValue > 0 && (
                                                <div className="flex justify-between text-sm text-green-600">
                                                    <span>Desconto no Pagamento:</span>
                                                    <span>
                                                        {paymentDiscountType === 'fixed' 
                                                            ? `-${formatCurrency(paymentDiscountValue)}`
                                                            : `-${formatCurrency(((() => {
                                                                let base = subtotalWithPaymentDiscount
                                                                if (order.order_discount_type && order.order_discount_value !== null && order.order_discount_value !== undefined && order.order_discount_value > 0) {
                                                                    if (order.order_discount_type === 'fixed') {
                                                                        base = Math.max(0, base - order.order_discount_value)
                                                                    } else {
                                                                        base = Math.max(0, base - (base * order.order_discount_value) / 100)
                                                                    }
                                                                }
                                                                return base
                                                            })() * paymentDiscountValue) / 100)}`
                                                        }
                                                    </span>
                                                </div>
                                            )}
                                            <div className="flex justify-between font-bold pt-2 border-t">
                                                <span>Total:</span>
                                                {(() => {
                                                    const hasDiscount = totalWithDiscount < subtotalWithPaymentDiscount
                                                    return hasDiscount ? (
                                                        <div className="flex flex-col items-end">
                                                            <span className="line-through text-muted-foreground text-sm">
                                                                {formatCurrency(subtotalWithPaymentDiscount)}
                                                            </span>
                                                            <span className="text-green-600 text-lg">
                                                                {formatCurrency(totalWithDiscount)}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span>{formatCurrency(totalWithDiscount)}</span>
                                                    )
                                                })()}
                                            </div>
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button onClick={handlePayment}>{t("confirmPayment")}</Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        )}
                    </section>

                    {/* Observations Card */}
                    <section className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
                        <h3 className="text-base font-medium text-gray-700 mb-3">{t("notes")}</h3>
                        <textarea 
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition text-sm" 
                            placeholder={t("typeNote")} 
                            rows={4}
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                        />
                        <Button 
                            className="w-full mt-3 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-100 transition-colors bg-white text-gray-700" 
                            disabled={!note.trim()}
                        >
                            {t("addNote")}
                        </Button>
                    </section>
                </div>

                {/* Right Column: Order Items */}
                <section className="lg:col-span-2">
                    <div className="bg-white p-6 rounded-xl shadow-md h-full border border-gray-100">
                        <h2 className="text-xl font-semibold text-gray-900 mb-5">{t("items")}</h2>
                        <ul className="space-y-6">
                            {order.items.map((item, index) => (
                                <li key={item.id} className="flex items-center pb-4 border-b border-gray-200 last:border-b-0">
                                    <div className="flex items-center justify-center h-8 w-8 bg-gray-100 rounded-full text-sm font-semibold text-gray-600 mr-4">
                                        {index + 1}
                                    </div>
                                    <div className="flex-grow">
                                        <p className="font-medium text-gray-900">{item.name}</p>
                                        <p className="text-sm text-gray-600">{formatCurrency(item.price)}</p>
                                    </div>
                                    <p className="text-gray-900 text-sm font-medium">
                                        {item.quantity}x {formatCurrency(item.price * item.quantity)}
                                    </p>
                                </li>
                            ))}
                        </ul>
                    </div>
                </section>
            </main>
            {/* END: MainContent */}
        </div>
    )
}
