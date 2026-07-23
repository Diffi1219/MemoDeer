import { useUIStore, ToastType } from '../../store/uiStore'
import { CheckCircle, AlertCircle, Info, AlertTriangle, X } from 'lucide-react'

const iconMap: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle size={18} />,
  error: <AlertCircle size={18} />,
  info: <Info size={18} />,
  warning: <AlertTriangle size={18} />,
}

const colorMap: Record<ToastType, string> = {
  success: 'border-green-400 bg-green-50 dark:bg-green-950 text-green-800 dark:text-green-200',
  error: 'border-danger/40 bg-danger-light/50 text-danger dark:text-red-300',
  info: 'border-blue-400 bg-blue-50 dark:bg-blue-950 text-blue-800 dark:text-blue-200',
  warning: 'border-warning/40 bg-warning-light/40 text-warning-700 dark:text-warning-400',
}

export default function Toast() {
  const toasts = useUIStore((s) => s.toasts)
  const removeToast = useUIStore((s) => s.removeToast)

  return (
    <div className="fixed top-4 right-4 z-[500] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg animate-toast-in ${colorMap[t.type]}`}
        >
          <span className="flex-shrink-0">{iconMap[t.type]}</span>
          <p className="text-sm flex-1">{t.message}</p>
          <button
            onClick={() => removeToast(t.id)}
            className="flex-shrink-0 p-0.5 rounded hover:bg-black/10 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
