import { useState, useRef, useEffect, useMemo, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { Send, Loader2, FileText, Plus } from 'lucide-react'
import apiClient, { getApiUrl } from '../../api/client'
import GenUI from '../common/GenUI'

/** 预处理 Obsidian 语法 */
function preprocessObsidian(text: string): string {
  let result = text
  result = result.replace(/%%[\s\S]*?%%/g, '')
  result = result.replace(/==(.+?)==/g, '<mark>$1</mark>')
  result = result.replace(/\[\[([^\]|]+?)\]\]/g, (_m: string, p1: string) => `[${p1}](#obsidian-${p1.replace(/\s+/g, '-')})`)
  result = result.replace(/\[\[([^\]|]+?)\|([^\]]+?)\]\]/g, (_m: string, _p1: string, p2: string) => `[${p2}](#obsidian-wikilink)`)
  return result
}

/** Callout 样式 */
const CALLOUT_STYLES: Record<string, { bg: string; border: string; icon: string }> = {
  note: { bg: 'bg-blue-50', border: 'border-blue-400', icon: '📝' },
  tip: { bg: 'bg-green-50', border: 'border-green-400', icon: '💡' },
  info: { bg: 'bg-cyan-50', border: 'border-cyan-400', icon: 'ℹ️' },
  warning: { bg: 'bg-amber-50', border: 'border-amber-400', icon: '⚠️' },
  danger: { bg: 'bg-red-50', border: 'border-red-400', icon: '🚫' },
  important: { bg: 'bg-purple-50', border: 'border-purple-400', icon: '❗' },
  success: { bg: 'bg-emerald-50', border: 'border-emerald-400', icon: '✅' },
  question: { bg: 'bg-violet-50', border: 'border-violet-400', icon: '❓' },
  example: { bg: 'bg-teal-50', border: 'border-teal-400', icon: '📋' },
  quote: { bg: 'bg-slate-50', border: 'border-slate-400', icon: '💬' },
  bug: { bg: 'bg-rose-50', border: 'border-rose-400', icon: '🐛' },
  todo: { bg: 'bg-orange-50', border: 'border-orange-400', icon: '📌' },
}

// 将文本中的 [1][2] 引用标记转为可点击元素
function processInlineCitations(
  children: ReactNode,
  citations: Citation[] | undefined,
  navigate: (path: string) => void,
): ReactNode {
  if (!citations || citations.length === 0) return children
  if (typeof children !== 'string') {
    if (Array.isArray(children)) {
      return children.map((child, i) => (
        <span key={i}>{processInlineCitations(child, citations, navigate)}</span>
      ))
    }
    return children
  }
  const parts = children.split(/(\[[\d,\s\[\]]+\])/g)
  if (parts.length <= 1) return children
  return parts.map((part, i) => {
    const match = part.match(/^\[([\d,\s\[\]]+)\]$/)
    if (!match) return <span key={i}>{part}</span>
    const nums = match[1].replace(/[\[\]]/g, '').split(/[,\s]+/).map(Number).filter(n => !isNaN(n))
    if (nums.length === 0) return <span key={i}>{part}</span>
    return nums.map((n, j) => {
      const cit = citations.find(c => c.index === n)
      if (!cit) return <span key={`${i}-${j}`}>[{n}]</span>
      return (
        <sup key={`${i}-${j}`} className="inline-block">
          <span
            onClick={() => navigate(`/document/${cit.document_id}/view?highlight=${cit.chunk_id}`)}
            className="text-[11px] font-bold text-primary-500 hover:text-primary-700 bg-primary-50 hover:bg-primary-100 px-1 rounded transition-colors cursor-pointer"
            title={cit.document_name}
          >
            [{n}]
          </span>
        </sup>
      )
    })
  })
}

