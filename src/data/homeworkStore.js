import { useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import { mockHomework } from './mockData'
import { API_URL } from './studentStore'
import { socketAuthOptions } from './authStore'

const apiPath = path => `${API_URL}${path}`
const LOCAL_KEY = 'school-homework-v1'
const EVENT_NAME = 'school-homework-updated'
export const resolveHomeworkAsset = url => {
  if (/^https?:\/\//i.test(url)) return url
  if (url.startsWith('/api/')) return `${API_URL}${url}`
  return `${window.location.origin}${url}`
}

function readLocal() {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]') } catch { return [] }
}

function setHomeworkCache(records) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(records))
  window.dispatchEvent(new Event(EVENT_NAME))
}

export function useHomework() {
  const [homework, setHomework] = useState(() => [...mockHomework, ...readLocal()])
  useEffect(() => {
    let alive = true
    const apply = records => {
      if (!alive || !Array.isArray(records)) return
      setHomework(records)
      setHomeworkCache(records.filter(item => !mockHomework.some(seed => seed.id === item.id)))
    }
    const socket = io(API_URL || window.location.origin, { ...socketAuthOptions(), transports: ['websocket', 'polling'], reconnection: true })
    socket.on('homework:sync', apply)
    socket.on('homework:created', record => {
      setHomework(current => current.some(item => item.id === record.id) ? current : [...current, record])
    })
    fetch(apiPath('/api/homework')).then(response => {
      if (!response.ok) throw new Error('Homework service unavailable')
      return response.json()
    }).then(apply).catch(() => {})
    const refreshLocal = () => setHomework([...mockHomework, ...readLocal()])
    window.addEventListener(EVENT_NAME, refreshLocal)
    window.addEventListener('storage', refreshLocal)
    return () => {
      alive = false
      socket.disconnect()
      window.removeEventListener(EVENT_NAME, refreshLocal)
      window.removeEventListener('storage', refreshLocal)
    }
  }, [])
  return homework
}

export async function addHomework(homework) {
  let response
  try {
    response = await fetch(apiPath('/api/homework'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(homework),
    })
  } catch {
    throw new Error('Cannot reach the live server. Keep the SchoolID server running and connect to the same Wi-Fi.')
  }
  if (!response.ok) throw new Error('Could not save homework. Check that the SchoolID server is running.')
  const saved = await response.json()
  const current = readLocal()
  if (!current.some(item => item.id === saved.id)) setHomeworkCache([...current, saved])
  return saved
}

export async function uploadHomeworkAttachment(file) {
  const data = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Could not read the selected file.'))
    reader.readAsDataURL(file)
  })
  let response
  try {
    response = await fetch(apiPath('/api/attachments'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: file.name, type: file.type, data }),
    })
  } catch {
    throw new Error('Could not upload the attachment. Check that the SchoolID server is running.')
  }
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Could not upload the attachment.')
  return result
}
