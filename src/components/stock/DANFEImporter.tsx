import { useState, useRef } from "react"
import { Button } from "../ui/button"
import { Card, CardContent } from "../ui/card"
import { Upload, FileText, CheckCircle, XCircle, Loader2 } from "lucide-react"
import { parseNFEXML, validateXMLFile, readXMLFile, type NFEParseResult } from "../../lib/nfe-parser"
import type { NFEParsedData } from "../../types/stock"

interface DANFEImporterProps {
    onImport: (data: NFEParsedData, xmlContent: string) => void
    onError?: (error: string) => void
}

export function DANFEImporter({ onImport, onError }: DANFEImporterProps) {
    const [isDragging, setIsDragging] = useState(false)
    const [isProcessing, setIsProcessing] = useState(false)
    const [parseResult, setParseResult] = useState<NFEParseResult | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleFile = async (file: File) => {
        // Valida arquivo
        const validation = validateXMLFile(file)
        if (!validation.valid) {
            onError?.(validation.error || 'Arquivo inválido')
            return
        }

        setIsProcessing(true)
        setParseResult(null)

        try {
            // Lê arquivo
            const xmlContent = await readXMLFile(file)
            
            // Parse XML
            const result = parseNFEXML(xmlContent)
            setParseResult(result)

            if (result.success && result.data) {
                // Chama callback com dados parseados
                onImport(result.data, xmlContent)
            } else {
                onError?.(result.error || 'Erro ao processar XML')
            }
        } catch (error: any) {
            const errorMsg = error.message || 'Erro ao processar arquivo'
            onError?.(errorMsg)
            setParseResult({
                success: false,
                error: errorMsg
            })
        } finally {
            setIsProcessing(false)
        }
    }

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            handleFile(file)
        }
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(true)
    }

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)

        const file = e.dataTransfer.files?.[0]
        if (file) {
            handleFile(file)
        }
    }

    const handleClick = () => {
        fileInputRef.current?.click()
    }

    return (
        <div className="space-y-4">
            <Card className={isDragging ? "border-primary border-2" : ""}>
                <CardContent className="p-6">
                    <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={handleClick}
                        className={`
                            border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
                            transition-colors
                            ${isDragging 
                                ? 'border-primary bg-primary/5' 
                                : 'border-muted-foreground/25 hover:border-primary/50'
                            }
                            ${isProcessing ? 'pointer-events-none opacity-50' : ''}
                        `}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".xml"
                            onChange={handleFileSelect}
                            className="hidden"
                        />

                        {isProcessing ? (
                            <>
                                <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-primary" />
                                <p className="text-sm text-muted-foreground">
                                    Processando XML...
                                </p>
                            </>
                        ) : parseResult?.success ? (
                            <>
                                <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-600" />
                                <p className="font-semibold text-green-600 mb-2">
                                    XML processado com sucesso!
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    {parseResult.data?.invoice_number && (
                                        <>Nota Fiscal: {parseResult.data.invoice_number}</>
                                    )}
                                </p>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="mt-4"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        setParseResult(null)
                                        if (fileInputRef.current) {
                                            fileInputRef.current.value = ''
                                        }
                                    }}
                                >
                                    Importar outro arquivo
                                </Button>
                            </>
                        ) : parseResult && !parseResult.success ? (
                            <>
                                <XCircle className="w-12 h-12 mx-auto mb-4 text-destructive" />
                                <p className="font-semibold text-destructive mb-2">
                                    Erro ao processar XML
                                </p>
                                <p className="text-sm text-muted-foreground mb-4">
                                    {parseResult.error}
                                </p>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        setParseResult(null)
                                        if (fileInputRef.current) {
                                            fileInputRef.current.value = ''
                                        }
                                    }}
                                >
                                    Tentar novamente
                                </Button>
                            </>
                        ) : (
                            <>
                                <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                                <p className="font-semibold mb-2">
                                    Importar DANFE (XML)
                                </p>
                                <p className="text-sm text-muted-foreground mb-4">
                                    Clique aqui ou arraste o arquivo XML da NF-e
                                </p>
                                <Button variant="outline" size="sm">
                                    <FileText className="w-4 h-4 mr-2" />
                                    Selecionar arquivo XML
                                </Button>
                            </>
                        )}
                    </div>
                </CardContent>
            </Card>

            {parseResult?.success && parseResult.data && (
                <Card className="bg-green-50 border-green-200">
                    <CardContent className="p-4">
                        <h4 className="font-semibold mb-2 text-green-900">Preview dos dados extraídos:</h4>
                        <div className="text-sm space-y-1 text-green-800">
                            <p><strong>Fornecedor:</strong> {parseResult.data.supplier_name}</p>
                            {parseResult.data.supplier_cnpj && (
                                <p><strong>CNPJ:</strong> {parseResult.data.supplier_cnpj}</p>
                            )}
                            <p><strong>Número:</strong> {parseResult.data.invoice_number}</p>
                            {parseResult.data.invoice_series && (
                                <p><strong>Série:</strong> {parseResult.data.invoice_series}</p>
                            )}
                            <p><strong>Data:</strong> {new Date(parseResult.data.invoice_date).toLocaleDateString('pt-BR')}</p>
                            <p><strong>Itens:</strong> {parseResult.data.items.length}</p>
                            <p><strong>Total:</strong> R$ {parseResult.data.total_amount.toFixed(2)}</p>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}






