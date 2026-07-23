import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { Loader2, AlertCircle, Eye, Edit3, Save, RefreshCw } from 'lucide-react'
import ObsidianMarkdown from '../components/common/ObsidianMarkdown'
import SelectionAsk from '../components/common/SelectionAsk'
import apiClient from '../api/client'
import PageHeader from '../components/layout/PageHeader'

interface ChunkData {
  id: string
  content: string
  chunk_index: number
}

interface DocumentContent {
  document_id: string
  document_name: string
  file_type: string
  chunks: ChunkData[]
}

export default function DocumentViewPage() {
  const { docId } = useParams<{ docId: string }>()
  const [searchParams] = useSearchParams()
  const highlightChunkId = searchParams.get('highlight') || ''
  const navigate = useNavigate()

  const [doc, setDoc] = useState<DocumentContent | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // 模式: view = 阅读, edit = 编辑
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [rawText, setRawText] = useState('')
  const [saving, setSaving] = useState(false)
  const [vectorizing, setVectorizing] = useState(false)
  const [showRevectorize, setShowRevectorize] = useState(false)

  const contentRef = useRef<HTMLDivElement>(null)
  const highlightRef = useRef<HTMLSpanElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // 加载文档
  useEffect(() => {
    if (!docId) return
    setLoading(true)
    setError('')
    apiClient
      .get(`/documents/${docId}/content`)
      .then((r) => {
        setDoc(r.data)
        const text = (r.data.chunks || []).map((c: ChunkData) => c.content).join('\n\n')
        setRawText(text)
      })
      .catch((err) => {
        if (err.response?.status === 404) {
          setError('文档不存在或无权访问')
        } else {
          setError('加载失败：' + (err.response?.data?.detail || err.message))
        }
      })
      .finally(() => setLoading(false))
  }, [docId])

  // 切换到编辑模式时聚焦 textarea
  useEffect(() => {
    if (mode === 'edit' && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [mode])

  // 全文文本 + 高亮位置
  const { fullText, highlightStart, highlightEnd } = useMemo(() => {
    if (!doc) return { fullText: '', highlightStart: -1, highlightEnd: -1 }
    const text = doc.chunks.map(c => c.content).join('\n\n')
    let start = -1, end = -1
    if (highlightChunkId) {
      const target = doc.chunks.find(c => c.id === highlightChunkId)
      if (target) {
        start = text.indexOf(target.content)
        if (start !== -1) end = start + target.content.length
      }
    }
    return { fullText: text, highlightStart: start, highlightEnd: end }
  }, [doc, highlightChunkId])

  // 高亮滚动
  useEffect(() => {
    if (!loading && highlightRef.current) {
      setTimeout(() => {
        highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 200)
    }
  }, [loading, highlightStart])

  // 保存
  const handleSave = async () => {
    if (!docId || !rawText.trim()) return
    setSaving(true)
    try {
      await apiClient.put(`/documents/${docId}/content`, { content: rawText.trim() })
      // 更新 doc 中的 chunks（简化：用单 chunk 表示全文）
      setDoc(prev => prev ? {
        ...prev,
        chunks: [{ id: 'full', content: rawText.trim(), chunk_index: 0 }],
      } : prev)
      setMode('view')
      setShowRevectorize(true)
    } catch (err: any) {
      alert('保存失败: ' + (err.response?.data?.detail || err.message))
    } finally {
      setSaving(false)
    }
  }

  // 重新向量化
  const handleRevectorize = async () => {
    if (!docId) return
    setVectorizing(true)
    try {
      await apiClient.post(`/documents/${docId}/re-vectorize`)
      setShowRevectorize(false)
      alert('向量化完成！文档已重新加入检索库。')
    } catch (err: any) {
      alert('向量化失败: ' + (err.response?.data?.detail || err.message))
    } finally {
      setVectorizing(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-0 flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={32} className="animate-spin text-primary-500 mx-auto mb-3" />
          <p className="text-surface-400 text-sm">加载文档中...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-surface-0 flex items-center justify-center">
        <div className="text-center max-w-sm">
          <AlertCircle size={48} className="text-danger/60 mx-auto mb-3" />
          <p className="text-surface-700 font-medium mb-1">加载失败</p>
          <p className="text-surface-400 text-sm mb-4">{error}</p>
          <button onClick={() => navigate(-1)} className="px-4 py-2 bg-primary-500 text-white rounded-lg text-sm hover:bg-primary-600">
            返回
          </button>
        </div>
      </div>
    )
  }

  if (!doc) return null

  return (
    <div className="h-screen bg-surface-0 flex flex-col">
      {/* Header */}
      <PageHeader
        title={doc.document_name}
        subtitle={`${mode === 'view' ? '阅读模式' : '编辑模式'} · ${doc.chunks.length} 段`}
        onBack={() => navigate(-1)}
        actions={
          <>
            {highlightChunkId && mode === 'view' && (
              <span className="text-xs px-2 py-1 bg-warning-50 text-warning-700 rounded-full flex-shrink-0 hidden sm:inline">
                已定位
              </span>
            )}
            <button
              onClick={() => {
                if (mode === 'view') {
                  const t = doc.chunks.map(c => c.content).join('\n\n')
                  setRawText(t)
                  setMode('edit')
                } else {
                  setMode('view')
                }
              }}
              className="p-2 hover:bg-surface-100 rounded-lg btn-press flex-shrink-0"
              title={mode === 'view' ? '编辑' : '预览'}
            >
              {mode === 'view' ? <Edit3 size={18} /> : <Eye size={18} />}
            </button>
            <button
              onClick={handleSave}
              disabled={mode === 'view' || saving}
              className="p-2 hover:bg-primary-50 rounded-lg btn-press flex-shrink-0 text-primary-500 disabled:text-surface-300"
              title="保存"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            </button>
          </>
        }
      />

      {/* Re-vectorize prompt bar */}
      {showRevectorize && (
        <div className="sticky top-[53px] z-10 flex items-center justify-between gap-2 px-4 py-2.5 bg-warning-light/40 border-b border-warning/20 text-sm">
          <span className="text-warning-700 dark:text-warning-400 text-xs">
            📊 内容已保存。检测到内容变化，是否重新向量化以更新检索库？
          </span>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={() => setShowRevectorize(false)}
              className="px-2.5 py-1 text-xs text-surface-400 hover:text-surface-600"
            >
              稍后
            </button>
            <button
              onClick={handleRevectorize}
              disabled={vectorizing}
              className="px-3 py-1 bg-warning text-white text-xs font-medium rounded-lg hover:bg-amber-600 disabled:opacity-50 flex items-center gap-1 btn-press"
            >
              {vectorizing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              {vectorizing ? '向量化中...' : '立即向量化'}
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto" ref={contentRef}>
        {mode === 'view' ? (
          /* ====== 阅读模式 ====== */
          <div className="max-w-3xl mx-auto px-6 py-8">
            {doc.chunks.length === 0 ? (
              <div className="text-center py-16">
                <AlertCircle size={40} className="text-surface-300 mx-auto mb-3" />
                <p className="text-surface-500 font-medium mb-1">文档内容为空</p>
                <p className="text-surface-400 text-sm">该文档处理时可能出现了问题</p>
              </div>
            ) : (
              <SelectionAsk>
                {highlightStart >= 0 ? (
                  <article className="prose prose-sm max-w-none">
                    <ObsidianMarkdown content={fullText.slice(0, highlightStart)} />
                    <span
                      ref={highlightRef}
                      id="chunk-highlight"
                      className="bg-warning-light ring-2 ring-warning/30 rounded-md px-2 py-1 block -mx-2 my-2"
                    >
                      <ObsidianMarkdown content={fullText.slice(highlightStart, highlightEnd)} />
                    </span>
                    <ObsidianMarkdown content={fullText.slice(highlightEnd)} />
                  </article>
                ) : (
                  <article className="prose prose-sm max-w-none">
                    <ObsidianMarkdown content={fullText} />
                  </article>
                )}
              </SelectionAsk>
            )}
            <div className="h-32" />
          </div>
        ) : (
          /* ====== 编辑模式 ====== */
          <div className="max-w-3xl mx-auto px-4 py-4">
            <textarea
              ref={textareaRef}
              value={rawText}
              onChange={e => setRawText(e.target.value)}
              className="w-full min-h-[calc(100vh-140px)] p-4 border border-surface-200 rounded-xl text-sm font-mono leading-relaxed resize-none focus:border-primary-500 outline-none"
              placeholder="在此编辑 Markdown 内容..."
              spellCheck={false}
            />
            <div className="h-32" />
          </div>
        )}
      </div>
    </div>
  )
}
