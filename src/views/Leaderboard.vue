<script setup>
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue'
import { rpc } from '../lib/supabase'
import { loadActiveWeek } from '../store'
import { fmtDuration, fmtDate, medals, weekPhase } from '../lib/format'
import Podium from '../components/Podium.vue'

const weeks = ref([])
const weekId = ref('')
const rows = ref([])
const winners = ref([])
const tab = ref('week') // week | hall
const loading = ref(true)
const error = ref('')
const live = ref(true)
let timer = null

const current = computed(() => weeks.value.find((w) => w.id === weekId.value))
const hall = computed(() => {
  const m = new Map()
  for (const r of winners.value) {
    if (!m.has(r.week_id)) m.set(r.week_id, { ...r, list: [] })
    m.get(r.week_id).list.push(r)
  }
  return [...m.values()]
})

async function loadRows() {
  if (!weekId.value) return
  try { rows.value = await rpc('leaderboard', { p_week: weekId.value, p_limit: 200 }) } catch (e) { error.value = e.message }
}

onMounted(async () => {
  loadActiveWeek() // để áp ảnh nền của tuần đang mở
  try {
    weeks.value = await rpc('list_weeks')
    winners.value = await rpc('weekly_winners')
    const open = weeks.value.find((w) => weekPhase(w) === 'open')
    weekId.value = (open || weeks.value[0])?.id || ''
    await loadRows()
  } catch (e) { error.value = e.message }
  loading.value = false
  // tự cập nhật để mở trên màn hình lớn
  timer = setInterval(() => { if (live.value && tab.value === 'week') loadRows() }, 8000)
})
onBeforeUnmount(() => clearInterval(timer))
watch(weekId, loadRows)
</script>

<template>
  <div v-if="loading" class="spinner" />
  <template v-else>
    <div class="tabs">
      <button :class="{ on: tab === 'week' }" @click="tab = 'week'">Theo tuần</button>
      <button :class="{ on: tab === 'hall' }" @click="tab = 'hall'">🏆 Vinh danh các tuần</button>
    </div>
    <p v-if="error" class="msg err">{{ error }}</p>

    <template v-if="tab === 'week'">
      <div class="card" v-if="weeks.length">
        <div class="field">
          <label>Chọn tuần</label>
          <select v-model="weekId">
            <option v-for="w in weeks" :key="w.id" :value="w.id">
              {{ w.emoji }} {{ w.title }}{{ weekPhase(w) === 'open' ? ' (đang mở)' : '' }}
            </option>
          </select>
        </div>
        <p v-if="current?.theme" class="muted small">{{ current.theme }}</p>
        <label class="live small"><input type="checkbox" v-model="live" /> Tự cập nhật mỗi 8 giây</label>
      </div>

      <div class="card" v-if="rows.length">
        <h2>Top 3 đúng và nhanh nhất</h2>
        <Podium :rows="rows" />
      </div>

      <div class="card">
        <h2>Bảng xếp hạng</h2>
        <p v-if="!rows.length" class="muted">Chưa có ai hoàn thành tuần này.</p>
        <div v-else class="table-wrap">
          <table>
            <thead><tr><th>#</th><th>Tên</th><th class="num">Điểm</th><th class="num">Đúng</th><th class="num">Thời gian</th></tr></thead>
            <tbody>
              <tr v-for="r in rows" :key="r.rank + r.player_name">
                <td>{{ medals[r.rank - 1] || r.rank }}</td>
                <td>{{ r.player_name }}</td>
                <td class="num"><b>{{ r.score }}</b></td>
                <td class="num">{{ r.correct_count }}</td>
                <td class="num">{{ fmtDuration(r.duration_ms) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <template v-else>
      <p v-if="!hall.length" class="card muted">Chưa có dữ liệu.</p>
      <div v-for="h in hall" :key="h.week_id" class="card">
        <h2>{{ h.emoji }} {{ h.title }}</h2>
        <p class="muted small" v-if="h.theme || h.start_at">{{ h.theme }} {{ h.start_at ? '· ' + fmtDate(h.start_at) : '' }}</p>
        <Podium :rows="h.list" />
      </div>
    </template>
  </template>
</template>

<style scoped>
.tabs { display: flex; gap: 8px; margin-bottom: 14px; }
.tabs button { flex: 1; background: var(--panel); border: 1px solid var(--line); color: var(--muted); padding: 10px; border-radius: 12px; font: inherit; font-weight: 700; cursor: pointer; }
.tabs button.on { color: #fff; background: var(--accent); border-color: var(--accent); }
.live { display: flex; align-items: center; gap: 8px; color: var(--muted); font-weight: 400; }
.live input { width: auto; }
</style>
