import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Crown, BookOpen, FileText, MessageCircle, Flame, Edit3, Check, X as XIcon, Loader2 } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import apiClient from '../api/client'
import PageHeader from '../components/layout/PageHeader'

export default function ProfilePage() {
  const navigate = useNavigate()
  const { user, isPremium, premiumType, setAuth } = useAuthStore()
  const premiumExpireAt = user?.premium_expire_at || null
  const [stats, setStats] = useState({ notebook_count: 0, document_count: 0, chat_count: 0, created_at: '' })
  const [checkinDays, setCheckinDays] = useState(0)
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)

  // 加载统计
  useEffect(() => {
    apiClient.get('/auth/user/stats').then(r => setStats(r.data)).catch(() => {})
    // 打卡逻辑
    const today = new Date().toISOString().slice(0, 10)
    const lastCheckin = localStorage.getItem('last_checkin_date')
    const days = parseInt(localStorage.getItem('checkin_days') || '0')
    if (lastCheckin !== today) {
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
      const newDays = lastCheckin === yesterday ? days + 1 : 1
      localStorage.setItem('checkin_days', String(newDays))
      localStorage.setItem('last_checkin_date', today)
      setCheckinDays(newDays)
    } else {
      setCheckinDays(days)
    }
  }, [])

  // 编辑个人信息
  const handleEdit = (field: string, currentValue: string) => {
    setEditingField(field)
    setEditValue(currentValue)
  }

  const handleSave = async () => {
    if (!editValue.trim()) return
    setSaving(true)
    try {
      // 暂用：更新 display_name（todo: 后端需 PUT /api/user/profile 端点）
      const updatedUser = { ...user!, display_name: editValue.trim() }
      setAuth(localStorage.getItem('token')!, updatedUser as any)
      setEditingField(null)
    } catch {
      alert('保存失败')
    } finally {
      setSaving(false)
    }
  }

  const premiumLabel = isPremium
    ? (premiumType === 'lifetime' ? '终身会员 👑' : '高级会员')
    : '免费版'
  const expireLabel = premiumType === 'lifetime' ? '永久有效'
    : premiumExpireAt ? `到期: ${new Date(premiumExpireAt).toLocaleDateString('zh-CN')}`
    : ''

  return (
    <div className="h-full flex flex-col bg-surface-50">
      <PageHeader title="我的" onBack={() => navigate(-1)} />

      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-8">
        {/* Profile Card */}
        <div className="bg-surface-0 rounded-2xl border border-surface-200 p-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-xl font-bold text-primary-500">
                {(user?.display_name || user?.username || '?')[0].toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-base font-semibold text-surface-800 truncate">
                {user?.display_name || user?.username}
              </p>
              <p className="text-xs text-surface-400">@{user?.username}</p>
              <p className="text-xs text-surface-300 mt-0.5">
                加入于 {stats.created_at ? new Date(stats.created_at).toLocaleDateString('zh-CN') : '—'}
              </p>
            </div>
          </div>

          {/* Membership status */}
          <div className={`mt-4 p-3 rounded-xl flex items-center justify-between ${isPremium ? 'bg-accent-light/30 border border-accent/20' : 'bg-surface-50'}`}>
            <div className="flex items-center gap-2">
              <Crown size={18} className={isPremium ? 'text-accent' : 'text-surface-300'} />
              <div>
                <span className={`text-sm font-medium ${isPremium ? 'text-accent-dark' : 'text-surface-500'}`}>{premiumLabel}</span>
                {expireLabel && <p className="text-xs text-surface-400">{expireLabel}</p>}
              </div>
            </div>
            {!isPremium && (
              <button onClick={() => navigate('/membership')} className="text-xs px-3 py-1 bg-accent text-white rounded-lg font-medium hover:bg-accent-dark btn-press">
                升级
              </button>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: BookOpen, label: '笔记本', value: stats.notebook_count, color: 'text-blue-500', bg: 'bg-blue-50' },
            { icon: FileText, label: '文档', value: stats.document_count, color: 'text-green-500', bg: 'bg-green-50' },
            { icon: MessageCircle, label: '对话', value: stats.chat_count, color: 'text-purple-500', bg: 'bg-purple-50' },
            { icon: Flame, label: '连续打卡', value: `${checkinDays}天`, color: 'text-orange-500', bg: 'bg-orange-50' },
          ].map(s => (
            <div key={s.label} className={`${s.bg} rounded-xl p-4 text-center`}>
              <s.icon size={22} className={`${s.color} mx-auto mb-1`} />
              <p className="text-xl font-bold text-surface-800">{s.value}</p>
              <p className="text-xs text-surface-400">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Personal Info */}
        <div className="bg-surface-0 rounded-2xl border border-surface-200 overflow-hidden">
          <h3 className="text-sm font-semibold text-surface-600 px-4 py-3 border-b border-surface-100">个人信息</h3>
          {[
            { label: '用户名', value: user?.username || '', field: 'username', editable: false },
            { label: '显示名', value: user?.display_name || '', field: 'display_name', editable: true },
          ].map(row => (
            <div key={row.field} className="flex items-center justify-between px-4 py-3 border-b border-surface-50 last:border-0">
              <span className="text-sm text-surface-500">{row.label}</span>
              <div className="flex items-center gap-2">
                {editingField === row.field ? (
                  <>
                    <input
                      type="text"
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      className="w-32 px-2 py-1 border border-surface-200 rounded-lg text-sm text-right focus:border-primary-500 outline-none"
                      autoFocus
                    />
                    <button onClick={handleSave} disabled={saving} className="p-1 text-green-500 hover:bg-green-50 rounded">
                      {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    </button>
                    <button onClick={() => setEditingField(null)} className="p-1 text-surface-300 hover:bg-surface-50 rounded">
                      <XIcon size={14} />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="text-sm text-surface-700">{row.value || '—'}</span>
                    {row.editable && (
                      <button onClick={() => handleEdit(row.field, row.value)} className="p-1 text-surface-300 hover:text-primary-500 rounded">
                        <Edit3 size={14} />
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Membership Benefits */}
        <div className="bg-surface-0 rounded-2xl border border-surface-200 overflow-hidden">
          <h3 className="text-sm font-semibold text-surface-600 px-4 py-3 border-b border-surface-100">会员权益</h3>
          <div className="p-4 space-y-2">
            {[
              { feature: '基础问答', free: true, premium: true },
              { feature: '知识库管理', free: true, premium: true },
              { feature: '文档全文查看 & 编辑', free: true, premium: true },
              { feature: '文件树 & 文件夹管理', free: true, premium: true },
              { feature: '全局搜索', free: true, premium: true },
              { feature: '知识点提取', free: false, premium: true },
              { feature: 'AI 智能出题', free: false, premium: true },
              { feature: '知识卡片', free: false, premium: true },
              { feature: '记忆口诀', free: false, premium: true },
            ].map(row => (
              <div key={row.feature} className="flex items-center justify-between text-sm">
                <span className="text-surface-600">{row.feature}</span>
                <div className="flex items-center gap-3">
                  <span className={`text-xs ${row.free ? 'text-green-500' : 'text-surface-300'}`}>
                    {row.free ? '免费' : '—'}
                  </span>
                  <span className={`text-xs ${row.premium ? 'text-accent' : 'text-surface-300'}`}>
                    {row.premium ? '会员' : '—'}
                  </span>
                </div>
              </div>
            ))}
          </div>
          {!isPremium && (
            <div className="px-4 pb-4">
              <button onClick={() => navigate('/membership')} className="w-full py-2.5 bg-accent text-white text-sm font-medium rounded-xl hover:bg-accent-dark flex items-center justify-center gap-2 btn-press">
                <Crown size={16} /> 升级解锁全部权益
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
