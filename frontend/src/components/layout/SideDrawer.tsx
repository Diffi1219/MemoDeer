import { useNavigate, useParams } from 'react-router-dom'
import { useUIStore } from '../../store/uiStore'
import { useAuthStore } from '../../store/authStore'
import {
  BookOpen, Search, Settings, LogOut, X, MessageSquare,
  ChevronRight, Info, User,
} from 'lucide-react'

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

  return (
    <div
      className={`fixed top-0 left-0 h-full w-[280px] bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-out ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      {/* 头部 */}
      <div className="flex items-center justify-between p-4 border-b border-surface-200">
        <div>
          <h2 className="font-semibold text-lg text-primary-700">MemoDeer</h2>
          <p className="text-xs text-surface-300 truncate max-w-[200px]">
            {user?.display_name || user?.username || '未登录'}
          </p>
        </div>
        <button onClick={closeDrawer} className="p-2 hover:bg-surface-100 rounded-lg">
          <X size={20} />
        </button>
      </div>

      {/* 菜单 */}
      <nav className="p-2">
        {menuItems.map((item, i) => (
          <button
            key={i}
            onClick={item.onClick}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-surface-100 transition-colors text-left"
          >
            <item.icon size={20} className="text-surface-500" />
            <span className="text-sm font-medium">{item.label}</span>
            <ChevronRight size={16} className="text-surface-300 ml-auto" />
          </button>
        ))}
      </nav>

      {/* 底部登出 */}
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-surface-200">
        <button
          onClick={() => { logout(); closeDrawer(); navigate('/login') }}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-red-50 text-red-500 transition-colors"
        >
          <LogOut size={20} />
          <span className="text-sm font-medium">退出登录</span>
        </button>
      </div>
    </div>
  )
}
