import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import { mockStudents, mockAttendance, mockHomework, formatTime, formatDate } from '../data/mockData'
import { addStudent, API_URL, useStudents } from '../data/studentStore'
import { createAccount } from '../data/authStore'
import { useRfidScans } from '../data/rfidScanStore'
import { useAttendance } from '../data/attendanceStore'
import { DEFAULT_FEE_AMOUNT, saveSchoolSettings, setFeeStatus, useFees, useSchoolSettings } from '../data/feeStore'
import { Plus, Search, Download, Trash2, UserPlus, Check, CreditCard, X, Radio, LoaderCircle } from 'lucide-react'

const navItems = [
  { id: 'home', label: 'Dashboard', icon: '📊', badge: 0 },
  { id: 'students', label: 'Students', icon: '🎓', badge: 0 },
  { id: 'fees', label: 'Fee Payments', icon: '💳', badge: 0 },
  { id: 'attendance', label: 'All Attendance', icon: '📋', badge: 0 },
  { id: 'live-scans', label: 'Live RFID Scans', icon: '📡', badge: 0 },
  { id: 'register', label: 'Register Student', icon: '➕', badge: 0 },
  { id: 'accounts', label: 'User Accounts', icon: '🔐', badge: 0 },
  { id: 'reports', label: 'Reports', icon: '📈', badge: 0 },
]

