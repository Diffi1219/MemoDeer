import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { Loader2, Check, X as XIcon, ChevronLeft, ChevronRight, GraduationCap, ListChecks, Pencil, Shuffle, AlertTriangle } from 'lucide-react'
import apiClient from '../api/client'
import { useAuthStore } from '../store/authStore'
import PremiumGate from '../components/common/PremiumGate'
import PageHeader from '../components/layout/PageHeader'

interface QuizQuestion {
  id: string
  type: 'choice' | 'fill'
  question: string
  options: string[] | null
  answer: string
  explanation: string
  knowledge_point_id?: string
}

export default function QuizPage() {
  const { id: notebookId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const isPremium = useAuthStore((s) => s.isPremium)

  // 从导航 state 中获取选中的知识点和数量
  const stateFromNav = location.state as any
  const selectedKps = stateFromNav?.kps || []
  const presetCount = stateFromNav?.count || 5
  const presetQuizType = (stateFromNav?.quizType as 'choice' | 'fill' | 'mixed') || 'mixed'

  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({})
  const [showResult, setShowResult] = useState<Record<string, boolean>>({})
  const [quizType, setQuizType] = useState<'choice' | 'fill' | 'mixed'>(presetQuizType)
  const [count, setCount] = useState(presetCount)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [quizCompleted, setQuizCompleted] = useState(false)
  const [error, setError] = useState('')
  const [fillInput, setFillInput] = useState('')

  // 从 NotebookPage 导航过来时自动开始出题
  useEffect(() => {
    if (stateFromNav?.kps?.length > 0 && questions.length === 0 && !generating) {
      if (stateFromNav.quizType) setQuizType(stateFromNav.quizType)
      if (stateFromNav.count) setCount(stateFromNav.count)
      // 立即生成，不延迟
      handleGenerate()
    }
  }, [stateFromNav])

  // 生成题目
  const handleGenerate = async () => {
    setGenerating(true)
    setError('')
    try {
      const res = await apiClient.post(`/notebooks/${notebookId}/quiz/generate`, {
        question_type: quizType,
        count,
        knowledge_point_ids: selectedKps.map((k: any) => k.id),
      })
      setQuestions(res.data.questions)
      setCurrentIndex(0)
      setUserAnswers({})
      setShowResult({})
      setQuizCompleted(false)
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError('premium_required')
      } else {
        setError(err.response?.data?.detail || '生成题目失败，请稍后重试')
      }
    } finally {
      setGenerating(false)
    }
  }

  if (!isPremium) {
    return (
      <div className="h-full bg-surface-0 overflow-y-auto">
        <PageHeader title="出题练习" onBack={() => navigate(`/notebook/${notebookId}`)} />
        <PremiumGate
          feature="AI 智能出题"
          icon={<GraduationCap size={30} className="text-white" />}
          description="基于你的知识库内容，AI 自动生成针对性的选择题和填空题。每道题配有详细解析，答题后自动批改并统计正确率，是检验学习效果的最佳方式。"
        />
      </div>
    )
  }

  const currentQ = questions[currentIndex]
  const totalQuestions = questions.length
  const correctCount = Object.entries(userAnswers).filter(([id, ans]) => {
    const q = questions.find(qq => qq.id === id)
    return q && ans.trim().toLowerCase() === q.answer.trim().toLowerCase()
  }).length
  const answeredCount = Object.keys(userAnswers).length

  const handleAnswer = (answer: string) => {
    if (!currentQ || showResult[currentQ.id]) return
    setUserAnswers(prev => ({ ...prev, [currentQ.id]: answer }))
    setShowResult(prev => ({ ...prev, [currentQ.id]: true }))
  }

  const handleNext = () => {
    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex(currentIndex + 1)
      setFillInput('')
    } else if (answeredCount === totalQuestions) {
      setQuizCompleted(true)
      // 提交答题结果到后端
      submitAnswers()
    }
  }

  const submitAnswers = async () => {
    try {
      await apiClient.post(`/notebooks/${notebookId}/quiz/submit`, {
        answers: questions.map(q => ({
          question: q.question,
          user_answer: userAnswers[q.id] || '',
          correct_answer: q.answer,
          explanation: q.explanation,
          is_correct: (userAnswers[q.id] || '').trim().toLowerCase() === q.answer.trim().toLowerCase(),
          knowledge_point_id: q.knowledge_point_id || null,
        })),
      })
    } catch { /* 提交失败不影响结果展示 */ }
  }

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
      setFillInput('')
    }
  }

  const handleRetry = () => {
    handleGenerate()
  }

  const wrongQuestions = questions.filter(
    q => userAnswers[q.id] && userAnswers[q.id].trim().toLowerCase() !== q.answer.trim().toLowerCase()
  )

  if (generating) {
    return (
      <div className="h-full bg-surface-0 flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={36} className="animate-spin text-primary-500 mx-auto mb-3" />
          <p className="text-surface-400 text-sm">AI 正在生成题目...</p>
        </div>
      </div>
    )
  }

  // 题目生成前的设置页面
  if (questions.length === 0 && !generating) {
    return (
      <div className="h-full bg-surface-0 overflow-y-auto">
        <PageHeader title="出题练习" onBack={() => navigate(`/notebook/${notebookId}`)} />
        <div className="max-w-md mx-auto px-4 py-12">
          <div className="text-center mb-8">
            <GraduationCap size={48} className="text-primary-400 mx-auto mb-3" />
            <h2 className="text-xl font-bold text-surface-800 mb-1">AI 智能出题</h2>
            <p className="text-surface-400 text-sm">基于你的知识库内容自动生成练习题</p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-surface-600 mb-2 block">题型选择</label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { v: 'choice', icon: ListChecks, label: '选择题' },
                  { v: 'fill', icon: Pencil, label: '填空题' },
                  { v: 'mixed', icon: Shuffle, label: '混合' },
                ] as const).map(t => (
                  <button
                    key={t.v}
                    onClick={() => setQuizType(t.v)}
                    className={`flex flex-col items-center gap-1 py-3 rounded-xl border-2 transition duration-200 ${
                      quizType === t.v ? 'border-primary-400 bg-primary-50 text-primary-600' : 'border-surface-200 text-surface-400 hover:border-surface-300'
                    }`}
                  >
                    <t.icon size={20} />
                    <span className="text-xs font-medium">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-surface-600 mb-2 block">题目数量: {count} 题</label>
              <input
                type="range"
                min={3}
                max={10}
                value={count}
                onChange={e => setCount(Number(e.target.value))}
                className="w-full accent-primary-500"
              />
              <div className="flex justify-between text-xs text-surface-300">
                <span>3</span><span>10</span>
              </div>
            </div>
            <button
              onClick={handleGenerate}
              className="w-full py-3 bg-primary-500 text-white rounded-xl font-medium hover:bg-primary-600 transition-colors flex items-center justify-center gap-2"
            >
              <GraduationCap size={18} />
              开始出题
            </button>
            {error && (
              <p className="text-sm text-red-500 text-center mt-3">{error}</p>
            )}
          </div>
        </div>
      </div>
    )
  }

  // 结果页
  if (quizCompleted) {
    // 错题按知识点分组
    const wrongByKp = wrongQuestions.reduce((acc: Record<string, typeof wrongQuestions>, q) => {
      const key = q.knowledge_point_id || 'other'
      if (!acc[key]) acc[key] = []
      acc[key].push(q)
      return acc
    }, {})

    return (
      <div className="h-full bg-surface-0 overflow-y-auto">
        <PageHeader title="练习结果" onBack={() => navigate(`/notebook/${notebookId}`)} />
        <div className="max-w-lg mx-auto px-4 py-8 pb-24">
          <div className="text-center mb-8">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-3 ${
              correctCount === totalQuestions ? 'bg-green-50' : correctCount >= totalQuestions / 2 ? 'bg-primary-50' : 'bg-red-50'
            }`}>
              <span className={`text-3xl font-bold ${
                correctCount === totalQuestions ? 'text-green-500' : correctCount >= totalQuestions / 2 ? 'text-primary-500' : 'text-red-500'
              }`}>{correctCount}/{totalQuestions}</span>
            </div>
            <p className="text-lg font-semibold text-surface-800">
              {correctCount === totalQuestions ? '🎉 全部正确！' : correctCount >= totalQuestions / 2 ? '👍 继续加油！' : '📚 需要多复习哦'}
            </p>
            {wrongQuestions.length > 0 && (
              <div className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 rounded-xl">
                <AlertTriangle size={16} className="text-red-500" />
                <span className="text-sm font-medium text-red-600">
                  {wrongQuestions.length} 道错题已自动记录到错题本
                </span>
              </div>
            )}
          </div>

          {/* 错题集中展示 — 按知识点分组 */}
          {wrongQuestions.length > 0 && (
            <div className="mb-6 rounded-2xl border-2 border-red-200 bg-gradient-to-b from-red-50/60 to-white overflow-hidden">
              <div className="px-4 py-3 border-b border-red-100 bg-red-50 flex items-center gap-2">
                <AlertTriangle size={18} className="text-red-500" />
                <h3 className="text-sm font-bold text-red-700">错题回顾</h3>
                <span className="text-xs text-red-400 ml-auto">{wrongQuestions.length} 题答错</span>
              </div>
              <div className="px-4 py-3 space-y-4">
                {Object.entries(wrongByKp).map(([kpId, items]) => {
                  const kpTitle = kpId !== 'other'
                    ? selectedKps.find((k: any) => k.id === kpId)?.title || kpId.slice(0, 8)
                    : '其他'
                  return (
                    <div key={kpId} className="rounded-xl border border-red-100 bg-white overflow-hidden">
                      <div className="px-3 py-2 bg-red-50/50 border-b border-red-100">
                        <span className="text-xs font-semibold text-red-600">📌 {kpTitle}</span>
                        <span className="text-xs text-red-400 ml-1">({items.length} 题)</span>
                      </div>
                      {items.map((q, i) => {
                        const userAns = userAnswers[q.id] || '(未作答)'
                        const qIndex = questions.findIndex(qq => qq.id === q.id)
                        return (
                          <div key={q.id} className="p-3 border-b border-red-50 last:border-b-0 text-xs">
                            <div className="flex items-start gap-2">
                              <span className="text-[10px] font-bold text-red-400 bg-red-50 rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">
                                {qIndex >= 0 ? qIndex + 1 : i + 1}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-surface-700 mb-1 font-medium">Q: {q.question}</p>
                                <div className="flex gap-3 flex-wrap">
                                  <span className="text-red-500 font-medium">你的答案: {userAns}</span>
                                  <span className="text-green-600 font-medium">正确答案: {q.answer}</span>
                                </div>
                                <p className="text-surface-400 mt-1">💡 {q.explanation}</p>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
              {/* 针对错题再练 */}
              <div className="px-4 py-3 border-t border-red-100 bg-red-50/50">
                <button
                  onClick={() => {
                    // 提取错题关联的知识点 ID，重新导航到 QuizPage 只针对这些知识点出题
                    const wrongKpIds = [...new Set(wrongQuestions.map(q => q.knowledge_point_id).filter(Boolean))]
                    const wrongKps = wrongKpIds.length > 0
                      ? selectedKps.filter((k: any) => wrongKpIds.includes(k.id))
                      : selectedKps
                    navigate(`/notebook/${notebookId}/quiz`, {
                      state: { kps: wrongKps.length > 0 ? wrongKps : selectedKps, count: Math.min(wrongQuestions.length, 10), quizType },
                      replace: true,
                    })
                  }}
                  className="w-full py-2.5 bg-red-500 text-white text-sm rounded-xl font-medium hover:bg-red-600 flex items-center justify-center gap-2"
                >
                  <Shuffle size={14} /> 针对错题再练一组
                </button>
              </div>
            </div>
          )}

          {/* 全部题目概览 */}
          <h4 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3">全部题目</h4>
          <div className="space-y-2 mb-6">
            {questions.map((q, i) => {
              const userAns = userAnswers[q.id] || '(未作答)'
              const isCorrect = userAns.trim().toLowerCase() === q.answer.trim().toLowerCase()
              return (
                <div key={q.id} className={`rounded-xl border p-3 ${isCorrect ? 'border-green-200 bg-green-50/30' : 'border-red-200 bg-red-50/30'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-surface-500">第 {i + 1} 题</span>
                    {isCorrect ? <Check size={16} className="text-green-500" /> : <XIcon size={16} className="text-red-400" />}
                  </div>
                  <p className="text-sm text-surface-700 mb-1">{q.question}</p>
                  <div className="text-xs space-y-0.5">
                    <p className="text-surface-400">你的答案: <span className={isCorrect ? 'text-green-600' : 'text-red-500'}>{userAns}</span></p>
                    {!isCorrect && <p className="text-green-600">正确答案: {q.answer}</p>}
                    <p className="text-surface-400">💡 {q.explanation}</p>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="flex gap-3 flex-wrap">
            <button onClick={handleRetry} className="flex-1 py-2.5 bg-primary-500 text-white rounded-xl font-medium hover:bg-primary-600 min-w-[120px]">
              再来一组
            </button>
            <button onClick={() => navigate(`/notebook/${notebookId}`)} className="flex-1 py-2.5 border border-surface-200 rounded-xl text-surface-600 font-medium hover:bg-surface-50 min-w-[120px]">
              返回笔记本
            </button>
          </div>
          <div className="mt-4 text-center">
            <button
              onClick={() => navigate(`/notebook/${notebookId}`, { state: { openQuizTab: true } })}
              className="text-xs text-primary-500 hover:underline"
            >
              返回查看错题本
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!currentQ) return null

  return (
    <div className="h-full bg-surface-0 flex flex-col">
      <PageHeader
        title="出题练习"
        subtitle={`第 ${currentIndex + 1} / ${totalQuestions} 题 · 已答 ${answeredCount} 题`}
        onBack={() => navigate(`/notebook/${notebookId}`)}
        actions={
          <span className="text-xs font-medium text-primary-500">
            {correctCount}/{answeredCount > 0 ? answeredCount : '—'}
          </span>
        }
      />

      {/* Progress Bar */}
      <div className="h-1 bg-surface-100">
        <div
          className="h-full bg-primary-500 transition-[width] duration-300"
          style={{ width: `${(answeredCount / totalQuestions) * 100}%` }}
        />
      </div>

      {/* Question Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-lg mx-auto">
          {/* Type badge */}
          <span className="inline-block text-xs px-2 py-0.5 rounded-full font-medium mb-3 bg-surface-100 text-surface-500">
            {currentQ.type === 'choice' ? '选择题' : '填空题'}
          </span>

          <h3 className="text-base font-semibold text-surface-800 mb-6">{currentQ.question}</h3>

          {/* Choice */}
          {currentQ.type === 'choice' && currentQ.options && (
            <div className="space-y-2.5">
              {currentQ.options.map((opt, i) => {
                const optLetter = opt.charAt(0)
                const isSelected = userAnswers[currentQ.id] === optLetter
                const isRevealed = showResult[currentQ.id]
                const isCorrect = optLetter === currentQ.answer
                return (
                  <button
                    key={i}
                    onClick={() => handleAnswer(optLetter)}
                    disabled={isRevealed}
                    className={`w-full text-left p-3.5 rounded-xl border-2 transition duration-200 text-sm ${
                      isRevealed && isCorrect
                        ? 'border-green-400 bg-green-50'
                        : isRevealed && isSelected && !isCorrect
                        ? 'border-red-300 bg-red-50'
                        : isSelected
                        ? 'border-primary-400 bg-primary-50'
                        : 'border-surface-200 hover:border-surface-300'
                    }`}
                  >
                    <span className="font-medium">{opt}</span>
                  </button>
                )
              })}
            </div>
          )}

          {/* Fill */}
          {currentQ.type === 'fill' && (
            <div className="space-y-3">
              <input
                type="text"
                value={fillInput}
                onChange={e => setFillInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && fillInput.trim() && !showResult[currentQ.id]) {
                    handleAnswer(fillInput.trim())
                  }
                }}
                disabled={showResult[currentQ.id]}
                placeholder="输入你的答案..."
                className="w-full px-4 py-3 border-2 border-surface-200 rounded-xl text-sm focus:border-primary-500 outline-none disabled:bg-surface-50"
                autoFocus
              />
              {!showResult[currentQ.id] && (
                <button
                  onClick={() => fillInput.trim() && handleAnswer(fillInput.trim())}
                  disabled={!fillInput.trim()}
                  className="w-full py-2.5 bg-primary-500 text-white rounded-xl font-medium hover:bg-primary-600 disabled:opacity-50"
                >
                  提交答案
                </button>
              )}
            </div>
          )}

          {/* Result */}
          {showResult[currentQ.id] && (
            <div className={`mt-4 p-4 rounded-xl ${userAnswers[currentQ.id]?.trim().toLowerCase() === currentQ.answer.trim().toLowerCase() ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <div className="flex items-center gap-2 mb-1">
                {userAnswers[currentQ.id]?.trim().toLowerCase() === currentQ.answer.trim().toLowerCase() ? (
                  <><Check size={18} className="text-green-500" /><span className="text-sm font-medium text-green-700">回答正确！</span></>
                ) : (
                  <><XIcon size={18} className="text-red-400" /><span className="text-sm font-medium text-red-600">回答错误</span></>
                )}
              </div>
              {userAnswers[currentQ.id]?.trim().toLowerCase() !== currentQ.answer.trim().toLowerCase() && (
                <p className="text-sm text-green-600 mb-1">正确答案：{currentQ.answer}</p>
              )}
              <p className="text-xs text-surface-500 mt-1">💡 {currentQ.explanation}</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="px-4 py-3 border-t border-surface-200 bg-surface-0">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="p-2 border border-surface-200 rounded-lg hover:bg-surface-50 disabled:opacity-30"
          >
            <ChevronLeft size={18} />
          </button>

          {/* Question dots */}
          <div className="flex-1 flex justify-center gap-1.5">
            {questions.map((q, i) => {
              const ans = userAnswers[q.id]
              const isCorrect = ans && ans.trim().toLowerCase() === q.answer.trim().toLowerCase()
              return (
                <button
                  key={q.id}
                  onClick={() => { setCurrentIndex(i); setFillInput('') }}
                  className={`w-7 h-7 rounded-full text-xs font-medium transition duration-200 ${
                    i === currentIndex
                      ? 'bg-primary-500 text-white'
                      : ans
                      ? isCorrect
                        ? 'bg-green-100 text-green-600'
                        : 'bg-red-100 text-red-500'
                      : 'bg-surface-100 text-surface-400'
                  }`}
                >
                  {i + 1}
                </button>
              )
            })}
          </div>

          <button
            onClick={handleNext}
            disabled={!showResult[currentQ.id]}
            className="p-2 border border-surface-200 rounded-lg hover:bg-surface-50 disabled:opacity-30"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}
