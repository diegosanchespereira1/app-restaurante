import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { useRestaurant } from '../context/RestaurantContext'
import { useLanguage } from '../context/LanguageContext'
import { formatCurrency } from '../lib/utils'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { TrendingUp, Filter } from 'lucide-react'

interface SalesData {
    name: string
    quantity: number
    revenue: number
    category: string
    [key: string]: string | number
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF7C7C']

export function SalesChart() {
    const { orders, menuItems, categories } = useRestaurant()
    const { t } = useLanguage()
    const [selectedPeriod, setSelectedPeriod] = useState('all')
    const [selectedCategory, setSelectedCategory] = useState('all')
    const [chartType, setChartType] = useState<'bar' | 'pie'>('bar')

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
            const orderDate = new Date(order.time)
            return orderDate >= cutoffDate && order.status === 'Closed'
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
        </div>
    )
}