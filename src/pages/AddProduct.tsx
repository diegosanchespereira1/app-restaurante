import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useRestaurant } from "../context/RestaurantContext"
import { useLanguage } from "../context/LanguageContext"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select"
import { Textarea } from "../components/ui/textarea"
import { ArrowLeft, Save, Plus } from "lucide-react"
import type { CreateProductInput } from "../types/product"

const DEFAULT_IMAGE = 'materialApoio/imagem-nao-disponivel.gif'

export function AddProduct() {
    const navigate = useNavigate()
    const { addProduct, categories, isLoading: isRestaurantLoading, addCategory } = useRestaurant()
    const { t } = useLanguage()
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)
    const [isAddCategoryDialogOpen, setIsAddCategoryDialogOpen] = useState(false)
    const [newCategoryName, setNewCategoryName] = useState("")
    const [isAddingCategory, setIsAddingCategory] = useState(false)
    const [categoryError, setCategoryError] = useState<string | null>(null)
    
    const [formData, setFormData] = useState<CreateProductInput>({
        name: '',
        category: '',
        image: DEFAULT_IMAGE,
        // Campos de venda
        price: null,
        description: null,
        status: null,
        // Campos de estoque
        unit: null,
        min_stock: null,
        current_stock: null,
        cost_price: null,
        // Campos fiscais
        product_type: null,
        ncm: null,
        cst_icms: null,
        cfop: null,
        icms_rate: null,
        ipi_rate: null,
        ean_code: null
    })

    // Opções para selects
    const productTypes = [
        { value: 'alimento', label: 'Alimento' },
        { value: 'bebida', label: 'Bebida' },
        { value: 'limpeza', label: 'Limpeza' },
        { value: 'embalagem', label: 'Embalagem' },
        { value: 'outros', label: 'Outros' }
    ]

    const units = [
        { value: 'UN', label: 'UN - Unidade' },
        { value: 'KG', label: 'KG - Quilograma' },
        { value: 'L', label: 'L - Litro' },
        { value: 'CX', label: 'CX - Caixa' },
        { value: 'PC', label: 'PC - Pacote' }
    ]

    const handleCategorySelect = (value: string) => {
        if (value === 'add-new-category') {
            setIsAddCategoryDialogOpen(true)
            return
        }
        setFormData({ ...formData, category: value === 'none' ? null : value })
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
                setCategoryError(null)
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setSuccess(false)

        // Validações
        if (!formData.name || formData.name.trim() === '') {
            setError('Nome do produto é obrigatório')
            return
        }

        if (!formData.price && !formData.unit) {
            setError('Produto deve ter preço de venda ou informações de estoque (unidade)')
            return
        }

        setIsSubmitting(true)
        setError(null)
        setSuccess(false)

        try {
            console.log('Tentando criar produto:', formData)
            const result = await addProduct(formData)
            console.log('Resultado da criação:', result)

            if (result && result.success) {
                setSuccess(true)
                setTimeout(() => {
                    navigate('/settings')
                }, 1500)
            } else {
                setError(result?.error || 'Erro ao criar produto')
            }
        } catch (err: any) {
            console.error('Erro ao criar produto:', err)
            setError(err?.message || 'Erro ao criar produto')
        } finally {
            setIsSubmitting(false)
        }
    }

    if (isRestaurantLoading) {
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
        <div className="container max-w-4xl mx-auto py-8 px-4">
            <div className="flex items-center gap-4 mb-6">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => navigate('/settings')}
                >
                    <ArrowLeft className="w-5 h-5" />
                </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">
                        Cadastrar Produto
                    </h1>
                    <p className="text-muted-foreground">
                        Cadastre um novo produto com todas as informações necessárias
                    </p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Informações Básicas */}
                <Card>
                    <CardHeader>
                        <CardTitle>Informações Básicas</CardTitle>
                        <CardDescription>Dados principais do produto</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label htmlFor="name">Nome do Produto *</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                required
                                placeholder="Ex: Pizza Margherita"
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
                                    {categories.map((cat) => (
                                        <SelectItem key={cat.id} value={cat.name}>
                                            {cat.name}
                                        </SelectItem>
                                    ))}
                                    <SelectItem value="add-new-category">
                                        <Plus className="w-4 h-4 inline mr-2" />
                                        Nova categoria
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label htmlFor="image">URL da Imagem</Label>
                            <Input
                                id="image"
                                value={formData.image || ''}
                                onChange={(e) => setFormData({ ...formData, image: e.target.value || DEFAULT_IMAGE })}
                                placeholder={DEFAULT_IMAGE}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Informações de Venda */}
                <Card>
                    <CardHeader>
                        <CardTitle>Informações de Venda</CardTitle>
                        <CardDescription>Preencha se o produto será vendido diretamente</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label htmlFor="price">Preço de Venda</Label>
                            <Input
                                id="price"
                                type="number"
                                step="0.01"
                                min="0"
                                value={formData.price || ''}
                                onChange={(e) => setFormData({ ...formData, price: e.target.value ? parseFloat(e.target.value) : null })}
                                placeholder="0.00"
                            />
                        </div>

                        <div>
                            <Label htmlFor="description">Descrição</Label>
                            <Textarea
                                id="description"
                                value={formData.description || ''}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value || null })}
                                placeholder="Descrição do produto"
                                rows={3}
                            />
                        </div>

                        {formData.price && (
                            <div>
                                <Label htmlFor="status">Status</Label>
                                <Select
                                    value={formData.status || 'Available'}
                                    onValueChange={(value: "Available" | "Sold Out") => setFormData({ ...formData, status: value })}
                                >
                                    <SelectTrigger id="status">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Available">Disponível</SelectItem>
                                        <SelectItem value="Sold Out">Esgotado</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Informações de Estoque */}
                <Card>
                    <CardHeader>
                        <CardTitle>Informações de Estoque</CardTitle>
                        <CardDescription>Preencha se o produto terá controle de estoque</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label htmlFor="unit">Unidade de Medida</Label>
                            <Select
                                value={formData.unit || ''}
                                onValueChange={(value) => setFormData({ ...formData, unit: value || null })}
                            >
                                <SelectTrigger id="unit">
                                    <SelectValue placeholder="Selecione uma unidade" />
                                </SelectTrigger>
                                <SelectContent>
                                    {units.map((unit) => (
                                        <SelectItem key={unit.value} value={unit.value}>
                                            {unit.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="min_stock">Estoque Mínimo</Label>
                                <Input
                                    id="min_stock"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={formData.min_stock || ''}
                                    onChange={(e) => setFormData({ ...formData, min_stock: e.target.value ? parseFloat(e.target.value) : null })}
                                />
                            </div>

                            <div>
                                <Label htmlFor="current_stock">Estoque Atual</Label>
                                <Input
                                    id="current_stock"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={formData.current_stock || ''}
                                    onChange={(e) => setFormData({ ...formData, current_stock: e.target.value ? parseFloat(e.target.value) : null })}
                                />
                            </div>
                        </div>

                        <div>
                            <Label htmlFor="cost_price">Preço de Custo</Label>
                            <Input
                                id="cost_price"
                                type="number"
                                step="0.01"
                                min="0"
                                value={formData.cost_price || ''}
                                onChange={(e) => setFormData({ ...formData, cost_price: e.target.value ? parseFloat(e.target.value) : null })}
                                placeholder="0.00"
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Informações Fiscais */}
                <Card>
                    <CardHeader>
                        <CardTitle>Informações Fiscais (Opcional)</CardTitle>
                        <CardDescription>Dados para emissão de notas fiscais e cálculo de impostos</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label htmlFor="product_type">Tipo de Produto</Label>
                            <Select
                                value={formData.product_type || 'none'}
                                onValueChange={(value) => setFormData({ ...formData, product_type: value === 'none' ? null : value })}
                            >
                                <SelectTrigger id="product_type">
                                    <SelectValue placeholder="Selecione o tipo" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Não especificado</SelectItem>
                                    {productTypes.map((type) => (
                                        <SelectItem key={type.value} value={type.value}>
                                            {type.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="ncm">NCM</Label>
                                <Input
                                    id="ncm"
                                    value={formData.ncm || ''}
                                    onChange={(e) => setFormData({ ...formData, ncm: e.target.value || null })}
                                    placeholder="00000000"
                                    maxLength={8}
                                />
                            </div>

                            <div>
                                <Label htmlFor="ean_code">Código de Barras (EAN)</Label>
                                <Input
                                    id="ean_code"
                                    value={formData.ean_code || ''}
                                    onChange={(e) => setFormData({ ...formData, ean_code: e.target.value || null })}
                                    placeholder="7891234567890"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="cst_icms">CST ICMS</Label>
                                <Input
                                    id="cst_icms"
                                    value={formData.cst_icms || ''}
                                    onChange={(e) => setFormData({ ...formData, cst_icms: e.target.value || null })}
                                    placeholder="00"
                                />
                            </div>

                            <div>
                                <Label htmlFor="cfop">CFOP</Label>
                                <Input
                                    id="cfop"
                                    value={formData.cfop || ''}
                                    onChange={(e) => setFormData({ ...formData, cfop: e.target.value || null })}
                                    placeholder="1102"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="icms_rate">Alíquota ICMS (%)</Label>
                                <Input
                                    id="icms_rate"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    max="100"
                                    value={formData.icms_rate || ''}
                                    onChange={(e) => setFormData({ ...formData, icms_rate: e.target.value ? parseFloat(e.target.value) : null })}
                                    placeholder="18"
                                />
                            </div>

                            <div>
                                <Label htmlFor="ipi_rate">Alíquota IPI (%)</Label>
                                <Input
                                    id="ipi_rate"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    max="100"
                                    value={formData.ipi_rate || ''}
                                    onChange={(e) => setFormData({ ...formData, ipi_rate: e.target.value ? parseFloat(e.target.value) : null })}
                                    placeholder="10"
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Mensagens de erro e sucesso */}
                {error && (
                    <div className="p-4 bg-destructive/10 text-destructive rounded-md">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="p-4 bg-green-500/10 text-green-700 rounded-md">
                        Produto cadastrado com sucesso! Redirecionando...
                    </div>
                )}

                {/* Botões */}
                <div className="flex justify-end gap-4">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => navigate('/settings')}
                    >
                        Cancelar
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                        <Save className="w-4 h-4 mr-2" />
                        {isSubmitting ? 'Salvando...' : 'Salvar Produto'}
                    </Button>
                </div>
            </form>

            {/* Dialog para adicionar categoria */}
            {isAddCategoryDialogOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <Card className="w-full max-w-md">
                        <CardHeader>
                            <CardTitle>Nova Categoria</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label htmlFor="newCategoryName">Nome da Categoria</Label>
                                <Input
                                    id="newCategoryName"
                                    value={newCategoryName}
                                    onChange={(e) => setNewCategoryName(e.target.value)}
                                    placeholder="Ex: Bebidas"
                                />
                                {categoryError && (
                                    <p className="text-sm text-destructive mt-1">{categoryError}</p>
                                )}
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setIsAddCategoryDialogOpen(false)
                                        setNewCategoryName("")
                                        setCategoryError(null)
                                    }}
                                >
                                    Cancelar
                                </Button>
                                <Button onClick={handleAddCategory} disabled={isAddingCategory}>
                                    {isAddingCategory ? 'Criando...' : 'Criar'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    )
}

