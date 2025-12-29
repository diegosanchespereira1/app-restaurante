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
