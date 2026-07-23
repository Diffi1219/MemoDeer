import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import apiClient from '../api/client'
import { Loader2, Upload, MessageCircle, Search } from 'lucide-react'

/** 鹿角几何 SVG — 注册页品牌标识 */
function AntlerLogo() {
  return (
    <svg
      viewBox="0 0 40 28"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-10 h-7"
    >
      <path d="M20 26V10" />
      <path d="M20 10L6 2" />
      <path d="M20 10L34 2" />
      <path d="M6 2L2 8" />
      <path d="M34 2L38 8" />
    </svg>
  )
}

export default function RegisterPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const setAuth = useAuthStore((s) => s.setAuth)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 6) {
      setError('密码至少6位')
      return
    }
    setLoading(true)
    try {
      const res = await apiClient.post('/auth/register', {
        username,
        password,
        display_name: displayName || username,
      })
      setAuth(res.data.access_token, res.data.user)
      navigate('/', { replace: true })
    } catch (err: any) {
      setError(err.response?.data?.detail || '注册失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: 'var(--s-50)' }}>
      <div className="w-full max-w-sm animate-fade-in-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 shadow-glow"
            style={{
              background: 'linear-gradient(135deg, var(--p-400), var(--p-600))',
            }}
          >
            <AntlerLogo />
          </div>
          <h1 className="font-display text-3xl italic" style={{ color: 'var(--s-800)' }}>
            MemoDeer
          </h1>
          <p className="text-surface-400 text-sm mt-1.5">创建你的学习账号</p>
        </div>

        {/* 表单卡片 */}
        <form onSubmit={handleSubmit} className="card p-6 space-y-4 shadow-md" style={{ backgroundColor: 'var(--s-0)' }}>
          <div>
            <label className="block text-sm font-medium text-surface-600 mb-1.5">用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input-primary"
              placeholder="2-50个字符"
              required
              minLength={2}
              maxLength={50}
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-surface-600 mb-1.5">昵称（可选）</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="input-primary"
              placeholder="如何称呼你"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-surface-600 mb-1.5">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-primary"
              placeholder="至少6位"
              required
              minLength={6}
            />
          </div>

          {error && (
            <div className="text-danger text-sm p-3 rounded-xl" style={{ backgroundColor: 'var(--danger-light)' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 text-white font-semibold rounded-xl transition-all duration-fast flex items-center justify-center gap-2 shadow-sm hover:shadow-md active:scale-[0.98] disabled:opacity-50"
            style={{
              background: 'linear-gradient(135deg, var(--p-500), var(--p-600))',
            }}
          >
            {loading ? <Loader2 size={20} className="animate-spin" /> : null}
            {loading ? '注册中...' : '注册'}
          </button>

          <p className="text-center text-sm text-surface-400 pt-1">
            已有账号？{' '}
            <Link to="/login" className="text-primary-500 font-semibold hover:underline">登录</Link>
          </p>
        </form>

        {/* 底部功能介绍 */}
        <div className="mt-8 grid grid-cols-3 gap-3">
          {[
            { icon: Upload, label: '上传资料', sub: 'PDF / DOCX / MD' },
            { icon: MessageCircle, label: 'AI 问答', sub: '引用原文出处' },
            { icon: Search, label: '全局搜索', sub: '快速定位知识' },
          ].map((f) => (
            <div key={f.label} className="text-center">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-1.5 shadow-xs"
                style={{ backgroundColor: 'var(--s-0)' }}
              >
                <f.icon size={17} className="text-surface-400" />
              </div>
              <p className="text-xs font-medium text-surface-500">{f.label}</p>
              <p className="text-[10px] text-surface-300">{f.sub}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
