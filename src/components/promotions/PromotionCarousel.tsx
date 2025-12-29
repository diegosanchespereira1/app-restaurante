import { useState, useEffect } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "../ui/button"
import { formatCurrency } from "../../lib/utils"
import type { PromotionWithItems } from "../../types/promotion"

interface PromotionCarouselProps {
    promotions: PromotionWithItems[]
    onPromotionClick?: (promotion: PromotionWithItems) => void
}

export function PromotionCarousel({ promotions, onPromotionClick }: PromotionCarouselProps) {
    const [currentIndex, setCurrentIndex] = useState(0)

    // Auto-play: muda de slide a cada 5 segundos
    useEffect(() => {
        if (promotions.length <= 1) return

        const interval = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % promotions.length)
        }, 5000)

        return () => clearInterval(interval)
    }, [promotions.length])

    if (!promotions || promotions.length === 0) {
        return null
    }

    const currentPromotion = promotions[currentIndex]

    const handlePrevious = () => {
        setCurrentIndex((prev) => (prev - 1 + promotions.length) % promotions.length)
    }

    const handleNext = () => {
        setCurrentIndex((prev) => (prev + 1) % promotions.length)
    }

    const handleDotClick = (index: number) => {
        setCurrentIndex(index)
    }

    const getDiscountText = () => {
        if (currentPromotion.discount_percentage) {
            return `${currentPromotion.discount_percentage}% OFF`
        }
        if (currentPromotion.discount_amount) {
            return `${formatCurrency(currentPromotion.discount_amount)} OFF`
        }
        return null
    }

    const discountText = getDiscountText()

    return (
        <section aria-label="Carrossel de Promoções" className="relative group">
            {/* Botões de Navegação */}
            {promotions.length > 1 && (
                <>
                    <button
                        aria-label="Slide Anterior"
                        onClick={handlePrevious}
                        className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white/90 rounded-full flex items-center justify-center shadow-md hover:bg-white transition-colors cursor-pointer"
                    >
                        <ChevronLeft className="w-5 h-5 text-gray-700" />
                    </button>
                    <button
                        aria-label="Próximo Slide"
                        onClick={handleNext}
                        className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white/90 rounded-full flex items-center justify-center shadow-md hover:bg-white transition-colors cursor-pointer"
                    >
                        <ChevronRight className="w-5 h-5 text-gray-700" />
                    </button>
                </>
            )}

            {/* Banner Principal */}
            <div className="bg-black rounded-2xl overflow-hidden flex flex-col md:flex-row h-auto md:h-[340px]">
                {/* Conteúdo à Esquerda */}
                <div className="p-8 md:p-12 flex flex-col justify-center w-full md:w-1/2 relative z-0">
                    <h2 className="text-3xl md:text-4xl font-bold text-white leading-tight mb-2">
                        {currentPromotion.name}
                    </h2>
                    {currentPromotion.description && (
                        <p className="text-gray-400 text-sm md:text-base mb-4">
                            {currentPromotion.description}
                        </p>
                    )}
                    <div className="flex flex-col gap-3">
                        {currentPromotion.price && (
                            <div className="flex items-center gap-2">
                                <p className="text-2xl font-bold text-white">
                                    {formatCurrency(currentPromotion.price)}
                                </p>
                                {discountText && (
                                    <span className="bg-blue-600 text-white text-xs font-semibold px-2 py-1 rounded">
                                        {discountText}
                                    </span>
                                )}
                            </div>
                        )}
                        {discountText && !currentPromotion.price && (
                            <span className="bg-blue-600 text-white text-sm font-semibold px-3 py-1 rounded w-fit">
                                {discountText}
                            </span>
                        )}
                        <Button
                            onClick={() => onPromotionClick?.(currentPromotion)}
                            className="bg-blue-600 text-white rounded px-6 py-2 font-medium transition-colors hover:bg-blue-700 w-fit"
                        >
                            Ver Promoção
                        </Button>
                    </div>
                </div>

                {/* Imagem à Direita */}
                <div className="w-full md:w-1/2 relative h-64 md:h-full">
                    {/* Gradiente para transição suave do preto para a imagem */}
                    <div className="absolute inset-0 bg-gradient-to-r from-black via-transparent to-transparent z-10 pointer-events-none"></div>
                    {currentPromotion.image ? (
                        <img
                            alt={currentPromotion.name}
                            className="w-full h-full object-cover object-center"
                            src={currentPromotion.image}
                            onError={(e) => {
                                // Fallback para imagem padrão se houver erro
                                const target = e.currentTarget
                                target.src = 'materialApoio/imagem-nao-disponivel.gif'
                            }}
                        />
                    ) : (
                        <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                            <p className="text-gray-500 text-sm">Sem imagem</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Pontos de Paginação */}
            {promotions.length > 1 && (
                <div className="flex justify-center gap-2 mt-4" role="tablist">
                    {promotions.map((_, index) => (
                        <button
                            key={index}
                            aria-current={index === currentIndex}
                            aria-label={`Slide ${index + 1}`}
                            onClick={() => handleDotClick(index)}
                            className={`transition-all ${
                                index === currentIndex
                                    ? 'w-8 h-2 bg-gray-800 rounded-full'
                                    : 'w-2 h-2 bg-gray-300 rounded-full hover:bg-gray-400'
                            }`}
                        />
                    ))}
                </div>
            )}
        </section>
    )
}

