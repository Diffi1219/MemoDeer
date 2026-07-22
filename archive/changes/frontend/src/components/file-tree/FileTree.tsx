import { useRef, useMemo } from 'react'
import { Plus, FolderPlus, Upload, RefreshCw, Search } from 'lucide-react'
import FileTreeNode, { type TreeNode } from './FileTreeNode'

interface FileTreeProps {
  tree: TreeNode[]
  selectedId: string | null
  expandedIds: Set<string>
  onSelect: (node: TreeNode) => void
  onToggle: (id: string) => void
  onRename: (node: TreeNode) => void
  onDelete: (node: TreeNode) => void
  onMove: (node: TreeNode) => void
  onCreateFile: (parentFolderId: string | null) => void
  onCreateFolder: (parentFolderId: string | null) => void
  onUpload: () => void
  onRefresh: () => void
  searchQuery: string
  onSearchChange: (q: string) => void
  uploading?: boolean
}

export default function FileTree({
  tree, selectedId, expandedIds,
  onSelect, onToggle, onRename, onDelete, onMove,
  onCreateFile, onCreateFolder, onUpload, onRefresh,
  searchQuery, onSearchChange, uploading,
}: FileTreeProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 根据搜索词按文件名精准子串匹配（不区分大小写）
  const filteredTree = useMemo(() => {
    if (!searchQuery.trim()) return tree

    const query = searchQuery.trim().toLowerCase()
    const filterNodes = (nodes: TreeNode[]): TreeNode[] => {
      return nodes.reduce<TreeNode[]>((acc, node) => {
        if (node.type === 'folder') {
          const filteredChildren = filterNodes(node.children || [])
          if (filteredChildren.length > 0) {
            acc.push({ ...node, children: filteredChildren })
          }
        } else if (node.type === 'document' && node.name.toLowerCase().includes(query)) {
          acc.push(node)
        }
        return acc
      }, [])
    }

    return filterNodes(tree)
  }, [tree, searchQuery])

  const hasQuery = !!searchQuery.trim()
  const noResults = hasQuery && filteredTree.length === 0

  // 搜索时自动展开包含匹配文档的文件夹
  const effectiveExpandedIds = useMemo(() => {
    if (!hasQuery) return expandedIds
    const folderIds = new Set(expandedIds)
    const collectFolderIds = (nodes: TreeNode[]) => {
      nodes.forEach(node => {
        if (node.type === 'folder' && node.children && node.children.length > 0) {
          folderIds.add(node.id)
          collectFolderIds(node.children)
        }
      })
    }
    collectFolderIds(filteredTree)
    return folderIds
  }, [expandedIds, filteredTree, hasQuery])

  return (
    <div className="flex flex-col h-full">
      {/* 工具栏 */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-surface-200/60">
        <button
          onClick={() => onCreateFile(null)}
          className="p-1.5 rounded-lg hover:bg-surface-100 text-surface-500 hover:text-primary-600 transition-colors"
          title="新建文件"
        >
          <Plus size={16} />
        </button>
        <button
          onClick={() => onCreateFolder(null)}
          className="p-1.5 rounded-lg hover:bg-surface-100 text-surface-500 hover:text-amber-600 transition-colors"
          title="新建文件夹"
        >
          <FolderPlus size={16} />
        </button>
        <button
          onClick={onUpload}
          disabled={uploading}
          className="p-1.5 rounded-lg hover:bg-surface-100 text-surface-500 hover:text-primary-600 transition-colors disabled:opacity-40"
          title="上传文档"
        >
          <Upload size={14} />
        </button>
        <button
          onClick={onRefresh}
          className="p-1.5 rounded-lg hover:bg-surface-100 text-surface-400 hover:text-surface-600 transition-colors ml-auto"
          title="刷新"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* 搜索框 */}
      <div className="px-2 py-1">
        <div className="relative">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-surface-300" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="搜索文件..."
            className="w-full pl-6 pr-2 py-1 text-[12px] bg-surface-50 rounded-md border-none outline-none focus:ring-1 focus:ring-primary-300 placeholder-surface-300"
          />
        </div>
      </div>

      {/* 文件树 */}
      <div className="flex-1 overflow-y-auto py-1">
        {noResults ? (
          <div className="px-3 py-6 text-center">
            <Search size={20} className="text-surface-300 mx-auto mb-2" />
            <p className="text-xs text-surface-400 mb-1">未找到匹配的文件</p>
            <p className="text-[11px] text-surface-300">尝试使用不同的关键词</p>
          </div>
        ) : filteredTree.length === 0 ? (
          tree.length === 0 ? (
            <div className="px-3 py-6 text-center">
              <p className="text-xs text-surface-400 mb-2">还没有文件</p>
              <button
                onClick={onUpload}
                className="text-xs text-primary-500 font-medium hover:underline"
              >
                上传第一个文档
              </button>
            </div>
          ) : (
            <div className="px-3 py-6 text-center">
              <p className="text-xs text-surface-400">无匹配结果</p>
            </div>
          )
        ) : (
          filteredTree.map((node) => (
            <FileTreeNode
              key={node.id}
              node={node}
              depth={0}
              selectedId={selectedId}
              expandedIds={effectiveExpandedIds}
              onSelect={onSelect}
              onToggle={onToggle}
              onRename={onRename}
              onDelete={onDelete}
              onMove={onMove}
              onCreateFile={onCreateFile}
              onCreateFolder={onCreateFolder}
            />
          ))
        )}
      </div>

      {/* 隐藏的文件选择器 */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.doc,.txt,.md"
        className="hidden"
      />
    </div>
  )
}
