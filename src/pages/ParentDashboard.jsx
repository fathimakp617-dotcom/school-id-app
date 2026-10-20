import { useState } from 'react'
import Layout from '../components/Layout'
import HomeworkDetailsModal from '../components/HomeworkDetailsModal'
import { mockAttendance, mockNotifications, formatTime, formatDate, subjectColors } from '../data/mockData'
import { useHomework } from '../data/homeworkStore'
import { useHomeworkCompletion } from '../data/homeworkCompletionStore'
import { useStudents } from '../data/studentStore'
import { useAttendance } from '../data/attendanceStore'
import { DEFAULT_FEE_AMOUNT, requestFeePayment, useFees, useSchoolSettings } from '../data/feeStore'
import { Bell, CheckCircle, Clock, BookOpen, Calendar, TrendingUp, ChevronRight, CreditCard, Wallet, ShieldCheck, CircleCheck, Circle, LoaderCircle } from 'lucide-react'

const navItems = [
  { id: 'home', label: 'Home', icon: '🏠', badge: 0 },
  { id: 'notifications', label: 'Notifications', icon: '🔔', badge: 3 },
  { id: 'attendance', label: 'Attendance History', icon: '📋', badge: 0 },
  { id: 'homework', label: 'Homework', icon: '📚', badge: 2 },
  { id: 'fees', label: 'Fees & Payments', icon: '💳', badge: 1 },
  { id: 'idcard', label: 'Student ID Card', icon: '🪪', badge: 0 },
  { id: 'profile', label: 'Profile', icon: '👤', badge: 0 },
]

function StatusBadge({ type }) {
  const config = {
    arrival: { label: '✅ Arrived', cls: 'bg-green-100 text-green-700' },
    departure: { label: '🚶 Left School', cls: 'bg-orange-100 text-orange-700' },
    absent: { label: '❌ Absent', cls: 'bg-red-100 text-red-700' },
  }
  const c = config[type] || config.absent
  return <span className={`badge ${c.cls}`}>{c.label}</span>
}

