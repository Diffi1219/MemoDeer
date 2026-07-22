import ReactMarkdown from 'react-markdown'
import { useMemo } from 'react'

interface ObsidianMarkdownProps {
  content: string
  className?: string
}

/** 预处理 Obsidian 语法 → 标准 MD/HTML */
function preprocessObsidian(text: string): string {
  let result = text

  // 1. 移除 %%注释%%
  result = result.replace(/%%[\s\S]*?%%/g, '')
  result = result.replace(/%%.*$/gm, '')

  // 2. ==高亮== → <mark>高亮</mark>
  result = result.replace(/==(.+?)==/g, '<mark>$1</mark>')

  // 3. [[wikilink]] → [wikilink](#obsidian-wikilink)
  //    [[wikilink|display]] → [display](#obsidian-wikilink)
  result = result.replace(/\[\[([^\]|]+?)\]\]/g, (_m, p1) => `[${p1}](#obsidian-${p1.replace(/\s+/g, '-')})`)
  result = result.replace(/\[\[([^\]|]+?)\|([^\]]+?)\]\]/g, (_m, _p1, p2) => `[${p2}](#obsidian-wikilink)`)

  return result
}

/** Callout 类型 → 颜色映射 */
const CALLOUT_STYLES: Record<string, { bg: string; border: string; icon: string }> = {
  note:       { bg: 'bg-blue-50', border: 'border-blue-400', icon: '📝' },
  tip:        { bg: 'bg-green-50', border: 'border-green-400', icon: '💡' },
  info:       { bg: 'bg-cyan-50', border: 'border-cyan-400', icon: 'ℹ️' },
  warning:    { bg: 'bg-amber-50', border: 'border-amber-400', icon: '⚠️' },
  danger:     { bg: 'bg-red-50', border: 'border-red-400', icon: '🚫' },
  important:  { bg: 'bg-purple-50', border: 'border-purple-400', icon: '❗' },
  success:    { bg: 'bg-emerald-50', border: 'border-emerald-400', icon: '✅' },
  question:   { bg: 'bg-violet-50', border: 'border-violet-400', icon: '❓' },
  example:    { bg: 'bg-teal-50', border: 'border-teal-400', icon: '📋' },
  quote:      { bg: 'bg-slate-50', border: 'border-slate-400', icon: '💬' },
  bug:        { bg: 'bg-rose-50', border: 'border-rose-400', icon: '🐛' },
  todo:       { bg: 'bg-orange-50', border: 'border-orange-400', icon: '📌' },
  abstract:   { bg: 'bg-indigo-50', border: 'border-indigo-400', icon: '📄' },
  failure:    { bg: 'bg-red-50', border: 'border-red-400', icon: '❌' },
}

export default function ObsidianMarkdown({ content, className }: ObsidianMarkdownProps) {
  const processed = useMemo(() => preprocessObsidian(content), [content])

  return (
    <article className={`obsidian-content ${className || ''}`}>
      <ReactMarkdown
        components={{
          // ── Callout 渲染 ──
          blockquote({ children, ...props }) {
            // 检查是否为 Obsidian callout (> [!type])
            const node = (props as any).node
            const firstChild = node?.children?.[0]?.children?.[0]
            const text = firstChild?.value || ''
            const calloutMatch = text.match(/^\[!(\w+)\]\s*(.*)/)

            if (calloutMatch) {
              const type = calloutMatch[1].toLowerCase()
              const title = calloutMatch[2] || type.charAt(0).toUpperCase() + type.slice(1)
              const style = CALLOUT_STYLES[type] || CALLOUT_STYLES.note

              // 提取 callout 内容（跳过第一行的 [!type] title）
              const childrenArr = Array.isArray(children) ? children : [children]
              const contentChildren = childrenArr.slice(1)

              return (
                <div className={`${style.bg} border-l-4 ${style.border} rounded-r-lg p-4 my-3`}>
                  <div className="flex items-center gap-2 font-semibold text-sm mb-1 text-surface-700">
                    <span>{style.icon}</span>
                    <span>{title}</span>
                  </div>
                  <div className="text-sm text-surface-600">{contentChildren}</div>
                </div>
              )
            }

            // 普通引用
            return (
              <blockquote className="border-l-4 border-surface-300 pl-4 italic text-surface-500 my-3">
                {children}
              </blockquote>
            )
          },

          // ── Wikilink 渲染 ──
          a({ href, children, ...props }) {
            const isWikilink = href?.startsWith('#obsidian-')
            if (isWikilink) {
              return (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-primary-50 text-primary-600 rounded text-sm font-medium cursor-default">
                  {children}
                </span>
              )
            }
            return (
              <a
                href={href}
                className="text-primary-500 hover:text-primary-700 underline"
                target="_blank"
                rel="noopener noreferrer"
                {...props}
              >
                {children}
              </a>
            )
          },

          // ── ==高亮== 渲染 ──
          mark({ children }) {
            return (
              <mark className="bg-amber-200 text-amber-900 px-0.5 rounded">
                {children}
              </mark>
            )
          },

          // ── 表格 ──
          table({ children }) {
            return (
              <div className="overflow-x-auto my-3">
                <table className="min-w-full border-collapse border border-surface-200 text-sm">
                  {children}
                </table>
              </div>
            )
          },
          thead({ children }) {
            return <thead className="bg-surface-50">{children}</thead>
          },
          th({ children }) {
            return (
              <th className="border border-surface-200 px-3 py-2 text-left font-semibold text-surface-700">
                {children}
              </th>
            )
          },
          td({ children }) {
            return (
              <td className="border border-surface-200 px-3 py-2 text-surface-600">
                {children}
              </td>
            )
          },
        }}

        // 允许 HTML（用于 <mark> 标签）
        remarkPlugins={[]}
      >
        {processed}
      </ReactMarkdown>
    </article>
  )
}
