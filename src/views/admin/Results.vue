<script setup>
import { ref, computed, onMounted } from 'vue'
import { adm } from '../../lib/admin'
import { fmtDuration, fmtDateTime, medals } from '../../lib/format'
import { notify, confirmDialog } from '../../lib/notify'

const rows = ref([])
const loading = ref(true)
const tab = ref('total') // total | detail
const weekFilter = ref('')
const search = ref('')

async function load() {
  loading.value = true
  try { rows.value = await adm('admin_all_results') } catch (e) { notify.error(e.message) }
  loading.value = false
}
onMounted(load)

const weeks = computed(() => {
  const m = new Map()
  for (const r of rows.value) if (!m.has(r.week_id)) m.set(r.week_id, { id: r.week_id, title: r.week_title, emoji: r.week_emoji })
  return [...m.values()]
})

const finished = computed(() => rows.value.filter((r) => r.status === 'finished'))
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase()

// Chi tiết từng lượt chơi (có lọc tuần + tìm tên)
const detail = computed(() => {
  const q = norm(search.value.trim())
  return rows.value
    .filter((r) => (!weekFilter.value || r.week_id === weekFilter.value) && (!q || norm(r.player_name).includes(q)))
})

// Tổng hợp theo người chơi trên mọi tuần: tổng điểm cao -> tổng thời gian ít
const totals = computed(() => {
  const q = norm(search.value.trim())
  const m = new Map()
  for (const r of finished.value) {
    if (weekFilter.value && r.week_id !== weekFilter.value) continue
    const t = m.get(r.name_key) || { name: r.player_name, weeks: 0, score: 0, correct: 0, ms: 0, best: -Infinity }
    t.weeks++
    t.score += r.score
    t.correct += r.correct_count
    t.ms += r.duration_ms
    t.best = Math.max(t.best, r.score)
    m.set(r.name_key, t)
  }
  return [...m.values()]
    .filter((t) => !q || norm(t.name).includes(q))
    .sort((a, b) => b.score - a.score || a.ms - b.ms)
    .map((t, i) => ({ ...t, rank: i + 1 }))
})

async function del(r) {
  if (!(await confirmDialog(`Xóa kết quả của "${r.player_name}" (${r.week_title})? Người này sẽ được chơi lại tuần đó.`, { title: 'Xóa kết quả', confirmText: 'Xóa' }))) return
  try { await adm('admin_delete_session', { p_id: r.id }); notify.success('Đã xóa'); await load() } catch (e) { notify.error(e.message) }
}

