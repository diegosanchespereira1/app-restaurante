import { useState } from "react"
import { Button } from "../components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Plus } from "lucide-react"
import { Badge } from "../components/ui/badge"
import { useNavigate } from "react-router-dom"
import { useRestaurant } from "../context/RestaurantContext"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "../components/ui/dialog"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { useLanguage } from "../context/LanguageContext"

import { formatCurrency } from "../lib/utils"

export function Tables() {
    const navigate = useNavigate()
    const { tables, orders, addTable, isLoading: isTablesLoading, error: tablesError } = useRestaurant()
    const { t } = useLanguage()
    const [isAddTableOpen, setIsAddTableOpen] = useState(false)
    const [newTableNumber, setNewTableNumber] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState("")

    const handleAddTable = async () => {
        setError("")
        if (newTableNumber.trim()) {
            setIsLoading(true)
            try {
                const result = await addTable(newTableNumber)
                if (result.success) {
                    setNewTableNumber("")
                    setIsAddTableOpen(false)
                } else {
                    setError(result.error || "Failed to add table")
                }
            } catch (err) {
                setError("An unexpected error occurred")
            } finally {
                setIsLoading(false)
            }
        }
    }

    const getTableStats = (tableNumber: string) => {
        const activeOrders = orders.filter(o => o.table === tableNumber && o.status !== "Closed")
        const totalAmount = activeOrders.reduce((sum, o) => sum + o.total, 0)
        return { count: activeOrders.length, total: totalAmount }
    }

    if (isTablesLoading) {
        return <div className="flex justify-center items-center h-64">Loading tables...</div>
    }

    if (tablesError) {
        return <div className="text-destructive text-center p-8">Error loading tables: {tablesError}</div>
    }

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">{t("tables")}</h2>
                    <p className="text-muted-foreground">{t("manageTables")}</p>
                </div>
                <Dialog open={isAddTableOpen} onOpenChange={setIsAddTableOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="mr-2 h-4 w-4" /> {t("addTable")}
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{t("addNewTable")}</DialogTitle>
                            <DialogDescription>
                                {t("enterTableNumber")}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            {error && (
                                <div className="bg-destructive/15 text-destructive text-sm p-3 rounded-md">
                                    {error}
                                </div>
                            )}
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="number" className="text-right">
                                    {t("number")}
                                </Label>
                                <Input
                                    id="number"
                                    value={newTableNumber}
                                    onChange={(e) => setNewTableNumber(e.target.value)}
                                    className="col-span-3"
                                    placeholder="e.g. T10"
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button onClick={handleAddTable} disabled={isLoading}>
                                {isLoading ? "Adding..." : t("addTable")}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {tables.map((table) => {
                    const stats = getTableStats(table.number)
                    return (
                        <Card
                            key={table.id}
                            className={`cursor-pointer hover:border-primary transition-colors ${table.status === "Occupied" ? "border-orange-500/50 bg-orange-500/5" : ""}`}
                            onClick={() => navigate(`/tables/${table.id}`)}
                        >
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-xl font-bold">{table.number}</CardTitle>
                                <Badge
                                    variant={
                                        table.status === "Available" ? "success" :
                                            table.status === "Occupied" ? "destructive" : "secondary"
                                    }
                                >
                                    {t(table.status.toLowerCase() as any) || table.status}
                                </Badge>
                            </CardHeader>
                            <CardContent>
                                <div className="mt-4 space-y-2">
                                    {table.status === "Occupied" ? (
                                        <>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-muted-foreground">{t("activeOrders")}</span>
                                                <span className="font-medium">{stats.count}</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-muted-foreground">{t("currentBill")}</span>
                                                <span className="font-bold text-lg">{formatCurrency(stats.total)}</span>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="text-sm text-muted-foreground py-2">
                                            {t("readyForCustomers")}
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    )
                })}
            </div>
        </div>
    )
}
