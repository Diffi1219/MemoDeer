import { useState } from 'react'
import { AlertTriangle, Loader2, X, Zap } from 'lucide-react'
import apiClient from '../../api/client'

interface PendingItem {
  document_id: string
  filename: string
  content_updated_at: string | null
}

interface PendingVectorizeBarProps {
  notebookId: string
  items: PendingItem[]
  onRefresh: () => void
}

export default function PendingVectorizeBar({ notebookId, items, onRefresh }: PendingVectorizeBarProps) {
  const [vectorizing, setVectorizing] = useState(false)
  const [vectorizingId, setVectorizingId] = useState<string | null>(null)

  if (items.length === 0) return null

  const handleVectorizeAll = async () => {
    setVectorizing(true)
    try {
      await apiClient.post(`/notebooks/${notebookId}/vectorize-all`)
      onRefresh()
    } catch (err) {
      console.error('批量向量化失败:', err)
    } finally {
      setVectorizing(false)
    }
  }

  const handleVectorizeOne = async (docId: string) => {
    setVectorizingId(docId)
    try {
      await apiClient.post(`/documents/${docId}/re-vectorize`)
      onRefresh()
    } catch (err) {
      console.error('向量化失败:', err)
    } finally {
      setVectorizingId(null)
    }
  }

  const visibleItems = items.slice(0, 3)
  const remaining = items.length - visibleItems.length

  return (
    <div className="border-t border-amber-200 bg-amber-50/80 backdrop-blur-sm px-3 py-2">
      <div className="flex items-center gap-2 flex-wrap">
        <AlertTriangle size={14} className="text-amber-500 flex-shrink-0" />
        <span className="text-xs text-amber-700 font-medium">
          待向量化 ({items.length}):
        </span>

        {visibleItems.map((item) => (
          <span
            key={item.document_id}
            className="inline-flex items-center gap-1 text-xs bg-white/80 text-surface-600 px-2 py-0.5 rounded-full border border-surface-200"
          >
            {item.filename}
            <button
              onClick={() => handleVectorizeOne(item.document_id)}
              disabled={vectorizingId === item.document_id}
              className="text-surface-400 hover:text-primary-500 disabled:opacity-50"
            >
              {vectorizingId === item.document_id
                ? <Loader2 size={10} className="animate-spin" />
                : <X size={10} />
              }
            </button>
          </span>
        ))}

        {remaining > 0 && (
          <span className="text-xs text-surface-400">+{remaining} 个</span>
        )}

        <button
          onClick={handleVectorizeAll}
          disabled={vectorizing}
          className="ml-auto flex items-center gap-1 px-3 py-1 bg-amber-500 text-white text-xs font-medium rounded-lg hover:bg-amber-600 disabled:opacity-50 transition-colors btn-press"
        >
          {vectorizing ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Zap size={12} />
          )}
          {vectorizing ? '向量化中...' : '一键向量化'}
        </button>
      </div>
    </div>
  )
}
