import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { Trash2, Plus } from "lucide-react"
import { useStock } from "../../context/StockContext"
import { formatCurrency } from "../../lib/utils"
import type { CreateInvoiceItemInput } from "../../types/stock"

interface InvoiceItemsTableProps {
    items: CreateInvoiceItemInput[]
    onItemsChange: (items: CreateInvoiceItemInput[]) => void
}

export function InvoiceItemsTable({ items, onItemsChange }: InvoiceItemsTableProps) {
    const { inventoryItems } = useStock()

    const addItem = () => {
        onItemsChange([
            ...items,
            {
                inventory_item_id: null,
                product_name: '',
                quantity: 1,
                unit: 'UN',
                unit_price: 0,
                total_price: 0
            }
        ])
    }

    const removeItem = (index: number) => {
        onItemsChange(items.filter((_, i) => i !== index))
    }

    const updateItem = (index: number, updates: Partial<CreateInvoiceItemInput>) => {
        const newItems = [...items]
        const item = { ...newItems[index], ...updates }
        
        // Se mudou inventory_item_id, atualiza product_name
        if (updates.inventory_item_id !== undefined) {
            const inventoryItem = inventoryItems.find(i => i.id === updates.inventory_item_id)
            if (inventoryItem) {
                item.product_name = inventoryItem.name
                item.unit = inventoryItem.unit
            }
        }
        
        // Recalcula total_price
        if (updates.quantity !== undefined || updates.unit_price !== undefined) {
            item.total_price = (item.quantity || 0) * (item.unit_price || 0)
        }
        
        newItems[index] = item
        onItemsChange(newItems)
    }

    const totalAmount = items.reduce((sum, item) => sum + (item.total_price || 0), 0)

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="font-semibold">Itens da Nota Fiscal</h3>
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar Item
                </Button>
            </div>

            {items.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                    <p>Nenhum item adicionado. Clique em "Adicionar Item" para começar.</p>
                </div>
            ) : (
                <>
                    <div className="border rounded-lg overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-muted">
                                <tr>
                                    <th className="text-left p-3 text-sm font-medium">Produto</th>
                                    <th className="text-left p-3 text-sm font-medium">Quantidade</th>
                                    <th className="text-left p-3 text-sm font-medium">Unidade</th>
                                    <th className="text-left p-3 text-sm font-medium">Preço Unit.</th>
                                    <th className="text-left p-3 text-sm font-medium">Total</th>
                                    <th className="text-right p-3 text-sm font-medium">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item, index) => (
                                    <tr key={index} className="border-t">
                                        <td className="p-3">
                                            <Select
                                                value={item.inventory_item_id?.toString() || ''}
                                                onValueChange={(value) => 
                                                    updateItem(index, { 
                                                        inventory_item_id: value ? parseInt(value) : null 
                                                    })
                                                }
                                            >
                                                <SelectTrigger className="w-full">
                                                    <SelectValue placeholder="Selecione ou digite" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="">Digite manualmente</SelectItem>
                                                    {inventoryItems.map((invItem) => (
                                                        <SelectItem key={invItem.id} value={invItem.id.toString()}>
                                                            {invItem.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            {(!item.inventory_item_id || items.find(i => i.inventory_item_id === item.inventory_item_id && items.indexOf(i) !== index)) && (
                                                <Input
                                                    className="mt-2"
                                                    placeholder="Nome do produto"
                                                    value={item.product_name}
                                                    onChange={(e) => updateItem(index, { product_name: e.target.value })}
                                                />
                                            )}
                                        </td>
                                        <td className="p-3">
                                            <Input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={item.quantity || ''}
                                                onChange={(e) => updateItem(index, { 
                                                    quantity: parseFloat(e.target.value) || 0 
                                                })}
                                            />
                                        </td>
                                        <td className="p-3">
                                            <Input
                                                value={item.unit}
                                                onChange={(e) => updateItem(index, { unit: e.target.value })}
                                                placeholder="UN"
                                            />
                                        </td>
                                        <td className="p-3">
                                            <Input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={item.unit_price || ''}
                                                onChange={(e) => updateItem(index, { 
                                                    unit_price: parseFloat(e.target.value) || 0 
                                                })}
                                            />
                                        </td>
                                        <td className="p-3">
                                            <span className="font-medium">
                                                {formatCurrency(item.total_price || 0)}
                                            </span>
                                        </td>
                                        <td className="p-3 text-right">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => removeItem(index)}
                                            >
                                                <Trash2 className="w-4 h-4 text-destructive" />
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex justify-end">
                        <div className="text-right space-y-1">
                            <p className="text-sm text-muted-foreground">
                                Total de itens: {items.length}
                            </p>
                            <p className="text-lg font-bold">
                                Total: {formatCurrency(totalAmount)}
                            </p>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}

