import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import apiClient from '../api/client'
import { Brain, Loader2 } from 'lucide-react'

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
    <div className="min-h-screen flex items-center justify-center bg-surface-50 p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-500 rounded-2xl mb-4">
            <Brain size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-surface-900">创建账号</h1>
          <p className="text-surface-300 mt-1">加入 MemoDeer，开启智能学习</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-surface-200 focus:border-primary-500 outline-none transition-colors"
              placeholder="2-50个字符"
              required
              minLength={2}
              maxLength={50}
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">昵称（可选）</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-surface-200 focus:border-primary-500 outline-none transition-colors"
              placeholder="如何称呼你"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-surface-200 focus:border-primary-500 outline-none transition-colors"
              placeholder="至少6位"
              required
              minLength={6}
            />
          </div>

          {error && (
            <div className="text-red-500 text-sm bg-red-50 p-3 rounded-xl">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-primary-500 text-white font-medium rounded-xl hover:bg-primary-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={20} className="animate-spin" /> : null}
            {loading ? '注册中...' : '注册'}
          </button>

          <p className="text-center text-sm text-surface-400">
            已有账号？{' '}
            <Link to="/login" className="text-primary-500 font-medium hover:underline">登录</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
