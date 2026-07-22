import {
  BookOpen, Lightbulb, ListChecks, GitCompare, ListOrdered,
  Zap, Target, Beaker, Info,
} from 'lucide-react'

interface GenUIPoint {
  label?: string
  text: string
  icon?: string
}

interface GenUIStep {
  text: string
  tip?: string
}

interface GenUIComparison {
  headers: string[]
  rows: string[][]
}

interface GenUIProps {
  data: {
    type: 'concept-card' | 'key-points' | 'comparison' | 'steps' | 'example-box'
    title?: string
    definition?: string
    points?: GenUIPoint[]
    tags?: string[]
    items?: GenUIPoint[]
    headers?: string[]
    rows?: string[][]
    steps?: GenUIStep[]
    text?: string
  }
}

const iconMap: Record<string, React.ReactNode> = {
  info: <Info size={14} />,
  target: <Target size={14} />,
  beaker: <Beaker size={14} />,
  zap: <Zap size={14} />,
  lightbulb: <Lightbulb size={14} />,
}

function renderIcon(iconName?: string) {
  if (iconName && iconMap[iconName]) return iconMap[iconName]
  return <Info size={14} className="text-surface-400" />
}

export default function GenUI({ data }: GenUIProps) {
  if (!data || !data.type) return null

  switch (data.type) {
    case 'concept-card':
      return (
        <div className="my-4 rounded-2xl border border-primary-200 bg-gradient-to-br from-primary-50/50 to-white overflow-hidden">
          {/* 头部 */}
          <div className="px-4 py-3 border-b border-primary-100 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <BookOpen size={18} className="text-primary-500" />
              <h4 className="font-semibold text-sm text-primary-800">{data.title}</h4>
            </div>
            {data.tags && data.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {data.tags.map((tag, i) => (
                  <span key={i} className="text-xs px-2 py-0.5 bg-primary-100 text-primary-600 rounded-full font-medium">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
          {/* 定义 */}
          {data.definition && (
            <div className="px-4 py-3 text-sm text-surface-700 leading-relaxed">
              {data.definition}
            </div>
          )}
          {/* 要点列表 */}
          {data.points && data.points.length > 0 && (
            <div className="px-4 pb-3 space-y-1.5">
              {data.points.map((p, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-primary-400 mt-0.5 flex-shrink-0">
                    {renderIcon(p.icon)}
                  </span>
                  {p.label && (
                    <span className="text-primary-600 font-medium flex-shrink-0">{p.label}:</span>
                  )}
                  <span className="text-surface-600">{p.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )

    case 'key-points':
      return (
        <div className="my-4 rounded-2xl border border-amber-200 bg-amber-50/40 overflow-hidden">
          <div className="px-4 py-3 border-b border-amber-100 flex items-center gap-2">
            <ListChecks size={18} className="text-amber-500" />
            <h4 className="font-semibold text-sm text-amber-800">{data.title || '关键要点'}</h4>
          </div>
          <div className="px-4 py-3 space-y-2">
            {data.items?.map((item, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <span className="w-5 h-5 rounded-full bg-amber-200 text-amber-700 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <span className="text-surface-700">{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      )

    case 'comparison':
      return (
        <div className="my-4 rounded-2xl border border-surface-200 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-100 flex items-center gap-2">
            <GitCompare size={18} className="text-indigo-500" />
            <h4 className="font-semibold text-sm text-surface-800">{data.title || '对比'}</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-100">
                  {data.headers?.map((h, i) => (
                    <th key={i} className={`px-4 py-2 text-left font-semibold text-surface-600 ${i === 0 ? '' : ''}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows?.map((row, ri) => (
                  <tr key={ri} className={ri % 2 === 0 ? 'bg-surface-50/50' : ''}>
                    {row.map((cell, ci) => (
                      <td key={ci} className={`px-4 py-2 ${ci === 0 ? 'font-medium text-surface-700' : 'text-surface-600'}`}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )

    case 'steps':
      return (
        <div className="my-4 rounded-2xl border border-green-200 bg-green-50/30 overflow-hidden">
          <div className="px-4 py-3 border-b border-green-100 flex items-center gap-2">
            <ListOrdered size={18} className="text-green-500" />
            <h4 className="font-semibold text-sm text-green-800">{data.title || '步骤指南'}</h4>
          </div>
          <div className="px-4 py-3 space-y-3">
            {data.steps?.map((step, i) => (
              <div key={i} className="flex gap-3">
                {/* 序号圆圈 */}
                <div className="flex flex-col items-center">
                  <div className="w-7 h-7 rounded-full bg-green-200 text-green-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {i + 1}
                  </div>
                  {i < (data.steps?.length || 0) - 1 && (
                    <div className="w-0.5 flex-1 bg-green-200 mt-1" />
                  )}
                </div>
                <div className="pb-2">
                  <p className="text-sm text-surface-700 leading-relaxed">{step.text}</p>
                  {step.tip && (
                    <div className="mt-1 flex items-start gap-1.5">
                      <Lightbulb size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
                      <span className="text-xs text-amber-600">{step.tip}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )

    case 'example-box':
      return (
        <div className="my-4 rounded-2xl border border-blue-200 bg-blue-50/40 overflow-hidden">
          <div className="px-4 py-3 border-b border-blue-100 flex items-center gap-2">
            <Lightbulb size={18} className="text-blue-500" />
            <h4 className="font-semibold text-sm text-blue-800">{data.title || '示例'}</h4>
          </div>
          {data.text && (
            <div className="px-4 py-3 text-sm text-surface-700 leading-relaxed">
              {data.text}
            </div>
          )}
        </div>
      )

    default:
      return null
  }
}
