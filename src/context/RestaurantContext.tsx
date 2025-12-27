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
    addMenuItem: (item: Omit<MenuItem, "id">) => Promise<{ success: boolean; error?: string; data?: MenuItem }>
    updateMenuItem: (id: number, item: Partial<MenuItem>) => Promise<{ success: boolean; error?: string }>
    deleteMenuItem: (id: number) => Promise<{ success: boolean; error?: string }>
    expenses: Expense[]
    addExpense: (expense: Omit<Expense, "id">) => Promise<{ success: boolean; error?: string }>
    deleteExpense: (id: number) => void
    addCategory: (name: string) => Promise<{ success: boolean; error?: string }>
    updateCategory: (id: number, newName: string) => Promise<{ success: boolean; error?: string }>
    deleteCategory: (id: number) => Promise<{ success: boolean; error?: string }>
    generateOrderId: () => Promise<string>
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
            console.log('Demo mode: Fetching demo data...')
            setMenuItems(demoMenuItems)
            setTables(demoTables)
            setCategories(demoCategories)
            // In demo mode, keep existing orders or set empty if none exist
            if (orders.length === 0) {
                setOrders([])
            }
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
                
                // Calcular o próximo número de pedido baseado no maior ID existente
                const numericIds = formattedOrders
                    .map(o => {
                        const num = parseInt(o.id, 10)
                        return isNaN(num) ? 0 : num
                    })
                    .filter(id => id > 0)
                
                if (numericIds.length > 0) {
                    const maxId = Math.max(...numericIds)
                    setNextOrderNumber(maxId + 1)
                }
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

        // Real-time subscriptions for Supabase mode
        if (isSupabaseConfigured) {
            console.log('Setting up real-time subscriptions...')
            // Real-time subscriptions
            const channels = supabase
                .channel('restaurant-updates')
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'orders' },
                    (payload) => {
                        console.log('Real-time order update detected:', payload)
                        fetchData() // Refresh data when orders change
                    }
                )
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'restaurant_tables' },
                    (payload) => {
                        console.log('Real-time table update detected:', payload)
                        fetchData() // Refresh data when tables change
                    }
                )
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'menu_items' },
                    (payload) => {
                        console.log('Real-time menu update detected:', payload)
                        fetchData() // Refresh data when menu changes
                    }
                )
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'expenses' },
                    (payload) => {
                        console.log('Real-time expense update detected:', payload)
                        fetchData() // Refresh data when expenses change
                    }
                )
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'categories' },
                    (payload) => {
                        console.log('Real-time category update detected:', payload)
                        fetchData() // Refresh data when categories change
                    }
                )
                .subscribe((status) => {
                    console.log('Real-time subscription status:', status)
                })

            return () => {
                console.log('Cleaning up real-time subscriptions')
                supabase.removeChannel(channels)
            }
        } else {
            // Demo mode: polling for updates every 10 seconds
            console.log('Demo mode: Starting polling for updates (10s interval)')
            const pollInterval = setInterval(() => {
                console.log('Demo mode: Polling for updates...')
                fetchData()
            }, 10000) // Poll every 10 seconds in demo mode

            return () => {
                console.log('Cleaning up demo mode polling')
                clearInterval(pollInterval)
            }
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
        console.log(`Updating order ${orderId} to status: ${status}`)
        
        // Optimistic update
        const previousOrders = [...orders]
        setOrders((prev) =>
            prev.map((order) => (order.id === orderId ? { ...order, status } : order))
        )

        // Demo mode: just use local state
        if (!isSupabaseConfigured) {
            console.log('Demo mode: Order status updated locally')
            return { success: true }
        }

        const { error } = await supabase.from('orders').update({ status }).eq('id', orderId)
        if (error) {
            console.error("Error updating order status:", error)
            setOrders(previousOrders)
            return { success: false, error: error.message }
        }
        console.log('Order status updated successfully in database')
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
        const order = orders.find(o => o.id === orderId)

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

        // Reduce stock for order items
        if (order) {
            try {
                // Get current user for stock movement
                const { data: { user } } = await supabase.auth.getUser()

                // For each item in the order, find matching inventory item and reduce stock
                for (const orderItem of order.items) {
                    // Try to find inventory item by menu_item_id or by name
                    const { data: inventoryItems } = await supabase
                        .from('inventory_items')
                        .select('id')
                        .or(`menu_item_id.eq.${orderItem.id},name.ilike.%${orderItem.name}%`)
                        .limit(1)

                    if (inventoryItems && inventoryItems.length > 0) {
                        const inventoryItemId = inventoryItems[0].id

                        // Create stock movement (exit)
                        await supabase.from('stock_movements').insert({
                            inventory_item_id: inventoryItemId,
                            movement_type: 'exit',
                            quantity: orderItem.quantity,
                            reference_id: parseInt(orderId.replace(/\D/g, '')) || null,
                            reference_type: 'order',
                            notes: `Saída via pedido ${orderId}`,
                            created_by: user?.id || null
                        })
                    }
                }
            } catch (stockError) {
                console.error("Error reducing stock:", stockError)
                // Don't fail the payment if stock reduction fails
            }
        }

        // Check table status logic
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

    const closeTable = async (tableId: number, paymentMethod: "Cash" | "Card" | "Voucher" | "PIX") => {
        const table = tables.find(t => t.id === tableId)
        if (!table) return { success: false, error: "Table not found" }

        const now = new Date().toISOString()
        const previousOrders = [...orders]

        setOrders(prev => prev.map(order => {
            if (order.table === table.number && order.status !== "Closed") {
                return { ...order, status: "Closed", paymentMethod: paymentMethod, closedAt: now }
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
                .update({ status: 'Closed', payment_method: paymentMethod, closed_at: now })
                .in('id', orderIds)

            if (updateError) {
                console.error("Error closing orders:", updateError)
                setOrders(previousOrders)
                return { success: false, error: updateError.message }
            }

            // Reduce stock for all closed orders
            try {
                const { data: { user } } = await supabase.auth.getUser()

                // Fetch full orders with items
                const { data: ordersData, error: ordersError } = await supabase
                    .from('orders')
                    .select('*, items:order_items(*)')
                    .in('id', orderIds)

                if (ordersError) {
                    console.error("Error fetching orders for stock reduction:", ordersError)
                } else if (ordersData) {
                    const tableOrders: Order[] = ordersData.map((o: any) => ({
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

                    for (const order of tableOrders) {
                        for (const orderItem of order.items) {
                            // Try to find inventory item by menu_item_id or by name
                            const { data: inventoryItems } = await supabase
                                .from('inventory_items')
                                .select('id')
                                .or(`menu_item_id.eq.${orderItem.id},name.ilike.%${orderItem.name}%`)
                                .limit(1)

                            if (inventoryItems && inventoryItems.length > 0) {
                                const inventoryItemId = inventoryItems[0].id

                                // Create stock movement (exit)
                                await supabase.from('stock_movements').insert({
                                    inventory_item_id: inventoryItemId,
                                    movement_type: 'exit',
                                    quantity: orderItem.quantity,
                                    reference_id: parseInt(order.id.replace(/\D/g, '')) || null,
                                    reference_type: 'order',
                                    notes: `Saída via pedido ${order.id} (fechamento de mesa)`,
                                    created_by: user?.id || null
                                })
                            }
                        }
                    }
                }
            } catch (stockError) {
                console.error("Error reducing stock:", stockError)
                // Don't fail the table close if stock reduction fails
            }
        }

        updateTableStatus(tableId, "Available")
        return { success: true }
    }

    // Menu CRUD
    const addMenuItem = async (item: Omit<MenuItem, "id">): Promise<{ success: boolean; error?: string; data?: MenuItem }> => {
        // Demo mode: just use local state
        if (!isSupabaseConfigured) {
            const newItem: MenuItem = { ...item, id: Date.now() }
            setMenuItems(prev => [...prev, newItem])
            return { success: true, data: newItem }
        }

        const { data, error } = await supabase.from('menu_items').insert(item).select().single()
        if (data) {
            setMenuItems(prev => [...prev, data])
            return { success: true, data }
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

        try {
            const { error } = await supabase.from('menu_items').update(item).eq('id', id)

            if (error) {
                console.error("Error updating menu item:", error)
                setMenuItems(previousItems) // Revert optimistic update
                
                // Tratar erro de foreign key de forma mais amigável
                if (error.message?.includes('foreign key constraint') || 
                    error.message?.includes('violates foreign key')) {
                    return { 
                        success: false, 
                        error: 'Não é possível editar este item porque ele está sendo usado em pedidos existentes. Você pode criar um novo item ou aguardar que os pedidos sejam finalizados.' 
                    }
                }
                
                return { success: false, error: error.message }
            }
            return { success: true }
        } catch (err: any) {
            setMenuItems(previousItems) // Revert optimistic update
            console.error("Error updating menu item:", err)
            
            if (err.message?.includes('foreign key constraint') || 
                err.message?.includes('violates foreign key')) {
                return { 
                    success: false, 
                    error: 'Não é possível editar este item porque ele está sendo usado em pedidos existentes. Você pode criar um novo item ou aguardar que os pedidos sejam finalizados.' 
                }
            }
            
            return { success: false, error: err.message || 'Erro ao atualizar item' }
        }
    }

    const deleteMenuItem = async (id: number): Promise<{ success: boolean; error?: string }> => {
        // Optimistic update
        const previousItems = [...menuItems]
        setMenuItems(prev => prev.filter(i => i.id !== id))
        
        // Demo mode: just use local state
        if (!isSupabaseConfigured) {
            return { success: true }
        }
        
        try {
            const { error } = await supabase.from('menu_items').delete().eq('id', id)
            if (error) {
                // Revert optimistic update on error
                setMenuItems(previousItems)
                console.error("Error deleting menu item:", error)
                return { success: false, error: error.message }
            }
            return { success: true }
        } catch (err: any) {
            // Revert optimistic update on error
            setMenuItems(previousItems)
            console.error("Error deleting menu item:", err)
            return { success: false, error: err.message || 'Erro ao excluir item' }
        }
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

    const generateOrderId = async (): Promise<string> => {
        // Se Supabase está configurado, buscar o próximo ID do banco
        if (isSupabaseConfigured) {
            try {
                // Buscar o maior ID numérico existente
                const { data: orderData, error } = await supabase
                    .from('orders')
                    .select('id')
                    .order('created_at', { ascending: false })
                    .limit(1000) // Limitar para performance
                
                if (!error && orderData && orderData.length > 0) {
                    const numericIds = orderData
                        .map(o => {
                            const num = parseInt(o.id, 10)
                            return isNaN(num) ? 0 : num
                        })
                        .filter(id => id > 0)
                    
                    if (numericIds.length > 0) {
                        const maxId = Math.max(...numericIds)
                        const nextId = maxId + 1
                        setNextOrderNumber(nextId + 1) // Atualizar para próximo
                        return nextId.toString().padStart(4, '0')
                    }
                }
                
                // Se não há pedidos ou nenhum ID numérico, começar do 1
                setNextOrderNumber(2)
                return "0001"
            } catch (err) {
                console.error('Error generating order ID:', err)
                // Fallback: usar timestamp + random para garantir unicidade
                const timestamp = Date.now().toString().slice(-8) // Últimos 8 dígitos
                const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
                return `${timestamp}${random}`
            }
        }
        
        // Demo mode ou fallback: usar contador local
        const orderNumber = nextOrderNumber.toString().padStart(4, '0')
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
