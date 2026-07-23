import { create } from 'zustand'

export type ColorTheme = 'blue' | 'purple' | 'orange' | 'green' | 'pink'
export type ThemeMode = 'light' | 'dark' | 'system'
export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface Toast {
  id: string
  message: string
  type: ToastType
  duration?: number
}

function getInitialTheme(): ColorTheme {
  const stored = localStorage.getItem('colorTheme')
  if (stored && ['blue', 'purple', 'orange', 'green', 'pink'].includes(stored)) {
    return stored as ColorTheme
  }
  return 'blue'
}

function getInitialThemeMode(): ThemeMode {
  const stored = localStorage.getItem('themeMode')
  if (stored && ['light', 'dark', 'system'].includes(stored)) {
    return stored as ThemeMode
  }
  return 'system'
}

function applyTheme(theme: ColorTheme) {
  localStorage.setItem('colorTheme', theme)
  document.documentElement.dataset.theme = theme
}

function applyThemeMode(mode: ThemeMode) {
  localStorage.setItem('themeMode', mode)

  if (mode === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    document.documentElement.dataset.themeMode = prefersDark ? 'dark' : 'light'
  } else {
    document.documentElement.dataset.themeMode = mode
  }
}

function getResolvedThemeMode(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return mode
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
  themeMode: ThemeMode
  setThemeMode: (mode: ThemeMode) => void
  resolvedThemeMode: () => 'light' | 'dark'
  toasts: Toast[]
  addToast: (message: string, type?: ToastType, duration?: number) => void
  removeToast: (id: string) => void
}

export const useUIStore = create<UIState>((set, get) => ({
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
  themeMode: getInitialThemeMode(),
  setThemeMode: (mode) => {
    applyThemeMode(mode)
    set({ themeMode: mode })
  },
  resolvedThemeMode: () => getResolvedThemeMode(get().themeMode),
  toasts: [],
  addToast: (message, type = 'info', duration = 3000) => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
    set((s) => ({ toasts: [...s.toasts, { id, message, type, duration }] }))
    if (duration > 0) setTimeout(() => get().removeToast(id), duration)
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))
