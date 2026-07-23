import { Outlet } from 'react-router-dom'
import { useUIStore } from '../../store/uiStore'
import SideDrawer from './SideDrawer'
import Toast from '../common/Toast'
import PageTransition from '../common/PageTransition'

export default function Layout() {
  const isDrawerOpen = useUIStore((s) => s.isDrawerOpen)
  const closeDrawer = useUIStore((s) => s.closeDrawer)

  return (
    <div className="h-full flex flex-col bg-surface-50">
      {/* 主内容区 */}
      <div className="flex-1 overflow-hidden relative">
        <PageTransition>
          <Outlet />
        </PageTransition>
      </div>

      {/* 侧拉栏遮罩 */}
      {isDrawerOpen && (
        <div className="drawer-overlay" onClick={closeDrawer} />
      )}

      {/* 侧拉栏 */}
      <SideDrawer />

      {/* Toast 通知 */}
      <Toast />
    </div>
  )
}
