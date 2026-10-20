import { useState } from 'react'
import Layout from '../components/Layout'
import { formatTime, formatDate, subjectColors } from '../data/mockData'
import { addHomework, uploadHomeworkAttachment, useHomework } from '../data/homeworkStore'
import { useStudents } from '../data/studentStore'
import { useAttendance } from '../data/attendanceStore'
import HomeworkDetailsModal from '../components/HomeworkDetailsModal'
import { Upload, FileText, Image, Plus, X, Check, Users, BookOpen } from 'lucide-react'

const navItems = [
  { id: 'home', label: 'Overview', icon: '📊', badge: 0 },
  { id: 'homework', label: 'Homework', icon: '📚', badge: 0 },
  { id: 'upload', label: 'Upload Homework', icon: '➕', badge: 0 },
  { id: 'attendance', label: 'Class Attendance', icon: '📋', badge: 0 },
  { id: 'profile', label: 'My Profile', icon: '👤', badge: 0 },
]

// ---- OVERVIEW TAB ----
function OverviewTab({ user }) {
  const homework = useHomework()
  const students = useStudents()
  const attendance = useAttendance()
  const classStudents = students.filter(s => s.class === user.class)
  const todayClassAtt = attendance.filter(a => a.class === user.class && a.timestamp.startsWith(new Date().toISOString().slice(0, 10)) && a.type === 'arrival')
  const myHW = homework.filter(h => h.teacherName === user.name)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Good Evening, {user.name.split(' ')[1]}! 👋</h1>
        <p className="text-gray-500 text-sm">{user.subject} · Class {user.class}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card text-center py-4">
          <p className="text-3xl font-bold text-emerald-600">{classStudents.length}</p>
          <p className="text-xs text-gray-500 mt-1">Students</p>
        </div>
        <div className="card text-center py-4">
          <p className="text-3xl font-bold text-blue-600">{todayClassAtt.length}</p>
          <p className="text-xs text-gray-500 mt-1">Present Today</p>
        </div>
        <div className="card text-center py-4">
          <p className="text-3xl font-bold text-purple-600">{myHW.length}</p>
          <p className="text-xs text-gray-500 mt-1">Homework Set</p>
        </div>
      </div>

      {/* Today's class attendance */}
      <div className="card">
        <h3 className="font-semibold text-gray-800 mb-3">Today's Attendance — Class {user.class}</h3>
        <div className="space-y-2">
          {classStudents.map(s => {
            const present = todayClassAtt.some(a => a.studentId === s.id)
            return (
              <div key={s.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50">
                <div className={`w-8 h-8 rounded-full ${s.avatarBg} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                  {s.avatar}
                </div>
                <span className="flex-1 text-sm font-medium text-gray-800">{s.name}</span>
                <span className={`badge ${present ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                  {present ? '✅ Present' : '❌ Absent'}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ---- HOMEWORK LIST TAB ----
function HomeworkTab({ user }) {
  const homework = useHomework()
  const [selectedHomework, setSelectedHomework] = useState(null)
  const myHW = homework.filter(h => h.teacherName === user.name)

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">My Homework Assignments</h1>
      {myHW.length === 0 ? (
        <div className="card text-center py-10 text-gray-400">
          <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p>No homework uploaded yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {myHW.map(h => (
            <div key={h.id} className="card">
              <button type="button" className="w-full text-left" onClick={() => setSelectedHomework(h)}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`badge ${subjectColors[h.subject] || subjectColors.default}`}>{h.subject}</span>
                <span className="badge bg-gray-100 text-gray-600">Class {h.class}</span>
                {h.attachment && <span className="badge bg-blue-50 text-blue-700">📎 {h.attachment.name}</span>}
              </div>
              <h3 className="font-bold text-gray-900">{h.title}</h3>
              <p className="text-sm text-gray-500 mt-1 mb-3">{h.description}</p>
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>Due: {h.dueDate}</span>
                <span>Uploaded: {formatDate(h.uploadedAt)}</span>
              </div>
              <span className="mt-3 inline-block text-xs font-semibold text-emerald-700">Open details →</span>
              </button>
            </div>
          ))}
        </div>
      )}
      {selectedHomework && <HomeworkDetailsModal homework={selectedHomework} onClose={() => setSelectedHomework(null)} />}
    </div>
  )
}

// ---- UPLOAD TAB ----
function UploadTab({ user }) {
  const students = useStudents()
  const classes = user.class ? [user.class] : []
  const [form, setForm] = useState({ title: '', subject: '', description: '', dueDate: '', class: user.class, type: 'text' })
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [attachmentFile, setAttachmentFile] = useState(null)

  const subjects = ['Mathematics', 'English', 'Physics', 'Chemistry', 'Biology', 'History', 'Geography', 'Computer Science']

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setSubmitError('')
    try {
      const attachment = attachmentFile ? await uploadHomeworkAttachment(attachmentFile) : null
      await addHomework({ id: `HW-${Date.now()}`, ...form, teacherName: user.name, uploadedAt: new Date().toISOString(), type: attachment?.type === 'application/pdf' ? 'pdf' : attachment ? 'image' : 'text', attachment, fileURL: attachment?.url || null })
      setSubmitted(true)
    } catch (error) {
      setSubmitError(error.message)
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-bold text-gray-900">Upload Homework</h1>
        <div className="card text-center py-12">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="font-bold text-gray-900 text-lg mb-2">Homework Uploaded! ✅</h3>
          <p className="text-gray-500 text-sm mb-5">Homework is now visible in the Teacher and Parent dashboards for Class {form.class}.</p>
          <button onClick={() => { setSubmitted(false); setAttachmentFile(null); setForm({ ...form, title: '', description: '', dueDate: '' }) }} className="btn-primary mx-auto">
            Upload Another
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">Upload Homework</h1>
      <form onSubmit={handleSubmit} className="card space-y-4">
        {submitError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{submitError}</p>}
        <div>
          <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Subject *</label>
          <select
            required value={form.subject}
            onChange={e => setForm({ ...form, subject: e.target.value })}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">Select subject...</option>
            {subjects.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div>
          <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Homework Title *</label>
          <input
            required type="text" value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })}
            placeholder="e.g., Chapter 5 - Quadratic Equations"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div>
          <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Class *</label>
          <select
            required value={form.class}
            onChange={e => setForm({ ...form, class: e.target.value })}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >{classes.map(className => <option key={className} value={className}>Class {className}</option>)}</select>
        </div>

        <div>
          <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Description / Instructions</label>
          <textarea
            rows={4} value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            placeholder="Describe the homework, page numbers, steps to follow..."
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
          />
        </div>

        <div>
          <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Due Date *</label>
          <input
            required type="date" value={form.dueDate}
            onChange={e => setForm({ ...form, dueDate: e.target.value })}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* File upload */}
        <div>
          <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Attach File (Optional)</label>
          <label className="block border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:border-emerald-400 transition-colors cursor-pointer">
            <Upload className="w-8 h-8 mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-500">{attachmentFile ? attachmentFile.name : 'Choose a PDF or image'}</p>
            <p className="text-xs text-gray-400 mt-1">PDF, JPG, PNG, GIF or WebP · Max 10MB</p>
            <input type="file" accept="application/pdf,image/jpeg,image/png,image/gif,image/webp" className="sr-only" onChange={event => {
              const file = event.target.files?.[0]
              if (!file) return
              if (file.size > 10 * 1024 * 1024) { setSubmitError('Attachment must be smaller than 10 MB.'); setAttachmentFile(null); return }
              setSubmitError('')
              setAttachmentFile(file)
            }} />
          </label>
        </div>

        <button
          type="submit"
          disabled={loading}
          className={`btn-primary w-full justify-center ${loading ? 'opacity-70 cursor-not-allowed' : ''} bg-emerald-600 hover:bg-emerald-700`}
        >
          {loading ? '⏳ Uploading...' : '📤 Upload Homework'}
        </button>
      </form>
    </div>
  )
}

// ---- ATTENDANCE TAB ----
function AttendanceTab({ user }) {
  const students = useStudents()
  const attendance = useAttendance()
  const classStudents = students.filter(s => s.class === user.class)
  const todayKey = new Date().toISOString().slice(0, 10)

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">Class Attendance</h1>
      <div className="card">
        <h3 className="font-semibold text-gray-700 mb-3">{new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })} · Class {user.class}</h3>
        {classStudents.map(s => {
          const records = attendance.filter(a => a.studentId === s.id && a.timestamp.startsWith(todayKey))
          const arrival = records.find(r => r.type === 'arrival')
          const departure = records.find(r => r.type === 'departure')
          return (
            <div key={s.id} className="flex items-center gap-3 py-3 border-b border-gray-100 last:border-0">
              <div className={`w-9 h-9 rounded-full ${s.avatarBg} flex items-center justify-center text-white text-xs font-bold`}>
                {s.avatar}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-800">{s.name}</p>
                <p className="text-xs text-gray-500">
                  {arrival ? `In: ${formatTime(arrival.timestamp)}` : 'Not arrived'}
                  {departure ? ` · Out: ${formatTime(departure.timestamp)}` : ''}
                </p>
              </div>
              <span className={`badge ${arrival ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                {arrival ? '✅' : '❌'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---- PROFILE TAB ----
function ProfileTab({ user }) {
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
      <div className="card text-center">
        <div className="w-20 h-20 rounded-3xl bg-emerald-500 flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4">👩‍🏫</div>
        <h2 className="text-xl font-bold">{user.name}</h2>
        <p className="text-gray-500 text-sm">{user.subject} Teacher</p>
        <p className="text-gray-400 text-xs mt-1">Class Teacher: {user.class}</p>
      </div>
      <div className="card space-y-3">
        <div className="flex justify-between text-sm"><span className="text-gray-500">Email</span><span className="font-medium">{user.email}</span></div>
        <div className="flex justify-between text-sm"><span className="text-gray-500">Subject</span><span className="font-medium">{user.subject}</span></div>
        <div className="flex justify-between text-sm"><span className="text-gray-500">Class Assigned</span><span className="font-medium">{user.class}</span></div>
      </div>
    </div>
  )
}

export default function TeacherDashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('home')

  const tabs = {
    home: <OverviewTab user={user} />,
    homework: <HomeworkTab user={user} />,
    upload: <UploadTab user={user} />,
    attendance: <AttendanceTab user={user} />,
    profile: <ProfileTab user={user} />,
  }

  return (
    <Layout user={user} onLogout={onLogout} navItems={navItems} activeTab={activeTab} setActiveTab={setActiveTab} accentColor="emerald">
      {tabs[activeTab]}
    </Layout>
  )
}

