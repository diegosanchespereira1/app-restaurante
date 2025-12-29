import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { useRestaurant } from "../context/RestaurantContext"
import { useLanguage } from "../context/LanguageContext"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select"
import { Textarea } from "../components/ui/textarea"
import { ArrowLeft, Save, Plus, Upload, Loader2 } from "lucide-react"
import type { CreateProductInput } from "../types/product"
import { supabase, isSupabaseConfigured } from "../lib/supabase"
import { formatCurrency } from "../lib/utils"

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
    const [isUploadingImage, setIsUploadingImage] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [uploadError, setUploadError] = useState<string | null>(null)
    const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
    const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    
    const [formData, setFormData] = useState<CreateProductInput>({
        name: '',
        category: '',
        image: DEFAULT_IMAGE,
        // Campos de venda
        price: null,
        description: null,
        status: null,
        is_cold: false,
        // Campos de desconto por método de pagamento
        discount_type: null,
        discount_value: null,
        discount_applies_to: null,
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
                    // Tamanho fixo para redimensionamento: 800x800 (formato quadrado)
                    const MAX_WIDTH = 800
                    const MAX_HEIGHT = 800
                    
                    let width = img.width
                    let height = img.height
                    
                    // Calcular novas dimensões mantendo proporção
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
                    
                    // Criar canvas para redimensionar
                    const canvas = document.createElement('canvas')
                    canvas.width = MAX_WIDTH
                    canvas.height = MAX_HEIGHT
                    const ctx = canvas.getContext('2d')
                    
                    if (!ctx) {
                        reject(new Error('Não foi possível criar contexto do canvas'))
                        return
                    }
                    
                    // Preencher fundo branco
                    ctx.fillStyle = '#FFFFFF'
                    ctx.fillRect(0, 0, MAX_WIDTH, MAX_HEIGHT)
                    
                    // Centralizar e redimensionar imagem
                    const x = (MAX_WIDTH - width) / 2
                    const y = (MAX_HEIGHT - height) / 2
                    ctx.drawImage(img, x, y, width, height)
                    
                    // Converter canvas para blob e depois para File
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
                        0.9 // Qualidade JPEG (90%)
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

        // Validar tipo de arquivo
        if (!file.type.startsWith('image/')) {
            setUploadError('Por favor, selecione apenas arquivos de imagem')
            return
        }

        if (!isSupabaseConfigured) {
            setUploadError('Supabase não está configurado.')
            return
        }

        // Criar preview imediato usando URL.createObjectURL
        const previewUrl = URL.createObjectURL(file)
        setLocalPreviewUrl(previewUrl)

        setIsUploadingImage(true)
        setUploadProgress(0)
        setUploadError(null)

        let progressInterval: ReturnType<typeof setInterval> | null = null

        try {
            // Simular progresso: redimensionamento (0-30%)
            setUploadProgress(10)
            const resizedFile = await resizeImage(file)
            setUploadProgress(30)
            
            // Gerar nome único para o arquivo
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.jpg`
            const filePath = `product-images/${fileName}`

            // Simular progresso durante o upload (30-70%)
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

            // Fazer upload para o Supabase Storage
            const { error } = await supabase.storage
                .from('product-images')
                .upload(filePath, resizedFile, {
                    cacheControl: '3600',
                    upsert: false,
                    contentType: 'image/jpeg'
                })

            // Parar a simulação de progresso
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

            // Construir URL manualmente
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

        // Não permitir salvar enquanto estiver fazendo upload de imagem
        if (isUploadingImage) {
            setError('Aguarde o upload da imagem terminar antes de salvar')
            return
        }

        setIsSubmitting(true)
        setError(null)
        setSuccess(false)

        try {
            console.log('Tentando criar produto:', formData)
            // Priorizar imagePreviewUrl se existir (imagem recém-uploadada)
            const imageToSave = imagePreviewUrl || formData.image || DEFAULT_IMAGE
            const productData = { ...formData, image: imageToSave }
            
            const result = await addProduct(productData)
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
                            <Label htmlFor="image">Imagem do Produto</Label>
                            
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
                                            {formData.image && formData.image !== DEFAULT_IMAGE ? 'Alterar Imagem' : 'Selecionar Imagem'}
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
                            {(localPreviewUrl || imagePreviewUrl || (formData.image && formData.image !== DEFAULT_IMAGE)) && (
                                <div className="mt-2">
                                    {isUploadingImage && (
                                        <p className="text-xs text-muted-foreground mb-2">
                                            Redimensionando e enviando imagem (800x800px)...
                                        </p>
                                    )}
                                    {!isUploadingImage && formData.image && formData.image !== DEFAULT_IMAGE && (
                                        <p className="text-xs text-muted-foreground mb-2">
                                            Imagem carregada com sucesso. A imagem foi redimensionada automaticamente para 800x800px.
                                        </p>
                                    )}
                                    <img
                                        src={localPreviewUrl || imagePreviewUrl || formData.image || DEFAULT_IMAGE}
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
                                            if (formData.image && formData.image !== DEFAULT_IMAGE && target.src !== formData.image) {
                                                target.src = formData.image
                                                return
                                            }
                                            if (target.src !== DEFAULT_IMAGE) {
                                                target.src = DEFAULT_IMAGE
                                            }
                                        }}
                                    />
                                </div>
                            )}
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

                        {/* Campo Bebida Gelada - sempre visível */}
                        <div className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                id="is_cold"
                                checked={formData.is_cold || false}
                                onChange={(e) => setFormData({ ...formData, is_cold: e.target.checked })}
                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <Label htmlFor="is_cold" className="cursor-pointer">
                                Bebida gelada (mostra ícone de floco de neve)
                            </Label>
                        </div>

                        {formData.price && (
                            <>
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
                                
                                {/* Campos de Desconto por Método de Pagamento */}
                                <div className="border-t pt-4 mt-4 space-y-4">
                                    <div>
                                        <Label className="text-base font-semibold">Desconto por Método de Pagamento</Label>
                                        <p className="text-sm text-muted-foreground mb-3">
                                            Configure desconto para pagamentos em dinheiro e PIX
                                        </p>
                                    </div>
                                    
                                    <div>
                                        <Label htmlFor="discount_type">Tipo de Desconto</Label>
                                        <Select
                                            value={formData.discount_type || 'none'}
                                            onValueChange={(value) => {
                                                if (value === 'none') {
                                                    setFormData({ 
                                                        ...formData, 
                                                        discount_type: null, 
                                                        discount_value: null,
                                                        discount_applies_to: null
                                                    })
                                                } else {
                                                    setFormData({ 
                                                        ...formData, 
                                                        discount_type: value as "fixed" | "percentage",
                                                        discount_value: formData.discount_value || null
                                                    })
                                                }
                                            }}
                                        >
                                            <SelectTrigger id="discount_type">
                                                <SelectValue placeholder="Selecione o tipo" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">Sem desconto</SelectItem>
                                                <SelectItem value="fixed">Valor fixo (R$)</SelectItem>
                                                <SelectItem value="percentage">Percentual (%)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {formData.discount_type && (
                                        <>
                                            <div>
                                                <Label htmlFor="discount_value">
                                                    {formData.discount_type === 'fixed' ? 'Valor do Desconto (R$)' : 'Percentual do Desconto (%)'}
                                                </Label>
                                                <Input
                                                    id="discount_value"
                                                    type="number"
                                                    step={formData.discount_type === 'fixed' ? "0.01" : "0.1"}
                                                    min="0"
                                                    max={formData.discount_type === 'percentage' ? "100" : undefined}
                                                    value={formData.discount_value || ''}
                                                    onChange={(e) => setFormData({ 
                                                        ...formData, 
                                                        discount_value: e.target.value ? parseFloat(e.target.value) : null 
                                                    })}
                                                    placeholder={formData.discount_type === 'fixed' ? "0.00" : "0"}
                                                />
                                            </div>

                                            <div>
                                                <Label>Aplicar desconto para:</Label>
                                                <div className="space-y-2 mt-2">
                                                    <div className="flex items-center space-x-2">
                                                        <input
                                                            type="checkbox"
                                                            id="discount_cash"
                                                            checked={formData.discount_applies_to?.includes('Cash') || false}
                                                            onChange={(e) => {
                                                                const current = formData.discount_applies_to || []
                                                                if (e.target.checked) {
                                                                    setFormData({ 
                                                                        ...formData, 
                                                                        discount_applies_to: [...current, 'Cash']
                                                                    })
                                                                } else {
                                                                    setFormData({ 
                                                                        ...formData, 
                                                                        discount_applies_to: current.filter(m => m !== 'Cash')
                                                                    })
                                                                }
                                                            }}
                                                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                        />
                                                        <Label htmlFor="discount_cash" className="cursor-pointer">
                                                            Dinheiro (Cash)
                                                        </Label>
                                                    </div>
                                                    <div className="flex items-center space-x-2">
                                                        <input
                                                            type="checkbox"
                                                            id="discount_pix"
                                                            checked={formData.discount_applies_to?.includes('PIX') || false}
                                                            onChange={(e) => {
                                                                const current = formData.discount_applies_to || []
                                                                if (e.target.checked) {
                                                                    setFormData({ 
                                                                        ...formData, 
                                                                        discount_applies_to: [...current, 'PIX']
                                                                    })
                                                                } else {
                                                                    setFormData({ 
                                                                        ...formData, 
                                                                        discount_applies_to: current.filter(m => m !== 'PIX')
                                                                    })
                                                                }
                                                            }}
                                                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                        />
                                                        <Label htmlFor="discount_pix" className="cursor-pointer">
                                                            PIX
                                                        </Label>
                                                    </div>
                                                </div>
                                                {formData.discount_type && formData.discount_value && formData.discount_applies_to && formData.discount_applies_to.length > 0 && (
                                                    <p className="text-xs text-muted-foreground mt-2">
                                                        {formData.discount_type === 'fixed' 
                                                            ? `Desconto de ${formatCurrency(formData.discount_value)} aplicado em pagamentos via ${formData.discount_applies_to.join(' e ')}`
                                                            : `Desconto de ${formData.discount_value}% aplicado em pagamentos via ${formData.discount_applies_to.join(' e ')}`
                                                        }
                                                    </p>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </>
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
                    <Button type="submit" disabled={isSubmitting || isUploadingImage}>
                        <Save className="w-4 h-4 mr-2" />
                        {isSubmitting ? 'Salvando...' : isUploadingImage ? 'Aguarde o upload...' : 'Salvar Produto'}
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

