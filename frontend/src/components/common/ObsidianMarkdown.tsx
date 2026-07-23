import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import rehypeRaw from 'rehype-raw'
import { useMemo } from 'react'
import { preprocessObsidian, CALLOUT_STYLES } from '../../utils/obsidian'

interface ObsidianMarkdownProps {
  content: string
  className?: string
}

export default function ObsidianMarkdown({ content, className }: ObsidianMarkdownProps) {
  const processed = useMemo(() => preprocessObsidian(content), [content])

  return (
    <article className={`obsidian-content ${className || ''}`}>
      <ReactMarkdown
        components={{
          // ── Callout 渲染 ──
          blockquote({ children, ...props }) {
            // 检查是否为 Obsidian callout (> [!type]) — 从 node 或 children 中提取文本
            const node = (props as any).node
            // 优先用 raw node 文本；rehype-raw 会改变 AST 结构，需要回退到渲染 children
            const rawText = (() => {
              try {
                // 尝试递归提取 node 中所有 text 节点
                const walk = (n: any): string => {
                  if (!n) return ''
                  if (n.type === 'text' || n.type === 'raw') return n.value || ''
                  if (n.children) return n.children.map(walk).join('')
                  return ''
                }
                return walk(node)
              } catch { return '' }
            })()
            const calloutMatch = rawText.trimStart().match(/^\[!(\w+)\]\s*(.*)/)

            if (calloutMatch) {
              const type = calloutMatch[1].toLowerCase()
              const title = calloutMatch[2] || type.charAt(0).toUpperCase() + type.slice(1)
              const style = CALLOUT_STYLES[type] || CALLOUT_STYLES.note

              // 提取 callout 内容（跳过第一行的 [!type] title）
              // rehype-raw 后 children 结构为单个 <p>，内容在 text 中，需要 map 去除首行
              const childrenArr = Array.isArray(children) ? children : [children]
              const contentChildren = childrenArr.map((child: any) => {
                // 如果是段落且子节点是文本，尝试去除首行的 [!type] title
                if (child?.type === 'p' && Array.isArray(child.props?.children)) {
                  const textChildren = child.props.children as any[]
                  // 找到第一个包含 [!type] 的文本节点并移除该行
                  const filtered = textChildren.map((tc: any) => {
                    if (typeof tc === 'string' && tc.startsWith('[!')) {
                      const newlineIdx = tc.indexOf('\n')
                      return newlineIdx >= 0 ? tc.slice(newlineIdx + 1) : ''
                    }
                    return tc
                  }).filter(Boolean)
                  return { ...child, props: { ...child.props, children: filtered } }
                }
                return child
              }).filter((c: any) => {
                // 过滤掉空文本节点
                if (typeof c === 'string') return c.trim().length > 0
                return true
              })

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
              <mark className="bg-warning-light text-warning-700 dark:text-warning-400 px-0.5 rounded">
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
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex, rehypeRaw]}
      >
        {processed}
      </ReactMarkdown>
    </article>
  )
}
