<script setup>
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import { useRouter } from 'vue-router'
import { rpc } from '../lib/supabase'
import { deviceId } from '../lib/device'
import { state, loadActiveWeek } from '../store'
import { fmtDateTime, fmtDuration, fmtCountdown } from '../lib/format'
import { notify } from '../lib/notify'
import { sfx } from '../lib/sound'
import Podium from '../components/Podium.vue'

const router = useRouter()
const loading = ref(true)
const name = ref('')
const error = ref('')
const busy = ref(false)
const mine = ref(null) // phiên của thiết bị này (nếu đã chơi)
const top = ref([])

const week = computed(() => state.week)

// Đồng hồ theo giờ server (không phụ thuộc giờ máy người chơi)
const now = ref(Date.now())
let offset = 0
let ticker = null
const phase = ref('open')
const msToStart = computed(() => (week.value?.start_at ? Date.parse(week.value.start_at) - now.value : 0))
const msToEnd = computed(() => (week.value?.end_at ? Date.parse(week.value.end_at) - now.value : Infinity))

function syncPhase() {
  const w = week.value
  if (!w) return
  if (w.start_at && now.value < Date.parse(w.start_at)) phase.value = 'upcoming'
  else if (w.end_at && now.value > Date.parse(w.end_at)) phase.value = 'ended'
  else phase.value = 'open'
}

async function init() {
  await loadActiveWeek(true)
  if (state.week) {
    offset = Date.parse(state.week.server_now) - Date.now()
    now.value = Date.now() + offset
    syncPhase()
  }
}

onMounted(async () => {
  await init()
  ticker = setInterval(async () => {
    now.value = Date.now() + offset
    const before = phase.value
    syncPhase()
    // vừa chuyển giai đoạn (đến giờ mở / hết giờ) -> tải lại dữ liệu
    if (before !== phase.value) { await init(); notify.info(phase.value === 'open' ? 'Đến giờ chơi rồi! 🎉' : 'Tuần chơi đã kết thúc') }
  }, 1000)
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
onBeforeUnmount(() => clearInterval(ticker))

async function start() {
  error.value = ''
  busy.value = true
  try {
    await rpc('start_session', { p_week: week.value.id, p_name: name.value, p_device: deviceId() })
    sfx.start()
    router.push('/play')
  } catch (e) {
    error.value = e.message
    notify.error(e.message)
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
        <span class="badge" :class="{ live: phase === 'open' }">
          {{ phase === 'open' ? 'ĐANG MỞ' : phase === 'upcoming' ? 'SẮP MỞ' : 'ĐÃ KẾT THÚC' }}
        </span>
        <h1>{{ week.title }}</h1>
        <p class="muted" v-if="week.theme">{{ week.theme }}</p>
        <p class="muted small" v-if="week.start_at || week.end_at">
          ⏰ {{ week.start_at ? fmtDateTime(week.start_at) : '…' }} → {{ week.end_at ? fmtDateTime(week.end_at) : '…' }}
        </p>
        <div v-if="phase === 'upcoming'" class="countdown">
          <span class="muted small">Mở sau</span>
          <b>{{ fmtCountdown(msToStart) }}</b>
        </div>
        <div v-else-if="phase === 'open' && msToEnd < 86400000" class="countdown end">
          <span class="muted small">Còn lại</span>
          <b>{{ fmtCountdown(msToEnd) }}</b>
        </div>
      </section>

      <section class="card">
        <h2>Luật chơi</h2>
        <ul class="rules">
          <li>Có <b>{{ week.total_cells }}</b> ô bí ẩn, bạn được mở <b>{{ week.turns }}</b> ô.</li>
          <li>✅ Trả lời đúng: <b>+{{ week.points }}</b> điểm (trắc nghiệm {{ week.mcq_seconds }}s, nhập chữ {{ week.text_seconds }}s). Sai hoặc hết giờ: không trừ điểm.<template v-if="!week.show_feedback"> Kết quả đúng/sai và điểm sẽ được công bố khi bạn mở xong lượt cuối.</template></li>
          <li>🎁 Ô thưởng: <b>+{{ week.points }}</b> &nbsp; 💣 Ô BOOM: <b>−{{ week.points }}</b></li>
          <li>Xếp hạng theo điểm, bằng điểm thì ai hoàn thành nhanh hơn đứng trước.</li>
          <li>Mỗi người chỉ chơi <b>1 lần mỗi tuần</b> (chặn theo tên và thiết bị).</li>
        </ul>
      </section>

      <section class="card" v-if="mine?.status === 'playing'">
        <h2>Bạn đang chơi dở, {{ mine.player_name }}</h2>
        <p class="muted">Đã mở {{ mine.opened.length }}/{{ mine.turns }} ô<template v-if="mine.score != null"> · {{ mine.score }} điểm</template></p>
        <router-link to="/play" class="btn block">Tiếp tục chơi</router-link>
      </section>

      <section class="card center" v-else-if="mine?.status === 'finished'">
        <h2>Bạn đã chơi tuần này 🎉</h2>
        <p class="score-big">{{ mine.score }} <small>điểm</small></p>
        <p class="muted">{{ mine.correct_count }} câu đúng · {{ fmtDuration(mine.duration_ms) }}</p>
        <router-link to="/leaderboard" class="btn">Xem bảng xếp hạng</router-link>
      </section>

      <section class="card center" v-else-if="phase === 'upcoming'">
        <h2>⏳ Chưa đến giờ chơi</h2>
        <p class="muted">Quay lại lúc <b>{{ fmtDateTime(week.start_at) }}</b> nhé. Trang sẽ tự mở khi đến giờ.</p>
      </section>

      <section class="card center" v-else-if="phase === 'ended'">
        <h2>🔒 Tuần chơi đã kết thúc</h2>
        <p class="muted">Xem kết quả và top 3 ở bảng xếp hạng nhé.</p>
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
.countdown { margin-top: 12px; display: inline-flex; flex-direction: column; background: var(--panel-2); border: 1px solid var(--line); border-radius: 14px; padding: 8px 20px; }
.countdown b { font-size: clamp(1.4rem, 7vw, 2rem); color: var(--accent); font-variant-numeric: tabular-nums; }
.countdown.end b { color: var(--bad); }
.rules { padding-left: 20px; margin: 0; }
.rules li { margin-bottom: 6px; }
.score-big { font-size: 3rem; font-weight: 800; color: var(--accent); margin: 4px 0; }
.score-big small { font-size: 1rem; color: var(--muted); font-weight: 600; }
</style>
