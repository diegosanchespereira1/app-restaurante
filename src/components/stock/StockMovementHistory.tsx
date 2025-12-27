import { useEffect, useState } from "react"
import { useStock } from "../../context/StockContext"
import { Card, CardContent } from "../ui/card"
import { Badge } from "../ui/badge"
import { ArrowUp, ArrowDown, Edit } from "lucide-react"

interface StockMovementHistoryProps {
    itemId: number
}

export function StockMovementHistory({ itemId }: StockMovementHistoryProps) {
    const { stockMovements, fetchStockMovements, isLoading } = useStock()
    const [movements, setMovements] = useState(stockMovements.filter(m => m.product_id === itemId))

    useEffect(() => {
        fetchStockMovements(itemId)
    }, [itemId, fetchStockMovements])

    useEffect(() => {
        setMovements(stockMovements.filter(m => m.product_id === itemId))
    }, [stockMovements, itemId])

    const getMovementIcon = (type: string) => {
        switch (type) {
            case 'entry':
                return <ArrowUp className="w-4 h-4 text-green-600" />
            case 'exit':
                return <ArrowDown className="w-4 h-4 text-red-600" />
            case 'adjustment':
                return <Edit className="w-4 h-4 text-blue-600" />
            default:
                return null
        }
    }

    const getMovementLabel = (type: string) => {
        switch (type) {
            case 'entry':
                return 'Entrada'
            case 'exit':
                return 'Saída'
            case 'adjustment':
                return 'Ajuste'
            default:
                return type
        }
    }

    const getMovementColor = (type: string) => {
        switch (type) {
            case 'entry':
                return 'default'
            case 'exit':
                return 'destructive'
            case 'adjustment':
                return 'secondary'
            default:
                return 'default'
        }
    }

    if (isLoading) {
        return <div className="text-center py-8">Carregando...</div>
    }

    if (movements.length === 0) {
        return (
            <Card>
                <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">Nenhuma movimentação registrada</p>
                </CardContent>
            </Card>
        )
    }

    return (
        <div className="space-y-3">
            {movements.map((movement) => (
                <Card key={movement.id}>
                    <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3 flex-1">
                                <div className="mt-1">
                                    {getMovementIcon(movement.movement_type)}
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Badge variant={getMovementColor(movement.movement_type) as any}>
                                            {getMovementLabel(movement.movement_type)}
                                        </Badge>
                                        <span className="font-semibold">
                                            {movement.quantity} unidades
                                        </span>
                                    </div>
                                    {movement.notes && (
                                        <p className="text-sm text-muted-foreground mb-1">
                                            {movement.notes}
                                        </p>
                                    )}
                                    {movement.reference_type && movement.reference_id && (
                                        <p className="text-xs text-muted-foreground">
                                            Referência: {movement.reference_type} #{movement.reference_id}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-muted-foreground">
                                    {new Date(movement.created_at).toLocaleDateString('pt-BR')}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {new Date(movement.created_at).toLocaleTimeString('pt-BR', { 
                                        hour: '2-digit', 
                                        minute: '2-digit' 
                                    })}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}



