import { reactive } from 'vue'
import { rpc } from './lib/supabase'

// Tuần đang mở dùng chung cho các trang của người chơi
export const state = reactive({ week: null, loaded: false, error: '' })

export function applyTheme(week) {
  const root = document.documentElement
  root.style.setProperty('--accent', week?.color || '#f97316')
  if (week?.bg_image) {
    root.style.setProperty('--bg-img', `url("${week.bg_image}")`)
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
