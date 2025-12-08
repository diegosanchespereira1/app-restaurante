import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

// Types
export interface MenuItem {
    id: number
    name: string
    price: number
    description: string
    category: string
    status: "Available" | "Sold Out"
    image: string
}

export interface OrderItem {
    id: number
    name: string
    price: number
    quantity: number
}

export interface Order {
    id: string
    customer: string
    table?: string
    orderType: "dine_in" | "takeout" | "delivery"
    items: OrderItem[]
    total: number
    status: "Pending" | "Preparing" | "Ready" | "Delivered" | "Closed"
    time: string
    closedAt?: string
    notes?: string
    paymentMethod?: "Cash" | "Card" | "Voucher" | "PIX"
}

export interface Table {
    id: number
    number: string
    status: "Available" | "Occupied" | "Reserved"
}

export interface Expense {
    id: number
    description: string
    amount: number
    category: string
    date: string
}

export interface Category {
    id: number
    name: string
}

// Demo data for when Supabase is not configured
const demoMenuItems: MenuItem[] = [
    { id: 1, name: "Margherita Pizza", price: 25.00, description: "Classic tomato and mozzarella", category: "Pizza", status: "Available", image: "" },
    { id: 2, name: "Carbonara Pasta", price: 22.00, description: "Creamy bacon pasta", category: "Pasta", status: "Available", image: "" },
    { id: 3, name: "Caesar Salad", price: 18.00, description: "Fresh romaine with Caesar dressing", category: "Salads", status: "Available", image: "" },
    { id: 4, name: "Tiramisu", price: 12.00, description: "Classic Italian dessert", category: "Desserts", status: "Available", image: "" },
]

const demoTables: Table[] = [
    { id: 1, number: "1", status: "Available" },
    { id: 2, number: "2", status: "Occupied" },
    { id: 3, number: "3", status: "Available" },
    { id: 4, number: "4", status: "Reserved" },
]

const demoCategories: Category[] = [
    { id: 1, name: "Pizza" },
    { id: 2, name: "Pasta" },
    { id: 3, name: "Salads" },
    { id: 4, name: "Desserts" },
]

interface RestaurantContextType {
    menuItems: MenuItem[]
    orders: Order[]
    tables: Table[]
    categories: Category[]
    addOrder: (order: Order) => Promise<{ success: boolean; error?: string }>
    addTable: (tableNumber: string) => Promise<{ success: boolean; error?: string }>
    updateOrderStatus: (orderId: string, status: Order["status"]) => Promise<{ success: boolean; error?: string }>
    updateTableStatus: (tableId: number, status: Table["status"]) => void
    processPayment: (orderId: string, method: "Cash" | "Card" | "Voucher" | "PIX") => Promise<{ success: boolean; error?: string }>
    closeTable: (tableId: number, paymentMethod: "Cash" | "Card" | "Voucher" | "PIX") => Promise<{ success: boolean; error?: string }>
    addMenuItem: (item: Omit<MenuItem, "id">) => Promise<{ success: boolean; error?: string }>
    updateMenuItem: (id: number, item: Partial<MenuItem>) => Promise<{ success: boolean; error?: string }>
    deleteMenuItem: (id: number) => void
    expenses: Expense[]
    addExpense: (expense: Omit<Expense, "id">) => Promise<{ success: boolean; error?: string }>
    deleteExpense: (id: number) => void
    addCategory: (name: string) => Promise<{ success: boolean; error?: string }>
    updateCategory: (id: number, newName: string) => Promise<{ success: boolean; error?: string }>
    deleteCategory: (id: number) => Promise<{ success: boolean; error?: string }>
    generateOrderId: () => string
    isLoading: boolean
    error: string | null
    isDemoMode: boolean
}

const RestaurantContext = createContext<RestaurantContextType | undefined>(undefined)

