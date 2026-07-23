import { useNavigate, useParams } from 'react-router-dom'
import { useUIStore } from '../../store/uiStore'
import { useAuthStore } from '../../store/authStore'
import {
  BookOpen, Search, Settings, LogOut, X, MessageSquare,
  ChevronRight, Info, User, Sparkles,
} from 'lucide-react'
import AntlerLogo from '../common/AntlerLogo'

export default function SideDrawer() {
  const isOpen = useUIStore((s) => s.isDrawerOpen)
  const closeDrawer = useUIStore((s) => s.closeDrawer)
  const openGlobalSearch = useUIStore((s) => s.openGlobalSearch)
  const logout = useAuthStore((s) => s.logout)
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const { id: notebookId } = useParams()

  const menuItems = [
    { icon: BookOpen, label: '笔记', onClick: () => { navigate('/'); closeDrawer() } },
    ...(notebookId ? [
      { icon: MessageSquare, label: '开始提问', onClick: () => { navigate(`/notebook/${notebookId}/chat`); closeDrawer() } },
    ] : []),
    { icon: Search, label: '全局搜索', onClick: () => { openGlobalSearch(); closeDrawer() } },
    { icon: Info, label: '关于', onClick: () => { navigate('/about'); closeDrawer() } },
    { icon: User, label: '我的', onClick: () => { navigate('/profile'); closeDrawer() } },
    { icon: Settings, label: '设置', onClick: () => { navigate('/settings'); closeDrawer() } },
  ]

  const initials = (user?.display_name || user?.username || '?')[0].toUpperCase()

  return (
    <div
      className={`fixed top-0 left-0 h-full w-[280px] shadow-xl z-50 transform transition-transform duration-slow ease-out ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}
      style={{ backgroundColor: 'var(--s-0)' }}
    >
      {/* 头部 — 品牌区 */}
      <div
        className="flex items-center justify-between p-4 border-b"
        style={{ borderColor: 'var(--s-200)' }}
      >
        <div className="flex items-center gap-2.5">
          {/* 头像 — 柔和渐变背景 */}
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-sm"
            style={{
              background: 'linear-gradient(135deg, var(--p-400), var(--p-600))',
              color: '#fff',
            }}
          >
            {initials}
          </div>
          <div>
            <h2 className="font-display text-lg font-normal" style={{ color: 'var(--s-800)' }}>
              MemoDeer
            </h2>
            <p className="text-xs text-surface-400 truncate max-w-[190px]">
              {user?.display_name || user?.username || '未登录'}
            </p>
          </div>
        </div>
        <button
          onClick={closeDrawer}
          className="p-2 hover:bg-surface-100 rounded-lg btn-press"
          style={{ '--tw-ring-color': 'var(--s-200)' } as React.CSSProperties}
        >
          <X size={18} className="text-surface-400" />
        </button>
      </div>

      {/* 菜单区 */}
      <nav className="p-2">
        {menuItems.map((item, i) => (
          <button
            key={i}
            onClick={item.onClick}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-surface-100 transition-colors text-left group stagger-item"
            style={{ animationDelay: `${i * 30}ms` }}
          >
            <item.icon size={20} className="text-surface-400 group-hover:text-primary-500 transition-colors" />
            <span className="text-sm font-medium text-surface-700">{item.label}</span>
            <ChevronRight size={16} className="text-surface-300 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        ))}
      </nav>

      {/* 底部区 */}
      <div
        className="absolute bottom-0 left-0 right-0 p-4 border-t"
        style={{ borderColor: 'var(--s-200)' }}
      >
        {/* 品牌鹿角标识 */}
        <div className="flex items-center justify-center gap-1.5 mb-3 opacity-40">
          <AntlerLogo className="w-4 h-3 text-surface-400" />
          <span className="text-[10px] text-surface-400 font-medium">善用 AI，智取知识</span>
        </div>

        {/* 登出按钮 */}
        <button
          onClick={() => { logout(); closeDrawer(); navigate('/login') }}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-danger-light text-surface-500 hover:text-danger transition-colors"
        >
          <LogOut size={18} />
          <span className="text-sm font-medium">退出登录</span>
        </button>

        {/* 注册页面不可见的会员入口 */}
        <button
          onClick={() => { navigate('/membership'); closeDrawer() }}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-surface-100 text-surface-400 hover:text-accent transition-colors mt-1"
        >
          <Sparkles size={18} />
          <span className="text-xs">升级会员</span>
        </button>
      </div>
    </div>
  )
}