// ---- DASHBOARD TAB ----
function DashboardTab({ onViewScans }) {
  const students = useStudents()
  const { scans, connection } = useRfidScans()
  const attendance = useAttendance()
  const todayKey = new Date().toISOString().slice(0, 10)
  const todayAtt = attendance.filter(a => a.timestamp.startsWith(todayKey) && a.type === 'arrival')
  const presentIds = [...new Set(todayAtt.map(a => a.studentId))]
  const absent = students.filter(s => !presentIds.includes(s.id))

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard 🛠️</h1>
        <p className="text-gray-500 text-sm">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card bg-gradient-to-br from-purple-600 to-purple-700 text-white border-0">
          <p className="text-purple-200 text-xs mb-1">Total Students</p>
          <p className="text-4xl font-bold">{students.length}</p>
        </div>
        <div className="card bg-gradient-to-br from-green-600 to-green-700 text-white border-0">
          <p className="text-green-200 text-xs mb-1">Present Today</p>
          <p className="text-4xl font-bold">{presentIds.length}</p>
        </div>
        <div className="card bg-gradient-to-br from-red-500 to-red-600 text-white border-0">
          <p className="text-red-200 text-xs mb-1">Absent Today</p>
          <p className="text-4xl font-bold">{absent.length}</p>
        </div>
        <div className="card bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0">
          <p className="text-blue-200 text-xs mb-1">Attendance Rate</p>
          <p className="text-4xl font-bold">{Math.round((presentIds.length / Math.max(students.length, 1)) * 100)}%</p>
        </div>
      </div>

      {/* Absent students */}
      {absent.length > 0 && (
        <div className="card border-l-4 border-red-400">
          <h3 className="font-semibold text-gray-800 mb-3">⚠️ Absent Today</h3>
          <div className="space-y-2">
            {absent.map(s => (
              <div key={s.id} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full ${s.avatarBg} flex items-center justify-center text-white text-xs font-bold`}>{s.avatar}</div>
                <div>
                  <p className="text-sm font-medium text-gray-800">{s.name}</p>
                  <p className="text-xs text-gray-500">Class {s.class}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent live RFID scans */}
      <div className="card">
        <div className="mb-3 flex items-center justify-between gap-3"><div><h3 className="font-semibold text-gray-800">📡 Live RFID Activity</h3><p className="mt-1 text-[11px] text-gray-400">{connection} · {API_URL}</p></div><button type="button" onClick={onViewScans} className="text-xs font-semibold text-purple-700 hover:underline">View all scans →</button></div>
        {scans.length === 0 ? <p className="py-5 text-center text-sm text-gray-500">No RFID scans have reached the server yet.</p> : <div className="space-y-2">{scans.slice(0, 5).map(scan => <div key={scan.id} className="flex items-center gap-3 border-b border-gray-50 py-2 last:border-0"><div className={`h-2.5 w-2.5 rounded-full ${scan.authorized ? 'bg-green-500' : 'bg-red-500'}`} /><p className="min-w-0 flex-1 truncate text-sm text-gray-700"><span className="font-medium">{scan.authorized ? scan.studentName : 'Unregistered card'}</span><span className="text-gray-400"> · UID {scan.uid}</span></p><span className="shrink-0 text-xs text-gray-400">{new Date(scan.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span></div>)}</div>}
      </div>
    </div>
  )
}

// ---- STUDENTS TAB ----
function StudentsTab({ onQuickAdd }) {
  const [search, setSearch] = useState('')
  const students = useStudents()
  const filtered = students.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.class.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3"><h1 className="text-2xl font-bold text-gray-900">Students ({students.length})</h1><button className="btn-primary bg-purple-600 hover:bg-purple-700" onClick={onQuickAdd}><Plus className="h-4 w-4"/> Add student</button></div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or class..."
          className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
      </div>

      <div className="space-y-3">
        {filtered.map(s => (
          <div key={s.id} className="card flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl ${s.avatarBg} flex items-center justify-center text-white font-bold`}>{s.avatar}</div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900">{s.name}</p>
              <p className="text-sm text-gray-500">Class {s.class}</p>
              <p className="text-xs font-mono text-gray-400 mt-0.5">RFID: {s.rfidUID}</p>
            </div>
            <div className="text-xs text-gray-400">{s.id}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FeesTab() {
  const students = useStudents()
  const fees = useFees()
  const settings = useSchoolSettings()
  const [settingsForm, setSettingsForm] = useState(settings)
  const [settingsSaved, setSettingsSaved] = useState(false)
  useEffect(() => setSettingsForm(settings), [settings])
  const [error, setError] = useState('')
  const [savingId, setSavingId] = useState('')
  const feeRows = students.map(student => ({ student, fee: fees[student.id] || { status: 'due', amount: settings.feeAmount || DEFAULT_FEE_AMOUNT } }))
  const update = async (studentId, status) => {
    setSavingId(studentId); setError('')
    try { await setFeeStatus(studentId, status) }
    catch (e) { setError(e.message) }
    finally { setSavingId('') }
  }
  const saveSettings = async event => {
    event.preventDefault(); setError(''); setSettingsSaved(false)
    try { await saveSchoolSettings({ ...settingsForm, feeAmount: Number(settingsForm.feeAmount) }); setSettingsSaved(true) }
    catch (e) { setError(e.message) }
  }
  return <div className="space-y-5"><div><h1 className="text-2xl font-bold text-gray-900">Fee Payments</h1><p className="text-sm text-gray-500 mt-1">Payment status shared with parent accounts</p></div>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <form onSubmit={saveSettings} className="card space-y-3"><h2 className="font-semibold text-gray-900">School payment settings</h2><label className="block text-sm text-gray-700">School name<input required value={settingsForm.schoolName || ''} onChange={e=>setSettingsForm({...settingsForm,schoolName:e.target.value})} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2"/></label><label className="block text-sm text-gray-700">Fee amount (₹)<input required type="number" min="1" value={settingsForm.feeAmount || ''} onChange={e=>setSettingsForm({...settingsForm,feeAmount:e.target.value})} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2"/></label><label className="block text-sm text-gray-700">School UPI ID<input value={settingsForm.upiId || ''} onChange={e=>setSettingsForm({...settingsForm,upiId:e.target.value})} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2" placeholder="schoolname@bank"/></label><div className="flex items-center gap-3"><button type="submit" className="btn-primary bg-purple-600 hover:bg-purple-700">Save payment settings</button>{settingsSaved && <span className="text-sm text-green-700">Saved</span>}</div></form>
    <div className="grid grid-cols-2 gap-3"><div className="card"><p className="text-sm text-gray-500">Collected</p><p className="mt-1 text-2xl font-bold text-green-600">₹{feeRows.filter(x=>x.fee.status==='paid').reduce((sum,x)=>sum+Number(x.fee.amount||DEFAULT_FEE_AMOUNT),0).toLocaleString('en-IN')}</p></div><div className="card"><p className="text-sm text-gray-500">Outstanding / pending</p><p className="mt-1 text-2xl font-bold text-orange-600">₹{feeRows.filter(x=>x.fee.status!=='paid').reduce((sum,x)=>sum+Number(x.fee.amount||DEFAULT_FEE_AMOUNT),0).toLocaleString('en-IN')}</p></div></div>
    <div className="space-y-3">{feeRows.map(({student,fee})=><div key={student.id} className="card flex flex-wrap items-center gap-3"><div className={`h-10 w-10 rounded-xl ${student.avatarBg} flex items-center justify-center text-white font-bold`}>{student.avatar}</div><div className="min-w-0 flex-1"><p className="font-semibold text-gray-900">{student.name}</p><p className="text-xs text-gray-500">{student.id} · Class {student.class}</p></div><span className={`badge ${fee.status==='paid'?'bg-green-100 text-green-700':fee.status==='pending'?'bg-blue-100 text-blue-700':'bg-orange-100 text-orange-700'}`}>{fee.status==='paid'?'Paid':fee.status==='pending'?'Payment reported':'Due'}</span><span className="text-sm font-semibold">₹{Number(fee.amount||DEFAULT_FEE_AMOUNT).toLocaleString('en-IN')}</span><button disabled={savingId===student.id} onClick={()=>update(student.id,fee.status==='paid'?'due':'paid')} className="btn-secondary py-2 text-xs disabled:opacity-50">{savingId===student.id?'Saving…':fee.status==='paid'?'Mark due':'Confirm paid'}</button></div>)}</div>
  </div>
}

function AccountsTab() {
  const students = useStudents()
  const [accounts, setAccounts] = useState([])
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'parent', studentId: '', className: '', subject: '' })
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const refresh = () => fetch(`${API_URL}/api/admin/accounts`, { cache: 'no-store' }).then(response => response.ok ? response.json() : Promise.reject(new Error('Could not load accounts.'))).then(setAccounts).catch(error => setError(error.message))
  useEffect(() => { refresh() }, [])
  const submit = async event => {
    event.preventDefault(); setSaving(true); setError(''); setNotice('')
    try {
      const account = await createAccount(form)
      setAccounts(current => [...current, account])
      setNotice(`Sign-in created for ${account.email}. Share the password with them privately.`)
      setForm({ name: '', email: '', password: '', role: form.role, studentId: '', className: '', subject: '' })
    } catch (saveError) { setError(saveError.message) }
    finally { setSaving(false) }
  }
  return <div className="space-y-5">
    <div><h1 className="text-2xl font-bold text-gray-900">User Accounts</h1><p className="mt-1 text-sm text-gray-500">Create individual Teacher and Parent sign-ins. Parent accounts can access only their linked student.</p></div>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="rounded-xl bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
    <form onSubmit={submit} className="card grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-medium text-gray-700">Account type<select value={form.role} onChange={event => setForm({ ...form, role: event.target.value, studentId: '', className: '' })} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-3"><option value="parent">Parent</option><option value="teacher">Teacher</option></select></label>
      <label className="text-sm font-medium text-gray-700">Full name<input required value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-3"/></label>
      <label className="text-sm font-medium text-gray-700">Email<input required type="email" autoComplete="off" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-3"/></label>
      <label className="text-sm font-medium text-gray-700">Temporary password<input required type="password" minLength={12} autoComplete="new-password" value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-3"/><span className="mt-1 block text-xs text-gray-400">At least 12 characters</span></label>
      {form.role === 'parent' ? <label className="text-sm font-medium text-gray-700 sm:col-span-2">Linked student<select required value={form.studentId} onChange={event => setForm({ ...form, studentId: event.target.value })} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-3"><option value="">Choose one student</option>{students.map(student => <option key={student.id} value={student.id}>{student.name} · {student.id} · Class {student.class}</option>)}</select></label> : <><label className="text-sm font-medium text-gray-700">Assigned class<input required value={form.className} onChange={event => setForm({ ...form, className: event.target.value })} placeholder="e.g. SA1" className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-3"/></label><label className="text-sm font-medium text-gray-700">Subject<input value={form.subject} onChange={event => setForm({ ...form, subject: event.target.value })} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-3"/></label></>}
      <button disabled={saving} className="btn-primary justify-center bg-purple-600 hover:bg-purple-700 disabled:opacity-60 sm:col-span-2">{saving ? 'Creating…' : 'Create account'}</button>
    </form>
    <div className="card overflow-x-auto p-0"><table className="w-full min-w-[560px] text-left text-sm"><thead className="bg-gray-50 text-xs uppercase text-gray-500"><tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Access</th></tr></thead><tbody className="divide-y divide-gray-100">{accounts.map(account => <tr key={account.id}><td className="px-4 py-3 font-medium text-gray-800">{account.name}</td><td className="px-4 py-3">{account.email}</td><td className="px-4 py-3 capitalize">{account.role}</td><td className="px-4 py-3">{account.role === 'parent' ? students.find(student => student.id === account.studentId)?.name || 'Linked student' : account.class ? `Class ${account.class}` : 'All classes'}</td></tr>)}</tbody></table></div>
  </div>
}

// ---- ALL ATTENDANCE TAB ----
function AllAttendanceTab() {
  const records = useAttendance()
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">All Attendance Logs</h1>
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Student', 'Class', 'Type', 'Time', 'Date'].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {records.map(a => (
                <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-800">{a.studentName}</td>
                  <td className="px-4 py-3 text-gray-500">{a.class}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${a.type === 'arrival' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                      {a.type === 'arrival' ? '✅ Arrival' : '🚶 Departure'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{formatTime(a.timestamp)}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(a.timestamp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <button onClick={() => {
        const csv = ['Student,Class,Type,Timestamp', ...records.map(a => `"${a.studentName}","${a.class}","${a.type}","${a.timestamp}"`)].join('\n')
        const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); link.download = 'attendance.csv'; link.click(); URL.revokeObjectURL(link.href)
      }} className="btn-secondary">
        <Download className="w-4 h-4" /> Export as CSV
      </button>
    </div>
  )
}

function LiveScansTab({ onRegister }) {
  const { scans, connection } = useRfidScans()
  return <div className="space-y-5">
    <div><h1 className="text-2xl font-bold text-gray-900">Live RFID Scans</h1><p className="mt-1 text-sm text-gray-500">New scans appear here in real time and are saved on the SchoolID server.</p><p className="mt-2 text-xs text-gray-400">Feed: {connection} · {API_URL}</p></div>
    {scans.length === 0 ? <div className="card py-10 text-center"><Radio className="mx-auto mb-3 h-8 w-8 text-gray-300"/><p className="font-medium text-gray-700">Waiting for a card scan</p><p className="mt-1 text-sm text-gray-500">Keep the RFID reader and SchoolID server connected to the same Wi‑Fi.</p></div> :
      <div className="space-y-3">{scans.map(scan => <article key={scan.id || `${scan.uid}-${scan.timestamp}`} className={`card flex flex-wrap items-center gap-3 border-l-4 ${scan.authorized ? 'border-l-green-500' : 'border-l-red-500'}`}>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${scan.authorized ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}><Radio className="h-5 w-5"/></div>
        <div className="min-w-0 flex-1"><p className="font-semibold text-gray-900">{scan.authorized ? scan.studentName : 'Unregistered card'}</p><p className="mt-0.5 text-xs text-gray-500">{scan.authorized ? `Class ${scan.class} · ` : ''}<span className="font-mono">UID {scan.uid}</span></p></div>
        <time className="text-xs text-gray-500">{new Date(scan.timestamp).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</time>
        { !scan.authorized && <button type="button" onClick={() => onRegister(scan)} className="btn-primary bg-purple-600 px-3 py-2 text-xs hover:bg-purple-700"><UserPlus className="h-4 w-4"/> Register student</button> }
      </article>)}</div>}
  </div>
}

// ---- REGISTER STUDENT TAB ----
function RegisterStudentTab() {
  const [form, setForm] = useState({ name: '', class: '', rfidUID: '', parentEmail: '', parentPhone: '' })
  const [done, setDone] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await addStudent(form)
      setDone(true)
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  if (done) {
    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-bold text-gray-900">Register Student</h1>
        <div className="card text-center py-12">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="font-bold text-xl text-gray-900">{form.name} Registered! 🎉</h3>
          <p className="text-gray-500 text-sm mt-2 mb-6">Student profile and RFID UID were saved. The card will be recognized on its next scan.</p>
          <button onClick={() => { setDone(false); setForm({ name: '', class: '', rfidUID: '', parentEmail: '', parentPhone: '' }) }} className="btn-primary mx-auto bg-purple-600 hover:bg-purple-700">
            Register Another Student
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">Register New Student</h1>
      <form onSubmit={handleSubmit} className="card space-y-4">
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <div>
          <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Student Full Name *</label>
          <input required type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
            placeholder="e.g., Rahul Krishnan"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
        </div>
        <div>
          <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Class *</label>
          <input required type="text" value={form.class} onChange={e => setForm({ ...form, class: e.target.value })}
            placeholder="e.g., 10-A"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
        </div>
        <div>
          <label className="text-sm font-semibold text-gray-700 mb-1.5 block">RFID Card UID *</label>
          <input required type="text" value={form.rfidUID} onChange={e => setForm({ ...form, rfidUID: e.target.value })}
            placeholder="e.g., A3F2B1C4 (scan from ESP32)"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-500" />
          <p className="text-xs text-gray-400 mt-1">Tap the card on the RFID reader to get the UID</p>
        </div>
        <div>
          <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Parent Email *</label>
          <input required type="email" value={form.parentEmail} onChange={e => setForm({ ...form, parentEmail: e.target.value })}
            placeholder="parent@example.com"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
        </div>
        <div>
          <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Parent Phone</label>
          <input type="tel" value={form.parentPhone} onChange={e => setForm({ ...form, parentPhone: e.target.value })}
            placeholder="+91 98xxxxxxxx"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
        </div>
        <button type="submit" disabled={saving} className="btn-primary w-full justify-center bg-purple-600 hover:bg-purple-700 disabled:opacity-60">
          {saving ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />} {saving ? 'Saving…' : 'Register Student'}
        </button>
      </form>
    </div>
  )
}

// ---- REPORTS TAB ----
function ReportsTab() {
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
      <div className="grid gap-4">
        {[
          { title: 'Monthly Attendance Report', desc: 'October 2026 — All students', icon: '📅', color: 'bg-blue-50 border-blue-200' },
          { title: 'Student Attendance Summary', desc: 'Individual student records', icon: '🎓', color: 'bg-green-50 border-green-200' },
          { title: 'Class-wise Attendance', desc: 'Breakdown by class section', icon: '🏫', color: 'bg-purple-50 border-purple-200' },
          { title: 'Late Arrivals Report', desc: 'Students arriving after 8:30 AM', icon: '⏰', color: 'bg-orange-50 border-orange-200' },
        ].map(r => (
          <div key={r.title} className={`card border ${r.color} flex items-center gap-4 cursor-pointer hover:shadow-md transition-shadow`}>
            <div className="text-3xl">{r.icon}</div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900">{r.title}</h3>
              <p className="text-sm text-gray-500">{r.desc}</p>
            </div>
            <div className="flex gap-2">
              <button className="btn-secondary py-1.5 px-3 text-xs">
                <Download className="w-3 h-3" /> CSV
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function QuickAddStudentModal({ card, onClose }) {
  const [form, setForm] = useState({ name: '', class: '', rfidUID: card?.uid || '', parentEmail: '', parentPhone: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async event => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try { await addStudent(form); onClose() }
    catch (saveError) { setError(saveError.message) }
    finally { setSaving(false) }
  }

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" onClick={onClose}>
    <form onSubmit={handleSubmit} onClick={event => event.stopPropagation()} className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
      <div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2 text-amber-700"><Radio className="h-5 w-5"/><p className="text-sm font-semibold">{card ? 'Unauthorized RFID card' : 'Quick add student'}</p></div><h2 className="mt-1 text-xl font-bold text-gray-900">Add student</h2><p className="mt-1 text-sm text-gray-500">Save the UID so the card is recognized on its next scan.</p></div><button type="button" onClick={onClose} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" aria-label="Close"><X className="h-5 w-5"/></button></div>
      {card && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3"><p className="text-xs font-medium text-amber-800">Scanned card UID</p><p className="mt-1 font-mono text-sm font-bold text-amber-950">{card.uid}</p></div>}
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <label className="block text-sm font-semibold text-gray-700">Student name *<input required autoFocus value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-3 font-normal" placeholder="Full name"/></label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><label className="block text-sm font-semibold text-gray-700">Class *<input required value={form.class} onChange={e => setForm({ ...form, class: e.target.value })} className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-3 font-normal" placeholder="e.g. 10-A"/></label><label className="block text-sm font-semibold text-gray-700">RFID UID *<input required value={form.rfidUID} onChange={e => setForm({ ...form, rfidUID: e.target.value.toUpperCase() })} className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-3 font-mono font-normal" placeholder="Scan UID"/></label></div>
      <label className="block text-sm font-semibold text-gray-700">Parent email<input type="email" value={form.parentEmail} onChange={e => setForm({ ...form, parentEmail: e.target.value })} className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-3 font-normal" placeholder="parent@example.com"/></label>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={onClose} className="btn-secondary justify-center">Cancel</button><button disabled={saving} type="submit" className="btn-primary justify-center bg-purple-600 hover:bg-purple-700 disabled:opacity-60">{saving ? <LoaderCircle className="h-4 w-4 animate-spin"/> : <UserPlus className="h-4 w-4"/>}{saving ? 'Saving…' : 'Save student'}</button></div>
    </form>
  </div>
}

export default function AdminDashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('home')
  const [unknownCard, setUnknownCard] = useState(null)

  const tabs = {
    home: <DashboardTab onViewScans={() => setActiveTab('live-scans')} />,
    students: <StudentsTab onQuickAdd={() => { setUnknownCard(null); setActiveTab('students'); setUnknownCard({ uid: '' }) }} />,
    fees: <FeesTab />,
    attendance: <AllAttendanceTab />,
    'live-scans': <LiveScansTab onRegister={scan => setUnknownCard(scan)} />,
    register: <RegisterStudentTab />,
    reports: <ReportsTab />,
    accounts: <AccountsTab />,
  }

  return (
    <>
      <Layout user={user} onLogout={onLogout} navItems={navItems} activeTab={activeTab} setActiveTab={setActiveTab} accentColor="purple">
        {tabs[activeTab]}
      </Layout>
      {unknownCard && <QuickAddStudentModal card={unknownCard.uid ? unknownCard : null} onClose={() => setUnknownCard(null)} />}
    </>
  )
}
