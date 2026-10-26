import { useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import { mockStudents } from './mockData'
import { API_URL } from './apiConfig'
import { getAuthToken, socketAuthOptions } from './authStore'

export { API_URL }
const localKey = 'school-students-v1'
const removedKey = 'school-students-removed-v1'
const apiPath = path => `${API_URL}${path}`
const localStudents = () => {
  try { return JSON.parse(localStorage.getItem(localKey) || '[]') } catch { return [] }
}
const removedStudentIds = () => {
  try { return new Set(JSON.parse(localStorage.getItem(removedKey) || '[]')) } catch { return new Set() }
}

function cacheStudents(students) {
  const added = students.filter(student => !mockStudents.some(seed => seed.id === student.id))
  localStorage.setItem(localKey, JSON.stringify(added))
  window.dispatchEvent(new Event('school-students-updated'))
}

export function useStudents() {
  const [students, setStudents] = useState(() => {
    const removed = removedStudentIds()
    return [...mockStudents, ...localStudents()].filter(student => !removed.has(student.id))
  })
  useEffect(() => {
    let alive = true
    const apply = records => {
      if (!alive || !Array.isArray(records)) return
      setStudents(records)
      cacheStudents(records)
    }
    const socket = io(API_URL || window.location.origin, { ...socketAuthOptions(), transports: ['websocket', 'polling'], reconnection: true })
    socket.on('student:sync', apply)
    socket.on('student:created', student => {
      setStudents(current => current.some(item => item.id === student.id) ? current : [...current, student])
    })
    const removeDeletedStudent = ({ id }) => {
      if (!id) return
      const removed = removedStudentIds()
      removed.add(id)
      localStorage.setItem(removedKey, JSON.stringify([...removed]))
      setStudents(current => {
        const next = current.filter(item => item.id !== id)
        cacheStudents(next)
        return next
      })
    }
    socket.on('student:deleted', removeDeletedStudent)
    const onLocalStudentDeleted = event => removeDeletedStudent(event.detail || {})
    window.addEventListener('school-student-deleted', onLocalStudentDeleted)
    fetch(apiPath('/api/students'), { headers: { Authorization: `Bearer ${getAuthToken()}` } }).then(response => response.ok ? response.json() : Promise.reject())
      .then(apply).catch(() => {})
    const refresh = () => {
      const removed = removedStudentIds()
      setStudents([...mockStudents, ...localStudents()].filter(student => !removed.has(student.id)))
    }
    window.addEventListener('school-students-updated', refresh)
    window.addEventListener('storage', refresh)
    return () => {
      alive = false
      socket.disconnect()
      window.removeEventListener('school-student-deleted', onLocalStudentDeleted)
      window.removeEventListener('school-students-updated', refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])
  return students
}

export async function addStudent(student) {
  let response
  try {
    response = await fetch(apiPath('/api/students'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(student),
    })
  } catch {
    throw new Error('Cannot reach the live server. Keep the SchoolID server running on the same Wi-Fi.')
  }
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Could not register the student.')
  const cached = localStudents()
  if (!cached.some(item => item.id === data.id)) cacheStudents([...mockStudents, ...cached, data])
  return data
}

export async function removeStudent(studentId) {
  let response
  try {
    response = await fetch(apiPath(`/api/students/${encodeURIComponent(studentId)}`), {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${getAuthToken()}` },
    })
  } catch {
    throw new Error('Cannot reach the server. Check your connection and try again.')
  }
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Could not remove the student.')
  window.dispatchEvent(new CustomEvent('school-student-deleted', { detail: { id: studentId } }))
  return data
}

export function useUnauthorizedCards(onCard) {
  useEffect(() => {
    const socket = io(API_URL || window.location.origin, { ...socketAuthOptions(), transports: ['websocket', 'polling'], reconnection: true })
    socket.on('rfid:unauthorized', onCard)
    return () => socket.disconnect()
  }, [onCard])
}
