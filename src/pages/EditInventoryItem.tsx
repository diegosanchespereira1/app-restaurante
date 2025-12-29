import { useState, useEffect, useRef } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useStock } from "../context/StockContext"
import { useRestaurant } from "../context/RestaurantContext"
import { useLanguage } from "../context/LanguageContext"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select"
import { Textarea } from "../components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../components/ui/dialog"
import { ArrowLeft, Save, Plus, Upload, Loader2 } from "lucide-react"
import { formatCurrency } from "../lib/utils"
import { supabase, isSupabaseConfigured } from "../lib/supabase"

const DEFAULT_IMAGE = 'materialApoio/imagem-nao-disponivel.gif'

export function EditInventoryItem() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const { updateInventoryItem, isLoading: isStockLoading, getInventoryItemById } = useStock()
    const { menuItems, categories, isLoading: isRestaurantLoading, addCategory } = useRestaurant()
    const { t } = useLanguage()
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)
    const [isAddCategoryDialogOpen, setIsAddCategoryDialogOpen] = useState(false)
    const [newCategoryName, setNewCategoryName] = useState("")
    const [isAddingCategory, setIsAddingCategory] = useState(false)
    const [categoryError, setCategoryError] = useState<string | null>(null)
    const [isUploadingImage, setIsUploadingImage] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0) // Progresso do upload (0-100)
    const [uploadError, setUploadError] = useState<string | null>(null)
    const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
    const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null) // Preview local (blob URL)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const isInitialLoad = useRef(true) // Flag para rastrear se já inicializamos o preview

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
        description: null as string | null,
        status: null as "Available" | "Sold Out" | null,
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
            const itemImage = currentItem.image || DEFAULT_IMAGE
            
            setFormData(prev => {
                // Preservar a imagem atual se já tivermos uma válida (não padrão)
                // Isso evita perder o preview quando salvamos e o item é recarregado
                const imageToUse = prev.image && prev.image !== DEFAULT_IMAGE 
                    ? prev.image 
                    : itemImage
                
                return {
                    menu_item_id: currentItem.menu_item_id,
                    name: currentItem.name,
                    unit: currentItem.unit,
                    min_stock: currentItem.min_stock,
                    current_stock: currentItem.current_stock,
                    cost_price: currentItem.cost_price,
                    selling_price: currentItem.selling_price,
                    category: currentItem.category || '',
                    image: imageToUse, // Preservar imagem atual se existir
                    description: currentItem.description || null,
                    status: currentItem.status || null,
                    product_type: currentItem.product_type || '',
                    ncm: currentItem.ncm || '',
                    cst_icms: currentItem.cst_icms || '',
                    cfop: currentItem.cfop || '',
                    icms_rate: currentItem.icms_rate,
                    ipi_rate: currentItem.ipi_rate,
                    ean_code: currentItem.ean_code || ''
                }
            })
            
            // Atualizar preview apenas na primeira vez (quando ainda não inicializamos)
            // Não resetar o preview depois da primeira inicialização
            // Isso preserva o preview durante edições e após salvar
            if (isInitialLoad.current) {
                if (itemImage && itemImage !== DEFAULT_IMAGE) {
                    setImagePreviewUrl(itemImage)
                }
                isInitialLoad.current = false
            }
        }
    }, [currentItem]) // Executar apenas quando currentItem mudar

    // Limpar object URL quando componente desmontar
    useEffect(() => {
        return () => {
            if (localPreviewUrl) {
                URL.revokeObjectURL(localPreviewUrl)
            }
        }
    }, [localPreviewUrl])

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

        // Verificar se o usuário está autenticado (necessário para upload)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            setUploadError('Você precisa estar logado para fazer upload de imagens.')
            return
        }

        // Criar preview imediato usando URL.createObjectURL (mais confiável)
        const previewUrl = URL.createObjectURL(file)
        setLocalPreviewUrl(previewUrl) // Preview local que persiste até upload completo

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
            // filePath deve ser apenas o nome do arquivo, sem o prefixo do bucket
            // pois o bucket já é especificado no .from('product-images')
            const filePath = fileName

            // Simular progresso durante o upload
            // Como o Supabase não fornece callback de progresso, vamos simular incrementos
            // Iniciar simulação de progresso durante upload (30-70%)
            let simulatedProgress = 30
            progressInterval = setInterval(() => {
                simulatedProgress += 5
                if (simulatedProgress <= 70) {
                    setUploadProgress(simulatedProgress)
                } else {
                    // Parar em 70% e aguardar o upload real terminar
                    if (progressInterval) {
                        clearInterval(progressInterval)
                        progressInterval = null
                    }
                }
            }, 150) // Incrementa a cada 150ms para progresso mais rápido

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

            // Progresso: upload concluído (70%)
            setUploadProgress(70)

            if (error) {
                // Parar a simulação de progresso
                if (progressInterval) {
                    clearInterval(progressInterval)
                    progressInterval = null
                }
                
                // Tratar diferentes tipos de erro
                if (error.message.includes('Bucket not found')) {
                    setUploadError('Bucket de imagens não encontrado. Por favor, crie um bucket chamado "product-images" no Supabase Storage.')
                } else if (error.message.includes('row-level security policy') || error.message.includes('RLS')) {
                    setUploadError('Erro de política de segurança. Execute o script setup_storage_policies.sql no SQL Editor do Supabase para configurar as políticas do bucket.')
                } else {
                    setUploadError(`Erro ao fazer upload: ${error.message}`)
                }
                // Limpar preview em caso de erro
                if (previewUrl) {
                    URL.revokeObjectURL(previewUrl)
                }
                setLocalPreviewUrl(null)
                setUploadProgress(0)
                setIsUploadingImage(false)
                return
            }

            // Progresso: obtendo URL (70-85%)
            setUploadProgress(75)

            // Sempre construir URL manualmente (mais confiável)
            // getPublicUrl pode não funcionar corretamente em alguns casos
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
            let finalImageUrl: string | null = null
            
            if (supabaseUrl) {
                // filePath agora é apenas o fileName, então construir URL corretamente
                finalImageUrl = `${supabaseUrl}/storage/v1/object/public/product-images/${filePath}`
            } else {
                // Fallback: tentar usar getPublicUrl
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
                // Progresso: processando (85-95%)
                setUploadProgress(90)
                
                // Atualizar preview com a URL do Supabase primeiro
                setImagePreviewUrl(finalImageUrl)
                
                // Atualizar formData com a URL do Supabase
                // Isso garante que a URL esteja salva no formData para quando salvarmos
                setFormData(prev => ({ ...prev, image: finalImageUrl }))
                
                setUploadProgress(95)
                
                // Limpar preview local
                if (previewUrl) {
                    URL.revokeObjectURL(previewUrl)
                }
                setLocalPreviewUrl(null)
                
                // Progresso completo
                setUploadProgress(100)
                setUploadError(null)
                setIsUploadingImage(false) // Resetar imediatamente
                
                // Resetar progresso após um breve delay para mostrar 100%
                setTimeout(() => {
                    setUploadProgress(0)
                }, 800)
            } else {
                setUploadError('Erro ao obter URL da imagem. Verifique se o bucket está público e as políticas RLS estão configuradas.')
                // Limpar preview em caso de erro
                if (previewUrl) {
                    URL.revokeObjectURL(previewUrl)
                }
                setLocalPreviewUrl(null)
                setUploadProgress(0)
                setIsUploadingImage(false)
            }
        } catch (err: any) {
            // Parar a simulação de progresso
            if (progressInterval) {
                clearInterval(progressInterval)
                progressInterval = null
            }
            
            setUploadError(err.message || 'Erro ao fazer upload da imagem')
            // Limpar preview se houver erro
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl)
            }
            setLocalPreviewUrl(null)
            setUploadProgress(0)
        } finally {
            // Garantir que o interval seja limpo mesmo se houver algum problema
            if (progressInterval) {
                clearInterval(progressInterval)
                progressInterval = null
            }
            // Limpar o input para permitir selecionar o mesmo arquivo novamente
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

        // Não permitir salvar enquanto estiver fazendo upload de imagem
        if (isUploadingImage) {
            setError('Aguarde o upload da imagem terminar antes de salvar')
            return
        }

        setIsSubmitting(true)
        try {
            // Priorizar imagePreviewUrl se existir (imagem recém-uploadada)
            // Senão, usar formData.image se não for vazio/nulo ou DEFAULT_IMAGE
            // IMPORTANTE: Se formData.image for DEFAULT_IMAGE, ainda assim usar ele (pode ser que o usuário queira a imagem padrão)
            // Mas se tivermos imagePreviewUrl (URL do Supabase), sempre priorizar
            const imageToSave = imagePreviewUrl || formData.image || DEFAULT_IMAGE
            
            const result = await updateInventoryItem(itemId, {
                menu_item_id: formData.menu_item_id,
                name: formData.name,
                unit: formData.unit,
                min_stock: formData.min_stock,
                current_stock: formData.current_stock,
                cost_price: formData.cost_price,
                selling_price: formData.selling_price,
                category: formData.category || null,
                image: imageToSave,
                description: formData.description || null,
                status: formData.status || null,
                product_type: formData.product_type || null,
                ncm: formData.ncm || null,
                cst_icms: formData.cst_icms || null,
                cfop: formData.cfop || null,
                icms_rate: formData.icms_rate,
                ipi_rate: formData.ipi_rate,
                ean_code: formData.ean_code || null
            })

            if (result.success) {
                // Garantir que o preview seja mantido com a imagem atual
                // Usar imagePreviewUrl se existir, senão usar formData.image
                const finalImage = imagePreviewUrl || (formData.image && formData.image !== DEFAULT_IMAGE ? formData.image : null)
                if (finalImage) {
                    setImagePreviewUrl(finalImage)
                }
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
                            <Label htmlFor="menu_item">Vincular a Item de Bebidas (Opcional)</Label>
                            <Select
                                value={formData.menu_item_id?.toString() || 'none'}
                                onValueChange={handleMenuItemSelect}
                            >
                                <SelectTrigger id="menu_item">
                                    <SelectValue placeholder="Selecione um item de bebidas ou deixe em branco" />
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

                        <div>
                            <Label htmlFor="name">Nome do Produto *</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                required
                                placeholder="Ex: Arroz, Feijão, Óleo..."
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
                            <Label htmlFor="selling_price">Preço de Venda</Label>
                            <Input
                                id="selling_price"
                                type="number"
                                step="0.01"
                                min="0"
                                value={formData.selling_price || ''}
                                onChange={(e) => setFormData({ ...formData, selling_price: e.target.value ? parseFloat(e.target.value) : null })}
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

                        {formData.selling_price && (
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
                                value={formData.unit ?? ''}
                                onValueChange={(value: string) => setFormData({ ...formData, unit: value })}
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
                    <Button type="submit" disabled={isSubmitting || isStockLoading || isUploadingImage}>
                        <Save className="w-4 h-4 mr-2" />
                        {isSubmitting ? 'Salvando...' : isUploadingImage ? 'Aguarde o upload...' : 'Salvar Alterações'}
                    </Button>
                </div>
            </form>
        </div>
    )
}



