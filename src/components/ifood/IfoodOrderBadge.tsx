import { ShoppingBag } from "lucide-react"
import { Badge } from "../ui/badge"

interface IfoodOrderBadgeProps {
  ifoodStatus?: string | null
  className?: string
}

export function IfoodOrderBadge({ ifoodStatus, className }: IfoodOrderBadgeProps) {
  const getStatusColor = (status: string | null | undefined) => {
    if (!status) return "bg-blue-100 text-blue-700 border-blue-200"
    
    switch (status.toUpperCase()) {
      case 'PLACED':
      case 'PLC':
        return "bg-yellow-100 text-yellow-700 border-yellow-200"
      case 'CONFIRMED':
      case 'CFM':
        return "bg-blue-100 text-blue-700 border-blue-200"
      case 'PREPARATION_STARTED':
      case 'PRS':
        return "bg-orange-100 text-orange-700 border-orange-200"
      case 'SEPARATION_STARTED':
      case 'SPS':
        return "bg-cyan-100 text-cyan-700 border-cyan-200"
      case 'SEPARATION_ENDED':
      case 'SPE':
        return "bg-teal-100 text-teal-700 border-teal-200"
      case 'READY_TO_PICKUP':
      case 'RTP':
        return "bg-green-100 text-green-700 border-green-200"
      case 'DISPATCHED':
      case 'DSP':
        return "bg-purple-100 text-purple-700 border-purple-200"
      case 'CONCLUDED':
      case 'CON':
        return "bg-gray-100 text-gray-700 border-gray-200"
      case 'CANCELLED':
      case 'CAN':
        return "bg-red-100 text-red-700 border-red-200"
      default:
        return "bg-blue-100 text-blue-700 border-blue-200"
    }
  }

  const getStatusLabel = (status: string | null | undefined) => {
    if (!status) return "iFood"
    
    switch (status.toUpperCase()) {
      case 'PLACED':
      case 'PLC':
        return "iFood - Novo Pedido"
      case 'CONFIRMED':
      case 'CFM':
        return "iFood - Confirmado"
      case 'PREPARATION_STARTED':
      case 'PRS':
        return "Ifood - Em preparo"
      case 'SEPARATION_STARTED':
      case 'SPS':
        return "iFood - Separação Iniciada"
      case 'SEPARATION_ENDED':
      case 'SPE':
        return "iFood - Separação Concluída"
      case 'READY_TO_PICKUP':
      case 'RTP':
        return "iFood - Pronto para Retirada"
      case 'DISPATCHED':
      case 'DSP':
        return "iFood - Saiu para Entrega"
      case 'CONCLUDED':
      case 'CON':
        return "iFood - Concluído"
      case 'CANCELLED':
      case 'CAN':
        return "iFood - Cancelado"
      default:
        return `iFood - ${status}`
    }
  }

  return (
    <Badge 
      variant="outline" 
      className={`flex items-center gap-1 ${getStatusColor(ifoodStatus)} ${className || ''}`}
    >
      <ShoppingBag className="h-3 w-3" />
      <span className="text-xs font-medium">{getStatusLabel(ifoodStatus)}</span>
    </Badge>
  )
}

