import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, FlipVertical, Sparkles, X as XIcon } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import apiClient from '../../api/client'
import PremiumGate from './PremiumGate'

interface CardItem {
  id: string
  title: string
  front: string
  back: string
  tags: string[]
}

interface Props {
  notebookId: string
}

export default function KnowledgeCards({ notebookId }: Props) {
  const isPremium = useAuthStore((s) => s.isPremium)
  const navigate = useNavigate()
  const [cards, setCards] = useState<CardItem[]>([])
  const [loading, setLoading] = useState(true)
  const [flipped, setFlipped] = useState<Set<string>>(new Set())
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [previewCard, setPreviewCard] = useState<CardItem | null>(null)

  useEffect(() => {
    if (!isPremium || !notebookId) return
    setLoading(true)
    apiClient.post(`/notebooks/${notebookId}/premium/generate`)
      .then(r => setCards(r.data.cards || []))
      .catch(() => {
        // Mock fallback data
        setCards([
          { id: 'c1', title: '光合作用', front: '植物利用光能，将CO₂和水转化为有机物并释放O₂的过程。', back: '光合作用分为光反应和暗反应两个阶段。光反应在类囊体膜上进行，水光解产生O₂、[H]和ATP；暗反应在叶绿体基质中进行，CO₂被固定并还原为糖类。', tags: ['生物', '植物生理'] },
          { id: 'c2', title: '细胞呼吸', front: '有机物在细胞内经过一系列氧化分解，释放能量的过程。', back: '细胞呼吸三个阶段：糖酵解（细胞质基质）、柠檬酸循环（线粒体基质）、氧化磷酸化（线粒体内膜）。总反应：C₆H₁₂O₆ + 6O₂ → 6CO₂ + 6H₂O + 能量。', tags: ['生物', '细胞'] },
        ])
      })
      .finally(() => setLoading(false))
  }, [notebookId, isPremium])

  if (!isPremium) {
    return <PremiumGate feature="知识卡片" icon={<FlipVertical size={30} className="text-white" />} description="从你的知识库中自动提取核心概念，生成正反面翻转卡片。正面是概念名称和简短定义，背面是详细解释和要点，帮助你通过主动回忆加深记忆。" />
  }

  const allTags = [...new Set(cards.flatMap(c => c.tags))]
  const filtered = activeTag ? cards.filter(c => c.tags.includes(activeTag)) : cards

  const toggleFlip = (id: string) => {
    setFlipped(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
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
      {/* Tag filter */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          <button
            onClick={() => setActiveTag(null)}
            className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${!activeTag ? 'bg-primary-100 text-primary-600' : 'bg-surface-100 text-surface-400 hover:bg-surface-200'}`}
          >
            全部
          </button>
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => setActiveTag(tag === activeTag ? null : tag)}
              className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${tag === activeTag ? 'bg-primary-100 text-primary-600' : 'bg-surface-100 text-surface-400 hover:bg-surface-200'}`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <FlipVertical size={40} className="text-surface-200 mx-auto mb-3" />
          <p className="text-sm text-surface-400 mb-3">暂无知识卡片</p>
          <button
            onClick={() => setLoading(true)}
            className="text-sm text-primary-500 font-medium hover:underline"
          >
            <Sparkles size={14} className="inline mr-1" />
            AI 生成知识卡片
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filtered.map(card => {
              const isFlipped = flipped.has(card.id)
              return (
                <div
                  key={card.id}
                  onClick={() => {
                    if (window.innerWidth < 640) {
                      setPreviewCard(card)
                    } else {
                      toggleFlip(card.id)
                    }
                  }}
                  className="bg-surface-0 rounded-xl border border-surface-200 p-4 cursor-pointer hover:border-primary-300 hover:shadow-sm transition duration-200 active:scale-[0.97] card-lift"
                >
                  <h4 className="text-sm font-semibold text-surface-800 mb-1.5">{card.title}</h4>
                  <p className="text-xs text-surface-500 leading-relaxed line-clamp-3">
                    {isFlipped ? card.back : card.front}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex gap-1">
                      {card.tags.slice(0, 2).map(t => (
                        <span key={t} className="text-xs px-1.5 py-0.5 bg-surface-100 text-surface-400 rounded">
                          {t}
                        </span>
                      ))}
                    </div>
                    <span className="text-xs text-surface-300">{isFlipped ? '背面' : '点击翻转'}</span>
                  </div>
                </div>
              )
            })}
          </div>

          <button
            onClick={() => {
              setLoading(true)
              apiClient.post(`/notebooks/${notebookId}/premium/generate`)
                .then(r => setCards(r.data.cards || []))
                .catch(() => {})
                .finally(() => setLoading(false))
            }}
            className="w-full mt-4 py-2.5 border border-dashed border-surface-300 rounded-xl text-sm text-surface-400 hover:border-primary-300 hover:text-primary-500 transition-colors flex items-center justify-center gap-2"
          >
            <Sparkles size={14} />
            AI 生成更多卡片
          </button>
        </>
      )}

      {/* Mobile preview modal */}
      {previewCard && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:hidden justify-center" onClick={() => setPreviewCard(null)}>
          <div className="bg-surface-0 rounded-t-2xl w-full p-6 max-h-[70vh] overflow-y-auto animate-modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">{previewCard.title}</h3>
              <button onClick={() => setPreviewCard(null)} className="p-1"><XIcon size={20} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-surface-400 mb-1">📝 正面</p>
                <p className="text-sm text-surface-700">{previewCard.front}</p>
              </div>
              <div>
                <p className="text-xs text-surface-400 mb-1">💡 背面</p>
                <p className="text-sm text-surface-700 whitespace-pre-line">{previewCard.back}</p>
              </div>
              <div className="flex gap-1">
                {previewCard.tags.map(t => (
                  <span key={t} className="text-xs px-2 py-0.5 bg-surface-100 text-surface-400 rounded-full">{t}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
