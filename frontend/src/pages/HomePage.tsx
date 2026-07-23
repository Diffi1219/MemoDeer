import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../api/client'
import { useUIStore } from '../store/uiStore'
import { useAuthStore } from '../store/authStore'
import { Plus, BookOpen, FileText, Brain, Menu, Loader2, Trash2, Search } from 'lucide-react'
import GlobalSearchModal from '../components/common/GlobalSearchModal'
import Modal from '../components/common/Modal'
import PageHeader from '../components/layout/PageHeader'

interface Notebook {
  id: string
  title: string
  description: string
  document_count: number
  knowledge_point_count: number
  updated_at: string
}

export default function HomePage() {
  const toggleDrawer = useUIStore((s) => s.toggleDrawer)
  const openGlobalSearch = useUIStore((s) => s.openGlobalSearch)
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { data: notebooks, isLoading } = useQuery<Notebook[]>({
    queryKey: ['notebooks'],
    queryFn: async () => {
      const res = await apiClient.get('/notebooks')
      return res.data
    },
  })

  const createMutation = useMutation({
    mutationFn: async (title: string) => {
      const res = await apiClient.post('/notebooks', { title })
      return res.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['notebooks'] })
      setShowCreate(false)
      setNewTitle('')
      navigate(`/notebook/${data.id}`)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/notebooks/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notebooks'] })
    },
  })

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (newTitle.trim()) {
      createMutation.mutate(newTitle.trim())
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* 顶部 */}
      <PageHeader
        title="MemoDeer"
        leftActions={
          <button onClick={toggleDrawer} className="p-2 hover:bg-surface-100 rounded-lg btn-press">
            <Menu size={22} />
          </button>
        }
        actions={
          <button onClick={openGlobalSearch} className="p-2 hover:bg-surface-100 rounded-lg btn-press">
            <Search size={20} />
          </button>
        }
      />

      {/* 欢迎 */}
      <div className="px-4 pt-4 pb-2">
        <h2 className="font-display text-2xl text-surface-900">
          你好，{user?.display_name || user?.username} 👋
        </h2>
        <p className="text-sm text-surface-400 mt-0.5">
          {notebooks && notebooks.length > 0
            ? `已有 ${notebooks.length} 个笔记本，继续学习吧`
            : '创建你的第一个笔记本开始学习'}
        </p>
      </div>

      {/* 笔记本列表 */}
      <div className="flex-1 overflow-y-auto px-4 pb-20">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 size={32} className="animate-spin text-surface-300" />
          </div>
        ) : notebooks && notebooks.length > 0 ? (
          <div className="space-y-3">
            {notebooks.map((nb) => (
              <div
                key={nb.id}
                onClick={() => navigate(`/notebook/${nb.id}`)}
                className="bg-surface-0 rounded-xl p-4 shadow-sm border border-surface-200 hover:border-primary-300 transition-colors cursor-pointer active:scale-[0.98] card-lift"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-surface-900 truncate">{nb.title}</h3>
                    {nb.description && (
                      <p className="text-sm text-surface-400 mt-0.5 truncate">{nb.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-surface-400">
                      <span className="flex items-center gap-1">
                        <FileText size={14} /> {nb.document_count} 文档
                      </span>
                      <span className="flex items-center gap-1">
                        <Brain size={14} /> {nb.knowledge_point_count} 知识点
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setDeleteId(nb.id)
                    }}
                    className="p-2 text-surface-300 hover:text-danger hover:bg-danger-light/50 rounded-lg transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* 首次登录欢迎页 */
          <div className="space-y-6 pb-8">
            {/* Hero */}
            <div className="text-center pt-6 pb-2">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary-200">
                <BookOpen size={32} className="text-white" />
              </div>
              <h2 className="font-display text-3xl text-surface-900 mb-1">
                欢迎使用 MemoDeer
              </h2>
              <p className="text-sm text-surface-400 max-w-xs mx-auto leading-relaxed">
                上传学习资料，AI 帮你整理知识点、智能问答、生成学习卡片
              </p>
            </div>

            {/* 功能亮点 */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: '📄', title: '文档上传', desc: '支持 PDF/DOCX/TXT/MD，AI 自动格式化整理' },
                { icon: '💬', title: '智能问答', desc: '基于你的知识库检索回答，找不到时用通用知识补充' },
                { icon: '🧠', title: '知识点提取', desc: 'AI 自动提炼核心概念和关键定义（会员）' },
                { icon: '🔍', title: '全局搜索', desc: '跨笔记本快速定位知识点和文档片段' },
              ].map((f) => (
                <div key={f.title} className="bg-surface-0 rounded-xl p-3 border border-surface-200 shadow-sm hover:shadow-md transition-shadow card-lift">
                  <span className="text-2xl">{f.icon}</span>
                  <h3 className="text-sm font-semibold text-surface-700 mt-2 mb-0.5">{f.title}</h3>
                  <p className="text-xs text-surface-400 leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>

            {/* CTA */}
            <button
              onClick={() => setShowCreate(true)}
              className="w-full py-3.5 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-2xl font-semibold shadow-lg shadow-primary-200 hover:shadow-xl hover:shadow-primary-300 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <Plus size={20} />
              创建第一个笔记本
            </button>

            {/* 底部提示 */}
            <p className="text-center text-xs text-surface-300">
              每个笔记本可以包含多个文档和文件夹，AI 会帮你管理知识
            </p>
          </div>
        )}
      </div>

      {/* 创建笔记本弹窗 */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center" onClick={() => setShowCreate(false)}>
          <div className="bg-surface-0 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm p-6 animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">新建笔记本</h3>
            <form onSubmit={handleCreate}>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-surface-200 focus:border-primary-500 outline-none transition-colors"
                placeholder="例如：高等数学、考研政治..."
                autoFocus
                required
              />
              <div className="flex gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="flex-1 py-2.5 rounded-xl border border-surface-200 text-surface-600 font-medium hover:bg-surface-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="flex-1 py-2.5 rounded-xl bg-primary-500 text-white font-medium hover:bg-primary-600 disabled:opacity-50 flex items-center justify-center"
                >
                  {createMutation.isPending ? <Loader2 size={18} className="animate-spin" /> : '创建'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 浮动按钮 */}
      <button
        onClick={() => setShowCreate(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-primary-500 text-white rounded-2xl shadow-lg hover:bg-primary-600 active:scale-[0.97] transition duration-150 flex items-center justify-center z-30"
      >
        <Plus size={28} />
      </button>

      {/* 全局搜索弹窗 */}
      <GlobalSearchModal />

      {/* 删除确认弹窗 */}
      <Modal
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        title="确定删除？"
        variant="center"
      >
        <p className="text-sm text-surface-500 mb-6">
          此笔记本及其所有文档和对话将被清除，此操作无法撤销。
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setDeleteId(null)}
            className="flex-1 py-2.5 border border-surface-200 rounded-xl text-surface-600 font-medium hover:bg-surface-50 transition-colors"
          >
            取消
          </button>
          <button
            onClick={() => {
              if (deleteId) {
                deleteMutation.mutate(deleteId)
                setDeleteId(null)
              }
            }}
            disabled={deleteMutation.isPending}
            className="flex-1 py-2.5 bg-danger text-white rounded-xl font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {deleteMutation.isPending ? '删除中...' : '删除'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
