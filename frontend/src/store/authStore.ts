import { create } from 'zustand'

interface User {
  id: string
  username: string
  display_name: string
  is_premium: boolean
  premium_type: 'free' | 'monthly' | 'lifetime'
  premium_expire_at: string | null
}

interface AuthState {
  token: string | null
  user: User | null
  isPremium: boolean
  premiumType: string
  setAuth: (token: string, user: User) => void
  logout: () => void
  isLoggedIn: () => boolean
  setPremium: (isPremium: boolean, premiumType: string, premiumExpireAt: string | null) => void
}

function parseUser(): User | null {
  try {
    const raw = localStorage.getItem('user')
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return {
      ...parsed,
      is_premium: parsed.is_premium || false,
      premium_type: parsed.premium_type || 'free',
      premium_expire_at: parsed.premium_expire_at || null,
    }
  } catch {
    return null
  }
}

const initialUser = parseUser()

export const useAuthStore = create<AuthState>((set, get) => ({
  token: localStorage.getItem('token'),
  user: initialUser,
  isPremium: initialUser?.is_premium || false,
  premiumType: initialUser?.premium_type || 'free',
  setAuth: (token, user) => {
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(user))
    set({
      token,
      user,
      isPremium: user.is_premium || false,
      premiumType: user.premium_type || 'free',
    })
  },
  logout: () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    set({ token: null, user: null, isPremium: false, premiumType: 'free' })
  },
  isLoggedIn: () => !!get().token,
  setPremium: (isPremium, premiumType, premiumExpireAt) => {
    const currentUser = get().user
    if (currentUser) {
      const updated: User = {
        ...currentUser,
        is_premium: isPremium,
        premium_type: premiumType as 'free' | 'monthly' | 'lifetime',
        premium_expire_at: premiumExpireAt,
      }
      localStorage.setItem('user', JSON.stringify(updated))
      set({ user: updated, isPremium, premiumType })
    }
  },
}))
