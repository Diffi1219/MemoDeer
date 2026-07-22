import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import apiClient from '../../api/client'
import { useUIStore } from '../../store/uiStore'
import { Search, BookOpen, ChevronRight, ChevronDown, X, Loader2, FileText } from 'lucide-react'

interface ChunkResult {
  chunk_id: string
  document_name: string
  content: string
  score: number
}

interface NotebookResult {
  notebook_id: string
  notebook_title: string
  match_count: number
  chunks: ChunkResult[]
}

export default function GlobalSearchModal() {
  const isOpen = useUIStore((s) => s.isGlobalSearchOpen)
  const close = useUIStore((s) => s.closeGlobalSearch)
  const navigate = useNavigate()

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<NotebookResult[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  if (!isOpen) return null

  const toggleNotebook = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSearch = async () => {
    if (!query.trim()) return
    setSearching(true)
    try {
      const res = await apiClient.post('/search', {
        query: query.trim(),
        top_k: 5,
      })
      setResults(res.data.notebooks || [])
      setExpanded(new Set())
    } catch {
      setResults([])
    } finally {
      setSearching(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch()
    if (e.key === 'Escape') close()
  }

  const handleClose = () => {
    close()
    setQuery('')
    setResults(null)
    setExpanded(new Set())
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start sm:items-center justify-center pt-20 sm:pt-0" onClick={handleClose}>
      <div
        className="bg-white rounded-2xl w-full sm:max-w-lg mx-4 max-h-[80vh] flex flex-col shadow-xl animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 搜索输入区 */}
        <div className="p-4 border-b border-surface-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold">全局搜索</h3>
            <button onClick={handleClose} className="p-1 hover:bg-surface-100 rounded-lg">
              <X size={20} />
            </button>
          </div>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-300" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="搜索所有笔记本中的内容..."
                className="w-full pl-9 pr-4 py-2.5 bg-surface-50 rounded-xl text-sm border border-surface-200 focus:border-primary-500 outline-none"
                autoFocus
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={searching || !query.trim()}
              className="px-4 py-2.5 bg-primary-500 text-white text-sm font-medium rounded-xl hover:bg-primary-600 disabled:opacity-50 flex items-center gap-1"
            >
              {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              搜索
            </button>
          </div>
        </div>

        {/* 结果区 */}
        <div className="flex-1 overflow-y-auto p-4">
          {results === null && !searching && (
            <div className="text-center py-12">
              <Search size={40} className="text-surface-200 mx-auto mb-3" />
              <p className="text-sm text-surface-400">输入关键词搜索所有笔记本</p>
            </div>
          )}

          {searching && (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={28} className="animate-spin text-surface-300" />
            </div>
          )}

          {results !== null && !searching && results.length === 0 && (
            <div className="text-center py-12">
              <FileText size={40} className="text-surface-200 mx-auto mb-3" />
              <p className="text-sm text-surface-400">未找到相关内容</p>
            </div>
          )}

          {results !== null && results.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs text-surface-400">
                在 {results.length} 个笔记本中找到匹配结果
              </p>
              {results.map((nb) => {
                const isExpanded = expanded.has(nb.notebook_id)
                const bestScore = nb.chunks.length > 0 ? nb.chunks[0].score : 0
                return (
                  <div key={nb.notebook_id} className="bg-white rounded-xl border border-surface-200 overflow-hidden">
                    {/* 笔记本卡片 */}
                    <button
                      onClick={() => toggleNotebook(nb.notebook_id)}
                      className="w-full flex items-center gap-3 p-3 text-left hover:bg-surface-50 transition-colors"
                    >
                      <BookOpen size={18} className="text-primary-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-surface-800 truncate">
                          {nb.notebook_title}
                        </p>
                        <p className="text-xs text-surface-400">
                          {nb.match_count} 个匹配 · 最佳相关度 {(bestScore * 100).toFixed(0)}%
                        </p>
                      </div>
                      {isExpanded ? <ChevronDown size={16} className="text-surface-400" /> : <ChevronRight size={16} className="text-surface-400" />}
                    </button>

                    {/* 展开的 chunks */}
                    {isExpanded && (
                      <div className="border-t border-surface-100 px-3 pb-3 space-y-2">
                        {nb.chunks.map((chunk, j) => (
                          <button
                            key={j}
                            onClick={() => {
                              handleClose()
                              if (chunk.chunk_id?.startsWith('kp_')) {
                                navigate(`/notebook/${nb.notebook_id}`)
                              } else {
                                navigate(`/document/${chunk.chunk_id.split('-')[0] || ''}/view?highlight=${chunk.chunk_id}`)
                              }
                            }}
                            className="w-full text-left bg-surface-50 rounded-lg p-2.5 hover:bg-primary-50 transition-colors"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-surface-400 truncate max-w-[70%]">
                                {chunk.document_name}
                              </span>
                              <span className="text-xs text-primary-500 flex-shrink-0">
                                相关度 {(chunk.score * 100).toFixed(0)}%
                              </span>
                            </div>
                            <p className="text-sm text-surface-700 line-clamp-2">{chunk.content}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
