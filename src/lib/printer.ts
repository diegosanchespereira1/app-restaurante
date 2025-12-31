import type { PrinterSettings } from "../context/SettingsContext"
import { getBackendUrl } from "./backend-config"

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

/**
 * Formata o conteúdo para impressão baseado no tamanho do papel
 */
function formatReceiptContent(data: PrintData, paperSize: PrinterSettings['paperSize']): string {
  const width = paperSize === 'A4' ? '100%' : paperSize === '80mm' ? '80mm' : '58mm'
  const fontSize = paperSize === 'A4' ? '12px' : paperSize === '80mm' ? '10px' : '9px'
  
  const itemsHtml = data.items.map(item => `
    <tr>
      <td style="padding: 4px 0;">${item.quantity}x ${item.name}</td>
      <td style="text-align: right; padding: 4px 0;">R$ ${(item.price * item.quantity).toFixed(2)}</td>
    </tr>
  `).join('')

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Recibo - ${data.orderId}</title>
      <style>
        @media print {
          @page {
            size: ${paperSize === 'A4' ? 'A4' : 'auto'};
            margin: ${paperSize === 'A4' ? '10mm' : '5mm'};
          }
          body {
            margin: 0;
            padding: 0;
          }
          .no-print {
            display: none;
          }
        }
        body {
          font-family: 'Courier New', monospace;
          width: ${width};
          max-width: ${width};
          margin: 0 auto;
          padding: 10px;
          font-size: ${fontSize};
          line-height: 1.4;
        }
        .header {
          text-align: center;
          border-bottom: 1px dashed #000;
          padding-bottom: 10px;
          margin-bottom: 10px;
        }
        .header h1 {
          margin: 0;
          font-size: ${paperSize === 'A4' ? '18px' : '14px'};
          font-weight: bold;
        }
        .info {
          margin: 10px 0;
        }
        .info-row {
          display: flex;
          justify-content: space-between;
          margin: 4px 0;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 10px 0;
        }
        .total {
          border-top: 2px solid #000;
          padding-top: 10px;
          margin-top: 10px;
          font-weight: bold;
          font-size: ${paperSize === 'A4' ? '14px' : '12px'};
        }
        .footer {
          text-align: center;
          border-top: 1px dashed #000;
          padding-top: 10px;
          margin-top: 20px;
          font-size: ${paperSize === 'A4' ? '10px' : '8px'};
        }
        .notes {
          margin-top: 10px;
          padding: 8px;
          background: #f5f5f5;
          border-radius: 4px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>RECIBO</h1>
        <p>Pedido #${data.orderId}</p>
      </div>
      
      <div class="info">
        <div class="info-row">
          <span>Cliente:</span>
          <span>${data.customer}</span>
        </div>
        ${data.table ? `
        <div class="info-row">
          <span>Mesa:</span>
          <span>${data.table}</span>
        </div>
        ` : ''}
        ${data.orderType ? `
        <div class="info-row">
          <span>Tipo:</span>
          <span>${data.orderType === 'dine_in' ? 'Mesa' : data.orderType === 'takeout' ? 'Retirada' : 'Delivery'}</span>
        </div>
        ` : ''}
        <div class="info-row">
          <span>Data:</span>
          <span>${data.date} ${data.time}</span>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="text-align: left; border-bottom: 1px solid #000; padding-bottom: 5px;">Item</th>
            <th style="text-align: right; border-bottom: 1px solid #000; padding-bottom: 5px;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <div class="total">
        <div class="info-row">
          <span>Subtotal:</span>
          <span>R$ ${data.subtotal.toFixed(2)}</span>
        </div>
        <div class="info-row" style="font-size: ${paperSize === 'A4' ? '16px' : '14px'};">
          <span>TOTAL:</span>
          <span>R$ ${data.total.toFixed(2)}</span>
        </div>
        ${data.paymentMethod ? `
        <div class="info-row" style="margin-top: 8px;">
          <span>Pagamento:</span>
          <span>${data.paymentMethod}</span>
        </div>
        ` : ''}
      </div>

      ${data.notes ? `
      <div class="notes">
        <strong>Observações:</strong><br>
        ${data.notes}
      </div>
      ` : ''}

      <div class="footer">
        <p>Obrigado pela preferência!</p>
        <p>${new Date().toLocaleString('pt-BR')}</p>
      </div>
    </body>
    </html>
  `
}

/**
 * Imprime um recibo usando o método configurado
 */
export async function printReceipt(data: PrintData, settings: PrinterSettings): Promise<boolean> {
  if (!settings.enabled) {
    console.warn('Printer is disabled in settings')
    return false
  }

  try {
    switch (settings.type) {
      case 'browser':
        return printViaBrowser(data, settings)
      
      case 'network':
        return await printViaNetwork(data, settings)
      
      case 'usb':
        // TODO: Implementar impressão via USB
        console.warn('USB printing not yet implemented, falling back to browser print')
        return printViaBrowser(data, settings)
      
      default:
        return printViaBrowser(data, settings)
    }
  } catch (error) {
    console.error('Error printing receipt:', error)
    return false
  }
}

/**
 * Imprime via navegador (window.print)
 */
function printViaBrowser(data: PrintData, settings: PrinterSettings): boolean {
  try {
    const content = formatReceiptContent(data, settings.paperSize)
    const printWindow = window.open('', '_blank', 'width=800,height=600')
    
    if (!printWindow) {
      alert('Por favor, permita pop-ups para imprimir o recibo')
      return false
    }

    printWindow.document.write(content)
    printWindow.document.close()
    
    // Aguarda o conteúdo carregar antes de imprimir
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print()
        // Fecha a janela após um tempo (opcional)
        // printWindow.close()
      }, 250)
    }

    return true
  } catch (error) {
    console.error('Error in browser print:', error)
    return false
  }
}

/**
 * Imprime via rede usando o backend
 */
async function printViaNetwork(data: PrintData, settings: PrinterSettings): Promise<boolean> {
  try {
    if (!settings.ipAddress || !settings.port) {
      console.error('IP e porta da impressora não configurados')
      alert('Por favor, configure o IP e porta da impressora nas configurações')
      return false
    }

    // Determinar protocolo baseado na porta ou usar RAW como padrão
    let protocol: 'raw' | 'ipp' | 'lpr' = 'raw'
    if (settings.port === 631 || settings.port === 80 || settings.port === 443) {
      protocol = 'ipp'
    } else if (settings.port === 515) {
      protocol = 'lpr'
    }

    const backendUrl = getBackendUrl()
    
    const response = await fetch(`${backendUrl}/api/printer/print`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        printerConfig: {
          ipAddress: settings.ipAddress,
          port: settings.port,
          protocol: protocol,
          paperSize: settings.paperSize
        },
        printData: data
      })
    })

    const result = await response.json()

    if (result.success) {
      return true
    } else {
      console.error('Erro ao imprimir:', result.message)
      alert(`Erro ao imprimir: ${result.message}`)
      return false
    }
  } catch (error) {
    console.error('Error in network print:', error)
    alert(`Erro de conexão com o servidor de impressão. Verifique se o backend está rodando.`)
    return false
  }
}

/**
 * Testa a conexão com a impressora de rede
 */
export async function testNetworkPrinter(
  ipAddress: string, 
  port: number, 
  protocol: 'raw' | 'ipp' | 'lpr' = 'raw'
): Promise<{ success: boolean; message: string }> {
  try {
    // Validação básica
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/
    if (!ipRegex.test(ipAddress)) {
      return {
        success: false,
        message: 'Endereço IP inválido'
      }
    }
    
    if (port < 1 || port > 65535) {
      return {
        success: false,
        message: 'Porta inválida (deve estar entre 1 e 65535)'
      }
    }

    const backendUrl = getBackendUrl()
    
    const response = await fetch(`${backendUrl}/api/printer/test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ipAddress,
        port,
        protocol
      })
    })

    const result = await response.json()
    return result
  } catch (error) {
    console.error('Error testing network printer:', error)
    return {
      success: false,
      message: `Erro de conexão: ${error instanceof Error ? error.message : 'Não foi possível conectar ao servidor de impressão. Verifique se o backend está rodando.'}`
    }
  }
}

