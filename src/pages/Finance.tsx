import { useState, useMemo } from "react"
import { useRestaurant } from "../context/RestaurantContext"
import type { Order } from "../context/RestaurantContext"
import { useLanguage } from "../context/LanguageContext"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "../components/ui/dialog"
import { formatCurrency } from "../lib/utils"
import { Plus, Trash2, TrendingUp, TrendingDown, DollarSign, ChevronLeft, ChevronRight, Filter } from "lucide-react"
import {
    PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'

export function Finance() {
    const { orders, expenses, addExpense, deleteExpense } = useRestaurant()
    const { t } = useLanguage()
    const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false)
    const [newExpense, setNewExpense] = useState({
        description: "",
        amount: "",
        category: "Other",
        date: new Date().toISOString().split('T')[0]
    })

    // Estados para filtros e paginação de vendas
    const [salesPage, setSalesPage] = useState(1)
    const [salesFilters, setSalesFilters] = useState({
        id: "",
        customer: "",
        date: "",
        paymentMethod: ""
    })
    const [selectedSale, setSelectedSale] = useState<Order | null>(null)
    const [isSaleDetailsOpen, setIsSaleDetailsOpen] = useState(false)

    // Colors for charts
    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8']

    // Calculations
    const totalRevenue = orders
        .filter(o => o.status === "Closed")
        .reduce((sum, order) => sum + order.total, 0)

    const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0)
    const netProfit = totalRevenue - totalExpenses

    // Sales by Payment Method Data
    const salesByPaymentMethod = orders
        .filter(o => o.status === "Closed" && o.paymentMethod)
        .reduce((acc, order) => {
            const method = order.paymentMethod!
            acc[method] = (acc[method] || 0) + order.total
            return acc
        }, {} as Record<string, number>)

    const paymentMethodData = Object.entries(salesByPaymentMethod).map(([name, value]) => ({
        name: t(name.toLowerCase() as any) || name,
        value
    }))

    // Sales by Order Type Data
    const salesByOrderType = orders
        .filter(o => o.status === "Closed")
        .reduce((acc, order) => {
            const type = order.orderType || "dine_in"
            acc[type] = (acc[type] || 0) + order.total
            return acc
        }, {} as Record<string, number>)

    const orderTypeData = Object.entries(salesByOrderType).map(([name, value]) => ({
        name: t(name === 'dine_in' ? 'dineIn' : name as any) || name,
        value
    }))

    // Expenses by Category Data
    const expensesByCategory = expenses.reduce((acc, expense) => {
        acc[expense.category] = (acc[expense.category] || 0) + expense.amount
        return acc
    }, {} as Record<string, number>)

    const expensesData = Object.entries(expensesByCategory).map(([name, value]) => ({
        name,
        value
    }))

    // Filtrar e ordenar vendas realizadas (pedidos fechados)
    const completedSales = useMemo(() => {
        try {
            let sales = orders.filter(o => o && o.status === "Closed")
            
            // Ordenar por data (mais recentes primeiro)
            sales.sort((a, b) => {
                try {
                    // Priorizar closedAt (timestamp ISO válido)
                    let dateA = 0
                    let dateB = 0
                    
                    if (a.closedAt) {
                        const d = new Date(a.closedAt)
                        if (!isNaN(d.getTime())) {
                            dateA = d.getTime()
                        }
                    }
                    
                    if (b.closedAt) {
                        const d = new Date(b.closedAt)
                        if (!isNaN(d.getTime())) {
                            dateB = d.getTime()
                        }
                    }
                    
                    // Se não tem closedAt, tentar usar time
                    if (dateA === 0 && a.time) {
                        try {
                            // Tentar parsear formato "DD/MM/YYYY, HH:MM:SS"
                            if (a.time.includes(',')) {
                                const [datePart] = a.time.split(',')
                                const parts = datePart.trim().split('/')
                                if (parts.length === 3) {
                                    const [day, month, year] = parts
                                    const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
                                    if (!isNaN(d.getTime())) {
                                        dateA = d.getTime()
                                    }
                                }
                            } else {
                                const d = new Date(a.time)
                                if (!isNaN(d.getTime())) {
                                    dateA = d.getTime()
                                }
                            }
                        } catch (e) {
                            // Ignorar erro
                        }
                    }
                    
                    if (dateB === 0 && b.time) {
                        try {
                            if (b.time.includes(',')) {
                                const [datePart] = b.time.split(',')
                                const parts = datePart.trim().split('/')
                                if (parts.length === 3) {
                                    const [day, month, year] = parts
                                    const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
                                    if (!isNaN(d.getTime())) {
                                        dateB = d.getTime()
                                    }
                                }
                            } else {
                                const d = new Date(b.time)
                                if (!isNaN(d.getTime())) {
                                    dateB = d.getTime()
                                }
                            }
                        } catch (e) {
                            // Ignorar erro
                        }
                    }
                    
                    return dateB - dateA // Mais recentes primeiro
                } catch (e) {
                    console.error('Erro ao ordenar vendas:', e)
                    return 0
                }
            })

            // Aplicar filtros
            if (salesFilters.id) {
                sales = sales.filter(s => s && s.id && s.id.toLowerCase().includes(salesFilters.id.toLowerCase()))
            }
            if (salesFilters.customer) {
                sales = sales.filter(s => s && s.customer && s.customer.toLowerCase().includes(salesFilters.customer.toLowerCase()))
            }
            if (salesFilters.date) {
                sales = sales.filter(s => {
                    try {
                        let saleDate = ""
                        
                        if (s.closedAt) {
                            const d = new Date(s.closedAt)
                            if (!isNaN(d.getTime())) {
                                saleDate = d.toISOString().split('T')[0]
                            }
                        } else if (s.time) {
                            try {
                                if (s.time.includes(',')) {
                                    const [datePart] = s.time.split(',')
                                    const parts = datePart.trim().split('/')
                                    if (parts.length === 3) {
                                        const [day, month, year] = parts
                                        saleDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
                                    }
                                } else {
                                    const d = new Date(s.time)
                                    if (!isNaN(d.getTime())) {
                                        saleDate = d.toISOString().split('T')[0]
                                    }
                                }
                            } catch (e) {
                                // Ignorar erro
                            }
                        }
                        
                        return saleDate === salesFilters.date
                    } catch (e) {
                        return false
                    }
                })
            }
            if (salesFilters.paymentMethod) {
                sales = sales.filter(s => s && s.paymentMethod === salesFilters.paymentMethod)
            }

            return sales
        } catch (error) {
            console.error('Erro ao processar vendas:', error)
            return []
        }
    }, [orders, salesFilters])

    // Paginação de vendas (20 por página)
    const SALES_PER_PAGE = 20
    const totalSalesPages = useMemo(() => {
        try {
            return Math.ceil((completedSales?.length || 0) / SALES_PER_PAGE) || 1
        } catch (e) {
            return 1
        }
    }, [completedSales])
    
    const paginatedSales = useMemo(() => {
        try {
            if (!completedSales || completedSales.length === 0) {
                return []
            }
            const startIndex = (salesPage - 1) * SALES_PER_PAGE
            const endIndex = startIndex + SALES_PER_PAGE
            return completedSales.slice(startIndex, endIndex)
        } catch (e) {
            console.error('Erro ao paginar vendas:', e)
            return []
        }
    }, [completedSales, salesPage])

    // Resetar página quando filtros mudarem
    const handleFilterChange = (key: string, value: string) => {
        setSalesFilters(prev => ({ ...prev, [key]: value }))
        setSalesPage(1)
    }

    const handleAddExpense = async () => {
        if (!newExpense.description || !newExpense.amount) return

        try {
            const result = await addExpense({
                description: newExpense.description,
                amount: parseFloat(newExpense.amount),
                category: newExpense.category,
                date: newExpense.date
            })

            if (result.success) {
                setNewExpense({
                    description: "",
                    amount: "",
                    category: "Other",
                    date: new Date().toISOString().split('T')[0]
                })
                setIsAddExpenseOpen(false)
            } else {
                // We could show a toast here, but for now let's alert or log.
                // Since we don't have a toast component ready, let's use a simple alert or rely on the console error.
                // Ideally, we should add an error state to the dialog.
                alert(`Failed to add expense: ${result.error}`)
            }
        } catch (err) {
            alert("An unexpected error occurred")
        }
    }

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">{t("finance")}</h2>
                <p className="text-muted-foreground">{t("settingsDescription")}</p>
            </div>

            <Tabs defaultValue="overview" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="overview">{t("overview")}</TabsTrigger>
                    <TabsTrigger value="sales">{t("sales")}</TabsTrigger>
                    <TabsTrigger value="expenses">{t("expenses")}</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-3">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">{t("revenue")}</CardTitle>
                                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">{t("expenses")}</CardTitle>
                                <TrendingDown className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{formatCurrency(totalExpenses)}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">{t("netProfit")}</CardTitle>
                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className={`text-2xl font-bold ${netProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                                    {formatCurrency(netProfit)}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Overview Charts */}
                    <div className="grid gap-4 md:grid-cols-2">
                        <Card className="col-span-1">
                            <CardHeader>
                                <CardTitle>{t("salesByPaymentMethod")}</CardTitle>
                            </CardHeader>
                            <CardContent className="h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={paymentMethodData}
                                            cx="50%"
                                            cy="50%"
                                            labelLine={false}
                                            label={({ name, percent }) => `${name} ${(percent ? percent * 100 : 0).toFixed(0)}%`}
                                            outerRadius={80}
                                            fill="#8884d8"
                                            dataKey="value"
                                        >
                                            {paymentMethodData.map((_, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                        <Card className="col-span-1">
                            <CardHeader>
                                <CardTitle>{t("salesByOrderType")}</CardTitle>
                            </CardHeader>
                            <CardContent className="h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={orderTypeData}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="name" />
                                        <YAxis />
                                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                                        <Bar dataKey="value" fill="#82ca9d" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="sales" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <Card>
                            <CardHeader>
                                <CardTitle>{t("salesByPaymentMethod")}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {paymentMethodData && paymentMethodData.length > 0 ? (
                                        paymentMethodData.map((item) => (
                                            <div key={item.name} className="flex items-center justify-between">
                                                <span className="font-medium">{item.name}</span>
                                                <span>{formatCurrency(item.value)}</span>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-sm text-muted-foreground">Nenhum dado disponível</div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle>{t("salesByOrderType")}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {orderTypeData && orderTypeData.length > 0 ? (
                                        orderTypeData.map((item) => (
                                            <div key={item.name} className="flex items-center justify-between">
                                                <span className="font-medium">{item.name}</span>
                                                <span>{formatCurrency(item.value)}</span>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-sm text-muted-foreground">Nenhum dado disponível</div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Lista de Vendas Realizadas */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle>Vendas Realizadas</CardTitle>
                                {completedSales.length > 0 && (
                                    <div className="text-sm text-muted-foreground">
                                        Total: {completedSales.length} venda{completedSales.length !== 1 ? 's' : ''}
                                    </div>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Filtros */}
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                                <div className="space-y-2">
                                    <Label htmlFor="filter-id">Filtrar por ID</Label>
                                    <Input
                                        id="filter-id"
                                        placeholder="ID do pedido"
                                        value={salesFilters.id}
                                        onChange={(e) => handleFilterChange("id", e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="filter-customer">Filtrar por Cliente</Label>
                                    <Input
                                        id="filter-customer"
                                        placeholder="Nome do cliente"
                                        value={salesFilters.customer}
                                        onChange={(e) => handleFilterChange("customer", e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="filter-date">Filtrar por Data</Label>
                                    <Input
                                        id="filter-date"
                                        type="date"
                                        value={salesFilters.date}
                                        onChange={(e) => handleFilterChange("date", e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="filter-payment">Método de Pagamento</Label>
                                    <Select
                                        value={salesFilters.paymentMethod || "all"}
                                        onValueChange={(value) => handleFilterChange("paymentMethod", value === "all" ? "" : value)}
                                    >
                                        <SelectTrigger id="filter-payment">
                                            <SelectValue placeholder="Todos" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Todos</SelectItem>
                                            <SelectItem value="Cash">Dinheiro</SelectItem>
                                            <SelectItem value="Card">Cartão</SelectItem>
                                            <SelectItem value="PIX">PIX</SelectItem>
                                            <SelectItem value="Voucher">Vale</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Botão para limpar filtros */}
                            {(salesFilters.id || salesFilters.customer || salesFilters.date || salesFilters.paymentMethod) && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setSalesFilters({ id: "", customer: "", date: "", paymentMethod: "" })
                                        setSalesPage(1)
                                    }}
                                    className="w-full sm:w-auto"
                                >
                                    <Filter className="h-4 w-4 mr-2" />
                                    Limpar Filtros
                                </Button>
                            )}

                            {/* Lista de vendas */}
                            <div className="border rounded-lg overflow-hidden">
                                <div className="max-h-[600px] overflow-auto">
                                    {paginatedSales.length === 0 ? (
                                        <div className="p-8 text-center text-muted-foreground">
                                            {completedSales.length === 0 
                                                ? "Nenhuma venda encontrada"
                                                : "Nenhuma venda encontrada com os filtros aplicados"}
                                        </div>
                                    ) : (
                                        <div className="divide-y">
                                            {paginatedSales.map((sale) => {
                                                if (!sale) return null
                                                
                                                // Obter data formatada para exibição
                                                let displayDate = sale.time || ""
                                                try {
                                                    if (sale.closedAt) {
                                                        const date = new Date(sale.closedAt)
                                                        if (!isNaN(date.getTime())) {
                                                            displayDate = date.toLocaleDateString('pt-BR', {
                                                                day: '2-digit',
                                                                month: '2-digit',
                                                                year: 'numeric',
                                                                hour: '2-digit',
                                                                minute: '2-digit'
                                                            })
                                                        }
                                                    } else if (sale.time) {
                                                        // Se time já está formatado, usar diretamente
                                                        displayDate = sale.time
                                                    }
                                                } catch (e) {
                                                    console.error('Erro ao formatar data:', e)
                                                    displayDate = sale.time || "Data não disponível"
                                                }
                                                
                                                const paymentMethodLabel = sale.paymentMethod === "Cash" ? "Dinheiro" :
                                                    sale.paymentMethod === "Card" ? "Cartão" :
                                                    sale.paymentMethod === "PIX" ? "PIX" :
                                                    sale.paymentMethod === "Voucher" ? "Vale" : sale.paymentMethod || ""
                                                
                                                return (
                                                    <div
                                                        key={sale.id || Math.random()}
                                                        className="p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                                                        onClick={() => {
                                                            setSelectedSale(sale)
                                                            setIsSaleDetailsOpen(true)
                                                        }}
                                                    >
                                                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                                            <div className="flex-1 space-y-1">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-mono font-semibold text-sm">ID: {sale.id || "N/A"}</span>
                                                                    {sale.paymentMethod && (
                                                                        <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full">
                                                                            {paymentMethodLabel}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="text-sm text-muted-foreground">
                                                                    <span className="font-medium">{sale.customer || "Cliente não informado"}</span>
                                                                    {sale.table && (
                                                                        <span className="ml-2">• Mesa: {sale.table}</span>
                                                                    )}
                                                                </div>
                                                                <div className="text-xs text-muted-foreground">
                                                                    {displayDate}
                                                                    {sale.items && sale.items.length > 0 && (
                                                                        <span className="ml-2">• {sale.items.length} {sale.items.length === 1 ? 'item' : 'itens'}</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-4">
                                                                <div className="text-right">
                                                                    <div className="text-sm text-muted-foreground">Total</div>
                                                                    <div className="text-lg font-bold text-primary">
                                                                        {formatCurrency(sale.total || 0)}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Paginação */}
                            {completedSales.length > 0 && (
                                <div className="flex items-center justify-between pt-4 border-t">
                                    <div className="text-sm text-muted-foreground">
                                        Mostrando {((salesPage - 1) * SALES_PER_PAGE) + 1} a {Math.min(salesPage * SALES_PER_PAGE, completedSales.length)} de {completedSales.length} vendas
                                    </div>
                                    {totalSalesPages > 1 && (
                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setSalesPage(prev => Math.max(1, prev - 1))}
                                                disabled={salesPage === 1}
                                            >
                                                <ChevronLeft className="h-4 w-4" />
                                                Anterior
                                            </Button>
                                            <span className="text-sm font-medium">
                                                Página {salesPage} de {totalSalesPages}
                                            </span>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setSalesPage(prev => Math.min(totalSalesPages, prev + 1))}
                                                disabled={salesPage === totalSalesPages}
                                            >
                                                Próxima
                                                <ChevronRight className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Dialog de Detalhes da Venda */}
                    <Dialog open={isSaleDetailsOpen} onOpenChange={setIsSaleDetailsOpen}>
                        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle>Detalhes da Venda</DialogTitle>
                                <DialogDescription>
                                    Informações completas da venda realizada
                                </DialogDescription>
                            </DialogHeader>

                            {selectedSale && (
                                <div className="space-y-6">
                                    {/* Informações Gerais */}
                                    <div className="grid gap-4">
                                        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                                            <div>
                                                <Label className="text-xs text-muted-foreground">ID do Pedido</Label>
                                                <p className="font-mono font-bold text-lg">{selectedSale.id}</p>
                                            </div>
                                            <div className="text-right">
                                                <Label className="text-xs text-muted-foreground">Total</Label>
                                                <p className="font-bold text-2xl text-primary">
                                                    {formatCurrency(selectedSale.total || 0)}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <Label className="text-xs text-muted-foreground">Cliente</Label>
                                                <p className="font-medium">{selectedSale.customer || "Não informado"}</p>
                                            </div>
                                            {selectedSale.table && (
                                                <div>
                                                    <Label className="text-xs text-muted-foreground">Mesa</Label>
                                                    <p className="font-medium">{selectedSale.table}</p>
                                                </div>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <Label className="text-xs text-muted-foreground">Tipo de Pedido</Label>
                                                <p className="font-medium">
                                                    {selectedSale.orderType === "dine_in" ? "Mesa" :
                                                     selectedSale.orderType === "takeout" ? "Retirada" :
                                                     selectedSale.orderType === "delivery" ? "Delivery" :
                                                     selectedSale.orderType}
                                                </p>
                                            </div>
                                            {selectedSale.paymentMethod && (
                                                <div>
                                                    <Label className="text-xs text-muted-foreground">Método de Pagamento</Label>
                                                    <p className="font-medium">
                                                        {selectedSale.paymentMethod === "Cash" ? "Dinheiro" :
                                                         selectedSale.paymentMethod === "Card" ? "Cartão" :
                                                         selectedSale.paymentMethod === "PIX" ? "PIX" :
                                                         selectedSale.paymentMethod === "Voucher" ? "Vale" :
                                                         selectedSale.paymentMethod}
                                                    </p>
                                                </div>
                                            )}
                                        </div>

                                        <div>
                                            <Label className="text-xs text-muted-foreground">Data e Hora</Label>
                                            <p className="font-medium">
                                                {(() => {
                                                    try {
                                                        if (selectedSale.closedAt) {
                                                            const date = new Date(selectedSale.closedAt)
                                                            if (!isNaN(date.getTime())) {
                                                                return date.toLocaleDateString('pt-BR', {
                                                                    day: '2-digit',
                                                                    month: '2-digit',
                                                                    year: 'numeric',
                                                                    hour: '2-digit',
                                                                    minute: '2-digit'
                                                                })
                                                            }
                                                        }
                                                        return selectedSale.time || "Data não disponível"
                                                    } catch (e) {
                                                        return selectedSale.time || "Data não disponível"
                                                    }
                                                })()}
                                            </p>
                                        </div>

                                        {selectedSale.notes && (
                                            <div>
                                                <Label className="text-xs text-muted-foreground">Observações</Label>
                                                <p className="font-medium">{selectedSale.notes}</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Itens do Pedido */}
                                    <div>
                                        <Label className="text-sm font-semibold mb-3 block">Itens do Pedido</Label>
                                        <div className="border rounded-lg divide-y">
                                            {selectedSale.items && selectedSale.items.length > 0 ? (
                                                selectedSale.items.map((item, index) => (
                                                    <div key={index} className="p-4 flex items-center justify-between">
                                                        <div className="flex-1">
                                                            <p className="font-medium">{item.name}</p>
                                                            <p className="text-sm text-muted-foreground">
                                                                {formatCurrency(item.price)} x {item.quantity}
                                                            </p>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="font-bold">
                                                                {formatCurrency(item.price * item.quantity)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="p-4 text-center text-muted-foreground">
                                                    Nenhum item encontrado
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Resumo Financeiro */}
                                    <div className="border-t pt-4">
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-muted-foreground">Subtotal:</span>
                                                <span className="font-medium">
                                                    {formatCurrency(selectedSale.items?.reduce((sum, item) => sum + (item.price * item.quantity), 0) || 0)}
                                                </span>
                                            </div>
                                            {selectedSale.order_discount_type && selectedSale.order_discount_value && (
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-muted-foreground">
                                                        Desconto ({selectedSale.order_discount_type === "fixed" ? "Fixo" : "Percentual"}):
                                                    </span>
                                                    <span className="font-medium text-red-600">
                                                        - {selectedSale.order_discount_type === "fixed" 
                                                            ? formatCurrency(selectedSale.order_discount_value)
                                                            : `${selectedSale.order_discount_value}%`}
                                                    </span>
                                                </div>
                                            )}
                                            <div className="flex justify-between text-lg font-bold border-t pt-2">
                                                <span>Total:</span>
                                                <span className="text-primary">
                                                    {formatCurrency(selectedSale.total || 0)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsSaleDetailsOpen(false)}>
                                    Fechar
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </TabsContent>

                <TabsContent value="expenses" className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-medium">{t("expenses")}</h3>
                        <Dialog open={isAddExpenseOpen} onOpenChange={setIsAddExpenseOpen}>
                            <DialogTrigger asChild>
                                <Button>
                                    <Plus className="mr-2 h-4 w-4" /> {t("addExpense")}
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>{t("addExpense")}</DialogTitle>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <div className="grid gap-2">
                                        <Label>{t("expenseDescription")}</Label>
                                        <Input
                                            value={newExpense.description}
                                            onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>{t("expenseAmount")}</Label>
                                        <Input
                                            type="number"
                                            value={newExpense.amount}
                                            onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>{t("expenseCategory")}</Label>
                                        <Select
                                            value={newExpense.category}
                                            onValueChange={(value) => setNewExpense({ ...newExpense, category: value })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Inventory">Inventory</SelectItem>
                                                <SelectItem value="Utilities">Utilities</SelectItem>
                                                <SelectItem value="Salaries">Salaries</SelectItem>
                                                <SelectItem value="Rent">Rent</SelectItem>
                                                <SelectItem value="Other">Other</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>{t("expenseDate")}</Label>
                                        <Input
                                            type="date"
                                            value={newExpense.date}
                                            onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button onClick={handleAddExpense}>{t("save")}</Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <Card>
                            <CardHeader>
                                <CardTitle>Expenses by Category</CardTitle>
                            </CardHeader>
                            <CardContent className="h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={expensesData} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis type="number" />
                                        <YAxis dataKey="name" type="category" width={100} />
                                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                                        <Bar dataKey="value" fill="#FF8042" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Recent Expenses</CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                {expenses.length === 0 ? (
                                    <div className="p-8 text-center text-muted-foreground">
                                        {t("noExpenses")}
                                    </div>
                                ) : (
                                    <div className="divide-y max-h-[300px] overflow-auto">
                                        {expenses.map((expense) => (
                                            <div key={expense.id} className="flex items-center justify-between p-4">
                                                <div>
                                                    <p className="font-medium">{expense.description}</p>
                                                    <p className="text-sm text-muted-foreground">
                                                        {expense.category} • {new Date(expense.date).toLocaleDateString()}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <span className="font-bold">{formatCurrency(expense.amount)}</span>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="text-destructive"
                                                        onClick={() => deleteExpense(expense.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    )
}
