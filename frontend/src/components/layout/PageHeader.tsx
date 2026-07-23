import { useEffect, useRef, useState } from 'react'
import { ArrowLeft } from 'lucide-react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  onBack?: () => void
  actions?: React.ReactNode
  /** 额外的左侧元素（如汉堡菜单按钮） */
  leftActions?: React.ReactNode
}

/**
 * 统一页面 Header 组件
 * - 后退箭头 + 标题 + 右侧操作区
 * - 滚动时底部阴影渐显
 * - 暗色模式自动适配
 */
export default function PageHeader({ title, subtitle, onBack, actions, leftActions }: PageHeaderProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    // 监听最近的 overflow-y-auto 父级滚动
    const el = ref.current?.parentElement?.closest('.overflow-y-auto, [data-scroll-container]')
    if (!el) return
    const handler = () => setScrolled(el.scrollTop > 4)
    el.addEventListener('scroll', handler, { passive: true })
    handler() // 初始检测
    return () => el.removeEventListener('scroll', handler)
  }, [])

  return (
    <header
      ref={ref}
      className={`sticky top-0 z-10 flex items-center gap-3 px-4 py-3 border-b border-surface-200 bg-surface-0/95 backdrop-blur-sm transition-shadow duration-normal ${
        scrolled ? 'shadow-sm' : ''
      }`}
    >
      {/* 左侧 */}
      <div className="flex items-center gap-2">
        {leftActions}
        {onBack && (
          <button
            onClick={onBack}
            className="p-2 hover:bg-surface-100 rounded-lg btn-press flex-shrink-0"
            aria-label="返回"
          >
            <ArrowLeft size={20} className="text-surface-600" />
          </button>
        )}
      </div>

      {/* 标题 */}
      <div className="flex-1 min-w-0">
        <h1 className="font-semibold text-base text-surface-800 truncate">
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs text-surface-400 truncate">{subtitle}</p>
        )}
      </div>

      {/* 右侧操作区 */}
      {actions && (
        <div className="flex items-center gap-1 flex-shrink-0">
          {actions}
        </div>
      )}
    </header>
  )
}
