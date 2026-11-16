<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { adm } from '../../lib/admin'
import { parseQuestionFile, sampleCsv } from '../../lib/importer'
import { fmtDuration } from '../../lib/format'

const route = useRoute()
const id = route.params.id
const week = ref(null)
const questions = ref([])
const sessions = ref([])
const error = ref('')
const info = ref('')

// --- import
const preview = ref(null) // { questions, errors, fileName }
const mode = ref('append')
const importing = ref(false)

const totalCells = computed(() => (week.value ? week.value.q_count + week.value.bonus_count + week.value.boom_count : 0))
const configError = computed(() => {
  if (!week.value) return ''
  if (week.value.turns > totalCells.value) return `Số lượt mở (${week.value.turns}) lớn hơn tổng số ô (${totalCells.value}).`
  if (questions.value.length < week.value.q_count) return `Cần ít nhất ${week.value.q_count} câu hỏi (hiện có ${questions.value.length}). Nên chuẩn bị nhiều hơn để mỗi người nhận bộ câu khác nhau.`
  return ''
})

async function load() {
  try {
    const d = await adm('admin_get_week', { p_id: id })
    week.value = d.week
    questions.value = d.questions
    sessions.value = d.sessions
  } catch (e) { error.value = e.message }
}
onMounted(load)

async function saveSettings() {
  error.value = info.value = ''
  try {
    await adm('admin_save_week', { p_week: { ...week.value, week_start: week.value.week_start || '' } })
    info.value = 'Đã lưu cấu hình.'
  } catch (e) { error.value = e.message }
}

