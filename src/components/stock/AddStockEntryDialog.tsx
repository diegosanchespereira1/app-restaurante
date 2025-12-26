import { useState, useEffect } from "react"
import { useStock } from "../../context/StockContext"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { Textarea } from "../ui/textarea"
import { Plus, X } from "lucide-react"

interface AddStockEntryDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    itemId?: number // Se fornecido, pré-seleciona o item
}

export function AddStockEntryDialog({ open, onOpenChange, itemId }: AddStockEntryDialogProps) {
    const { inventoryItems, addStockMovement } = useStock()
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [formData, setFormData] = useState({
        inventory_item_id: itemId || null as number | null,
        quantity: 0,
        notes: ''
    })

    // Reset form when dialog opens/closes or itemId changes
    useEffect(() => {
        if (open) {
            setFormData({
                inventory_item_id: itemId || null,
                quantity: 0,
                notes: ''
            })
            setError(null)
        }
    }, [open, itemId])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)

        // Validações
        if (!formData.inventory_item_id) {
            setError('Selecione um item do estoque')
            return
        }

        if (formData.quantity <= 0) {
            setError('Quantidade deve ser maior que zero')
            return
        }

        setIsSubmitting(true)
        try {
            const result = await addStockMovement({
                inventory_item_id: formData.inventory_item_id,
                movement_type: 'entry',
                quantity: formData.quantity,
                reference_id: null,
                reference_type: null,
                notes: formData.notes || 'Entrada manual de estoque'
            })

            if (result.success) {
                // Reset form
                setFormData({
                    inventory_item_id: itemId || null,
                    quantity: 0,
                    notes: ''
                })
                onOpenChange(false)
            } else {
                setError(result.error || 'Erro ao adicionar entrada')
            }
        } catch (err: any) {
            setError(err.message || 'Erro ao adicionar entrada')
        } finally {
            setIsSubmitting(false)
        }
    }

    const selectedItem = formData.inventory_item_id 
        ? inventoryItems.find(item => item.id === formData.inventory_item_id)
        : null

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Adicionar Entrada de Estoque</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <Label htmlFor="inventory_item">Item do Estoque *</Label>
                        <Select
                            value={formData.inventory_item_id?.toString() || ''}
                            onValueChange={(value) => setFormData({ ...formData, inventory_item_id: value ? parseInt(value) : null })}
                        >
                            <SelectTrigger id="inventory_item">
                                <SelectValue placeholder="Selecione um item" />
                            </SelectTrigger>
                            <SelectContent>
                                {inventoryItems.map((item) => (
                                    <SelectItem key={item.id} value={item.id.toString()}>
                                        {item.name} (Estoque atual: {item.current_stock} {item.unit})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {selectedItem && (
                        <div className="p-3 bg-muted rounded-md">
                            <p className="text-sm">
                                <strong>Estoque atual:</strong> {selectedItem.current_stock} {selectedItem.unit}
                            </p>
                            <p className="text-sm">
                                <strong>Estoque mínimo:</strong> {selectedItem.min_stock} {selectedItem.unit}
                            </p>
                            {formData.quantity > 0 && (
                                <p className="text-sm font-semibold mt-2">
                                    <strong>Novo estoque:</strong> {selectedItem.current_stock + formData.quantity} {selectedItem.unit}
                                </p>
                            )}
                        </div>
                    )}

                    <div>
                        <Label htmlFor="quantity">Quantidade *</Label>
                        <Input
                            id="quantity"
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={formData.quantity || ''}
                            onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })}
                            required
                            placeholder="0.00"
                        />
                    </div>

                    <div>
                        <Label htmlFor="notes">Observações</Label>
                        <Textarea
                            id="notes"
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            placeholder="Ex: Compra direta, ajuste de inventário, etc."
                            rows={3}
                        />
                    </div>

                    {error && (
                        <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
                            {error}
                        </div>
                    )}

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            <X className="w-4 h-4 mr-2" />
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            <Plus className="w-4 h-4 mr-2" />
                            {isSubmitting ? 'Adicionando...' : 'Adicionar Entrada'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

