import { reactive } from 'vue'
import { rpc } from './lib/supabase'

// Tuần đang mở dùng chung cho các trang của người chơi
export const state = reactive({ week: null, loaded: false, error: '' })

export function applyTheme(color) {
  document.documentElement.style.setProperty('--accent', color || '#f97316')
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
  applyTheme(state.week?.color)
  return state.week
}
