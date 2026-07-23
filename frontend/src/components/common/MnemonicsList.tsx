import { useState, useEffect } from 'react'
import { Loader2, Lightbulb, Sparkles } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import apiClient from '../../api/client'
import PremiumGate from './PremiumGate'

interface MnemonicItem {
  id: string
  title: string
  content: string
  source_doc: string
  tip: string
}

interface Props {
  notebookId: string
}

export default function MnemonicsList({ notebookId }: Props) {
  const isPremium = useAuthStore((s) => s.isPremium)
  const [mnemonics, setMnemonics] = useState<MnemonicItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isPremium || !notebookId) return
    setLoading(true)
    apiClient.post(`/notebooks/${notebookId}/premium/generate`)
      .then(r => setMnemonics(r.data.mnemonics || []))
      .catch(() => {
        // Mock fallback
        setMnemonics([
          {
            id: 'm1', title: '光合作用口诀',
            content: '光合作用分两段，光反应在类囊体，水光解产O₂，还有[H]和ATP。暗反应在基质中，CO₂固定最要紧，C₃还原成糖类，循环再生永不停。',
            source_doc: '光合作用知识点', tip: '记住：光→水光解，暗→CO₂固定',
          },
          {
            id: 'm2', title: '牛顿三定律速记口诀',
            content: '一定律讲惯性，不受外力状态恒；二定律说加速度，F等ma记清楚；三定律谈相互作用，大小相等方向反。',
            source_doc: '牛顿运动定律总结', tip: '一定惯、二定加、三定互——三个字概括三定律',
          },
        ])
      })
      .finally(() => setLoading(false))
  }, [notebookId, isPremium])

  if (!isPremium) {
    return <PremiumGate feature="记忆口诀" icon={<Lightbulb size={30} className="text-white" />} description="AI 把你知识库中难记的知识点编成朗朗上口的记忆口诀。每条口诀配合助记提示，让枯燥的背诵变得轻松有趣，显著提升记忆效率。" />
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={28} className="animate-spin text-surface-300" />
      </div>
    )
  }

  return (
    <div className="px-4 py-3 pb-20">
      {mnemonics.length === 0 ? (
        <div className="text-center py-12">
          <Lightbulb size={40} className="text-surface-200 mx-auto mb-3" />
          <p className="text-sm text-surface-400 mb-3">暂无记忆口诀</p>
          <button
            onClick={() => setLoading(true)}
            className="text-sm text-primary-500 font-medium hover:underline"
          >
            <Sparkles size={14} className="inline mr-1" />
            AI 生成记忆口诀
          </button>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {mnemonics.map(item => (
              <div key={item.id} className="bg-surface-0 rounded-xl border border-surface-200 overflow-hidden card-lift">
                <div className="px-4 py-3 border-b border-surface-100 flex items-center gap-2">
                  <Lightbulb size={16} className="text-accent flex-shrink-0" />
                  <h4 className="text-sm font-semibold text-surface-700">{item.title}</h4>
                  {item.source_doc && (
                    <span className="text-xs text-surface-300 ml-auto">📎 {item.source_doc}</span>
                  )}
                </div>
                <div className="px-4 py-3">
                  <p className="text-sm text-surface-600 leading-relaxed italic whitespace-pre-line">
                    "{item.content}"
                  </p>
                  {item.tip && (
                    <div className="mt-2 flex items-start gap-1.5">
                      <span className="text-xs text-accent flex-shrink-0">💡</span>
                      <span className="text-xs text-accent-dark flex-shrink-0">{item.tip}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => {
              setLoading(true)
              apiClient.post(`/notebooks/${notebookId}/premium/generate`)
                .then(r => setMnemonics(r.data.mnemonics || []))
                .catch(() => {})
                .finally(() => setLoading(false))
            }}
            className="w-full mt-4 py-2.5 border border-dashed border-surface-300 rounded-xl text-sm text-surface-400 hover:border-primary-300 hover:text-primary-500 transition-colors flex items-center justify-center gap-2 btn-press"
          >
            <Sparkles size={14} />
            AI 生成更多口诀
          </button>
        </>
      )}
    </div>
  )
}
