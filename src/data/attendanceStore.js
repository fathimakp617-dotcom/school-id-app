import { useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import { API_URL } from './studentStore'
import { socketAuthOptions } from './authStore'

export function useAttendance() {
  const [records, setRecords] = useState([])
  useEffect(() => {
    let alive = true
    const apply = rows => { if (alive && Array.isArray(rows)) setRecords(rows) }
    const refresh = () => fetch(`${API_URL}/api/attendance`, { cache: 'no-store' }).then(response => response.ok ? response.json() : []).then(apply).catch(() => {})
    const socket = io(API_URL || window.location.origin, { ...socketAuthOptions(), transports: ['websocket', 'polling'], reconnection: true })
    socket.on('attendance:sync', apply)
    socket.on('attendance:created', event => setRecords(current => [event, ...current.filter(item => item.id !== event.id)].slice(0, 500)))
    refresh()
    const timer = window.setInterval(refresh, 5000)
    return () => { alive = false; clearInterval(timer); socket.disconnect() }
  }, [])
  return records
}
