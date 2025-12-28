import { useState, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { useStock } from "../context/StockContext"
import { useLanguage } from "../context/LanguageContext"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { 
    Table, 
    TableBody, 
    TableCell, 
    TableHead, 
    TableHeader, 
    TableRow 
} from "../components/ui/table"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "../components/ui/dropdown-menu"
import { Plus, Search, MoreVertical, ArrowUpDown, Pencil, Trash2, ArrowLeft, ArrowRight } from "lucide-react"
import { formatCurrency } from "../lib/utils"
import { Badge } from "../components/ui/badge"

type SortField = 'name' | 'selling_price' | 'current_stock' | 'category'
type SortDirection = 'asc' | 'desc'

export function Stock() {
    const navigate = useNavigate()
    const { inventoryItems, deleteInventoryItem, isLoading } = useStock()
    const { t } = useLanguage()
    const [searchTerm, setSearchTerm] = useState("")
    const [sortField, setSortField] = useState<SortField>('name')
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 12

    // Filtrar itens
    const filteredItems = useMemo(() => {
        return inventoryItems.filter(item => {
            const matchesSearch = !searchTerm || 
                item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.category?.toLowerCase().includes(searchTerm.toLowerCase())
            return matchesSearch
        })
    }, [inventoryItems, searchTerm])

    // Ordenar itens
    const sortedItems = useMemo(() => {
        return [...filteredItems].sort((a, b) => {
            let aValue: any
            let bValue: any

            if (sortField === 'name') {
                aValue = (a.name ?? '').toString().toLowerCase()
                bValue = (b.name ?? '').toString().toLowerCase()
            } else if (sortField === 'selling_price') {
                aValue = a.selling_price ?? 0
                bValue = b.selling_price ?? 0
            } else if (sortField === 'current_stock') {
                aValue = a.current_stock ?? 0
                bValue = b.current_stock ?? 0
            } else if (sortField === 'category') {
                aValue = (a.category ?? '').toString().toLowerCase()
                bValue = (b.category ?? '').toString().toLowerCase()
            } else {
                return 0
            }

            if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
            if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
            return 0
        })
    }, [filteredItems, sortField, sortDirection])

    // Paginação
    const totalPages = Math.ceil(sortedItems.length / itemsPerPage)
    const paginatedItems = sortedItems.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    )

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
        } else {
            setSortField(field)
            setSortDirection('asc')
        }
    }

    const handleDelete = async (id: number) => {
        if (window.confirm('Tem certeza que deseja excluir este produto?')) {
            const result = await deleteInventoryItem(id)
            if (!result.success) {
                alert(result.error || 'Erro ao excluir produto')
            }
        }
    }

    const getProductTypeBadge = (product: typeof inventoryItems[0]) => {
        if (product.current_stock !== null && product.current_stock !== undefined) {
            if (product.selling_price) {
                return <Badge variant="default">Produto</Badge>
            }
            return <Badge variant="secondary">Estoque</Badge>
        }
        if (product.selling_price) {
            return <Badge variant="outline">Venda</Badge>
        }
        return <Badge variant="secondary">-</Badge>
    }

    if (isLoading) {
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
        <div className="space-y-6 w-full max-w-full overflow-x-hidden">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 w-full">
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
                    {t("stockManagement") || "Controle de Estoque"}
                </h2>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                    <div className="relative flex-1 sm:flex-initial sm:w-[300px] min-w-0">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                        <Input
                            placeholder="Buscar produtos..."
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value)
                                setCurrentPage(1)
                            }}
                            className="pl-9 w-full"
                        />
                    </div>
                    <Button 
                        className="bg-primary hover:bg-primary/90 w-full sm:w-auto shrink-0"
                        onClick={() => navigate('/products/new')}
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        <span className="hidden sm:inline">Adicionar Produto</span>
                        <span className="sm:hidden">Adicionar</span>
                    </Button>
                </div>
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block border rounded-lg w-full overflow-hidden">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="min-w-[200px]">
                                    Item
                                </TableHead>
                                <TableHead className="cursor-pointer whitespace-nowrap" onClick={() => handleSort('selling_price')}>
                                    <div className="flex items-center gap-2">
                                        Preço
                                        <ArrowUpDown className="h-4 w-4" />
                                    </div>
                                </TableHead>
                                <TableHead className="cursor-pointer whitespace-nowrap" onClick={() => handleSort('current_stock')}>
                                    <div className="flex items-center gap-2">
                                        Estoque
                                        <ArrowUpDown className="h-4 w-4" />
                                    </div>
                                </TableHead>
                                <TableHead className="cursor-pointer whitespace-nowrap" onClick={() => handleSort('category')}>
                                    <div className="flex items-center gap-2">
                                        Tipo
                                        <ArrowUpDown className="h-4 w-4" />
                                    </div>
                                </TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedItems.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                        Nenhum produto encontrado
                                    </TableCell>
                                </TableRow>
                            ) : (
                                paginatedItems.map((item) => (
                                    <TableRow key={item.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-3 min-w-0">
                                                {item.image ? (
                                                    <img 
                                                        src={item.image} 
                                                        alt={item.name}
                                                        className="w-10 h-10 rounded-md object-cover shrink-0"
                                                    />
                                                ) : (
                                                    <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center shrink-0">
                                                        <span className="text-xs font-medium text-muted-foreground">
                                                            {item.name.charAt(0).toUpperCase()}
                                                        </span>
                                                    </div>
                                                )}
                                                <div className="min-w-0">
                                                    <div className="font-medium truncate">{item.name}</div>
                                                    {item.category && (
                                                        <div className="text-sm text-muted-foreground truncate">{item.category}</div>
                                                    )}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="whitespace-nowrap">
                                            {item.selling_price ? formatCurrency(item.selling_price) : '-'}
                                        </TableCell>
                                        <TableCell className="whitespace-nowrap">
                                            {item.current_stock !== null && item.current_stock !== undefined 
                                                ? item.current_stock.toLocaleString('pt-BR')
                                                : '∞'
                                            }
                                        </TableCell>
                                        <TableCell>
                                            {getProductTypeBadge(item)}
                                        </TableCell>
                                        <TableCell>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                                        <MoreVertical className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem 
                                                        onClick={() => navigate(`/stock/edit/${item.id}`)}
                                                    >
                                                        <Pencil className="h-4 w-4 mr-2" />
                                                        Editar
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem 
                                                        onClick={() => handleDelete(item.id)}
                                                        className="text-destructive"
                                                    >
                                                        <Trash2 className="h-4 w-4 mr-2" />
                                                        Excluir
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3 w-full">
                {paginatedItems.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground border rounded-lg">
                        Nenhum produto encontrado
                    </div>
                ) : (
                    paginatedItems.map((item) => (
                        <div key={item.id} className="border rounded-lg p-4 space-y-3 w-full">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                    {item.image ? (
                                        <img 
                                            src={item.image} 
                                            alt={item.name}
                                            className="w-12 h-12 rounded-md object-cover shrink-0"
                                        />
                                    ) : (
                                        <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center shrink-0">
                                            <span className="text-sm font-medium text-muted-foreground">
                                                {item.name.charAt(0).toUpperCase()}
                                            </span>
                                        </div>
                                    )}
                                    <div className="min-w-0 flex-1">
                                        <div className="font-medium truncate">{item.name}</div>
                                        {item.category && (
                                            <div className="text-sm text-muted-foreground truncate">{item.category}</div>
                                        )}
                                    </div>
                                </div>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                                            <MoreVertical className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem 
                                            onClick={() => navigate(`/stock/edit/${item.id}`)}
                                        >
                                            <Pencil className="h-4 w-4 mr-2" />
                                            Editar
                                        </DropdownMenuItem>
                                        <DropdownMenuItem 
                                            onClick={() => handleDelete(item.id)}
                                            className="text-destructive"
                                        >
                                            <Trash2 className="h-4 w-4 mr-2" />
                                            Excluir
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex flex-col gap-1">
                                    <span className="text-xs text-muted-foreground">Preço</span>
                                    <span className="font-medium">
                                        {item.selling_price ? formatCurrency(item.selling_price) : '-'}
                                    </span>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-xs text-muted-foreground">Estoque</span>
                                    <span className="font-medium">
                                        {item.current_stock !== null && item.current_stock !== undefined 
                                            ? item.current_stock.toLocaleString('pt-BR')
                                            : '∞'
                                        }
                                    </span>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-xs text-muted-foreground">Tipo</span>
                                    {getProductTypeBadge(item)}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 w-full overflow-x-auto pb-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="shrink-0"
                    >
                        <ArrowLeft className="h-4 w-4 mr-1" />
                        <span className="hidden sm:inline">Anterior</span>
                    </Button>
                    <div className="flex items-center gap-1 shrink-0">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                            if (
                                page === 1 ||
                                page === totalPages ||
                                (page >= currentPage - 1 && page <= currentPage + 1)
                            ) {
                                return (
                                    <Button
                                        key={page}
                                        variant={currentPage === page ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => setCurrentPage(page)}
                                        className="w-10 shrink-0"
                                    >
                                        {page}
                                    </Button>
                                )
                            } else if (page === currentPage - 2 || page === currentPage + 2) {
                                return <span key={page} className="px-2 shrink-0">...</span>
                            }
                            return null
                        })}
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        className="shrink-0"
                    >
                        <span className="hidden sm:inline">Próxima</span>
                        <ArrowRight className="h-4 w-4 ml-1 sm:ml-0" />
                    </Button>
                </div>
            )}
        </div>
    )
}
