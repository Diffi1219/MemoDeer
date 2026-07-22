import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import apiClient from '../api/client'
import { Brain, Loader2, Upload, MessageCircle, Search } from 'lucide-react'

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
    <div className="min-h-screen flex items-center justify-center bg-surface-50 p-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-primary-400 to-primary-600 rounded-2xl mb-3 shadow-lg shadow-primary-200">
            <Brain size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-surface-900">MemoDeer</h1>
          <p className="text-surface-400 text-sm mt-1">上传即理解，提问即回答</p>
        </div>

        {/* 表单 */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm p-6 space-y-4 border border-surface-100">
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-surface-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition-colors"
              placeholder="请输入用户名"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-surface-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition-colors"
              placeholder="请输入密码"
              required
            />
          </div>

          {error && (
            <div className="text-red-500 text-sm bg-red-50 p-3 rounded-xl">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-primary-500 text-white font-medium rounded-xl hover:bg-primary-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
          >
            {loading ? <Loader2 size={20} className="animate-spin" /> : null}
            {loading ? '登录中...' : '登录'}
          </button>

          <p className="text-center text-sm text-surface-400">
            还没有账号？{' '}
            <Link to="/register" className="text-primary-500 font-medium hover:underline">注册</Link>
          </p>
        </form>

        {/* 功能介绍 */}
        <div className="mt-6 grid grid-cols-3 gap-2">
          {[
            { icon: Upload, label: '上传资料', sub: 'PDF/DOCX/MD' },
            { icon: MessageCircle, label: 'AI 问答', sub: '引用原文出处' },
            { icon: Search, label: '全局搜索', sub: '快速定位知识' },
          ].map((f) => (
            <div key={f.label} className="text-center">
              <div className="w-10 h-10 rounded-xl bg-white border border-surface-200 flex items-center justify-center mx-auto mb-1 shadow-sm">
                <f.icon size={18} className="text-surface-400" />
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
