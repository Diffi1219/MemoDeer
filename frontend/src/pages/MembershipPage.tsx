import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Crown, Check, Loader2, Sparkles, Infinity } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import apiClient from '../api/client'

const plans = [
  {
    key: 'monthly' as const,
    name: '高级会员',
    icon: Crown,
    color: 'amber',
    price: '19.9',
    unit: '/月',
    badge: undefined as string | undefined,
    features: [
      '全部免费功能',
      'AI 智能出题练习',
      '知识卡片生成',
      '记忆口诀生成',
      '优先功能更新',
    ],
    cta: '立即开通月购',
  },
  {
    key: 'lifetime' as const,
    name: '终身会员',
    icon: Infinity,
    color: 'purple',
    price: '299',
    unit: ' 永久',
    badge: '最划算' as string | undefined,
    features: [
      '全部高级功能',
      '永久有效，一次买断',
      '专属终身标识',
      '优先技术支持',
      '未来所有新功能免费',
    ],
    cta: '一次性买断终身',
  },
]

export default function MembershipPage() {
  const navigate = useNavigate()
  const { user, isPremium, premiumType, setPremium } = useAuthStore()
  const premiumExpireAt = user?.premium_expire_at || null
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)
  const [showPayment, setShowPayment] = useState(false)
  const [paying, setPaying] = useState(false)
  const [paid, setPaid] = useState(false)
  const [error, setError] = useState('')

  const handleUpgrade = async (plan: string) => {
    setPaying(true)
    setError('')
    try {
      // Step 1: 创建订单
      const orderRes = await apiClient.post('/payment/orders', { plan })
      const orderId = orderRes.data.id

      // Step 2: 模拟支付
      const payRes = await apiClient.post(`/payment/orders/${orderId}/pay`)
      const u = payRes.data.user
      setPremium(u.is_premium, u.premium_type, u.premium_expire_at)
      setPaid(true)
    } catch (err: any) {
      setError(err.response?.data?.detail || '支付失败，请重试')
    } finally {
      setPaying(false)
    }
  }

  // 已是会员
  if (isPremium) {
    const expireText = premiumType === 'lifetime'
      ? '永久有效'
      : premiumExpireAt
        ? `到期: ${new Date(premiumExpireAt).toLocaleDateString('zh-CN')}`
        : ''
    return (
      <div className="h-full overflow-y-auto bg-surface-50">
        <header className="flex items-center gap-3 px-4 py-3 bg-white border-b border-surface-200">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-surface-100 rounded-lg">
            <ArrowLeft size={20} />
          </button>
          <h1 className="font-semibold text-lg">会员中心</h1>
        </header>

        <div className="max-w-lg mx-auto px-4 py-12 text-center">
          <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Crown size={36} className="text-amber-500" />
          </div>
          <h2 className="text-xl font-bold text-surface-800 mb-2">
            {premiumType === 'lifetime' ? '👑 终身会员' : '⭐ 高级会员'}
          </h2>
          <p className="text-surface-400 mb-1">{expireText}</p>
          <p className="text-sm text-surface-400 mb-6">已解锁全部高级功能</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2.5 bg-primary-500 text-white rounded-xl font-medium hover:bg-primary-600"
          >
            返回首页
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto bg-surface-50">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 bg-white border-b border-surface-200">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-surface-100 rounded-lg">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-semibold text-lg">会员中心</h1>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 pb-24">
        {/* Hero */}
        <div className="text-center mb-8">
          <Sparkles size={40} className="text-amber-500 mx-auto mb-3" />
          <h2 className="text-2xl font-bold text-surface-800 mb-1">解锁全部学习功能</h2>
          <p className="text-surface-400 text-sm">
            升级会员，享受 AI 出题、知识卡片、记忆口诀等高级功能
          </p>
        </div>

        {/* Plan Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {/* Free Plan */}
          <div className="bg-white rounded-2xl border border-surface-200 p-6 flex flex-col">
            <h3 className="text-lg font-semibold text-surface-700 mb-1">免费版</h3>
            <p className="text-3xl font-bold text-surface-800 mb-1">¥0</p>
            <p className="text-xs text-surface-400 mb-4">永久免费</p>
            <ul className="space-y-2 mb-6 flex-1">
              {['知识库管理', '智能问答（RAG）', '文档全文查看', '全局搜索', '笔记管理'].map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-surface-600">
                  <Check size={16} className="text-green-500 flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <div className="px-4 py-2.5 bg-surface-100 text-surface-500 text-sm font-medium rounded-xl text-center">
              当前方案
            </div>
          </div>

          {/* Premium Plans */}
          {plans.map((plan) => {
            const Icon = plan.icon
            const isSelected = selectedPlan === plan.key
            return (
              <div
                key={plan.key}
                className={`bg-white rounded-2xl border-2 p-6 flex flex-col cursor-pointer transition duration-200 ${
                  isSelected
                    ? 'border-amber-400 shadow-lg shadow-amber-100'
                    : 'border-surface-200 hover:border-amber-200'
                }`}
                onClick={() => setSelectedPlan(plan.key)}
              >
                {plan.badge && (
                  <span className="self-end text-xs px-2 py-0.5 bg-amber-100 text-amber-600 rounded-full font-medium mb-2">
                    {plan.badge}
                  </span>
                )}
                <div className="flex items-center gap-2 mb-1">
                  <Icon size={20} className={plan.color === 'purple' ? 'text-purple-500' : 'text-amber-500'} />
                  <h3 className="text-lg font-semibold text-surface-700">{plan.name}</h3>
                </div>
                <p className="text-3xl font-bold text-surface-800 mb-1">
                  ¥{plan.price}<span className="text-sm font-normal text-surface-400">{plan.unit}</span>
                </p>
                <ul className="space-y-2 my-4 flex-1">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm text-surface-600">
                      <Check size={16} className="text-green-500 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          {plans.map((plan) => (
            <button
              key={plan.key}
              onClick={() => {
                setSelectedPlan(plan.key)
                setShowPayment(true)
              }}
              className={`flex-1 py-3 rounded-xl font-medium transition duration-200 flex items-center justify-center gap-2 ${
                plan.key === 'lifetime'
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 shadow-lg shadow-purple-200'
                  : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 shadow-lg shadow-amber-200'
              }`}
            >
              <plan.icon size={18} />
              {plan.cta}
            </button>
          ))}
        </div>
      </div>

      {/* Payment Modal */}
      {showPayment && selectedPlan && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center" onClick={() => { if (!paying) setShowPayment(false) }}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm p-6 shadow-xl animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
            {!paid ? (
              <>
                <div className="text-center mb-4">
                  <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Crown size={28} className="text-amber-500" />
                  </div>
                  <h3 className="text-lg font-semibold">
                    {selectedPlan === 'lifetime' ? '终身会员' : '高级会员（月购）'}
                  </h3>
                  <p className="text-2xl font-bold text-surface-800 mt-1">
                    ¥{selectedPlan === 'lifetime' ? '299' : '19.9'}
                    <span className="text-sm font-normal text-surface-400">
                      {selectedPlan === 'lifetime' ? ' 永久' : '/月'}
                    </span>
                  </p>
                </div>

                {/* Mock QR Code */}
                <div className="bg-surface-50 rounded-xl p-6 mb-4 text-center">
                  <div className="w-32 h-32 bg-white border-2 border-surface-200 rounded-xl mx-auto mb-3 flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-3xl mb-1">📱</div>
                      <p className="text-xs text-surface-400">微信/支付宝</p>
                      <p className="text-xs text-surface-300">扫码支付</p>
                    </div>
                  </div>
                  <p className="text-xs text-surface-400">
                    模拟支付演示 — 点击下方按钮完成支付
                  </p>
                </div>

                {error && (
                  <p className="text-sm text-red-500 text-center mb-3">{error}</p>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => setShowPayment(false)}
                    disabled={paying}
                    className="flex-1 py-2.5 border border-surface-200 rounded-xl text-surface-600 font-medium hover:bg-surface-50 disabled:opacity-50"
                  >
                    取消
                  </button>
                  <button
                    onClick={() => handleUpgrade(selectedPlan)}
                    disabled={paying}
                    className="flex-1 py-2.5 bg-amber-500 text-white rounded-xl font-medium hover:bg-amber-600 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {paying ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                    {paying ? '处理中...' : '确认支付'}
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Check size={32} className="text-green-500" />
                </div>
                <h3 className="text-lg font-semibold text-surface-800 mb-1">支付成功！🎉</h3>
                <p className="text-sm text-surface-400 mb-4">
                  {selectedPlan === 'lifetime' ? '终身会员已开通，永久有效' : '高级会员已开通，有效期30天'}
                </p>
                <button
                  onClick={() => {
                    setShowPayment(false)
                    setPaid(false)
                    navigate('/')
                  }}
                  className="w-full py-2.5 bg-primary-500 text-white rounded-xl font-medium hover:bg-primary-600"
                >
                  开始使用
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
