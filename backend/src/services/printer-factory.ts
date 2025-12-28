import { testRawConnection, printViaRaw } from './printer-raw.js'
import { testIPPConnection, printViaIPP } from './printer-ipp.js'
import { testLPRConnection, printViaLPR } from './printer-lpr.js'
import type { PrinterConfig, PrintData } from '../types/printer.js'

const DEFAULT_TIMEOUT = 5000

/**
 * Factory para escolher o serviço de impressão baseado no protocolo
 */
export class PrinterServiceFactory {
  /**
   * Testa conexão com impressora baseado no protocolo
   */
  static async testConnection(
    config: PrinterConfig,
    timeout: number = DEFAULT_TIMEOUT
  ): Promise<{ success: boolean; message: string }> {
    switch (config.protocol) {
      case 'raw':
        return testRawConnection(config.ipAddress, config.port, timeout)
      
      case 'ipp':
        return testIPPConnection(config.ipAddress, config.port || 631, timeout)
      
      case 'lpr':
        return testLPRConnection(config.ipAddress, config.port || 515, timeout)
      
      default:
        return Promise.resolve({
          success: false,
          message: `Protocolo não suportado: ${config.protocol}`
        })
    }
  }

  /**
   * Imprime recibo baseado no protocolo
   */
  static async print(
    config: PrinterConfig,
    data: PrintData,
    timeout: number = DEFAULT_TIMEOUT
  ): Promise<{ success: boolean; message: string }> {
    switch (config.protocol) {
      case 'raw':
        return printViaRaw(config, data, timeout)
      
      case 'ipp':
        return printViaIPP(config, data, timeout)
      
      case 'lpr':
        return printViaLPR(config, data, timeout)
      
      default:
        return Promise.resolve({
          success: false,
          message: `Protocolo não suportado: ${config.protocol}`
        })
    }
  }
}




