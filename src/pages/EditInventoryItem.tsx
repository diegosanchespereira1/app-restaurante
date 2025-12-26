import { useState, useEffect } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useStock } from "../context/StockContext"
import { useRestaurant } from "../context/RestaurantContext"
import { useLanguage } from "../context/LanguageContext"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../components/ui/dialog"
import { ArrowLeft, Save, Plus } from "lucide-react"
import { formatCurrency } from "../lib/utils"

const DEFAULT_IMAGE = 'materialApoio/imagem-nao-disponivel.gif'

export function EditInventoryItem() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const { inventoryItems, updateInventoryItem, isLoading: isStockLoading, getInventoryItemById } = useStock()
    const { menuItems, categories, isLoading: isRestaurantLoading, addCategory } = useRestaurant()
    const { t } = useLanguage()
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)
    const [isAddCategoryDialogOpen, setIsAddCategoryDialogOpen] = useState(false)
    const [newCategoryName, setNewCategoryName] = useState("")
    const [isAddingCategory, setIsAddingCategory] = useState(false)
    const [categoryError, setCategoryError] = useState<string | null>(null)

    const itemId = id ? parseInt(id) : null
    const currentItem = itemId ? getInventoryItemById(itemId) : null

    const safeMenuItems = menuItems || []
    const safeCategories = categories || []

    const [formData, setFormData] = useState({
        menu_item_id: null as number | null,
        name: '',
        unit: 'UN',
        min_stock: 0,
        current_stock: 0,
        cost_price: null as number | null,
        selling_price: null as number | null,
        category: '',
        image: DEFAULT_IMAGE,
        product_type: '',
        ncm: '',
        cst_icms: '',
        cfop: '',
        icms_rate: null as number | null,
        ipi_rate: null as number | null,
        ean_code: ''
    })

    // Carregar dados do item quando o componente montar ou o item mudar
    useEffect(() => {
        if (currentItem) {
            setFormData({
                menu_item_id: currentItem.menu_item_id,
                name: currentItem.name,
                unit: currentItem.unit,
                min_stock: currentItem.min_stock,
                current_stock: currentItem.current_stock,
                cost_price: currentItem.cost_price,
                selling_price: currentItem.selling_price,
                category: currentItem.category || '',
                image: currentItem.image || DEFAULT_IMAGE,
                product_type: currentItem.product_type || '',
                ncm: currentItem.ncm || '',
                cst_icms: currentItem.cst_icms || '',
                cfop: currentItem.cfop || '',
                icms_rate: currentItem.icms_rate,
                ipi_rate: currentItem.ipi_rate,
                ean_code: currentItem.ean_code || ''
            })
        }
    }, [currentItem])

    // Tipos de produto para cálculo de imposto
    const productTypes = [
        { value: 'alimento', label: 'Alimento' },
        { value: 'bebida', label: 'Bebida' },
        { value: 'limpeza', label: 'Limpeza' },
        { value: 'embalagem', label: 'Embalagem' },
        { value: 'outros', label: 'Outros' }
    ]

    // CST ICMS comuns
    const cstOptions = [
        { value: '00', label: '00 - Tributada integralmente' },
        { value: '10', label: '10 - Tributada e com cobrança do ICMS por substituição tributária' },
        { value: '20', label: '20 - Com redução de base de cálculo' },
        { value: '30', label: '30 - Isenta ou não tributada e com cobrança do ICMS por substituição tributária' },
        { value: '40', label: '40 - Isenta' },
        { value: '41', label: '41 - Não tributada' },
        { value: '50', label: '50 - Suspensão' },
        { value: '51', label: '51 - Diferimento' },
        { value: '60', label: '60 - ICMS cobrado anteriormente por substituição tributária' },
        { value: '70', label: '70 - Com redução de base de cálculo e cobrança do ICMS por substituição tributária' },
        { value: '90', label: '90 - Outras' }
    ]

    // CFOP comuns para compras
    const cfopOptions = [
        { value: '1101', label: '1101 - Compra para industrialização' },
        { value: '1102', label: '1102 - Compra para comercialização' },
        { value: '1401', label: '1401 - Compra para industrialização em operação com produto sujeito ao regime de substituição tributária' },
        { value: '1403', label: '1403 - Compra para comercialização em operação com mercadoria sujeita ao regime de substituição tributária' },
        { value: '1551', label: '1551 - Compra de bem para o ativo imobilizado' },
        { value: '1556', label: '1556 - Compra de material para uso ou consumo' },
        { value: '1651', label: '1651 - Compra de combustível ou lubrificante para industrialização' },
        { value: '1652', label: '1652 - Compra de combustível ou lubrificante para comercialização' },
        { value: '1653', label: '1653 - Compra de combustível ou lubrificante para consumo' }
    ]

    // Alíquotas ICMS comuns por estado (exemplo: SP)
    const icmsRates = [
        { value: 0, label: '0% - Isento' },
        { value: 7, label: '7% - Reduzida' },
        { value: 12, label: '12% - Reduzida' },
        { value: 18, label: '18% - Normal' },
        { value: 25, label: '25% - Aumentada' }
    ]

    const handleMenuItemSelect = (menuItemId: string) => {
        if (!menuItemId || menuItemId === 'none') {
            setFormData(prev => ({ ...prev, menu_item_id: null }))
            return
        }

        const menuItem = safeMenuItems.find(m => m.id === parseInt(menuItemId))
        if (menuItem) {
            setFormData(prev => ({
                ...prev,
                menu_item_id: menuItem.id,
                name: prev.name || menuItem.name,
                selling_price: prev.selling_price || menuItem.price,
                category: prev.category || menuItem.category || '',
                image: prev.image === DEFAULT_IMAGE ? (menuItem.image || DEFAULT_IMAGE) : prev.image
            }))
        }
    }

    const handleCategorySelect = (value: string) => {
        if (value === 'add-new-category') {
            setIsAddCategoryDialogOpen(true)
            return
        }
        setFormData({ ...formData, category: value === 'none' ? '' : value })
    }

    const handleAddCategory = async () => {
        if (!newCategoryName.trim()) {
            setCategoryError('Nome da categoria é obrigatório')
            return
        }

        setIsAddingCategory(true)
        setCategoryError(null)

        try {
            const result = await addCategory(newCategoryName.trim())
            if (result.success) {
                setFormData({ ...formData, category: newCategoryName.trim() })
                setNewCategoryName("")
                setIsAddCategoryDialogOpen(false)
            } else {
                setCategoryError(result.error || 'Erro ao criar categoria')
            }
        } catch (err: any) {
            setCategoryError(err.message || 'Erro ao criar categoria')
        } finally {
            setIsAddingCategory(false)
        }
    }

    const calculateTaxes = () => {
        if (!formData.cost_price || !formData.icms_rate) return null

        const icmsValue = (formData.cost_price * formData.icms_rate) / 100
        const ipiValue = formData.ipi_rate ? (formData.cost_price * formData.ipi_rate) / 100 : 0
        const totalWithTaxes = formData.cost_price + icmsValue + ipiValue

        return {
            costPrice: formData.cost_price,
            icmsValue,
            ipiValue,
            totalWithTaxes
        }
    }

    const taxCalculation = calculateTaxes()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setSuccess(false)

        if (!itemId) {
            setError('ID do item não encontrado')
            return
        }

        // Validações
        if (!formData.name.trim()) {
            setError('Nome do produto é obrigatório')
            return
        }

        if (formData.min_stock < 0) {
            setError('Estoque mínimo não pode ser negativo')
            return
        }

        if (formData.current_stock < 0) {
            setError('Estoque atual não pode ser negativo')
            return
        }

        if (formData.icms_rate !== null && (formData.icms_rate < 0 || formData.icms_rate > 100)) {
            setError('Alíquota de ICMS deve estar entre 0% e 100%')
            return
        }

        if (formData.ipi_rate !== null && (formData.ipi_rate < 0 || formData.ipi_rate > 100)) {
            setError('Alíquota de IPI deve estar entre 0% e 100%')
            return
        }

        setIsSubmitting(true)
        try {
            const result = await updateInventoryItem(itemId, {
                menu_item_id: formData.menu_item_id,
                name: formData.name,
                unit: formData.unit,
                min_stock: formData.min_stock,
                current_stock: formData.current_stock,
                cost_price: formData.cost_price,
                selling_price: formData.selling_price,
                category: formData.category || null,
                image: formData.image || DEFAULT_IMAGE,
                product_type: formData.product_type || null,
                ncm: formData.ncm || null,
                cst_icms: formData.cst_icms || null,
                cfop: formData.cfop || null,
                icms_rate: formData.icms_rate,
                ipi_rate: formData.ipi_rate,
                ean_code: formData.ean_code || null
            })

            if (result.success) {
                setSuccess(true)
                setTimeout(() => {
                    navigate('/stock')
                }, 1500)
            } else {
                setError(result.error || 'Erro ao atualizar item')
            }
        } catch (err: any) {
            setError(err.message || 'Erro ao atualizar item')
        } finally {
            setIsSubmitting(false)
        }
    }

    // Mostrar loading enquanto os dados estão carregando (depois de todos os hooks)
    if (isStockLoading || isRestaurantLoading || !currentItem) {
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
        <div className="space-y-6 max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => navigate('/stock')}
                >
                    <ArrowLeft className="w-5 h-5" />
                </Button>
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">
                        {t("editInventoryItem") || "Editar Item do Estoque"}
                    </h2>
                    <p className="text-muted-foreground">
                        {t("editInventoryItemDescription") || "Edite as informações do item de estoque"}
                    </p>
                </div>
            </div>

            {success && (
                <Card className="border-green-200 bg-green-50">
                    <CardContent className="p-4">
                        <p className="text-green-800 font-semibold">
                            Item atualizado com sucesso! Redirecionando...
                        </p>
                    </CardContent>
                </Card>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Informações Básicas */}
                <Card>
                    <CardHeader>
                        <CardTitle>Informações Básicas do Produto</CardTitle>
                        <CardDescription>Dados principais do item de estoque</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label htmlFor="menu_item">Vincular a Item do Cardápio (Opcional)</Label>
                            <Select
                                value={formData.menu_item_id?.toString() || 'none'}
                                onValueChange={handleMenuItemSelect}
                            >
                                <SelectTrigger id="menu_item">
                                    <SelectValue placeholder="Selecione um item do cardápio ou deixe em branco" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Nenhum (criar item independente)</SelectItem>
                                    {safeMenuItems.map((item) => (
                                        <SelectItem key={item.id} value={item.id.toString()}>
                                            {item.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <Label htmlFor="name">Nome do Produto *</Label>
                                <Input
                                    id="name"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    required
                                    placeholder="Ex: Arroz, Feijão, Óleo..."
                                />
                            </div>

                            <div className="md:col-span-2">
                                <Label htmlFor="image">URL da Imagem</Label>
                                <Input
                                    id="image"
                                    value={formData.image}
                                    onChange={(e) => setFormData({ ...formData, image: e.target.value || DEFAULT_IMAGE })}
                                    placeholder="URL da imagem ou caminho do arquivo"
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                    Deixe em branco para usar a imagem padrão. Se vincular a um item do menu, a imagem será copiada automaticamente.
                                </p>
                                {formData.image && (
                                    <div className="mt-2">
                                        <img
                                            src={formData.image}
                                            alt="Preview"
                                            className="w-32 h-32 object-cover rounded-md border"
                                            onError={(e) => {
                                                e.currentTarget.src = DEFAULT_IMAGE
                                            }}
                                        />
                                    </div>
                                )}
                            </div>

                            <div>
                                <Label htmlFor="unit">Unidade de Medida</Label>
                                <Input
                                    id="unit"
                                    value={formData.unit}
                                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                                    placeholder="UN, KG, L, etc"
                                />
                            </div>

                            <div>
                                <Label htmlFor="category">Categoria</Label>
                                <Select
                                    value={formData.category || 'none'}
                                    onValueChange={handleCategorySelect}
                                >
                                    <SelectTrigger id="category">
                                        <SelectValue placeholder="Selecione uma categoria" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">Sem categoria</SelectItem>
                                        {safeCategories.map((cat) => (
                                            <SelectItem key={cat.id} value={cat.name}>
                                                {cat.name}
                                            </SelectItem>
                                        ))}
                                        <SelectItem value="add-new-category" className="text-primary font-semibold">
                                            <div className="flex items-center gap-2">
                                                <Plus className="w-4 h-4" />
                                                Adicionar nova categoria...
                                            </div>
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label htmlFor="min_stock">Estoque Mínimo</Label>
                                <Input
                                    id="min_stock"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={formData.min_stock}
                                    onChange={(e) => setFormData({ ...formData, min_stock: parseFloat(e.target.value) || 0 })}
                                />
                            </div>

                            <div>
                                <Label htmlFor="current_stock">Estoque Atual</Label>
                                <Input
                                    id="current_stock"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={formData.current_stock}
                                    onChange={(e) => setFormData({ ...formData, current_stock: parseFloat(e.target.value) || 0 })}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Informações de Preço */}
                <Card>
                    <CardHeader>
                        <CardTitle>Informações de Preço</CardTitle>
                        <CardDescription>Preços de custo e venda do produto</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="cost_price">Preço de Custo (R$)</Label>
                                <Input
                                    id="cost_price"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={formData.cost_price || ''}
                                    onChange={(e) => setFormData({ ...formData, cost_price: e.target.value ? parseFloat(e.target.value) : null })}
                                    placeholder="0.00"
                                />
                            </div>

                            <div>
                                <Label htmlFor="selling_price">Preço de Venda (R$)</Label>
                                <Input
                                    id="selling_price"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={formData.selling_price || ''}
                                    onChange={(e) => setFormData({ ...formData, selling_price: e.target.value ? parseFloat(e.target.value) : null })}
                                    placeholder="0.00"
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Informações Fiscais para Nota Fiscal */}
                <Card>
                    <CardHeader>
                        <CardTitle>Informações Fiscais</CardTitle>
                        <CardDescription>Dados necessários para emissão de nota fiscal e cálculo de impostos</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="product_type">Tipo de Produto *</Label>
                                <Select
                                    value={formData.product_type || 'none'}
                                    onValueChange={(value) => setFormData({ ...formData, product_type: value === 'none' ? '' : value })}
                                >
                                    <SelectTrigger id="product_type">
                                        <SelectValue placeholder="Selecione o tipo" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">Não informado</SelectItem>
                                        {productTypes.map((type) => (
                                            <SelectItem key={type.value} value={type.value}>
                                                {type.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label htmlFor="ncm">NCM (Nomenclatura Comum do Mercosul)</Label>
                                <Input
                                    id="ncm"
                                    value={formData.ncm}
                                    onChange={(e) => setFormData({ ...formData, ncm: e.target.value })}
                                    placeholder="Ex: 1006.30.21"
                                    maxLength={8}
                                />
                            </div>

                            <div>
                                <Label htmlFor="cst_icms">CST ICMS (Código de Situação Tributária)</Label>
                                <Select
                                    value={formData.cst_icms || 'none'}
                                    onValueChange={(value) => setFormData({ ...formData, cst_icms: value === 'none' ? '' : value })}
                                >
                                    <SelectTrigger id="cst_icms">
                                        <SelectValue placeholder="Selecione o CST" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">Não informado</SelectItem>
                                        {cstOptions.map((cst) => (
                                            <SelectItem key={cst.value} value={cst.value}>
                                                {cst.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label htmlFor="cfop">CFOP (Código Fiscal de Operações)</Label>
                                <Select
                                    value={formData.cfop || 'none'}
                                    onValueChange={(value) => setFormData({ ...formData, cfop: value === 'none' ? '' : value })}
                                >
                                    <SelectTrigger id="cfop">
                                        <SelectValue placeholder="Selecione o CFOP" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">Não informado</SelectItem>
                                        {cfopOptions.map((cfop) => (
                                            <SelectItem key={cfop.value} value={cfop.value}>
                                                {cfop.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label htmlFor="icms_rate">Alíquota de ICMS (%)</Label>
                                <Select
                                    value={formData.icms_rate?.toString() || 'none'}
                                    onValueChange={(value) => setFormData({ ...formData, icms_rate: value === 'none' ? null : parseFloat(value) })}
                                >
                                    <SelectTrigger id="icms_rate">
                                        <SelectValue placeholder="Selecione a alíquota" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">Não informado</SelectItem>
                                        {icmsRates.map((rate) => (
                                            <SelectItem key={rate.value} value={rate.value.toString()}>
                                                {rate.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Input
                                    className="mt-2"
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.01"
                                    value={formData.icms_rate || ''}
                                    onChange={(e) => setFormData({ ...formData, icms_rate: e.target.value ? parseFloat(e.target.value) : null })}
                                    placeholder="Ou digite um valor personalizado"
                                />
                            </div>

                            <div>
                                <Label htmlFor="ipi_rate">Alíquota de IPI (%)</Label>
                                <Input
                                    id="ipi_rate"
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.01"
                                    value={formData.ipi_rate || ''}
                                    onChange={(e) => setFormData({ ...formData, ipi_rate: e.target.value ? parseFloat(e.target.value) : null })}
                                    placeholder="0.00 (opcional)"
                                />
                            </div>

                            <div>
                                <Label htmlFor="ean_code">Código de Barras (EAN)</Label>
                                <Input
                                    id="ean_code"
                                    value={formData.ean_code}
                                    onChange={(e) => setFormData({ ...formData, ean_code: e.target.value })}
                                    placeholder="7891234567890"
                                    maxLength={13}
                                />
                            </div>
                        </div>

                        {/* Cálculo de Impostos */}
                        {taxCalculation && (
                            <Card className="bg-muted">
                                <CardHeader>
                                    <CardTitle className="text-base">Cálculo de Impostos</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span>Preço de Custo:</span>
                                            <span className="font-medium">{formatCurrency(taxCalculation.costPrice)}</span>
                                        </div>
                                        {formData.icms_rate !== null && (
                                            <div className="flex justify-between">
                                                <span>ICMS ({formData.icms_rate}%):</span>
                                                <span className="font-medium">{formatCurrency(taxCalculation.icmsValue)}</span>
                                            </div>
                                        )}
                                        {formData.ipi_rate !== null && formData.ipi_rate > 0 && (
                                            <div className="flex justify-between">
                                                <span>IPI ({formData.ipi_rate}%):</span>
                                                <span className="font-medium">{formatCurrency(taxCalculation.ipiValue)}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between pt-2 border-t font-semibold">
                                            <span>Preço com Impostos:</span>
                                            <span className="text-lg">{formatCurrency(taxCalculation.totalWithTaxes)}</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </CardContent>
                </Card>

                {/* Erro */}
                {error && (
                    <Card className="border-destructive">
                        <CardContent className="p-4">
                            <p className="text-destructive">{error}</p>
                        </CardContent>
                    </Card>
                )}

                {/* Dialog para adicionar nova categoria */}
                <Dialog open={isAddCategoryDialogOpen} onOpenChange={setIsAddCategoryDialogOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Adicionar Nova Categoria</DialogTitle>
                            <DialogDescription>
                                Digite o nome da nova categoria que deseja criar.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div>
                                <Label htmlFor="new-category-name">Nome da Categoria</Label>
                                <Input
                                    id="new-category-name"
                                    value={newCategoryName}
                                    onChange={(e) => {
                                        setNewCategoryName(e.target.value)
                                        setCategoryError(null)
                                    }}
                                    placeholder="Ex: Bebidas, Limpeza, etc."
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault()
                                            handleAddCategory()
                                        }
                                    }}
                                    autoFocus
                                />
                            </div>
                            {categoryError && (
                                <p className="text-sm text-destructive">{categoryError}</p>
                            )}
                        </div>
                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setIsAddCategoryDialogOpen(false)
                                    setNewCategoryName("")
                                    setCategoryError(null)
                                }}
                                disabled={isAddingCategory}
                            >
                                Cancelar
                            </Button>
                            <Button
                                onClick={handleAddCategory}
                                disabled={isAddingCategory || !newCategoryName.trim()}
                            >
                                {isAddingCategory ? 'Criando...' : 'Criar Categoria'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Botões */}
                <div className="flex justify-end gap-4">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => navigate('/stock')}
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Cancelar
                    </Button>
                    <Button type="submit" disabled={isSubmitting || isStockLoading}>
                        <Save className="w-4 h-4 mr-2" />
                        {isSubmitting ? 'Salvando...' : 'Salvar Alterações'}
                    </Button>
                </div>
            </form>
        </div>
    )
}

