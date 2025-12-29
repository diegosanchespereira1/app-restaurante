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
  description: string | null
  status: "Available" | "Sold Out" | null
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
  inventory_item_id: number | null
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
  inventory_item_id: number
  movement_type: StockMovementType
  quantity: number
  reference_id: number | null
  reference_type: 'invoice' | 'order' | null
  notes: string | null
  created_by: string | null
  created_at: string
}

export interface CreateInventoryItemInput {
  menu_item_id?: number | null
  name: string
  unit?: string
  min_stock?: number
  current_stock?: number
  cost_price?: number | null
  selling_price?: number | null
  category?: string | null
  image?: string | null
  description?: string | null
  status?: "Available" | "Sold Out" | null
  product_type?: string | null
  ncm?: string | null
  cst_icms?: string | null
  cfop?: string | null
  icms_rate?: number | null
  ipi_rate?: number | null
  ean_code?: string | null
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
  inventory_item_id?: number | null
  product_name: string
  quantity: number
  unit?: string
  unit_price: number
  total_price: number
}

export interface CreateStockMovementInput {
  inventory_item_id: number
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

