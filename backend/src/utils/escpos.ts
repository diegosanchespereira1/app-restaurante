/**
 * Comandos ESC/POS para impressoras térmicas
 * Baseado no padrão ESC/POS
 */

export class ESCPOS {
  // Comandos de inicialização
  static INIT = '\x1B\x40' // ESC @ - Inicializar impressora
  static RESET = '\x1B\x40' // ESC @ - Reset
  
  // Comandos de formatação de texto
  static BOLD_ON = '\x1B\x45\x01' // ESC E 1 - Negrito ligado
  static BOLD_OFF = '\x1B\x45\x00' // ESC E 0 - Negrito desligado
  static UNDERLINE_ON = '\x1B\x2D\x01' // ESC - 1 - Sublinhado ligado
  static UNDERLINE_OFF = '\x1B\x2D\x00' // ESC - 0 - Sublinhado desligado
  
  // Tamanhos de fonte
  static FONT_NORMAL = '\x1B\x4D\x00' // ESC M 0 - Fonte normal
  static FONT_SMALL = '\x1B\x4D\x01' // ESC M 1 - Fonte pequena
  static FONT_LARGE = '\x1D\x21\x10' // GS ! 16 - Fonte grande (2x altura)
  static FONT_LARGE_WIDE = '\x1D\x21\x20' // GS ! 32 - Fonte grande (2x largura)
  static FONT_LARGE_BOTH = '\x1D\x21\x30' // GS ! 48 - Fonte grande (2x ambos)
  
  // Alinhamento
  static ALIGN_LEFT = '\x1B\x61\x00' // ESC a 0 - Alinhar à esquerda
  static ALIGN_CENTER = '\x1B\x61\x01' // ESC a 1 - Centralizar
  static ALIGN_RIGHT = '\x1B\x61\x02' // ESC a 2 - Alinhar à direita
  
  // Quebra de linha
  static LINE_FEED = '\x0A' // LF - Avançar linha
  static CARRIAGE_RETURN = '\x0D' // CR - Retorno de carro
  
  // Espaçamento
  static LINE_SPACING_DEFAULT = '\x1B\x32' // ESC 2 - Espaçamento padrão
  static LINE_SPACING(n: number) {
    return `\x1B\x33${String.fromCharCode(n)}` // ESC 3 n - Espaçamento n pontos
  }
  
  // Corte de papel
  static CUT_PAPER = '\x1D\x56\x00' // GS V 0 - Corte parcial
  static CUT_PAPER_FULL = '\x1D\x56\x01' // GS V 1 - Corte total
  
  // Código de barras (opcional)
  static BARCODE_HEIGHT = (height: number) => `\x1D\x68${String.fromCharCode(height)}` // GS h height
  static BARCODE_WIDTH = (width: number) => `\x1D\x77${String.fromCharCode(width)}` // GS w width
  static BARCODE_EAN13 = '\x1D\x6B\x02' // GS k 2 - EAN-13
  
  // Utilitários
  static DOUBLE_LINE = '\x1B\x33\x30\x0A' // Espaçamento duplo + linha
  static SEPARATOR = '\x2D\x2D\x2D\x2D\x2D\x2D\x2D\x2D\x2D\x2D\x2D\x2D\x2D\x2D\x2D\x2D' // Linha separadora
}

/**
 * Formata um recibo em comandos ESC/POS
 */
export function formatReceiptToESCPOS(data: {
  orderId: string
  customer: string
  table?: string
  orderType?: string
  items: Array<{ name: string; quantity: number; price: number }>
  subtotal: number
  total: number
  paymentMethod?: string
  notes?: string
  paperSize?: '80mm' | '58mm' | 'A4'
}): Buffer {
  let commands = ''
  
  // Inicializar impressora
  commands += ESCPOS.INIT
  
  // Cabeçalho
  commands += ESCPOS.ALIGN_CENTER
  commands += ESCPOS.BOLD_ON
  commands += ESCPOS.FONT_LARGE_BOTH
  commands += 'RECIBO\n'
  commands += ESCPOS.FONT_NORMAL
  commands += ESCPOS.BOLD_OFF
  commands += `Pedido #${data.orderId}\n`
  commands += ESCPOS.LINE_FEED
  commands += ESCPOS.ALIGN_LEFT
  
  // Informações do pedido
  commands += ESCPOS.BOLD_ON
  commands += `Cliente: ${data.customer}\n`
  commands += ESCPOS.BOLD_OFF
  
  if (data.table) {
    commands += `Mesa: ${data.table}\n`
  }
  
  if (data.orderType) {
    const orderTypeMap: Record<string, string> = {
      'dine_in': 'Mesa',
      'takeout': 'Retirada',
      'delivery': 'Delivery'
    }
    commands += `Tipo: ${orderTypeMap[data.orderType] || data.orderType}\n`
  }
  
  commands += ESCPOS.SEPARATOR + '\n'
  commands += ESCPOS.LINE_FEED
  
  // Itens
  commands += ESCPOS.BOLD_ON
  commands += 'Item                    Total\n'
  commands += ESCPOS.BOLD_OFF
  commands += ESCPOS.SEPARATOR + '\n'
  
  for (const item of data.items) {
    const itemLine = `${item.quantity}x ${item.name}`
    const priceLine = `R$ ${(item.price * item.quantity).toFixed(2)}`
    
    // Truncar nome do item se muito longo (máximo 20 chars para 80mm)
    const maxItemLength = data.paperSize === '58mm' ? 15 : 20
    const truncatedItem = itemLine.length > maxItemLength 
      ? itemLine.substring(0, maxItemLength - 3) + '...'
      : itemLine
    
    // Alinhar preço à direita
    const padding = maxItemLength + 10 - truncatedItem.length - priceLine.length
    const paddedPrice = ' '.repeat(Math.max(0, padding)) + priceLine
    
    commands += truncatedItem + paddedPrice + '\n'
  }
  
  commands += ESCPOS.SEPARATOR + '\n'
  commands += ESCPOS.LINE_FEED
  
  // Totais
  // Calcular subtotal se não fornecido (fallback de segurança)
  const subtotal = data.subtotal ?? data.items.reduce((sum, item) => sum + (item.price * item.quantity), 0)
  
  commands += ESCPOS.ALIGN_RIGHT
  commands += `Subtotal: R$ ${subtotal.toFixed(2)}\n`
  commands += ESCPOS.BOLD_ON
  commands += ESCPOS.FONT_LARGE
  commands += `TOTAL: R$ ${data.total.toFixed(2)}\n`
  commands += ESCPOS.FONT_NORMAL
  commands += ESCPOS.BOLD_OFF
  commands += ESCPOS.ALIGN_LEFT
  
  if (data.paymentMethod) {
    commands += ESCPOS.LINE_FEED
    commands += `Pagamento: ${data.paymentMethod}\n`
  }
  
  // Observações
  if (data.notes) {
    commands += ESCPOS.LINE_FEED
    commands += ESCPOS.BOLD_ON
    commands += 'Observacoes:\n'
    commands += ESCPOS.BOLD_OFF
    commands += `${data.notes}\n`
  }
  
  // Rodapé
  commands += ESCPOS.LINE_FEED
  commands += ESCPOS.LINE_FEED
  commands += ESCPOS.ALIGN_CENTER
  commands += 'Obrigado pela preferencia!\n'
  commands += ESCPOS.LINE_FEED
  
  // Corte de papel
  commands += ESCPOS.LINE_FEED
  commands += ESCPOS.LINE_FEED
  commands += ESCPOS.CUT_PAPER
  
  // Converter para Buffer
  return Buffer.from(commands, 'latin1')
}

