import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(value);
}

/**
 * Calcula o preço de um produto aplicando desconto baseado no método de pagamento
 * @param basePrice Preço base do produto
 * @param discountType Tipo de desconto: 'fixed' (valor fixo) ou 'percentage' (percentual)
 * @param discountValue Valor do desconto (em reais se fixed, em % se percentage)
 * @param discountAppliesTo Array de métodos de pagamento que o desconto se aplica
 * @param paymentMethod Método de pagamento selecionado
 * @returns Preço final após aplicar o desconto (se aplicável)
 */
export function calculatePriceWithDiscount(
    basePrice: number,
    discountType: "fixed" | "percentage" | null | undefined,
    discountValue: number | null | undefined,
    discountAppliesTo: string[] | null | undefined,
    paymentMethod: "Cash" | "Card" | "Voucher" | "PIX"
): number {
    // Se não há desconto configurado, retorna o preço base
    if (!discountType || discountValue === null || discountValue === undefined || discountValue <= 0) {
        return basePrice
    }

    // Se o método de pagamento não está na lista de métodos que recebem desconto, retorna o preço base
    if (!discountAppliesTo || !discountAppliesTo.includes(paymentMethod)) {
        return basePrice
    }

    // Aplicar desconto
    if (discountType === 'fixed') {
        // Desconto fixo em reais
        const finalPrice = basePrice - discountValue
        return Math.max(0, finalPrice) // Garantir que não fique negativo
    } else if (discountType === 'percentage') {
        // Desconto percentual
        const discountAmount = (basePrice * discountValue) / 100
        const finalPrice = basePrice - discountAmount
        return Math.max(0, finalPrice) // Garantir que não fique negativo
    }

    return basePrice
}

/**
 * Valida se o desconto aplicado está dentro do limite permitido
 * @param discountType Tipo de desconto: 'fixed' (valor fixo) ou 'percentage' (percentual)
 * @param discountValue Valor do desconto a ser aplicado
 * @param limitType Tipo de limite: 'fixed' (valor fixo) ou 'percentage' (percentual) ou null
 * @param limitValue Valor do limite máximo permitido
 * @param subtotal Subtotal antes do desconto (usado para calcular limite percentual em valor)
 * @returns Objeto com { isValid: boolean, errorMessage?: string }
 */
export function validatePaymentDiscount(
    discountType: "fixed" | "percentage" | null,
    discountValue: number | null,
    limitType: "fixed" | "percentage" | null,
    limitValue: number | null,
    subtotal: number
): { isValid: boolean; errorMessage?: string } {
    // Se não há desconto sendo aplicado, não precisa validar
    if (!discountType || discountValue === null || discountValue === undefined || discountValue <= 0) {
        return { isValid: true }
    }

    // Se não há limite configurado, permite qualquer desconto
    if (!limitType || limitValue === null || limitValue === undefined) {
        return { isValid: true }
    }

    // Validar conforme o tipo de desconto e tipo de limite
    if (discountType === 'fixed') {
        // Desconto em valor fixo
        if (limitType === 'fixed') {
            // Limite também é valor fixo
            if (discountValue > limitValue) {
                return {
                    isValid: false,
                    errorMessage: `Limite de desconto maior do que o permitido. O valor máximo permitido é ${formatCurrency(limitValue)}.`
                }
            }
        } else if (limitType === 'percentage') {
            // Limite é percentual, converter para valor
            const maxDiscountValue = (subtotal * limitValue) / 100
            if (discountValue > maxDiscountValue) {
                return {
                    isValid: false,
                    errorMessage: `Limite de desconto maior do que o permitido. O valor máximo permitido é ${formatCurrency(maxDiscountValue)} (${limitValue}% de ${formatCurrency(subtotal)}).`
                }
            }
        }
    } else if (discountType === 'percentage') {
        // Desconto em percentual
        if (limitType === 'fixed') {
            // Limite é valor fixo, converter desconto para valor e comparar
            const discountAmount = (subtotal * discountValue) / 100
            if (discountAmount > limitValue) {
                return {
                    isValid: false,
                    errorMessage: `Limite de desconto maior do que o permitido. O percentual máximo permitido é ${((limitValue / subtotal) * 100).toFixed(2)}% (${formatCurrency(limitValue)}).`
                }
            }
        } else if (limitType === 'percentage') {
            // Limite também é percentual
            if (discountValue > limitValue) {
                return {
                    isValid: false,
                    errorMessage: `Limite de desconto maior do que o permitido. O percentual máximo permitido é ${limitValue}%.`
                }
            }
        }
    }

    return { isValid: true }
}
