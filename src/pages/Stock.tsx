import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useStock } from "../context/StockContext"
import { useLanguage } from "../context/LanguageContext"
import { Button } from "../components/ui/button"
import { Plus } from "lucide-react"
import { StockList } from "../components/stock/StockList"
import { StockFilters } from "../components/stock/StockFilters"
import { LowStockAlert } from "../components/stock/LowStockAlert"
import { InvoiceForm } from "../components/stock/InvoiceForm"
import { AddStockEntryDialog } from "../components/stock/AddStockEntryDialog"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog"

export function Stock() {
    const navigate = useNavigate()
    const { inventoryItems, getLowStockItems, isLoading } = useStock()
    const { t } = useLanguage()
    const [isInvoiceFormOpen, setIsInvoiceFormOpen] = useState(false)
    const [searchTerm, setSearchTerm] = useState("")
    const [filterCategory, setFilterCategory] = useState<string | null>(null)
    const [filterLowStock, setFilterLowStock] = useState(false)
    const [isAddEntryDialogOpen, setIsAddEntryDialogOpen] = useState(false)

    const lowStockItems = getLowStockItems()
    const categories = Array.from(new Set(inventoryItems.map(item => item.category).filter(Boolean))) as string[]

    const filteredItems = inventoryItems.filter(item => {
        const matchesSearch = !searchTerm || 
            item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.category?.toLowerCase().includes(searchTerm.toLowerCase())
        
        const matchesCategory = !filterCategory || item.category === filterCategory
        const matchesLowStock = !filterLowStock || item.current_stock <= item.min_stock

        return matchesSearch && matchesCategory && matchesLowStock
    })

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted-foreground">{t("loading") || "Carregando..."}</p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">
                        {t("stockManagement") || "Controle de Estoque"}
                    </h2>
                    <p className="text-muted-foreground">
                        {t("stockManagementDescription") || "Gerencie o estoque de produtos e cadastre notas fiscais de compra"}
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button 
                        variant="outline" 
                        className="flex items-center gap-2"
                        onClick={() => navigate('/stock/add')}
                    >
                        <Plus className="w-4 h-4" />
                        {t("addInventoryItem") || "Adicionar Item"}
                    </Button>
                    <Button 
                        variant="outline" 
                        className="flex items-center gap-2"
                        onClick={() => setIsAddEntryDialogOpen(true)}
                    >
                        <Plus className="w-4 h-4" />
                        {t("addStockEntry") || "Adicionar Entrada"}
                    </Button>
                    <Dialog open={isInvoiceFormOpen} onOpenChange={setIsInvoiceFormOpen}>
                        <DialogTrigger asChild>
                            <Button className="flex items-center gap-2">
                                <Plus className="w-4 h-4" />
                                {t("newPurchaseInvoice") || "Nova Nota Fiscal"}
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle>{t("newPurchaseInvoice") || "Nova Nota Fiscal de Compra"}</DialogTitle>
                            </DialogHeader>
                            <InvoiceForm onSuccess={() => setIsInvoiceFormOpen(false)} />
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Dialogs */}
            <AddStockEntryDialog 
                open={isAddEntryDialogOpen} 
                onOpenChange={setIsAddEntryDialogOpen} 
            />

            {/* Low Stock Alert */}
            {lowStockItems.length > 0 && (
                <LowStockAlert items={lowStockItems} />
            )}

            {/* Filters */}
            <StockFilters
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                categories={categories}
                selectedCategory={filterCategory}
                onCategoryChange={setFilterCategory}
                filterLowStock={filterLowStock}
                onFilterLowStockChange={setFilterLowStock}
            />

            {/* Stock List */}
            <StockList items={filteredItems} />
        </div>
    )
}

