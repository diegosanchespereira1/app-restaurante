import { cn } from "../../lib/utils"

interface LogoProps {
    className?: string
    showText?: boolean
    size?: "sm" | "md" | "lg"
}

export function Logo({ className, showText = true, size = "md" }: LogoProps) {
    const sizeClasses = {
        sm: "h-8 w-8",
        md: "h-12 w-12",
        lg: "h-16 w-16"
    }

    const textSizeClasses = {
        sm: "text-lg",
        md: "text-xl",
        lg: "text-2xl"
    }

    return (
        <div className={cn("flex items-center gap-3 min-w-0", className)}>
            {/* Logo Graphic - Container with Arrow */}
            <div className={cn("relative flex-shrink-0", sizeClasses[size])}>
                <svg
                    viewBox="0 0 140 100"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-full h-full"
                >
                    {/* Curved Arrow - drawn first so it appears behind container */}
                    <defs>
                        <linearGradient id="arrowGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#0066CC" />
                            <stop offset="100%" stopColor="#0052CC" />
                        </linearGradient>
                    </defs>
                    <path
                        d="M 5 75 Q 25 50, 45 60 Q 65 70, 85 50 Q 105 30, 125 50"
                        fill="none"
                        stroke="url(#arrowGradient)"
                        strokeWidth="7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    <path
                        d="M 5 75 Q 25 50, 45 60 Q 65 70, 85 50 Q 105 30, 125 50"
                        fill="none"
                        stroke="white"
                        strokeWidth="9"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity="0.4"
                    />
                    
                    {/* Container - Isometric 3D view */}
                    <g transform="translate(25, 20)">
                        {/* Container top face */}
                        <path
                            d="M15 15 L55 -5 L95 15 L55 35 Z"
                            fill="#0066CC"
                            stroke="white"
                            strokeWidth="2.5"
                        />
                        {/* Container front face */}
                        <path
                            d="M15 15 L15 55 L55 75 L55 35 Z"
                            fill="#0066CC"
                            stroke="white"
                            strokeWidth="2.5"
                        />
                        {/* Container right face (darker) */}
                        <path
                            d="M55 35 L95 15 L95 55 L55 75 Z"
                            fill="#0052CC"
                            stroke="white"
                            strokeWidth="2.5"
                        />
                        {/* Vertical lines on container (corrugated structure) */}
                        <line x1="25" y1="25" x2="25" y2="65" stroke="white" strokeWidth="2" opacity="0.9" />
                        <line x1="45" y1="20" x2="45" y2="70" stroke="white" strokeWidth="2" opacity="0.9" />
                        <line x1="65" y1="15" x2="65" y2="70" stroke="white" strokeWidth="2" opacity="0.9" />
                        <line x1="85" y1="20" x2="85" y2="60" stroke="white" strokeWidth="2" opacity="0.9" />
                    </g>
                    
                    {/* Arrowhead */}
                    <path
                        d="M 120 45 L 125 50 L 120 55 Z"
                        fill="#0066CC"
                        stroke="white"
                        strokeWidth="2.5"
                    />
                </svg>
            </div>

            {/* Text */}
            {showText && (
                <div className="flex flex-col min-w-0">
                    <h1 className={cn("font-bold tracking-tight uppercase min-w-0", textSizeClasses[size])}>
                        <span 
                            className="text-white relative block truncate"
                            style={{
                                WebkitTextStroke: '3px #0066CC',
                                WebkitTextFillColor: 'white',
                                textShadow: '2px 2px 0 #0066CC, -2px -2px 0 #0066CC, 2px -2px 0 #0066CC, -2px 2px 0 #0066CC',
                                paintOrder: 'stroke fill'
                            }}
                        >
                            JE BEBIDAS
                        </span>
                    </h1>
                    <span className={cn("font-bold text-[#0066CC] uppercase truncate", size === "sm" ? "text-xs" : size === "md" ? "text-sm" : "text-base")}>
                        DISTRIBUIDORA
                    </span>
                </div>
            )}
        </div>
    )
}

