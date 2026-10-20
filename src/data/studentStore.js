import { useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import { mockStudents } from './mockData'
import { API_URL } from './apiConfig'
import { socketAuthOptions } from './authStore'

export { API_URL }
const localKey = 'school-students-v1'
const apiPath = path => `${API_URL}${path}`
const localStudents = () => {
  try { return JSON.parse(localStorage.getItem(localKey) || '[]') } catch { return [] }
}

function cacheStudents(students) {
  const added = students.filter(student => !mockStudents.some(seed => seed.id === student.id))
  localStorage.setItem(localKey, JSON.stringify(added))
  window.dispatchEvent(new Event('school-students-updated'))
}

export function useStudents() {
  const [students, setStudents] = useState(() => [...mockStudents, ...localStudents()])
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
    fetch(apiPath('/api/students')).then(response => response.ok ? response.json() : Promise.reject())
      .then(apply).catch(() => {})
    const refresh = () => setStudents([...mockStudents, ...localStudents()])
    window.addEventListener('school-students-updated', refresh)
    window.addEventListener('storage', refresh)
    return () => {
      alive = false
      socket.disconnect()
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

export function useUnauthorizedCards(onCard) {
  useEffect(() => {
    const socket = io(API_URL || window.location.origin, { ...socketAuthOptions(), transports: ['websocket', 'polling'], reconnection: true })
    socket.on('rfid:unauthorized', onCard)
    return () => socket.disconnect()
  }, [onCard])
}
