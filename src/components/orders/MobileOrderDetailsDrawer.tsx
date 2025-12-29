import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { RadioGroup, RadioGroupItem } from "../ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { Minus, Plus, ShoppingBag, X } from "lucide-react"
import { formatCurrency } from "../../lib/utils"
import { useLanguage } from "../../context/LanguageContext"
import { cn } from "../../lib/utils"
import type { Table, MenuItem } from "../../context/RestaurantContext"

interface SelectedItem {
    id: string
    quantity: number
}

interface MobileOrderDetailsDrawerProps {
    isOpen: boolean
    onClose: () => void
    selectedItems: SelectedItem[]
    menuItems: MenuItem[]
    orderType: "dine_in" | "takeout" | "delivery"
    selectedTable: string
    customerName: string
    isTablesEnabled: boolean
    tables: Table[]
    handleAddItem: (itemId: string) => void
    handleRemoveItem: (itemId: string) => void
    setOrderType: (type: "dine_in" | "takeout" | "delivery") => void
    setSelectedTable: (table: string) => void
    setCustomerName: (name: string) => void
    handleCreateOrder: () => Promise<void>
    calculateTotal: () => number
    orderDiscountType: "fixed" | "percentage" | null
    orderDiscountValue: number | null
    setOrderDiscountType: (type: "fixed" | "percentage" | null) => void
    setOrderDiscountValue: (value: number | null) => void
    calculateSubtotal: () => number
}

