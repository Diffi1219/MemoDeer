import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import apiClient from '../api/client'
import { Plus, MessageSquare, Trash2, Menu, Save, X, Loader2 } from 'lucide-react'
import { useUIStore } from '../store/uiStore'
import ChatPanel from '../components/chat/ChatPanel'
import PageHeader from '../components/layout/PageHeader'

interface Session {
  id: string; notebook_id: string; title: string; message_count: number; updated_at: string
}

export default function ChatPage() {
  const { id: notebookId, sid } = useParams<{ id: string; sid?: string }>()
  const navigate = useNavigate()
  const toggleDrawer = useUIStore((s) => s.toggleDrawer)
  const [notebookTitle, setNotebookTitle] = useState('')
  const [sessions, setSessions] = useState<Session[]>([])
  const [showSessions, setShowSessions] = useState(false)
  const [editingNote, setEditingNote] = useState<string | null>(null)
  const [noteContent, setNoteContent] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null) // session id to delete

  useEffect(() => {
    if (!notebookId) return
    apiClient.get(`/notebooks/${notebookId}`).then(r => setNotebookTitle(r.data.title)).catch(() => {})
  }, [notebookId])

  useEffect(() => {
    if (!notebookId) return
    apiClient.get(`/notebooks/${notebookId}/chat/sessions`).then(r => setSessions(r.data)).catch(() => {})
  }, [notebookId])

  // Note: ChatPanel manages its own sessionId internally for new sessions
  // For the standalone page, we track sessionId to show the right title

  const handleDeleteSession = async (sessId: string) => {
    setDeleteConfirm(sessId)
  }

  const confirmDelete = async () => {
    if (!deleteConfirm || !notebookId) return
    await apiClient.delete(`/notebooks/${notebookId}/chat/sessions/${deleteConfirm}`)
    setSessions((prev) => prev.filter((s) => s.id !== deleteConfirm))
    setDeleteConfirm(null)
  }

  return (
    <div className="h-full flex flex-col bg-surface-0">
      <PageHeader
        title={notebookTitle}
        onBack={() => navigate(`/notebook/${notebookId}`)}
        actions={
          <>
            <button onClick={() => setShowSessions(!showSessions)} className="p-2 hover:bg-surface-100 rounded-lg btn-press" title="历史会话">
              <MessageSquare size={20} />
            </button>
            <button onClick={toggleDrawer} className="p-2 hover:bg-surface-100 rounded-lg btn-press">
              <Menu size={20} />
            </button>
          </>
        }
      />

      {showSessions && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setShowSessions(false)} />
          <div className="absolute top-12 right-0 w-72 bg-surface-0 shadow-xl rounded-xl border z-20 max-h-80 overflow-y-auto m-2">
          <div className="p-2">
            <div className="flex items-center justify-between px-3 py-2">
              <h3 className="text-xs font-semibold text-surface-400">历史对话</h3>
              <button
                onClick={() => setShowSessions(false)}
                className="p-1 hover:bg-surface-100 rounded text-surface-400 hover:text-surface-600"
              >
                <X size={14} />
              </button>
            </div>
            {sessions.length === 0 ? (
              <p className="text-xs text-surface-400 px-3 py-4">暂无对话</p>
            ) : (
              sessions.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer hover:bg-surface-50"
                  onClick={() => { navigate(`/notebook/${notebookId}/chat/${s.id}`); setShowSessions(false) }}
                >
                  <MessageSquare size={14} className="text-surface-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{s.title}</p>
                    <p className="text-xs text-surface-300">{s.message_count} 条消息</p>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); handleDeleteSession(s.id) }} className="p-1 hover:bg-danger-light/50 rounded">
                    <Trash2 size={14} className="text-surface-300 hover:text-danger" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
        </>
      )}

      <div className="flex-1 min-h-0">
        <ChatPanel
          notebookId={notebookId!}
          sessionId={sid || null}
          onSaveNote={(content) => { setEditingNote('note'); setNoteContent(content) }}
        />
      </div>

      {/* 编辑笔记弹窗 */}
      {editingNote && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center" onClick={() => setEditingNote(null)}>
          <div className="bg-surface-0 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg p-6 max-h-[80vh] flex flex-col shadow-xl animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">编辑笔记内容</h3>
              <button onClick={() => setEditingNote(null)} className="p-1 hover:bg-surface-100 rounded-lg"><X size={20} /></button>
            </div>
            <p className="text-xs text-surface-400 mb-3">你可以编辑、删减或补充内容，然后保存到当前笔记本</p>
            <textarea
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              className="flex-1 min-h-[200px] p-4 border border-surface-200 rounded-xl text-sm resize-none focus:border-primary-500 outline-none"
            />
            <div className="flex gap-2 mt-3">
              <button onClick={() => setEditingNote(null)} className="flex-1 py-2.5 border border-surface-200 rounded-xl text-surface-600 font-medium hover:bg-surface-50">取消</button>
              <button
                onClick={async () => {
                  if (!noteContent.trim() || !notebookId) return
                  setSavingNote(true)
                  try {
                    await apiClient.post(`/notebooks/${notebookId}/notes`, { content: noteContent.trim() })
                    setEditingNote(null); setNoteContent('')
                    alert('笔记已保存到当前笔记本')
                  } catch (err: any) {
                    alert('保存失败: ' + (err.response?.data?.detail || err.message))
                  } finally { setSavingNote(false) }
                }}
                disabled={!noteContent.trim() || savingNote}
                className="flex-1 py-2.5 bg-primary-500 text-white rounded-xl font-medium hover:bg-primary-600 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {savingNote ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {savingNote ? '保存中...' : '保存到笔记本'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认弹窗 */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-surface-0 rounded-2xl w-full max-w-sm mx-4 p-6 shadow-xl animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-2">删除此对话？</h3>
            <p className="text-sm text-surface-500 mb-6">删除后对话记录将无法恢复。</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 border border-surface-200 rounded-xl text-surface-600 font-medium hover:bg-surface-50">取消</button>
              <button onClick={confirmDelete} className="flex-1 py-2.5 bg-danger text-white rounded-xl font-medium hover:bg-red-600">删除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
