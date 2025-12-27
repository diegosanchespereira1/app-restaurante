import { useState } from "react"
import { Button } from "../ui/button"
import { ShoppingBag } from "lucide-react"
import { formatCurrency } from "../../lib/utils"
import { useLanguage } from "../../context/LanguageContext"
import { MobileOrderDetailsDrawer } from "./MobileOrderDetailsDrawer"

interface UnifiedItem {
    id: string
    name: string
    price: number
    category: string | null
    description?: string
    image?: string
    type: 'menu' | 'stock'
    originalId: number
}

interface SelectedItem {
    id: string
    quantity: number
}

interface MobileOrderSummaryCompactProps {
    selectedItems: SelectedItem[]
    unifiedItems: UnifiedItem[]
    total: number
    orderType: "dine_in" | "takeout" | "delivery"
    selectedTable: string
    customerName: string
    isTablesEnabled: boolean
    tables: Array<{ id: string; number: string; status: string }>
    handleAddItem: (itemId: string) => void
    handleRemoveItem: (itemId: string) => void
    setOrderType: (type: "dine_in" | "takeout" | "delivery") => void
    setSelectedTable: (table: string) => void
    setCustomerName: (name: string) => void
    handleCreateOrder: () => Promise<void>
    calculateTotal: () => number
}

export function MobileOrderSummaryCompact({
    selectedItems,
    unifiedItems,
    total,
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
    calculateTotal
}: MobileOrderSummaryCompactProps) {
    const { t } = useLanguage()
    const [isDrawerOpen, setIsDrawerOpen] = useState(false)

    // Não mostrar se não há itens
    if (selectedItems.length === 0) {
        return null
    }

    const totalItems = selectedItems.reduce((sum, item) => sum + item.quantity, 0)

    return (
        <>
            {/* Resumo Compacto Fixo */}
            <div className="fixed bottom-20 left-0 right-0 z-40 md:hidden">
                <div className="bg-card border-t border-border shadow-lg mx-4 mb-4 rounded-lg">
                    <Button
                        onClick={() => setIsDrawerOpen(true)}
                        className="w-full h-auto py-4 px-4 flex items-center justify-between rounded-lg"
                        variant="default"
                    >
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <ShoppingBag className="h-5 w-5" />
                                {totalItems > 0 && (
                                    <span className="absolute -top-2 -right-2 bg-primary-foreground text-primary text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                                        {totalItems}
                                    </span>
                                )}
                            </div>
                            <div className="flex flex-col items-start">
                                <span className="text-sm font-medium">
                                    {totalItems} {totalItems === 1 ? t("item") : t("items") || "itens"}
                                </span>
                                <span className="text-lg font-bold">{formatCurrency(total)}</span>
                            </div>
                        </div>
                        <span className="text-sm font-medium">{t("viewDetails")}</span>
                    </Button>
                </div>
            </div>

            {/* Drawer de Detalhes */}
            <MobileOrderDetailsDrawer
                isOpen={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                selectedItems={selectedItems}
                unifiedItems={unifiedItems}
                total={total}
                orderType={orderType}
                selectedTable={selectedTable}
                customerName={customerName}
                isTablesEnabled={isTablesEnabled}
                tables={tables}
                handleAddItem={handleAddItem}
                handleRemoveItem={handleRemoveItem}
                setOrderType={setOrderType}
                setSelectedTable={setSelectedTable}
                setCustomerName={setCustomerName}
                handleCreateOrder={handleCreateOrder}
                calculateTotal={calculateTotal}
            />
        </>
    )
}

