import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import type {
  InventoryItem,
  PurchaseInvoice,
  StockMovement,
  CreateInventoryItemInput,
  CreatePurchaseInvoiceInput,
  CreateStockMovementInput
} from '../types/stock'

interface StockContextType {
  // State
  inventoryItems: InventoryItem[]
  purchaseInvoices: PurchaseInvoice[]
  stockMovements: StockMovement[]
  isLoading: boolean
  error: string | null

  // Inventory Items
  fetchInventoryItems: () => Promise<void>
  addInventoryItem: (item: CreateInventoryItemInput) => Promise<{ success: boolean; error?: string; data?: InventoryItem }>
  updateInventoryItem: (id: number, updates: Partial<CreateInventoryItemInput>) => Promise<{ success: boolean; error?: string }>
  deleteInventoryItem: (id: number) => Promise<{ success: boolean; error?: string }>

  // Purchase Invoices
  fetchPurchaseInvoices: () => Promise<void>
  addPurchaseInvoice: (invoice: CreatePurchaseInvoiceInput) => Promise<{ success: boolean; error?: string; data?: PurchaseInvoice }>
  updatePurchaseInvoice: (id: number, updates: Partial<CreatePurchaseInvoiceInput>) => Promise<{ success: boolean; error?: string }>
  deletePurchaseInvoice: (id: number) => Promise<{ success: boolean; error?: string }>

  // Stock Movements
  fetchStockMovements: (itemId?: number) => Promise<void>
  addStockMovement: (movement: CreateStockMovementInput) => Promise<{ success: boolean; error?: string; data?: StockMovement }>

  // Utilities
  getInventoryItemById: (id: number) => InventoryItem | undefined
  getLowStockItems: () => InventoryItem[]
}

const StockContext = createContext<StockContextType | undefined>(undefined)