// 自适应高度 iframe 用于 HTML 代码块
function HtmlBlock({ html }: { html: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(200)

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data && typeof e.data === 'object' && e.data.type === 'resize') {
        setHeight(Math.max(100, e.data.height + 20))
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  const wrappedHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body { font-family: system-ui, -apple-system, sans-serif; font-size: 14px; line-height: 1.6; padding: 16px; margin: 0; color: #334155; }
    table { border-collapse: collapse; width: 100%; margin: 8px 0; }
    th, td { border: 1px solid #e2e8f0; padding: 8px 12px; text-align: left; }
    th { background: #f1f5f9; font-weight: 600; }
    details { margin: 8px 0; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; }
    summary { font-weight: 600; cursor: pointer; color: #1e293b; }
    .card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin: 8px 0; background: #f8fafc; }
    .tag { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 12px; background: #eff6ff; color: #2563eb; margin: 2px; }
    .highlight { background: #fef3c7; padding: 2px 6px; border-radius: 4px; }
    .step { display: flex; gap: 12px; margin: 8px 0; align-items: flex-start; }
    .step-num { width: 28px; height: 28px; border-radius: 50%; background: #22c55e; color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; flex-shrink: 0; }
  </style></head><body>${html}<script>
    var h = document.body.scrollHeight;
    parent.postMessage({type:'resize',height:h},'*');
    new ResizeObserver(function(){var nh=document.body.scrollHeight;parent.postMessage({type:'resize',height:nh},'*');}).observe(document.body);
  </script></body></html>`

  return (
    <iframe
      ref={iframeRef}
      srcDoc={wrappedHtml}
      sandbox="allow-scripts"
      className="w-full border border-surface-200 rounded-xl my-2"
      style={{ height, minHeight: 100 }}
    />
  )
}

interface Message {
  id?: string
  role: 'user' | 'assistant' | 'status'
  content: string
  citations?: Citation[]
  source?: 'rag' | 'open'
}

interface Citation {
  index: number
  chunk_id: string
  document_id: string
  document_name: string
  snippet: string
  score: number
}

interface ChatPanelProps {
  notebookId: string
  onSaveNote?: (content: string) => void
  embedded?: boolean
}

export default function ChatPanel({ notebookId, onSaveNote, embedded }: ChatPanelProps) {
  const navigate = useNavigate()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [streaming, setStreaming] = useState(false)
  const [hoveredCitation, setHoveredCitation] = useState<number | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // 自动滚动
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || streaming || !notebookId) return

    const userMsg: Message = { role: 'user', content: input.trim() }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setStreaming(true)

    const assistantMsg: Message = { role: 'assistant', content: '' }
    setMessages((prev) => [...prev, assistantMsg])

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(getApiUrl(`/notebooks/${notebookId}/chat`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          session_id: sessionId,
          message: userMsg.content,
        }),
      })

      if (!response.ok) throw new Error('请求失败')

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (reader) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6)
          if (!data.trim()) continue

          try {
            const parsed = JSON.parse(data)

            if (parsed.type === 'token') {
              setMessages((prev) => {
                const updated = [...prev]
                const last = updated[updated.length - 1]
                if (last?.role === 'assistant') {
                  // 第一个 token 到达时，清除状态占位文本
                  const current = last.content.startsWith('_') ? '' : last.content
                  updated[updated.length - 1] = { ...last, content: current + parsed.data }
                }
                return updated
              })
            } else if (parsed.type === 'status') {
              setMessages((prev) => {
                const updated = [...prev]
                const last = updated[updated.length - 1]
                if (last?.role === 'assistant' && !last.content) {
                  updated[updated.length - 1] = { ...last, content: `_${parsed.text}_` }
                }
                return updated
              })
            } else if (parsed.type === 'citations') {
              setMessages((prev) => {
                const updated = [...prev]
                const last = updated[updated.length - 1]
                if (last?.role === 'assistant') {
                  updated[updated.length - 1] = { ...last, citations: parsed.data }
                }
                return updated
              })
            } else if (parsed.type === 'source') {
              setMessages((prev) => {
                const updated = [...prev]
                const last = updated[updated.length - 1]
                if (last?.role === 'assistant') {
                  updated[updated.length - 1] = { ...last, source: parsed.data as 'rag' | 'open' }
                }
                return updated
              })
            } else if (parsed.type === 'done') {
              if (!sessionId) {
                apiClient.get(`/notebooks/${notebookId}/chat/sessions`)
                  .then(r => { if (r.data.length > 0) setSessionId(r.data[0].id) })
                  .catch(() => {})
              }
            } else if (parsed.type === 'error') {
              setMessages((prev) => {
                const updated = [...prev]
                const last = updated[updated.length - 1]
                if (last?.role === 'assistant') {
                  updated[updated.length - 1] = { ...last, content: `❌ ${parsed.text}` }
                }
                return updated
              })
            }
          } catch { /* 忽略解析错误 */ }
        }
      }
    } catch (err: any) {
      setMessages((prev) => {
        const updated = [...prev]
        const last = updated[updated.length - 1]
        if (last?.role === 'assistant') {
          updated[updated.length - 1] = { ...last, content: `❌ 请求失败: ${err.message}` }
        }
        return updated
      })
    } finally {
      setStreaming(false)
    }
  }

  const handleNewChat = () => {
    setSessionId(null)
    setMessages([])
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className={`flex flex-col ${embedded ? 'h-full' : 'h-full'} bg-white`}>
      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && !streaming && (
          <div className="text-center py-20">
            <FileText size={48} className="text-surface-200 mx-auto mb-4" />
            <p className="text-surface-400 mb-1">开始提问</p>
            <p className="text-xs text-surface-300">AI 会优先从你的知识库中检索相关内容，找不到时会基于通用知识回答</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`animate-fade-in-up ${msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'}`}>
            <div className={`max-w-[85%] ${msg.role === 'user' ? 'bg-primary-500 text-white rounded-2xl rounded-br-md' : 'bg-surface-100 text-surface-800 rounded-2xl rounded-bl-md'} px-4 py-3`}>
              {msg.role === 'user' ? (
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              ) : (
                <>
                  {msg.source === 'open' && msg.content && msg.content.length > 5 && (
                    <div className="flex items-center gap-1 mb-2">
                      <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium">
                        通用知识回答
                      </span>
                      <span className="text-xs text-surface-400">非来自你的笔记，请注意核实</span>
                    </div>
                  )}
                  <div className="text-sm prose prose-sm max-w-none">
                  <ReactMarkdown
                    components={{
                      code({ className, children, ...props }) {
                        const match = /language-(\w+)/.exec(className || '')
                        if (match && match[1] === 'genui') {
                          try {
                            const raw = Array.isArray(children) ? children.join('') : String(children ?? '')
                            const data = JSON.parse(raw.trim())
                            return <GenUI data={data} />
                          } catch {
                            return <code {...props} className={className}>{children}</code>
                          }
                        }
                        if (match && match[1] === 'html') {
                          const raw = Array.isArray(children) ? children.join('') : String(children ?? '')
                          return <HtmlBlock html={raw.trim()} />
                        }
                        if (!className) {
                          return <code className="bg-surface-100 text-primary-600 px-1.5 py-0.5 rounded text-xs font-mono" {...props}>{children}</code>
                        }
                        return <code {...props} className={className}>{children}</code>
                      },
                      p({ children, ...props }) {
                        return <p {...props}>{processInlineCitations(children, msg.citations, navigate)}</p>
                      },
                      li({ children, ...props }) {
                        return <li {...props}>{processInlineCitations(children, msg.citations, navigate)}</li>
                      },
                      // ── Obsidian: Callout ──
                      blockquote({ children, ...props }) {
                        const node = (props as any).node
                        const firstChild = node?.children?.[0]?.children?.[0]
                        const text = firstChild?.value || ''
                        const calloutMatch = text.match(/^\[!(\w+)\]\s*(.*)/)
                        if (calloutMatch) {
                          const type = calloutMatch[1].toLowerCase()
                          const title = calloutMatch[2] || type.charAt(0).toUpperCase() + type.slice(1)
                          const style = CALLOUT_STYLES[type] || CALLOUT_STYLES.note
                          const childrenArr = Array.isArray(children) ? children : [children]
                          return (
                            <div className={`${style.bg} border-l-4 ${style.border} rounded-r-lg p-3 my-2`}>
                              <div className="flex items-center gap-1.5 font-semibold text-xs mb-1 text-surface-700">
                                <span>{style.icon}</span><span>{title}</span>
                              </div>
                              <div className="text-xs text-surface-600">{childrenArr.slice(1)}</div>
                            </div>
                          )
                        }
                        return <blockquote className="border-l-4 border-surface-300 pl-3 italic text-surface-500 my-2">{children}</blockquote>
                      },
                      // ── Obsidian: Wikilink ──
                      a({ href, children, ...props }) {
                        if (href?.startsWith('#obsidian-')) {
                          return <span className="inline-flex items-center px-1.5 py-0.5 bg-primary-50 text-primary-600 rounded text-xs font-medium cursor-default">{children}</span>
                        }
                        return <a href={href} className="text-primary-500 hover:text-primary-700 underline" target="_blank" rel="noopener noreferrer" {...props}>{children}</a>
                      },
                      // ── Obsidian: Highlight ──
                      mark({ children }) {
                        return <mark className="bg-amber-200 text-amber-900 px-0.5 rounded">{children}</mark>
                      },
                    }}
                  >
                    {preprocessObsidian(msg.content)}
                  </ReactMarkdown>
                </div>
                </>
              )}

              {/* 引用标注 */}
              {msg.citations && msg.citations.length > 0 && (
                <div className="mt-2 pt-2 border-t border-surface-200/50">
                  <p className="text-xs text-surface-400 mb-1">📚 参考来源：</p>
                  <div className="flex flex-wrap gap-1">
                    {msg.citations.map((cit) => (
                      <div key={cit.index} className="relative">
                        <button
                          onMouseEnter={() => setHoveredCitation(cit.index)}
                          onMouseLeave={() => setHoveredCitation(null)}
                          onClick={() => {
                            if (cit.document_id) {
                              navigate(`/document/${cit.document_id}/view?highlight=${cit.chunk_id}`)
                            }
                          }}
                          className="text-xs px-2 py-0.5 bg-primary-100 text-primary-700 rounded-full font-medium hover:bg-primary-200 cursor-pointer transition-colors"
                        >
                          [{cit.index}] {cit.document_name}
                        </button>
                        {hoveredCitation === cit.index && (
                          <div className="absolute bottom-full left-0 mb-2 w-72 p-3 bg-white rounded-xl shadow-lg border border-surface-200 text-xs z-30 pointer-events-none">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium text-surface-700 truncate max-w-[180px]">{cit.document_name}</span>
                              <span className="text-primary-500 flex-shrink-0 ml-2">相关度 {(cit.score * 100).toFixed(0)}%</span>
                            </div>
                            <p className="text-surface-500 leading-relaxed">{cit.snippet}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 添加到笔记 — 仅最后一条非流式 open 来源消息 */}
              {msg.role === 'assistant' && msg.source === 'open' && i === messages.length - 1 && !streaming && msg.content && !msg.content.startsWith('❌') && (
                <div className="mt-2 pt-2 border-t border-surface-200/50">
                  <button
                    onClick={() => onSaveNote?.(msg.content)}
                    className="text-xs px-3 py-1 bg-primary-50 text-primary-600 rounded-full font-medium hover:bg-primary-100 transition-colors flex items-center gap-1"
                  >
                    <Plus size={12} />
                    添加到笔记
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {streaming && messages[messages.length - 1]?.role === 'assistant' && !messages[messages.length - 1]?.content && (
          <div className="flex items-center gap-2 text-surface-400 text-sm px-4">
            <Loader2 size={16} className="animate-spin" />
            思考中...
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 输入区 */}
      <div className="px-4 py-3 border-t border-surface-200 bg-white">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入你的问题... (Enter发送, Shift+Enter换行)"
            rows={1}
            className="flex-1 px-4 py-3 bg-surface-50 rounded-xl text-sm border border-surface-200 focus:border-primary-500 outline-none resize-none max-h-32 transition-colors"
            disabled={streaming}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || streaming}
            className="p-3 text-white rounded-xl disabled:opacity-50 transition-colors flex-shrink-0 bg-primary-500 hover:bg-primary-600"
          >
            {streaming ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
          </button>
        </div>
        {embedded && (
          <button
            onClick={handleNewChat}
            className="mt-2 text-xs text-surface-400 hover:text-primary-500 transition-colors w-full"
          >
            + 新建对话
          </button>
        )}
      </div>
    </div>
  )
}
