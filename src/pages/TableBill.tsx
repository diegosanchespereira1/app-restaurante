import { useState, useEffect, useMemo } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Button } from "../components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { ArrowLeft, Wallet, CreditCard, QrCode, Ticket } from "lucide-react"
import { useRestaurant } from "../context/RestaurantContext"
import { useLanguage } from "../context/LanguageContext"
import { useSettings } from "../context/SettingsContext"
import { formatCurrency, calculatePriceWithDiscount, validatePaymentDiscount } from "../lib/utils"
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
import { Input } from "../components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select"
import { supabase, isSupabaseConfigured } from "../lib/supabase"
import type { Product } from "../types/product"

export function TableBill() {
    const { id } = useParams()
    const navigate = useNavigate()
    const { tables, orders, closeTable, menuItems } = useRestaurant()
    const { t } = useLanguage()
    const { settings } = useSettings()

    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<"Cash" | "Card" | "Voucher" | "PIX">("Cash")
    const [products, setProducts] = useState<Product[]>([])
    const [paymentDiscountType, setPaymentDiscountType] = useState<"fixed" | "percentage" | null>(null)
    const [paymentDiscountValue, setPaymentDiscountValue] = useState<number | null>(null)
    const [discountError, setDiscountError] = useState<string | null>(null)

    const table = tables.find(t => t.id === Number(id))
    const activeOrders = orders.filter(o => o.table === table?.number && o.status !== "Closed")

    // Buscar produtos completos para aplicar desconto
    useEffect(() => {
        if (!isSupabaseConfigured || activeOrders.length === 0) return

        const fetchProducts = async () => {
            const productIds = activeOrders.flatMap(order => 
                order.items.map(item => item.id).filter(id => id != null)
            )
            
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
    }, [activeOrders, isSupabaseConfigured])

    // Calcular subtotal com desconto por método de pagamento
    const subtotalWithPaymentDiscount = useMemo(() => {
        let total = 0
        
        for (const order of activeOrders) {
            // Primeiro, calcular subtotal do pedido com desconto por método de pagamento
            let orderSubtotal = 0
            
            for (const item of order.items) {
                const product = products.find(p => p.id === item.id)
                const menuItem = menuItems.find(m => m.id === item.id)
                
                // Usar produto completo se disponível, senão usar menuItem
                const basePrice = item.price // Preço original do item no pedido
                const discountType = product?.discount_type || menuItem?.discount_type
                const discountValue = product?.discount_value || menuItem?.discount_value
                const discountAppliesTo = product?.discount_applies_to || menuItem?.discount_applies_to
                
                const priceWithDiscount = calculatePriceWithDiscount(
                    basePrice,
                    discountType,
                    discountValue,
                    discountAppliesTo,
                    selectedPaymentMethod
                )
                
                orderSubtotal += priceWithDiscount * item.quantity
            }
            
            // Aplicar desconto do pedido se existir
            if (order.order_discount_type && order.order_discount_value !== null && order.order_discount_value !== undefined && order.order_discount_value > 0) {
                if (order.order_discount_type === 'fixed') {
                    orderSubtotal = Math.max(0, orderSubtotal - order.order_discount_value)
                } else if (order.order_discount_type === 'percentage') {
                    const discountAmount = (orderSubtotal * order.order_discount_value) / 100
                    orderSubtotal = Math.max(0, orderSubtotal - discountAmount)
                }
            }
            
            total += orderSubtotal
        }
        
        return total
    }, [activeOrders, products, menuItems, selectedPaymentMethod])

    // Calcular subtotal antes do desconto no pagamento
    const subtotalBeforePaymentDiscount = useMemo(() => {
        return subtotalWithPaymentDiscount
    }, [subtotalWithPaymentDiscount])

    // Calcular total com desconto no pagamento aplicado
    const totalAmount = useMemo(() => {
        let total = subtotalBeforePaymentDiscount
        
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
    }, [subtotalBeforePaymentDiscount, paymentDiscountType, paymentDiscountValue])

    // Validar desconto quando o valor mudar
    useEffect(() => {
        if (paymentDiscountType && paymentDiscountValue !== null && paymentDiscountValue > 0) {
            const validation = validatePaymentDiscount(
                paymentDiscountType,
                paymentDiscountValue,
                settings.paymentDiscountLimitType,
                settings.paymentDiscountLimitValue,
                subtotalBeforePaymentDiscount
            )
            
            if (!validation.isValid) {
                setDiscountError(validation.errorMessage || null)
            } else {
                setDiscountError(null)
            }
        } else {
            setDiscountError(null)
        }
    }, [paymentDiscountType, paymentDiscountValue, settings.paymentDiscountLimitType, settings.paymentDiscountLimitValue, subtotalBeforePaymentDiscount])

    const handleCloseTable = async () => {
        // Validar desconto antes de fechar a mesa
        if (paymentDiscountType && paymentDiscountValue !== null && paymentDiscountValue > 0) {
            const validation = validatePaymentDiscount(
                paymentDiscountType,
                paymentDiscountValue,
                settings.paymentDiscountLimitType,
                settings.paymentDiscountLimitValue,
                subtotalBeforePaymentDiscount
            )
            
            if (!validation.isValid) {
                alert(validation.errorMessage || 'Limite de desconto maior do que o permitido.')
                return
            }
        }

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
                                    <CardTitle className="text-base">{t("orderId")}: {order.source === 'ifood' && order.ifood_display_id 
                                        ? order.ifood_display_id 
                                        : order.id}</CardTitle>
                                    <span className="text-sm text-muted-foreground">{order.time}</span>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {order.items.map((item: any) => {
                                        const product = products.find(p => p.id === item.id)
                                        const menuItem = menuItems.find(m => m.id === item.id)
                                        const discountType = product?.discount_type || menuItem?.discount_type
                                        const discountValue = product?.discount_value || menuItem?.discount_value
                                        const discountAppliesTo = product?.discount_applies_to || menuItem?.discount_applies_to
                                        
                                        const priceWithDiscount = calculatePriceWithDiscount(
                                            item.price,
                                            discountType,
                                            discountValue,
                                            discountAppliesTo,
                                            selectedPaymentMethod
                                        )
                                        
                                        const hasDiscount = discountType && discountValue && discountAppliesTo?.includes(selectedPaymentMethod)
                                        
                                        return (
                                            <div key={item.id} className="flex justify-between text-sm">
                                                <span>{item.quantity}x {item.name}</span>
                                                <div className="flex flex-col items-end">
                                                    {hasDiscount && item.price !== priceWithDiscount ? (
                                                        <>
                                                            <span className="line-through text-muted-foreground text-xs">
                                                                {formatCurrency(item.price * item.quantity)}
                                                            </span>
                                                            <span className="text-green-600 font-semibold">
                                                                {formatCurrency(priceWithDiscount * item.quantity)}
                                                            </span>
                                                        </>
                                                    ) : (
                                                        <span>{formatCurrency(priceWithDiscount * item.quantity)}</span>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                    {(() => {
                                        // Calcular subtotal do pedido com desconto por método de pagamento
                                        let orderSubtotal = order.items.reduce((sum: number, item: any) => {
                                            const product = products.find(p => p.id === item.id)
                                            const menuItem = menuItems.find(m => m.id === item.id)
                                            const priceWithDiscount = calculatePriceWithDiscount(
                                                item.price,
                                                product?.discount_type || menuItem?.discount_type,
                                                product?.discount_value || menuItem?.discount_value,
                                                product?.discount_applies_to || menuItem?.discount_applies_to,
                                                selectedPaymentMethod
                                            )
                                            return sum + (priceWithDiscount * item.quantity)
                                        }, 0)
                                        
                                        // Aplicar desconto do pedido se existir
                                        const originalSubtotal = orderSubtotal
                                        if (order.order_discount_type && order.order_discount_value !== null && order.order_discount_value !== undefined && order.order_discount_value > 0) {
                                            if (order.order_discount_type === 'fixed') {
                                                orderSubtotal = Math.max(0, orderSubtotal - order.order_discount_value)
                                            } else if (order.order_discount_type === 'percentage') {
                                                const discountAmount = (orderSubtotal * order.order_discount_value) / 100
                                                orderSubtotal = Math.max(0, orderSubtotal - discountAmount)
                                            }
                                        }
                                        
                                        const hasOrderDiscount = orderSubtotal < originalSubtotal
                                        
                                        return (
                                            <div className="border-t pt-2 mt-2 space-y-1">
                                                {hasOrderDiscount && (
                                                    <div className="flex justify-between text-xs text-green-600">
                                                        <span>Desconto do Pedido:</span>
                                                    <span>
                                                        {order.order_discount_type === 'fixed' 
                                                            ? `-${formatCurrency(order.order_discount_value || 0)}`
                                                            : `-${formatCurrency((originalSubtotal * (order.order_discount_value || 0)) / 100)}`
                                                        }
                                                    </span>
                                                    </div>
                                                )}
                                                <div className="flex justify-between font-bold">
                                                    <span>{t("subtotal")}:</span>
                                                    {hasOrderDiscount ? (
                                                        <div className="flex flex-col items-end">
                                                            <span className="line-through text-muted-foreground text-xs">
                                                                {formatCurrency(originalSubtotal)}
                                                            </span>
                                                            <span className="text-green-600">
                                                                {formatCurrency(orderSubtotal)}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span>{formatCurrency(orderSubtotal)}</span>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })()}
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
                                <div className="flex flex-col items-end">
                                    {(() => {
                                        const originalTotal = activeOrders.reduce((sum, order) => sum + order.total, 0)
                                        const hasDiscount = totalAmount < originalTotal
                                        return hasDiscount ? (
                                            <>
                                                <span className="line-through text-muted-foreground text-base">
                                                    {formatCurrency(originalTotal)}
                                                </span>
                                                <span className="text-2xl text-green-600">
                                                    {formatCurrency(totalAmount)}
                                                </span>
                                            </>
                                        ) : (
                                            <span className="text-2xl">{formatCurrency(totalAmount)}</span>
                                        )
                                    })()}
                                </div>
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
                                            <div className="grid gap-4 py-4">
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
                                                                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-orange-600 peer-data-[state=checked]:bg-orange-50 peer-data-[state=checked]:text-orange-900 peer-data-[state=checked]:shadow-md [&:has([data-state=checked])]:border-orange-600 [&:has([data-state=checked])]:bg-orange-50 [&:has([data-state=checked])]:text-orange-900 [&:has([data-state=checked])]:shadow-md"
                                                            >
                                                                <Wallet className="mb-3 h-6 w-6" />
                                                                {t("cash")}
                                                            </Label>
                                                        </div>
                                                        <div>
                                                            <RadioGroupItem value="Card" id="card" className="peer sr-only" />
                                                            <Label
                                                                htmlFor="card"
                                                                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-orange-600 peer-data-[state=checked]:bg-orange-50 peer-data-[state=checked]:text-orange-900 peer-data-[state=checked]:shadow-md [&:has([data-state=checked])]:border-orange-600 [&:has([data-state=checked])]:bg-orange-50 [&:has([data-state=checked])]:text-orange-900 [&:has([data-state=checked])]:shadow-md"
                                                            >
                                                                <CreditCard className="mb-3 h-6 w-6" />
                                                                {t("card")}
                                                            </Label>
                                                        </div>
                                                        <div>
                                                            <RadioGroupItem value="Voucher" id="voucher" className="peer sr-only" />
                                                            <Label
                                                                htmlFor="voucher"
                                                                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-orange-600 peer-data-[state=checked]:bg-orange-50 peer-data-[state=checked]:text-orange-900 peer-data-[state=checked]:shadow-md [&:has([data-state=checked])]:border-orange-600 [&:has([data-state=checked])]:bg-orange-50 [&:has([data-state=checked])]:text-orange-900 [&:has([data-state=checked])]:shadow-md"
                                                            >
                                                                <Ticket className="mb-3 h-6 w-6" />
                                                                {t("voucher")}
                                                            </Label>
                                                        </div>
                                                        <div>
                                                            <RadioGroupItem value="PIX" id="pix" className="peer sr-only" />
                                                            <Label
                                                                htmlFor="pix"
                                                                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-orange-600 peer-data-[state=checked]:bg-orange-50 peer-data-[state=checked]:text-orange-900 peer-data-[state=checked]:shadow-md [&:has([data-state=checked])]:border-orange-600 [&:has([data-state=checked])]:bg-orange-50 [&:has([data-state=checked])]:text-orange-900 [&:has([data-state=checked])]:shadow-md"
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
                                                                    setDiscountError(null)
                                                                } else {
                                                                    setPaymentDiscountType(value as "fixed" | "percentage")
                                                                    if (paymentDiscountValue === null) {
                                                                        setPaymentDiscountValue(0)
                                                                    }
                                                                    // Validar se já há valor definido
                                                                    if (paymentDiscountValue !== null && paymentDiscountValue > 0) {
                                                                        const validation = validatePaymentDiscount(
                                                                            value as "fixed" | "percentage",
                                                                            paymentDiscountValue,
                                                                            settings.paymentDiscountLimitType,
                                                                            settings.paymentDiscountLimitValue,
                                                                            subtotalBeforePaymentDiscount
                                                                        )
                                                                        setDiscountError(validation.isValid ? null : (validation.errorMessage || null))
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
                                                                onChange={(e) => {
                                                                    const value = e.target.value
                                                                    const numValue = value ? parseFloat(value) : null
                                                                    setPaymentDiscountValue(numValue)
                                                                    
                                                                    // Validação em tempo real
                                                                    if (numValue !== null && numValue > 0) {
                                                                        const validation = validatePaymentDiscount(
                                                                            paymentDiscountType,
                                                                            numValue,
                                                                            settings.paymentDiscountLimitType,
                                                                            settings.paymentDiscountLimitValue,
                                                                            subtotalBeforePaymentDiscount
                                                                        )
                                                                        setDiscountError(validation.isValid ? null : (validation.errorMessage || null))
                                                                    } else {
                                                                        setDiscountError(null)
                                                                    }
                                                                }}
                                                                placeholder={paymentDiscountType === 'fixed' ? "0.00" : "0"}
                                                                className={`flex-1 ${discountError ? 'border-red-500' : ''}`}
                                                            />
                                                        )}
                                                    </div>
                                                    {discountError && (
                                                        <div className="text-sm text-red-600 mt-1">
                                                            {discountError}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Resumo de valores */}
                                                <div className="space-y-2 pt-2 border-t">
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-muted-foreground">Subtotal:</span>
                                                        <span>{formatCurrency(subtotalWithPaymentDiscount)}</span>
                                                    </div>
                                                    {paymentDiscountType && paymentDiscountValue !== null && paymentDiscountValue > 0 && (
                                                        <div className="flex justify-between text-sm text-green-600">
                                                            <span>Desconto no Pagamento:</span>
                                                            <span>
                                                                {paymentDiscountType === 'fixed' 
                                                                    ? `-${formatCurrency(paymentDiscountValue)}`
                                                                    : `-${formatCurrency((subtotalBeforePaymentDiscount * paymentDiscountValue) / 100)}`
                                                                }
                                                            </span>
                                                        </div>
                                                    )}
                                                    <div className="flex justify-between font-bold pt-2 border-t">
                                                        <span>Total:</span>
                                                        {(() => {
                                                            const hasDiscount = totalAmount < subtotalBeforePaymentDiscount
                                                            return hasDiscount ? (
                                                                <div className="flex flex-col items-end">
                                                                    <span className="line-through text-muted-foreground text-sm">
                                                                        {formatCurrency(subtotalBeforePaymentDiscount)}
                                                                    </span>
                                                                    <span className="text-green-600 text-lg">
                                                                        {formatCurrency(totalAmount)}
                                                                    </span>
                                                                </div>
                                                            ) : (
                                                                <span>{formatCurrency(totalAmount)}</span>
                                                            )
                                                        })()}
                                                    </div>
                                                </div>
                                            </div>
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
