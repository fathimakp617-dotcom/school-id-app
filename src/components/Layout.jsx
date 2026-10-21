import { useEffect, useRef, useState } from 'react'
import { LogOut, Menu, X } from 'lucide-react'

export default function Layout({ user, onLogout, navItems, activeTab, setActiveTab, accentColor = 'blue', children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const touchStart = useRef(null)

  useEffect(() => {
    const closeOnEscape = event => { if (event.key === 'Escape') setSidebarOpen(false) }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [])

  const handleTouchStart = event => {
    const touch = event.touches[0]
    touchStart.current = { x: touch.clientX, y: touch.clientY }
  }
  const handleTouchEnd = event => {
    if (!touchStart.current) return
    const touch = event.changedTouches[0]
    const dx = touch.clientX - touchStart.current.x
    const dy = touch.clientY - touchStart.current.y
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.3) {
      if (!sidebarOpen && touchStart.current.x <= 36 && dx > 0) setSidebarOpen(true)
      else if (sidebarOpen && dx < 0) setSidebarOpen(false)
    }
    touchStart.current = null
  }

  const colorMap = {
    blue: { sidebar: 'bg-blue-900', active: 'bg-blue-600', logo: 'from-blue-500 to-blue-600', hover: 'hover:bg-blue-800' },
    emerald: { sidebar: 'bg-emerald-900', active: 'bg-emerald-600', logo: 'from-emerald-500 to-emerald-600', hover: 'hover:bg-emerald-800' },
    purple: { sidebar: 'bg-purple-900', active: 'bg-purple-600', logo: 'from-purple-500 to-purple-600', hover: 'hover:bg-purple-800' },
  }
  const c = colorMap[accentColor]

  const roleEmoji = { parent: '👨‍👩‍👧', teacher: '👩‍🏫', admin: '🛠️' }

  return (
    <div className="min-h-screen flex bg-gray-50" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <button aria-label="Close navigation menu" className="fixed inset-0 bg-slate-950/55 z-20 lg:hidden animate-fade-in" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside id="school-navigation" aria-label="Main navigation" className={`fixed top-0 left-0 h-full w-[min(19rem,86vw)] ${c.sidebar} text-white z-30 transform transition-transform duration-300 ease-out shadow-2xl lg:shadow-none ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:relative lg:flex-shrink-0 flex flex-col`}>
        {/* Logo */}
        <div className="p-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${c.logo} flex items-center justify-center text-lg shadow-lg`}>
              🏫
            </div>
            <div>
              <div className="font-bold text-base">SchoolID</div>
              <div className="text-white/50 text-xs capitalize">{user.role} Portal</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-current={activeTab === item.id ? 'page' : undefined}
              onClick={() => { setActiveTab(item.id); setSidebarOpen(false) }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab === item.id ? c.active : `text-white/70 ${c.hover} hover:text-white`}`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
              {item.badge > 0 && (
                <span className="ml-auto bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* User info + logout */}
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-base">
              {roleEmoji[user.role]}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">{user.name}</div>
              <div className="text-white/50 text-xs truncate">{user.email}</div>
            </div>
          </div>
          <button
            onClick={onLogout}
            type="button"
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-white/70 ${c.hover} hover:text-white text-sm transition-all`}
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar (mobile) */}
        <header className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
          <button type="button" aria-label="Open navigation menu" aria-controls="school-navigation" aria-expanded={sidebarOpen} onClick={() => setSidebarOpen(true)} className="p-2 -ml-2 rounded-lg hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <span className="font-bold text-gray-800">SchoolID</span>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto animate-page-in">
          {children}
        </main>
      </div>
    </div>
  )
}
