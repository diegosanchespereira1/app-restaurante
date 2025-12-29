// Tipos para promoções e produtos customizados

export type PromotionType = 'product' | 'kit'

export interface Promotion {
  id: number
  name: string
  description: string | null
  image: string | null
  type: PromotionType
  price: number | null
  discount_percentage: number | null
  discount_amount: number | null
  enabled: boolean
  category: string | null
  created_at: string
  updated_at: string
}

export interface PromotionItem {
  id: number
  promotion_id: number
  product_id: number
  quantity: number
  created_at: string
}

// Interface para promoção com itens (para kits)
export interface PromotionWithItems extends Promotion {
  items?: PromotionItemWithProduct[]
}

export interface PromotionItemWithProduct extends PromotionItem {
  product?: {
    id: number
    name: string
    price: number | null
    image: string | null
  }
}

// Interface para criar/atualizar promoção
export interface CreatePromotionInput {
  name: string
  description?: string | null
  image?: string | null
  type: PromotionType
  price?: number | null
  discount_percentage?: number | null
  discount_amount?: number | null
  enabled?: boolean
  category?: string | null
  items?: Array<{
    product_id: number
    quantity: number
  }>
}

// Interface para atualizar promoção
export interface UpdatePromotionInput extends Partial<CreatePromotionInput> {
  id: number
}

