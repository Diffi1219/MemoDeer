import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import apiClient from '../api/client'
import { Loader2, Upload, MessageCircle, Search } from 'lucide-react'
import AntlerLogo from '../components/common/AntlerLogo'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const setAuth = useAuthStore((s) => s.setAuth)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await apiClient.post('/auth/login', { username, password })
      setAuth(res.data.access_token, res.data.user)
      navigate('/', { replace: true })
    } catch (err: any) {
      setError(err.response?.data?.detail || '登录失败')
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
          <p className="text-surface-400 text-sm mt-1.5">善用 AI，智取知识</p>
        </div>

        {/* 表单卡片 — 浮在纸质纹理之上 */}
        <form onSubmit={handleSubmit} className="card p-6 space-y-4 shadow-md" style={{ backgroundColor: 'var(--s-0)' }}>
          <div>
            <label className="block text-sm font-medium text-surface-600 mb-1.5">用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input-primary"
              placeholder="请输入用户名"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-surface-600 mb-1.5">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-primary"
              placeholder="请输入密码"
              required
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
            {loading ? '登录中...' : '登录'}
          </button>

          <p className="text-center text-sm text-surface-400 pt-1">
            还没有账号？{' '}
            <Link to="/register" className="text-primary-500 font-semibold hover:underline">注册</Link>
          </p>
        </form>

        {/* 底部功能介绍 — 轻量化 */}
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
