import { useState } from 'react'
import { Shield, Smartphone, Bell, LoaderCircle } from 'lucide-react'

export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async event => {
    event.preventDefault()
    setError('')
    setLoading(true)
    try { await onLogin(email, password) }
    catch (loginError) { setError(loginError.message || 'Could not sign in.') }
    finally { setLoading(false) }
  }

  return <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-4">
    <div className="absolute inset-0 overflow-hidden pointer-events-none"><div className="absolute left-20 top-20 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl"/><div className="absolute bottom-20 right-20 h-96 w-96 rounded-full bg-purple-500/10 blur-3xl"/></div>
    <div className="relative w-full max-w-md">
      <div className="mb-8 text-center"><div className="mb-4 inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-2xl shadow-blue-500/30"><Shield className="h-10 w-10 text-white"/></div><h1 className="mb-1 text-3xl font-bold text-white">SchoolID</h1><p className="text-sm text-blue-300">Smart Attendance Management System</p></div>
      <form onSubmit={submit} className="space-y-4 rounded-3xl border border-white/20 bg-white/10 p-6 shadow-2xl backdrop-blur-xl">
        <div className="text-center"><h2 className="mb-1 text-lg font-semibold text-white">Sign in</h2><p className="text-sm text-blue-200">Use the account provided by your school</p></div>
        {error && <p role="alert" className="rounded-xl border border-red-300/30 bg-red-500/15 p-3 text-sm text-red-100">{error}</p>}
        <label className="block text-sm font-medium text-white" htmlFor="login-email">Email address<input id="login-email" required type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} className="mt-1.5 w-full rounded-xl border border-white/20 bg-slate-900/80 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-blue-400"/></label>
        <label className="block text-sm font-medium text-white" htmlFor="login-password">Password<input id="login-password" required type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} className="mt-1.5 w-full rounded-xl border border-white/20 bg-slate-900/80 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-blue-400"/></label>
        <button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-500 disabled:opacity-60">{loading && <LoaderCircle className="h-4 w-4 animate-spin"/>}{loading ? 'Signing in…' : 'Sign in'}</button>
        <p className="text-center text-xs text-blue-200/70">If you need access, contact your school administrator.</p>
      </form>
      <div className="mt-6 flex items-center justify-center gap-6 text-xs text-blue-300/70"><span className="flex items-center gap-1.5"><Smartphone className="h-3.5 w-3.5"/>RFID Enabled</span><span className="flex items-center gap-1.5"><Bell className="h-3.5 w-3.5"/>Live updates</span></div>
    </div>
  </div>
}

