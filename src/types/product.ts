// Interface unificada para produtos que substitui MenuItem e InventoryItem
export interface Product {
  id: number
  name: string
  
  // Campos básicos
  category: string | null
  image: string | null
  
  // Campos de venda (pode ser NULL se produto não é vendido diretamente)
  price: number | null // preço de venda
  description: string | null
  status: "Available" | "Sold Out" | null
  is_cold: boolean | null // indica se a bebida é gelada
  
  // Campos de estoque (pode ser NULL se produto não tem controle de estoque)
  unit: string | null
  min_stock: number | null
  current_stock: number | null
  cost_price: number | null // preço de custo
  
  // Campos fiscais (opcionais)
  product_type: string | null
  ncm: string | null
  cst_icms: string | null
  cfop: string | null
  icms_rate: number | null
  ipi_rate: number | null
  ean_code: string | null
  
  // Timestamps
  created_at: string
  updated_at: string
}

// Interface para criar/atualizar produto
export interface CreateProductInput {
  name: string
  category?: string | null
  image?: string | null
  
  // Campos de venda
  price?: number | null
  description?: string | null
  status?: "Available" | "Sold Out" | null
  is_cold?: boolean | null
  
  // Campos de estoque
  unit?: string | null
  min_stock?: number | null
  current_stock?: number | null
  cost_price?: number | null
  
  // Campos fiscais
  product_type?: string | null
  ncm?: string | null
  cst_icms?: string | null
  cfop?: string | null
  icms_rate?: number | null
  ipi_rate?: number | null
  ean_code?: string | null
}

// Interfaces para compatibilidade durante transição (deprecated, mas mantidas temporariamente)
/** @deprecated Use Product instead */
export interface MenuItem {
  id: number
  name: string
  price: number
  description: string
  category: string
  status: "Available" | "Sold Out"
  image: string
}

/** @deprecated Use Product instead */
export interface InventoryItem {
  id: number
  menu_item_id: number | null
  name: string
  unit: string
  min_stock: number
  current_stock: number
  cost_price: number | null
  selling_price: number | null
  category: string | null
  image: string | null
  product_type: string | null
  ncm: string | null
  cst_icms: string | null
  cfop: string | null
  icms_rate: number | null
  ipi_rate: number | null
  ean_code: string | null
  created_at: string
  updated_at: string
}

// Interfaces relacionadas (mantidas de stock.ts mas atualizadas para products)
export interface PurchaseInvoice {
  id: number
  invoice_number: string
  invoice_series: string | null
  nfe_key: string | null
  supplier_name: string
  supplier_cnpj: string | null
  supplier_address: string | null
  invoice_date: string
  total_amount: number
  xml_file_path: string | null
  xml_content: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface InvoiceItem {
  id: number
  invoice_id: number
  product_id: number | null // atualizado de inventory_item_id
  product_name: string
  quantity: number
  unit: string
  unit_price: number
  total_price: number
  created_at: string
}

export type StockMovementType = 'entry' | 'exit' | 'adjustment'

export interface StockMovement {
  id: number
  product_id: number // atualizado de inventory_item_id
  movement_type: StockMovementType
  quantity: number
  reference_id: number | null
  reference_type: 'invoice' | 'order' | null
  notes: string | null
  created_by: string | null
  created_at: string
}

export interface CreatePurchaseInvoiceInput {
  invoice_number: string
  invoice_series?: string | null
  nfe_key?: string | null
  supplier_name: string
  supplier_cnpj?: string | null
  supplier_address?: string | null
  invoice_date: string
  total_amount: number
  xml_file_path?: string | null
  xml_content?: string | null
  notes?: string | null
  items: CreateInvoiceItemInput[]
}

export interface CreateInvoiceItemInput {
  product_id?: number | null // atualizado de inventory_item_id
  product_name: string
  quantity: number
  unit?: string
  unit_price: number
  total_price: number
}

export interface CreateStockMovementInput {
  product_id: number // atualizado de inventory_item_id
  movement_type: StockMovementType
  quantity: number
  reference_id?: number | null
  reference_type?: 'invoice' | 'order' | null
  notes?: string | null
}

export interface NFEParsedData {
  invoice_number: string
  invoice_series?: string
  nfe_key?: string
  supplier_name: string
  supplier_cnpj?: string
  supplier_address?: string
  invoice_date: string
  items: Array<{
    product_name: string
    quantity: number
    unit: string
    unit_price: number
    total_price: number
  }>
  subtotal?: number
  taxes?: number
  total_amount: number
}

