import { create } from 'zustand'

export type ColorTheme = 'blue' | 'purple' | 'orange' | 'green' | 'pink'

function getInitialTheme(): ColorTheme {
  const stored = localStorage.getItem('colorTheme')
  if (stored && ['blue', 'purple', 'orange', 'green', 'pink'].includes(stored)) {
    return stored as ColorTheme
  }
  return 'blue'
}

function applyTheme(theme: ColorTheme) {
  localStorage.setItem('colorTheme', theme)
  document.documentElement.dataset.theme = theme
}

interface UIState {
  isDrawerOpen: boolean
  isUploadOpen: boolean
  isGlobalSearchOpen: boolean
  toggleDrawer: () => void
  closeDrawer: () => void
  openUpload: () => void
  closeUpload: () => void
  openGlobalSearch: () => void
  closeGlobalSearch: () => void
  apiBaseUrl: string
  setApiBaseUrl: (url: string) => void
  sidebarWidth: number
  setSidebarWidth: (w: number) => void
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  activeFileId: string | null
  setActiveFile: (id: string | null) => void
  pendingVectorizeCount: number
  setPendingVectorizeCount: (n: number) => void
  colorTheme: ColorTheme
  setColorTheme: (theme: ColorTheme) => void
}

export const useUIStore = create<UIState>((set) => ({
  isDrawerOpen: false,
  isUploadOpen: false,
  isGlobalSearchOpen: false,
  toggleDrawer: () => set((s) => ({ isDrawerOpen: !s.isDrawerOpen })),
  closeDrawer: () => set({ isDrawerOpen: false }),
  openUpload: () => set({ isUploadOpen: true }),
  closeUpload: () => set({ isUploadOpen: false }),
  openGlobalSearch: () => set({ isGlobalSearchOpen: true }),
  closeGlobalSearch: () => set({ isGlobalSearchOpen: false }),
  apiBaseUrl: localStorage.getItem('apiBaseUrl') || '',
  setApiBaseUrl: (url) => {
    localStorage.setItem('apiBaseUrl', url)
    set({ apiBaseUrl: url })
  },
  sidebarWidth: 260,
  setSidebarWidth: (w) => set({ sidebarWidth: w }),
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  activeFileId: null,
  setActiveFile: (id) => set({ activeFileId: id }),
  pendingVectorizeCount: 0,
  setPendingVectorizeCount: (n) => set({ pendingVectorizeCount: n }),
  colorTheme: getInitialTheme(),
  setColorTheme: (theme) => {
    applyTheme(theme)
    set({ colorTheme: theme })
  },
}))
