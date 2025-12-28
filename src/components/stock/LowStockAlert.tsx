import { Card, CardContent } from "../ui/card"
import { Badge } from "../ui/badge"
import { AlertTriangle } from "lucide-react"
import type { InventoryItem } from "../../types/stock"

interface LowStockAlertProps {
    items: InventoryItem[]
}

export function LowStockAlert({ items }: LowStockAlertProps) {
    return (
        <Card className="border-destructive">
            <CardContent className="p-4">
                <div className="flex items-start gap-3">
                    <div className="rounded-full bg-destructive/10 p-2">
                        <AlertTriangle className="w-5 h-5 text-destructive" />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-semibold text-destructive mb-1">
                            Atenção: {items.length} {items.length === 1 ? "produto" : "produtos"} com estoque baixo
                        </h3>
                        <div className="flex flex-wrap gap-2 mt-2">
                            {items.slice(0, 10).map((item) => (
                                <Badge key={item.id} variant="destructive">
                                    {item.name} ({item.current_stock} {item.unit})
                                </Badge>
                            ))}
                            {items.length > 10 && (
                                <Badge variant="outline">
                                    +{items.length - 10} mais
                                </Badge>
                            )}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}




