import { useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import { API_URL } from './studentStore'
import { socketAuthOptions } from './authStore'

const apiPath = path => `${API_URL}${path}`
const cacheKey = studentId => `school-homework-completed-${studentId}`

function readCache(studentId) {
  try { return JSON.parse(localStorage.getItem(cacheKey(studentId)) || '[]') } catch { return [] }
}

export function useHomeworkCompletion(studentId) {
  const [completedIds, setCompletedIds] = useState(() => readCache(studentId))
  useEffect(() => {
    let alive = true
    const apply = ids => {
      if (!alive || !Array.isArray(ids)) return
      setCompletedIds(ids)
      localStorage.setItem(cacheKey(studentId), JSON.stringify(ids))
    }
    const socket = io(API_URL || window.location.origin, { ...socketAuthOptions(), transports: ['websocket', 'polling'], reconnection: true })
    socket.on('connect', () => socket.emit('homework:completion-subscribe', studentId))
    socket.on('homework:completion-sync', payload => {
      if (payload.studentId === studentId) apply(payload.completedIds)
    })
    socket.on('homework:completion-updated', payload => {
      if (payload.studentId === studentId) apply(payload.completedIds)
    })
    fetch(apiPath(`/api/homework/completions?studentId=${encodeURIComponent(studentId)}`))
      .then(response => response.ok ? response.json() : Promise.reject())
      .then(data => apply(data.completedIds)).catch(() => {})
    return () => { alive = false; socket.disconnect() }
  }, [studentId])

  const setCompleted = async (homeworkId, completed) => {
    const previous = completedIds
    const next = completed
      ? [...new Set([...previous, homeworkId])]
      : previous.filter(id => id !== homeworkId)
    setCompletedIds(next)
    localStorage.setItem(cacheKey(studentId), JSON.stringify(next))
    try {
      const response = await fetch(apiPath('/api/homework/completions'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, homeworkId, completed }),
      })
      if (!response.ok) throw new Error('Could not save completion')
    } catch {
      setCompletedIds(previous)
      localStorage.setItem(cacheKey(studentId), JSON.stringify(previous))
      throw new Error('Could not save this update. Check that the SchoolID server is running.')
    }
  }

  return { completedIds, setCompleted }
}