// ---- HOME TAB ----
function HomeTab({ user }) {
  const students = useStudents()
  const homework = useHomework()
  const { completedIds } = useHomeworkCompletion(user.studentId)
  const attendance = useAttendance()
  const student = students.find(s => s.id === user.studentId)
  const latestHomework = homework.filter(h => h.class === student?.class && !completedIds.includes(h.id))
    .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()).slice(0, 2)
  const [selectedHomework, setSelectedHomework] = useState(null)
  const todayKey = new Date().toISOString().slice(0, 10)
  const todayAtt = attendance.filter(a => a.studentId === user.studentId && a.timestamp.startsWith(todayKey))
  const arrival = todayAtt.find(a => a.type === 'arrival')
  const departure = todayAtt.find(a => a.type === 'departure')
  const presentDays = new Set(attendance.filter(record => record.studentId === user.studentId && record.type === 'arrival').map(record => record.timestamp.slice(0, 10))).size
  const recentAlerts = [
    ...attendance.filter(record => record.studentId === user.studentId).map(record => ({ id: record.id, message: `${record.studentName} ${record.type === 'arrival' ? 'arrived at school' : 'left school'}`, timestamp: record.timestamp, type: record.type })),
    ...latestHomework.map(record => ({ id: record.id, message: `New homework: ${record.title}`, timestamp: record.uploadedAt, type: 'homework' })),
  ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 3)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Good Evening, {user.name.split(' ')[0]}! 👋</h1>
        <p className="text-gray-500 text-sm mt-1">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>

      {/* Today's Status */}
      <div className="card bg-gradient-to-r from-blue-600 to-blue-700 text-white border-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-blue-100 text-sm">Today's Status</p>
            <h2 className="text-xl font-bold">{student?.name}</h2>
            <p className="text-blue-200 text-sm">Class {student?.class}</p>
          </div>
          <div className={`w-14 h-14 rounded-2xl ${student?.avatarBg} flex items-center justify-center text-white font-bold text-lg`}>
            {student?.avatar}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/20 rounded-xl p-3">
            <p className="text-blue-100 text-xs mb-1">🏫 Arrival</p>
            <p className="font-bold text-lg">{arrival ? formatTime(arrival.timestamp) : '—'}</p>
          </div>
          <div className="bg-white/20 rounded-xl p-3">
            <p className="text-blue-100 text-xs mb-1">🚪 Departure</p>
            <p className="font-bold text-lg">{departure ? formatTime(departure.timestamp) : '—'}</p>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center text-green-600">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{presentDays}</p>
              <p className="text-xs text-gray-500">Days present (RFID)</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{todayAtt.length}</p>
              <p className="text-xs text-gray-500">Today's scans</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent notifications */}
      <div className="card">
        <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <Bell className="w-4 h-4 text-blue-600" /> Recent Alerts
        </h3>
        <div className="space-y-2">
          {recentAlerts.map(n => (
            <div key={n.id} className="flex items-start gap-3 rounded-xl bg-gray-50 p-3">
              <span className="text-lg">{n.type === 'arrival' ? '✅' : n.type === 'departure' ? '🚶' : '📚'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800 font-medium">{n.message}</p>
                <p className="text-xs text-gray-500 mt-0.5">{new Date(n.timestamp).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pending homework */}
      <div className="card">
        <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-blue-600" /> Pending Homework
        </h3>
        <div className="space-y-2">
          {latestHomework.map(h => (
            <button type="button" key={h.id} onClick={() => setSelectedHomework(h)} className="flex w-full items-center gap-3 rounded-xl bg-gray-50 p-3 text-left hover:bg-blue-50">
              <span className={`badge ${subjectColors[h.subject] || subjectColors.default}`}>{h.subject}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{h.title}</p>
                <p className="text-xs text-gray-500">Due: {h.dueDate}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
      {selectedHomework && <HomeworkDetailsModal homework={selectedHomework} onClose={() => setSelectedHomework(null)} />}
    </div>
  )
}

// ---- NOTIFICATIONS TAB ----
function NotificationsTab({ user }) {
  const attendance = useAttendance().filter(record => record.studentId === user.studentId)
  const student = useStudents().find(record => record.id === user.studentId)
  const homework = useHomework().filter(record => record.class === student?.class)
  const notifications = [
    ...attendance.map(record => ({ id: record.id, message: `${record.studentName} ${record.type === 'arrival' ? 'arrived at school' : 'left school'}`, timestamp: record.timestamp, type: record.type })),
    ...homework.map(record => ({ id: record.id, message: `New homework: ${record.title}`, timestamp: record.uploadedAt, type: 'homework' })),
  ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
      <div className="space-y-3">
        {notifications.map(n => (
          <div key={n.id} className="card flex items-start gap-4">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0 ${n.type === 'arrival' ? 'bg-green-100' : n.type === 'departure' ? 'bg-orange-100' : 'bg-blue-100'}`}>
              {n.type === 'arrival' ? '✅' : n.type === 'departure' ? '🚶' : '📚'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">{n.message}</p>
              <p className="text-xs text-gray-500 mt-1">{new Date(n.timestamp).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---- ATTENDANCE TAB ----
function AttendanceTab({ user }) {
  const attendance = useAttendance()
  const records = attendance.filter(a => a.studentId === user.studentId)

  const grouped = records.reduce((acc, r) => {
    const date = formatDate(r.timestamp)
    if (!acc[date]) acc[date] = []
    acc[date].push(r)
    return acc
  }, {})

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">Attendance History</h1>
      <div className="space-y-4">
        {Object.entries(grouped).map(([date, records]) => (
          <div key={date}>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{date}</p>
            <div className="card space-y-3">
              {records.map(r => (
                <div key={r.id} className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${r.type === 'arrival' ? 'bg-green-100' : 'bg-orange-100'}`}>
                    {r.type === 'arrival' ? '🏫' : '🏠'}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-800">{r.type === 'arrival' ? 'Arrived at School' : 'Left School'}</p>
                    <p className="text-xs text-gray-500">{formatTime(r.timestamp)}</p>
                  </div>
                  <StatusBadge type={r.type} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---- HOMEWORK TAB ----
function HomeworkTab({ user }) {
  const students = useStudents()
  const homework = useHomework()
  const student = students.find(s => s.id === user.studentId)
  const { completedIds, setCompleted } = useHomeworkCompletion(user.studentId)
  const [savingId, setSavingId] = useState(null)
  const [saveError, setSaveError] = useState('')
  const [selectedHomework, setSelectedHomework] = useState(null)
  const hw = homework.filter(h => h.class === student?.class)
    .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())

  const toggleComplete = async assignment => {
    setSavingId(assignment.id)
    setSaveError('')
    try { await setCompleted(assignment.id, !completedIds.includes(assignment.id)) }
    catch (error) { setSaveError(error.message) }
    finally { setSavingId(null) }
  }

  return (
    <>
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">Homework</h1>
      <p className="text-sm text-gray-500">Newest assignments first. Mark each one complete when finished.</p>
      {saveError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{saveError}</p>}
      {hw.length === 0 && <div className="card text-center text-sm text-gray-500">No homework has been posted for Class {student?.class} yet.</div>}
      <div className="space-y-4">
        {hw.map(h => (
          <article key={h.id} className={`card ${completedIds.includes(h.id) ? 'border-green-200 bg-green-50/50' : ''}`}>
            <button type="button" className="w-full text-left" onClick={() => setSelectedHomework(h)}>
            <div className="flex items-start gap-3 mb-3">
              <span className={`badge ${subjectColors[h.subject] || subjectColors.default}`}>{h.subject}</span>
              {h.type === 'pdf' && <span className="badge bg-red-100 text-red-600">📎 PDF</span>}
            </div>
            <h3 className="font-bold text-gray-900 mb-1">{h.title}</h3>
            <p className="text-sm text-gray-600 mb-3">{h.description}</p>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Due: {h.dueDate}</span>
              <span className="flex items-center gap-1">👩‍🏫 {h.teacherName}</span>
            </div>
            {h.attachment && <p className="mt-3 flex items-center gap-2 text-xs font-medium text-blue-700">📎 {h.attachment.name} · tap to preview</p>}
            <span className="mt-3 inline-block text-xs font-semibold text-blue-700">Open details →</span>
            </button>
            <button type="button" onClick={() => toggleComplete(h)} disabled={savingId === h.id}
              className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-60 ${completedIds.includes(h.id) ? 'bg-green-100 text-green-800 hover:bg-green-200' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}>
              {savingId === h.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : completedIds.includes(h.id) ? <CircleCheck className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
              {savingId === h.id ? 'Saving…' : completedIds.includes(h.id) ? 'Completed · tap to undo' : 'Mark as complete'}
            </button>
          </article>
        ))}
      </div>
    </div>
    {selectedHomework && <HomeworkDetailsModal homework={selectedHomework} onClose={() => setSelectedHomework(null)} />}
    </>
  )
}

// ---- PROFILE TAB ----
function ProfileTab({ user }) {
  const students = useStudents()
  const student = students.find(s => s.id === user.studentId)
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
      <div className="card text-center">
        <div className={`w-20 h-20 rounded-3xl ${student?.avatarBg} flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4`}>
          {student?.avatar}
        </div>
        <h2 className="text-xl font-bold">{student?.name}</h2>
        <p className="text-gray-500 text-sm">Class {student?.class}</p>
        <p className="text-gray-400 text-xs mt-1">ID: {student?.id}</p>
      </div>
      <div className="card space-y-3">
        <h3 className="font-semibold text-gray-700">Parent Details</h3>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Name</span>
          <span className="font-medium">{user.name}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Email</span>
          <span className="font-medium">{user.email}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">RFID Card UID</span>
          <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">{student?.rfidUID}</span>
        </div>
      </div>
    </div>
  )
}

function StudentIdCard({ user }) {
  const students = useStudents()
  const settings = useSchoolSettings()
  const student = students.find(s => s.id === user.studentId)
  if (!student) return <div className="card">Student record not found.</div>
  return <div className="space-y-5">
    <div><h1 className="text-2xl font-bold text-gray-900">Student ID Card</h1><p className="text-sm text-gray-500 mt-1">Digital school identity card</p></div>
    <div className="max-w-md overflow-hidden rounded-3xl bg-gradient-to-br from-blue-900 via-blue-700 to-cyan-600 p-6 text-white shadow-xl">
      <div className="flex items-center justify-between border-b border-white/20 pb-4"><div><p className="text-xs uppercase tracking-[.2em] text-blue-100">SchoolID</p><p className="font-bold">{settings.schoolName || 'SchoolID'}</p></div><span className="text-3xl">🏫</span></div>
      <div className="flex items-center gap-4 py-5"><div className={`h-20 w-20 rounded-2xl ${student.avatarBg} flex items-center justify-center text-2xl font-bold`}>{student.avatar}</div><div><p className="text-xs text-blue-100">STUDENT</p><h2 className="text-xl font-bold">{student.name}</h2><p className="text-sm text-blue-100">Class {student.class}</p></div></div>
      <div className="grid grid-cols-2 gap-3 border-t border-white/20 pt-4 text-sm"><div><p className="text-xs text-blue-100">Student ID</p><p className="font-mono font-semibold">{student.id}</p></div><div><p className="text-xs text-blue-100">RFID UID</p><p className="font-mono font-semibold">{student.rfidUID}</p></div></div>
    </div>
    <p className="text-xs text-gray-500">Show this digital card at the school gate. RFID UID is linked to the attendance record.</p>
  </div>
}

function FeesTab({ user }) {
  const students = useStudents()
  const fees = useFees(user.studentId)
  const settings = useSchoolSettings()
  const fee = fees[user.studentId] || { status: 'due', amount: settings.feeAmount || DEFAULT_FEE_AMOUNT }
  const [paymentReference, setPaymentReference] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const amount = Number(fee.amount || settings.feeAmount || DEFAULT_FEE_AMOUNT)
  const payUrl = settings.upiId ? `upi://pay?pa=${encodeURIComponent(settings.upiId)}&pn=${encodeURIComponent(settings.schoolName || 'SchoolID')}&am=${amount}&cu=INR&tn=${encodeURIComponent(`School fees ${user.studentId}`)}` : ''
  const reportPayment = async event => {
    event.preventDefault(); setSaving(true); setError('')
    try { await requestFeePayment(user.studentId, paymentReference) }
    catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }
  return <div className="space-y-5"><div><h1 className="text-2xl font-bold text-gray-900">Fees & Payments</h1><p className="text-sm text-gray-500 mt-1">Manage fees for {students.find(s => s.id === user.studentId)?.name}</p></div>
    <div className="card border-0 bg-gradient-to-br from-indigo-600 to-blue-700 text-white"><div className="flex items-start justify-between"><div><p className="text-sm text-blue-100">School fee balance</p><p className="mt-2 text-3xl font-bold">₹{amount.toLocaleString('en-IN')}</p><p className="text-sm text-blue-100 mt-1">Tuition and activity fee</p></div><Wallet className="h-8 w-8 text-blue-100" /></div><div className="mt-5 flex items-center justify-between rounded-xl bg-white/15 p-3 text-sm"><span>Status</span><span className="badge bg-white/20 text-white">{fee.status==='paid'?'Paid':fee.status==='pending'?'Awaiting school confirmation':'Due'}</span></div></div>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {fee.status==='paid' ? <div className="card border-green-200 bg-green-50"><div className="flex items-center gap-3 text-green-800"><CheckCircle className="h-6 w-6"/><div><p className="font-semibold">Payment confirmed by school</p><p className="text-sm">₹{amount.toLocaleString('en-IN')} · {fee.confirmedAt ? new Date(fee.confirmedAt).toLocaleString('en-IN') : 'Confirmed'}</p></div></div></div> : fee.status==='pending' ? <div className="card border-blue-200 bg-blue-50"><p className="font-semibold text-blue-900">Payment report submitted</p><p className="mt-1 text-sm text-blue-800">The school will confirm the payment after checking its bank/UPI account.</p></div> : <form onSubmit={reportPayment} className="card"><h2 className="font-semibold text-gray-900">Pay by UPI</h2>{payUrl ? <><p className="text-sm text-gray-500 mt-1">Open your UPI app and pay ₹{amount.toLocaleString('en-IN')}.</p><a href={payUrl} className="btn-primary mt-4 w-full justify-center"><CreditCard className="h-4 w-4"/>Open UPI app</a><label className="mt-4 block text-sm font-medium text-gray-700">UPI transaction reference (optional)<input value={paymentReference} onChange={e=>setPaymentReference(e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2" placeholder="UPI reference number"/></label><button type="submit" disabled={saving} className="btn-secondary mt-3 w-full justify-center">{saving?'Submitting…':'I have paid · submit for confirmation'}</button><p className="mt-3 text-xs text-gray-500">Payment is marked complete only after the school confirms it.</p></> : <p className="mt-2 text-sm text-amber-800">UPI payment is not configured yet. Ask the school administrator to set the school UPI ID before enabling online payment.</p>}</form>}
  </div>
}

export default function ParentDashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('home')

  const tabComponents = {
    home: <HomeTab user={user} />,
    notifications: <NotificationsTab user={user} />,
    attendance: <AttendanceTab user={user} />,
    homework: <HomeworkTab user={user} />,
    profile: <ProfileTab user={user} />,
    idcard: <StudentIdCard user={user} />,
    fees: <FeesTab user={user} />,
  }

  return (
    <Layout user={user} onLogout={onLogout} navItems={navItems} activeTab={activeTab} setActiveTab={setActiveTab} accentColor="blue">
      {tabComponents[activeTab]}
    </Layout>
  )
}

