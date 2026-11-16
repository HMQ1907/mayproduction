// Mã nhận diện thiết bị: lưu localStorage, dùng để chặn chơi lại trong cùng một tuần.
const KEY = 'mobm_device'
const SESSION_KEY = 'mobm_sessions'

function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : 'd-' + Date.now() + '-' + Math.random().toString(36).slice(2)
}

export function deviceId() {
  try {
    let id = localStorage.getItem(KEY)
    if (!id) { id = uuid(); localStorage.setItem(KEY, id) }
    return id
  } catch { return 'volatile-' + uuid() }
}

// Nhớ phiên đang chơi theo từng tuần để tiếp tục khi tải lại trang
export function savedSession(weekId) {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || '{}')[weekId] || null } catch { return null }
}
export function saveSession(weekId, sessionId) {
  try {
    const m = JSON.parse(localStorage.getItem(SESSION_KEY) || '{}')
    m[weekId] = sessionId
    localStorage.setItem(SESSION_KEY, JSON.stringify(m))
  } catch { /* ignore */ }
}
