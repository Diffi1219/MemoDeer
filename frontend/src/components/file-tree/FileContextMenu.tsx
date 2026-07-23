import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FileText, FolderPlus, Plus, Trash2, Pencil, MoveRight } from 'lucide-react'

interface ContextMenuProps {
  x: number
  y: number
  nodeType: 'folder' | 'document'
  nodeName: string
  onClose: () => void
  onRename: () => void
  onDelete: () => void
  onCreateFile?: () => void
  onCreateFolder?: () => void
  onMove?: () => void
}

export default function FileContextMenu({
  x, y, nodeType, nodeName, onClose, onRename, onDelete,
  onCreateFile, onCreateFolder, onMove,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [offset, setOffset] = useState({ x: 0, y: 0 })

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  // 挂载后测量菜单实际尺寸，计算调整后的坐标避免超出屏幕
  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect()
      const menuW = rect.width || 200
      const menuH = rect.height || 200
      setOffset({
        x: Math.max(0, Math.min(x, window.innerWidth - menuW - 4)),
        y: Math.max(0, Math.min(y, window.innerHeight - menuH - 4)),
      })
    }
  }, [x, y])

  const items = []

  if (nodeType === 'folder') {
    items.push(
      { icon: Plus, label: '新建文件', onClick: onCreateFile },
      { icon: FolderPlus, label: '新建文件夹', onClick: onCreateFolder },
    )
  }

  items.push(
    { icon: Pencil, label: '重命名', onClick: onRename },
    { icon: MoveRight, label: '移动到...', onClick: onMove },
    { icon: Trash2, label: '删除', onClick: onDelete, danger: true },
  )

  const menu = (
    <div
      ref={menuRef}
      className="fixed z-[100] min-w-[180px] py-1.5 rounded-xl shadow-xl border border-surface-200/60 animate-modal-sheet-center"
      style={{
        left: offset.x || x,
        top: offset.y || y,
        background: 'var(--s-0)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
      }}
    >
      {/* 标题 */}
      <div className="px-3 pb-1.5 mb-1 border-b border-surface-100">
        <p className="text-[11px] text-surface-400 truncate max-w-[160px]">{nodeName}</p>
      </div>

      {items.map((item, i) => (
        <button
          key={i}
          onClick={(e) => {
            e.stopPropagation()
            item.onClick?.()
            onClose()
          }}
          className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-[13px] transition-colors text-left ${
            item.danger
              ? 'text-danger hover:bg-danger-light/50'
              : 'text-surface-600 hover:bg-surface-100'
          }`}
        >
          <item.icon size={14} />
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  )

  return createPortal(menu, document.body)
}
