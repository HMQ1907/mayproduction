import { rpc } from './supabase'

const KEY = 'mobm_admin_token'

export function getToken() {
  try { return localStorage.getItem(KEY) } catch { return null }
}
function setToken(t) {
  try { t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY) } catch { /* ignore */ }
}

export async function adminLogin(username, password) {
  setToken(await rpc('admin_login', { p_user: username, p_pass: password }))
}

export function adminLogout() { setToken(null) }

export async function adminCheck() {
  const t = getToken()
  if (!t) return false
  try { return Boolean(await rpc('admin_check_token', { p_token: t })) } catch { return false }
}

/** Gọi RPC admin, tự gắn token. Hết phiên thì đẩy về trang đăng nhập. */
export async function adm(name, args = {}) {
  try {
    return await rpc(name, { p_token: getToken(), ...args })
  } catch (e) {
    if (e.code === 'UNAUTHORIZED') {
      setToken(null)
      location.href = '/admin/login'
    }
    throw e
  }
}
