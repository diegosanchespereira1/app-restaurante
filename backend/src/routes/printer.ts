import { Router, type Request, type Response } from 'express'
import { PrinterServiceFactory } from '../services/printer-factory.js'
import type { TestConnectionRequest, PrintRequest, ApiResponse } from '../types/printer.js'

const router = Router()

/**
 * Valida se o IP é da rede local (básico)
 */
function isValidLocalIP(ip: string): boolean {
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/
  if (!ipRegex.test(ip)) {
    return false
  }
  
  const parts = ip.split('.').map(Number)
  // Verifica se é IP privado (RFC 1918)
  return (
    (parts[0] === 10) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168) ||
    (parts[0] === 127) // localhost
  )
}

/**
 * POST /api/printer/test
 * Testa conexão com impressora
 */
router.post('/test', async (req: Request, res: Response<ApiResponse>) => {
  try {
    const { ipAddress, port, protocol }: TestConnectionRequest = req.body

    // Validações
    if (!ipAddress || !port || !protocol) {
      return res.status(400).json({
        success: false,
        message: 'Campos obrigatórios: ipAddress, port, protocol'
      })
    }

    if (!isValidLocalIP(ipAddress)) {
      return res.status(400).json({
        success: false,
        message: 'IP deve ser da rede local (10.x.x.x, 172.16-31.x.x, 192.168.x.x ou 127.x.x.x)'
      })
    }

    if (port < 1 || port > 65535) {
      return res.status(400).json({
        success: false,
        message: 'Porta deve estar entre 1 e 65535'
      })
    }

    if (!['raw', 'ipp', 'lpr'].includes(protocol)) {
      return res.status(400).json({
        success: false,
        message: 'Protocolo deve ser: raw, ipp ou lpr'
      })
    }

    const timeout = parseInt(process.env.PRINTER_TIMEOUT || '5000', 10)
    const result = await PrinterServiceFactory.testConnection(
      { ipAddress, port, protocol },
      timeout
    )

    res.json(result)
  } catch (error) {
    console.error('Erro ao testar conexão:', error)
    res.status(500).json({
      success: false,
      message: `Erro interno: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
    })
  }
})

/**
 * POST /api/printer/print
 * Envia trabalho de impressão
 */
router.post('/print', async (req: Request, res: Response<ApiResponse>) => {
  try {
    const { printerConfig, printData }: PrintRequest = req.body

    // Validações
    if (!printerConfig || !printData) {
      return res.status(400).json({
        success: false,
        message: 'Campos obrigatórios: printerConfig, printData'
      })
    }

    const { ipAddress, port, protocol } = printerConfig

    if (!ipAddress || !port || !protocol) {
      return res.status(400).json({
        success: false,
        message: 'printerConfig deve conter: ipAddress, port, protocol'
      })
    }

    if (!isValidLocalIP(ipAddress)) {
      return res.status(400).json({
        success: false,
        message: 'IP deve ser da rede local'
      })
    }

    if (port < 1 || port > 65535) {
      return res.status(400).json({
        success: false,
        message: 'Porta inválida'
      })
    }

    if (!['raw', 'ipp', 'lpr'].includes(protocol)) {
      return res.status(400).json({
        success: false,
        message: 'Protocolo inválido'
      })
    }

    // Validação básica dos dados de impressão
    if (!printData.orderId || !printData.customer || !printData.items || !printData.total) {
      return res.status(400).json({
        success: false,
        message: 'printData deve conter: orderId, customer, items, total'
      })
    }

    const timeout = parseInt(process.env.PRINTER_TIMEOUT || '5000', 10)
    const result = await PrinterServiceFactory.print(printerConfig, printData, timeout)

    if (result.success) {
      res.json(result)
    } else {
      res.status(500).json(result)
    }
  } catch (error) {
    console.error('Erro ao imprimir:', error)
    res.status(500).json({
      success: false,
      message: `Erro interno: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
    })
  }
})

export default router

