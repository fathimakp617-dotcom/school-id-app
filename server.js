import { createServer } from 'node:http'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { extname } from 'node:path'
import { Server } from 'socket.io'
import { mockHomework, mockStudents } from './src/data/mockData.js'
import { createAuthStore } from './serverAuth.js'
import { createJsonStore } from './serverStorage.js'

const here = dirname(fileURLToPath(import.meta.url))
const dataDir = resolve(process.env.DATA_DIR || resolve(here, 'server-data'))
const webDir = resolve(here, 'dist')
const dataFile = resolve(dataDir, 'homework.json')
const studentsFile = resolve(dataDir, 'students.json')
const deletedStudentsFile = resolve(dataDir, 'deleted-students.json')
const completionsFile = resolve(dataDir, 'homework-completions.json')
const scansFile = resolve(dataDir, 'rfid-scans.json')
const attendanceFile = resolve(dataDir, 'attendance.json')
const feesFile = resolve(dataDir, 'fees.json')
const settingsFile = resolve(dataDir, 'settings.json')
const devicesFile = resolve(dataDir, 'rfid-devices.json')
const usersFile = resolve(dataDir, 'users.json')
const sessionsFile = resolve(dataDir, 'sessions.json')
const attachmentsDir = resolve(dataDir, 'attachments')
const port = Number(process.env.PORT || 3001)
let persistentStore
const authStore = createAuthStore({ usersFile, sessionsFile, dataStore: { read: (...args) => persistentStore.read(...args), write: (...args) => persistentStore.write(...args), update: (...args) => persistentStore.update(...args) } })
const allowedOrigins = new Set((process.env.CORS_ORIGINS || 'https://localhost,capacitor://localhost').split(',').map(origin => origin.trim()).filter(Boolean))
if (process.env.NODE_ENV !== 'production') allowedOrigins.add('http://localhost:5173')

function isAllowedRequestOrigin(origin, request) {
  if (!origin) return true
  if (allowedOrigins.has(origin)) return true
  try {
    const parsedOrigin = new URL(origin)
    const forwardedProtocol = String(request.headers['x-forwarded-proto'] || '').split(',')[0].trim()
    const requestProtocol = forwardedProtocol || (request.socket.encrypted ? 'https' : 'http')
    return parsedOrigin.host === request.headers.host && parsedOrigin.protocol === `${requestProtocol}:`
  } catch {
    return false
  }
}

async function readAddedHomework() {
  return persistentStore.read(dataFile, [])
}

async function readAddedStudents() {
  return persistentStore.read(studentsFile, [])
}

async function readAllStudents() {
  return [...mockStudents, ...await readAddedStudents()]
}

async function readActiveStudents() {
  const [students, deletedIds] = await Promise.all([
    readAllStudents(),
    persistentStore.read(deletedStudentsFile, []),
  ])
  const deleted = new Set(Array.isArray(deletedIds) ? deletedIds : [])
  return students.filter(student => !deleted.has(student.id))
}

async function readCompletions() {
  return persistentStore.read(completionsFile, {})
}

async function readScans() {
  return persistentStore.read(scansFile, [])
}

async function readAttendance() {
  return persistentStore.read(attendanceFile, [])
}

async function readFees() {
  return persistentStore.read(feesFile, {})
}

async function readSettings() {
  return { feeAmount: 24500, schoolName: 'SchoolID', upiId: '', ...await persistentStore.read(settingsFile, {}) }
}

async function readDevices() {
  return persistentStore.read(devicesFile, [])
}

async function writeJson(file, value) {
  await persistentStore.write(file, value)
}

async function healthJson(file, fallback, expectedType) {
  const parsed = await persistentStore.read(file, fallback)
  if (expectedType === 'array' ? !Array.isArray(parsed) : (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))) {
    throw new Error(`Unexpected data format in ${file}`)
  }
  return parsed
}

async function readRequestJson(request) {
  let body = ''
  for await (const chunk of request) {
    body += chunk
    if (body.length > 15 * 1024 * 1024) throw new Error('Request body too large')
  }
  return JSON.parse(body)
}

function sendJson(response, status, payload) {
  response.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(payload))
}

function bearerToken(request) {
  const match = request.headers.authorization?.match(/^Bearer\s+(.+)$/i)
  return match?.[1] || ''
}

function requireRole(response, user, roles) {
  if (roles.includes(user.role)) return true
  sendJson(response, 403, { error: 'You do not have permission to perform this action.' })
  return false
}

