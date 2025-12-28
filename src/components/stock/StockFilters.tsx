import { Card, CardContent } from "../ui/card"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { Switch } from "../ui/switch"
import { Search, Filter } from "lucide-react"

interface StockFiltersProps {
    searchTerm: string
    onSearchChange: (value: string) => void
    categories: string[]
    selectedCategory: string | null
    onCategoryChange: (value: string | null) => void
    filterLowStock: boolean
    onFilterLowStockChange: (value: boolean) => void
}

export function StockFilters({
    searchTerm,
    onSearchChange,
    categories,
    selectedCategory,
    onCategoryChange,
    filterLowStock,
    onFilterLowStockChange
}: StockFiltersProps) {
    return (
        <Card>
            <CardContent className="p-4">
                <div className="flex flex-col md:flex-row gap-4">
                    {/* Search */}
                    <div className="flex-1">
                        <Label htmlFor="search" className="flex items-center gap-2 mb-2">
                            <Search className="w-4 h-4" />
                            Buscar
                        </Label>
                        <Input
                            id="search"
                            placeholder="Buscar por nome ou categoria..."
                            value={searchTerm}
                            onChange={(e) => onSearchChange(e.target.value)}
                        />
                    </div>

                    {/* Category Filter */}
                    <div className="md:w-48">
                        <Label htmlFor="category" className="flex items-center gap-2 mb-2">
                            <Filter className="w-4 h-4" />
                            Categoria
                        </Label>
                        <Select
                            value={selectedCategory || "all"}
                            onValueChange={(value) => onCategoryChange(value === "all" ? null : value)}
                        >
                            <SelectTrigger id="category">
                                <SelectValue placeholder="Todas" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas as categorias</SelectItem>
                                {categories.map((cat) => (
                                    <SelectItem key={cat} value={cat}>
                                        {cat}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Low Stock Filter */}
                    <div className="flex items-center space-x-2 pt-8">
                        <Switch
                            id="low-stock"
                            checked={filterLowStock}
                            onCheckedChange={onFilterLowStockChange}
                        />
                        <Label htmlFor="low-stock" className="cursor-pointer">
                            Apenas estoque baixo
                        </Label>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}




