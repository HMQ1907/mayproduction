<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { adm, adminLogout } from '../../lib/admin'
import { fmtWindow, weekPhase } from '../../lib/format'
import { notify, confirmDialog } from '../../lib/notify'
import DateTimeField from '../../components/DateTimeField.vue'

const router = useRouter()
const weeks = ref([])
const loading = ref(true)
const form = ref({ title: '', theme: '', emoji: '🎃', color: '#f97316', start_at: '', end_at: '' })
const creating = ref(false)

async function load() {
  try { weeks.value = await adm('admin_list_weeks') } catch (e) { notify.error(e.message) }
  loading.value = false
}
onMounted(load)

async function create() {
  creating.value = true
  try {
    const id = await adm('admin_save_week', { p_week: { ...form.value } })
    notify.success('Đã tạo tuần mới')
    router.push(`/admin/weeks/${id}`)
  } catch (e) { notify.error(e.message) } finally { creating.value = false }
}

async function setActive(w, on) {
  try {
    await adm('admin_set_active', { p_id: w.id, p_on: on })
    notify.success(on ? 'Đã công khai tuần này' : 'Đã ẩn tuần này')
  } catch (e) { notify.error(e.message) }
  await load()
}

async function remove(w) {
  if (!(await confirmDialog(`Xóa tuần "${w.title}" cùng toàn bộ câu hỏi và kết quả?`, { title: 'Xóa tuần', confirmText: 'Xóa' }))) return
  try { await adm('admin_delete_week', { p_id: w.id }); notify.success('Đã xóa tuần') } catch (e) { notify.error(e.message) }
  await load()
}

function logout() {
  adminLogout()
  router.push('/admin/login')
}

const phaseLabel = { open: 'ĐANG MỞ', upcoming: 'SẮP MỞ', ended: 'ĐÃ KẾT THÚC' }
</script>

<template>
  <div class="between">
    <h1>Quản trị</h1>
    <div class="actions" style="margin: 0">
      <router-link to="/admin/results" class="btn sm">📊 Tổng kết quả</router-link>
      <button class="btn ghost sm" @click="logout">Đăng xuất</button>
    </div>
  </div>

  <form class="card" @submit.prevent="create">
    <h2>➕ Tạo tuần mới</h2>
    <div class="field"><label>Tên tuần</label><input v-model="form.title" placeholder="Tuần 47 - Black Friday" required /></div>
    <div class="row">
      <DateTimeField v-model="form.start_at" label="Bắt đầu" />
      <DateTimeField v-model="form.end_at" label="Kết thúc" :min-date="form.start_at || null" />
    </div>
    <div class="field"><label>Chủ đề / mô tả</label><input v-model="form.theme" placeholder="Chủ đề của tuần" /></div>
    <div class="row">
      <div class="field"><label>Hình ô (emoji)</label><input v-model="form.emoji" maxlength="4" /></div>
      <div class="field"><label>Màu chủ đạo</label><input v-model="form.color" type="color" style="padding: 4px; height: 44px" /></div>
    </div>
    <button class="btn" :disabled="creating">Tạo và thêm câu hỏi</button>
  </form>

  <div v-if="loading" class="spinner" />
  <div v-for="w in weeks" :key="w.id" class="card week">
    <h2>
      {{ w.emoji }} {{ w.title }}
      <span v-if="!w.is_active" class="badge">NHÁP</span>
      <span v-else class="badge" :class="{ live: weekPhase(w) === 'open', ok: weekPhase(w) === 'upcoming' }">{{ phaseLabel[weekPhase(w)] }}</span>
    </h2>
    <p class="muted small">⏰ {{ fmtWindow(w) }}</p>
    <p class="muted small">{{ w.theme }} · {{ w.q_total }} câu hỏi · {{ w.s_total }} lượt chơi</p>
    <div class="actions">
      <router-link :to="`/admin/weeks/${w.id}`" class="btn sm">Quản lý</router-link>
      <button v-if="!w.is_active" class="btn ghost sm" @click="setActive(w, true)">Công khai</button>
      <button v-else class="btn ghost sm" @click="setActive(w, false)">Ẩn (nháp)</button>
      <button class="btn danger sm" @click="remove(w)">Xóa</button>
    </div>
  </div>
  <p v-if="!loading && !weeks.length" class="muted center">Chưa có tuần nào. Hãy tạo tuần đầu tiên ở trên.</p>
</template>

<style scoped>
.between { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
.week h2 { margin: 0 0 4px; }
.week p { margin: 2px 0; }
</style>
