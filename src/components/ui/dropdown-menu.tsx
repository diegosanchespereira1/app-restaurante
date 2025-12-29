import * as React from "react"
import { cn } from "../../lib/utils"

// Simple dropdown menu implementation without external dependencies
interface DropdownMenuContextValue {
  open: boolean
  setOpen: (open: boolean) => void
  triggerRef: React.MutableRefObject<HTMLElement | null>
}

const DropdownMenuContext = React.createContext<DropdownMenuContextValue | undefined>(undefined)

const DropdownMenu = ({ children }: { children: React.ReactNode }) => {
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)
  const triggerRef = React.useRef<HTMLElement | null>(null)

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [open])

  return (
    <DropdownMenuContext.Provider value={{ open, setOpen, triggerRef }}>
      <div ref={ref} className="relative">
        {children}
      </div>
    </DropdownMenuContext.Provider>
  )
}

const DropdownMenuTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }
>(({ className, children, onClick, asChild, ...props }, ref) => {
  const context = React.useContext(DropdownMenuContext)
  if (!context) throw new Error("DropdownMenuTrigger must be used within DropdownMenu")

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    context.setOpen(!context.open)
    onClick?.(e)
  }

  const setRefs = (node: HTMLButtonElement | null) => {
    if (typeof ref === 'function') {
      ref(node)
    } else if (ref) {
      ref.current = node
    }
    context.triggerRef.current = node
  }

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      ref: setRefs,
      onClick: handleClick,
      ...props
    })
  }

  return (
    <button
      ref={setRefs}
      className={className}
      onClick={handleClick}
      {...props}
    >
      {children}
    </button>
  )
})
DropdownMenuTrigger.displayName = "DropdownMenuTrigger"

const DropdownMenuContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { align?: "start" | "end" | "center"; sideOffset?: number; side?: "top" | "bottom" }
>(({ className, align = "start", sideOffset = 4, side, children, ...props }, ref) => {
  const context = React.useContext(DropdownMenuContext)
  if (!context) throw new Error("DropdownMenuContent must be used within DropdownMenu")

  const [position, setPosition] = React.useState<{ top: number; left: number } | null>(null)
  const contentRef = React.useRef<HTMLDivElement>(null)

  const updatePosition = React.useCallback(() => {
    if (!context.triggerRef.current || !contentRef.current) return

    const triggerRect = context.triggerRef.current.getBoundingClientRect()
    const contentRect = contentRef.current.getBoundingClientRect()
    const viewportHeight = window.innerHeight
    const viewportWidth = window.innerWidth
    
    const contentWidth = contentRect.width || 150
    const contentHeight = contentRect.height || 100
    const spaceBelow = viewportHeight - triggerRect.bottom
    const spaceAbove = triggerRect.top
    
    // Determinar se deve aparecer acima ou abaixo
    const shouldShowTop = spaceBelow < contentHeight && spaceAbove > spaceBelow
    const finalSide = side || (shouldShowTop ? "top" : "bottom")
    
    // Calcular posição alinhada com o botão
    let left: number
    if (align === "end") {
      // Alinhar à direita do botão - a borda direita do dropdown alinha com a borda direita do botão
      left = triggerRect.right - contentWidth
    } else if (align === "center") {
      // Centralizar com o botão
      left = triggerRect.left + (triggerRect.width / 2) - (contentWidth / 2)
    } else {
      // Alinhar à esquerda do botão
      left = triggerRect.left
    }
    
    // Garantir que não saia da viewport
    if (align === "end") {
      left = Math.max(8, left)
    } else if (align === "center") {
      if (left < 8) left = 8
      if (left + contentWidth > viewportWidth - 8) {
        left = viewportWidth - contentWidth - 8
      }
    } else {
      left = Math.min(left, viewportWidth - contentWidth - 8)
    }
    
    const top = finalSide === "top" 
      ? triggerRect.top - contentHeight - sideOffset
      : triggerRect.bottom + sideOffset
    
    setPosition({ top, left })
  }, [context.triggerRef, align, side, sideOffset])

  React.useEffect(() => {
    if (!context.open) {
      setPosition(null)
      return
    }

    if (!context.triggerRef.current) return

    // Calcular posição inicial com estimativa
    const triggerRect = context.triggerRef.current.getBoundingClientRect()
    const estimatedWidth = 150
    const estimatedHeight = 100
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const spaceBelow = viewportHeight - triggerRect.bottom
    const spaceAbove = triggerRect.top
    
    const shouldShowTop = spaceBelow < estimatedHeight && spaceAbove > spaceBelow
    const finalSide = side || (shouldShowTop ? "top" : "bottom")
    
    let left: number
    if (align === "end") {
      left = triggerRect.right - estimatedWidth
    } else if (align === "center") {
      left = triggerRect.left + (triggerRect.width / 2) - (estimatedWidth / 2)
    } else {
      left = triggerRect.left
    }
    
    if (align === "end") {
      left = Math.max(8, left)
    } else if (align === "center") {
      if (left < 8) left = 8
      if (left + estimatedWidth > viewportWidth - 8) {
        left = viewportWidth - estimatedWidth - 8
      }
    } else {
      left = Math.min(left, viewportWidth - estimatedWidth - 8)
    }
    
    const top = finalSide === "top" 
      ? triggerRect.top - estimatedHeight - sideOffset
      : triggerRect.bottom + sideOffset
    
    setPosition({ top, left })

    // Recalcular com dimensões reais após renderização
    const timeoutId = setTimeout(() => {
      updatePosition()
    }, 0)

    return () => clearTimeout(timeoutId)
  }, [context.open, context.triggerRef, align, side, sideOffset, updatePosition])

  // Observar mudanças de tamanho do conteúdo
  React.useEffect(() => {
    if (!context.open || !contentRef.current) return

    const resizeObserver = new ResizeObserver(() => {
      updatePosition()
    })

    resizeObserver.observe(contentRef.current)

    return () => {
      resizeObserver.disconnect()
    }
  }, [context.open, updatePosition])

  if (!context.open) return null

  return (
    <div
      ref={(node) => {
        if (typeof ref === 'function') {
          ref(node)
        } else if (ref) {
          ref.current = node
        }
        contentRef.current = node
      }}
      className={cn(
        "z-[9999] min-w-[8rem] overflow-hidden rounded-md border bg-background p-1 text-foreground shadow-lg",
        "fixed",
        className
      )}
      style={position ? {
        top: `${position.top}px`,
        left: `${position.left}px`,
      } : undefined}
      {...props}
    >
      {children}
    </div>
  )
})
DropdownMenuContent.displayName = "DropdownMenuContent"

const DropdownMenuItem = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { inset?: boolean }
>(({ className, inset, onClick, ...props }, ref) => {
  const context = React.useContext(DropdownMenuContext)
  
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    onClick?.(e)
    context?.setOpen(false)
  }

  return (
    <div
      ref={ref}
      className={cn(
        "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors",
        "hover:bg-accent hover:text-accent-foreground",
        "focus:bg-accent focus:text-accent-foreground",
        inset && "pl-8",
        className
      )}
      onClick={handleClick}
      {...props}
    />
  )
})
DropdownMenuItem.displayName = "DropdownMenuItem"

const DropdownMenuSeparator = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-muted", className)}
    {...props}
  />
))
DropdownMenuSeparator.displayName = "DropdownMenuSeparator"

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
}
