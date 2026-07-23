import { useState, useEffect, useRef, useCallback } from 'react'
import ObsidianMarkdown from '../common/ObsidianMarkdown'
import SelectionAsk from '../common/SelectionAsk'
import { Eye, Edit3, Save, Loader2 } from 'lucide-react'

interface MarkdownEditorProps {
  fileName: string
  content: string
  needsRevectorize: boolean
  onSave: (content: string) => Promise<void>
  onRevectorize?: () => void
  readOnly?: boolean
  notebookId?: string
}

export default function MarkdownEditor({
  fileName, content: initialContent,
  needsRevectorize, onSave, onRevectorize, readOnly, notebookId,
}: MarkdownEditorProps) {
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [text, setText] = useState(initialContent)
  const [savedText, setSavedText] = useState(initialContent)
  const [saving, setSaving] = useState(false)

  const editorRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const lineNumbersRef = useRef<HTMLDivElement>(null)

  // Sync when external content changes
  useEffect(() => {
    setText(initialContent)
    setSavedText(initialContent)
  }, [initialContent])

  // Line numbers
  const lines = text.split('\n')
  const lineCount = lines.length
  const charCount = text.length

  const isModified = text !== savedText

  // Sync scroll between textarea and line numbers
  const handleScroll = useCallback(() => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop
    }
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        if (mode === 'edit' && isModified) {
          handleSave()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [mode, text, isModified])

  const handleSave = async () => {
    if (!isModified) return
    setSaving(true)
    try {
      await onSave(text)
      setSavedText(text)
    } finally {
      setSaving(false)
    }
  }

  const handleTab = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      const start = e.currentTarget.selectionStart
      const end = e.currentTarget.selectionEnd
      const newText = text.substring(0, start) + '  ' + text.substring(end)
      setText(newText)
      // Restore cursor position
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = start + 2
          textareaRef.current.selectionEnd = start + 2
        }
      }, 0)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* 工具栏 */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-surface-200 bg-surface-0/90 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-0.5 bg-surface-100 rounded-lg p-0.5">
          <button
            onClick={() => setMode('view')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              mode === 'view'
                ? 'bg-surface-0 text-primary-600 shadow-sm'
                : 'text-surface-400 hover:text-surface-600'
            }`}
          >
            <Eye size={13} />
            <span className="hidden sm:inline">预览</span>
          </button>
          {!readOnly && (
            <button
              onClick={() => { setMode('edit'); setTimeout(() => textareaRef.current?.focus(), 50) }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                mode === 'edit'
                  ? 'bg-surface-0 text-primary-600 shadow-sm'
                  : 'text-surface-400 hover:text-surface-600'
              }`}
            >
              <Edit3 size={13} />
              <span className="hidden sm:inline">编辑</span>
            </button>
          )}
        </div>

        <span className="text-xs text-surface-400 ml-2 truncate max-w-[200px]">
          {fileName}
        </span>

        <div className="ml-auto flex items-center gap-2">
          {!readOnly && (
            <button
              onClick={handleSave}
              disabled={!isModified || saving}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all btn-press ${
                isModified
                  ? 'bg-primary-500 text-white hover:bg-primary-600'
                  : 'text-surface-300 cursor-not-allowed'
              } disabled:opacity-50`}
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              <span className="hidden sm:inline">{isModified ? '保存' : '已保存'}</span>
            </button>
          )}
        </div>
      </div>

      {/* 内容区 */}
      <div ref={editorRef} className="flex-1 overflow-hidden relative">
        {/* 预览模式 */}
        {mode === 'view' && (
          <div className="h-full overflow-y-auto">
            <SelectionAsk notebookId={notebookId}>
              <article className="prose prose-sm max-w-none px-6 py-4">
                <ObsidianMarkdown content={text} />
              </article>
            </SelectionAsk>
          </div>
        )}

        {/* 编辑模式 */}
        {mode === 'edit' && (
          <div className="flex h-full overflow-hidden">
            {/* 行号列 */}
            <div
              ref={lineNumbersRef}
              className="w-12 flex-shrink-0 bg-surface-50 border-r border-surface-200 overflow-hidden select-none"
              style={{ fontFamily: '"JetBrains Mono", "Fira Code", monospace' }}
            >
              <div className="py-3">
                {Array.from({ length: lineCount || 1 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-[21px] text-[11px] text-surface-300 text-right pr-2 leading-[21px]"
                  >
                    {i + 1}
                  </div>
                ))}
              </div>
            </div>

            {/* 编辑区 */}
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onScroll={handleScroll}
              onKeyDown={handleTab}
              className="flex-1 p-3 border-none outline-none resize-none text-[14px] leading-[21px] text-surface-800 bg-surface-0"
              style={{ fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace' }}
              spellCheck={false}
              placeholder="开始编写 Markdown..."
            />
          </div>
        )}
      </div>

      {/* 状态栏 */}
      <div className="flex items-center gap-3 px-3 py-1 border-t border-surface-200 bg-surface-50 text-[11px] text-surface-400">
        <span>{lineCount} 行</span>
        <span>{charCount.toLocaleString()} 字</span>
        {isModified && (
          <span className="text-warning font-medium">未保存的修改</span>
        )}
        {needsRevectorize && !isModified && (
          <span className="text-orange-500 font-medium flex items-center gap-1">
            ⚠️ 待向量化
            {onRevectorize && (
              <button
                onClick={onRevectorize}
                className="text-primary-500 hover:underline ml-1"
              >
                立即向量化
              </button>
            )}
          </span>
        )}
        {!isModified && !needsRevectorize && (
          <span className="text-green-500">已同步</span>
        )}
      </div>
    </div>
  )
}
