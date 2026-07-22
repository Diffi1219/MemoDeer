import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Loader2, FlipVertical, Lightbulb, Sparkles, X as XIcon,
  ExternalLink, Trash2, Edit3, Check, BookOpen, AlertTriangle, FileText
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import apiClient from '../../api/client'
import PremiumGate from './PremiumGate'

interface CardItem {
  id: string; title: string; front: string; back: string; tags: string[];
  knowledge_point_id?: string; document_id?: string; document_name?: string; chunk_id?: string
}
interface MnemonicItem {
  id: string; title: string; content: string; source_doc: string; tip: string
}
interface NotebookItem {
  id: string; title: string; document_count: number
}
interface DocumentItem {
  id: string; filename: string; file_type: string; status: string
}

interface Props { notebookId?: string; onGoToSource?: () => void }

export default function KnowledgePanel({ notebookId: propNotebookId, onGoToSource }: Props) {
  const isPremium = useAuthStore((s) => s.isPremium)
  const navigate = useNavigate()

  // 笔记本选择
  const [notebooks, setNotebooks] = useState<NotebookItem[]>([])
  const [selectedNbId, setSelectedNbId] = useState<string>(propNotebookId || '')
  const [loadingNotebooks, setLoadingNotebooks] = useState(false)
  const [showNotebookPicker, setShowNotebookPicker] = useState(false)

  // 文档选择（生成前）
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [showDocPicker, setShowDocPicker] = useState(false)
  const [tempSelectedDocIds, setTempSelectedDocIds] = useState<Set<string>>(new Set())

  // 卡片 & 口诀
  const [cards, setCards] = useState<CardItem[]>([])
  const [mnemonics, setMnemonics] = useState<MnemonicItem[]>([])
  const [loading, setLoading] = useState(false)
  const [generated, setGenerated] = useState(false)
  const [error, setError] = useState('')

  // 编辑状态
  const [editingCard, setEditingCard] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ title: '', front: '', back: '', tags: '' })

  // UI
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [flipped, setFlipped] = useState<Set<string>>(new Set())
  const [previewCard, setPreviewCard] = useState<CardItem | null>(null)

  // 错题
  const [wrongCounts, setWrongCounts] = useState<Record<string, number>>({})
  const [showWrongModal, setShowWrongModal] = useState(false)
  const [wrongAnswers, setWrongAnswers] = useState<any[]>([])
  const [loadingWrong, setLoadingWrong] = useState(false)

  // 加载笔记本列表
  useEffect(() => {
    if (!isPremium) return
    setLoadingNotebooks(true)
    apiClient.get('/notebooks')
      .then(r => setNotebooks(r.data || []))
      .catch(() => {})
      .finally(() => setLoadingNotebooks(false))
  }, [isPremium])

  // 自动使用 prop notebookId
  useEffect(() => {
    if (propNotebookId) setSelectedNbId(propNotebookId)
  }, [propNotebookId])

  // 加载已有卡片（从后端读取持久化数据）
  useEffect(() => {
    if (selectedNbId) { loadCards(); loadDocuments() }
  }, [selectedNbId])

  // 加载错题统计
  useEffect(() => {
    if (selectedNbId) fetchWrongStats()
  }, [selectedNbId])

  const allTags = [...new Set(cards.flatMap(c => c.tags))]
  const filteredCards = activeTag ? cards.filter(c => c.tags.includes(activeTag)) : cards

  const toggleFlip = (id: string) => {
    setFlipped(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const loadCards = async () => {
    if (!selectedNbId) return
    try {
      const r = await apiClient.get(`/notebooks/${selectedNbId}/premium/cards`)
      const loaded = r.data.cards || []
      if (loaded.length > 0) {
        setCards(loaded)
        setGenerated(true)
        setError('')
      } else {
        // 无已有卡片，保持空状态
        setCards([])
        setGenerated(false)
        setError('')
      }
    } catch (err: any) {
      // 403 → 会员可能已过期，同步状态到 authStore
      if (err.response?.status === 403) {
        useAuthStore.getState().setPremium(false, 'free', null)
      }
      setError(err.response?.status === 403
        ? '会员已过期，请续费后查看知识卡片'
        : '加载知识卡片失败，请检查网络连接')
    }
  }

  const loadDocuments = async () => {
    if (!selectedNbId) return
    try {
      const r = await apiClient.get(`/notebooks/${selectedNbId}/documents`)
      setDocuments(r.data || [])
    } catch {
      setDocuments([])
    }
  }

  const handleGenerate = async (docIds?: string[]) => {
    if (!selectedNbId) return
    setLoading(true)
    setError('')
    try {
      await apiClient.post(`/notebooks/${selectedNbId}/premium/generate`, {
        document_ids: docIds ?? [],
      })
      // 生成后重新加载，获取持久化的真实 ID
      await loadCards()
      setMnemonics([])  // 口诀暂不持久化，保持空
      setFlipped(new Set())
      setActiveTag(null)
      setEditingCard(null)
      fetchWrongStats()
    } catch (err: any) {
      setError(err.response?.data?.detail || '生成失败，请确保笔记本中有文档内容')
    } finally {
      setLoading(false)
    }
  }

  // 打开文档选择器
  const openDocPicker = async () => {
    let docs = documents
    // 如果文档列表未加载，先加载
    if (docs.length === 0 && selectedNbId) {
      try {
        const r = await apiClient.get(`/notebooks/${selectedNbId}/documents`)
        docs = r.data || []
        setDocuments(docs)
      } catch { /* ignore */ }
    }
    // 默认全选已完成文档
    const completedIds = docs
      .filter(d => d.status === 'completed')
      .map(d => d.id)
    setTempSelectedDocIds(new Set(completedIds))
    setShowDocPicker(true)
  }

  const toggleDocSelection = (docId: string) => {
    setTempSelectedDocIds(prev => {
      const next = new Set(prev)
      if (next.has(docId)) next.delete(docId); else next.add(docId)
      return next
    })
  }

  const toggleAllDocs = () => {
    const completed = documents.filter(d => d.status === 'completed')
    if (tempSelectedDocIds.size === completed.length) {
      setTempSelectedDocIds(new Set())
    } else {
      setTempSelectedDocIds(new Set(completed.map(d => d.id)))
    }
  }

  const confirmGenerate = () => {
    setShowDocPicker(false)
    const docIds = Array.from(tempSelectedDocIds)
    handleGenerate(docIds.length > 0 ? docIds : undefined)
  }

  const fetchWrongStats = async () => {
    if (!selectedNbId) return
    try {
      const r = await apiClient.get(`/notebooks/${selectedNbId}/quiz/wrong-stats`)
      setWrongCounts(r.data.wrong_counts || {})
    } catch { /* ignore */ }
  }

  const openWrongBook = async () => {
    if (!selectedNbId) return
    setShowWrongModal(true)
    setLoadingWrong(true)
    try {
      const r = await apiClient.get(`/notebooks/${selectedNbId}/quiz/wrong-answers`)
      setWrongAnswers(r.data.wrong_answers || [])
    } catch { setWrongAnswers([]) }
    finally { setLoadingWrong(false) }
  }

  // ── 编辑卡片 ──
  const startEdit = (card: CardItem, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingCard(card.id)
    setEditForm({ title: card.title, front: card.front, back: card.back, tags: card.tags.join(', ') })
  }
  const saveEdit = async (cardId: string) => {
    const newTags = editForm.tags.split(',').map(t => t.trim()).filter(Boolean)
    setCards(prev => prev.map(c =>
      c.id === cardId
        ? { ...c, title: editForm.title, front: editForm.front, back: editForm.back, tags: newTags }
        : c
    ))
    setEditingCard(null)

    // 持久化到后端
    try {
      await apiClient.put(`/notebooks/${selectedNbId}/premium/cards/${cardId}`, {
        title: editForm.title,
        front: editForm.front,
        back: editForm.back,
        tags: JSON.stringify(newTags),
      })
    } catch { /* 静默失败 */ }
  }
  const cancelEdit = () => setEditingCard(null)

  // ── 文档选择器弹窗（独立组件渲染函数，在多处复用）──
  const renderDocPicker = () => (
    <>
      {showDocPicker && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
          onClick={() => setShowDocPicker(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md mx-4 shadow-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-surface-200">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-primary-500" />
                <span className="text-sm font-semibold text-surface-700">选择生成来源</span>
              </div>
              <button onClick={() => setShowDocPicker(false)} className="p-1 hover:bg-surface-100 rounded-lg">
                <XIcon size={18} />
              </button>
            </div>

            <div className="px-4 py-2 bg-surface-50 border-b border-surface-100">
              <p className="text-xs text-surface-400">
                笔记本：{notebooks.find(n => n.id === selectedNbId)?.title || selectedNbId}
                <span className="ml-2 text-surface-300">
                  （共 {documents.filter(d => d.status === 'completed').length} 篇已完成文档）
                </span>
              </p>
            </div>

            <div className="overflow-y-auto flex-1 px-4 py-2">
              {documents.length === 0 ? (
                <div className="text-center py-8">
                  <Loader2 size={24} className="animate-spin text-surface-300 mx-auto mb-2" />
                  <p className="text-xs text-surface-400">加载文档列表...</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <button
                      onClick={toggleAllDocs}
                      className="text-xs text-primary-500 hover:text-primary-700"
                    >
                      {tempSelectedDocIds.size === documents.filter(d => d.status === 'completed').length
                        ? '取消全选'
                        : '全选已完成文档'}
                    </button>
                    <span className="text-xs text-surface-400">
                      已选 {tempSelectedDocIds.size} 篇
                    </span>
                  </div>

                  <div className="space-y-1">
                    {documents.map(doc => {
                      const isCompleted = doc.status === 'completed'
                      const isSelected = tempSelectedDocIds.has(doc.id)
                      return (
                        <button
                          key={doc.id}
                          onClick={() => isCompleted && toggleDocSelection(doc.id)}
                          disabled={!isCompleted}
                          className={`w-full text-left p-3 rounded-xl border transition-colors flex items-center gap-3 ${
                            !isCompleted
                              ? 'border-surface-100 bg-surface-50 opacity-50 cursor-not-allowed'
                              : isSelected
                              ? 'border-primary-400 bg-primary-50'
                              : 'border-surface-200 hover:border-primary-200'
                          }`}
                        >
                          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                            isSelected ? 'bg-primary-500 border-primary-500' : 'border-surface-300'
                          }`}>
                            {isSelected && <Check size={12} className="text-white" />}
                          </div>
                          <FileText size={16} className={`flex-shrink-0 ${isCompleted ? 'text-surface-400' : 'text-surface-300'}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-surface-700 truncate">{doc.filename}</p>
                            <p className="text-xs text-surface-400">
                              {doc.file_type?.toUpperCase()} · {isCompleted ? '已完成' : doc.status}
                            </p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
            </div>

            <div className="px-4 py-3 border-t border-surface-200 flex gap-2">
              <button
                onClick={() => setShowDocPicker(false)}
                className="flex-1 py-2 border border-surface-200 text-surface-500 text-sm rounded-xl hover:bg-surface-50"
              >
                取消
              </button>
              <button
                onClick={confirmGenerate}
                disabled={tempSelectedDocIds.size === 0}
                className={`flex-1 py-2 text-white text-sm rounded-xl font-medium flex items-center justify-center gap-2 ${
                  tempSelectedDocIds.size === 0
                    ? 'bg-surface-300 cursor-not-allowed'
                    : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600'
                }`}
              >
                <Sparkles size={14} />
                开始生成 ({tempSelectedDocIds.size}篇)
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )

  // ── 删除卡片 ──
  const deleteCard = async (cardId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setCards(prev => prev.filter(c => c.id !== cardId))
    // 持久化删除
    try {
      await apiClient.delete(`/notebooks/${selectedNbId}/premium/cards/${cardId}`)
    } catch { /* 静默失败 */ }
  }

  if (!isPremium) {
    return (
      <PremiumGate
        feature="知识卡片与口诀"
        icon={<FlipVertical size={30} className="text-white" />}
        description="AI 从你的知识库中提取核心概念生成正反面翻转卡片，同时为难点编创朗朗上口的记忆口诀。支持标签筛选、翻转查看、编辑修改。"
      />
    )
  }

  // ── 笔记本选择弹窗 ──
  if (showNotebookPicker) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-surface-700">选择笔记本</h3>
            <button onClick={() => setShowNotebookPicker(false)} className="p-1 hover:bg-surface-100 rounded-lg">
              <XIcon size={18} />
            </button>
          </div>
          {loadingNotebooks ? (
            <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-surface-300" /></div>
          ) : (
            <div className="space-y-2">
              {notebooks.map(nb => (
                <button
                  key={nb.id}
                  onClick={() => { setSelectedNbId(nb.id); setShowNotebookPicker(false); }}
                  className={`w-full text-left p-3 rounded-xl border-2 transition-colors ${
                    selectedNbId === nb.id ? 'border-primary-400 bg-primary-50' : 'border-surface-200 hover:border-primary-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <BookOpen size={16} className="text-primary-400" />
                    <span className="text-sm font-medium text-surface-700">{nb.title}</span>
                    <span className="text-xs text-surface-400 ml-auto">{nb.document_count} 文档</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── 空状态 ──
  if (!generated && !loading) {
    return (
      <>
        <div className="h-full overflow-y-auto">
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="w-20 h-20 bg-amber-100 rounded-2xl flex items-center justify-center mb-4">
              <Sparkles size={36} className="text-amber-500" />
            </div>
            <h3 className="text-lg font-semibold text-surface-700 mb-1">AI 知识卡片</h3>
            <p className="text-sm text-surface-400 text-center mb-2 max-w-xs">
              基于笔记本中的文档，AI 自动生成知识卡片和记忆口诀
            </p>
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-3">
                <p className="text-sm text-red-600">{error}</p>
                {error.includes('会员') && (
                  <button onClick={() => navigate('/membership')} className="mt-2 text-xs text-white bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded-lg">
                    去续费
                  </button>
                )}
              </div>
            )}
            {selectedNbId && notebooks.length > 0 && (
              <p className="text-xs text-surface-400 mb-4">
                当前笔记本：{notebooks.find(n => n.id === selectedNbId)?.title || selectedNbId}
              </p>
            )}
            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  if (propNotebookId && selectedNbId) {
                    openDocPicker()
                  } else {
                    setShowNotebookPicker(true)
                  }
                }}
                className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-medium hover:from-amber-600 hover:to-orange-600 shadow-lg shadow-amber-200 flex items-center gap-2"
              >
                <Sparkles size={18} />
                生成知识卡片
              </button>
              {!propNotebookId && (
                <button
                  onClick={() => setShowNotebookPicker(true)}
                  className="text-sm text-primary-500 hover:underline"
                >
                  选择其他笔记本
                </button>
              )}
            </div>
          </div>
        </div>
        {renderDocPicker()}
      </>
    )
  }

  // ── 加载中 ──
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={36} className="animate-spin text-amber-500 mx-auto mb-3" />
          <p className="text-sm text-surface-500">AI 正在分析文档内容...</p>
          <p className="text-xs text-surface-400 mt-1">正在生成知识卡片和记忆口诀</p>
        </div>
      </div>
    )
  }

  // ── 卡片展示 ──
  return (
    <div className="h-full overflow-y-auto">
      <div className="px-4 py-3 pb-20">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-surface-700">
            📚 知识卡片 ({cards.length}) · 口诀 ({mnemonics.length})
          </h3>
          <div className="flex items-center gap-2">
            {Object.keys(wrongCounts).length > 0 && (
              <button
                onClick={openWrongBook}
                className="px-2.5 py-1.5 text-xs bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 flex items-center gap-1"
              >
                <AlertTriangle size={12} /> 错题本
              </button>
            )}
            {!propNotebookId && (
              <button
                onClick={() => setShowNotebookPicker(true)}
                className="px-2.5 py-1.5 text-xs bg-surface-100 text-surface-500 rounded-lg hover:bg-surface-200 flex items-center gap-1"
              >
                <BookOpen size={12} /> 切换笔记本
              </button>
            )}
            <button
              onClick={openDocPicker}
              disabled={loading}
              className="px-2.5 py-1.5 text-xs bg-amber-50 text-amber-600 border border-amber-200 rounded-lg hover:bg-amber-100 flex items-center gap-1"
            >
              <Sparkles size={12} /> 重新生成
            </button>
          </div>
        </div>

        {/* ====== 知识卡片 ====== */}
        <h4 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2 flex items-center gap-1">
          <FlipVertical size={12} /> 翻转卡片
        </h4>

        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            <button
              onClick={() => setActiveTag(null)}
              className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                !activeTag ? 'bg-primary-100 text-primary-600' : 'bg-surface-100 text-surface-400 hover:bg-surface-200'
              }`}
            >全部</button>
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => setActiveTag(tag === activeTag ? null : tag)}
                className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                  tag === activeTag ? 'bg-primary-100 text-primary-600' : 'bg-surface-100 text-surface-400 hover:bg-surface-200'
                }`}
              >{tag}</button>
            ))}
          </div>
        )}

        {filteredCards.length === 0 ? (
          <p className="text-xs text-surface-400 text-center py-4">该分类下暂无卡片</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            {filteredCards.map(card => {
              const isFlipped = flipped.has(card.id)
              const isEditing = editingCard === card.id

              if (isEditing) {
                return (
                  <div key={card.id} className="bg-white rounded-xl border-2 border-primary-400 p-4">
                    <input
                      value={editForm.title}
                      onChange={e => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                      className="w-full text-sm font-semibold mb-2 px-2 py-1 border border-surface-200 rounded"
                      placeholder="标题"
                    />
                    <textarea
                      value={editForm.front}
                      onChange={e => setEditForm(prev => ({ ...prev, front: e.target.value }))}
                      className="w-full text-xs mb-2 px-2 py-1 border border-surface-200 rounded resize-none"
                      rows={2} placeholder="正面（问题）"
                    />
                    <textarea
                      value={editForm.back}
                      onChange={e => setEditForm(prev => ({ ...prev, back: e.target.value }))}
                      className="w-full text-xs mb-2 px-2 py-1 border border-surface-200 rounded resize-none"
                      rows={3} placeholder="背面（答案）"
                    />
                    <input
                      value={editForm.tags}
                      onChange={e => setEditForm(prev => ({ ...prev, tags: e.target.value }))}
                      className="w-full text-xs px-2 py-1 border border-surface-200 rounded"
                      placeholder="标签（逗号分隔）"
                    />
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => saveEdit(card.id)} className="flex-1 py-1.5 bg-primary-500 text-white text-xs rounded-lg font-medium flex items-center justify-center gap-1">
                        <Check size={12} /> 保存
                      </button>
                      <button onClick={cancelEdit} className="flex-1 py-1.5 border border-surface-200 text-xs rounded-lg text-surface-500">
                        取消
                      </button>
                    </div>
                  </div>
                )
              }

              return (
                <div
                  key={card.id}
                  onClick={() => {
                    if (window.innerWidth < 640) setPreviewCard(card)
                    else toggleFlip(card.id)
                  }}
                  className="bg-white rounded-xl border border-surface-200 p-4 cursor-pointer hover:border-primary-300 hover:shadow-sm transition duration-200 active:scale-[0.97] group relative"
                >
                  {/* 操作按钮 */}
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => startEdit(card, e)}
                      className="p-1 hover:bg-primary-50 rounded text-surface-400 hover:text-primary-500"
                      title="编辑"
                    ><Edit3 size={12} /></button>
                    <button
                      onClick={(e) => deleteCard(card.id, e)}
                      className="p-1 hover:bg-red-50 rounded text-surface-400 hover:text-red-500"
                      title="删除"
                    ><Trash2 size={12} /></button>
                  </div>

                  <h4 className="text-sm font-semibold text-surface-800 mb-1.5 pr-12">
                    {card.title}
                    {card.knowledge_point_id && wrongCounts[card.knowledge_point_id] > 0 && (
                      <span className="ml-1.5 text-xs text-red-500 font-normal">
                        ({wrongCounts[card.knowledge_point_id]}次答错)
                      </span>
                    )}
                  </h4>
                  <p className="text-xs text-surface-500 leading-relaxed line-clamp-3">
                    {isFlipped ? card.back : card.front}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex gap-1">
                      {card.tags.slice(0, 2).map(t => (
                        <span key={t} className="text-xs px-1.5 py-0.5 bg-surface-100 text-surface-400 rounded">{t}</span>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      {isFlipped && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            if (card.document_id) {
                              const highlightParam = card.chunk_id ? `?highlight=${card.chunk_id}` : ''
                              navigate(`/document/${card.document_id}/view${highlightParam}`)
                            } else if (onGoToSource) {
                              onGoToSource()
                            } else {
                              navigate(`/notebook/${selectedNbId}`)
                            }
                          }}
                          className="text-xs text-primary-500 hover:text-primary-700 flex items-center gap-0.5"
                          title={card.document_name ? `来源: ${card.document_name}` : '查看来源'}
                        ><ExternalLink size={10} /> {card.document_name ? card.document_name : '来源'}</button>
                      )}
                      <span className="text-xs text-surface-300">{isFlipped ? '背面' : '点击翻转'}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ====== 记忆口诀 ====== */}
        {mnemonics.length > 0 && <div className="border-t border-surface-200 my-4" />}
        {mnemonics.length > 0 && (
          <>
            <h4 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2 flex items-center gap-1">
              <Lightbulb size={12} /> 记忆口诀
            </h4>
            <div className="space-y-3">
              {mnemonics.map(item => (
                <div key={item.id} className="bg-white rounded-xl border border-surface-200 overflow-hidden">
                  <div className="px-4 py-3 border-b border-surface-100 flex items-center gap-2">
                    <Lightbulb size={16} className="text-amber-400 flex-shrink-0" />
                    <h4 className="text-sm font-semibold text-surface-700">{item.title}</h4>
                    {item.source_doc && <span className="text-xs text-surface-300 ml-auto">📎 {item.source_doc}</span>}
                  </div>
                  <div className="px-4 py-3">
                    <p className="text-sm text-surface-600 leading-relaxed italic whitespace-pre-line">"{item.content}"</p>
                    {item.tip && (
                      <div className="mt-2 flex items-start gap-1.5">
                        <span className="text-xs text-amber-500">💡</span>
                        <span className="text-xs text-amber-600">{item.tip}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Mobile preview modal */}
      {previewCard && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:hidden justify-center" onClick={() => setPreviewCard(null)}>
          <div className="bg-white rounded-t-2xl w-full p-6 max-h-[70vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">{previewCard.title}</h3>
              <button onClick={() => setPreviewCard(null)} className="p-1"><XIcon size={20} /></button>
            </div>
            <div className="space-y-3">
              <div><p className="text-xs text-surface-400 mb-1">📝 正面</p><p className="text-sm text-surface-700">{previewCard.front}</p></div>
              <div><p className="text-xs text-surface-400 mb-1">💡 背面</p><p className="text-sm text-surface-700 whitespace-pre-line">{previewCard.back}</p></div>
              <div className="flex gap-1">
                {previewCard.tags.map(t => <span key={t} className="text-xs px-2 py-0.5 bg-surface-100 text-surface-400 rounded-full">{t}</span>)}
              </div>
              <button
                onClick={() => {
                  setPreviewCard(null)
                  if (previewCard.document_id) {
                    const highlightParam = previewCard.chunk_id ? `?highlight=${previewCard.chunk_id}` : ''
                    navigate(`/document/${previewCard.document_id}/view${highlightParam}`)
                  } else if (onGoToSource) {
                    onGoToSource()
                  } else {
                    navigate(`/notebook/${selectedNbId}`)
                  }
                }}
                className="w-full py-2.5 bg-primary-500 text-white text-sm rounded-xl font-medium hover:bg-primary-600 flex items-center justify-center gap-2"
              ><ExternalLink size={14} /> {previewCard.document_name ? `查看原文: ${previewCard.document_name}` : '查看笔记本原文'}</button>
            </div>
          </div>
        </div>
      )}

      {/* 错题本弹窗 */}
      {showWrongModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
          onClick={() => setShowWrongModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg mx-4 shadow-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-surface-200">
              <div className="flex items-center gap-2 text-sm font-semibold text-surface-700">
                <AlertTriangle size={16} className="text-red-500" /> 错题本
              </div>
              <button onClick={() => setShowWrongModal(false)} className="p-1 hover:bg-surface-100 rounded-lg">
                <XIcon size={18} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              {loadingWrong ? (
                <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-surface-300" /></div>
              ) : wrongAnswers.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <AlertTriangle size={36} className="text-surface-200 mx-auto mb-2" />
                  <p className="text-sm text-surface-400">暂无错题记录</p>
                  <p className="text-xs text-surface-300 mt-1">完成出题练习后，答错的题目会出现在这里</p>
                </div>
              ) : (
                <div className="px-4 py-3 space-y-3">
                  {wrongAnswers.map((wa: any, i: number) => (
                    <div key={wa.id || i} className="p-3 rounded-xl border border-surface-200 bg-surface-50">
                      <p className="text-xs text-surface-500 mb-1">Q: {wa.question}</p>
                      <div className="flex gap-4 text-xs">
                        <span className="text-red-500">你的答案: {wa.user_answer || '(未作答)'}</span>
                        <span className="text-green-600">正确答案: {wa.correct_answer}</span>
                      </div>
                      {wa.explanation && (
                        <p className="text-xs text-surface-400 mt-1">💡 {wa.explanation}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 文档选择弹窗 — 生成卡片前选择来源文档 */}
      {renderDocPicker()}
    </div>
  )
}