function downloadTemplate() {
  const blob = new Blob([sampleCsv()], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'mau-cau-hoi.csv'
  a.click()
  URL.revokeObjectURL(a.href)
}

async function onFile(ev) {
  error.value = info.value = ''
  preview.value = null
  const f = ev.target.files?.[0]
  if (!f) return
  try {
    const r = await parseQuestionFile(f)
    preview.value = { ...r, fileName: f.name }
  } catch (e) { error.value = e.message }
  ev.target.value = ''
}

async function doImport() {
  if (!preview.value?.questions.length) return
  importing.value = true
  error.value = info.value = ''
  try {
    const n = await adm('admin_import_questions', { p_week: id, p_mode: mode.value, p_questions: preview.value.questions })
    info.value = `Đã import ${n} câu hỏi.`
    preview.value = null
    await load()
  } catch (e) { error.value = e.message } finally { importing.value = false }
}

async function delQuestion(q) {
  if (!confirm('Xóa câu hỏi này?')) return
  try { await adm('admin_delete_question', { p_id: q.id }) } catch (e) { error.value = e.message }
  await load()
}

async function delSession(s) {
  if (!confirm(`Xóa kết quả của "${s.player_name}"? Người này sẽ được chơi lại.`)) return
  try { await adm('admin_delete_session', { p_id: s.id }) } catch (e) { error.value = e.message }
  await load()
}

async function clearSessions() {
  if (!confirm('Xóa TOÀN BỘ kết quả của tuần này (dùng để xóa lượt chạy thử)?')) return
  try { await adm('admin_clear_sessions', { p_week: id }) } catch (e) { error.value = e.message }
  await load()
}

function exportResults() {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const finished = sessions.value.filter((s) => s.status === 'finished')
  const lines = [['Hạng', 'Tên', 'Điểm', 'Câu đúng', 'Thời gian (s)', 'Nộp lúc'].join(',')]
  finished.forEach((s, i) =>
    lines.push([i + 1, esc(s.player_name), s.score, s.correct_count, (s.duration_ms / 1000).toFixed(1), esc(s.finished_at)].join(',')))
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `ket-qua-${week.value.title}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}
</script>

<template>
  <router-link to="/admin" class="small">← Danh sách tuần</router-link>
  <div v-if="!week" class="spinner" />
  <template v-else>
    <h1>{{ week.emoji }} {{ week.title }}</h1>
    <p v-if="error" class="msg err">{{ error }}</p>
    <p v-if="info" class="msg ok">{{ info }}</p>
    <p v-if="configError" class="msg err">⚠️ {{ configError }}</p>

    <!-- 1. Import -->
    <section class="card">
      <h2>1. Import bộ câu hỏi và đáp án</h2>
      <p class="muted small">
        File <b>.xlsx</b> hoặc <b>.csv</b> có các cột: <code>Loại</code> (Trắc nghiệm / Nhập chữ), <code>Câu hỏi</code>,
        <code>Đáp án A–D</code>, <code>Đáp án đúng</code> (A/B/C/D; với câu nhập chữ ghi đáp án, nhiều đáp án chấp nhận ngăn cách bằng <code>|</code>),
        <code>Ảnh (link)</code> (dùng cho đuổi hình bắt chữ). Câu nhập chữ không phân biệt hoa thường và dấu.
      </p>
      <div class="row" style="align-items: end">
        <div class="field"><label>Chọn file</label><input type="file" accept=".xlsx,.csv" @change="onFile" /></div>
        <div class="field"><label>Cách nhập</label>
          <select v-model="mode">
            <option value="append">Thêm vào bộ câu hiện có</option>
            <option value="replace">Thay thế toàn bộ câu hỏi cũ</option>
          </select>
        </div>
        <div class="field" style="flex: 0 0 auto"><button class="btn ghost" @click="downloadTemplate">⬇ File mẫu</button></div>
      </div>

      <div v-if="preview" class="preview">
        <p>
          <b>{{ preview.fileName }}</b>: <span class="ok-text">{{ preview.questions.length }} câu hợp lệ</span>
          <span v-if="preview.errors.length" class="bad-text"> · {{ preview.errors.length }} dòng lỗi (sẽ bị bỏ qua)</span>
        </p>
        <ul v-if="preview.errors.length" class="errs">
          <li v-for="e in preview.errors" :key="e.row">Dòng {{ e.row }}: {{ e.msg }}</li>
        </ul>
        <div class="table-wrap" v-if="preview.questions.length">
          <table>
            <thead><tr><th>#</th><th>Loại</th><th>Câu hỏi</th><th>Đáp án đúng</th></tr></thead>
            <tbody>
              <tr v-for="(q, i) in preview.questions.slice(0, 50)" :key="i">
                <td>{{ i + 1 }}</td>
                <td><span class="badge" :class="{ text: q.type === 'text' }">{{ q.type === 'text' ? 'Nhập chữ' : 'Trắc nghiệm' }}</span></td>
                <td>{{ q.content }}<br /><span v-if="q.options" class="muted small">{{ q.options.join(' · ') }}</span></td>
                <td>{{ q.answer.replace(/\|/g, ' / ') }}</td>
              </tr>
            </tbody>
          </table>
          <p v-if="preview.questions.length > 50" class="muted small">… và {{ preview.questions.length - 50 }} câu nữa</p>
        </div>
        <button class="btn" :disabled="importing || !preview.questions.length" @click="doImport">
          {{ importing ? 'Đang import…' : `Import ${preview.questions.length} câu` }}
        </button>
      </div>
    </section>

    <!-- 2. Cấu hình -->
    <form class="card" @submit.prevent="saveSettings">
      <h2>2. Cấu hình tuần</h2>
      <div class="row">
        <div class="field" style="flex: 3 1 220px"><label>Tên tuần</label><input v-model="week.title" required /></div>
        <div class="field"><label>Ngày bắt đầu</label><input v-model="week.week_start" type="date" /></div>
      </div>
      <div class="field"><label>Chủ đề / mô tả</label><input v-model="week.theme" /></div>
      <div class="row">
        <div class="field"><label>Hình ô (emoji)</label><input v-model="week.emoji" maxlength="4" /></div>
        <div class="field"><label>Màu chủ đạo</label><input v-model="week.color" type="color" style="padding: 4px; height: 44px" /></div>
      </div>
      <div class="row">
        <div class="field"><label>Số câu hỏi trên bảng</label><input v-model.number="week.q_count" type="number" min="1" /></div>
        <div class="field"><label>Số ô BONUS</label><input v-model.number="week.bonus_count" type="number" min="0" /></div>
        <div class="field"><label>Số ô BOOM</label><input v-model.number="week.boom_count" type="number" min="0" /></div>
        <div class="field"><label>Số lượt mở</label><input v-model.number="week.turns" type="number" min="1" /></div>
      </div>
      <div class="row">
        <div class="field"><label>Điểm mỗi lần (+/−)</label><input v-model.number="week.points" type="number" min="1" /></div>
        <div class="field"><label>Giây / câu trắc nghiệm</label><input v-model.number="week.mcq_seconds" type="number" min="5" /></div>
        <div class="field"><label>Giây / câu nhập chữ</label><input v-model.number="week.text_seconds" type="number" min="5" /></div>
      </div>
      <p class="muted small">Tổng số ô = {{ totalCells }}. Nếu đã có người chơi, đừng đổi số ô và số lượt giữa chừng.</p>
      <div class="row">
        <div class="field"><label>Thông báo khi mở ô BONUS</label><input v-model="week.bonus_msg" /></div>
        <div class="field"><label>Thông báo khi mở ô BOOM</label><input v-model="week.boom_msg" /></div>
      </div>
      <button class="btn">Lưu cấu hình</button>
    </form>

    <!-- 3. Câu hỏi hiện có -->
    <section class="card">
      <h2>3. Câu hỏi hiện có ({{ questions.length }})</h2>
      <p v-if="!questions.length" class="muted">Chưa có câu hỏi. Hãy import ở bước 1.</p>
      <div v-else class="table-wrap">
        <table>
          <thead><tr><th>#</th><th>Loại</th><th>Câu hỏi</th><th>Đáp án đúng</th><th /></tr></thead>
          <tbody>
            <tr v-for="(q, i) in questions" :key="q.id">
              <td>{{ i + 1 }}</td>
              <td><span class="badge" :class="{ text: q.type === 'text' }">{{ q.type === 'text' ? 'Chữ' : 'TN' }}</span></td>
              <td>
                {{ q.content }}
                <a v-if="q.image_url" :href="q.image_url" target="_blank" rel="noopener">🖼</a>
                <br /><span v-if="q.options" class="muted small">{{ q.options.join(' · ') }}</span>
              </td>
              <td>{{ q.answer.replace(/\|/g, ' / ') }}</td>
              <td><button class="btn danger sm" @click="delQuestion(q)">Xóa</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- 4. Kết quả -->
    <section class="card">
      <div class="between">
        <h2>4. Kết quả người chơi ({{ sessions.length }})</h2>
        <div class="actions">
          <button class="btn ghost sm" @click="load">Làm mới</button>
          <button class="btn ghost sm" @click="exportResults">Xuất CSV</button>
          <button class="btn danger sm" :disabled="!sessions.length" @click="clearSessions">Xóa tất cả</button>
        </div>
      </div>
      <p v-if="!sessions.length" class="muted">Chưa có ai chơi.</p>
      <div v-else class="table-wrap">
        <table>
          <thead><tr><th>#</th><th>Tên</th><th class="num">Điểm</th><th class="num">Đúng</th><th class="num">Thời gian</th><th>Trạng thái</th><th /></tr></thead>
          <tbody>
            <tr v-for="(s, i) in sessions" :key="s.id">
              <td>{{ i + 1 }}</td>
              <td>{{ s.player_name }}</td>
              <td class="num"><b>{{ s.score }}</b></td>
              <td class="num">{{ s.correct_count }}</td>
              <td class="num">{{ fmtDuration(s.duration_ms) }}</td>
              <td><span class="badge" :class="{ ok: s.status === 'finished' }">{{ s.status === 'finished' ? 'Xong' : 'Đang chơi' }}</span></td>
              <td><button class="btn danger sm" @click="delSession(s)">Xóa</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </template>
</template>

<style scoped>
.between { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; }
.actions { display: flex; gap: 8px; flex-wrap: wrap; }
.preview { margin-top: 14px; border-top: 1px solid var(--line); padding-top: 14px; }
.ok-text { color: var(--good); font-weight: 700; }
.bad-text { color: var(--bad); font-weight: 700; }
.errs { color: var(--bad); font-size: .9rem; padding-left: 20px; max-height: 160px; overflow-y: auto; }
.preview .btn { margin-top: 12px; }
</style>
