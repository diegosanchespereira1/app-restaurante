import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "../components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Badge } from "../components/ui/badge"
import { Plus, Pencil, Trash2, Minus, ShoppingCart } from "lucide-react"
import { useRestaurant, type MenuItem } from "../context/RestaurantContext"
import { useLanguage } from "../context/LanguageContext"
import { formatCurrency } from "../lib/utils"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "../components/ui/dialog"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select"

export function Menu() {
    const navigate = useNavigate()
    const { menuItems, addMenuItem, updateMenuItem, deleteMenuItem, isLoading: isMenuLoading, error: menuError, categories, addCategory, updateCategory, deleteCategory, addOrder, generateOrderId } = useRestaurant()
    const { t } = useLanguage()
    const [selectedItems, setSelectedItems] = useState<{ id: number; quantity: number }[]>([])
    const [isCreateOrderDialogOpen, setIsCreateOrderDialogOpen] = useState(false)
    const [customerName, setCustomerName] = useState("")
    const [showSuccessMessage, setShowSuccessMessage] = useState(false)
    const [isAddOpen, setIsAddOpen] = useState(false)
    const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState("")
    const [newCategoryName, setNewCategoryName] = useState("")
    const [editingCategory, setEditingCategory] = useState<{ id: number, name: string } | null>(null)
    const [newItem, setNewItem] = useState({
        name: "",
        description: "",
        price: "",
        category: "",
        image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=60"
    })
    // Edit Item Logic
    const [isEditOpen, setIsEditOpen] = useState(false)
    const [editingItem, setEditingItem] = useState<MenuItem | null>(null)

    // Set default category when categories load
    if (!newItem.category && categories.length > 0) {
        setNewItem(prev => ({ ...prev, category: categories[0].name }))
    }

    const handleAddItem = async () => {
        setError("")
        const price = parseFloat(newItem.price)

        if (!newItem.name || !newItem.price || isNaN(price) || !newItem.category) {
            setError(t("fillAllFields"))
            return
        }

        setIsLoading(true)
        try {
            const result = await addMenuItem({
                name: newItem.name,
                description: newItem.description,
                price: price,
                category: newItem.category,
                status: "Available",
                image: newItem.image
            })

            if (result.success) {
                setNewItem({
                    name: "",
                    description: "",
                    price: "",
                    category: categories[0]?.name || "",
                    image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=60"
                })
                setIsAddOpen(false)
            } else {
                setError(result.error || "Failed to save item. Please try again.")
            }
        } catch (err) {
            setError("An unexpected error occurred.")
            console.error(err)
        } finally {
            setIsLoading(false)
        }
    }

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


    const handleUpdateItem = async () => {
        if (!editingItem) return
        setError("")
        setIsLoading(true)

        try {
            const result = await updateMenuItem(editingItem.id, {
                name: editingItem.name,
                description: editingItem.description,
                price: editingItem.price,
                category: editingItem.category,
                image: editingItem.image
            })

            if (result.success) {
                setIsEditOpen(false)
                setEditingItem(null)
            } else {
                setError(result.error || "Failed to update item")
            }
        } catch (err) {
            console.error(err)
            setError("An unexpected error occurred")
        } finally {
            setIsLoading(false)
        }
    }

    const handleDeleteItem = async (item: MenuItem) => {
        if (confirm(`Tem certeza que deseja excluir "${item.name}"?`)) {
            setIsLoading(true)
            try {
                const result = await deleteMenuItem(item.id)
                if (!result.success) {
                    setError(result.error || "Erro ao excluir item")
                }
            } catch (err) {
                console.error(err)
                setError("Erro ao excluir item")
            } finally {
                setIsLoading(false)
            }
        }
    }

    const handleEditClick = (item: MenuItem) => {
        setEditingItem(item)
        setIsEditOpen(true)
    }

    // Usar menuItems diretamente (já são produtos com price)
    const availableItems = menuItems.filter(item => item.price > 0 && item.status === "Available")

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

    const handleCreateOrderClick = () => {
        if (selectedItems.length === 0) {
            setError("Adicione pelo menos um item ao pedido")
            return
        }
        setIsCreateOrderDialogOpen(true)
    }

    const handleCreateOrder = async () => {
        if (!customerName.trim()) {
            setError("Por favor, informe o nome do cliente")
            return
        }

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
                setIsCreateOrderDialogOpen(false)
                setShowSuccessMessage(true)
                setCustomerName("")
                setSelectedItems([])
                
                // Redirecionar após 2 segundos
                setTimeout(() => {
                    setShowSuccessMessage(false)
                    navigate("/orders")
                }, 2000)
            } else {
                setError(result.error || "Erro ao criar pedido")
            }
        } catch (err: any) {
            setError(err.message || "Erro ao criar pedido")
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

    // Group items by category
    const itemsByCategory = availableItems.reduce((acc, item) => {
        const category = item.category || 'Sem categoria'
        if (!acc[category]) {
            acc[category] = []
        }
        acc[category].push(item)
        return acc
    }, {} as Record<string, MenuItem[]>)

    if (isMenuLoading) {
        return <div className="flex justify-center items-center h-64">Carregando bebidas...</div>
    }

    if (menuError) {
        return <div className="text-destructive text-center p-8">Erro ao carregar: {menuError}</div>
    }

    return (
        <div className="space-y-8 w-full max-w-full overflow-x-hidden" style={{ paddingBottom: selectedItems.length > 0 ? '120px' : '0' }}>
            <div className="flex items-center justify-between gap-4 w-full min-w-0">
                <div className="min-w-0 flex-1">
                    <h2 className="text-3xl font-bold tracking-tight truncate">{t("menu")}</h2>
                    <p className="text-muted-foreground truncate">{t("manageMenu")}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                    <Dialog open={isCategoryManagerOpen} onOpenChange={setIsCategoryManagerOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline">
                                Manage Categories
                            </Button>
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

                    <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="mr-2 h-4 w-4" /> {t("addItem")}
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>{t("addItem")}</DialogTitle>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                {error && (
                                    <div className="bg-destructive/15 text-destructive text-sm p-3 rounded-md">
                                        {error}
                                    </div>
                                )}
                                <div className="grid gap-2">
                                    <Label>{t("itemName")}</Label>
                                    <Input
                                        value={newItem.name}
                                        onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label>{t("itemDescription")}</Label>
                                    <Input
                                        value={newItem.description}
                                        onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label>{t("itemPrice")}</Label>
                                    <Input
                                        type="number"
                                        value={newItem.price}
                                        onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label>{t("itemCategory")}</Label>
                                    <Select
                                        value={newItem.category}
                                        onValueChange={(value) => setNewItem({ ...newItem, category: value })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a category" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {categories.map(category => (
                                                <SelectItem key={category.id} value={category.name}>
                                                    {category.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid gap-2">
                                    <Label>{t("itemImage")}</Label>
                                    <Input
                                        value={newItem.image}
                                        onChange={(e) => setNewItem({ ...newItem, image: e.target.value })}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button onClick={handleAddItem} disabled={isLoading}>
                                    {isLoading ? "Saving..." : t("save")}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {Object.keys(itemsByCategory).length === 0 && (
                <div className="text-center text-muted-foreground p-8">
                    Nenhuma bebida encontrada. Clique em "Adicionar Item" para criar uma nova.
                </div>
            )}

            {/* Iterate over categories to preserve order and show empty ones if desired, 
                but for now let's stick to showing categories that have items, 
                OR we can iterate over 'categories' state to show all sections even if empty.
                Let's iterate over 'categories' state to be consistent with the manager.
            */}
            {categories.map((category) => {
                const items = itemsByCategory[category.name] || []
                if (items.length === 0) return null // Optional: remove this line to show empty categories

                return (
                    <div key={category.id} className="space-y-3 md:space-y-4 w-full">
                        <h3 className="text-lg md:text-xl font-semibold capitalize truncate">{category.name}</h3>
                        <div className="grid grid-cols-3 gap-2 md:gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 w-full">
                            {items.map((item) => (
                                <Card key={item.id} className="overflow-hidden flex flex-col w-full min-w-0">
                                    <div className="aspect-square md:aspect-video relative w-full overflow-hidden">
                                        <img
                                            src={item.image || "materialApoio/imagem-nao-disponivel.gif"}
                                            alt={item.name}
                                            className="object-cover w-full h-full"
                                            onError={(e) => {
                                                e.currentTarget.src = "materialApoio/imagem-nao-disponivel.gif"
                                            }}
                                        />
                                    </div>
                                    <CardHeader className="p-2 md:p-6 min-w-0">
                                        <CardTitle className="flex flex-col md:flex-row md:justify-between md:items-start gap-1 min-w-0">
                                            <span className="text-xs md:text-base font-semibold line-clamp-2 break-words min-w-0">{item.name}</span>
                                            <Badge variant={item.status === "Available" ? "success" : "destructive"} className="text-[10px] md:text-xs w-fit shrink-0">
                                                {t(item.status?.toLowerCase() as any) || item.status || "Disponível"}
                                            </Badge>
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-2 md:p-6 pt-0 flex-1 flex flex-col min-w-0">
                                        <p className="text-[10px] md:text-sm text-muted-foreground mb-2 md:mb-4 line-clamp-2 hidden md:block break-words">
                                            {item.description || "Sem descrição"}
                                        </p>
                                        <div className="space-y-2 md:space-y-3 mt-auto w-full min-w-0">
                                            <div className="flex items-center justify-between gap-2 min-w-0">
                                                <div className="text-base md:text-2xl font-bold truncate">{formatCurrency(item.price)}</div>
                                                <div className="flex gap-1 shrink-0">
                                                        <Button 
                                                            variant="outline" 
                                                            size="sm" 
                                                            onClick={() => handleEditClick(item)}
                                                            className="h-9 w-9 md:h-8 md:w-8 p-0 touch-manipulation shrink-0"
                                                        >
                                                            <Pencil className="h-3.5 w-3.5 md:h-3 md:w-3" />
                                                        </Button>
                                                        <Button 
                                                            variant="ghost" 
                                                            size="sm"
                                                            className="h-9 w-9 md:h-8 md:w-8 p-0 text-destructive hover:text-destructive touch-manipulation shrink-0"
                                                            onClick={() => handleDeleteItem(item)}
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5 md:h-3 md:w-3" />
                                                        </Button>
                                                    </div>
                                            </div>
                                            
                                            {/* Controles de quantidade */}
                                            <div className="flex items-center justify-between gap-1 md:gap-2 min-w-0">
                                                <div className="flex items-center gap-1 md:gap-2 flex-1 min-w-0">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-10 w-10 md:h-8 md:w-8 p-0 touch-manipulation shrink-0"
                                                        onClick={() => handleRemoveFromOrder(item.id)}
                                                        disabled={getItemQuantity(item.id) === 0}
                                                    >
                                                        <Minus className="h-4 w-4 md:h-4 md:w-4" />
                                                    </Button>
                                                    <span className="text-sm md:text-sm font-medium min-w-[1.5rem] md:min-w-[2rem] text-center shrink-0">
                                                        {getItemQuantity(item.id) || 0}
                                                    </span>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-10 w-10 md:h-8 md:w-8 p-0 touch-manipulation shrink-0"
                                                        onClick={() => handleAddToOrder(item.id)}
                                                    >
                                                        <Plus className="h-4 w-4 md:h-4 md:w-4" />
                                                    </Button>
                                                </div>
                                                {getItemQuantity(item.id) > 0 && (
                                                    <span className="text-xs md:text-sm font-semibold text-primary truncate shrink-0">
                                                        {formatCurrency(item.price * getItemQuantity(item.id))}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                )
            })}

            {/* Fallback for items with categories not in the list (e.g. deleted categories) */}
            {Object.entries(itemsByCategory).map(([catName, items]) => {
                if (categories.some(c => c.name === catName)) return null; // Already handled
                return (
                    <div key={catName} className="space-y-3 md:space-y-4 w-full">
                        <h3 className="text-lg md:text-xl font-semibold capitalize truncate">{catName} (Uncategorized)</h3>
                        <div className="grid grid-cols-3 gap-2 md:gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 w-full">
                            {items.map(item => (
                                <Card key={item.id} className="overflow-hidden flex flex-col w-full min-w-0">
                                    <div className="aspect-square md:aspect-video relative w-full overflow-hidden">
                                        <img
                                            src={item.image || "materialApoio/imagem-nao-disponivel.gif"}
                                            alt={item.name}
                                            className="object-cover w-full h-full"
                                            onError={(e) => {
                                                e.currentTarget.src = "materialApoio/imagem-nao-disponivel.gif"
                                            }}
                                        />
                                    </div>
                                    <CardHeader className="p-2 md:p-6 min-w-0">
                                        <CardTitle className="flex flex-col md:flex-row md:justify-between md:items-start gap-1 min-w-0">
                                            <span className="text-xs md:text-base font-semibold line-clamp-2 break-words min-w-0">{item.name}</span>
                                            <Badge variant={item.status === "Available" ? "success" : "destructive"} className="text-[10px] md:text-xs w-fit shrink-0">
                                                {t(item.status?.toLowerCase() as any) || item.status || "Disponível"}
                                            </Badge>
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-2 md:p-6 pt-0 flex-1 flex flex-col min-w-0">
                                        <p className="text-[10px] md:text-sm text-muted-foreground mb-2 md:mb-4 line-clamp-2 hidden md:block break-words">
                                            {item.description || "Sem descrição"}
                                        </p>
                                        <div className="space-y-2 md:space-y-3 mt-auto w-full min-w-0">
                                            <div className="flex items-center justify-between gap-2 min-w-0">
                                                <div className="text-base md:text-2xl font-bold truncate">{formatCurrency(item.price)}</div>
                                                <div className="flex gap-1 shrink-0">
                                                        <Button 
                                                            variant="outline" 
                                                            size="sm" 
                                                            onClick={() => handleEditClick(item)}
                                                            className="h-9 w-9 md:h-8 md:w-8 p-0 touch-manipulation shrink-0"
                                                        >
                                                            <Pencil className="h-3.5 w-3.5 md:h-3 md:w-3" />
                                                        </Button>
                                                        <Button 
                                                            variant="ghost" 
                                                            size="sm"
                                                            className="h-9 w-9 md:h-8 md:w-8 p-0 text-destructive hover:text-destructive touch-manipulation shrink-0"
                                                            onClick={() => handleDeleteItem(item)}
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5 md:h-3 md:w-3" />
                                                        </Button>
                                                    </div>
                                            </div>
                                            
                                            {/* Controles de quantidade */}
                                            <div className="flex items-center justify-between gap-1 md:gap-2 min-w-0">
                                                <div className="flex items-center gap-1 md:gap-2 flex-1 min-w-0">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-10 w-10 md:h-8 md:w-8 p-0 touch-manipulation shrink-0"
                                                        onClick={() => handleRemoveFromOrder(item.id)}
                                                        disabled={getItemQuantity(item.id) === 0}
                                                    >
                                                        <Minus className="h-4 w-4 md:h-4 md:w-4" />
                                                    </Button>
                                                    <span className="text-sm md:text-sm font-medium min-w-[1.5rem] md:min-w-[2rem] text-center shrink-0">
                                                        {getItemQuantity(item.id) || 0}
                                                    </span>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-10 w-10 md:h-8 md:w-8 p-0 touch-manipulation shrink-0"
                                                        onClick={() => handleAddToOrder(item.id)}
                                                    >
                                                        <Plus className="h-4 w-4 md:h-4 md:w-4" />
                                                    </Button>
                                                </div>
                                                {getItemQuantity(item.id) > 0 && (
                                                    <span className="text-xs md:text-sm font-semibold text-primary truncate shrink-0">
                                                        {formatCurrency(item.price * getItemQuantity(item.id))}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                )
            })}
            {/* Resumo do Pedido - Fixo na parte inferior */}
            {selectedItems.length > 0 && (
                <div className="fixed bottom-0 left-0 right-0 lg:left-64 bg-card border-t shadow-lg z-50 p-3 md:p-4 print:hidden overflow-hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
                    <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 md:gap-4 w-full min-w-0">
                        <div className="flex flex-col md:flex-row items-center gap-2 md:gap-4 w-full md:w-auto min-w-0">
                            <div className="flex items-center gap-2 min-w-0">
                                <ShoppingCart className="h-4 w-4 md:h-5 md:w-5 text-primary shrink-0" />
                                <span className="text-sm md:text-base font-semibold truncate">
                                    {selectedItems.reduce((sum, item) => sum + item.quantity, 0)} {selectedItems.reduce((sum, item) => sum + item.quantity, 0) === 1 ? 'item' : 'itens'}
                                </span>
                            </div>
                            <div className="text-base md:text-lg font-bold text-primary truncate">
                                Total: {formatCurrency(calculateTotal())}
                            </div>
                        </div>
                        <div className="flex gap-2 w-full md:w-auto shrink-0">
                            <Button
                                variant="outline"
                                onClick={() => setSelectedItems([])}
                                disabled={isLoading}
                                className="flex-1 md:flex-none h-11 md:h-10 touch-manipulation min-w-0"
                            >
                                Limpar
                            </Button>
                            <Button
                                onClick={handleCreateOrderClick}
                                disabled={isLoading || selectedItems.length === 0}
                                className="min-w-[140px] md:min-w-[150px] flex-1 md:flex-none h-11 md:h-10 touch-manipulation"
                            >
                                <ShoppingCart className="mr-2 h-4 w-4 shrink-0" />
                                <span className="truncate">Criar Pedido</span>
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Dialog para criar pedido - solicitar nome do cliente */}
            <Dialog open={isCreateOrderDialogOpen} onOpenChange={setIsCreateOrderDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Criar Pedido</DialogTitle>
                        <DialogDescription>
                            Informe o nome do cliente para finalizar o pedido
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        {error && (
                            <div className="bg-destructive/15 text-destructive text-sm p-3 rounded-md">
                                {error}
                            </div>
                        )}
                        <div className="grid gap-2">
                            <Label htmlFor="customer-name">Nome do Cliente *</Label>
                            <Input
                                id="customer-name"
                                value={customerName}
                                onChange={(e) => {
                                    setCustomerName(e.target.value)
                                    setError("")
                                }}
                                placeholder="Digite o nome do cliente"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && customerName.trim()) {
                                        handleCreateOrder()
                                    }
                                }}
                                autoFocus
                            />
                        </div>
                        <div className="bg-muted p-3 rounded-md overflow-hidden">
                            <div className="text-sm font-semibold mb-2">Resumo do Pedido:</div>
                            <div className="space-y-1 text-sm min-w-0">
                                {selectedItems.map(item => {
                                    const menuItem = menuItems.find(m => m.id === item.id)!
                                    return (
                                        <div key={item.id} className="flex justify-between gap-2 min-w-0">
                                            <span className="truncate min-w-0">{menuItem.name} x {item.quantity}</span>
                                            <span className="shrink-0">{formatCurrency(menuItem.price * item.quantity)}</span>
                                        </div>
                                    )
                                })}
                                <div className="flex justify-between font-bold pt-2 border-t mt-2 gap-2 min-w-0">
                                    <span className="shrink-0">Total:</span>
                                    <span className="shrink-0">{formatCurrency(calculateTotal())}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setIsCreateOrderDialogOpen(false)
                                setCustomerName("")
                                setError("")
                            }}
                            disabled={isLoading}
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleCreateOrder}
                            disabled={isLoading || !customerName.trim()}
                        >
                            {isLoading ? "Criando pedido..." : "Confirmar Pedido"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Mensagem de sucesso */}
            {showSuccessMessage && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <Card className="max-w-md mx-4">
                        <CardContent className="p-6 text-center">
                            <div className="mb-4">
                                <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                            </div>
                            <h3 className="text-xl font-bold mb-2">Pedido Criado com Sucesso!</h3>
                            <p className="text-muted-foreground">Redirecionando para a página de pedidos...</p>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Edit Item Dialog */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Item</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        {error && (
                            <div className="bg-destructive/15 text-destructive text-sm p-3 rounded-md">
                                {error}
                            </div>
                        )}
                        <div className="grid gap-2">
                            <Label>{t("itemName")}</Label>
                            <Input
                                value={editingItem?.name || ""}
                                onChange={(e) => setEditingItem(prev => prev ? { ...prev, name: e.target.value } : null)}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>{t("itemDescription")}</Label>
                            <Input
                                value={editingItem?.description || ""}
                                onChange={(e) => setEditingItem(prev => prev ? { ...prev, description: e.target.value } : null)}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>{t("itemPrice")}</Label>
                            <Input
                                type="number"
                                value={editingItem?.price || ""}
                                onChange={(e) => setEditingItem(prev => prev ? { ...prev, price: parseFloat(e.target.value) } : null)}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>{t("itemCategory")}</Label>
                            <Select
                                value={editingItem?.category || ""}
                                onValueChange={(value) => setEditingItem(prev => prev ? { ...prev, category: value } : null)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a category" />
                                </SelectTrigger>
                                <SelectContent>
                                    {categories.map(category => (
                                        <SelectItem key={category.id} value={category.name}>
                                            {category.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label>{t("itemImage")}</Label>
                            <Input
                                value={editingItem?.image || ""}
                                onChange={(e) => setEditingItem(prev => prev ? { ...prev, image: e.target.value } : null)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleUpdateItem} disabled={isLoading}>
                            {isLoading ? "Saving..." : t("save")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
