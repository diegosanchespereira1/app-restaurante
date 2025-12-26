import type { NFEParsedData } from '../types/stock'

/**
 * Parser de XML da NF-e (Nota Fiscal Eletrônica brasileira)
 * Extrai dados do XML para preencher formulário de nota fiscal
 */

export interface NFEParseResult {
  success: boolean
  data?: NFEParsedData
  error?: string
}

/**
 * Extrai texto de um elemento XML, considerando namespaces
 */
function getTextContent(element: Element | null, tagName: string): string {
  if (!element) return ''
  
  // Tenta encontrar com namespace
  const withNs = element.getElementsByTagNameNS('http://www.portalfiscal.inf.br/nfe', tagName)
  if (withNs.length > 0 && withNs[0].textContent) {
    return withNs[0].textContent.trim()
  }
  
  // Tenta encontrar sem namespace
  const withoutNs = element.getElementsByTagName(tagName)
  if (withoutNs.length > 0 && withoutNs[0].textContent) {
    return withoutNs[0].textContent.trim()
  }
  
  return ''
}

/**
 * Extrai número de um elemento XML
 */
function getNumberContent(element: Element | null, tagName: string): number {
  const text = getTextContent(element, tagName)
  const num = parseFloat(text.replace(',', '.'))
  return isNaN(num) ? 0 : num
}

/**
 * Parse XML da NF-e e extrai dados relevantes
 */
export function parseNFEXML(xmlContent: string): NFEParseResult {
  try {
    const parser = new DOMParser()
    const xmlDoc = parser.parseFromString(xmlContent, 'text/xml')

    // Verifica erros de parsing
    const parserError = xmlDoc.querySelector('parsererror')
    if (parserError) {
      return {
        success: false,
        error: 'Erro ao processar XML. Verifique se o arquivo é um XML válido.'
      }
    }

    // Encontra o elemento raiz NFe
    const nfeElement = xmlDoc.querySelector('NFe') || xmlDoc.querySelector('nfeProc > NFe')
    if (!nfeElement) {
      return {
        success: false,
        error: 'XML não contém estrutura de NF-e válida. Elemento NFe não encontrado.'
      }
    }

    const infNFe = nfeElement.querySelector('infNFe') || nfeElement
    if (!infNFe) {
      return {
        success: false,
        error: 'Estrutura infNFe não encontrada no XML.'
      }
    }

    // Extrai dados de identificação (ide)
    const ide = infNFe.querySelector('ide')
    const invoiceNumber = getTextContent(ide, 'nNF') || ''
    const invoiceSeries = getTextContent(ide, 'serie') || ''
    const issueDate = getTextContent(ide, 'dhEmi') || getTextContent(ide, 'dEmi') || ''
    
    // Formata data (pode vir como ISO 8601 ou DD/MM/YYYY)
    let formattedDate = issueDate
    if (issueDate.includes('T')) {
      formattedDate = new Date(issueDate).toISOString().split('T')[0]
    } else if (issueDate.includes('/')) {
      // Converte DD/MM/YYYY para YYYY-MM-DD
      const parts = issueDate.split('/')
      if (parts.length === 3) {
        formattedDate = `${parts[2]}-${parts[1]}-${parts[0]}`
      }
    }

    // Extrai chave de acesso
    const nfeKey = infNFe.getAttribute('Id')?.replace('NFe', '') || ''

    // Extrai dados do emitente (fornecedor)
    const emit = infNFe.querySelector('emit')
    const supplierName = getTextContent(emit, 'xNome') || getTextContent(emit, 'xFant') || ''
    const supplierCNPJ = getTextContent(emit, 'CNPJ') || getTextContent(emit, 'CPF') || ''
    
    // Extrai endereço do emitente
    const enderEmit = emit?.querySelector('enderEmit')
    const addressParts = [
      getTextContent(enderEmit, 'xLgr'),
      getTextContent(enderEmit, 'nro'),
      getTextContent(enderEmit, 'xBairro'),
      getTextContent(enderEmit, 'xMun'),
      getTextContent(enderEmit, 'UF'),
      getTextContent(enderEmit, 'CEP')
    ].filter(Boolean)
    const supplierAddress = addressParts.join(', ')

    // Extrai itens (det)
    const detElements = infNFe.querySelectorAll('det')
    const items: NFEParsedData['items'] = []

    detElements.forEach((det) => {
      const prod = det.querySelector('prod')
      if (!prod) return

      const productName = getTextContent(prod, 'xProd') || ''
      const quantity = getNumberContent(prod, 'qCom')
      const unit = getTextContent(prod, 'uCom') || 'UN'
      const unitPrice = getNumberContent(prod, 'vUnCom')
      const totalPrice = getNumberContent(prod, 'vProd')

      if (productName && quantity > 0) {
        items.push({
          product_name: productName,
          quantity,
          unit,
          unit_price: unitPrice || (totalPrice / quantity),
          total_price: totalPrice || (unitPrice * quantity)
        })
      }
    })

    // Extrai totais
    const total = infNFe.querySelector('total > ICMSTot')
    const subtotal = getNumberContent(total, 'vProd')
    const taxes = getNumberContent(total, 'vTotTrib')
    const totalAmount = getNumberContent(total, 'vNF')

    if (!invoiceNumber || !supplierName || items.length === 0) {
      return {
        success: false,
        error: 'XML não contém informações suficientes. Verifique número da nota, fornecedor e itens.'
      }
    }

    return {
      success: true,
      data: {
        invoice_number: invoiceNumber,
        invoice_series: invoiceSeries || undefined,
        nfe_key: nfeKey || undefined,
        supplier_name: supplierName,
        supplier_cnpj: supplierCNPJ || undefined,
        supplier_address: supplierAddress || undefined,
        invoice_date: formattedDate,
        items,
        subtotal: subtotal || undefined,
        taxes: taxes || undefined,
        total_amount: totalAmount || subtotal || 0
      }
    }
  } catch (error: any) {
    console.error('Error parsing NFe XML:', error)
    return {
      success: false,
      error: error.message || 'Erro desconhecido ao processar XML da NF-e'
    }
  }
}

/**
 * Valida se o arquivo é um XML válido
 */
export function validateXMLFile(file: File): { valid: boolean; error?: string } {
  if (!file.name.toLowerCase().endsWith('.xml')) {
    return { valid: false, error: 'O arquivo deve ser um XML (.xml)' }
  }

  if (file.size === 0) {
    return { valid: false, error: 'O arquivo está vazio' }
  }

  if (file.size > 10 * 1024 * 1024) { // 10MB
    return { valid: false, error: 'O arquivo é muito grande (máximo 10MB)' }
  }

  return { valid: true }
}

/**
 * Lê arquivo XML e retorna conteúdo como string
 */
export function readXMLFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = (e) => {
      const content = e.target?.result as string
      if (content) {
        resolve(content)
      } else {
        reject(new Error('Não foi possível ler o conteúdo do arquivo'))
      }
    }
    
    reader.onerror = () => {
      reject(new Error('Erro ao ler o arquivo'))
    }
    
    reader.readAsText(file, 'UTF-8')
  })
}

