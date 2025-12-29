import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "../components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Textarea } from "../components/ui/textarea"
import { Switch } from "../components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select"
import { Badge } from "../components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../components/ui/dialog"
import { ArrowLeft, Plus, Edit, Trash2, Package, ShoppingBag, Loader2, X, Upload } from "lucide-react"
import { supabase, isSupabaseConfigured } from "../lib/supabase"
import { useRestaurant } from "../context/RestaurantContext"
import { formatCurrency } from "../lib/utils"
import type { Promotion, PromotionWithItems, CreatePromotionInput, PromotionItemWithProduct } from "../types/promotion"

export function Promotions() {
    const navigate = useNavigate()
    const { menuItems, categories, isLoading: isRestaurantLoading } = useRestaurant()
    
    const [promotions, setPromotions] = useState<PromotionWithItems[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingPromotion, setEditingPromotion] = useState<PromotionWithItems | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [dialogError, setDialogError] = useState<string | null>(null)
    const [isUploadingImage, setIsUploadingImage] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [uploadError, setUploadError] = useState<string | null>(null)
    const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
    const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    
    const [formData, setFormData] = useState<CreatePromotionInput>({
        name: '',
        description: '',
        image: null,
        type: 'kit',
        price: null,
        discount_percentage: null,
        discount_amount: null,
        enabled: true,
        category: 'none',
        items: []
    })
    
    const [selectedProducts, setSelectedProducts] = useState<Array<{ product_id: number; quantity: number }>>([])

    // Limpar object URL quando componente desmontar
    useEffect(() => {
        return () => {
            if (localPreviewUrl) {
                URL.revokeObjectURL(localPreviewUrl)
            }
        }
    }, [localPreviewUrl])

    // Função para redimensionar imagem
    const resizeImage = (file: File): Promise<File> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.readAsDataURL(file)
            reader.onload = (event) => {
                const img = new Image()
                img.src = event.target?.result as string
                img.onload = () => {
                    const MAX_WIDTH = 800
                    const MAX_HEIGHT = 800
                    
                    let width = img.width
                    let height = img.height
                    
                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height = (height * MAX_WIDTH) / width
                            width = MAX_WIDTH
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width = (width * MAX_HEIGHT) / height
                            height = MAX_HEIGHT
                        }
                    }
                    
                    const canvas = document.createElement('canvas')
                    canvas.width = MAX_WIDTH
                    canvas.height = MAX_HEIGHT
                    const ctx = canvas.getContext('2d')
                    
                    if (!ctx) {
                        reject(new Error('Não foi possível criar contexto do canvas'))
                        return
                    }
                    
                    ctx.fillStyle = '#FFFFFF'
                    ctx.fillRect(0, 0, MAX_WIDTH, MAX_HEIGHT)
                    
                    const x = (MAX_WIDTH - width) / 2
                    const y = (MAX_HEIGHT - height) / 2
                    ctx.drawImage(img, x, y, width, height)
                    
                    canvas.toBlob(
                        (blob) => {
                            if (!blob) {
                                reject(new Error('Erro ao redimensionar imagem'))
                                return
                            }
                            const resizedFile = new File([blob], file.name, {
                                type: 'image/jpeg',
                                lastModified: Date.now()
                            })
                            resolve(resizedFile)
                        },
                        'image/jpeg',
                        0.9
                    )
                }
                img.onerror = () => reject(new Error('Erro ao carregar imagem'))
            }
            reader.onerror = () => reject(new Error('Erro ao ler arquivo'))
        })
    }

    const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return

        if (!file.type.startsWith('image/')) {
            setUploadError('Por favor, selecione apenas arquivos de imagem')
            return
        }

        if (!isSupabaseConfigured) {
            setUploadError('Supabase não está configurado.')
            return
        }

        const previewUrl = URL.createObjectURL(file)
        setLocalPreviewUrl(previewUrl)

        setIsUploadingImage(true)
        setUploadProgress(0)
        setUploadError(null)

        let progressInterval: ReturnType<typeof setInterval> | null = null

        try {
            setUploadProgress(10)
            const resizedFile = await resizeImage(file)
            setUploadProgress(30)
            
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.jpg`
            const filePath = `promotions/${fileName}`

            let simulatedProgress = 30
            progressInterval = setInterval(() => {
                simulatedProgress += 5
                if (simulatedProgress <= 70) {
                    setUploadProgress(simulatedProgress)
                } else {
                    if (progressInterval) {
                        clearInterval(progressInterval)
                        progressInterval = null
                    }
                }
            }, 150)

            const { error } = await supabase.storage
                .from('product-images')
                .upload(filePath, resizedFile, {
                    cacheControl: '3600',
                    upsert: false,
                    contentType: 'image/jpeg'
                })

            if (progressInterval) {
                clearInterval(progressInterval)
                progressInterval = null
            }

            setUploadProgress(70)

            if (error) {
                if (progressInterval) {
                    clearInterval(progressInterval)
                    progressInterval = null
                }
                
                if (error.message.includes('Bucket not found')) {
                    setUploadError('Bucket de imagens não encontrado. Por favor, crie um bucket chamado "product-images" no Supabase Storage.')
                } else if (error.message.includes('row-level security policy') || error.message.includes('RLS')) {
                    setUploadError('Erro de política de segurança. Execute o script setup_storage_policies.sql no SQL Editor do Supabase para configurar as políticas do bucket.')
                } else {
                    setUploadError(`Erro ao fazer upload: ${error.message}`)
                }
                if (previewUrl) {
                    URL.revokeObjectURL(previewUrl)
                }
                setLocalPreviewUrl(null)
                setUploadProgress(0)
                setIsUploadingImage(false)
                return
            }

            setUploadProgress(75)

            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
            let finalImageUrl: string | null = null
            
            if (supabaseUrl) {
                finalImageUrl = `${supabaseUrl}/storage/v1/object/public/product-images/${filePath}`
            } else {
                try {
                    const urlResponse = supabase.storage
                        .from('product-images')
                        .getPublicUrl(filePath)
                    
                    finalImageUrl = urlResponse?.data?.publicUrl || null
                } catch (urlError) {
                    console.error('Erro ao obter URL:', urlError)
                }
            }

            setUploadProgress(85)

            if (finalImageUrl) {
                setUploadProgress(90)
                setImagePreviewUrl(finalImageUrl)
                setFormData(prev => ({ ...prev, image: finalImageUrl }))
                setUploadProgress(95)
                
                if (previewUrl) {
                    URL.revokeObjectURL(previewUrl)
                }
                setLocalPreviewUrl(null)
                
                setUploadProgress(100)
                setUploadError(null)
                setIsUploadingImage(false)
                
                setTimeout(() => {
                    setUploadProgress(0)
                }, 800)
            } else {
                setUploadError('Erro ao obter URL da imagem. Verifique se o bucket está público e as políticas RLS estão configuradas.')
                if (previewUrl) {
                    URL.revokeObjectURL(previewUrl)
                }
                setLocalPreviewUrl(null)
                setUploadProgress(0)
                setIsUploadingImage(false)
            }
        } catch (err: any) {
            if (progressInterval) {
                clearInterval(progressInterval)
                progressInterval = null
            }
            
            setUploadError(err.message || 'Erro ao fazer upload da imagem')
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl)
            }
            setLocalPreviewUrl(null)
            setUploadProgress(0)
        } finally {
            if (progressInterval) {
                clearInterval(progressInterval)
                progressInterval = null
            }
            if (fileInputRef.current) {
                fileInputRef.current.value = ''
            }
        }
    }

    // Buscar promoções
    const fetchPromotions = async () => {
        if (!isSupabaseConfigured) {
            console.warn('Supabase não configurado, usando modo demo')
            setPromotions([])
            setIsLoading(false)
            return
        }

        try {
            setIsLoading(true)
            setError(null)

            // Buscar promoções
            const { data: promotionsData, error: promotionsError } = await supabase
                .from('promotions')
                .select('*')
                .order('created_at', { ascending: false })

            if (promotionsError) {
                // Se a tabela não existe, apenas logar e continuar
                if (promotionsError.code === '42P01' || promotionsError.message?.includes('does not exist')) {
                    console.warn('Tabela promotions não existe ainda. Execute o script create_promotions_table.sql')
                    setPromotions([])
                    setIsLoading(false)
                    return
                }
                throw promotionsError
            }

            if (!promotionsData) {
                setPromotions([])
                setIsLoading(false)
                return
            }

            // Buscar itens de cada promoção
            const promotionsWithItems: PromotionWithItems[] = await Promise.all(
                promotionsData.map(async (promotion) => {
                    if (promotion.type === 'kit') {
                        try {
                            const { data: itemsData, error: itemsError } = await supabase
                                .from('promotion_items')
                                .select(`
                                    *,
                                    products:product_id (
                                        id,
                                        name,
                                        price,
                                        image
                                    )
                                `)
                                .eq('promotion_id', promotion.id)

                            if (itemsError) {
                                // Se a tabela não existe, apenas logar e continuar
                                if (itemsError.code === '42P01' || itemsError.message?.includes('does not exist')) {
                                    console.warn('Tabela promotion_items não existe ainda')
                                    return { ...promotion, items: [] } as PromotionWithItems
                                }
                                console.error('Error fetching promotion items:', itemsError)
                                return { ...promotion, items: [] } as PromotionWithItems
                            }

                            const items: PromotionItemWithProduct[] = (itemsData || []).map((item: any) => ({
                                id: item.id,
                                promotion_id: item.promotion_id,
                                product_id: item.product_id,
                                quantity: item.quantity,
                                created_at: item.created_at,
                                product: item.products ? {
                                    id: item.products.id,
                                    name: item.products.name,
                                    price: item.products.price,
                                    image: item.products.image
                                } : undefined
                            }))

                            return { ...promotion, items } as PromotionWithItems
                        } catch (err) {
                            console.error('Error processing promotion items:', err)
                            return { ...promotion, items: [] } as PromotionWithItems
                        }
                    }

                    return { ...promotion, items: [] } as PromotionWithItems
                })
            )

            setPromotions(promotionsWithItems)
        } catch (err: any) {
            console.error('Error fetching promotions:', err)
            setError(err.message || 'Erro ao carregar promoções')
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchPromotions()
    }, [])

    // Abrir dialog para criar nova promoção
    const handleCreateClick = () => {
        try {
            setEditingPromotion(null)
            setFormData({
                name: '',
                description: '',
                image: null,
                type: 'kit',
                price: null,
                discount_percentage: null,
                discount_amount: null,
                enabled: true,
                category: 'none',
                items: []
            })
            setSelectedProducts([])
            setImagePreviewUrl(null)
            setLocalPreviewUrl(null)
            setUploadError(null)
            setError(null)
            setDialogError(null)
            setIsDialogOpen(true)
        } catch (err) {
            console.error('Error opening create dialog:', err)
            setError('Erro ao abrir formulário de criação')
        }
    }

    // Abrir dialog para editar promoção
    const handleEditClick = (promotion: PromotionWithItems) => {
        setEditingPromotion(promotion)
        setFormData({
            name: promotion.name,
            description: promotion.description || '',
            image: promotion.image,
            type: promotion.type,
            price: promotion.price,
            discount_percentage: promotion.discount_percentage,
            discount_amount: promotion.discount_amount,
            enabled: promotion.enabled,
            category: promotion.category || 'none',
            items: promotion.items?.map(item => ({
                product_id: item.product_id,
                quantity: item.quantity
            })) || []
        })
        setSelectedProducts(
            promotion.items?.map(item => ({
                product_id: item.product_id,
                quantity: item.quantity
            })) || []
        )
        setImagePreviewUrl(null)
        setLocalPreviewUrl(null)
        setUploadError(null)
        setDialogError(null)
        setIsDialogOpen(true)
    }

    // Adicionar produto ao kit
    const handleAddProductToKit = () => {
        setSelectedProducts([...selectedProducts, { product_id: 0, quantity: 1 }])
    }

    // Remover produto do kit
    const handleRemoveProductFromKit = (index: number) => {
        setSelectedProducts(selectedProducts.filter((_, i) => i !== index))
    }

    // Atualizar produto no kit
    const handleUpdateProductInKit = (index: number, field: 'product_id' | 'quantity', value: number) => {
        const updated = [...selectedProducts]
        updated[index] = { ...updated[index], [field]: value }
        setSelectedProducts(updated)
    }

    // Salvar promoção
    const handleSubmit = async () => {
        setDialogError(null)
        
        if (!formData.name.trim()) {
            setDialogError('Nome da promoção é obrigatório')
            return
        }

        if (formData.type === 'kit' && selectedProducts.length === 0) {
            setDialogError('Adicione pelo menos um produto ao kit')
            return
        }

        if (formData.type === 'kit') {
            const hasValidProducts = selectedProducts.some(p => p.product_id > 0)
            if (!hasValidProducts) {
                setDialogError('Selecione pelo menos um produto válido no kit')
                return
            }
        }

        if (formData.type === 'product' && !formData.price) {
            setDialogError('Preço é obrigatório para produtos novos')
            return
        }

        if (!isSupabaseConfigured) {
            setDialogError('Supabase não está configurado')
            return
        }

        // Não permitir salvar enquanto estiver fazendo upload de imagem
        if (isUploadingImage) {
            setDialogError('Aguarde o upload da imagem terminar antes de salvar')
            return
        }

        try {
            setIsSubmitting(true)
            setError(null)
            setDialogError(null)

            // Priorizar imagePreviewUrl se existir (imagem recém-uploadada)
            const imageToSave = imagePreviewUrl || formData.image

            const promotionData: any = {
                name: formData.name.trim(),
                description: formData.description || null,
                image: imageToSave,
                type: formData.type,
                price: formData.price,
                discount_percentage: formData.discount_percentage,
                discount_amount: formData.discount_amount,
                enabled: formData.enabled ?? true,
                category: formData.category === 'none' || !formData.category ? null : formData.category
            }

            if (editingPromotion) {
                // Atualizar promoção existente
                const { data: updatedPromotion, error: updateError } = await supabase
                    .from('promotions')
                    .update(promotionData)
                    .eq('id', editingPromotion.id)
                    .select()
                    .single()

                if (updateError) throw updateError

                // Se for kit, atualizar itens
                if (formData.type === 'kit' && updatedPromotion) {
                    // Deletar itens antigos
                    await supabase
                        .from('promotion_items')
                        .delete()
                        .eq('promotion_id', updatedPromotion.id)

                    // Inserir novos itens
                    if (selectedProducts.length > 0) {
                        const itemsToInsert = selectedProducts
                            .filter(p => p.product_id > 0)
                            .map(p => ({
                                promotion_id: updatedPromotion.id,
                                product_id: p.product_id,
                                quantity: p.quantity
                            }))

                        if (itemsToInsert.length > 0) {
                            const { error: itemsError } = await supabase
                                .from('promotion_items')
                                .insert(itemsToInsert)

                            if (itemsError) throw itemsError
                        }
                    }
                }
            } else {
                // Criar nova promoção
                const { data: newPromotion, error: createError } = await supabase
                    .from('promotions')
                    .insert(promotionData)
                    .select()
                    .single()

                if (createError) throw createError

                // Se for kit, inserir itens
                if (formData.type === 'kit' && newPromotion) {
                    const itemsToInsert = selectedProducts
                        .filter(p => p.product_id > 0)
                        .map(p => ({
                            promotion_id: newPromotion.id,
                            product_id: p.product_id,
                            quantity: p.quantity
                        }))

                    if (itemsToInsert.length > 0) {
                        const { error: itemsError } = await supabase
                            .from('promotion_items')
                            .insert(itemsToInsert)

                        if (itemsError) throw itemsError
                    }
                }
            }

            await fetchPromotions()
            setIsDialogOpen(false)
            setEditingPromotion(null)
            setDialogError(null)
        } catch (err: any) {
            console.error('Error saving promotion:', err)
            const errorMessage = err.message || 'Erro ao salvar promoção'
            setDialogError(errorMessage)
            setError(errorMessage)
        } finally {
            setIsSubmitting(false)
        }
    }

    // Deletar promoção
    const handleDelete = async (id: number) => {
        if (!confirm('Tem certeza que deseja excluir esta promoção?')) return

        try {
            const { error } = await supabase
                .from('promotions')
                .delete()
                .eq('id', id)

            if (error) throw error

            await fetchPromotions()
        } catch (err: any) {
            console.error('Error deleting promotion:', err)
            setError(err.message || 'Erro ao excluir promoção')
        }
    }

    // Toggle enabled
    const handleToggleEnabled = async (promotion: Promotion) => {
        try {
            const { error } = await supabase
                .from('promotions')
                .update({ enabled: !promotion.enabled })
                .eq('id', promotion.id)

            if (error) throw error

            await fetchPromotions()
        } catch (err: any) {
            console.error('Error toggling promotion:', err)
            setError(err.message || 'Erro ao atualizar promoção')
        }
    }

    // Produtos disponíveis para kits
    const availableProducts = menuItems?.filter(p => p.price != null && p.price > 0) || []

    // Se o restaurante ainda está carregando, mostrar loading
    if (isRestaurantLoading || isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="container mx-auto p-4 space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold">Promoções e Produtos Customizados</h1>
                        <p className="text-muted-foreground">Gerencie promoções e combinações de produtos</p>
                    </div>
                </div>
                <Button onClick={handleCreateClick}>
                    <Plus className="h-4 w-4 mr-2" />
                    Nova Promoção
                </Button>
            </div>

            {error && (
                <Card className="border-destructive">
                    <CardContent className="pt-6">
                        <p className="text-destructive">{error}</p>
                    </CardContent>
                </Card>
            )}

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {promotions.map((promotion) => (
                    <Card key={promotion.id}>
                        <CardHeader>
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <CardTitle className="text-lg">{promotion.name}</CardTitle>
                                    <CardDescription className="mt-1">
                                        {promotion.type === 'kit' ? (
                                            <Badge variant="secondary">
                                                <ShoppingBag className="h-3 w-3 mr-1" />
                                                Kit
                                            </Badge>
                                        ) : (
                                            <Badge variant="secondary">
                                                <Package className="h-3 w-3 mr-1" />
                                                Produto
                                            </Badge>
                                        )}
                                    </CardDescription>
                                </div>
                                <Switch
                                    checked={promotion.enabled}
                                    onCheckedChange={() => handleToggleEnabled(promotion)}
                                />
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {promotion.image && (
                                <img
                                    src={promotion.image}
                                    alt={promotion.name}
                                    className="w-full h-48 object-cover rounded-lg"
                                />
                            )}
                            
                            {promotion.description && (
                                <p className="text-sm text-muted-foreground">{promotion.description}</p>
                            )}

                            {promotion.type === 'kit' && promotion.items && promotion.items.length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-sm font-semibold">Produtos do Kit:</p>
                                    <ul className="text-sm space-y-1">
                                        {promotion.items.map((item, idx) => (
                                            <li key={idx} className="flex justify-between">
                                                <span>{item.product?.name || `Produto #${item.product_id}`}</span>
                                                <span className="text-muted-foreground">x{item.quantity}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <div className="flex items-center justify-between pt-2 border-t">
                                {promotion.price && (
                                    <span className="text-lg font-bold">
                                        {formatCurrency(promotion.price)}
                                    </span>
                                )}
                                {(promotion.discount_percentage || promotion.discount_amount) && (
                                    <Badge variant="outline">
                                        {promotion.discount_percentage
                                            ? `${promotion.discount_percentage}% OFF`
                                            : promotion.discount_amount
                                            ? `${formatCurrency(promotion.discount_amount)} OFF`
                                            : ''}
                                    </Badge>
                                )}
                            </div>

                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1"
                                    onClick={() => handleEditClick(promotion)}
                                >
                                    <Edit className="h-4 w-4 mr-2" />
                                    Editar
                                </Button>
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => handleDelete(promotion.id)}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {promotions.length === 0 && !isLoading && (
                <Card>
                    <CardContent className="pt-6 text-center space-y-2">
                        <p className="text-muted-foreground">Nenhuma promoção cadastrada</p>
                        {!isSupabaseConfigured && (
                            <p className="text-xs text-muted-foreground">
                                Configure o Supabase para usar promoções
                            </p>
                        )}
                        {isSupabaseConfigured && error && error.includes('does not exist') && (
                            <p className="text-xs text-destructive">
                                Execute o script create_promotions_table.sql no banco de dados
                            </p>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Dialog de criação/edição */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {editingPromotion ? 'Editar Promoção' : 'Nova Promoção'}
                        </DialogTitle>
                        <DialogDescription>
                            Crie uma promoção como produto novo ou combinação de produtos (kit)
                        </DialogDescription>
                    </DialogHeader>

                    {dialogError && (
                        <div className="bg-destructive/15 text-destructive text-sm p-3 rounded-md">
                            {dialogError}
                        </div>
                    )}

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Nome *</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="Ex: Combo Burger + Batata"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="description">Descrição</Label>
                            <Textarea
                                id="description"
                                value={formData.description || ''}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Descrição da promoção..."
                                rows={3}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="type">Tipo *</Label>
                            <Select
                                value={formData.type}
                                onValueChange={(value: 'product' | 'kit') => {
                                    setFormData({ ...formData, type: value })
                                    if (value === 'product') {
                                        setSelectedProducts([])
                                    }
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="kit">Kit (Combinação de Produtos)</SelectItem>
                                    <SelectItem value="product">Produto Novo</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {formData.type === 'product' && (
                            <div className="space-y-2">
                                <Label htmlFor="price">Preço *</Label>
                                <Input
                                    id="price"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={formData.price || ''}
                                    onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || null })}
                                    placeholder="0.00"
                                />
                            </div>
                        )}

                        {formData.type === 'kit' && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <Label>Produtos do Kit *</Label>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={handleAddProductToKit}
                                    >
                                        <Plus className="h-4 w-4 mr-2" />
                                        Adicionar Produto
                                    </Button>
                                </div>

                                {selectedProducts.map((product, index) => (
                                    <Card key={`product-${index}-${product.product_id}`}>
                                        <CardContent className="pt-4">
                                            <div className="flex gap-2">
                                                <Select
                                                    value={product.product_id > 0 ? product.product_id.toString() : undefined}
                                                    onValueChange={(value) => {
                                                        const productId = parseInt(value)
                                                        if (!isNaN(productId) && productId > 0) {
                                                            handleUpdateProductInKit(index, 'product_id', productId)
                                                        }
                                                    }}
                                                >
                                                    <SelectTrigger className="flex-1">
                                                        <SelectValue placeholder="Selecione um produto" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {availableProducts.length > 0 ? (
                                                            availableProducts.map((p) => (
                                                                <SelectItem key={p.id} value={p.id.toString()}>
                                                                    {p.name} - {formatCurrency(p.price || 0)}
                                                                </SelectItem>
                                                            ))
                                                        ) : (
                                                            <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                                                Nenhum produto disponível
                                                            </div>
                                                        )}
                                                    </SelectContent>
                                                </Select>
                                                <Input
                                                    type="number"
                                                    min="1"
                                                    step="1"
                                                    value={product.quantity}
                                                    onChange={(e) =>
                                                        handleUpdateProductInKit(index, 'quantity', parseInt(e.target.value) || 1)
                                                    }
                                                    className="w-20"
                                                />
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleRemoveProductFromKit(index)}
                                                >
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}

                                <div className="space-y-2">
                                    <Label htmlFor="kit-price">Preço do Kit (opcional)</Label>
                                    <Input
                                        id="kit-price"
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={formData.price || ''}
                                        onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || null })}
                                        placeholder="Deixe vazio para usar soma dos produtos"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Se não informado, será calculado automaticamente pela soma dos produtos
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="discount_percentage">Desconto Percentual (%)</Label>
                                <Input
                                    id="discount_percentage"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    max="100"
                                    value={formData.discount_percentage || ''}
                                    onChange={(e) => setFormData({ ...formData, discount_percentage: parseFloat(e.target.value) || null })}
                                    placeholder="0"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="discount_amount">Desconto Fixo (R$)</Label>
                                <Input
                                    id="discount_amount"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={formData.discount_amount || ''}
                                    onChange={(e) => setFormData({ ...formData, discount_amount: parseFloat(e.target.value) || null })}
                                    placeholder="0.00"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="category">Categoria</Label>
                            <Select
                                value={formData.category || undefined}
                                onValueChange={(value) => setFormData({ ...formData, category: value === 'none' ? null : value })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione uma categoria" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Sem categoria</SelectItem>
                                    {categories && categories.length > 0 ? (
                                        categories.map((cat) => (
                                            <SelectItem key={cat.id} value={cat.name}>
                                                {cat.name}
                                            </SelectItem>
                                        ))
                                    ) : null}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="image">Imagem da Promoção</Label>
                            
                            {/* Botão de Upload */}
                            <div className="flex gap-2 mb-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isUploadingImage || isSubmitting || !isSupabaseConfigured}
                                    className="w-auto"
                                >
                                    {isUploadingImage ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Enviando... {uploadProgress}%
                                        </>
                                    ) : (
                                        <>
                                            <Upload className="w-4 h-4 mr-2" />
                                            {formData.image ? 'Alterar Imagem' : 'Selecionar Imagem'}
                                        </>
                                    )}
                                </Button>
                                <Input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageUpload}
                                    className="hidden"
                                    disabled={isUploadingImage}
                                />
                                {!isSupabaseConfigured && (
                                    <p className="text-xs text-muted-foreground self-center">
                                        Supabase não configurado.
                                    </p>
                                )}
                            </div>
                            
                            {/* Barra de progresso do upload */}
                            {isUploadingImage && uploadProgress > 0 && (
                                <div className="w-full mb-2">
                                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                                        <div
                                            className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                                            style={{ width: `${uploadProgress}%` }}
                                        ></div>
                                    </div>
                                </div>
                            )}

                            {/* Erro de upload */}
                            {uploadError && (
                                <p className="text-sm text-destructive mb-2">{uploadError}</p>
                            )}

                            {/* Preview da imagem */}
                            {(localPreviewUrl || imagePreviewUrl || formData.image) && (
                                <div className="mt-2">
                                    {isUploadingImage && (
                                        <p className="text-xs text-muted-foreground mb-2">
                                            Redimensionando e enviando imagem (800x800px)...
                                        </p>
                                    )}
                                    {!isUploadingImage && formData.image && (
                                        <p className="text-xs text-muted-foreground mb-2">
                                            Imagem carregada com sucesso. A imagem foi redimensionada automaticamente para 800x800px.
                                        </p>
                                    )}
                                    <img
                                        src={localPreviewUrl || imagePreviewUrl || formData.image || ''}
                                        alt="Preview"
                                        className="w-32 h-32 object-cover rounded-md border"
                                        onLoad={() => {
                                            if (imagePreviewUrl && localPreviewUrl && !isUploadingImage) {
                                                URL.revokeObjectURL(localPreviewUrl)
                                                setLocalPreviewUrl(null)
                                            }
                                        }}
                                        onError={(e) => {
                                            const target = e.currentTarget
                                            if (localPreviewUrl && target.src !== localPreviewUrl) {
                                                target.src = localPreviewUrl
                                                return
                                            }
                                            if (imagePreviewUrl && target.src !== imagePreviewUrl) {
                                                target.src = imagePreviewUrl
                                                return
                                            }
                                            if (formData.image && target.src !== formData.image) {
                                                target.src = formData.image
                                                return
                                            }
                                        }}
                                    />
                                </div>
                            )}

                            {/* Campo alternativo para URL (se preferir usar URL direta) */}
                            <div className="mt-2">
                                <Label htmlFor="image-url" className="text-xs text-muted-foreground">
                                    Ou cole uma URL de imagem:
                                </Label>
                                <Input
                                    id="image-url"
                                    value={formData.image || ''}
                                    onChange={(e) => setFormData({ ...formData, image: e.target.value || null })}
                                    placeholder="https://..."
                                    disabled={isUploadingImage}
                                />
                            </div>
                        </div>

                        <div className="flex items-center space-x-2">
                            <Switch
                                id="enabled"
                                checked={formData.enabled ?? true}
                                onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
                            />
                            <Label htmlFor="enabled">Habilitada</Label>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                            Cancelar
                        </Button>
                        <Button onClick={handleSubmit} disabled={isSubmitting || isUploadingImage}>
                            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            {isSubmitting ? (editingPromotion ? 'Salvando...' : 'Criando...') : isUploadingImage ? 'Aguarde o upload...' : (editingPromotion ? 'Salvar' : 'Criar')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

