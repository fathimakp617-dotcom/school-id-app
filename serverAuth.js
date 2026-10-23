import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto'
import { promisify } from 'node:util'
import { readFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { randomUUID } from 'node:crypto'

const scrypt = promisify(scryptCallback)

export function createAuthStore({ usersFile, sessionsFile, dataStore }) {
  async function readJson(file, fallback) {
    if (dataStore) return dataStore.read(file, fallback)
    try { return JSON.parse(await readFile(file, 'utf8')) } catch (error) {
      if (error.code === 'ENOENT') return fallback
      throw error
    }
  }

  async function writeJson(file, value) {
    if (dataStore) return dataStore.write(file, value)
    await mkdir(dirname(file), { recursive: true })
    const { writeFile } = await import('node:fs/promises')
    await writeFile(file, JSON.stringify(value, null, 2))
  }
  const updateJson = (file, fallback, updater) => dataStore
    ? dataStore.update(file, fallback, updater)
    : readJson(file, fallback).then(async value => { const next = await updater(value); await writeJson(file, next); return next })

  const users = () => readJson(usersFile, [])

  async function hashPassword(password, salt = randomBytes(16).toString('hex')) {
    const key = await scrypt(password, salt, 64)
    return { salt, passwordHash: key.toString('hex') }
  }

  async function verifyPassword(password, salt, passwordHash) {
    const actual = await scrypt(password, salt, 64)
    const expected = Buffer.from(passwordHash, 'hex')
    return expected.length === actual.length && timingSafeEqual(expected, actual)
  }

  async function updatePasswordIfChanged(user, password) {
    if (await verifyPassword(password, user.passwordSalt, user.passwordHash)) return
    const { salt, passwordHash } = await hashPassword(password)
    await updateJson(usersFile, [], current => current.map(item => item.id === user.id ? { ...item, passwordSalt: salt, passwordHash } : item))
  }

  function publicUser(user) {
    const { passwordHash, passwordSalt, ...safe } = user
    return safe
  }

  async function bootstrapAdmin() {
    const list = await users()
    const email = String(process.env.SCHOOLID_ADMIN_EMAIL || '').trim().toLowerCase()
    const password = process.env.SCHOOLID_ADMIN_PASSWORD || ''
    if (!email && !password) return
    if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 8) throw new Error('Set a valid SCHOOLID_ADMIN_EMAIL and a SCHOOLID_ADMIN_PASSWORD of at least 8 characters before starting the server.')
    const existing = list.find(user => user.role === 'admin')
    if (existing) {
      if (existing.email !== email) throw new Error('SCHOOLID_ADMIN_EMAIL does not match the existing Admin account.')
      await updatePasswordIfChanged(existing, password)
      return
    }
    const { salt, passwordHash } = await hashPassword(password)
    const admin = { id: randomUUID(), name: 'School Administrator', email, role: 'admin', passwordSalt: salt, passwordHash, createdAt: new Date().toISOString(), active: true }
    await updateJson(usersFile, [], current => current.some(user => user.role === 'admin') ? current : [...current, admin])
    console.log('Bootstrapped the initial SchoolID Admin account.')
  }

  // Fixed Staff and Parent sign-ins are configured as server secrets.
  // Password changes in Render are applied to these fixed accounts at startup.
  async function bootstrapFixedAccounts() {
    const definitions = [
      {
        role: 'teacher',
        email: process.env.SCHOOLID_STAFF_EMAIL,
        password: process.env.SCHOOLID_STAFF_PASSWORD,
        name: process.env.SCHOOLID_STAFF_NAME || 'School Staff',
        class: process.env.SCHOOLID_STAFF_CLASS
      },
      {
        role: 'parent',
        email: process.env.SCHOOLID_PARENT_EMAIL,
        password: process.env.SCHOOLID_PARENT_PASSWORD,
        name: process.env.SCHOOLID_PARENT_NAME || 'School Parent',
        studentId: process.env.SCHOOLID_PARENT_STUDENT_ID
      }
    ]

    for (const definition of definitions) {
      const email = String(definition.email || '').trim().toLowerCase()
      const password = definition.password || ''
      if (!email && !password) continue
      if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 8) {
        throw new Error(`Set a valid SCHOOLID_${definition.role === 'teacher' ? 'STAFF' : 'PARENT'}_EMAIL and a SCHOOLID_${definition.role === 'teacher' ? 'STAFF' : 'PARENT'}_PASSWORD of at least 8 characters.`)
      }
      if (definition.role === 'teacher' && !String(definition.class || '').trim()) {
        throw new Error('Set SCHOOLID_STAFF_CLASS for the fixed Staff account.')
      }
      if (definition.role === 'parent' && !String(definition.studentId || '').trim()) {
        throw new Error('Set SCHOOLID_PARENT_STUDENT_ID for the fixed Parent account.')
      }

      const list = await users()
      const existing = list.find(user => user.email === email)
      if (existing) {
        if (existing.role !== definition.role) throw new Error(`The configured fixed ${definition.role} email is already used by a different account role.`)
        await updatePasswordIfChanged(existing, password)
        continue
      }

      const { salt, passwordHash } = await hashPassword(password)
      const user = {
        id: randomUUID(), name: String(definition.name).trim(), email,
        role: definition.role, passwordSalt: salt, passwordHash,
        createdAt: new Date().toISOString(), active: true
      }
      if (definition.role === 'teacher') user.class = String(definition.class).trim()
      if (definition.role === 'parent') user.studentId = String(definition.studentId).trim()
      await updateJson(usersFile, [], current => {
        if (current.some(item => item.email === email)) return current
        return [...current, user]
      })
      console.log(`Bootstrapped the fixed SchoolID ${definition.role} account.`)
    }
  }

  async function createAccount({ name, email, password, role, studentId, className, subject }) {
    const list = await users()
    const normalizedEmail = String(email || '').trim().toLowerCase()
    if (!name?.trim() || !/^\S+@\S+\.\S+$/.test(normalizedEmail)) throw new Error('Enter a valid name and email address.')
    if (!['teacher', 'parent'].includes(role)) throw new Error('Accounts can be created for Teachers or Parents.')
    if (String(password || '').length < 12) throw new Error('Use a password with at least 12 characters.')
    if (list.some(user => user.email === normalizedEmail)) throw new Error('An account already uses this email address.')
    if (role === 'parent' && !studentId) throw new Error('Choose the student linked to this Parent account.')
    if (role === 'teacher' && !String(className || '').trim()) throw new Error('Enter the Teacher’s assigned class.')
    const { salt, passwordHash } = await hashPassword(password)
    const user = { id: randomUUID(), name: name.trim(), email: normalizedEmail, role, passwordSalt: salt, passwordHash, createdAt: new Date().toISOString(), active: true }
    if (role === 'parent') user.studentId = studentId
    if (role === 'teacher') { user.class = String(className).trim(); user.subject = String(subject || '').trim() }
    await updateJson(usersFile, [], current => {
      if (current.some(existing => existing.email === normalizedEmail)) throw new Error('An account already uses this email address.')
      return [...current, user]
    })
    return publicUser(user)
  }

  async function login(email, password) {
    const normalizedEmail = String(email || '').trim().toLowerCase()
    const user = (await users()).find(item => item.email === normalizedEmail && item.active)
    if (!user || !await verifyPassword(String(password || ''), user.passwordSalt, user.passwordHash)) return null
    const token = randomBytes(32).toString('base64url')
    await updateJson(sessionsFile, [], sessions => [...sessions.filter(item => item.expiresAt > Date.now()), { tokenHash: createHash('sha256').update(token).digest('hex'), userId: user.id, expiresAt: Date.now() + 8 * 60 * 60 * 1000 }])
    return { token, user: publicUser(user) }
  }

  async function getUserForToken(token) {
    if (!token) return null
    const tokenHash = createHash('sha256').update(token).digest('hex')
    const sessions = await readJson(sessionsFile, [])
    const session = sessions.find(item => {
      if (item.expiresAt <= Date.now() || typeof item.tokenHash !== 'string') return false
      const storedHash = Buffer.from(item.tokenHash)
      const requestedHash = Buffer.from(tokenHash)
      return storedHash.length === requestedHash.length && timingSafeEqual(storedHash, requestedHash)
    })
    if (!session) return null
    const user = (await users()).find(item => item.id === session.userId && item.active)
    return user ? publicUser(user) : null
  }

  async function revokeToken(token) {
    if (!token) return
    const tokenHash = createHash('sha256').update(token).digest('hex')
    await updateJson(sessionsFile, [], sessions => sessions.filter(item => item.tokenHash !== tokenHash && item.expiresAt > Date.now()))
  }

  async function listAccounts() {
    return (await users()).map(publicUser)
  }

  async function deactivateParentAccountsForStudent(studentId) {
    await updateJson(usersFile, [], current => current.map(user =>
      user.role === 'parent' && user.studentId === studentId ? { ...user, active: false } : user
    ))
  }

  return { bootstrapAdmin, bootstrapFixedAccounts, createAccount, login, getUserForToken, revokeToken, listAccounts, deactivateParentAccountsForStudent }
}
