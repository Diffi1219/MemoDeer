import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { MessageCircle, Loader2, X as XIcon, Send, ArrowRight } from 'lucide-react'
import apiClient from '../../api/client'
import ObsidianMarkdown from './ObsidianMarkdown'

interface Props {
  children: React.ReactNode
  className?: string
  notebookId?: string
}

interface AskState {
  visible: boolean
  selectedText: string
  question: string
  answer: string
  loading: boolean
  x: number
  y: number
}

export default function SelectionAsk({ children, className, notebookId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const [state, setState] = useState<AskState>({
    visible: false, selectedText: '', question: '', answer: '',
    loading: false, x: 0, y: 0,
  })
  const [deepDiscussing, setDeepDiscussing] = useState(false)

  // 检测文本选中
  const handleMouseUp = useCallback((e: MouseEvent) => {
    setTimeout(() => {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed || !sel.toString().trim()) {
        // 不清除已有弹窗，只在点击外部时清除
        return
      }
      const text = sel.toString().trim()
      if (text.length < 3) return

      const container = containerRef.current
      if (!container) return
      // 检查选中是否在容器内
      if (!container.contains(sel.anchorNode) && !container.contains(sel.focusNode)) return

      const range = sel.getRangeAt(0)
      const rect = range.getBoundingClientRect()

      setState(prev => ({
        ...prev,
        visible: false, // 先关旧弹窗
        selectedText: text,
        question: '',
        answer: '',
        loading: false,
        x: Math.min(rect.left + rect.width / 2, window.innerWidth - 200),
        y: rect.bottom + 8,
      }))
    }, 50)
  }, [])

  // 点击外部关闭
  const handleClickOutside = useCallback((e: MouseEvent) => {
    const container = containerRef.current
    if (container && !container.contains(e.target as Node)) {
      setState(prev => ({ ...prev, visible: false }))
    }
  }, [])

  useEffect(() => {
    document.addEventListener('mouseup', handleMouseUp)
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [handleMouseUp, handleClickOutside])

  const handleOpen = () => {
    setState(prev => ({ ...prev, visible: true }))
  }

  const handleClose = () => {
    setState(prev => ({ ...prev, visible: false, answer: '' }))
  }

  const handleAsk = async () => {
    if (!state.question.trim() || state.loading) return
    setState(prev => ({ ...prev, loading: true, answer: '' }))
    try {
      const res = await apiClient.post('/auth/ask', {
        selected_text: state.selectedText,
        question: state.question.trim(),
      })
      setState(prev => ({ ...prev, answer: res.data.answer, loading: false }))
    } catch (err: any) {
      setState(prev => ({
        ...prev,
        answer: err.response?.data?.detail || '请求失败，请重试',
        loading: false,
      }))
    }
  }

  const handleDeepDiscuss = async () => {
    if (!notebookId || !state.answer || deepDiscussing) return
    setDeepDiscussing(true)
    try {
      const userMsg = `关于这段文字：\n> ${state.selectedText}\n\n${state.question}`
      const res = await apiClient.post(`/notebooks/${notebookId}/chat/sessions/create-with-messages`, {
        notebook_id: notebookId,
        title: state.selectedText.slice(0, 30),
        user_message: userMsg,
        assistant_message: state.answer,
      })
      handleClose()
      navigate(`/notebook/${notebookId}/chat/${res.data.session_id}`)
    } catch (err: any) {
      alert('创建对话失败: ' + (err.response?.data?.detail || err.message))
    } finally {
      setDeepDiscussing(false)
    }
  }

  const showButton = state.selectedText && !state.visible

  return (
    <div ref={containerRef} className={className}>
      {children}

      {/* 浮动提问按钮 */}
      {showButton && (
        <div
          className="fixed z-40 animate-fade-in-up"
          style={{ left: state.x, top: state.y, transform: 'translateX(-50%)' }}
        >
          <button
            onClick={handleOpen}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary-500 text-white text-xs font-medium rounded-xl shadow-lg hover:bg-primary-600 transition-colors whitespace-nowrap"
          >
            <MessageCircle size={14} />
            询问 AI
          </button>
        </div>
      )}

      {/* 问答弹窗 */}
      {state.visible && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center"
          onClick={() => !state.loading && handleClose()}
        >
          <div
            className="bg-surface-0 rounded-2xl w-full max-w-md mx-4 shadow-2xl animate-fade-in-up max-h-[85vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-surface-200">
              <div className="flex items-center gap-2 text-sm font-semibold text-surface-700">
                <MessageCircle size={16} className="text-primary-500" />
                AI 助手
              </div>
              <button onClick={handleClose} className="p-1 hover:bg-surface-100 rounded-lg" disabled={state.loading}>
                <XIcon size={18} />
              </button>
            </div>

            {/* 选中文本 */}
            <div className="px-4 py-3 border-b border-surface-100 bg-surface-50">
              <p className="text-xs text-surface-400 mb-1">选中的文字：</p>
              <p className="text-sm text-surface-600 line-clamp-3 italic">"{state.selectedText}"</p>
            </div>

            {/* 输入区 */}
            <div className="px-4 py-3">
              <textarea
                value={state.question}
                onChange={e => setState(prev => ({ ...prev, question: e.target.value }))}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleAsk()
                  }
                }}
                placeholder="针对选中文字提问，例如：这段话的核心观点是什么？"
                className="w-full px-3 py-2.5 border border-surface-200 rounded-xl text-sm resize-none focus:border-primary-500 outline-none"
                rows={2}
                autoFocus
                disabled={state.loading}
              />
              <button
                onClick={handleAsk}
                disabled={!state.question.trim() || state.loading}
                className="w-full mt-2 py-2.5 bg-primary-500 text-white rounded-xl text-sm font-medium hover:bg-primary-600 disabled:opacity-50 flex items-center justify-center gap-2 btn-press"
              >
                {state.loading ? (
                  <><Loader2 size={16} className="animate-spin" /> AI 思考中...</>
                ) : (
                  <><Send size={14} /> 提问</>
                )}
              </button>
            </div>

            {/* AI 回答 */}
            {state.answer && (
              <div className="px-4 py-3 border-t border-surface-200 overflow-y-auto">
                <p className="text-xs text-surface-400 mb-1">AI 回答：</p>
                <div className="text-sm text-surface-700 prose prose-sm max-w-none">
                  <ObsidianMarkdown content={state.answer} />
                </div>
                {/* 深度探讨按钮 */}
                {notebookId && (
                  <button
                    onClick={handleDeepDiscuss}
                    disabled={deepDiscussing}
                    className="w-full mt-3 py-2.5 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl text-sm font-medium hover:from-primary-600 hover:to-primary-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors btn-press"
                  >
                    {deepDiscussing ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <ArrowRight size={14} />
                    )}
                    深度探讨
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
