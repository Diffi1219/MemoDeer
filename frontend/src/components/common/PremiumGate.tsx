import { useNavigate } from 'react-router-dom'
import { Crown, Sparkles, ChevronRight } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'

interface PremiumGateProps {
  feature: string
  icon?: React.ReactNode
  description?: string
  highlights?: string[]
  children?: React.ReactNode
}

const defaultHighlights: Record<string, string[]> = {
  '知识点提取': [
    'AI 自动从文档中提取核心知识点',
    '结构化展示：标题、详解、标签分类',
    '覆盖主要概念、公式、关键定义',
    '按重要程度排序，一目了然',
  ],
  'AI 智能出题': [
    '基于你的知识库自动生成选择题和填空题',
    '支持选择题/填空题/混合三种模式',
    '逐题作答，自动批改并给出详细解析',
    '答题结束后查看正确率和错题回顾',
  ],
  '知识卡片': [
    '从知识库中提取核心概念，生成翻转卡片',
    '正面问题，背面答案，帮助主动回忆',
    '按标签筛选，快速定位薄弱知识点',
    '随时随地翻卡片复习，碎片时间高效利用',
  ],
  '记忆口诀': [
    'AI 将枯燥知识点编成朗朗上口的口诀',
    '每条口诀配有助记提示，降低记忆门槛',
    '标注口诀来源文档，方便回溯原文',
  ],
}

export default function PremiumGate({ feature, icon, description, highlights, children }: PremiumGateProps) {
  const isPremium = useAuthStore((s) => s.isPremium)
  const navigate = useNavigate()

  if (isPremium && children) {
    return <>{children}</>
  }

  const featureHighlights = highlights || defaultHighlights[feature] || []

  return (
    <div className="px-4 py-6 max-w-md mx-auto">
      {/* Feature Intro Card */}
      <div className="bg-white rounded-2xl border border-surface-200 overflow-hidden shadow-sm">
        {/* Top gradient banner */}
        <div className="bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 px-5 py-6 text-center">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-3 backdrop-blur-sm">
            {icon || <Sparkles size={30} className="text-white" />}
          </div>
          <h2 className="text-xl font-bold text-white">{feature}</h2>
        </div>

        {/* Description */}
        <div className="px-5 py-4">
          <p className="text-sm text-surface-500 leading-relaxed">
            {description || `${feature}是 MemoDeer 的高级功能，由 AI 驱动，帮助你更高效地学习和记忆。`}
          </p>

          {/* Highlights */}
          {featureHighlights.length > 0 && (
            <div className="mt-4 space-y-2.5">
              {featureHighlights.map((h, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-600 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span className="text-sm text-surface-600">{h}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* VIP 功能对比 */}
        <div className="px-5 pt-1 pb-2">
          <h4 className="text-xs font-semibold text-surface-500 mb-2">会员专属功能一览</h4>
          <div className="space-y-1.5 text-xs">
            {[
              { name: '知识点提取', desc: 'AI 自动提取核心知识点' },
              { name: '知识卡片', desc: '翻转卡片助记' },
              { name: '记忆口诀', desc: '朗朗上口的学习口诀' },
              { name: 'AI 智能出题', desc: '自动生成练习题' },
            ].map((f) => (
              <div key={f.name} className="flex items-center gap-2 text-surface-500">
                <Crown size={10} className="text-amber-400 flex-shrink-0" />
                <span className="font-medium">{f.name}</span>
                <span className="text-surface-300">—</span>
                <span className="text-surface-400">{f.desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="px-5 pb-5">
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-200">
            <div className="flex items-center gap-2 mb-2">
              <Crown size={16} className="text-amber-500" />
              <span className="text-sm font-medium text-amber-700">高级会员专属功能</span>
            </div>
            <div className="flex gap-3 mb-3">
              <div className="flex-1 text-center">
                <p className="text-lg font-bold text-amber-700">¥19.9<span className="text-xs font-normal text-amber-500">/月</span></p>
                <p className="text-[10px] text-amber-400">月付方案</p>
              </div>
              <div className="w-px bg-amber-200" />
              <div className="flex-1 text-center">
                <p className="text-lg font-bold text-amber-700">¥299<span className="text-xs font-normal text-amber-500"> 永久</span></p>
                <p className="text-[10px] text-amber-400">终身方案</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/membership')}
              className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl text-sm font-medium hover:from-amber-600 hover:to-orange-600 transition duration-200 flex items-center justify-center gap-2 shadow-sm"
            >
              <Crown size={14} />
              立即开通会员
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
