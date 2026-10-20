import { API_URL } from './apiConfig'

const TOKEN_KEY = 'schoolid-auth-token'
const USER_KEY = 'schoolid-auth-user'

export const getAuthToken = () => localStorage.getItem(TOKEN_KEY) || ''
export const getAuthUser = () => {
  try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null') } catch { return null }
}
const clearUserCache = () => {
  for (const key of Object.keys(localStorage)) if (key.startsWith('school-')) localStorage.removeItem(key)
}
export const saveAuthSession = ({ token, user }) => {
  if (getAuthUser()?.id !== user.id) clearUserCache()
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}
export const clearAuthSession = () => {
  clearUserCache()
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}
export const socketAuthOptions = () => ({ auth: { token: getAuthToken() } })

export async function signIn(email, password) {
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Could not sign in.')
  saveAuthSession(result)
  return result.user
}

export async function createAccount(account) {
  const response = await fetch(`${API_URL}/api/admin/accounts`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(account),
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Could not create account.')
  return result
}
