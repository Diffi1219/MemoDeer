import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import apiClient from '../api/client'
import { ArrowLeft, Plus, MessageSquare, Trash2, Menu, Save, X, Loader2 } from 'lucide-react'
import { useUIStore } from '../store/uiStore'
import ChatPanel from '../components/chat/ChatPanel'

interface Session {
  id: string; notebook_id: string; title: string; message_count: number; updated_at: string
}

export default function ChatPage() {
  const { id: notebookId, sid } = useParams<{ id: string; sid?: string }>()
  const navigate = useNavigate()
  const toggleDrawer = useUIStore((s) => s.toggleDrawer)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(sid || null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [showSessions, setShowSessions] = useState(false)
  const [notebookTitle, setNotebookTitle] = useState('')
  const [editingNote, setEditingNote] = useState<string | null>(null)
  const [noteContent, setNoteContent] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [chatKey, setChatKey] = useState(0)

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
    if (!confirm('删除此对话？')) return
    await apiClient.delete(`/notebooks/${notebookId}/chat/sessions/${sessId}`)
    setSessions((prev) => prev.filter((s) => s.id !== sessId))
  }

  return (
    <div className="h-full flex flex-col bg-white">
      <header className="flex items-center gap-2 px-4 py-3 border-b border-surface-200 bg-white z-10">
        <button onClick={() => navigate(`/notebook/${notebookId}`)} className="p-2 hover:bg-surface-100 rounded-lg">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold text-sm truncate">{notebookTitle}</h1>
        </div>
        <button onClick={() => setShowSessions(!showSessions)} className="p-2 hover:bg-surface-100 rounded-lg" title="历史会话">
          <MessageSquare size={20} />
        </button>
        <button onClick={toggleDrawer} className="p-2 hover:bg-surface-100 rounded-lg">
          <Menu size={20} />
        </button>
      </header>

      {showSessions && (
        <div className="absolute top-12 right-0 w-72 bg-white shadow-xl rounded-xl border z-20 max-h-80 overflow-y-auto m-2">
          <div className="p-2">
            <h3 className="text-xs font-semibold text-surface-400 px-3 py-2">历史对话</h3>
            {sessions.length === 0 ? (
              <p className="text-xs text-surface-400 px-3 py-4">暂无对话</p>
            ) : (
              sessions.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer hover:bg-surface-50"
                  onClick={() => { navigate(`/notebook/${notebookId}/chat/${s.id}`); setActiveSessionId(s.id); setChatKey(k => k + 1); setShowSessions(false) }}
                >
                  <MessageSquare size={14} className="text-surface-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{s.title}</p>
                    <p className="text-xs text-surface-300">{s.message_count} 条消息</p>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); handleDeleteSession(s.id) }} className="p-1 hover:bg-red-50 rounded">
                    <Trash2 size={14} className="text-surface-300 hover:text-red-500" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <ChatPanel
        key={chatKey}
        notebookId={notebookId!}
        sessionId={activeSessionId}
        onSaveNote={(content) => { setEditingNote('note'); setNoteContent(content) }}
      />

      {/* 编辑笔记弹窗 */}
      {editingNote && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center" onClick={() => setEditingNote(null)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg p-6 max-h-[80vh] flex flex-col shadow-xl animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
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
    </div>
  )
}
