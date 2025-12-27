import { useState } from "react"
import { Button } from "../components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Plus, Minus, Search, ShoppingBag, ArrowLeft } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { useRestaurant } from "../context/RestaurantContext"
import { useStock } from "../context/StockContext"
import { useLanguage } from "../context/LanguageContext"
import { useSettings } from "../context/SettingsContext"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select"
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group"

import { formatCurrency } from "../lib/utils"
import { MobileOrderSummaryCompact } from "../components/orders/MobileOrderSummaryCompact"

// Tipo unificado para itens que podem aparecer no pedido
interface UnifiedItem {
    id: string // "menu-{id}" ou "stock-{id}"
    name: string
    price: number
    category: string | null
    description?: string
    image?: string
    type: 'menu' | 'stock'
    originalId: number
}

export function NewOrder() {
    const navigate = useNavigate()
    const { menuItems, tables, addOrder, generateOrderId } = useRestaurant()
    const { inventoryItems } = useStock()
    const { t } = useLanguage()
    const { isTablesEnabled } = useSettings()

    const [selectedItems, setSelectedItems] = useState<{ id: string; quantity: number }[]>([])
    const [selectedTable, setSelectedTable] = useState("")
    const [orderType, setOrderType] = useState<"dine_in" | "takeout" | "delivery">(isTablesEnabled ? "dine_in" : "takeout")
    const [customerName, setCustomerName] = useState("")
    const [searchQuery, setSearchQuery] = useState("")
    const [selectedCategory, setSelectedCategory] = useState<string>("all")

    // Combinar itens do menu e do estoque
    const unifiedItems: UnifiedItem[] = [
        // Itens do menu
        ...menuItems.map(item => ({
            id: `menu-${item.id}`,
            name: item.name,
            price: item.price,
            category: item.category,
            description: item.description,
            image: item.image,
            type: 'menu' as const,
            originalId: item.id
        })),
        // Itens de estoque (todos os itens, mas apenas mostrar os que têm preço ou estão vinculados)
        ...inventoryItems
            .filter(item => {
                // Incluir se tem preço de venda OU está vinculado a um item do menu OU tem categoria
                return item.selling_price || item.menu_item_id || item.category
            })
            .map(item => {
                // Se está vinculado a um item do menu, usar os dados do menu
                const menuItem = item.menu_item_id ? menuItems.find(m => m.id === item.menu_item_id) : null
                // Se tem menu item vinculado, usar o preço do menu; senão usar o selling_price; senão 0
                const finalPrice = menuItem?.price || item.selling_price || 0
                
                return {
                    id: `stock-${item.id}`,
                    name: item.name,
                    price: finalPrice,
                    category: item.category || menuItem?.category || null,
                    description: menuItem?.description || undefined,
                    image: item.image || menuItem?.image || "materialApoio/imagem-nao-disponivel.gif",
                    type: 'stock' as const,
                    originalId: item.id
                }
            })
            // Filtrar itens sem preço válido (preço > 0)
            .filter(item => item.price > 0)
    ]

    // Extrair categorias únicas de todos os itens
    const allCategories = Array.from(new Set(
        unifiedItems
            .map(item => item.category)
            .filter((cat): cat is string => cat !== null && cat !== undefined)
    ))
    const categories = ["all", ...allCategories]

    const filteredItems = unifiedItems.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase())
        const matchesCategory = selectedCategory === "all" || item.category === selectedCategory
        return matchesSearch && matchesCategory
    })

    const handleAddItem = (itemId: string) => {
        setSelectedItems(prev => {
            const existing = prev.find(i => i.id === itemId)
            if (existing) {
                return prev.map(i => i.id === itemId ? { ...i, quantity: i.quantity + 1 } : i)
            }
            return [...prev, { id: itemId, quantity: 1 }]
        })
    }

    const handleRemoveItem = (itemId: string) => {
        setSelectedItems(prev => {
            const existing = prev.find(i => i.id === itemId)
            if (existing && existing.quantity > 1) {
                return prev.map(i => i.id === itemId ? { ...i, quantity: i.quantity - 1 } : i)
            }
            return prev.filter(i => i.id !== itemId)
        })
    }

    const calculateTotal = () => {
        return selectedItems.reduce((sum, item) => {
            const unifiedItem = unifiedItems.find(i => i.id === item.id)
            return sum + (unifiedItem?.price || 0) * item.quantity
        }, 0)
    }

    const handleCreateOrder = async () => {
        if (orderType === "dine_in" && isTablesEnabled && !selectedTable) return
        if (selectedItems.length === 0) return

        const now = new Date()
        const day = String(now.getDate()).padStart(2, '0')
        const month = String(now.getMonth() + 1).padStart(2, '0')
        const year = now.getFullYear()
        const hours = String(now.getHours()).padStart(2, '0')
        const minutes = String(now.getMinutes()).padStart(2, '0')
        const formattedDate = `${day}/${month}/${year} ${hours}:${minutes}`

        const orderId = await generateOrderId()

        const newOrder = {
            id: orderId,
            table: orderType === "dine_in" && isTablesEnabled ? selectedTable : undefined,
            orderType,
            customer: customerName || t("guest"),
            status: "Pending" as const,
            items: selectedItems.map(item => {
                const unifiedItem = unifiedItems.find(i => i.id === item.id)!
                // Para itens de estoque, usar o ID do menu item vinculado se existir, senão null
                // Para itens do menu, usar o ID do menu item
                let menuItemId: number | null = null
                
                if (unifiedItem.type === 'stock') {
                    // Item de estoque: usar menu_item_id se existir, senão null
                    const inventoryItem = inventoryItems.find(inv => inv.id === unifiedItem.originalId)
                    menuItemId = inventoryItem?.menu_item_id || null
                } else {
                    // Item do menu: usar o ID diretamente
                    menuItemId = unifiedItem.originalId
                }
                
                return {
                    id: menuItemId ?? 0, // Usar 0 como fallback para compatibilidade com OrderItem interface
                    name: unifiedItem.name,
                    price: unifiedItem.price,
                    quantity: item.quantity
                }
            }),
            total: calculateTotal(),
            time: formattedDate
        }

        try {
            const result = await addOrder(newOrder)
            if (result.success) {
                navigate("/orders")
            } else {
                alert(`Failed to create order: ${result.error}`)
            }
        } catch (error) {
            alert("An unexpected error occurred while creating the order.")
        }
    }

    return (
        <div className="relative">
            {/* Mobile Header */}
            <div className="md:hidden sticky top-0 bg-background/80 backdrop-blur-sm z-10 px-4 py-3 border-b border-border">
                <div className="flex items-center justify-center">
                    <Button variant="ghost" size="icon" className="absolute left-0" onClick={() => navigate(-1)}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <h1 className="text-xl font-bold">{t("newOrder")}</h1>
                </div>
            </div>
            <div className="flex flex-col md:flex-row gap-6">
                {/* Left Side - Menu Selection */}
                <div className="flex-1 flex flex-col gap-6 overflow-hidden">
                    <div className="flex items-center justify-between shrink-0">
                        <div>
                            <h2 className="text-3xl font-bold tracking-tight">{t("newOrder")}</h2>
                            <p className="text-muted-foreground">{t("selectItems")}</p>
                        </div>
                        <div className="flex gap-2">
                            <div className="relative w-64">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder={t("searchPlaceholder")}
                                    className="pl-8"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-2 overflow-x-auto pb-2 shrink-0">
                        {categories.map(category => (
                            <Button
                                key={category}
                                variant={selectedCategory === category ? "default" : "outline"}
                                onClick={() => setSelectedCategory(category)}
                                className="capitalize whitespace-nowrap"
                            >
                                {category}
                            </Button>
                        ))}
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 overflow-y-auto pr-2 pb-24 md:pb-2">
                        {filteredItems.length === 0 ? (
                            <div className="col-span-full text-center py-8 text-muted-foreground">
                                <p>{t("noItemsFound") || "Nenhum item encontrado"}</p>
                            </div>
                        ) : (
                            filteredItems.map((item) => (
                                <Card
                                    key={item.id}
                                    className="cursor-pointer hover:border-primary transition-colors flex flex-col"
                                    onClick={() => handleAddItem(item.id)}
                                >
                                    <div className="h-32 w-full relative shrink-0 bg-muted">
                                        {item.image ? (
                                            <img
                                                src={item.image}
                                                alt={item.name}
                                                className="object-cover w-full h-full rounded-t-lg"
                                                onError={(e) => {
                                                    // Fallback para imagem padrão se houver erro
                                                    e.currentTarget.src = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=60"
                                                }}
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-muted rounded-t-lg">
                                                <ShoppingBag className="h-12 w-12 text-muted-foreground" />
                                            </div>
                                        )}
                                        {item.type === 'stock' && (
                                            <div className="absolute top-2 right-2">
                                                <span className="bg-primary text-primary-foreground text-xs px-2 py-1 rounded">
                                                    Estoque
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-3 flex flex-col flex-1">
                                        <div className="flex justify-between items-start mb-2">
                                            <h3 className="font-semibold line-clamp-1">{item.name}</h3>
                                        </div>
                                        {item.description && (
                                            <p className="text-sm text-muted-foreground line-clamp-2 mb-4 flex-1">
                                                {item.description}
                                            </p>
                                        )}
                                        {item.category && (
                                            <p className="text-xs text-muted-foreground mb-2">
                                                {item.category}
                                            </p>
                                        )}
                                        <div className="mt-auto pt-2 border-t space-y-2">
                                            <div className="flex justify-center">
                                                <span className="font-bold text-base">{formatCurrency(item.price)}</span>
                                            </div>
                                            <Button size="sm" variant="secondary" className="w-full">
                                                <Plus className="h-4 w-4 mr-1" /> {t("addItem")}
                                            </Button>
                                        </div>
                                    </div>
                                </Card>
                            ))
                        )}
                    </div>
                </div>

                {/* Right Side - Order Summary (Desktop only) */}
                <div className="hidden md:flex w-full md:w-[320px] lg:w-[400px] flex-col gap-6 shrink-0">
                    <Card className="flex-1 flex flex-col overflow-hidden">
                        <CardHeader className="shrink-0">
                            <CardTitle>{t("orderSummary")}</CardTitle>
                        </CardHeader>
                        <CardContent className="flex-1 flex flex-col overflow-hidden">
                            <div className="space-y-4 mb-6 shrink-0">
                                <div className="space-y-2">
                                    <Label>{t("orderType")}</Label>
                                    <RadioGroup defaultValue={isTablesEnabled ? "dine_in" : "takeout"} value={orderType} onValueChange={(v) => setOrderType(v as any)} className="flex gap-4">
                                        {isTablesEnabled && (
                                            <div className="flex items-center space-x-2">
                                                <RadioGroupItem value="dine_in" id="dine_in" />
                                                <Label htmlFor="dine_in">{t("dineIn")}</Label>
                                            </div>
                                        )}
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="takeout" id="takeout" />
                                            <Label htmlFor="takeout">{t("takeout")}</Label>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="delivery" id="delivery" />
                                            <Label htmlFor="delivery">{t("delivery")}</Label>
                                        </div>
                                    </RadioGroup>
                                </div>

                                {orderType === "dine_in" && isTablesEnabled && (
                                    <div className="space-y-2">
                                        <Label>{t("table")}</Label>
                                        <Select value={selectedTable} onValueChange={setSelectedTable}>
                                            <SelectTrigger>
                                                <SelectValue placeholder={t("selectTable")} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {tables.map((table) => (
                                                    <SelectItem key={table.id} value={table.number}>
                                                        {table.number} {table.status === "Occupied" && `(${t("occupiedAbbr")})`}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                                <div className="space-y-2">
                                    <Label>{t("customer")}</Label>
                                    <Input
                                        placeholder={t("customerNamePlaceholder")}
                                        value={customerName}
                                        onChange={(e) => setCustomerName(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto -mx-4 px-4">
                                {selectedItems.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-2">
                                        <ShoppingBag className="h-8 w-8" />
                                        <p>{t("noItemsSelected")}</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {selectedItems.map((item) => {
                                            const unifiedItem = unifiedItems.find(i => i.id === item.id)
                                            return (
                                                <div key={item.id} className="flex items-center justify-between gap-4">
                                                    <div className="flex-1">
                                                        <p className="font-medium">{unifiedItem?.name}</p>
                                                        <div className="text-sm text-muted-foreground">
                                                            {formatCurrency(unifiedItem?.price || 0)}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            className="h-8 w-8"
                                                            onClick={() => handleRemoveItem(item.id)}
                                                        >
                                                            <Minus className="h-3 w-3" />
                                                        </Button>
                                                        <span className="w-4 text-center">{item.quantity}</span>
                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            className="h-8 w-8"
                                                            onClick={() => handleAddItem(item.id)}
                                                        >
                                                            <Plus className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                    <div className="font-medium w-16 text-right">
                                                        {formatCurrency((unifiedItem?.price || 0) * item.quantity)}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>

                            <div className="pt-6 mt-6 border-t shrink-0">
                                <div className="flex justify-between items-center mb-6">
                                    <span className="text-lg font-semibold">{t("total")}</span>
                                    <span className="text-2xl font-bold">{formatCurrency(calculateTotal())}</span>
                                </div>
                                <Button className="w-full" size="lg" onClick={handleCreateOrder} disabled={(orderType === "dine_in" && isTablesEnabled && !selectedTable) || selectedItems.length === 0}>
                                    {t("createOrder")}
                                </Button>
                                {((orderType === "dine_in" && isTablesEnabled && !selectedTable) || selectedItems.length === 0) && (
                                    <p className="text-sm text-center text-muted-foreground mt-2">
                                        {orderType === "dine_in" && isTablesEnabled && !selectedTable
                                            ? t("selectATable")
                                            : selectedItems.length === 0
                                                ? t("addItemsToOrder")
                                                : ""}
                                    </p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Mobile Order Summary Compact */}
            <MobileOrderSummaryCompact
                selectedItems={selectedItems}
                unifiedItems={unifiedItems}
                orderType={orderType}
                selectedTable={selectedTable}
                customerName={customerName}
                isTablesEnabled={isTablesEnabled}
                tables={tables}
                handleAddItem={handleAddItem}
                handleRemoveItem={handleRemoveItem}
                setOrderType={setOrderType}
                setSelectedTable={setSelectedTable}
                setCustomerName={setCustomerName}
                handleCreateOrder={handleCreateOrder}
                calculateTotal={calculateTotal}
            />
        </div>
    )
}
