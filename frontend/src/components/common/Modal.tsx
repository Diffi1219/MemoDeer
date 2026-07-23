import { useEffect, useState, useRef } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  variant?: 'center' | 'sheet'
  maxWidth?: string
  showClose?: boolean
}

export default function Modal({ open, onClose, title, children, variant = 'center', maxWidth = 'sm:max-w-sm', showClose = true }: ModalProps) {
  const [visible, setVisible] = useState(false)
  const [animating, setAnimating] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (open) {
      setVisible(true)
      requestAnimationFrame(() => setAnimating(true))
    } else if (visible) {
      setAnimating(false)
      timerRef.current = setTimeout(() => setVisible(false), 200)
    }
    return () => clearTimeout(timerRef.current)
  }, [open])

  if (!visible) return null

  const isCenter = variant === 'center'
  const panelClass = isCenter
    ? `bg-surface-0 rounded-2xl w-full ${maxWidth} mx-4 p-6 shadow-xl ${animating ? 'animate-modal-sheet-center' : 'animate-page-exit'}`
    : `bg-surface-0 rounded-t-2xl sm:rounded-2xl w-full ${maxWidth} p-6 shadow-xl ${animating ? 'animate-modal-sheet' : 'animate-page-exit'}`

  return (
    <div
      className={`fixed inset-0 bg-black/40 z-50 flex ${isCenter ? 'items-center justify-center' : 'items-end sm:items-center justify-center'} modal-overlay ${animating ? 'open' : ''}`}
      onClick={onClose}
    >
      <div className={panelClass} onClick={(e) => e.stopPropagation()}>
        {(title || showClose) && (
          <div className="flex items-center justify-between mb-4">
            {title && <h3 className="text-lg font-semibold">{title}</h3>}
            {showClose && (
              <button onClick={onClose} className="p-1 hover:bg-surface-100 rounded-lg ml-auto">
                <X size={20} />
              </button>
            )}
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