export function StockProvider({ children }: { children: ReactNode }) {
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [purchaseInvoices, setPurchaseInvoices] = useState<PurchaseInvoice[]>([])
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch Inventory Items
  const fetchInventoryItems = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setInventoryItems([])
      setIsLoading(false)
      return
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('inventory_items')
        .select('*')
        .order('name')

      if (fetchError) throw fetchError
      setInventoryItems(data || [])
    } catch (err: any) {
      console.error('Error fetching inventory items:', err)
      setError(err.message || 'Erro ao carregar itens de estoque')
    }
  }, [])

  // Fetch Purchase Invoices
  const fetchPurchaseInvoices = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setPurchaseInvoices([])
      return
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('purchase_invoices')
        .select('*')
        .order('invoice_date', { ascending: false })

      if (fetchError) throw fetchError
      setPurchaseInvoices(data || [])
    } catch (err: any) {
      console.error('Error fetching purchase invoices:', err)
      setError(err.message || 'Erro ao carregar notas fiscais')
    }
  }, [])

  // Fetch Stock Movements
  const fetchStockMovements = useCallback(async (itemId?: number) => {
    if (!isSupabaseConfigured) {
      setStockMovements([])
      return
    }

    try {
      let query = supabase
        .from('stock_movements')
        .select('*')
        .order('created_at', { ascending: false })

      if (itemId) {
        query = query.eq('inventory_item_id', itemId)
      }

      const { data, error: fetchError } = await query

      if (fetchError) throw fetchError
      setStockMovements(data || [])
    } catch (err: any) {
      console.error('Error fetching stock movements:', err)
      setError(err.message || 'Erro ao carregar movimentações')
    }
  }, [])

  // Add Inventory Item
  const addInventoryItem = async (item: CreateInventoryItemInput): Promise<{ success: boolean; error?: string; data?: InventoryItem }> => {
    if (!isSupabaseConfigured) {
      return { success: false, error: 'Supabase não configurado' }
    }

    try {
      // Build insert object, only including defined values
      const insertData: any = {
        name: item.name,
        unit: item.unit || 'UN',
        min_stock: item.min_stock ?? 0,
        current_stock: item.current_stock ?? 0,
        cost_price: item.cost_price ?? null,
        selling_price: item.selling_price ?? null,
        category: item.category || null,
        menu_item_id: item.menu_item_id || null,
        product_type: item.product_type || null,
        ncm: item.ncm || null,
        cst_icms: item.cst_icms || null,
        cfop: item.cfop || null,
        icms_rate: item.icms_rate ?? null,
        ipi_rate: item.ipi_rate ?? null,
        ean_code: item.ean_code || null
      }

      // Only include image if it's provided (avoid schema cache issues)
      if (item.image) {
        insertData.image = item.image
      }

      const { data, error: insertError } = await supabase
        .from('inventory_items')
        .insert(insertData)
        .select()
        .single()

      if (insertError) {
        // If error is about image column, try again without it
        if (insertError.message?.includes("'image' column")) {
          delete insertData.image
          const { data: retryData, error: retryError } = await supabase
            .from('inventory_items')
            .insert(insertData)
            .select()
            .single()
          
          if (retryError) throw retryError
          
          setInventoryItems(prev => [...prev, retryData])
          return { success: true, data: retryData }
        }
        throw insertError
      }

      setInventoryItems(prev => [...prev, data])
      return { success: true, data }
    } catch (err: any) {
      console.error('Error adding inventory item:', err)
      return { success: false, error: err.message || 'Erro ao adicionar item' }
    }
  }

  // Update Inventory Item
  const updateInventoryItem = async (id: number, updates: Partial<CreateInventoryItemInput>): Promise<{ success: boolean; error?: string }> => {
    if (!isSupabaseConfigured) {
      return { success: false, error: 'Supabase não configurado' }
    }

    try {
      // Build update object, filtering out undefined values
      const updateData: any = {}
      
      if (updates.name !== undefined) updateData.name = updates.name
      if (updates.unit !== undefined) updateData.unit = updates.unit
      if (updates.min_stock !== undefined) updateData.min_stock = updates.min_stock
      if (updates.current_stock !== undefined) updateData.current_stock = updates.current_stock
      if (updates.cost_price !== undefined) updateData.cost_price = updates.cost_price ?? null
      if (updates.selling_price !== undefined) updateData.selling_price = updates.selling_price ?? null
      if (updates.category !== undefined) updateData.category = updates.category || null
      if (updates.menu_item_id !== undefined) updateData.menu_item_id = updates.menu_item_id || null
      if (updates.product_type !== undefined) updateData.product_type = updates.product_type || null
      if (updates.ncm !== undefined) updateData.ncm = updates.ncm || null
      if (updates.cst_icms !== undefined) updateData.cst_icms = updates.cst_icms || null
      if (updates.cfop !== undefined) updateData.cfop = updates.cfop || null
      if (updates.icms_rate !== undefined) updateData.icms_rate = updates.icms_rate ?? null
      if (updates.ipi_rate !== undefined) updateData.ipi_rate = updates.ipi_rate ?? null
      if (updates.ean_code !== undefined) updateData.ean_code = updates.ean_code || null

      // Only include image if it's provided (avoid schema cache issues)
      if (updates.image !== undefined && updates.image !== null) {
        updateData.image = updates.image
      }

      const { error: updateError } = await supabase
        .from('inventory_items')
        .update(updateData)
        .eq('id', id)

      if (updateError) {
        // If error is about image column, try again without it
        if (updateError.message?.includes("'image' column")) {
          delete updateData.image
          const { error: retryError } = await supabase
            .from('inventory_items')
            .update(updateData)
            .eq('id', id)
          
          if (retryError) throw retryError
          
          await fetchInventoryItems()
          return { success: true }
        }
        throw updateError
      }

      await fetchInventoryItems()
      return { success: true }
    } catch (err: any) {
      console.error('Error updating inventory item:', err)
      return { success: false, error: err.message || 'Erro ao atualizar item' }
    }
  }

  // Delete Inventory Item
  const deleteInventoryItem = async (id: number): Promise<{ success: boolean; error?: string }> => {
    if (!isSupabaseConfigured) {
      return { success: false, error: 'Supabase não configurado' }
    }

    try {
      const { error: deleteError } = await supabase
        .from('inventory_items')
        .delete()
        .eq('id', id)

      if (deleteError) throw deleteError

      setInventoryItems(prev => prev.filter(item => item.id !== id))
      return { success: true }
    } catch (err: any) {
      console.error('Error deleting inventory item:', err)
      return { success: false, error: err.message || 'Erro ao deletar item' }
    }
  }

  // Add Purchase Invoice
  const addPurchaseInvoice = async (invoice: CreatePurchaseInvoiceInput): Promise<{ success: boolean; error?: string; data?: PurchaseInvoice }> => {
    if (!isSupabaseConfigured) {
      return { success: false, error: 'Supabase não configurado' }
    }

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()

      // Insert invoice
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('purchase_invoices')
        .insert({
          invoice_number: invoice.invoice_number,
          invoice_series: invoice.invoice_series,
          nfe_key: invoice.nfe_key,
          supplier_name: invoice.supplier_name,
          supplier_cnpj: invoice.supplier_cnpj,
          supplier_address: invoice.supplier_address,
          invoice_date: invoice.invoice_date,
          total_amount: invoice.total_amount,
          xml_file_path: invoice.xml_file_path,
          xml_content: invoice.xml_content,
          notes: invoice.notes,
          created_by: user?.id || null
        })
        .select()
        .single()

      if (invoiceError) throw invoiceError

      // Insert invoice items
      const invoiceItems = invoice.items.map(item => ({
        invoice_id: invoiceData.id,
        inventory_item_id: item.inventory_item_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit: item.unit || 'UN',
        unit_price: item.unit_price,
        total_price: item.total_price
      }))

      const { error: itemsError } = await supabase
        .from('invoice_items')
        .insert(invoiceItems)

      if (itemsError) throw itemsError

      // Create stock movements for each item that has inventory_item_id
      // Try to match items by name if inventory_item_id is null
      for (const item of invoice.items) {
        let inventoryItemId = item.inventory_item_id

        // If no inventory_item_id, try to find by product name
        if (!inventoryItemId) {
          const { data: matchingItems } = await supabase
            .from('inventory_items')
            .select('id')
            .ilike('name', `%${item.product_name}%`)
            .limit(1)

          if (matchingItems && matchingItems.length > 0) {
            inventoryItemId = matchingItems[0].id
          }
        }

        // Only create movement if we have a valid inventory_item_id
        if (inventoryItemId) {
          await addStockMovement({
            inventory_item_id: inventoryItemId,
            movement_type: 'entry',
            quantity: item.quantity,
            reference_id: invoiceData.id,
            reference_type: 'invoice',
            notes: `Entrada via nota fiscal ${invoice.invoice_number}`
          })
        }
      }

      await fetchPurchaseInvoices()
      return { success: true, data: invoiceData }
    } catch (err: any) {
      console.error('Error adding purchase invoice:', err)
      return { success: false, error: err.message || 'Erro ao adicionar nota fiscal' }
    }
  }

  // Update Purchase Invoice
  const updatePurchaseInvoice = async (id: number, updates: Partial<CreatePurchaseInvoiceInput>): Promise<{ success: boolean; error?: string }> => {
    if (!isSupabaseConfigured) {
      return { success: false, error: 'Supabase não configurado' }
    }

    try {
      const { error: updateError } = await supabase
        .from('purchase_invoices')
        .update(updates)
        .eq('id', id)

      if (updateError) throw updateError

      await fetchPurchaseInvoices()
      return { success: true }
    } catch (err: any) {
      console.error('Error updating purchase invoice:', err)
      return { success: false, error: err.message || 'Erro ao atualizar nota fiscal' }
    }
  }

  // Delete Purchase Invoice
  const deletePurchaseInvoice = async (id: number): Promise<{ success: boolean; error?: string }> => {
    if (!isSupabaseConfigured) {
      return { success: false, error: 'Supabase não configurado' }
    }

    try {
      const { error: deleteError } = await supabase
        .from('purchase_invoices')
        .delete()
        .eq('id', id)

      if (deleteError) throw deleteError

      setPurchaseInvoices(prev => prev.filter(inv => inv.id !== id))
      return { success: true }
    } catch (err: any) {
      console.error('Error deleting purchase invoice:', err)
      return { success: false, error: err.message || 'Erro ao deletar nota fiscal' }
    }
  }

  // Add Stock Movement
  const addStockMovement = async (movement: CreateStockMovementInput): Promise<{ success: boolean; error?: string; data?: StockMovement }> => {
    if (!isSupabaseConfigured) {
      return { success: false, error: 'Supabase não configurado' }
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()

      const { data, error: insertError } = await supabase
        .from('stock_movements')
        .insert({
          ...movement,
          created_by: user?.id || null
        })
        .select()
        .single()

      if (insertError) throw insertError

      // Update inventory item stock (trigger handles this, but we refresh to get updated data)
      await fetchInventoryItems()
      await fetchStockMovements(movement.inventory_item_id)

      return { success: true, data }
    } catch (err: any) {
      console.error('Error adding stock movement:', err)
      return { success: false, error: err.message || 'Erro ao adicionar movimentação' }
    }
  }

  // Get Inventory Item by ID
  const getInventoryItemById = useCallback((id: number): InventoryItem | undefined => {
    return inventoryItems.find(item => item.id === id)
  }, [inventoryItems])

  // Get Low Stock Items
  const getLowStockItems = useCallback((): InventoryItem[] => {
    return inventoryItems.filter(item => item.current_stock <= item.min_stock)
  }, [inventoryItems])

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      await Promise.all([
        fetchInventoryItems(),
        fetchPurchaseInvoices(),
        fetchStockMovements()
      ])
      setIsLoading(false)
    }

    loadData()
  }, [fetchInventoryItems, fetchPurchaseInvoices, fetchStockMovements])

  // Real-time subscriptions
  useEffect(() => {
    if (!isSupabaseConfigured) return

    const channels = supabase
      .channel('stock-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inventory_items' },
        () => {
          fetchInventoryItems()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'purchase_invoices' },
        () => {
          fetchPurchaseInvoices()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'stock_movements' },
        () => {
          fetchStockMovements()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channels)
    }
  }, [fetchInventoryItems, fetchPurchaseInvoices, fetchStockMovements])

  return (
    <StockContext.Provider
      value={{
        inventoryItems,
        purchaseInvoices,
        stockMovements,
        isLoading,
        error,
        fetchInventoryItems,
        addInventoryItem,
        updateInventoryItem,
        deleteInventoryItem,
        fetchPurchaseInvoices,
        addPurchaseInvoice,
        updatePurchaseInvoice,
        deletePurchaseInvoice,
        fetchStockMovements,
        addStockMovement,
        getInventoryItemById,
        getLowStockItems
      }}
    >
      {children}
    </StockContext.Provider>
  )
}

export function useStock() {
  const context = useContext(StockContext)
  if (context === undefined) {
    throw new Error('useStock must be used within a StockProvider')
  }
  return context
}

