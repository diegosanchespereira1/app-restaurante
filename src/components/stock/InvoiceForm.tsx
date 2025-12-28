import { useState } from "react"
import { useStock } from "../../context/StockContext"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { Textarea } from "../ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Save, X } from "lucide-react"
import { DANFEImporter } from "./DANFEImporter"
import { InvoiceItemsTable } from "./InvoiceItemsTable"
import type { CreatePurchaseInvoiceInput, CreateInvoiceItemInput, NFEParsedData } from "../../types/stock"
import { formatCurrency } from "../../lib/utils"

interface InvoiceFormProps {
    onSuccess?: () => void
    onCancel?: () => void
}

export function InvoiceForm({ onSuccess, onCancel }: InvoiceFormProps) {
    const { addPurchaseInvoice, isLoading } = useStock()
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [xmlContent, setXmlContent] = useState<string | null>(null)

    const [formData, setFormData] = useState<CreatePurchaseInvoiceInput>({
        invoice_number: '',
        invoice_series: null,
        nfe_key: null,
        supplier_name: '',
        supplier_cnpj: null,
        supplier_address: null,
        invoice_date: new Date().toISOString().split('T')[0],
        total_amount: 0,
        xml_file_path: null,
        xml_content: null,
        notes: null,
        items: []
    })

    const handleDANFEImport = (data: NFEParsedData, xml: string) => {
        setXmlContent(xml)
        
        // Mapeia itens do XML para formato do formulário
        const items: CreateInvoiceItemInput[] = data.items.map(item => ({
            inventory_item_id: null, // Será preenchido manualmente ou por matching
            product_name: item.product_name,
            quantity: item.quantity,
            unit: item.unit,
            unit_price: item.unit_price,
            total_price: item.total_price
        }))

        setFormData({
            invoice_number: data.invoice_number,
            invoice_series: data.invoice_series || null,
            nfe_key: data.nfe_key || null,
            supplier_name: data.supplier_name,
            supplier_cnpj: data.supplier_cnpj || null,
            supplier_address: data.supplier_address || null,
            invoice_date: data.invoice_date,
            total_amount: data.total_amount,
            xml_file_path: null,
            xml_content: xml,
            notes: null,
            items
        })
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)

        // Validações
        if (!formData.invoice_number.trim()) {
            setError('Número da nota fiscal é obrigatório')
            return
        }

        if (!formData.supplier_name.trim()) {
            setError('Nome do fornecedor é obrigatório')
            return
        }

        if (!formData.invoice_date) {
            setError('Data da nota fiscal é obrigatória')
            return
        }

        if (formData.items.length === 0) {
            setError('Adicione pelo menos um item à nota fiscal')
            return
        }

        // Valida itens
        for (const item of formData.items) {
            if (!item.product_name.trim()) {
                setError('Todos os itens devem ter um nome de produto')
                return
            }
            if (item.quantity <= 0) {
                setError('Todos os itens devem ter quantidade maior que zero')
                return
            }
            if (item.unit_price <= 0) {
                setError('Todos os itens devem ter preço unitário maior que zero')
                return
            }
        }

        // Recalcula total se necessário
        const calculatedTotal = formData.items.reduce((sum, item) => sum + item.total_price, 0)
        const finalData = {
            ...formData,
            total_amount: calculatedTotal,
            xml_content: xmlContent
        }

        setIsSubmitting(true)
        try {
            const result = await addPurchaseInvoice(finalData)
            if (result.success) {
                onSuccess?.()
            } else {
                setError(result.error || 'Erro ao salvar nota fiscal')
            }
        } catch (err: any) {
            setError(err.message || 'Erro ao salvar nota fiscal')
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* Importação DANFE */}
            <Card>
                <CardHeader>
                    <CardTitle>Importar DANFE (XML)</CardTitle>
                </CardHeader>
                <CardContent>
                    <DANFEImporter
                        onImport={handleDANFEImport}
                        onError={(error) => setError(error)}
                    />
                </CardContent>
            </Card>

            {/* Dados da Nota Fiscal */}
            <Card>
                <CardHeader>
                    <CardTitle>Dados da Nota Fiscal</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="invoice_number">Número da Nota Fiscal *</Label>
                            <Input
                                id="invoice_number"
                                value={formData.invoice_number}
                                onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                                required
                            />
                        </div>

                        <div>
                            <Label htmlFor="invoice_series">Série</Label>
                            <Input
                                id="invoice_series"
                                value={formData.invoice_series || ''}
                                onChange={(e) => setFormData({ ...formData, invoice_series: e.target.value || null })}
                            />
                        </div>

                        <div>
                            <Label htmlFor="nfe_key">Chave de Acesso (NFe)</Label>
                            <Input
                                id="nfe_key"
                                value={formData.nfe_key || ''}
                                onChange={(e) => setFormData({ ...formData, nfe_key: e.target.value || null })}
                            />
                        </div>

                        <div>
                            <Label htmlFor="invoice_date">Data da Nota Fiscal *</Label>
                            <Input
                                id="invoice_date"
                                type="date"
                                value={formData.invoice_date}
                                onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })}
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="supplier_name">Fornecedor *</Label>
                            <Input
                                id="supplier_name"
                                value={formData.supplier_name}
                                onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })}
                                required
                            />
                        </div>

                        <div>
                            <Label htmlFor="supplier_cnpj">CNPJ do Fornecedor</Label>
                            <Input
                                id="supplier_cnpj"
                                value={formData.supplier_cnpj || ''}
                                onChange={(e) => setFormData({ ...formData, supplier_cnpj: e.target.value || null })}
                                placeholder="00.000.000/0000-00"
                            />
                        </div>
                    </div>

                    <div>
                        <Label htmlFor="supplier_address">Endereço do Fornecedor</Label>
                        <Input
                            id="supplier_address"
                            value={formData.supplier_address || ''}
                            onChange={(e) => setFormData({ ...formData, supplier_address: e.target.value || null })}
                        />
                    </div>

                    <div>
                        <Label htmlFor="notes">Observações</Label>
                        <Textarea
                            id="notes"
                            value={formData.notes || ''}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value || null })}
                            rows={3}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Itens da Nota */}
            <Card>
                <CardHeader>
                    <CardTitle>Itens da Nota Fiscal</CardTitle>
                </CardHeader>
                <CardContent>
                    <InvoiceItemsTable
                        items={formData.items}
                        onItemsChange={(items) => {
                            const total = items.reduce((sum, item) => sum + item.total_price, 0)
                            setFormData({ ...formData, items, total_amount: total })
                        }}
                    />
                </CardContent>
            </Card>

            {/* Total */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex justify-between items-center">
                        <span className="text-lg font-semibold">Total da Nota Fiscal:</span>
                        <span className="text-2xl font-bold">
                            {formatCurrency(formData.total_amount)}
                        </span>
                    </div>
                </CardContent>
            </Card>

            {/* Erro */}
            {error && (
                <div className="p-4 bg-destructive/10 text-destructive rounded-md">
                    {error}
                </div>
            )}

            {/* Botões */}
            <div className="flex justify-end gap-4">
                {onCancel && (
                    <Button type="button" variant="outline" onClick={onCancel}>
                        <X className="w-4 h-4 mr-2" />
                        Cancelar
                    </Button>
                )}
                <Button type="submit" disabled={isSubmitting || isLoading}>
                    <Save className="w-4 h-4 mr-2" />
                    {isSubmitting ? 'Salvando...' : 'Salvar Nota Fiscal'}
                </Button>
            </div>
        </form>
    )
}




