import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import LoginPage from './pages/LoginPage'
import ParentDashboard from './pages/ParentDashboard'
import TeacherDashboard from './pages/TeacherDashboard'
import AdminDashboard from './pages/AdminDashboard'
import { API_URL } from './data/apiConfig'
import { clearAuthSession, getAuthToken, getAuthUser, saveAuthSession, signIn } from './data/authStore'

export default function App() {
  const [user, setUser] = useState(() => getAuthUser())
  const [checkingSession, setCheckingSession] = useState(() => Boolean(getAuthToken()))

  useEffect(() => {
    const token = getAuthToken()
    if (!token) return
    fetch(`${API_URL}/api/auth/me`, { cache: 'no-store' })
      .then(async response => {
        if (!response.ok) throw new Error('Session expired')
        const account = await response.json()
        saveAuthSession({ token, user: account })
        setUser(account)
      })
      .catch(() => { clearAuthSession(); setUser(null) })
      .finally(() => setCheckingSession(false))
  }, [])

  const handleLogin = async (email, password) => {
    const account = await signIn(email, password)
    setUser(account)
  }

  const handleLogout = async () => {
    try { await fetch(`${API_URL}/api/auth/logout`, { method: 'POST' }) } catch { /* local sign-out still clears the session */ }
    clearAuthSession()
    setUser(null)
  }

  if (checkingSession) return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-sm text-white">Checking sign-in…</div>
  if (!user) return <LoginPage onLogin={handleLogin} />

  return (
    <Routes>
      {user.role === 'parent' && (
        <Route path="/*" element={<ParentDashboard user={user} onLogout={handleLogout} />} />
      )}
      {user.role === 'teacher' && (
        <Route path="/*" element={<TeacherDashboard user={user} onLogout={handleLogout} />} />
      )}
      {user.role === 'admin' && (
        <Route path="/*" element={<AdminDashboard user={user} onLogout={handleLogout} />} />
      )}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  )
}
