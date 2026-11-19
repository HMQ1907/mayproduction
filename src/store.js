import { reactive } from 'vue'
import { rpc } from './lib/supabase'
import { presetCss } from './lib/presets'

// Tuần đang mở dùng chung cho các trang của người chơi
export const state = reactive({ week: null, loaded: false, error: '' })

export function applyTheme(week) {
  const root = document.documentElement
  root.style.setProperty('--accent', week?.color || '#f97316')
  // ảnh upload ưu tiên hơn kiểu nền có sẵn
  const img = week?.bg_image ? `url("${week.bg_image}")` : presetCss(week?.bg_preset)
  if (img) {
    root.style.setProperty('--bg-img', img)
    root.classList.add('has-bg')
  } else {
    root.style.removeProperty('--bg-img')
    root.classList.remove('has-bg')
  }
}

export async function loadActiveWeek(force = false) {
  if (state.loaded && !force) return state.week
  try {
    state.week = await rpc('get_active_week')
    state.error = ''
  } catch (e) {
    state.week = null
    state.error = e.message
  }
  state.loaded = true
  applyTheme(state.week)
  return state.week
}
