/** Obsidian 语法预处理 — 将 Obsidian 特有语法转换为标准 MD/HTML */

/**
 * 预处理 Obsidian 文本：
 * 1. 移除 %%注释%%
 * 2. ==高亮== → <mark>高亮</mark>
 * 3. [[wikilink]] → 内部链接渲染标记
 */
export function preprocessObsidian(text: string): string {
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

/** Callout 类型 → 颜色映射（使用设计 token，支持暗色模式自适应） */
export const CALLOUT_STYLES: Record<string, { bg: string; border: string; icon: string }> = {
  note:      { bg: 'bg-blue-50 dark:bg-blue-950',      border: 'border-blue-400 dark:border-blue-600',      icon: '📝' },
  tip:       { bg: 'bg-green-50 dark:bg-green-950',     border: 'border-green-400 dark:border-green-600',     icon: '💡' },
  info:      { bg: 'bg-cyan-50 dark:bg-cyan-950',       border: 'border-cyan-400 dark:border-cyan-600',       icon: 'ℹ️' },
  warning:   { bg: 'bg-amber-50 dark:bg-amber-950',     border: 'border-amber-400 dark:border-amber-600',     icon: '⚠️' },
  danger:    { bg: 'bg-red-50 dark:bg-red-950',          border: 'border-red-400 dark:border-red-600',          icon: '🚫' },
  important: { bg: 'bg-purple-50 dark:bg-purple-950',    border: 'border-purple-400 dark:border-purple-600',    icon: '❗' },
  success:   { bg: 'bg-emerald-50 dark:bg-emerald-950',  border: 'border-emerald-400 dark:border-emerald-600',  icon: '✅' },
  question:  { bg: 'bg-violet-50 dark:bg-violet-950',    border: 'border-violet-400 dark:border-violet-600',    icon: '❓' },
  example:   { bg: 'bg-teal-50 dark:bg-teal-950',        border: 'border-teal-400 dark:border-teal-600',        icon: '📋' },
  quote:     { bg: 'bg-slate-50 dark:bg-slate-900',     border: 'border-slate-400 dark:border-slate-600',     icon: '💬' },
  bug:       { bg: 'bg-rose-50 dark:bg-rose-950',        border: 'border-rose-400 dark:border-rose-600',        icon: '🐛' },
  todo:      { bg: 'bg-orange-50 dark:bg-orange-950',    border: 'border-orange-400 dark:border-orange-600',    icon: '📌' },
  abstract:  { bg: 'bg-indigo-50 dark:bg-indigo-950',    border: 'border-indigo-400 dark:border-indigo-600',    icon: '📄' },
  failure:   { bg: 'bg-red-50 dark:bg-red-950',          border: 'border-red-400 dark:border-red-600',          icon: '❌' },
}
