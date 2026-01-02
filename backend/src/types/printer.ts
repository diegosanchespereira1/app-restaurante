export interface PrinterConfig {
  ipAddress: string
  port: number
  protocol: 'raw' | 'ipp' | 'lpr'
  paperSize?: '80mm' | '58mm' | 'A4'
}

export interface PrintData {
  orderId: string
  customer: string
  table?: string
  orderType?: string
  items: Array<{
    name: string
    quantity: number
    price: number
  }>
  subtotal: number
  total: number
  paymentMethod?: string
  notes?: string
  date: string
  time: string
}

export interface PrintRequest {
  printerConfig: PrinterConfig
  printData: PrintData
}

export interface TestConnectionRequest {
  ipAddress: string
  port: number
  protocol: 'raw' | 'ipp' | 'lpr'
}

export interface ApiResponse {
  success: boolean
  message: string
  data?: any
}






