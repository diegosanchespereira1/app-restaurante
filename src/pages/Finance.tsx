import { useState } from "react"
import { useRestaurant } from "../context/RestaurantContext"
import { useLanguage } from "../context/LanguageContext"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "../components/ui/dialog"
import { formatCurrency } from "../lib/utils"
import { Plus, Trash2, TrendingUp, TrendingDown, DollarSign } from "lucide-react"
import {
    PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
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
                                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                            outerRadius={80}
                                            fill="#8884d8"
                                            dataKey="value"
                                        >
                                            {paymentMethodData.map((entry, index) => (
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
                                    {paymentMethodData.map((item) => (
                                        <div key={item.name} className="flex items-center justify-between">
                                            <span className="font-medium">{item.name}</span>
                                            <span>{formatCurrency(item.value)}</span>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle>{t("salesByOrderType")}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {orderTypeData.map((item) => (
                                        <div key={item.name} className="flex items-center justify-between">
                                            <span className="font-medium">{item.name}</span>
                                            <span>{formatCurrency(item.value)}</span>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
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