export function MobileOrderDetailsDrawer({
    isOpen,
    onClose,
    selectedItems,
    menuItems,
    orderType,
    selectedTable,
    customerName,
    isTablesEnabled,
    tables,
    handleAddItem,
    handleRemoveItem,
    setOrderType,
    setSelectedTable,
    setCustomerName,
    handleCreateOrder,
    calculateTotal,
    orderDiscountType,
    orderDiscountValue,
    setOrderDiscountType,
    setOrderDiscountValue,
    calculateSubtotal
}: MobileOrderDetailsDrawerProps) {
    const { t } = useLanguage()

    const handleCreateAndClose = async () => {
        await handleCreateOrder()
        onClose()
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className={cn(
                "fixed bottom-0 left-0 right-0 top-auto translate-y-0 translate-x-0 max-w-none w-full rounded-t-2xl rounded-b-none max-h-[90vh] flex flex-col p-0",
                "data-[state=open]:animate-in data-[state=closed]:animate-out",
                "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom"
            )}>
                {/* Header com título e botão fechar */}
                <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
                    <div className="flex items-center justify-between">
                        <DialogTitle className="text-xl font-bold">{t("orderSummary")}</DialogTitle>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onClose}
                            className="h-8 w-8"
                        >
                            <X className="h-5 w-5" />
                        </Button>
                    </div>
                </DialogHeader>

                {/* Conteúdo scrollável */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
                    {/* Configurações do Pedido */}
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>{t("orderType")}</Label>
                            <RadioGroup 
                                value={orderType} 
                                onValueChange={(v) => setOrderType(v as any)} 
                                className="flex gap-4"
                            >
                                {isTablesEnabled && (
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="dine_in" id="drawer_dine_in" />
                                        <Label htmlFor="drawer_dine_in" className="cursor-pointer">{t("dineIn")}</Label>
                                    </div>
                                )}
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="takeout" id="drawer_takeout" />
                                    <Label htmlFor="drawer_takeout" className="cursor-pointer">{t("takeout")}</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="delivery" id="drawer_delivery" />
                                    <Label htmlFor="drawer_delivery" className="cursor-pointer">{t("delivery")}</Label>
                                </div>
                            </RadioGroup>
                        </div>

                        {orderType === "dine_in" && isTablesEnabled && (
                            <div className="space-y-2">
                                <Label>{t("table")}</Label>
                                <Select value={selectedTable} onValueChange={setSelectedTable}>
                                    <SelectTrigger>
                                        <SelectValue placeholder={t("selectTable")} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {tables.map((table) => (
                                            <SelectItem key={table.id} value={table.number}>
                                                {table.number} {table.status === "Occupied" && `(${t("occupiedAbbr")})`}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label>{t("customer")}</Label>
                            <Input
                                placeholder={t("customerNamePlaceholder")}
                                value={customerName}
                                onChange={(e) => setCustomerName(e.target.value)}
                            />
                        </div>

                        {/* Seção de Desconto */}
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">Desconto do Pedido</Label>
                            <div className="flex gap-2">
                                <Select
                                    value={orderDiscountType || 'none'}
                                    onValueChange={(value) => {
                                        if (value === 'none') {
                                            setOrderDiscountType(null)
                                            setOrderDiscountValue(null)
                                        } else {
                                            setOrderDiscountType(value as "fixed" | "percentage")
                                            if (orderDiscountValue === null) {
                                                setOrderDiscountValue(0)
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
                                {orderDiscountType && (
                                    <Input
                                        type="number"
                                        step={orderDiscountType === 'fixed' ? "0.01" : "0.1"}
                                        min="0"
                                        max={orderDiscountType === 'percentage' ? "100" : undefined}
                                        value={orderDiscountValue || ''}
                                        onChange={(e) => setOrderDiscountValue(e.target.value ? parseFloat(e.target.value) : null)}
                                        placeholder={orderDiscountType === 'fixed' ? "0.00" : "0"}
                                        className="flex-1"
                                    />
                                )}
                            </div>
                            {orderDiscountType && orderDiscountValue !== null && orderDiscountValue > 0 && (
                                <p className="text-xs text-muted-foreground">
                                    {orderDiscountType === 'fixed' 
                                        ? `Desconto de ${formatCurrency(orderDiscountValue)}`
                                        : `Desconto de ${orderDiscountValue}%`
                                    }
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Lista de Itens */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg">{t("items")}</h3>
                        {selectedItems.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground space-y-2">
                                <ShoppingBag className="h-8 w-8" />
                                <p>{t("noItemsSelected")}</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {selectedItems.map((item) => {
                                    const menuItem = menuItems.find(m => m.id.toString() === item.id)
                                    return (
                                        <div key={item.id} className="p-3 bg-muted/50 rounded-lg space-y-2">
                                            <p className="font-medium whitespace-nowrap overflow-hidden text-ellipsis">{menuItem?.name}</p>
                                            <div className="text-sm text-muted-foreground">
                                                {formatCurrency(menuItem?.price || 0)}
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="icon"
                                                        className="h-8 w-8"
                                                        onClick={() => handleRemoveItem(item.id)}
                                                    >
                                                        <Minus className="h-3 w-3" />
                                                    </Button>
                                                    <span className="w-8 text-center font-medium">{item.quantity}</span>
                                                    <Button
                                                        variant="outline"
                                                        size="icon"
                                                        className="h-8 w-8"
                                                        onClick={() => handleAddItem(item.id)}
                                                    >
                                                        <Plus className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                                <div className="font-medium text-right">
                                                    {formatCurrency((menuItem?.price || 0) * item.quantity)}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer fixo com total e botão */}
                <div className="px-6 py-4 border-t bg-background shrink-0 space-y-4">
                    {/* Resumo de valores */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Subtotal:</span>
                            <span>{formatCurrency(calculateSubtotal())}</span>
                        </div>
                        {orderDiscountType && orderDiscountValue !== null && orderDiscountValue > 0 && (
                            <div className="flex justify-between text-sm text-green-600">
                                <span>Desconto:</span>
                                <span>
                                    {orderDiscountType === 'fixed' 
                                        ? `-${formatCurrency(orderDiscountValue)}`
                                        : `-${formatCurrency((calculateSubtotal() * orderDiscountValue) / 100)}`
                                    }
                                </span>
                            </div>
                        )}
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t">
                        <span className="text-lg font-semibold">{t("total")}</span>
                        {(() => {
                            const subtotal = calculateSubtotal()
                            const total = calculateTotal()
                            const hasDiscount = total < subtotal
                            return hasDiscount ? (
                                <div className="flex flex-col items-end">
                                    <span className="line-through text-muted-foreground text-base">
                                        {formatCurrency(subtotal)}
                                    </span>
                                    <span className="text-2xl font-bold text-green-600">
                                        {formatCurrency(total)}
                                    </span>
                                </div>
                            ) : (
                                <span className="text-2xl font-bold">{formatCurrency(total)}</span>
                            )
                        })()}
                    </div>
                    <Button 
                        className="w-full" 
                        size="lg" 
                        onClick={handleCreateAndClose}
                        disabled={(orderType === "dine_in" && isTablesEnabled && !selectedTable) || selectedItems.length === 0}
                    >
                        {t("createOrder")}
                    </Button>
                    {((orderType === "dine_in" && isTablesEnabled && !selectedTable) || selectedItems.length === 0) && (
                        <p className="text-sm text-center text-muted-foreground">
                            {orderType === "dine_in" && isTablesEnabled && !selectedTable
                                ? t("selectATable")
                                : selectedItems.length === 0
                                    ? t("addItemsToOrder")
                                    : ""}
                        </p>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}

