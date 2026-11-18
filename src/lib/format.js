export function fmtDuration(ms) {
  if (ms == null) return '–'
  const s = ms / 1000
  const m = Math.floor(s / 60)
  if (m > 0) return `${m}p ${(s - m * 60).toFixed(1)}s`
  return `${s.toFixed(1)}s`
}

export function fmtDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/** 14:00 · 18/11/2026 */
export function fmtDateTime(d) {
  if (!d) return ''
  const x = new Date(d)
  const hm = x.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })
  return `${hm} · ${fmtDate(x)}`
}

/** Khung giờ hiển thị gọn: "14:00 · 18/11/2026 → 17:00 · 20/11/2026" */
export function fmtWindow(w) {
  if (!w.start_at && !w.end_at) return 'Không giới hạn thời gian'
  return `${w.start_at ? fmtDateTime(w.start_at) : '…'} → ${w.end_at ? fmtDateTime(w.end_at) : '…'}`
}

/** open | upcoming | ended theo giờ của máy (dùng cho trang admin) */
export function weekPhase(w, now = Date.now()) {
  if (w.start_at && now < Date.parse(w.start_at)) return 'upcoming'
  if (w.end_at && now > Date.parse(w.end_at)) return 'ended'
  return 'open'
}

/** 2 ngày 03:15:09 */
export function fmtCountdown(ms) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const d = Math.floor(s / 86400)
  const h = String(Math.floor((s % 86400) / 3600)).padStart(2, '0')
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  const sec = String(s % 60).padStart(2, '0')
  return `${d > 0 ? d + ' ngày ' : ''}${h}:${m}:${sec}`
}

export const medals = ['🥇', '🥈', '🥉']
