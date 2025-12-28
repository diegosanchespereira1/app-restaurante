import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import type {
  Product,
  PurchaseInvoice,
  StockMovement,
  CreatePurchaseInvoiceInput,
  CreateStockMovementInput
} from '../types/product'
import type { InventoryItem, CreateInventoryItemInput } from '../types/stock'

// Helper function to convert Product to InventoryItem (for compatibility)
const productToInventoryItem = (p: Product): InventoryItem => ({
  id: p.id,
  menu_item_id: null, // não é mais necessário na nova estrutura
  name: p.name,
  unit: p.unit ?? 'UN',
  min_stock: p.min_stock ?? 0,
  current_stock: p.current_stock ?? 0,
  cost_price: p.cost_price,
  selling_price: p.price, // usar price como selling_price
  category: p.category,
  image: p.image,
  product_type: p.product_type,
  ncm: p.ncm,
  cst_icms: p.cst_icms,
  cfop: p.cfop,
  icms_rate: p.icms_rate,
  ipi_rate: p.ipi_rate,
  ean_code: p.ean_code,
  created_at: p.created_at,
  updated_at: p.updated_at
})

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

  // Fetch Inventory Items (agora usando products)
  const fetchInventoryItems = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setInventoryItems([])
      setIsLoading(false)
      return
    }

    try {
      // Buscar produtos que têm controle de estoque (current_stock não é null ou unit não é null)
      const { data, error: fetchError } = await supabase
        .from('products')
        .select('*')
        .order('name')

      if (fetchError) throw fetchError
      // Converter products para InventoryItems para compatibilidade
      const inventoryItems = (data || []).map(productToInventoryItem)
      setInventoryItems(inventoryItems)
    } catch (err: any) {
      console.error('Error fetching products:', err)
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
        query = query.eq('product_id', itemId) // usar product_id
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
      // Build insert object for products
      const insertData: any = {
        name: item.name,
        unit: item.unit || 'UN',
        min_stock: item.min_stock ?? 0,
        current_stock: item.current_stock ?? 0,
        cost_price: item.cost_price ?? null,
        price: item.selling_price ?? null, // usar price ao invés de selling_price
        category: item.category || null,
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
        .from('products')
        .insert(insertData)
        .select()
        .single()

      if (insertError) {
        // If error is about image column, try again without it
        if (insertError.message?.includes("'image' column")) {
          delete insertData.image
          const { data: retryData, error: retryError } = await supabase
            .from('products')
            .insert(insertData)
            .select()
            .single()
          
          if (retryError) throw retryError
          
          const inventoryItem = productToInventoryItem(retryData)
          setInventoryItems(prev => [...prev, inventoryItem])
          return { success: true, data: inventoryItem }
        }
        throw insertError
      }

      const inventoryItem = productToInventoryItem(data)
      setInventoryItems(prev => [...prev, inventoryItem])
      return { success: true, data: inventoryItem }
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
      if (updates.selling_price !== undefined) updateData.price = updates.selling_price ?? null // usar price
      if (updates.category !== undefined) updateData.category = updates.category || null
      // menu_item_id não é mais usado na nova estrutura
      if (updates.product_type !== undefined) updateData.product_type = updates.product_type || null
      if (updates.ncm !== undefined) updateData.ncm = updates.ncm || null
      if (updates.cst_icms !== undefined) updateData.cst_icms = updates.cst_icms || null
      if (updates.cfop !== undefined) updateData.cfop = updates.cfop || null
      if (updates.icms_rate !== undefined) updateData.icms_rate = updates.icms_rate ?? null
      if (updates.ipi_rate !== undefined) updateData.ipi_rate = updates.ipi_rate ?? null
      if (updates.ean_code !== undefined) updateData.ean_code = updates.ean_code || null

      // Sempre incluir image se fornecida (mesmo que seja string vazia, para limpar imagem)
      // Se não fornecida (undefined), não incluir para não sobrescrever
      if (updates.image !== undefined) {
        updateData.image = updates.image || null // Converter string vazia para null
      }

      const { error: updateError } = await supabase
        .from('products')
        .update(updateData)
        .eq('id', id)

      if (updateError) {
        // If error is about image column, try again without it
        if (updateError.message?.includes("'image' column")) {
          delete updateData.image
          const { error: retryError } = await supabase
            .from('products')
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
        .from('products')
        .delete()
        .eq('id', id)

      if (deleteError) throw deleteError

      setInventoryItems(prev => prev.filter(item => item.id !== id))
      return { success: true }
    } catch (err: any) {
      console.error('Error deleting product:', err)
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
        product_id: item.product_id, // usar product_id
        inventory_item_id: item.product_id, // manter para backward compatibility durante transição
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

      // Create stock movements for each item that has product_id
      // Try to match items by name if product_id is null
      for (const item of invoice.items) {
        let productId = item.product_id

        // If no product_id, try to find by product name
        if (!productId) {
          const { data: matchingProducts } = await supabase
            .from('products')
            .select('id')
            .ilike('name', `%${item.product_name}%`)
            .limit(1)

          if (matchingProducts && matchingProducts.length > 0) {
            productId = matchingProducts[0].id
          }
        }

        // Only create movement if we have a valid product_id
        if (productId) {
          await addStockMovement({
            product_id: productId,
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

      // Update product stock (trigger handles this, but we refresh to get updated data)
      await fetchInventoryItems()
      await fetchStockMovements(movement.product_id)

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
        { event: '*', schema: 'public', table: 'products' },
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

