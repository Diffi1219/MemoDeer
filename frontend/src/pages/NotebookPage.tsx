import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import apiClient from '../api/client'
import { useUIStore } from '../store/uiStore'
import { useAuthStore } from '../store/authStore'
import {
  ArrowLeft, Menu, Search, MessageCircle, Upload, Loader2,
  X, FileText, FlipVertical, GraduationCap, Crown, Send
} from 'lucide-react'
import FileTree from '../components/file-tree/FileTree'
import { type TreeNode } from '../components/file-tree/FileTreeNode'
import MarkdownEditor from '../components/editor/MarkdownEditor'
import ChatPanel from '../components/chat/ChatPanel'
import PendingVectorizeBar from '../components/common/PendingVectorizeBar'
import KnowledgePanel from '../components/common/KnowledgePanel'
import ReactMarkdown from 'react-markdown'

interface PendingItem {
  document_id: string
  filename: string
  content_updated_at: string | null
}

interface KnowledgePoint {
  id: string; notebook_id: string; document_id?: string
  title: string; content: string; tags: string; created_at: string
}

type TabKey = 'files' | 'cards' | 'quiz'

export default function NotebookPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isPremium = useAuthStore((s) => s.isPremium)

  // UI state
  const toggleDrawer = useUIStore((s) => s.toggleDrawer)

  // Notebook data
  const [notebook, setNotebook] = useState<any>(null)
  const [tree, setTree] = useState<TreeNode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // File tree state
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [fileSearchQuery, setFileSearchQuery] = useState('')

  // Tab state
  const [activeTab, setActiveTab] = useState<TabKey>('files')

  // Upload
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Document content cache
  const [docContent, setDocContent] = useState<string>('')
  const [docLoading, setDocLoading] = useState(false)

  // Pending vectorization
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([])

  // Create file/folder modals
  const [createModal, setCreateModal] = useState<{ type: 'file' | 'folder'; parentId: string | null } | null>(null)
  const [createName, setCreateName] = useState('')
  const [creating, setCreating] = useState(false)

  // Search
  const [searchResults, setSearchResults] = useState<any[] | null>(null)
  const [searching, setSearching] = useState(false)

  // AI 选中问答弹窗
  const [askModal, setAskModal] = useState<{ show: boolean; text: string; question: string; answer: string; loading: boolean }>({
    show: false, text: '', question: '', answer: '', loading: false,
  })

  // ====== Data Loading ======

  const loadTree = useCallback(async () => {
    if (!id) return
    try {
      const [nbRes, treeRes, pendingRes] = await Promise.all([
        apiClient.get(`/notebooks/${id}`),
        apiClient.get(`/notebooks/${id}/tree`),
        apiClient.get(`/notebooks/${id}/pending-vectorization`),
      ])
      setNotebook(nbRes.data)
      setTree(treeRes.data.tree || [])
      setPendingItems(pendingRes.data.items || [])
    } catch (err: any) {
      setError(err.response?.data?.detail || '加载失败')
    }
  }, [id])

  useEffect(() => {
    setLoading(true)
    loadTree().then(() => setLoading(false))
  }, [loadTree])

  // ====== File Operations ======

  const handleSelectNode = async (node: TreeNode) => {
    setSelectedNode(node)
    setActiveTab('files')

    if (node.type === 'document' && node.status === 'completed') {
      setDocLoading(true)
      try {
        const res = await apiClient.get(`/documents/${node.id}/content`)
        const text = (res.data.chunks || []).map((c: any) => c.content).join('\n\n')
        setDocContent(text)
      } catch {
        setDocContent('')
      } finally {
        setDocLoading(false)
      }
    }
  }

  const handleToggle = (nodeId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(nodeId)) next.delete(nodeId)
      else next.add(nodeId)
      return next
    })
  }

  const handleRename = async (node: TreeNode) => {
    const newName = node.name
    try {
      if (node.type === 'folder') {
        await apiClient.put(`/folders/${node.id}`, { name: newName })
      } else {
        await apiClient.put(`/documents/${node.id}`, { filename: newName })
      }
      loadTree()
    } catch (err: any) {
      alert('重命名失败: ' + (err.response?.data?.detail || err.message))
    }
  }

  const handleDelete = async (node: TreeNode) => {
    if (!confirm(`确定删除"${node.name}"吗？此操作不可撤销。`)) return
    try {
      if (node.type === 'folder') {
        await apiClient.delete(`/folders/${node.id}`)
      } else {
        await apiClient.delete(`/documents/${node.id}`)
      }
      if (selectedNode?.id === node.id) setSelectedNode(null)
      loadTree()
      queryClient.invalidateQueries({ queryKey: ['notebooks'] })
    } catch (err: any) {
      alert('删除失败: ' + (err.response?.data?.detail || err.message))
    }
  }

  const handleMove = async (node: TreeNode) => {
    // Simplified: move to root for now
    if (!confirm(`将"${node.name}"移动到根目录？`)) return
    try {
      if (node.type === 'folder') {
        await apiClient.put(`/folders/${node.id}`, { parent_id: null })
      } else {
        await apiClient.put(`/documents/${node.id}/move`, { folder_id: null })
      }
      loadTree()
    } catch (err: any) {
      alert('移动失败: ' + (err.response?.data?.detail || err.message))
    }
  }

  const handleCreate = async () => {
    if (!createName.trim() || !createModal || !id) return
    setCreating(true)
    try {
      if (createModal.type === 'file') {
        await apiClient.post(`/notebooks/${id}/files`, {
          name: createName.trim(),
          folder_id: createModal.parentId,
        })
      } else {
        await apiClient.post(`/notebooks/${id}/folders`, {
          name: createName.trim(),
          parent_id: createModal.parentId,
        })
      }
      setCreateModal(null)
      setCreateName('')
      loadTree()
    } catch (err: any) {
      alert('创建失败: ' + (err.response?.data?.detail || err.message))
    } finally {
      setCreating(false)
    }
  }

  // ====== Document Save ======

  const handleSaveDocument = async (content: string) => {
    if (!selectedNode || selectedNode.type !== 'document') return
    await apiClient.put(`/documents/${selectedNode.id}/content`, { content })
    setDocContent(content)
    loadTree()
  }

  const handleRevectorize = async () => {
    if (!selectedNode || selectedNode.type !== 'document') return
    try {
      await apiClient.post(`/documents/${selectedNode.id}/re-vectorize`)
      loadTree()
    } catch (err: any) {
      alert('向量化失败: ' + (err.response?.data?.detail || err.message))
    }
  }

  // ====== Upload ======

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !id) return

    setUploading(true)
    setUploadProgress('上传中...')
    const formData = new FormData()
    formData.append('file', file)

    try {
      setUploadProgress('AI 正在分析文档...')
      await apiClient.post(`/notebooks/${id}/documents`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setUploadProgress('')
      setUploading(false)
      setUploadOpen(false)
      loadTree()
      queryClient.invalidateQueries({ queryKey: ['notebooks'] })
    } catch (err: any) {
      setUploadProgress(err.response?.data?.detail || '上传失败')
      setTimeout(() => { setUploading(false); setUploadProgress('') }, 3000)
    }

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ====== Search ======

  const handleSearch = async () => {
    if (!searchQuery.trim() || !id) return
    setSearching(true)
    try {
      const res = await apiClient.post(`/notebooks/${id}/search`, { query: searchQuery, top_k: 5 })
      setSearchResults(res.data.results)
    } catch {
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }

  // 文件树文件名精准匹配（纯前端本地过滤）
  const handleFileSearchChange = (q: string) => {
    setFileSearchQuery(q)
  }

  // FAB: 选中文字 → AI 问答，否则 → 聊天页
  const handleFabClick = () => {
    const sel = window.getSelection()
    const text = sel?.toString().trim() || ''
    // 检查选中是否在文档内容区域
    if (text.length >= 3) {
      setAskModal({ show: true, text, question: '', answer: '', loading: false })
    } else {
      navigate(`/notebook/${id}/chat`)
    }
  }

  const handleAskSubmit = async () => {
    if (!askModal.question.trim() || askModal.loading) return
    setAskModal(prev => ({ ...prev, loading: true, answer: '' }))
    try {
      const res = await apiClient.post('/auth/ask', {
        selected_text: askModal.text,
        question: askModal.question.trim(),
      })
      setAskModal(prev => ({ ...prev, answer: res.data.answer, loading: false }))
    } catch (err: any) {
      setAskModal(prev => ({
        ...prev,
        answer: err.response?.data?.detail || '请求失败',
        loading: false,
      }))
    }
  }

  // ====== Helpers ======

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`
  }

  const isFileTab = activeTab === 'files'

  // ====== Render ======

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-surface-300" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3">
        <p className="text-red-500 text-sm">{error}</p>
        <button onClick={() => navigate('/')} className="text-primary-500 text-sm">返回首页</button>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 bg-white border-b border-surface-200">
        <div className="flex items-center gap-2 px-3 py-2">
          <button onClick={() => navigate('/')} className="p-1.5 hover:bg-surface-100 rounded-lg">
            <ArrowLeft size={18} />
          </button>
          <h1 className="font-semibold text-sm truncate flex-1">{notebook?.title || '笔记本'}</h1>

          {/* 知识卡片搜索（仅会员）*/}
          {isPremium && (
            <div className="flex items-center gap-0">
              <div className="relative">
                <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-surface-300" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="模糊检索..."
                  className="w-28 sm:w-40 pl-6 pr-2 py-1 text-xs bg-surface-50 rounded-lg border border-surface-200 focus:border-primary-500 outline-none mr-1"
                />
              </div>
              <button
                onClick={handleSearch}
                disabled={searching || !searchQuery.trim()}
                className="px-2.5 py-1 bg-primary-500 text-white text-xs rounded-lg hover:bg-primary-600 disabled:opacity-50 whitespace-nowrap"
              >
                {searching ? <Loader2 size={12} className="animate-spin" /> : '检索'}
              </button>
            </div>
          )}

          <button onClick={toggleDrawer} className="p-1.5 hover:bg-surface-100 rounded-lg">
            <Menu size={18} />
          </button>
        </div>

        {/* Tab Bar */}
        <div className="flex border-t border-surface-100 px-2">
          {[
            { key: 'files' as TabKey, icon: FileText, label: '文件', premium: false },
            { key: 'cards' as TabKey, icon: FlipVertical, label: '知识卡片', premium: true },
            { key: 'quiz' as TabKey, icon: GraduationCap, label: '出题', premium: true },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1 px-2.5 py-2 text-xs font-medium transition-colors relative whitespace-nowrap ${
                activeTab === tab.key
                  ? 'text-primary-600'
                  : 'text-surface-400 hover:text-surface-600'
              }`}
            >
              <tab.icon size={13} />
              {tab.label}
              {tab.premium && (
                <Crown size={9} className={isPremium ? 'text-amber-500' : 'text-surface-300'} />
              )}
              {activeTab === tab.key && (
                <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary-500 rounded-full" />
              )}
            </button>
          ))}
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex min-h-0">
        {/* File Tree Sidebar (only in files tab) */}
        {isFileTab && (
          <div className="w-[240px] sm:w-[260px] flex-shrink-0 border-r border-surface-200 bg-white/60 backdrop-blur-sm overflow-y-auto">
            <FileTree
              tree={tree}
              selectedId={selectedNode?.id || null}
              expandedIds={expandedIds}
              onSelect={handleSelectNode}
              onToggle={handleToggle}
              onRename={handleRename}
              onDelete={handleDelete}
              onMove={handleMove}
              onCreateFile={(parentId) => { setCreateModal({ type: 'file', parentId }); setCreateName('') }}
              onCreateFolder={(parentId) => { setCreateModal({ type: 'folder', parentId }); setCreateName('') }}
              onUpload={() => setUploadOpen(true)}
              onRefresh={loadTree}
              searchQuery={fileSearchQuery}
              onSearchChange={handleFileSearchChange}
              uploading={uploading}
            />
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 min-w-0 overflow-hidden flex flex-col">
          {/* Search Results */}
          {searchResults !== null && (
            <div className="px-4 py-3 border-b border-surface-200 bg-surface-50">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-surface-500">
                  找到 {searchResults.length} 条结果
                </h3>
                <button onClick={() => { setSearchResults(null); setSearchQuery('') }} className="text-xs text-primary-500">
                  清除
                </button>
              </div>
              {searchResults.length === 0 ? (
                <p className="text-xs text-surface-400 text-center py-2">未找到相关内容</p>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {searchResults.map((r: any, i: number) => (
                    <div
                      key={i}
                      className="bg-white rounded-lg p-2 border border-surface-200 text-xs cursor-pointer hover:border-primary-300"
                      onClick={() => {
                        if (r.chunk_id?.startsWith('kp_')) {
                          // 知识点结果 → 跳转到对应笔记本的知识卡片 tab
                          navigate(`/notebook/${id}`)
                        } else if (r.chunk_id) {
                          const docId = r.chunk_id.split('-')[0]
                          navigate(`/document/${docId}/view?highlight=${r.chunk_id}`)
                        }
                      }}
                    >
                      <p className="text-surface-500 truncate">{r.content}</p>
                      <p className="text-surface-300 mt-0.5">{r.document_name}{r.score ? ` · 相关度 ${(r.score * 100).toFixed(0)}%` : ''}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* File Content / Tab Content */}
          <div className="flex-1 overflow-hidden">
            {/* Files Tab */}
            {activeTab === 'files' && (
              <>
                {!selectedNode ? (
                  <div className="h-full flex items-center justify-center text-center">
                    <div>
                      <FileText size={40} className="text-surface-200 mx-auto mb-3" />
                      <p className="text-sm text-surface-400 mb-1">选择文件以查看或编辑</p>
                      <p className="text-xs text-surface-300">
                        从左侧文件树中选择文档，或创建新文件
                      </p>
                    </div>
                  </div>
                ) : selectedNode.type === 'document' ? (
                  docLoading ? (
                    <div className="h-full flex items-center justify-center">
                      <Loader2 size={24} className="animate-spin text-surface-300" />
                    </div>
                  ) : selectedNode.file_type === 'md' || selectedNode.file_type === 'txt' ? (
                    <MarkdownEditor
                      fileName={selectedNode.name}
                      content={docContent}
                      needsRevectorize={selectedNode.needs_revectorize === 1}
                      onSave={handleSaveDocument}
                      onRevectorize={handleRevectorize}
                    />
                  ) : (
                    <div className="h-full overflow-y-auto">
                      <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
                        <div>
                          <h2 className="font-semibold text-sm">{selectedNode.name}</h2>
                          <p className="text-xs text-surface-400">{selectedNode.file_type?.toUpperCase()} 文档</p>
                        </div>
                        <button
                          onClick={() => navigate(`/document/${selectedNode.id}/view`)}
                          className="text-xs text-primary-500 hover:underline"
                        >
                          打开全文
                        </button>
                      </div>
                      <article className="prose prose-sm max-w-3xl mx-auto px-6 py-2">
                        <p className="text-surface-400 text-sm">这是上传的 {selectedNode.file_type?.toUpperCase()} 文档。点击"打开全文"查看 AI 格式化后的内容。</p>
                      </article>
                    </div>
                  )
                ) : (
                  <div className="h-full flex items-center justify-center text-surface-400 text-sm">
                    文件夹: {selectedNode.name}
                  </div>
                )}
              </>
            )}

            {/* Cards Tab — 知识卡片 + 口诀 */}
            {activeTab === 'cards' && (
              <KnowledgePanel notebookId={id!} onGoToSource={() => setActiveTab('files')} />
            )}

            {/* Quiz Tab */}
            {activeTab === 'quiz' && (
              <div className="h-full overflow-y-auto">
                {!isPremium ? (
                  <PremiumGate
                    feature="AI 智能出题"
                    icon={<GraduationCap size={30} className="text-white" />}
                    description="基于你的知识库自动生成练习题，支持选择题、填空题和混合模式。逐题作答，自动批改并给出详细解析。"
                  />
                ) : (
                  <QuizTabContent notebookId={id!} navigate={navigate} />
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pending Vectorization Bar */}
      <PendingVectorizeBar
        notebookId={id!}
        items={pendingItems}
        onRefresh={loadTree}
      />

      {/* FAB：选中文字→AI问答 / 否则→聊天 */}
      <button
        onClick={handleFabClick}
        className="fixed bottom-6 right-6 w-12 h-12 bg-primary-500 text-white rounded-2xl shadow-lg hover:bg-primary-600 active:scale-[0.97] transition duration-150 flex items-center justify-center z-30"
        title="选中文字后点击可向AI提问"
      >
        <MessageCircle size={22} />
      </button>

      {/* Upload Modal */}
      {uploadOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center" onClick={() => setUploadOpen(false)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm p-6 shadow-xl animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">上传文档</h3>
              <button onClick={() => setUploadOpen(false)} className="p-1"><X size={20} /></button>
            </div>

            {uploading ? (
              <div className="text-center py-8">
                <Loader2 size={40} className="animate-spin text-primary-500 mx-auto mb-3" />
                <p className="text-sm text-surface-600">{uploadProgress}</p>
              </div>
            ) : (
              <>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-12 border-2 border-dashed border-surface-300 rounded-2xl hover:border-primary-400 hover:bg-primary-50/50 transition-colors flex flex-col items-center gap-2"
                >
                  <Upload size={32} className="text-surface-300" />
                  <span className="text-sm text-surface-500">点击选择文件</span>
                  <span className="text-xs text-surface-300">支持 PDF、DOCX、TXT、MD</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.doc,.txt,.md"
                  onChange={handleUpload}
                  className="hidden"
                />
              </>
            )}
          </div>
        </div>
      )}

      {/* AI 选中问答弹窗 */}
      {askModal.show && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
          onClick={() => !askModal.loading && setAskModal(prev => ({ ...prev, show: false }))}>
          <div className="bg-white rounded-2xl w-full max-w-md mx-4 shadow-2xl animate-fade-in-up max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-surface-200">
              <div className="flex items-center gap-2 text-sm font-semibold text-surface-700">
                <MessageCircle size={16} className="text-primary-500" /> AI 助手
              </div>
              <button onClick={() => setAskModal(prev => ({ ...prev, show: false }))} className="p-1 hover:bg-surface-100 rounded-lg" disabled={askModal.loading}>
                <X size={18} />
              </button>
            </div>
            <div className="px-4 py-3 border-b border-surface-100 bg-surface-50">
              <p className="text-xs text-surface-400 mb-1">选中的文字：</p>
              <p className="text-sm text-surface-600 line-clamp-3 italic">"{askModal.text}"</p>
            </div>
            <div className="px-4 py-3">
              <textarea
                value={askModal.question}
                onChange={e => setAskModal(prev => ({ ...prev, question: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAskSubmit() } }}
                placeholder="针对选中文字提问..."
                className="w-full px-3 py-2.5 border border-surface-200 rounded-xl text-sm resize-none focus:border-primary-500 outline-none"
                rows={2} autoFocus disabled={askModal.loading}
              />
              <button
                onClick={handleAskSubmit}
                disabled={!askModal.question.trim() || askModal.loading}
                className="w-full mt-2 py-2.5 bg-primary-500 text-white rounded-xl text-sm font-medium hover:bg-primary-600 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {askModal.loading ? <><Loader2 size={16} className="animate-spin" /> AI 思考中...</> : <><Send size={14} /> 提问</>}
              </button>
            </div>
            {askModal.answer && (
              <div className="px-4 py-3 border-t border-surface-200 overflow-y-auto">
                <p className="text-xs text-surface-400 mb-1">AI 回答：</p>
                <div className="text-sm text-surface-700 prose prose-sm max-w-none">
                  <ReactMarkdown>{askModal.answer}</ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create File/Folder Modal */}
      {createModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center" onClick={() => setCreateModal(null)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm p-6 animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">
              {createModal.type === 'file' ? '新建 Markdown 文件' : '新建文件夹'}
            </h3>
            <input
              type="text"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-surface-200 focus:border-primary-500 outline-none transition-colors text-sm"
              placeholder={createModal.type === 'file' ? '文件名（自动添加 .md）' : '文件夹名称'}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setCreateModal(null)}
                className="flex-1 py-2.5 rounded-xl border border-surface-200 text-surface-600 font-medium hover:bg-surface-50 text-sm"
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                disabled={!createName.trim() || creating}
                className="flex-1 py-2.5 rounded-xl bg-primary-500 text-white font-medium hover:bg-primary-600 disabled:opacity-50 text-sm flex items-center justify-center"
              >
                {creating ? <Loader2 size={16} className="animate-spin" /> : '创建'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ──────────────── 出题知识点选择 ────────────────

function QuizTabContent({ notebookId, navigate }: { notebookId: string; navigate: any }) {
  const [kps, setKps] = useState<KnowledgePoint[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [quizCount, setQuizCount] = useState(5)

  useEffect(() => {
    if (!notebookId) return
    setLoading(true)
    apiClient.get(`/notebooks/${notebookId}/knowledge-points`)
      .then(r => setKps(r.data || []))
      .catch(() => setKps([]))
      .finally(() => setLoading(false))
  }, [notebookId])

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === kps.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(kps.map(k => k.id)))
    }
  }

  const handleStart = () => {
    const selectedKps = kps.filter(k => selected.has(k.id))
    navigate(`/notebook/${notebookId}/quiz`, { state: { kps: selectedKps, count: quizCount } })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={28} className="animate-spin text-surface-300" />
      </div>
    )
  }

  if (kps.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <GraduationCap size={40} className="text-surface-200 mb-3" />
        <p className="text-sm text-surface-500 mb-1">暂无知识点</p>
        <p className="text-xs text-surface-400">先生成知识卡片，知识点会自动存入知识库</p>
      </div>
    )
  }

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-surface-700">
          选择题出的知识点（{selected.size}/{kps.length}）
        </h3>
        <button
          onClick={toggleAll}
          className="text-xs text-primary-500 hover:underline"
        >
          {selected.size === kps.length ? '取消全选' : '全选'}
        </button>
      </div>

      <div className="space-y-2 mb-6 max-h-[55vh] overflow-y-auto">
        {kps.map(kp => (
          <label
            key={kp.id}
            className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${
              selected.has(kp.id)
                ? 'border-primary-400 bg-primary-50'
                : 'border-surface-200 hover:border-surface-300'
            }`}
          >
            <input
              type="checkbox"
              checked={selected.has(kp.id)}
              onChange={() => toggle(kp.id)}
              className="mt-0.5 accent-primary-500"
            />
            <div className="min-w-0">
              <p className="text-sm font-medium text-surface-700">{kp.title}</p>
              <p className="text-xs text-surface-400 truncate">{kp.content}</p>
            </div>
          </label>
        ))}
      </div>

      {/* 出题数量选择 */}
      <div className="mb-4">
        <p className="text-xs text-surface-400 mb-2">出题数量（0-10，0 表示不限制）</p>
        <input
          type="number"
          min={0}
          max={10}
          value={quizCount}
          onChange={e => {
            const v = Math.max(0, Math.min(10, Number(e.target.value) || 0))
            setQuizCount(v)
          }}
          className="w-full px-4 py-2.5 border border-surface-200 rounded-xl text-sm focus:border-primary-500 outline-none"
        />
      </div>

      <button
        onClick={handleStart}
        disabled={selected.size === 0}
        className="w-full py-3 bg-primary-500 text-white rounded-xl font-medium hover:bg-primary-600 disabled:opacity-40 transition-colors"
      >
        开始出题（{quizCount === 0 ? '不限' : `${quizCount} 题`} · {selected.size} 个知识点）
      </button>
    </div>
  )
}
