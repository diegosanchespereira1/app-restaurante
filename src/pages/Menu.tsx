import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "../components/ui/button"
import { Card, CardContent } from "../components/ui/card"
import { Plus, Minus, ShoppingCart, Pencil, Trash2, Snowflake } from "lucide-react"
import { useRestaurant, type MenuItem } from "../context/RestaurantContext"
import { useLanguage } from "../context/LanguageContext"
import { useAuth } from "../context/AuthContext"
import { formatCurrency } from "../lib/utils"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "../components/ui/dialog"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { supabase, isSupabaseConfigured } from "../lib/supabase"
import type { PromotionWithItems } from "../types/promotion"
import { PromotionCarousel } from "../components/promotions/PromotionCarousel"
import { MobileOrderSummaryCompact } from "../components/orders/MobileOrderSummaryCompact"

export function Menu() {
    const navigate = useNavigate()
    const { menuItems, isLoading: isMenuLoading, error: menuError, categories, addCategory, updateCategory, deleteCategory, addOrder, generateOrderId, tables } = useRestaurant()
    const { t } = useLanguage()
    const { user } = useAuth()
    const [selectedItems, setSelectedItems] = useState<{ id: number; quantity: number }[]>([])
    const [customerName, setCustomerName] = useState("")
    const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [newCategoryName, setNewCategoryName] = useState("")
    const [editingCategory, setEditingCategory] = useState<{ id: number, name: string } | null>(null)
    const [selectedCategory, setSelectedCategory] = useState<string>("all")
    const [promotions, setPromotions] = useState<PromotionWithItems[]>([])
    const [orderType, setOrderType] = useState<"dine_in" | "takeout" | "delivery">("takeout")
    const [selectedTable, setSelectedTable] = useState("")
    const [orderDiscountType, setOrderDiscountType] = useState<"fixed" | "percentage" | null>(null)
    const [orderDiscountValue, setOrderDiscountValue] = useState<number | null>(null)
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const lastDraftRef = useRef<any>(null)

    const LOCAL_DRAFT_KEY = "new-order-draft"
    const remoteDraftId = user?.id ? `draft-${user.id}` : null

    const applyDraft = (parsed: any) => {
        if (parsed?.selectedItems) setSelectedItems(parsed.selectedItems)
        if (parsed?.customerName) setCustomerName(parsed.customerName)
        if (parsed?.selectedCategory) setSelectedCategory(parsed.selectedCategory)
    }

    const loadLocalDraft = () => {
        try {
            const raw = localStorage.getItem(LOCAL_DRAFT_KEY)
            if (!raw) return null
            const parsed = JSON.parse(raw)
            applyDraft(parsed)
            lastDraftRef.current = parsed
            return parsed
        } catch (error) {
            console.error("Erro ao carregar rascunho local:", error)
            return null
        }
    }

    const saveLocalDraft = (draft: any) => {
        try {
            localStorage.setItem(LOCAL_DRAFT_KEY, JSON.stringify(draft))
        } catch (error) {
            console.error("Erro ao salvar rascunho local:", error)
        }
    }

    const clearLocalDraft = () => {
        try {
            localStorage.removeItem(LOCAL_DRAFT_KEY)
        } catch (error) {
            console.error("Erro ao limpar rascunho local:", error)
        }
    }

    const loadRemoteDraft = async () => {
        if (!isSupabaseConfigured || !remoteDraftId) return null
        try {
            const { data, error } = await supabase
                .from('app_settings')
                .select('settings')
                .eq('id', remoteDraftId)
                .single()
            if (error && error.code !== 'PGRST116') {
                console.error("Erro ao buscar rascunho remoto:", error)
                return null
            }
            if (data?.settings) {
                applyDraft(data.settings)
                lastDraftRef.current = data.settings
                return data.settings
            }
            return null
        } catch (err) {
            console.error("Erro ao carregar rascunho remoto:", err)
            return null
        }
    }

    const saveRemoteDraft = async (draft: any) => {
        if (!isSupabaseConfigured || !remoteDraftId) return
        try {
            const { error } = await supabase
                .from('app_settings')
                .upsert({
                    id: remoteDraftId,
                    settings: draft,
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'id'
                })
            if (error) {
                console.error("Erro ao salvar rascunho remoto:", error)
            }
        } catch (err) {
            console.error("Erro ao salvar rascunho remoto:", err)
        }
    }

    const clearRemoteDraft = async () => {
        if (!isSupabaseConfigured || !remoteDraftId) return
        try {
            const { error } = await supabase
                .from('app_settings')
                .delete()
                .eq('id', remoteDraftId)
            if (error) {
                console.error("Erro ao limpar rascunho remoto:", error)
            }
        } catch (err) {
            console.error("Erro ao limpar rascunho remoto:", err)
        }
    }

    const clearDraft = async () => {
        clearLocalDraft()
        await clearRemoteDraft()
        lastDraftRef.current = null
    }

    // Carregar rascunho ao montar ou ao trocar usuário
    useEffect(() => {
        const load = async () => {
            const remote = await loadRemoteDraft()
            if (!remote) {
                loadLocalDraft()
            }
        }
        load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [remoteDraftId])

    // Persistir rascunho (debounce 300ms)
    useEffect(() => {
        const draftBase = lastDraftRef.current || {}
        const draft = {
            ...draftBase,
            selectedItems,
            customerName,
            selectedCategory,
            timestamp: Date.now()
        }
        lastDraftRef.current = draft

        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current)
        }
        saveTimeoutRef.current = setTimeout(() => {
            if (isSupabaseConfigured && remoteDraftId) {
                saveRemoteDraft(draft)
            } else {
                saveLocalDraft(draft)
            }
        }, 300)

        return () => {
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
        }
    }, [selectedItems, customerName, selectedCategory, remoteDraftId])

    // Buscar promoções habilitadas
    useEffect(() => {
        const fetchPromotions = async () => {
            if (!isSupabaseConfigured) return
            
            try {
                const { data: promotionsData, error } = await supabase
                    .from('promotions')
                    .select('*')
                    .eq('enabled', true)
                    .order('created_at', { ascending: false })
                
                if (error) throw error
                
                if (promotionsData) {
                    // Buscar itens de cada promoção
                    const promotionsWithItems: PromotionWithItems[] = await Promise.all(
                        promotionsData.map(async (promotion) => {
                            if (promotion.type === 'kit') {
                                const { data: itemsData } = await supabase
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
                                
                                const items = (itemsData || []).map((item: any) => ({
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
                            }
                            
                            return { ...promotion, items: [] } as PromotionWithItems
                        })
                    )
                    
                    setPromotions(promotionsWithItems)
                }
            } catch (err) {
                console.error('Error fetching promotions:', err)
            }
        }
        
        fetchPromotions()
    }, [])

    const handleAddCategory = async () => {
        if (!newCategoryName.trim()) return
        const result = await addCategory(newCategoryName)
        if (result.success) {
            setNewCategoryName("")
        } else {
            alert("Failed to add category: " + result.error)
        }
    }

    const handleUpdateCategory = async () => {
        if (!editingCategory || !editingCategory.name.trim()) return
        const result = await updateCategory(editingCategory.id, editingCategory.name)
        if (result.success) {
            setEditingCategory(null)
        } else {
            alert("Failed to update category: " + result.error)
        }
    }

    const handleDeleteCategory = async (id: number) => {
        if (confirm("Are you sure? This will not delete items in this category, but they may become uncategorized.")) {
            const result = await deleteCategory(id)
            if (!result.success) {
                alert("Failed to delete category: " + result.error)
            }
        }
    }

    // Usar menuItems diretamente (já são produtos com price)
    const availableItems = menuItems.filter(item => item.price > 0 && item.status === "Available")

    // Filtrar itens por categoria selecionada
    const getFilteredItems = () => {
        if (selectedCategory === "all") {
            return availableItems
        }
        return availableItems.filter(item => 
            item.category?.toLowerCase().includes(selectedCategory.toLowerCase())
        )
    }

    const filteredItems = getFilteredItems()

    // Agrupar produtos por categoria para exibição
    const itemsByCategory = filteredItems.reduce((acc, item) => {
        const category = item.category || 'Sem categoria'
        if (!acc[category]) {
            acc[category] = []
        }
        acc[category].push(item)
        return acc
    }, {} as Record<string, MenuItem[]>)

    // Funções para gerenciar quantidade no pedido
    const handleAddToOrder = (itemId: number) => {
        setSelectedItems(prev => {
            const existing = prev.find(i => i.id === itemId)
            if (existing) {
                return prev.map(i => i.id === itemId ? { ...i, quantity: i.quantity + 1 } : i)
            }
            return [...prev, { id: itemId, quantity: 1 }]
        })
    }

    const handleRemoveFromOrder = (itemId: number) => {
        setSelectedItems(prev => {
            const existing = prev.find(i => i.id === itemId)
            if (existing && existing.quantity > 1) {
                return prev.map(i => i.id === itemId ? { ...i, quantity: i.quantity - 1 } : i)
            }
            return prev.filter(i => i.id !== itemId)
        })
    }

    const getItemQuantity = (itemId: number) => {
        const item = selectedItems.find(i => i.id === itemId)
        return item?.quantity || 0
    }

    const calculateTotal = () => {
        return selectedItems.reduce((sum, item) => {
            const menuItem = menuItems.find(m => m.id === item.id)
            return sum + (menuItem?.price || 0) * item.quantity
        }, 0)
    }

    const handleCreateOrder = async () => {
        const now = new Date()
        const day = String(now.getDate()).padStart(2, '0')
        const month = String(now.getMonth() + 1).padStart(2, '0')
        const year = now.getFullYear()
        const hours = String(now.getHours()).padStart(2, '0')
        const minutes = String(now.getMinutes()).padStart(2, '0')
        const formattedDate = `${day}/${month}/${year} ${hours}:${minutes}`

        setIsLoading(true)
        try {
            const orderId = await generateOrderId()

            // Processar itens diretamente (não precisa mais criar menu items dinamicamente)
            const processedItems = selectedItems.map((item) => {
                const menuItem = menuItems.find(m => m.id === item.id)!
                
                return {
                    id: menuItem.id,
                    name: menuItem.name,
                    price: menuItem.price,
                    quantity: item.quantity
                }
            })

            const newOrder = {
                id: orderId,
                table: undefined,
                orderType: "takeout" as const,
                customer: customerName.trim() || t("guest"),
                status: "Pending" as const,
                items: processedItems,
                total: calculateTotal(),
                time: formattedDate
            }

            const result = await addOrder(newOrder)
            if (result.success) {
                setCustomerName("")
                setSelectedItems([])
                await clearDraft()
                navigate("/orders")
            }
        } catch (err: any) {
            console.error(err)
        } finally {
            setIsLoading(false)
        }
    }

    // Ocultar menu inferior quando houver itens selecionados
    useEffect(() => {
        if (selectedItems.length > 0) {
            document.body.classList.add('hide-mobile-nav')
        } else {
            document.body.classList.remove('hide-mobile-nav')
        }
        return () => {
            document.body.classList.remove('hide-mobile-nav')
        }
    }, [selectedItems.length])

    // Handler para quando clicar em uma promoção no carrossel
    const handlePromotionClick = (promotion: PromotionWithItems) => {
        // Adicionar promoção ao carrinho ou navegar para detalhes
        // Por enquanto, apenas adiciona ao carrinho se for um produto simples
        if (promotion.type === 'product' && promotion.price) {
            const existingItem = selectedItems.find(item => item.id === promotion.id)
            if (existingItem) {
                setSelectedItems(selectedItems.map(item => 
                    item.id === promotion.id 
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                ))
            } else {
                // Se for produto novo, precisaria criar um item temporário
                // Por enquanto, apenas mostra um alerta
                alert(`Promoção: ${promotion.name}`)
            }
        } else {
            // Para kits, mostra os produtos incluídos
            alert(`Kit: ${promotion.name}\nProdutos incluídos: ${promotion.items?.map(i => i.product?.name).join(', ') || 'N/A'}`)
        }
    }

    // Calcular total de um item
    const getItemTotal = (productId: number, price: number) => {
        const quantity = getItemQuantity(productId)
        return quantity * price
    }

    const calculateSubtotal = () => calculateTotal()

    // Extrair categorias únicas para filtros
    const categoryNames = categories.map(c => c.name)

    if (isMenuLoading) {
        return <div className="flex justify-center items-center h-64">Carregando bebidas...</div>
    }

    if (menuError) {
        return <div className="text-destructive text-center p-8">Erro ao carregar: {menuError}</div>
    }

    return (
        <div className="max-w-7xl mx-auto space-y-8" style={{ paddingBottom: selectedItems.length > 0 ? '120px' : '0' }}>
            {/* Header Section */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">{t("menu")}</h1>
                    <p className="text-gray-500 mt-1 text-sm">Gerencie os itens de bebidas.</p>
                </div>
                <div className="flex gap-3">
                    <Dialog open={isCategoryManagerOpen} onOpenChange={setIsCategoryManagerOpen}>
                        <DialogTrigger asChild>
                            <button className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                                Manage Categories
                            </button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Manage Categories</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="New Category Name"
                                        value={newCategoryName}
                                        onChange={(e) => setNewCategoryName(e.target.value)}
                                    />
                                    <Button onClick={handleAddCategory}>Add</Button>
                                </div>
                                <div className="space-y-2">
                                    {categories.map(category => (
                                        <div key={category.id} className="flex items-center justify-between p-2 border rounded-md">
                                            {editingCategory?.id === category.id ? (
                                                <div className="flex gap-2 flex-1 mr-2">
                                                    <Input
                                                        value={editingCategory.name}
                                                        onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                                                    />
                                                    <Button size="sm" onClick={handleUpdateCategory}>Save</Button>
                                                    <Button size="sm" variant="ghost" onClick={() => setEditingCategory(null)}>Cancel</Button>
                                                </div>
                                            ) : (
                                                <>
                                                    <span>{category.name}</span>
                                                    <div className="flex gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => setEditingCategory(category)}
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="text-destructive hover:text-destructive"
                                                            onClick={() => handleDeleteCategory(category.id)}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                    <button 
                        onClick={() => navigate('/products/new')}
                        className="px-4 py-2 bg-blue-600 rounded-lg text-sm font-medium text-white hover:bg-blue-700 transition-colors flex items-center gap-2"
                    >
                        <span>+</span>
                        <span>Adicionar Item</span>
                    </button>
                </div>
            </header>
            
            {/* Hero Carousel Section */}
            {promotions.length > 0 && (
                <PromotionCarousel 
                    promotions={promotions} 
                    onPromotionClick={handlePromotionClick}
                />
            )}
            
            {/* Filter Categories */}
            {categoryNames.length > 0 && (
                <nav aria-label="Category Filters" className="flex flex-wrap gap-3">
                    <button
                        onClick={() => setSelectedCategory("all")}
                        className={`px-5 py-2 rounded-lg border font-medium text-sm transition-colors ${
                            selectedCategory === "all"
                                ? "bg-gray-200 text-gray-800 border-transparent"
                                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                        }`}
                    >
                        Todos
                    </button>
                    {categoryNames.map((categoryName) => (
                        <button
                            key={categoryName}
                            onClick={() => setSelectedCategory(categoryName)}
                            className={`px-5 py-2 rounded-lg border font-medium text-sm transition-colors ${
                                selectedCategory === categoryName
                                    ? "bg-gray-200 text-gray-800 border-transparent"
                                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                            }`}
                        >
                            {categoryName}
                        </button>
                    ))}
                </nav>
            )}
            
            {/* Product List Section */}
            <main>
                {Object.keys(itemsByCategory).length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                        <p>Nenhum produto encontrado. Clique em "Adicionar Item" para criar um novo.</p>
                    </div>
                )}

                {Object.entries(itemsByCategory).map(([categoryName, items]) => (
                    <div key={categoryName} className="mb-8">
                        {/* Section Title */}
                        <div className="flex items-center gap-3 mb-6">
                            <h2 className="text-xl font-bold text-gray-900">{categoryName}</h2>
                            <span className="bg-gray-100 text-gray-600 rounded-full px-2 py-0.5 text-xs font-medium">
                                {items.length} items
                            </span>
                        </div>
                        
                        {/* Grid Layout */}
                        <div className="grid grid-cols-2 xs:grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 justify-items-center">
                            {items.map((item) => {
                                const quantity = getItemQuantity(item.id)
                                const total = getItemTotal(item.id, item.price)
                                const isAvailable = item.status === "Available"
                                
                                return (
                                    <article
                                        key={item.id}
                                        className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col hover:shadow-md transition-shadow w-full max-w-[169px] sm:max-w-[169px]"
                                        style={{ minHeight: '380px' }}
                                    >
                                        {/* Image Area */}
                                        <div className="relative bg-orange-50/30 flex items-center justify-center aspect-square w-full" style={{ paddingTop: '0px', paddingBottom: '0px', marginTop: '7px', marginBottom: '7px' }}>
                                            {item.is_cold && (
                                                <div className="absolute top-3 left-3 bg-blue-100 text-blue-700 rounded-full p-1.5 shadow-sm">
                                                    <Snowflake className="h-4 w-4" />
                                                </div>
                                            )}
                                            {isAvailable && (
                                                <span className="absolute top-3 right-3 bg-green-100 text-green-700 text-xs font-semibold px-2 py-1 rounded" style={{ left: '90px', paddingLeft: '5px', paddingRight: '5px', width: '80px', marginLeft: '0px', marginRight: '0px' }}>
                                                    Disponível
                                                </span>
                                            )}
                                            {item.image ? (
                                                <img
                                                    alt={item.name}
                                                    className="object-cover"
                                                    src={item.image}
                                                    style={{ marginTop: '7px', marginBottom: '7px', height: '120px' }}
                                                    onError={(e) => {
                                                        e.currentTarget.src = "materialApoio/imagem-nao-disponivel.gif"
                                                    }}
                                                />
                                            ) : (
                                                <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                                                    <span className="text-gray-400 text-sm">Sem imagem</span>
                                                </div>
                                            )}
                                        </div>
                                        
                                        {/* Content Area */}
                                        <div className="p-4 flex-1 flex flex-col">
                                            <h3 className="text-base font-semibold text-gray-900" style={{ fontSize: '14px', minHeight: '36px', lineHeight: '18px', marginBottom: '4px' }}>{item.name}</h3>
                                            <p className="text-sm text-gray-400 mt-1" style={{ marginTop: '4px', marginBottom: '8px', minHeight: '36px', lineHeight: '18px', height: '18px' }}>
                                                {item.description || "Sem descrição"}
                                            </p>
                                            
                                            <div className="mt-auto" style={{ paddingTop: '5px', marginTop: 'auto' }}>
                                                <p className="text-sm font-bold text-gray-900 mb-3" style={{ marginBottom: '10px' }}>
                                                    {formatCurrency(item.price)}
                                                </p>
                                                <div className="flex justify-center items-center">
                                                    <div className="flex justify-center items-center border border-gray-200 rounded-lg bg-gray-50 flex-shrink-0 overflow-hidden" style={{ width: '115px', height: '35px', marginTop: '5px', marginBottom: '5px', textAlign: 'center', justifyContent: 'center' }}>
                                                        <button
                                                            onClick={() => handleRemoveFromOrder(item.id)}
                                                            disabled={quantity === 0}
                                                            className="px-1 text-gray-400 hover:text-gray-600 disabled:cursor-not-allowed flex-shrink-0 flex items-center justify-center"
                                                            style={{ minWidth: '24px', paddingLeft: '6px', paddingRight: '6px' }}
                                                        >
                                                            <Minus className="h-3 w-3" />
                                                        </button>
                                                        <span className={`text-sm flex-1 text-center min-w-0 ${
                                                            quantity > 0
                                                                ? 'text-gray-800 font-medium'
                                                                : 'hidden'
                                                        }`} style={{ lineHeight: '35px' }}>
                                                            {quantity}
                                                        </span>
                                                        <input
                                                            className={`flex-1 text-center bg-transparent border-none p-0 text-xs text-gray-500 focus:ring-0 min-w-0 ${
                                                                quantity > 0 ? 'hidden' : ''
                                                            }`}
                                                            readOnly
                                                            type="number"
                                                            value={quantity}
                                                            style={{ WebkitAppearance: 'none', MozAppearance: 'textfield', lineHeight: '35px' }}
                                                        />
                                                        <button
                                                            onClick={() => handleAddToOrder(item.id)}
                                                            className="px-1 text-gray-400 hover:text-gray-600 flex-shrink-0 flex items-center justify-center"
                                                            style={{ minWidth: '24px', paddingLeft: '6px', paddingRight: '6px' }}
                                                        >
                                                            <Plus className="h-3 w-3" />
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="mt-2">
                                                    <p className="text-xs text-gray-500 leading-tight" style={{ marginTop: '0px', marginBottom: '0px' }}>
                                                        TOTAL:
                                                    </p>
                                                    <p className="text-sm sm:text-base font-bold text-gray-900 leading-tight">
                                                        {quantity > 0 ? formatCurrency(total) : '-'}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </article>
                                )
                            })}
                        </div>
                    </div>
                ))}
            </main>

            {/* Resumo do Pedido - usa o mesmo componente mobile do Novo Pedido */}
            <MobileOrderSummaryCompact
                selectedItems={selectedItems.map(item => ({ id: item.id.toString(), quantity: item.quantity }))}
                menuItems={menuItems}
                orderType={orderType}
                selectedTable={selectedTable}
                customerName={customerName}
                isTablesEnabled={false}
                tables={tables}
                handleAddItem={(id) => handleAddToOrder(parseInt(id))}
                handleRemoveItem={(id) => handleRemoveFromOrder(parseInt(id))}
                setOrderType={setOrderType}
                setSelectedTable={setSelectedTable}
                setCustomerName={setCustomerName}
                handleCreateOrder={handleCreateOrder}
                calculateTotal={calculateTotal}
                orderDiscountType={orderDiscountType}
                orderDiscountValue={orderDiscountValue}
                setOrderDiscountType={setOrderDiscountType}
                setOrderDiscountValue={setOrderDiscountValue}
                calculateSubtotal={calculateSubtotal}
            />

        </div>
    )
}