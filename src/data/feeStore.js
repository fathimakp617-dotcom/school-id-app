import { useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import { API_URL } from './studentStore'
import { socketAuthOptions } from './authStore'

export const DEFAULT_FEE_AMOUNT = 24500
const api = path => `${API_URL}${path}`

export function useSchoolSettings() {
  const [settings, setSettings] = useState({ schoolName: 'SchoolID', feeAmount: DEFAULT_FEE_AMOUNT, upiId: '' })
  useEffect(() => {
    let alive = true
    const refresh = () => fetch(api('/api/settings'), { cache: 'no-store' }).then(response => response.ok ? response.json() : null).then(value => { if (alive && value) setSettings(value) }).catch(() => {})
    const socket = io(API_URL || window.location.origin, { ...socketAuthOptions(), transports: ['websocket', 'polling'], reconnection: true })
    socket.on('school-settings:updated', value => setSettings(value))
    refresh()
    return () => { alive = false; socket.disconnect() }
  }, [])
  return settings
}

export async function saveSchoolSettings(settings) {
  const response = await fetch(api('/api/settings'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Could not save school settings.')
  return result
}

export function useFees(studentId = '') {
  const [fees, setFees] = useState({})
  useEffect(() => {
    let alive = true
    const refresh = () => fetch(api(`/api/fees${studentId ? `?studentId=${encodeURIComponent(studentId)}` : ''}`), { cache: 'no-store' }).then(response => response.ok ? response.json() : {}).then(value => { if (alive) setFees(studentId ? { [studentId]: value } : value) }).catch(() => {})
    const socket = io(API_URL || window.location.origin, { ...socketAuthOptions(), transports: ['websocket', 'polling'], reconnection: true })
    socket.on('fees:updated', record => setFees(current => ({ ...current, [record.studentId]: record })))
    refresh()
    const timer = window.setInterval(refresh, 5000)
    return () => { alive = false; clearInterval(timer); socket.disconnect() }
  }, [studentId])
  return fees
}

export async function requestFeePayment(studentId, paymentReference = '') {
  const response = await fetch(api('/api/fees/request'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ studentId, paymentReference }) })
  const record = await response.json()
  if (!response.ok) throw new Error(record.error || 'Could not submit the payment request.')
  return record
}

export async function setFeeStatus(studentId, status) {
  const response = await fetch(api('/api/fees/confirm'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ studentId, status }) })
  const record = await response.json()
  if (!response.ok) throw new Error(record.error || 'Could not update the fee status.')
  return record
}