export function RestaurantProvider({ children }: { children: ReactNode }) {
    const [menuItems, setMenuItems] = useState<MenuItem[]>([])
    const [orders, setOrders] = useState<Order[]>([])
    const [tables, setTables] = useState<Table[]>([])
    const [expenses, setExpenses] = useState<Expense[]>([])
    const [categories, setCategories] = useState<Category[]>([])
    const [nextOrderNumber, setNextOrderNumber] = useState(1)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchData = async () => {
        setIsLoading(true)
        setError(null)

        // Demo mode: use demo data when Supabase is not configured
        if (!isSupabaseConfigured) {
            setMenuItems(demoMenuItems)
            setTables(demoTables)
            setCategories(demoCategories)
            setOrders([])
            setExpenses([])
            setIsLoading(false)
            return
        }

        try {
            // Fetch Menu Items
            console.log("Fetching menu items...")
            const { data: menuData, error: menuError } = await supabase.from('menu_items').select('*').order('id')
            if (menuError) throw menuError
            if (menuData) {
                console.log("Menu items fetched:", menuData)
                setMenuItems(menuData)
            }

            // Fetch Tables
            const { data: tableData, error: tableError } = await supabase.from('restaurant_tables').select('*').order('id')
            if (tableError) throw tableError
            if (tableData) setTables(tableData)

            // Fetch Orders
            const { data: orderData, error: orderError } = await supabase
                .from('orders')
                .select('*, items:order_items(*)')
                .order('created_at', { ascending: false })

            if (orderError) throw orderError

            if (orderData) {
                const formattedOrders: Order[] = orderData.map((o: any) => ({
                    id: o.id,
                    customer: o.customer,
                    table: o.table_number,
                    orderType: o.order_type || 'dine_in',
                    total: o.total,
                    status: o.status,
                    time: new Date(o.created_at).toLocaleString(),
                    closedAt: o.closed_at,
                    notes: o.notes,
                    paymentMethod: o.payment_method,
                    items: o.items.map((i: any) => ({
                        id: i.menu_item_id,
                        name: i.name,
                        price: i.price,
                        quantity: i.quantity
                    }))
                }))
                setOrders(formattedOrders)
            }

            // Fetch Expenses
            const { data: expenseData, error: expenseError } = await supabase.from('expenses').select('*').order('date', { ascending: false })
            if (expenseError) {
                console.error("Error fetching expenses:", expenseError)
            }
            if (expenseData) setExpenses(expenseData)

            // Fetch Categories
            const { data: categoryData, error: categoryError } = await supabase.from('categories').select('*').order('name')
            if (categoryError) {
                console.error("Error fetching categories:", categoryError)
            }
            if (categoryData) setCategories(categoryData)

        } catch (err: any) {
            console.error("Error fetching data:", err)
            setError(err.message || "Failed to load data")
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchData()

        // Skip real-time subscriptions in demo mode
        if (!isSupabaseConfigured) {
            return
        }

        // Real-time subscriptions
        const channels = supabase
            .channel('custom-all-channel')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'orders' },
                () => { fetchData() }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'restaurant_tables' },
                () => { fetchData() }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'menu_items' },
                () => { fetchData() }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'expenses' },
                () => { fetchData() }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'categories' },
                () => { fetchData() }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channels)
        }
    }, [])

    const addOrder = async (order: Order) => {
        // Optimistic update
        setOrders((prev) => [order, ...prev])

        // Demo mode: just use local state
        if (!isSupabaseConfigured) {
            // Update Table Status
            if (order.table) {
                const table = tables.find(t => t.number === order.table)
                if (table) {
                    updateTableStatus(table.id, "Occupied")
                }
            }
            return { success: true }
        }

        // Insert Order
        const { error: orderError } = await supabase.from('orders').insert({
            id: order.id,
            customer: order.customer,
            table_number: order.table,
            order_type: order.orderType,
            total: order.total,
            status: order.status,
            created_at: new Date().toISOString(),
            notes: order.notes
        })

        if (orderError) {
            console.error("Error adding order:", orderError)
            // Revert optimistic update
            setOrders((prev) => prev.filter((o) => o.id !== order.id))
            return { success: false, error: orderError.message }
        }

        // Insert Order Items
        const orderItems = order.items.map(item => ({
            order_id: order.id,
            menu_item_id: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity
        }))

        const { error: itemsError } = await supabase.from('order_items').insert(orderItems)
        if (itemsError) {
            console.error("Error adding items:", itemsError)
            // We might want to delete the order if items fail, but for now just report error
            return { success: false, error: itemsError.message }
        }

        // Update Table Status
        if (order.table) {
            const table = tables.find(t => t.number === order.table)
            if (table) {
                updateTableStatus(table.id, "Occupied")
            }
        }
        return { success: true }
    }

    const updateOrderStatus = async (orderId: string, status: Order["status"]) => {
        // Optimistic update
        const previousOrders = [...orders]
        setOrders((prev) =>
            prev.map((order) => (order.id === orderId ? { ...order, status } : order))
        )

        // Demo mode: just use local state
        if (!isSupabaseConfigured) {
            return { success: true }
        }

        const { error } = await supabase.from('orders').update({ status }).eq('id', orderId)
        if (error) {
            console.error("Error updating order status:", error)
            setOrders(previousOrders)
            return { success: false, error: error.message }
        }
        return { success: true }
    }

    const addTable = async (tableNumber: string) => {
        // Demo mode: just use local state
        if (!isSupabaseConfigured) {
            const newTable: Table = {
                id: Date.now(),
                number: tableNumber,
                status: 'Available'
            }
            setTables(prev => [...prev, newTable])
            return { success: true }
        }

        const { data, error } = await supabase
            .from('restaurant_tables')
            .insert({ number: tableNumber, status: 'Available' })
            .select()

        if (data) {
            setTables(prev => [...prev, data[0]])
            return { success: true }
        }
        if (error) {
            console.error("Error adding table:", error)
            return { success: false, error: error.message }
        }
        return { success: false, error: "Unknown error occurred" }
    }

    const updateTableStatus = async (tableId: number, status: Table["status"]) => {
        setTables((prev) =>
            prev.map((table) => (table.id === tableId ? { ...table, status } : table))
        )
        // Demo mode: just use local state
        if (!isSupabaseConfigured) {
            return
        }
        await supabase.from('restaurant_tables').update({ status }).eq('id', tableId)
    }

    const processPayment = async (orderId: string, method: "Cash" | "Card" | "Voucher" | "PIX") => {
        const now = new Date().toISOString()
        const previousOrders = [...orders]

        setOrders((prev) =>
            prev.map((order) => {
                if (order.id === orderId) {
                    return { ...order, status: "Closed", paymentMethod: method, closedAt: now }
                }
                return order
            })
        )

        // Demo mode: just use local state
        if (!isSupabaseConfigured) {
            // Check table status logic
            const order = orders.find(o => o.id === orderId)
            if (order && order.table) {
                const otherActiveOrders = orders.filter(o =>
                    o.table === order.table &&
                    o.id !== orderId &&
                    o.status !== "Closed"
                )

                if (otherActiveOrders.length === 0) {
                    const table = tables.find(t => t.number === order.table)
                    if (table) {
                        updateTableStatus(table.id, "Available")
                    }
                }
            }
            return { success: true }
        }

        const { error } = await supabase.from('orders').update({
            status: 'Closed',
            payment_method: method,
            closed_at: now
        }).eq('id', orderId)

        if (error) {
            console.error("Error processing payment:", error)
            setOrders(previousOrders)
            return { success: false, error: error.message }
        }

        // Check table status logic
        const order = orders.find(o => o.id === orderId)
        if (order && order.table) {
            const otherActiveOrders = orders.filter(o =>
                o.table === order.table &&
                o.id !== orderId &&
                o.status !== "Closed"
            )

            if (otherActiveOrders.length === 0) {
                const table = tables.find(t => t.number === order.table)
                if (table) {
                    updateTableStatus(table.id, "Available")
                }
            }
        }
        return { success: true }
    }

    const closeTable = async (tableId: number, method: "Cash" | "Card" | "Voucher" | "PIX") => {
        const table = tables.find(t => t.id === tableId)
        if (!table) return { success: false, error: "Table not found" }

        const now = new Date().toISOString()
        const previousOrders = [...orders]

        setOrders(prev => prev.map(order => {
            if (order.table === table.number && order.status !== "Closed") {
                return { ...order, status: "Closed", paymentMethod: method, closedAt: now }
            }
            return order
        }))

        // Demo mode: just use local state
        if (!isSupabaseConfigured) {
            updateTableStatus(tableId, "Available")
            return { success: true }
        }

        // Update DB
        const { data: activeOrders, error: fetchError } = await supabase
            .from('orders')
            .select('id')
            .eq('table_number', table.number)
            .neq('status', 'Closed')

        if (fetchError) {
            console.error("Error fetching active orders:", fetchError)
            setOrders(previousOrders)
            return { success: false, error: fetchError.message }
        }

        if (activeOrders && activeOrders.length > 0) {
            const orderIds = activeOrders.map((o: any) => o.id)
            const { error: updateError } = await supabase
                .from('orders')
                .update({ status: 'Closed', payment_method: method, closed_at: now })
                .in('id', orderIds)

            if (updateError) {
                console.error("Error closing orders:", updateError)
                setOrders(previousOrders)
                return { success: false, error: updateError.message }
            }
        }

        updateTableStatus(tableId, "Available")
        return { success: true }
    }

    // Menu CRUD
    const addMenuItem = async (item: Omit<MenuItem, "id">) => {
        // Demo mode: just use local state
        if (!isSupabaseConfigured) {
            const newItem: MenuItem = { ...item, id: Date.now() }
            setMenuItems(prev => [...prev, newItem])
            return { success: true }
        }

        const { data, error } = await supabase.from('menu_items').insert(item).select()
        if (data) {
            setMenuItems(prev => [...prev, data[0]])
            return { success: true }
        }
        if (error) {
            console.error("Error adding menu item:", error)
            return { success: false, error: error.message }
        }
        return { success: false, error: "Unknown error occurred" }
    }

    const updateMenuItem = async (id: number, item: Partial<MenuItem>) => {
        const previousItems = [...menuItems]
        setMenuItems(prev => prev.map(i => i.id === id ? { ...i, ...item } : i))

        // Demo mode: just use local state
        if (!isSupabaseConfigured) {
            return { success: true }
        }

        const { error } = await supabase.from('menu_items').update(item).eq('id', id)

        if (error) {
            console.error("Error updating menu item:", error)
            setMenuItems(previousItems) // Revert optimistic update
            return { success: false, error: error.message }
        }
        return { success: true }
    }

    const deleteMenuItem = async (id: number) => {
        setMenuItems(prev => prev.filter(i => i.id !== id))
        // Demo mode: just use local state
        if (!isSupabaseConfigured) {
            return
        }
        const { error } = await supabase.from('menu_items').delete().eq('id', id)
        if (error) console.error("Error deleting menu item:", error)
    }

    // Expenses CRUD
    const addExpense = async (expense: Omit<Expense, "id">) => {
        // Optimistic update
        const tempId = Date.now()
        const tempExpense = { ...expense, id: tempId }
        setExpenses(prev => [tempExpense, ...prev])

        // Demo mode: just use local state
        if (!isSupabaseConfigured) {
            return { success: true }
        }

        const { data, error } = await supabase.from('expenses').insert(expense).select()

        if (data) {
            // Replace temp with real
            setExpenses(prev => prev.map(e => e.id === tempId ? data[0] : e))
            return { success: true }
        }

        if (error) {
            console.error("Error adding expense:", error)
            // Revert optimistic
            setExpenses(prev => prev.filter(e => e.id !== tempId))
            return { success: false, error: error.message }
        }
        return { success: false, error: "Unknown error" }
    }

    const deleteExpense = async (id: number) => {
        setExpenses(prev => prev.filter(e => e.id !== id))
        // Demo mode: just use local state
        if (!isSupabaseConfigured) {
            return
        }
        const { error } = await supabase.from('expenses').delete().eq('id', id)
        if (error) console.error("Error deleting expense:", error)
    }

    // Categories CRUD
    const addCategory = async (name: string) => {
        // Demo mode: just use local state
        if (!isSupabaseConfigured) {
            const newCategory: Category = { id: Date.now(), name }
            setCategories(prev => [...prev, newCategory])
            return { success: true }
        }

        const { data, error } = await supabase.from('categories').insert({ name }).select()
        if (data) {
            setCategories(prev => [...prev, data[0]])
            return { success: true }
        }
        if (error) {
            console.error("Error adding category:", error)
            return { success: false, error: error.message }
        }
        return { success: false, error: "Unknown error" }
    }

    const updateCategory = async (id: number, newName: string) => {
        const oldCategory = categories.find(c => c.id === id)
        if (!oldCategory) return { success: false, error: "Category not found" }

        // Optimistic update
        setCategories(prev => prev.map(c => c.id === id ? { ...c, name: newName } : c))
        setMenuItems(prev => prev.map(i => i.category === oldCategory.name ? { ...i, category: newName } : i))

        // Demo mode: just use local state
        if (!isSupabaseConfigured) {
            return { success: true }
        }

        // Update category name in DB
        const { error: catError } = await supabase.from('categories').update({ name: newName }).eq('id', id)

        if (catError) {
            console.error("Error updating category:", catError)
            // Revert optimistic update (simplified, might need full revert logic)
            setCategories(prev => prev.map(c => c.id === id ? oldCategory : c))
            setMenuItems(prev => prev.map(i => i.category === newName ? { ...i, category: oldCategory.name } : i))
            return { success: false, error: catError.message }
        }

        // Update menu items to use new category name
        const { error: menuError } = await supabase
            .from('menu_items')
            .update({ category: newName })
            .eq('category', oldCategory.name)

        if (menuError) {
            console.error("Error updating menu items category:", menuError)
            // This is tricky to revert fully without a transaction, but we can try
            return { success: false, error: "Category renamed but failed to update menu items: " + menuError.message }
        }

        return { success: true }
    }

    const deleteCategory = async (id: number) => {
        setCategories(prev => prev.filter(c => c.id !== id))
        // Demo mode: just use local state
        if (!isSupabaseConfigured) {
            return { success: true }
        }
        const { error } = await supabase.from('categories').delete().eq('id', id)
        if (error) {
            console.error("Error deleting category:", error)
            return { success: false, error: error.message }
        }
        return { success: true }
    }

    const generateOrderId = () => {
        const orderNumber = nextOrderNumber.toString().padStart(2, '0')
        setNextOrderNumber(prev => prev + 1)
        return orderNumber
    }

    return (
        <RestaurantContext.Provider
            value={{
                menuItems,
                orders,
                tables,
                addOrder,
                addTable,
                updateOrderStatus,
                updateTableStatus,
                processPayment,
                closeTable,
                addMenuItem,
                updateMenuItem,
                deleteMenuItem,
                expenses,
                addExpense,
                deleteExpense,
                categories,
                addCategory,
                updateCategory,
                deleteCategory,
                generateOrderId,
                isLoading,
                error,
                isDemoMode: !isSupabaseConfigured
            }}
        >
            {children}
        </RestaurantContext.Provider>
    )
}

export function useRestaurant() {
    const context = useContext(RestaurantContext)
    if (context === undefined) {
        throw new Error("useRestaurant must be used within a RestaurantProvider")
    }
    return context
}
