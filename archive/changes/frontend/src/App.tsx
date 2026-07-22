import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuthStore } from './store/authStore'
import { useUIStore } from './store/uiStore'
import Layout from './components/layout/Layout'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import HomePage from './pages/HomePage'
import NotebookPage from './pages/NotebookPage'
import ChatPage from './pages/ChatPage'
import DocumentViewPage from './pages/DocumentViewPage'
import SettingsPage from './pages/SettingsPage'
import MembershipPage from './pages/MembershipPage'
import QuizPage from './pages/QuizPage'
import AboutPage from './pages/AboutPage'
import ProfilePage from './pages/ProfilePage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token)
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  const colorTheme = useUIStore((s) => s.colorTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = colorTheme
  }, [colorTheme])

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<HomePage />} />
        <Route path="notebook/:id" element={<NotebookPage />} />
        <Route path="notebook/:id/chat/:sid?" element={<ChatPage />} />
        <Route path="notebook/:id/quiz" element={<QuizPage />} />
        <Route path="membership" element={<MembershipPage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="/document/:docId/view" element={<ProtectedRoute><DocumentViewPage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
