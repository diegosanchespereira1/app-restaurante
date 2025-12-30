import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog'
import { useRestaurant } from '../context/RestaurantContext'
import { useLanguage } from '../context/LanguageContext'
import { useAuth } from '../context/AuthContext'
import { formatCurrency } from '../lib/utils'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { TrendingUp, Filter, X, Wallet, CreditCard, Ticket, QrCode, ChevronLeft, ChevronRight, CheckCircle } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

interface SalesData {
    name: string
    quantity: number
    revenue: number
    category: string
    [key: string]: string | number
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF7C7C']

export function SalesChart() {
    const navigate = useNavigate()
    const { orders, menuItems, categories, cancelOrder } = useRestaurant()
    const { t } = useLanguage()
    const { profile, user } = useAuth()
    const [selectedPeriod, setSelectedPeriod] = useState('all')
    const [selectedCategory, setSelectedCategory] = useState('all')
    const [chartType, setChartType] = useState<'bar' | 'pie'>('bar')
    const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
    const [password, setPassword] = useState('')
    const [passwordError, setPasswordError] = useState<string | null>(null)
    const [isCancelling, setIsCancelling] = useState(false)
    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 20

    // Filter orders by period
    const filteredOrders = useMemo(() => {
        const now = new Date()
        let cutoffDate = new Date(0) // all time

        switch (selectedPeriod) {
            case 'today':
                cutoffDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
                break
            case 'week':
                cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
                break
            case 'month':
                cutoffDate = new Date(now.getFullYear(), now.getMonth(), 1)
                break
            case 'year':
                cutoffDate = new Date(now.getFullYear(), 0, 1)
                break
        }

        return orders.filter(order => {
            if (order.status !== 'Closed') return false
            
            // Usar closed_at se disponível, caso contrário usar created_at
            const orderDateStr = order.closedAt || order.created_at
            if (!orderDateStr) return false
            
            const orderDate = new Date(orderDateStr)
            return orderDate >= cutoffDate
        })
    }, [orders, selectedPeriod])

    // Aggregate sales data
    const salesData = useMemo(() => {
        const salesMap = new Map<string, SalesData>()

        filteredOrders.forEach(order => {
            order.items.forEach(item => {
                const existing = salesMap.get(item.name)
                if (existing) {
                    existing.quantity += item.quantity
                    existing.revenue += item.price * item.quantity
                } else {
                    const menuItem = menuItems.find(mi => mi.name === item.name)
                    salesMap.set(item.name, {
                        name: item.name,
                        quantity: item.quantity,
                        revenue: item.price * item.quantity,
                        category: menuItem?.category || 'Other'
                    })
                }
            })
        })

        let salesArray = Array.from(salesMap.values())

        // Filter by category
        if (selectedCategory !== 'all') {
            salesArray = salesArray.filter(item => item.category === selectedCategory)
        }

        // Sort by revenue descending
        return salesArray.sort((a, b) => b.revenue - a.revenue)
    }, [filteredOrders, menuItems, selectedCategory])

    // Get category data for pie chart
    const categoryData = useMemo(() => {
        const categoryMap = new Map<string, { name: string, value: number, revenue: number }>()

        salesData.forEach(item => {
            const existing = categoryMap.get(item.category)
            if (existing) {
                existing.value += item.quantity
                existing.revenue += item.revenue
            } else {
                categoryMap.set(item.category, {
                    name: item.category,
                    value: item.quantity,
                    revenue: item.revenue
                })
            }
        })

        return Array.from(categoryMap.values()).sort((a, b) => b.revenue - a.revenue)
    }, [salesData])

    const totalRevenue = salesData.reduce((sum, item) => sum + item.revenue, 0)
    const totalQuantity = salesData.reduce((sum, item) => sum + item.quantity, 0)

    // Filtrar apenas vendas fechadas (não canceladas) para o card de vendas
    const closedOrders = useMemo(() => {
        const now = new Date()
        let cutoffDate = new Date(0)

        switch (selectedPeriod) {
            case 'today':
                cutoffDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
                break
            case 'week':
                cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
                break
            case 'month':
                cutoffDate = new Date(now.getFullYear(), now.getMonth(), 1)
                break
            case 'year':
                cutoffDate = new Date(now.getFullYear(), 0, 1)
                break
        }

        return orders
            .filter(order => {
                if (order.status !== 'Closed') return false
                
                // Usar closed_at se disponível, caso contrário usar created_at
                const orderDateStr = order.closedAt || order.created_at
                if (!orderDateStr) return false
                
                const orderDate = new Date(orderDateStr)
                return orderDate >= cutoffDate
            })
            .sort((a, b) => {
                // Ordenar por closed_at se disponível, caso contrário usar created_at
                const dateAStr = a.closedAt || a.created_at
                const dateBStr = b.closedAt || b.created_at
                
                if (!dateAStr || !dateBStr) return 0
                
                const dateA = new Date(dateAStr).getTime()
                const dateB = new Date(dateBStr).getTime()
                return dateB - dateA // Mais recentes primeiro
            })
    }, [orders, selectedPeriod])

    // Resetar página quando o período mudar
    useEffect(() => {
        setCurrentPage(1)
    }, [selectedPeriod])

    // Calcular dados paginados
    const totalPages = Math.ceil(closedOrders.length / itemsPerPage)
    const paginatedOrders = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage
        const endIndex = startIndex + itemsPerPage
        return closedOrders.slice(startIndex, endIndex)
    }, [closedOrders, currentPage, itemsPerPage])

    const canCancelOrder = profile && (profile.role === 'admin' || profile.role === 'gerente')

    const getPaymentMethodIcon = (method?: "Cash" | "Card" | "Voucher" | "PIX") => {
        if (!method) return null
        switch (method) {
            case 'Cash': return <Wallet className="h-4 w-4" />
            case 'Card': return <CreditCard className="h-4 w-4" />
            case 'Voucher': return <Ticket className="h-4 w-4" />
            case 'PIX': return <QrCode className="h-4 w-4" />
        }
    }

    const handleCancelClick = (orderId: string) => {
        setSelectedOrderId(orderId)
        setPassword('')
        setPasswordError(null)
        setCancelDialogOpen(true)
    }

    const handleCancelConfirm = async () => {
        if (!selectedOrderId || !password) {
            setPasswordError('Por favor, insira sua senha')
            return
        }

        if (!user) {
            setPasswordError('Usuário não autenticado')
            return
        }

        setIsCancelling(true)
        setPasswordError(null)

        try {
            // Verificar senha tentando fazer login
            let email = user.email || ''
            
            if (!isSupabaseConfigured) {
                // Demo mode: permitir cancelar sem verificar senha
                const result = await cancelOrder(selectedOrderId)
                if (result.success) {
                    setCancelDialogOpen(false)
                    setSelectedOrderId(null)
                    setPassword('')
                } else {
                    setPasswordError(result.error || 'Erro ao cancelar venda')
                }
                setIsCancelling(false)
                return
            }

            // Buscar email do usuário atual se necessário
            if (!email && profile) {
                const { data } = await supabase
                    .from('user_profiles')
                    .select('email')
                    .eq('id', user.id)
                    .single()
                
                if (data) {
                    email = data.email
                }
            }

            if (!email) {
                setPasswordError('Não foi possível verificar a senha')
                setIsCancelling(false)
                return
            }

            // Verificar senha tentando fazer login
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email,
                password,
            })

            if (signInError) {
                setPasswordError('Senha incorreta')
                setIsCancelling(false)
                return
            }

            // Senha correta, cancelar o pedido
            const result = await cancelOrder(selectedOrderId)
            if (result.success) {
                setCancelDialogOpen(false)
                setSelectedOrderId(null)
                setPassword('')
            } else {
                setPasswordError(result.error || 'Erro ao cancelar venda')
            }
        } catch (error: any) {
            console.error('Error cancelling order:', error)
            setPasswordError(error.message || 'Erro ao cancelar venda')
        } finally {
            setIsCancelling(false)
        }
    }

    const selectedOrder = selectedOrderId ? orders.find(o => o.id === selectedOrderId) : null

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">{t("salesAnalysis") || "Sales Analysis"}</h2>
                    <p className="text-muted-foreground">{t("salesByProduct") || "View sales data by product with filters"}</p>
                </div>
            </div>

            {/* Filters */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{t("timePeriod") || "Time Period"}</CardTitle>
                        <Filter className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">{t("allTime") || "All Time"}</SelectItem>
                                <SelectItem value="today">{t("today") || "Today"}</SelectItem>
                                <SelectItem value="week">{t("thisWeek") || "This Week"}</SelectItem>
                                <SelectItem value="month">{t("thisMonth") || "This Month"}</SelectItem>
                                <SelectItem value="year">{t("thisYear") || "This Year"}</SelectItem>
                            </SelectContent>
                        </Select>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{t("category") || "Category"}</CardTitle>
                        <Filter className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">{t("allCategories") || "All Categories"}</SelectItem>
                                {categories.map(category => (
                                    <SelectItem key={category.id} value={category.name}>
                                        {category.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{t("chartType") || "Chart Type"}</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <Select value={chartType} onValueChange={(value: 'bar' | 'pie') => setChartType(value)}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="bar">{t("barChart") || "Bar Chart"}</SelectItem>
                                <SelectItem value="pie">{t("pieChart") || "Pie Chart"}</SelectItem>
                            </SelectContent>
                        </Select>
                    </CardContent>
                </Card>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{t("totalRevenue") || "Total Revenue"}</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{t("totalItems") || "Total Items Sold"}</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalQuantity}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{t("uniqueProducts") || "Unique Products"}</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{salesData.length}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{t("avgOrderValue") || "Avg Revenue per Item"}</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {totalQuantity > 0 ? formatCurrency(totalRevenue / totalQuantity) : formatCurrency(0)}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Charts */}
            <div className="grid gap-4 md:grid-cols-2">
                {/* Product Sales Chart */}
                <Card className="col-span-1">
                    <CardHeader>
                        <CardTitle>{t("productSales") || "Product Sales"}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[400px]">
                            {chartType === 'bar' ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={salesData.slice(0, 10)}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis 
                                            dataKey="name" 
                                            angle={-45}
                                            textAnchor="end"
                                            height={100}
                                            fontSize={12}
                                        />
                                        <YAxis />
                                        <Tooltip 
                                            formatter={(value, name) => [
                                                name === 'revenue' ? formatCurrency(value as number) : value,
                                                name === 'revenue' ? 'Revenue' : 'Quantity'
                                            ]}
                                        />
                                        <Bar dataKey="revenue" fill="#8884d8" />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={salesData.slice(0, 8)}
                                            cx="50%"
                                            cy="50%"
                                            labelLine={false}
                                            label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                                            outerRadius={120}
                                            fill="#8884d8"
                                            dataKey="revenue"
                                        >
                                            {salesData.slice(0, 8).map((_, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(value) => formatCurrency(value as number)} />
                                    </PieChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Category Distribution */}
                <Card className="col-span-1">
                    <CardHeader>
                        <CardTitle>{t("categoryDistribution") || "Category Distribution"}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[400px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={categoryData}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                                        outerRadius={120}
                                        fill="#8884d8"
                                        dataKey="revenue"
                                    >
                                        {categoryData.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value) => formatCurrency(value as number)} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Top Products Table */}
            <Card>
                <CardHeader>
                    <CardTitle>{t("topProducts") || "Top Products"}</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {salesData.slice(0, 10).map((product, index) => (
                            <div key={product.name} className="flex items-center justify-between">
                                <div className="flex items-center space-x-4">
                                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                        <span className="text-sm font-medium">{index + 1}</span>
                                    </div>
                                    <div>
                                        <p className="font-medium">{product.name}</p>
                                        <p className="text-sm text-muted-foreground">{product.category}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="font-medium">{formatCurrency(product.revenue)}</p>
                                    <p className="text-sm text-muted-foreground">{product.quantity} units</p>
                                </div>
                            </div>
                        ))}
                        {salesData.length === 0 && (
                            <div className="text-center text-muted-foreground py-8">
                                {t("noSalesData") || "No sales data available for the selected period"}
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Lista de Vendas Realizadas */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle>Vendas Realizadas</CardTitle>
                        {closedOrders.length > 0 && (
                            <div className="text-sm text-muted-foreground">
                                Total: {closedOrders.length} venda{closedOrders.length !== 1 ? 's' : ''}
                            </div>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {closedOrders.length === 0 ? (
                            <div className="text-center text-muted-foreground py-8">
                                Nenhuma venda encontrada para o período selecionado
                            </div>
                        ) : (
                            <>
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b">
                                                <th className="text-left py-2 px-4 font-medium">ID</th>
                                                <th className="text-left py-2 px-4 font-medium">Cliente</th>
                                                <th className="text-left py-2 px-4 font-medium">Data/Hora</th>
                                                <th className="text-left py-2 px-4 font-medium">Status Pagamento</th>
                                                <th className="text-left py-2 px-4 font-medium">Método Pagamento</th>
                                                <th className="text-right py-2 px-4 font-medium">Total</th>
                                                {canCancelOrder && (
                                                    <th className="text-center py-2 px-4 font-medium">Ações</th>
                                                )}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {paginatedOrders.map((order) => (
                                                <tr 
                                                    key={order.id} 
                                                    className="border-b hover:bg-muted/50 cursor-pointer transition-colors"
                                                    onClick={() => navigate(`/orders/${order.id}`)}
                                                >
                                                    <td className="py-3 px-4 font-mono text-sm">{order.id}</td>
                                                    <td className="py-3 px-4">{order.customer}</td>
                                                    <td className="py-3 px-4 text-sm text-muted-foreground">
                                                        {order.closedAt 
                                                            ? new Date(order.closedAt).toLocaleString('pt-BR')
                                                            : order.created_at
                                                                ? new Date(order.created_at).toLocaleString('pt-BR')
                                                                : order.time
                                                        }
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        {order.status === "Closed" && order.paymentMethod ? (
                                                            <div className="flex items-center gap-2 text-green-600">
                                                                <CheckCircle className="h-4 w-4" />
                                                                <span className="font-medium">Pago</span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-muted-foreground">-</span>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        {order.paymentMethod ? (
                                                            <div className="flex items-center gap-2">
                                                                {getPaymentMethodIcon(order.paymentMethod)}
                                                                <span>{t(order.paymentMethod.toLowerCase() as any) || order.paymentMethod}</span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-muted-foreground">-</span>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-4 text-right font-medium">
                                                        {formatCurrency(order.total)}
                                                    </td>
                                                    {canCancelOrder && (
                                                        <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                                                            <Button
                                                                variant="destructive"
                                                                size="sm"
                                                                onClick={() => handleCancelClick(order.id)}
                                                            >
                                                                <X className="h-4 w-4 mr-1" />
                                                                Cancelar
                                                            </Button>
                                                        </td>
                                                    )}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="flex items-center justify-between pt-4 border-t">
                                    <div className="text-sm text-muted-foreground">
                                        Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, closedOrders.length)} de {closedOrders.length} venda{closedOrders.length !== 1 ? 's' : ''}
                                    </div>
                                    {totalPages > 1 && (
                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                                disabled={currentPage === 1}
                                            >
                                                <ChevronLeft className="h-4 w-4" />
                                                Anterior
                                            </Button>
                                            <div className="text-sm font-medium">
                                                Página {currentPage} de {totalPages}
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                                disabled={currentPage === totalPages}
                                            >
                                                Próxima
                                                <ChevronRight className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Diálogo de Confirmação de Cancelamento */}
            <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Cancelar Venda</DialogTitle>
                        <DialogDescription>
                            {selectedOrder && (
                                <>
                                    Tem certeza que deseja cancelar a venda <strong>{selectedOrder.id}</strong>?
                                    <br />
                                    Valor: {formatCurrency(selectedOrder.total)}
                                    <br />
                                    Cliente: {selectedOrder.customer}
                                    <br />
                                    <br />
                                    Para confirmar, insira sua senha de login:
                                </>
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="password">Senha</Label>
                            <Input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => {
                                    setPassword(e.target.value)
                                    setPasswordError(null)
                                }}
                                placeholder="Digite sua senha"
                                disabled={isCancelling}
                            />
                            {passwordError && (
                                <p className="text-sm text-destructive">{passwordError}</p>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setCancelDialogOpen(false)
                                setPassword('')
                                setPasswordError(null)
                                setSelectedOrderId(null)
                            }}
                            disabled={isCancelling}
                        >
                            Cancelar
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleCancelConfirm}
                            disabled={isCancelling || !password}
                        >
                            {isCancelling ? 'Cancelando...' : 'Confirmar Cancelamento'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}