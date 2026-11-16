<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { rpc } from '../lib/supabase'
import { deviceId } from '../lib/device'
import { state, loadActiveWeek } from '../store'
import { fmtDate, fmtDuration } from '../lib/format'
import Podium from '../components/Podium.vue'

const router = useRouter()
const loading = ref(true)
const name = ref('')
const error = ref('')
const busy = ref(false)
const mine = ref(null) // phiên của thiết bị này (nếu đã chơi)
const top = ref([])

const week = computed(() => state.week)

onMounted(async () => {
  await loadActiveWeek(true)
  if (state.week) {
    try {
      const [m, t] = await Promise.all([
        rpc('my_session', { p_week: state.week.id, p_device: deviceId() }),
        rpc('leaderboard', { p_week: state.week.id, p_limit: 3 }),
      ])
      mine.value = m
      top.value = t
    } catch (e) { error.value = e.message }
  }
  loading.value = false
})

async function start() {
  error.value = ''
  busy.value = true
  try {
    await rpc('start_session', { p_week: week.value.id, p_name: name.value, p_device: deviceId() })
    router.push('/play')
  } catch (e) {
    error.value = e.message
  } finally { busy.value = false }
}
</script>

<template>
  <div v-if="loading" class="spinner" />

  <template v-else>
    <div v-if="!week" class="card center">
      <div style="font-size:3rem">😴</div>
      <h2>Chưa có tuần chơi nào đang mở</h2>
      <p class="muted">{{ state.error || 'Quay lại sau nhé, ban tổ chức sẽ mở game sớm thôi!' }}</p>
      <router-link to="/leaderboard" class="btn ghost">Xem bảng xếp hạng</router-link>
    </div>

    <template v-else>
      <section class="hero card">
        <div class="emoji">{{ week.emoji }}</div>
        <span class="badge live">ĐANG MỞ</span>
        <h1>{{ week.title }}</h1>
        <p class="muted" v-if="week.theme">{{ week.theme }}</p>
        <p class="muted small" v-if="week.week_start">Tuần bắt đầu {{ fmtDate(week.week_start) }}</p>
      </section>

      <section class="card">
        <h2>Luật chơi</h2>
        <ul class="rules">
          <li>Có <b>{{ week.total_cells }}</b> ô bí ẩn, bạn được mở <b>{{ week.turns }}</b> ô.</li>
          <li>✅ Trả lời đúng: <b>+{{ week.points }}</b> điểm (trắc nghiệm {{ week.mcq_seconds }}s, nhập chữ {{ week.text_seconds }}s). Sai hoặc hết giờ: không trừ điểm.</li>
          <li>🎁 Ô thưởng: <b>+{{ week.points }}</b> &nbsp; 💣 Ô BOOM: <b>−{{ week.points }}</b></li>
          <li>Xếp hạng theo điểm, bằng điểm thì ai hoàn thành nhanh hơn đứng trước.</li>
          <li>Mỗi người chỉ chơi <b>1 lần mỗi tuần</b> (chặn theo tên và thiết bị).</li>
        </ul>
      </section>

      <section class="card" v-if="mine?.status === 'playing'">
        <h2>Bạn đang chơi dở, {{ mine.player_name }}</h2>
        <p class="muted">Đã mở {{ mine.opened.length }}/{{ mine.turns }} ô · {{ mine.score }} điểm</p>
        <router-link to="/play" class="btn block">Tiếp tục chơi</router-link>
      </section>

      <section class="card center" v-else-if="mine?.status === 'finished'">
        <h2>Bạn đã chơi tuần này 🎉</h2>
        <p class="score-big">{{ mine.score }} <small>điểm</small></p>
        <p class="muted">{{ mine.correct_count }} câu đúng · {{ fmtDuration(mine.duration_ms) }}</p>
        <router-link to="/leaderboard" class="btn">Xem bảng xếp hạng</router-link>
      </section>

      <section class="card" v-else>
        <h2>Bắt đầu</h2>
        <div class="field">
          <label for="pname">Họ tên đầy đủ (để không bị trùng)</label>
          <input id="pname" v-model="name" maxlength="60" placeholder="Nguyễn Văn A" autocomplete="name" @keyup.enter="start" />
        </div>
        <p v-if="error" class="msg err">{{ error }}</p>
        <button class="btn block" :disabled="busy || name.trim().length < 2" @click="start">
          {{ busy ? 'Đang tạo bảng…' : 'Bắt đầu chơi' }}
        </button>
      </section>

      <section class="card" v-if="top.length">
        <h2>🏆 Top 3 tuần này</h2>
        <Podium :rows="top" />
        <router-link to="/leaderboard">Xem đầy đủ →</router-link>
      </section>
    </template>
  </template>
</template>

<style scoped>
.hero { text-align: center; }
.hero .emoji { font-size: 3.5rem; }
.hero h1 { font-size: 1.6rem; margin-top: 8px; }
.rules { padding-left: 20px; margin: 0; }
.rules li { margin-bottom: 6px; }
.score-big { font-size: 3rem; font-weight: 800; color: var(--accent); margin: 4px 0; }
.score-big small { font-size: 1rem; color: var(--muted); font-weight: 600; }
</style>
