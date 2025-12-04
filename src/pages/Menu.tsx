import { useState } from "react"
import { Button } from "../components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Badge } from "../components/ui/badge"
import { Plus, Pencil, Trash2 } from "lucide-react"
import { useRestaurant, type MenuItem } from "../context/RestaurantContext"
import { useLanguage } from "../context/LanguageContext"
import { formatCurrency } from "../lib/utils"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "../components/ui/dialog"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select"

export function Menu() {
    const { menuItems, addMenuItem, updateMenuItem, isLoading: isMenuLoading, error: menuError, categories, addCategory, updateCategory, deleteCategory } = useRestaurant()
    const { t } = useLanguage()
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

    // Edit Item Logic
    const [isEditOpen, setIsEditOpen] = useState(false)
    const [editingItem, setEditingItem] = useState<MenuItem | null>(null)

    const handleEditClick = (item: MenuItem) => {
        setEditingItem(item)
        setIsEditOpen(true)
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

    // Group items by category
    const itemsByCategory = menuItems.reduce((acc, item) => {
        if (!acc[item.category]) {
            acc[item.category] = []
        }
        acc[item.category].push(item)
        return acc
    }, {} as Record<string, typeof menuItems>)

    if (isMenuLoading) {
        return <div className="flex justify-center items-center h-64">Loading menu...</div>
    }

    if (menuError) {
        return <div className="text-destructive text-center p-8">Error loading menu: {menuError}</div>
    }

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">{t("menu")}</h2>
                    <p className="text-muted-foreground">{t("manageMenu")}</p>
                </div>
                <div className="flex gap-2">
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
                    No menu items found. Click "Add Item" to create one.
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
                    <div key={category.id} className="space-y-4">
                        <h3 className="text-xl font-semibold capitalize">{category.name}</h3>
                        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {items.map((item) => (
                                <Card key={item.id} className="overflow-hidden">
                                    <div className="aspect-video relative">
                                        <img
                                            src={item.image}
                                            alt={item.name}
                                            className="object-cover w-full h-full"
                                        />
                                        {/* ... rest of card ... */}
                                    </div>
                                    <CardHeader>
                                        <CardTitle className="flex justify-between items-start">
                                            <span>{item.name}</span>
                                            <Badge variant={item.status === "Available" ? "success" : "destructive"}>
                                                {t(item.status.toLowerCase() as any) || item.status}
                                            </Badge>
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                                            {item.description}
                                        </p>
                                        <div className="flex items-center justify-between">
                                            <div className="text-2xl font-bold mb-2">{formatCurrency(item.price)}</div>
                                            <div className="flex gap-2">
                                                <Button variant="outline" size="sm" onClick={() => handleEditClick(item)}>
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
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
                    <div key={catName} className="space-y-4">
                        <h3 className="text-xl font-semibold capitalize">{catName} (Uncategorized)</h3>
                        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {items.map(item => (
                                <Card key={item.id} className="overflow-hidden">
                                    <div className="aspect-video relative">
                                        <img
                                            src={item.image}
                                            alt={item.name}
                                            className="object-cover w-full h-full"
                                        />
                                    </div>
                                    <CardHeader>
                                        <CardTitle className="flex justify-between items-start">
                                            <span>{item.name}</span>
                                            <Badge variant={item.status === "Available" ? "success" : "destructive"}>
                                                {t(item.status.toLowerCase() as any) || item.status}
                                            </Badge>
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                                            {item.description}
                                        </p>
                                        <div className="flex items-center justify-between">
                                            <div className="text-2xl font-bold mb-2">{formatCurrency(item.price)}</div>
                                            <div className="flex gap-2">
                                                <Button variant="outline" size="sm" onClick={() => handleEditClick(item)}>
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                )
            })}
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
