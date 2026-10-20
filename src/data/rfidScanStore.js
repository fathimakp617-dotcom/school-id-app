import { useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import { API_URL } from './studentStore'
import { socketAuthOptions } from './authStore'

export function useRfidScans() {
  const [scans, setScans] = useState([])
  const [connection, setConnection] = useState('connecting')

  useEffect(() => {
    let active = true
    let socketConnected = false
    const apply = records => {
      if (active && Array.isArray(records)) setScans(records)
    }
    const poll = async () => {
      try {
        const response = await fetch(`${API_URL}/api/rfid/scans?limit=100`, { cache: 'no-store' })
        if (!response.ok) throw new Error(`Scan feed returned HTTP ${response.status}`)
        apply(await response.json())
        if (active && !socketConnected) setConnection('server reachable · polling updates')
      } catch (error) {
        if (active && !socketConnected) setConnection(`server unavailable · ${error.message}`)
      }
    }
    const socket = io(API_URL || window.location.origin, { ...socketAuthOptions(), transports: ['websocket', 'polling'], reconnection: true, timeout: 5000 })
    socket.on('rfid:scans:sync', apply)
    socket.on('rfid:scan', scan => setScans(current => [scan, ...current.filter(item => item.id !== scan.id)].slice(0, 500)))
    socket.on('connect', () => { socketConnected = true; setConnection('live · socket connected'); poll() })
    socket.on('disconnect', () => { socketConnected = false; setConnection('server reachable · polling updates') })
    socket.on('connect_error', () => { socketConnected = false; setConnection('server reachable · polling updates') })
    poll()
    const pollTimer = window.setInterval(poll, 2000)
    return () => {
      active = false
      window.clearInterval(pollTimer)
      socket.disconnect()
    }
  }, [])

  return { scans, connection }
}