const loginFailures = new Map()
function loginRateLimited(ip) {
  const now = Date.now()
  const previous = loginFailures.get(ip) || { count: 0, since: now }
  if (now - previous.since > 15 * 60 * 1000) { previous.count = 0; previous.since = now }
  previous.count += 1
  loginFailures.set(ip, previous)
  return previous.count > 10
}

const parentRoom = studentId => `parent:${studentId}`
const homeworkRoom = className => `homework-class:${className}`
const teacherRoom = className => `teacher-class:${className}`
const linkedStudentIds = user => [...new Set([...(Array.isArray(user?.studentIds) ? user.studentIds : []), ...(user?.studentId ? [user.studentId] : [])])]
const parentCanAccessStudent = (user, studentId) => linkedStudentIds(user).includes(studentId)
const emitHomeworkToClass = (className, event, payload) => io.to('role:admin').to(homeworkRoom(className)).emit(event, payload)
const emitAttendanceTo = (className, studentId, payload) => io.to('role:admin').to(teacherRoom(className)).to(parentRoom(studentId)).emit('attendance:created', payload)
const emitFeeTo = (studentId, payload) => io.to('role:admin').to(parentRoom(studentId)).emit('fees:updated', payload)

const httpServer = createServer(async (request, response) => {
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.setHeader('X-Frame-Options', 'DENY')
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  const origin = request.headers.origin
  const originAllowed = isAllowedRequestOrigin(origin, request)
  if (origin && originAllowed) {
    response.setHeader('Access-Control-Allow-Origin', origin)
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    response.setHeader('Access-Control-Max-Age', '600')
    response.setHeader('Vary', 'Origin')
  }
  if (request.method === 'OPTIONS') {
    if (!originAllowed) { response.writeHead(403).end(); return }
    response.writeHead(204).end()
    return
  }
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`)
  if (request.method === 'POST' && url.pathname === '/api/auth/login') {
    const ip = request.socket.remoteAddress || 'unknown'
    if (loginRateLimited(ip)) return sendJson(response, 429, { error: 'Too many sign-in attempts. Wait 15 minutes and try again.' })
    try {
      const { email, password } = await readRequestJson(request)
      const session = await authStore.login(email, password)
      if (!session) return sendJson(response, 401, { error: 'Email or password is incorrect.' })
      loginFailures.delete(ip)
      return sendJson(response, 200, session)
    } catch {
      return sendJson(response, 400, { error: 'Could not sign in.' })
    }
  }
  if (request.method === 'GET' && url.pathname === '/api/health') {
    try {
      const [students, homework, completions, scans, attendance, fees, settings, devices] = await Promise.all([
        healthJson(studentsFile, [], 'array'), healthJson(dataFile, [], 'array'),
        healthJson(completionsFile, {}, 'object'), healthJson(scansFile, [], 'array'),
        healthJson(attendanceFile, [], 'array'), healthJson(feesFile, {}, 'object'), healthJson(settingsFile, { feeAmount: 24500, schoolName: 'SchoolID', upiId: '' }, 'object'), healthJson(devicesFile, [], 'array'),
      ])
      sendJson(response, 200, { ok: true, storage: persistentStore.databaseConfigured ? 'postgresql' : 'local-json', database: persistentStore.databaseConfigured ? 'healthy' : 'not_configured', records: { students: students.length + mockStudents.length, homework: homework.length + mockHomework.length, scans: scans.length, attendance: attendance.length, feeAccounts: Object.keys(fees).length, completionAccounts: Object.keys(completions).length, readers: devices.length }, paymentConfigured: Boolean(settings.upiId) })
    } catch (error) {
      sendJson(response, 503, { ok: false, storage: 'error', database: persistentStore.databaseConfigured ? 'error' : 'not_configured', error: error.message })
    }
    return
  }
  if (request.method === 'POST' && url.pathname === '/api/rfid/scan') {
    const expectedDeviceKey = process.env.SCHOOLID_RFID_DEVICE_KEY || ''
    if (process.env.NODE_ENV === 'production' && (!expectedDeviceKey || expectedDeviceKey === 'replace-with-a-long-random-device-secret' || request.headers['x-device-key'] !== expectedDeviceKey)) {
      return sendJson(response, 401, { error: 'RFID reader is not authorized.' })
    }
  }
  if (request.method === 'POST' && url.pathname === '/api/rfid/heartbeat') {
    const expectedDeviceKey = process.env.SCHOOLID_RFID_DEVICE_KEY || ''
    if (!expectedDeviceKey || expectedDeviceKey === 'replace-with-a-long-random-device-secret' || request.headers['x-device-key'] !== expectedDeviceKey) {
      return sendJson(response, 401, { error: 'RFID reader is not authorized.' })
    }
    try {
      const body = await readRequestJson(request)
      const deviceId = String(body.deviceId || '').trim().slice(0, 80)
      if (!deviceId) return sendJson(response, 400, { error: 'Reader device ID is required.' })
      const devices = await readDevices()
      const device = {
        deviceId,
        ip: String(body.ip || '').slice(0, 64),
        rssi: Number.isFinite(Number(body.rssi)) ? Number(body.rssi) : null,
        uptimeSeconds: Number.isFinite(Number(body.uptimeSeconds)) ? Number(body.uptimeSeconds) : null,
        queueDepth: Math.max(0, Number(body.queueDepth) || 0),
        firmwareVersion: String(body.firmwareVersion || 'unknown').slice(0, 40),
        lastScanAt: body.lastScanAt ? String(body.lastScanAt).slice(0, 40) : null,
        lastSeenAt: new Date().toISOString(),
      }
      const index = devices.findIndex(item => item.deviceId === deviceId)
      if (index >= 0) devices[index] = device
      else devices.unshift(device)
      await writeJson(devicesFile, devices.slice(0, 50))
      io.to('role:admin').emit('rfid:device', device)
      return sendJson(response, 200, { ok: true, serverTime: device.lastSeenAt })
    } catch {
      return sendJson(response, 400, { error: 'Invalid reader heartbeat.' })
    }
  }
  let currentUser = null
  if (url.pathname.startsWith('/api/') && !['/api/health', '/api/auth/login', '/api/rfid/scan'].includes(url.pathname)) {
    try { currentUser = await authStore.getUserForToken(bearerToken(request)) }
    catch { return sendJson(response, 503, { error: 'Authentication service unavailable.' }) }
    if (!currentUser) return sendJson(response, 401, { error: 'Please sign in to continue.' })
  }
  if (request.method === 'GET' && url.pathname === '/api/auth/me') {
    return sendJson(response, 200, currentUser)
  }
  if (request.method === 'POST' && url.pathname === '/api/auth/logout') {
    await authStore.revokeToken(bearerToken(request))
    return sendJson(response, 200, { ok: true })
  }
  if (url.pathname === '/api/admin/accounts') {
    if (!currentUser || !requireRole(response, currentUser, ['admin'])) return
    if (request.method === 'GET') {
      return sendJson(response, 200, (await authStore.listAccounts()).map(({ id, name, email, role, studentId, class: className, subject, createdAt, active }) => ({ id, name, email, role, studentId, class: className, subject, createdAt, active })))
    }
    if (request.method === 'POST') {
      try {
        const data = await readRequestJson(request)
        if (data.role === 'parent') {
          const student = (await readActiveStudents()).find(item => item.id === data.studentId)
          if (!student) return sendJson(response, 400, { error: 'Choose a registered student for this Parent account.' })
        }
        const account = await authStore.createAccount(data)
        io.to('role:admin').emit('account:created', account)
        return sendJson(response, 201, account)
      } catch (error) {
        return sendJson(response, 400, { error: error.message || 'Could not create account.' })
      }
    }
  }
  if (request.method === 'GET' && url.pathname === '/api/homework') {
    const added = await readAddedHomework()
    const homework = [...mockHomework, ...added]
    if (currentUser.role === 'parent') {
      const studentIds = new Set(linkedStudentIds(currentUser))
      const classes = new Set((await readActiveStudents()).filter(item => studentIds.has(item.id)).map(item => item.class))
      return sendJson(response, 200, homework.filter(item => classes.has(item.class)))
    }
    return sendJson(response, 200, currentUser.role === 'teacher' ? homework.filter(item => item.class === currentUser.class) : homework)
  }
  if (request.method === 'POST' && url.pathname === '/api/homework') {
    if (!requireRole(response, currentUser, ['admin', 'teacher'])) return
    try {
      const record = await readRequestJson(request)
      if (!record.title?.trim() || !record.class?.trim() || !record.subject?.trim() || !record.dueDate) return sendJson(response, 400, { error: 'Title, class, subject and due date are required.' })
      if (currentUser.role === 'teacher' && record.class.trim() !== currentUser.class) return sendJson(response, 403, { error: 'You can only post homework for your assigned class.' })
      const added = await readAddedHomework()
      const saved = { ...record, teacherName: currentUser.role === 'teacher' ? currentUser.name : currentUser.name, title: record.title.trim(), class: record.class.trim(), id: record.id || randomUUID(), uploadedAt: record.uploadedAt || new Date().toISOString() }
      added.push(saved)
      await writeJson(dataFile, added)
      emitHomeworkToClass(saved.class, 'homework:created', saved)
      return sendJson(response, 201, saved)
    } catch {
      return sendJson(response, 400, { error: 'Could not save homework.' })
    }
  }
  const attachmentMatch = url.pathname.match(/^\/api\/attachments\/([a-f0-9-]+\.(?:pdf|png|jpe?g|gif|webp))$/i)
  if (request.method === 'GET' && attachmentMatch) {
    try {
      const filename = attachmentMatch[1]
      const stored = await persistentStore.readAttachment(filename)
      const bytes = stored?.content || await readFile(resolve(attachmentsDir, filename))
      const contentType = stored?.content_type || (filename.endsWith('.pdf') ? 'application/pdf'
        : filename.endsWith('.png') ? 'image/png'
          : filename.endsWith('.gif') ? 'image/gif'
            : filename.endsWith('.webp') ? 'image/webp' : 'image/jpeg')
      response.writeHead(200, { 'Content-Type': contentType, 'Content-Disposition': 'inline', 'X-Content-Type-Options': 'nosniff' }).end(bytes)
    } catch {
      sendJson(response, 404, { error: 'Attachment not found.' })
    }
    return
  }
  if (request.method === 'POST' && url.pathname === '/api/attachments') {
    if (!requireRole(response, currentUser, ['admin', 'teacher'])) return
    try {
      const { name, type, data } = await readRequestJson(request)
      const allowedTypes = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp'])
      const encoded = typeof data === 'string' ? data.match(/^data:([^;]+);base64,([\s\S]+)$/) : null
      if (!name || !allowedTypes.has(type) || !encoded || encoded[1] !== type) return sendJson(response, 400, { error: 'Choose a PDF or image attachment.' })
      const bytes = Buffer.from(encoded[2], 'base64')
      if (!bytes.length || bytes.length > 10 * 1024 * 1024) return sendJson(response, 413, { error: 'Attachment must be smaller than 10 MB.' })
      const extension = extname(name).toLowerCase()
      const supportedExtensions = new Set(['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.webp'])
      if (!supportedExtensions.has(extension)) return sendJson(response, 400, { error: 'Attachment filename must end in PDF, JPG, PNG, GIF or WebP.' })
      const filename = `${randomUUID()}${extension}`
      if (persistentStore.databaseConfigured) await persistentStore.writeAttachment(filename, type, bytes)
      else {
        await mkdir(attachmentsDir, { recursive: true })
        await writeFile(resolve(attachmentsDir, filename), bytes)
      }
      sendJson(response, 201, { name, type, size: bytes.length, url: `/api/attachments/${filename}` })
    } catch {
      sendJson(response, 400, { error: 'Could not save this attachment.' })
    }
    return
  }
  if (request.method === 'GET' && url.pathname === '/api/students') {
    const students = await readActiveStudents()
    if (currentUser.role === 'parent') { const ids = new Set(linkedStudentIds(currentUser)); return sendJson(response, 200, students.filter(item => ids.has(item.id))) }
    return sendJson(response, 200, currentUser.role === 'teacher' ? students.filter(item => item.class === currentUser.class) : students)
  }
  if (request.method === 'GET' && url.pathname === '/api/rfid/scans') {
    if (!requireRole(response, currentUser, ['admin'])) return
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 100, 1), 500)
    sendJson(response, 200, (await readScans()).slice(0, limit))
    return
  }
  if (request.method === 'GET' && url.pathname === '/api/admin/devices') {
    if (!requireRole(response, currentUser, ['admin'])) return
    return sendJson(response, 200, await readDevices())
  }
  if (request.method === 'GET' && url.pathname === '/api/admin/backup') {
    if (!requireRole(response, currentUser, ['admin'])) return
    try {
      const [students, deletedStudents, homework, completions, scans, attendance, fees, settings, devices] = await Promise.all([
        persistentStore.read(studentsFile, []), persistentStore.read(deletedStudentsFile, []), readAddedHomework(), readCompletions(), readScans(), readAttendance(), readFees(), readSettings(), readDevices(),
      ])
      return sendJson(response, 200, { format: 'schoolid-backup-v1', createdAt: new Date().toISOString(), records: { students, deletedStudents, homework, completions, scans, attendance, fees, settings, devices } })
    } catch {
      return sendJson(response, 503, { error: 'Could not create a data backup.' })
    }
  }
  if (request.method === 'POST' && url.pathname === '/api/admin/backup/restore') {
    if (!requireRole(response, currentUser, ['admin'])) return
    try {
      const backup = await readRequestJson(request)
      if (backup.format !== 'schoolid-backup-v1' || backup.confirmRestore !== true || !backup.records || typeof backup.records !== 'object') return sendJson(response, 400, { error: 'Choose a valid SchoolID backup and confirm the restore.' })
      const records = backup.records
      const definitions = [
        ['students', studentsFile, 'array'], ['deletedStudents', deletedStudentsFile, 'array'], ['homework', dataFile, 'array'],
        ['completions', completionsFile, 'object'], ['scans', scansFile, 'array'], ['attendance', attendanceFile, 'array'],
        ['fees', feesFile, 'object'], ['settings', settingsFile, 'object'], ['devices', devicesFile, 'array'],
      ]
      for (const [key, , type] of definitions) {
        const value = records[key]
        if (type === 'array' ? !Array.isArray(value) : !value || typeof value !== 'object' || Array.isArray(value)) return sendJson(response, 400, { error: `Backup is missing valid ${key} data.` })
      }
      for (const [key, file] of definitions) await writeJson(file, records[key])
      io.to('role:admin').emit('rfid:scans:sync', records.scans.slice(0, 100))
      return sendJson(response, 200, { ok: true, restoredAt: new Date().toISOString() })
    } catch {
      return sendJson(response, 400, { error: 'Could not restore this backup.' })
    }
  }
  if (request.method === 'GET' && url.pathname === '/api/attendance') {
    const studentId = url.searchParams.get('studentId')
    const records = await readAttendance()
    let visibleRecords = records
    if (currentUser.role === 'parent') { const ids = new Set(linkedStudentIds(currentUser)); visibleRecords = visibleRecords.filter(record => ids.has(record.studentId)) }
    if (currentUser.role === 'teacher') visibleRecords = visibleRecords.filter(record => record.class === currentUser.class)
    if (studentId) visibleRecords = visibleRecords.filter(record => record.studentId === studentId)
    return sendJson(response, 200, visibleRecords.slice(0, 500))
  }
  if (request.method === 'GET' && url.pathname === '/api/fees') {
    const fees = await readFees()
    const studentId = url.searchParams.get('studentId')
    const settings = await readSettings()
    if (currentUser.role === 'teacher') return sendJson(response, 403, { error: 'Fee records are only available to the Parent and Admin.' })
    if (currentUser.role === 'parent' && studentId && !parentCanAccessStudent(currentUser, studentId)) return sendJson(response, 403, { error: 'This student is not linked to your Parent account.' })
    const requestedStudent = currentUser.role === 'parent' ? (studentId || currentUser.studentId) : studentId
    if (requestedStudent) return sendJson(response, 200, fees[requestedStudent] || { studentId: requestedStudent, amount: settings.feeAmount, status: 'due' })
    return sendJson(response, 200, fees)
  }
  if (request.method === 'GET' && url.pathname === '/api/settings') {
    const { schoolName, feeAmount, upiId } = await readSettings()
    sendJson(response, 200, { schoolName, feeAmount, upiId })
    return
  }
  if (request.method === 'POST' && url.pathname === '/api/settings') {
    if (!requireRole(response, currentUser, ['admin'])) return
    try {
      const { schoolName, feeAmount, upiId } = await readRequestJson(request)
      if (!Number.isFinite(Number(feeAmount)) || Number(feeAmount) <= 0 || String(upiId || '').length > 100) return sendJson(response, 400, { error: 'Enter a valid fee amount and UPI ID.' })
      const settings = { schoolName: String(schoolName || 'SchoolID').trim().slice(0, 80), feeAmount: Number(feeAmount), upiId: String(upiId || '').trim() }
      await writeJson(settingsFile, settings)
      io.to('school:all').emit('school-settings:updated', settings)
      return sendJson(response, 200, settings)
    } catch {
      return sendJson(response, 400, { error: 'Could not save school settings.' })
    }
  }
  if (request.method === 'POST' && url.pathname === '/api/fees/request') {
    if (!requireRole(response, currentUser, ['parent'])) return
    try {
      const { studentId, paymentReference = '' } = await readRequestJson(request)
      if (!parentCanAccessStudent(currentUser, studentId)) return sendJson(response, 403, { error: 'This student is not linked to your Parent account.' })
      const { feeAmount } = await readSettings()
      const amount = feeAmount
      if (!studentId || !Number.isFinite(Number(amount)) || Number(amount) <= 0) return sendJson(response, 400, { error: 'Valid student and fee amount are required.' })
      const student = (await readActiveStudents()).find(item => item.id === studentId)
      if (!student) return sendJson(response, 404, { error: 'Student not found.' })
      const fees = await readFees()
      const record = { studentId, amount: Number(amount), status: 'pending', paymentReference: String(paymentReference).slice(0, 100), requestedAt: new Date().toISOString(), confirmedAt: null }
      fees[studentId] = record
      await writeJson(feesFile, fees)
      emitFeeTo(studentId, record)
      return sendJson(response, 200, record)
    } catch {
      return sendJson(response, 400, { error: 'Could not submit payment request.' })
    }
  }
  if (request.method === 'POST' && url.pathname === '/api/fees/confirm') {
    if (!requireRole(response, currentUser, ['admin'])) return
    try {
      const { studentId, status } = await readRequestJson(request)
      if (!studentId || !['paid', 'due'].includes(status)) return sendJson(response, 400, { error: 'Student and valid payment status are required.' })
      const fees = await readFees()
      const record = { ...(fees[studentId] || { studentId, amount: 24500 }), status, confirmedAt: status === 'paid' ? new Date().toISOString() : null }
      fees[studentId] = record
      await writeJson(feesFile, fees)
      emitFeeTo(studentId, record)
      return sendJson(response, 200, record)
    } catch {
      return sendJson(response, 400, { error: 'Could not update fee status.' })
    }
  }
  if (request.method === 'POST' && url.pathname === '/api/students') {
    if (!requireRole(response, currentUser, ['admin'])) return
    try {
      const record = await readRequestJson(request)
      if (!record.name?.trim() || !record.class?.trim() || !record.rfidUID?.trim()) return sendJson(response, 400, { error: 'Student name, class and RFID UID are required.' })
      const allStudents = await readAllStudents()
      const students = await readActiveStudents()
      const rfidUID = record.rfidUID.trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
      const requestedId = typeof record.id === 'string' && /^S\d{3,}$/i.test(record.id.trim()) ? record.id.trim().toUpperCase() : null
      const existingCard = students.find(student => student.rfidUID.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() === rfidUID)
      if (existingCard) {
        const sameStudent = existingCard.name.trim().toLowerCase() === record.name.trim().toLowerCase() && existingCard.class.trim().toLowerCase() === record.class.trim().toLowerCase()
        if (!requestedId || !sameStudent || existingCard.id === requestedId) return sendJson(response, 409, { error: `RFID card ${rfidUID} is already assigned.` })
        if (allStudents.some(student => String(student.id).toUpperCase() === requestedId)) return sendJson(response, 409, { error: `Student ID ${requestedId} is already in use.` })
        const added = await readAddedStudents()
        const existingIndex = added.findIndex(student => student.rfidUID.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() === rfidUID)
        if (existingIndex < 0) return sendJson(response, 409, { error: `RFID card ${rfidUID} is already assigned.` })
        const saved = { ...added[existingIndex], ...record, id: requestedId, name: record.name.trim(), class: record.class.trim(), rfidUID }
        added[existingIndex] = saved
        await writeJson(studentsFile, added)
        io.to('role:admin').to(teacherRoom(saved.class)).emit('student:created', saved)
        return sendJson(response, 200, saved)
      }
      if (requestedId && allStudents.some(student => String(student.id).toUpperCase() === requestedId)) return sendJson(response, 409, { error: `Student ID ${requestedId} is already in use.` })
      const nextNumber = allStudents.reduce((max, student) => Math.max(max, Number(student.id.replace(/^S/i, '')) || 0), 0) + 1
      const colors = ['bg-cyan-600', 'bg-rose-500', 'bg-amber-500', 'bg-indigo-500', 'bg-teal-600']
      const saved = {
        ...record,
        id: requestedId || `S${String(nextNumber).padStart(3, '0')}`,
        name: record.name.trim(),
        class: record.class.trim(),
        rfidUID,
        avatar: record.name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase(),
        avatarBg: colors[nextNumber % colors.length],
      }
      const added = await readAddedStudents()
      added.push(saved)
      await writeJson(studentsFile, added)
      io.to('role:admin').to(teacherRoom(saved.class)).emit('student:created', saved)
      sendJson(response, 201, saved)
    } catch {
      sendJson(response, 400, { error: 'Invalid request body' })
    }
    return
  }
  if (request.method === 'DELETE' && url.pathname.startsWith('/api/students/')) {
    if (!requireRole(response, currentUser, ['admin'])) return
    let studentId
    try { studentId = decodeURIComponent(url.pathname.slice('/api/students/'.length)).trim() }
    catch { return sendJson(response, 400, { error: 'Valid student ID is required.' }) }
    if (!studentId || studentId.includes('/')) return sendJson(response, 400, { error: 'Valid student ID is required.' })
    try {
      const student = (await readActiveStudents()).find(item => item.id === studentId)
      if (!student) return sendJson(response, 404, { error: 'Student not found or already removed.' })
      await persistentStore.update(deletedStudentsFile, [], current => [...new Set([...(Array.isArray(current) ? current : []), student.id])])
      await authStore.deactivateParentAccountsForStudent(student.id)
      io.to('school:all').emit('student:deleted', { id: student.id })
      io.in(parentRoom(student.id)).disconnectSockets(true)
      return sendJson(response, 200, { ok: true, studentId: student.id })
    } catch {
      return sendJson(response, 500, { error: 'Could not remove this student. Please try again.' })
    }
  }
  if (request.method === 'GET' && url.pathname === '/api/homework/completions') {
    const studentId = url.searchParams.get('studentId')
    if (currentUser.role === 'parent' && !parentCanAccessStudent(currentUser, studentId)) return sendJson(response, 403, { error: 'This student is not linked to your Parent account.' })
    if (currentUser.role === 'teacher') return sendJson(response, 403, { error: 'Completion status is not available to this account.' })
    const completions = await readCompletions()
    sendJson(response, 200, { studentId, completedIds: completions[studentId] || [] })
    return
  }
  if (request.method === 'POST' && url.pathname === '/api/homework/completions') {
    if (!requireRole(response, currentUser, ['parent'])) return
    try {
      const { studentId, homeworkId, completed } = await readRequestJson(request)
      if (!studentId || !homeworkId || typeof completed !== 'boolean') return sendJson(response, 400, { error: 'Student, homework and completion state are required.' })
      if (!parentCanAccessStudent(currentUser, studentId)) return sendJson(response, 403, { error: 'This student is not linked to your Parent account.' })
      const completions = await readCompletions()
      const ids = new Set(completions[studentId] || [])
      if (completed) ids.add(homeworkId)
      else ids.delete(homeworkId)
      completions[studentId] = [...ids]
      await writeJson(completionsFile, completions)
      const payload = { studentId, completedIds: completions[studentId] }
      io.to(parentRoom(studentId)).emit('homework:completion-updated', payload)
      sendJson(response, 200, payload)
    } catch {
      sendJson(response, 400, { error: 'Invalid request body' })
    }
    return
  }
  if (request.method === 'POST' && url.pathname === '/api/rfid/scan') {
    try {
      const { uid, eventId, timestamp } = await readRequestJson(request)
      if (!uid?.trim()) return sendJson(response, 400, { error: 'RFID UID is required.' })
      const normalizedUID = uid.trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
      if (eventId) {
        const scans = await readScans()
        const previous = scans.find(item => item.eventId === String(eventId).slice(0, 100))
        if (previous) {
          const previousStudent = previous.studentId ? (await readActiveStudents()).find(item => item.id === previous.studentId) : null
          return sendJson(response, 200, { authorized: Boolean(previous.authorized), uid: normalizedUID, student: previousStudent || undefined, display: previous.studentName || 'UNAUTHORIZED CARD', duplicate: true })
        }
      }
      const student = (await readActiveStudents()).find(item => item.rfidUID.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() === normalizedUID)
      const event = {
        id: randomUUID(),
        eventId: eventId ? String(eventId).slice(0, 100) : undefined,
        uid: normalizedUID,
        timestamp: timestamp && Number.isFinite(Date.parse(timestamp)) ? new Date(timestamp).toISOString() : new Date().toISOString(),
        authorized: Boolean(student),
        studentId: student?.id || null,
        studentName: student?.name || null,
        class: student?.class || null,
      }
      const scans = [event, ...await readScans()].slice(0, 10000)
      await writeJson(scansFile, scans)
      io.to('role:admin').emit('rfid:scan', event)
      if (!student) {
        io.to('role:admin').emit('rfid:unauthorized', event)
        return sendJson(response, 200, { authorized: false, uid: normalizedUID, display: 'UNAUTHORIZED CARD' })
      }
      const attendance = await readAttendance()
      const day = event.timestamp.slice(0, 10)
      const todays = attendance.filter(item => item.studentId === student.id && item.timestamp.slice(0, 10) === day)
      const duplicateTap = todays.some(item => Math.abs(new Date(item.timestamp).getTime() - new Date(event.timestamp).getTime()) < 30000)
      if (!duplicateTap) {
        const earlierEvents = todays.filter(item => new Date(item.timestamp).getTime() < new Date(event.timestamp).getTime())
        const type = earlierEvents.length % 2 === 0 ? 'arrival' : 'departure'
        const attendanceEvent = { id: randomUUID(), studentId: student.id, studentName: student.name, class: student.class, type, timestamp: event.timestamp, uid: normalizedUID }
        attendance.unshift(attendanceEvent)
        await writeJson(attendanceFile, attendance.slice(0, 5000))
        emitAttendanceTo(student.class, student.id, attendanceEvent)
      }
      return sendJson(response, 200, { authorized: true, uid: normalizedUID, student, display: student.name })
    } catch {
      sendJson(response, 400, { error: 'Invalid RFID scan request.' })
    }
    return
  }
  if ((request.method === 'GET' || request.method === 'HEAD') && !url.pathname.startsWith('/api/')) {
    try {
      const relativePath = decodeURIComponent(url.pathname).replace(/^\/+/, '')
      const requestedFile = resolve(webDir, relativePath || 'index.html')
      const safeFile = requestedFile.startsWith(`${webDir}/`) || requestedFile === resolve(webDir, 'index.html')
      let filePath = safeFile ? requestedFile : resolve(webDir, 'index.html')
      let contents
      try { contents = await readFile(filePath) }
      catch { filePath = resolve(webDir, 'index.html'); contents = await readFile(filePath) }
      const contentTypes = { '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8', '.ico': 'image/x-icon', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' }
      response.writeHead(200, { 'Content-Type': contentTypes[extname(filePath)] || 'application/octet-stream', 'Cache-Control': filePath.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000, immutable' })
      response.end(request.method === 'HEAD' ? undefined : contents)
      return
    } catch {
      // If the production web bundle is absent, fall through to the API 404.
    }
  }
  response.writeHead(404, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'Not found' }))
})

const io = new Server(httpServer, {
  cors: { origin: true },
  allowRequest: (request, callback) => callback(null, isAllowedRequestOrigin(request.headers.origin, request))
})
io.use(async (socket, next) => {
  try {
    const user = await authStore.getUserForToken(socket.handshake.auth?.token || '')
    if (!user) return next(new Error('Authentication required'))
    socket.data.user = user
    return next()
  } catch (error) { return next(new Error('Authentication service unavailable')) }
})
io.on('connection', async socket => {
  const user = socket.data.user
  socket.join('school:all')
  socket.join(`role:${user.role}`)
  if (user.role === 'teacher') { socket.join(homeworkRoom(user.class)); socket.join(teacherRoom(user.class)) }
  const parentIds = new Set(linkedStudentIds(user))
  if (user.role === 'parent') for (const studentId of parentIds) socket.join(parentRoom(studentId))
  const allStudents = await readActiveStudents()
  const visibleStudents = user.role === 'admin' ? allStudents : user.role === 'teacher' ? allStudents.filter(item => item.class === user.class) : allStudents.filter(item => parentIds.has(item.id))
  const visibleClasses = new Set(visibleStudents.map(item => item.class))
  if (user.role === 'parent') for (const className of visibleClasses) socket.join(homeworkRoom(className))
  const allHomework = [...mockHomework, ...await readAddedHomework()]
  socket.emit('homework:sync', user.role === 'admin' ? allHomework : allHomework.filter(item => visibleClasses.has(item.class)))
  socket.emit('student:sync', visibleStudents)
  if (user.role === 'admin') socket.emit('rfid:scans:sync', (await readScans()).slice(0, 100))
  const allAttendance = await readAttendance()
  const visibleAttendance = user.role === 'admin' ? allAttendance : user.role === 'teacher' ? allAttendance.filter(item => item.class === user.class) : allAttendance.filter(item => parentIds.has(item.studentId))
  socket.emit('attendance:sync', visibleAttendance.slice(0, 500))
  socket.on('homework:completion-subscribe', async studentId => {
    if (user.role !== 'parent' || !parentIds.has(studentId)) return
    const completions = await readCompletions()
    socket.emit('homework:completion-sync', { studentId, completedIds: completions[studentId] || [] })
  })
})

async function start() {
  if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL) throw new Error('DATABASE_URL is required in production; refusing to start with local JSON storage.')
  persistentStore = await createJsonStore({ dataDir })
  await authStore.bootstrapAdmin()
  await authStore.bootstrapFixedAccounts({ activeStudentIds: (await readActiveStudents()).map(student => student.id) })
  const accounts = await authStore.listAccounts()
  if (!accounts.some(user => user.role === 'admin')) throw new Error('No SchoolID Admin exists. Set SCHOOLID_ADMIN_EMAIL and SCHOOLID_ADMIN_PASSWORD before starting the server.')
  if (process.env.NODE_ENV === 'production' && (!accounts.some(user => user.role === 'teacher') || !accounts.some(user => user.role === 'parent'))) {
    throw new Error('Set the fixed SCHOOLID_STAFF_* and SCHOOLID_PARENT_* credentials before starting the production server.')
  }
  httpServer.listen(port, '0.0.0.0', () => console.log(`SchoolID server listening on port ${port}`))
}

start().catch(error => { console.error(error.message); process.exitCode = 1 })
