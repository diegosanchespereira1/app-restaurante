import { Socket } from 'net'
import { formatReceiptToESCPOS } from '../utils/escpos.js'
import type { PrinterConfig, PrintData } from '../types/printer.js'

const DEFAULT_TIMEOUT = 5000

/**
 * Testa conexão com impressora RAW (porta 9100)
 */
export async function testRawConnection(
  ipAddress: string,
  port: number,
  timeout: number = DEFAULT_TIMEOUT
): Promise<{ success: boolean; message: string }> {
  return new Promise((resolve) => {
    const socket = new Socket()
    let resolved = false

    const cleanup = () => {
      if (!resolved) {
        resolved = true
        socket.destroy()
      }
    }

    const timeoutId = setTimeout(() => {
      cleanup()
      resolve({
        success: false,
        message: 'Timeout: Não foi possível conectar à impressora'
      })
    }, timeout)

    socket.on('connect', () => {
      clearTimeout(timeoutId)
      cleanup()
      resolve({
        success: true,
        message: 'Conexão estabelecida com sucesso'
      })
    })

    socket.on('error', (error: Error) => {
      clearTimeout(timeoutId)
      cleanup()
      resolve({
        success: false,
        message: `Erro de conexão: ${error.message}`
      })
    })

    socket.on('timeout', () => {
      clearTimeout(timeoutId)
      cleanup()
      resolve({
        success: false,
        message: 'Timeout: A impressora não respondeu'
      })
    })

    socket.setTimeout(timeout)
    socket.connect(port, ipAddress)
  })
}

/**
 * Imprime via protocolo RAW (TCP porta 9100)
 */
export async function printViaRaw(
  config: PrinterConfig,
  data: PrintData,
  timeout: number = DEFAULT_TIMEOUT
): Promise<{ success: boolean; message: string }> {
  return new Promise((resolve) => {
    const socket = new Socket()
    let resolved = false

    const cleanup = () => {
      if (!resolved) {
        resolved = true
        socket.destroy()
      }
    }

    const timeoutId = setTimeout(() => {
      cleanup()
      resolve({
        success: false,
        message: 'Timeout: Não foi possível enviar dados para a impressora'
      })
    }, timeout)

    // Formatar dados para ESC/POS
    const escposData = formatReceiptToESCPOS({
      ...data,
      paperSize: config.paperSize || '80mm'
    })

    socket.on('connect', () => {
      // Enviar dados quando conectar
      socket.write(escposData, (error) => {
        if (error) {
          clearTimeout(timeoutId)
          cleanup()
          resolve({
            success: false,
            message: `Erro ao enviar dados: ${error.message}`
          })
        } else {
          // Aguardar um pouco antes de fechar
          setTimeout(() => {
            clearTimeout(timeoutId)
            cleanup()
            resolve({
              success: true,
              message: 'Recibo impresso com sucesso'
            })
          }, 500)
        }
      })
    })

    socket.on('error', (error: Error) => {
      clearTimeout(timeoutId)
      cleanup()
      resolve({
        success: false,
        message: `Erro de conexão: ${error.message}`
      })
    })

    socket.on('timeout', () => {
      clearTimeout(timeoutId)
      cleanup()
      resolve({
        success: false,
        message: 'Timeout: A impressora não respondeu'
      })
    })

    socket.setTimeout(timeout)
    socket.connect(config.port, config.ipAddress)
  })
}





