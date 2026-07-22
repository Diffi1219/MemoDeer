import { useEffect, useRef } from 'react'
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

  // 防止菜单超出屏幕
  const adjustedX = Math.min(x, window.innerWidth - 200)
  const adjustedY = Math.min(y, window.innerHeight - 280)

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

  return (
    <div
      ref={menuRef}
      className="fixed z-[100] min-w-[180px] py-1.5 rounded-xl shadow-xl border border-surface-200/60 animate-modal-sheet-center"
      style={{
        left: adjustedX,
        top: adjustedY,
        background: 'rgba(255, 255, 255, 0.85)',
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
              ? 'text-red-500 hover:bg-red-50'
              : 'text-surface-600 hover:bg-surface-100'
          }`}
        >
          <item.icon size={14} />
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  )
}