function download(name, lines) {
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}
const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`

function exportCsv() {
  if (tab.value === 'total') {
    download('tong-ket-qua.csv', [
      'Hạng,Tên,Số tuần,Tổng điểm,Tổng câu đúng,Tổng thời gian (s),Điểm cao nhất',
      ...totals.value.map((t) => [t.rank, esc(t.name), t.weeks, t.score, t.correct, (t.ms / 1000).toFixed(1), t.best].join(',')),
    ])
  } else {
    download('chi-tiet-ket-qua.csv', [
      'Tuần,Tên,Điểm,Câu đúng,Thời gian (s),Trạng thái,Nộp lúc',
      ...detail.value.map((r) => [esc(r.week_title), esc(r.player_name), r.score, r.correct_count,
        r.duration_ms != null ? (r.duration_ms / 1000).toFixed(1) : '', r.status === 'finished' ? 'Xong' : 'Đang chơi', esc(r.finished_at)].join(',')),
    ])
  }
}
</script>

<template>
  <router-link to="/admin" class="small">← Danh sách tuần</router-link>
  <h1>📊 Tổng kết quả</h1>
  <p class="muted small">Admin xem được toàn bộ người chơi. Người chơi bên ngoài chỉ thấy top 10 của từng tuần.</p>

  <div class="stats">
    <div class="card"><span class="muted small">Lượt chơi đã xong</span><b>{{ finished.length }}</b></div>
    <div class="card"><span class="muted small">Người chơi</span><b>{{ new Set(finished.map((r) => r.name_key)).size }}</b></div>
    <div class="card"><span class="muted small">Số tuần có người chơi</span><b>{{ weeks.length }}</b></div>
  </div>

  <div class="card">
    <div class="tabs">
      <button :class="{ on: tab === 'total' }" @click="tab = 'total'">Tổng hợp theo người chơi</button>
      <button :class="{ on: tab === 'detail' }" @click="tab = 'detail'">Chi tiết từng lượt</button>
    </div>
    <div class="row">
      <div class="field">
        <label>Tuần</label>
        <select v-model="weekFilter">
          <option value="">Tất cả các tuần</option>
          <option v-for="w in weeks" :key="w.id" :value="w.id">{{ w.emoji }} {{ w.title }}</option>
        </select>
      </div>
      <div class="field"><label>Tìm theo tên</label><input v-model="search" placeholder="Nhập tên…" /></div>
      <div class="field btns">
        <button class="btn ghost sm" @click="load">Làm mới</button>
        <button class="btn ghost sm" @click="exportCsv">Xuất CSV</button>
      </div>
    </div>

    <div v-if="loading" class="spinner" />
    <template v-else-if="tab === 'total'">
      <p v-if="!totals.length" class="muted">Chưa có dữ liệu.</p>
      <div v-else class="table-wrap">
        <table>
          <thead><tr><th>#</th><th>Tên</th><th class="num">Số tuần</th><th class="num">Tổng điểm</th><th class="num">Câu đúng</th><th class="num">Tổng thời gian</th><th class="num">Cao nhất</th></tr></thead>
          <tbody>
            <tr v-for="t in totals" :key="t.name + t.rank">
              <td>{{ medals[t.rank - 1] || t.rank }}</td>
              <td>{{ t.name }}</td>
              <td class="num">{{ t.weeks }}</td>
              <td class="num"><b>{{ t.score }}</b></td>
              <td class="num">{{ t.correct }}</td>
              <td class="num">{{ fmtDuration(t.ms) }}</td>
              <td class="num">{{ t.best }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <template v-else>
      <p v-if="!detail.length" class="muted">Chưa có dữ liệu.</p>
      <div v-else class="table-wrap">
        <table>
          <thead><tr><th>Tuần</th><th>Tên</th><th class="num">Điểm</th><th class="num">Đúng</th><th class="num">Thời gian</th><th>Nộp lúc</th><th /></tr></thead>
          <tbody>
            <tr v-for="r in detail" :key="r.id">
              <td>{{ r.week_emoji }} {{ r.week_title }}</td>
              <td>{{ r.player_name }}</td>
              <td class="num"><b>{{ r.status === 'finished' ? r.score : '–' }}</b></td>
              <td class="num">{{ r.status === 'finished' ? r.correct_count : '–' }}</td>
              <td class="num">{{ fmtDuration(r.duration_ms) }}</td>
              <td>{{ r.status === 'finished' ? fmtDateTime(r.finished_at) : 'Đang chơi' }}</td>
              <td><button class="btn danger sm" @click="del(r)">Xóa</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<style scoped>
.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 14px; }
.stats .card { margin: 0; display: flex; flex-direction: column; }
.stats b { font-size: 1.8rem; color: var(--accent); }
.tabs { display: flex; gap: 8px; margin-bottom: 14px; flex-wrap: wrap; }
.tabs button { flex: 1 1 160px; background: var(--panel-2); border: 1px solid var(--line); color: var(--muted); padding: 10px; border-radius: 12px; font: inherit; font-weight: 700; cursor: pointer; }
.tabs button.on { color: #fff; background: var(--accent); border-color: var(--accent); }
.btns { display: flex; gap: 8px; align-items: flex-end; flex: 0 0 auto; }
</style>
