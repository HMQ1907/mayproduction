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

export const medals = ['🥇', '🥈', '🥉']
