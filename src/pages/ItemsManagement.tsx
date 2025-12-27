import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useRestaurant, type MenuItem } from "../context/RestaurantContext"
import { useStock } from "../context/StockContext"
import { useLanguage } from "../context/LanguageContext"
import { Button } from "../components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card"
import { Badge } from "../components/ui/badge"
import { Input } from "../components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs"
import { ArrowLeft, Pencil, Trash2, Search, Package, UtensilsCrossed } from "lucide-react"
import { formatCurrency } from "../lib/utils"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select"

const DEFAULT_IMAGE = 'materialApoio/imagem-nao-disponivel.gif'

export function ItemsManagement() {
    const navigate = useNavigate()
    const { t } = useLanguage()
    const { menuItems, deleteMenuItem, isLoading: isMenuLoading } = useRestaurant()
    const { inventoryItems, isLoading: isStockLoading } = useStock()
    
    const [searchTerm, setSearchTerm] = useState("")
    const [selectedMenuCategory, setSelectedMenuCategory] = useState<string | null>(null)
    const [selectedStockCategory, setSelectedStockCategory] = useState<string | null>(null)
    const [deleteMenuDialogOpen, setDeleteMenuDialogOpen] = useState(false)
    const [menuItemToDelete, setMenuItemToDelete] = useState<MenuItem | null>(null)

    // Filtrar menu items
    const filteredMenuItems = menuItems.filter(item => {
        const matchesSearch = !searchTerm || 
            item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.description?.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesCategory = !selectedMenuCategory || item.category === selectedMenuCategory
        return matchesSearch && matchesCategory
    })

    // Filtrar inventory items
    const filteredInventoryItems = inventoryItems.filter(item => {
        const matchesSearch = !searchTerm || 
            item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.category?.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesCategory = !selectedStockCategory || item.category === selectedStockCategory
        return matchesSearch && matchesCategory
    })

    // Obter categorias únicas (filtrar null/undefined e garantir que são strings)
    const menuCategories = Array.from(new Set(menuItems.map(item => item.category).filter((cat): cat is string => Boolean(cat))))
    const stockCategories = Array.from(new Set(inventoryItems.map(item => item.category).filter((cat): cat is string => Boolean(cat))))

    const handleDeleteMenuItem = async () => {
        if (!menuItemToDelete) return
        
        const result = await deleteMenuItem(menuItemToDelete.id)
        if (result.success) {
            setDeleteMenuDialogOpen(false)
            setMenuItemToDelete(null)
        } else {
            alert(`Erro ao deletar item: ${result.error}`)
        }
    }

    if (isMenuLoading || isStockLoading) {
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
        <div className="space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => navigate('/settings')}
                >
                    <ArrowLeft className="w-5 h-5" />
                </Button>
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">
                        Gestão de Itens Cadastrados
                    </h2>
                    <p className="text-muted-foreground">
                        Gerencie itens do menu e do estoque
                    </p>
                </div>
            </div>

            {/* Filtros */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                                <Input
                                    placeholder="Buscar por nome ou descrição..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Tabs para Menu e Estoque */}
            <Tabs defaultValue="menu" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="menu" className="flex items-center gap-2">
                        <UtensilsCrossed className="w-4 h-4" />
                        Itens do Menu ({filteredMenuItems.length})
                    </TabsTrigger>
                    <TabsTrigger value="stock" className="flex items-center gap-2">
                        <Package className="w-4 h-4" />
                        Itens do Estoque ({filteredInventoryItems.length})
                    </TabsTrigger>
                </TabsList>

                {/* Tab Menu Items */}
                <TabsContent value="menu" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Itens do Menu</CardTitle>
                                    <CardDescription>
                                        Gerencie os itens disponíveis no cardápio
                                    </CardDescription>
                                </div>
                                <Select
                                    value={selectedMenuCategory || "all"}
                                    onValueChange={(value) => setSelectedMenuCategory(value === "all" ? null : value)}
                                >
                                    <SelectTrigger className="w-[200px]">
                                        <SelectValue placeholder="Todas as categorias" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todas as categorias</SelectItem>
                                        {menuCategories.map((cat) => (
                                            <SelectItem key={cat} value={cat}>
                                                {cat}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {filteredMenuItems.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    Nenhum item encontrado
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {filteredMenuItems.map((item) => (
                                        <Card key={item.id} className="overflow-hidden">
                                            <div className="aspect-video bg-muted relative">
                                                <img
                                                    src={item.image || DEFAULT_IMAGE}
                                                    alt={item.name}
                                                    className="w-full h-full object-cover"
                                                    onError={(e) => {
                                                        e.currentTarget.src = DEFAULT_IMAGE
                                                    }}
                                                />
                                            </div>
                                            <CardContent className="p-4">
                                                <div className="flex items-start justify-between mb-2">
                                                    <div className="flex-1 min-w-0">
                                                        <h3 className="font-semibold text-lg truncate">{item.name}</h3>
                                                        <p className="text-sm text-muted-foreground line-clamp-2">
                                                            {item.description}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center justify-between mb-3">
                                                    <Badge variant="outline">{item.category}</Badge>
                                                    <span className="font-bold text-lg">
                                                        {formatCurrency(item.price)}
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <Badge variant={item.status === "Available" ? "default" : "secondary"}>
                                                        {item.status === "Available" ? "Disponível" : "Indisponível"}
                                                    </Badge>
                                                    <div className="flex gap-2">
                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            onClick={() => navigate('/menu')}
                                                            title="Editar (redireciona para página de Menu)"
                                                        >
                                                            <Pencil className="w-4 h-4" />
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            onClick={() => {
                                                                setMenuItemToDelete(item)
                                                                setDeleteMenuDialogOpen(true)
                                                            }}
                                                            title="Excluir"
                                                            className="text-destructive hover:text-destructive"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Tab Inventory Items */}
                <TabsContent value="stock" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Itens do Estoque</CardTitle>
                                    <CardDescription>
                                        Gerencie os produtos cadastrados no estoque
                                    </CardDescription>
                                </div>
                                <Select
                                    value={selectedStockCategory || "all"}
                                    onValueChange={(value) => setSelectedStockCategory(value === "all" ? null : value)}
                                >
                                    <SelectTrigger className="w-[200px]">
                                        <SelectValue placeholder="Todas as categorias" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todas as categorias</SelectItem>
                                        {stockCategories.map((cat) => (
                                            <SelectItem key={cat || 'undefined'} value={cat || ''}>
                                                {cat || 'Sem categoria'}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {filteredInventoryItems.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    Nenhum item encontrado
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {filteredInventoryItems.map((item) => (
                                        <Card key={item.id} className="overflow-hidden">
                                            <div className="aspect-video bg-muted relative">
                                                <img
                                                    src={item.image || DEFAULT_IMAGE}
                                                    alt={item.name}
                                                    className="w-full h-full object-cover"
                                                    onError={(e) => {
                                                        e.currentTarget.src = DEFAULT_IMAGE
                                                    }}
                                                />
                                            </div>
                                            <CardContent className="p-4">
                                                <div className="flex items-start justify-between mb-2">
                                                    <div className="flex-1 min-w-0">
                                                        <h3 className="font-semibold text-lg truncate">{item.name}</h3>
                                                        {item.category && (
                                                            <Badge variant="outline" className="mt-1">
                                                                {item.category}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="space-y-2 mb-3">
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-muted-foreground">Estoque Atual:</span>
                                                        <span className="font-medium">
                                                            {item.current_stock} {item.unit}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-muted-foreground">Estoque Mínimo:</span>
                                                        <span className="font-medium">
                                                            {item.min_stock} {item.unit}
                                                        </span>
                                                    </div>
                                                    {item.selling_price && (
                                                        <div className="flex justify-between text-sm">
                                                            <span className="text-muted-foreground">Preço:</span>
                                                            <span className="font-bold">
                                                                {formatCurrency(item.selling_price)}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex justify-end">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => navigate(`/stock/edit/${item.id}`)}
                                                    >
                                                        <Pencil className="w-4 h-4 mr-2" />
                                                        Editar
                                                    </Button>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Dialog de confirmação para deletar menu item */}
            <Dialog open={deleteMenuDialogOpen} onOpenChange={setDeleteMenuDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirmar Exclusão</DialogTitle>
                        <DialogDescription>
                            Tem certeza que deseja excluir o item "{menuItemToDelete?.name}"? Esta ação não pode ser desfeita.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setDeleteMenuDialogOpen(false)
                                setMenuItemToDelete(null)
                            }}
                        >
                            Cancelar
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDeleteMenuItem}
                        >
                            Excluir
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

