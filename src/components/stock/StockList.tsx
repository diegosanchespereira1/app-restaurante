import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent } from "../ui/card"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { Package, AlertTriangle, TrendingDown, History, Plus, Pencil } from "lucide-react"
import { StockMovementHistory } from "./StockMovementHistory"
import { AddStockEntryDialog } from "./AddStockEntryDialog"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog"
import { formatCurrency } from "../../lib/utils"

interface StockListProps {
    items: Array<{
        id: number
        name: string
        unit: string
        min_stock: number
        current_stock: number
        cost_price: number | null
        selling_price: number | null
        category: string | null
    }>
}

export function StockList({ items }: StockListProps) {
    const navigate = useNavigate()
    const [addEntryItemId, setAddEntryItemId] = useState<number | null>(null)
    const [isAddEntryOpen, setIsAddEntryOpen] = useState(false)

    const getStockStatus = (current: number, min: number) => {
        if (current === 0) return { label: "Sem Estoque", color: "destructive", icon: AlertTriangle }
        if (current <= min) return { label: "Estoque Baixo", color: "destructive", icon: AlertTriangle }
        if (current <= min * 1.5) return { label: "Atenção", color: "default", icon: TrendingDown }
        return { label: "OK", color: "default", icon: Package }
    }

    if (items.length === 0) {
        return (
            <Card>
                <CardContent className="py-12 text-center">
                    <Package className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">Nenhum item de estoque encontrado</p>
                </CardContent>
            </Card>
        )
    }

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => {
                const status = getStockStatus(item.current_stock, item.min_stock)
                return (
                    <Card key={item.id} className="relative">
                        <CardContent className="p-6">
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex-1">
                                    <h3 className="font-semibold text-lg mb-1">{item.name}</h3>
                                    {item.category && (
                                        <p className="text-sm text-muted-foreground">{item.category}</p>
                                    )}
                                </div>
                                <Badge variant={status.color === "destructive" ? "destructive" : "default"}>
                                    {status.label}
                                </Badge>
                            </div>

                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-muted-foreground">Estoque Atual:</span>
                                    <span className="font-semibold">
                                        {item.current_stock} {item.unit}
                                    </span>
                                </div>

                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-muted-foreground">Estoque Mínimo:</span>
                                    <span className="text-sm">{item.min_stock} {item.unit}</span>
                                </div>

                                {item.cost_price && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-muted-foreground">Preço de Custo:</span>
                                        <span className="text-sm">{formatCurrency(item.cost_price)}</span>
                                    </div>
                                )}

                                {item.selling_price && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-muted-foreground">Preço de Venda:</span>
                                        <span className="text-sm font-medium">{formatCurrency(item.selling_price)}</span>
                                    </div>
                                )}
                            </div>

                            <div className="mt-4 pt-4 border-t space-y-2">
                                <div className="grid grid-cols-3 gap-2">
                                    <Button 
                                        variant="outline" 
                                        size="sm"
                                        onClick={() => {
                                            setAddEntryItemId(item.id)
                                            setIsAddEntryOpen(true)
                                        }}
                                    >
                                        <Plus className="w-4 h-4 mr-2" />
                                        Adicionar
                                    </Button>
                                    <Button 
                                        variant="outline" 
                                        size="sm"
                                        onClick={() => navigate(`/stock/edit/${item.id}`)}
                                    >
                                        <Pencil className="w-4 h-4 mr-2" />
                                        Editar
                                    </Button>
                                    <Dialog>
                                        <DialogTrigger asChild>
                                            <Button 
                                                variant="outline" 
                                                size="sm"
                                                onClick={() => setSelectedItemId(item.id)}
                                            >
                                                <History className="w-4 h-4 mr-2" />
                                                Histórico
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                                            <DialogHeader>
                                                <DialogTitle>Histórico de Movimentações - {item.name}</DialogTitle>
                                            </DialogHeader>
                                            <StockMovementHistory itemId={item.id} />
                                        </DialogContent>
                                    </Dialog>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )
            })}
            
            {/* Dialog para adicionar entrada */}
            <AddStockEntryDialog
                open={isAddEntryOpen}
                onOpenChange={(open) => {
                    setIsAddEntryOpen(open)
                    if (!open) {
                        setAddEntryItemId(null)
                    }
                }}
                itemId={addEntryItemId || undefined}
            />
        </div>
    )
}

