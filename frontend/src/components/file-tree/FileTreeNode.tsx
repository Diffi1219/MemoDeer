import { useState } from 'react'
import {
  ChevronRight, Folder, FolderOpen, FileText, File,
  Loader2,
} from 'lucide-react'
import FileContextMenu from './FileContextMenu'

export interface TreeNode {
  type: 'folder' | 'document'
  id: string
  name: string
  children?: TreeNode[]
  parent_id?: string | null
  folder_id?: string | null
  file_type?: string
  status?: string
  needs_revectorize?: number
}

interface FileTreeNodeProps {
  node: TreeNode
  depth: number
  selectedId: string | null
  expandedIds: Set<string>
  onSelect: (node: TreeNode) => void
  onToggle: (id: string) => void
  onRename: (node: TreeNode) => void
  onDelete: (node: TreeNode) => void
  onMove: (node: TreeNode) => void
  onCreateFile: (parentFolderId: string | null) => void
  onCreateFolder: (parentFolderId: string | null) => void
}

function getFileIcon(fileType: string | undefined, fileName: string) {
  if (fileType === 'md') {
    return <FileText size={16} className="text-blue-500 flex-shrink-0" />
  }
  if (fileType === 'pdf') {
    return <FileText size={16} className="text-danger flex-shrink-0" />
  }
  if (fileType === 'docx' || fileType === 'doc') {
    return <FileText size={16} className="text-indigo-500 flex-shrink-0" />
  }
  return <File size={16} className="text-surface-400 flex-shrink-0" />
}

export default function FileTreeNode({
  node, depth, selectedId, expandedIds,
  onSelect, onToggle, onRename, onDelete, onMove,
  onCreateFile, onCreateFolder,
}: FileTreeNodeProps) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(node.name)

  const isFolder = node.type === 'folder'
  const isExpanded = expandedIds.has(node.id)
  const isSelected = selectedId === node.id
  const isProcessing = node.status === 'processing' || node.status === 'pending'

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  const handleRenameSubmit = () => {
    const trimmed = renameValue.trim()
    if (trimmed && trimmed !== node.name) {
      onRename({ ...node, name: trimmed })
    }
    setIsRenaming(false)
    setRenameValue(node.name)
  }

  const indentPixels = depth * 16

  return (
    <>
      <div
        className={`group flex items-center h-7 cursor-pointer select-none text-[13px] transition-colors ${
          isSelected
            ? 'bg-primary-50 text-primary-700 border-l-[2px] border-l-primary-500'
            : 'hover:bg-surface-100 text-surface-600 border-l-[2px] border-l-transparent'
        }`}
        style={{ paddingLeft: `${indentPixels + 6}px`, paddingRight: '6px' }}
        onClick={() => {
          if (isFolder) {
            onToggle(node.id)
          }
          onSelect(node)
        }}
        onDoubleClick={() => {
          if (isFolder) {
            onToggle(node.id)
          } else {
            onSelect(node)
          }
        }}
        onContextMenu={handleContextMenu}
      >
        {/* 缩进线 */}
        {Array.from({ length: depth }).map((_, i) => (
          <div
            key={i}
            className="absolute w-px bg-surface-200"
            style={{
              left: `${i * 16 + 26}px`,
              top: 0,
              bottom: 0,
              height: '100%',
            }}
          />
        ))}

        {/* 展开/折叠箭头 */}
        <span className="w-4 flex-shrink-0 flex items-center justify-center mr-0.5">
          {isFolder && (
            <ChevronRight
              size={14}
              className={`text-surface-400 transition-transform duration-200 ${
                isExpanded ? 'rotate-90' : ''
              }`}
            />
          )}
        </span>

        {/* 图标 */}
        <span className="mr-1.5 flex-shrink-0">
          {isFolder ? (
            isExpanded
              ? <FolderOpen size={16} className="text-accent flex-shrink-0" />
              : <Folder size={16} className="text-accent flex-shrink-0" />
          ) : isProcessing ? (
            <Loader2 size={14} className="animate-spin text-blue-400 flex-shrink-0" />
          ) : (
            getFileIcon(node.file_type, node.name)
          )}
        </span>

        {/* 名称 */}
        {isRenaming ? (
          <input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRenameSubmit()
              if (e.key === 'Escape') {
                setIsRenaming(false)
                setRenameValue(node.name)
              }
            }}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 min-w-0 text-[13px] px-1 py-0 border border-primary-400 rounded outline-none bg-surface-0"
            autoFocus
          />
        ) : (
          <span className="flex-1 min-w-0 truncate">
            {node.name}
            {node.needs_revectorize === 1 && (
              <span className="ml-1.5 text-[10px] text-warning font-medium" title="待向量化：内容已修改但未重新向量化">
                ⚠待向量化
              </span>
            )}
            {!isFolder && node.status && node.status !== 'completed' && (
              <span className="ml-1.5 text-[10px] text-blue-400 font-medium">
                {node.status === 'processing' || node.status === 'pending' ? '处理中' : node.status}
              </span>
            )}
          </span>
        )}
      </div>

      {/* 子节点 */}
      {isFolder && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              expandedIds={expandedIds}
              onSelect={onSelect}
              onToggle={onToggle}
              onRename={onRename}
              onDelete={onDelete}
              onMove={onMove}
              onCreateFile={onCreateFile}
              onCreateFolder={onCreateFolder}
            />
          ))}
        </div>
      )}

      {/* 右键菜单 */}
      {contextMenu && (
        <FileContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          nodeType={node.type}
          nodeName={node.name}
          onClose={() => setContextMenu(null)}
          onRename={() => { setIsRenaming(true); setRenameValue(node.name) }}
          onDelete={() => onDelete(node)}
          onMove={() => onMove(node)}
          onCreateFile={isFolder ? () => onCreateFile(node.id) : undefined}
          onCreateFolder={isFolder ? () => onCreateFolder(node.id) : undefined}
        />
      )}
    </>
  )
}
