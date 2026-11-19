<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { rpc } from '../lib/supabase'
import { deviceId } from '../lib/device'
import { state, loadActiveWeek } from '../store'
import { fmtDuration, medals } from '../lib/format'
import { sfx, bgm } from '../lib/sound'
import { notify } from '../lib/notify'
import Podium from '../components/Podium.vue'

const router = useRouter()
const sess = ref(null)
const loading = ref(true)
const error = ref('')
const busy = ref(false)
const overlay = ref(null) // { kind: 'bonus' | 'boom' | 'feedback', ... } tự đóng sau ít giây
const timeLeft = ref(0)
const textAnswer = ref('')
const picked = ref('')
const board = ref([])
const myRank = ref(null)
let timer = null
let overlayTimer = null
let deadline = 0
let submitting = false
let lastTick = -1

const week = computed(() => state.week)
const showFeedback = computed(() => Boolean(week.value?.show_feedback))
const emoji = computed(() => week.value?.emoji || '🎁')
const pending = computed(() => sess.value?.pending || null)
const finished = computed(() => sess.value?.status === 'finished')
const turnsLeft = computed(() => (sess.value ? sess.value.turns - sess.value.opened.length : 0))
const cols = computed(() => Math.ceil(Math.sqrt(sess.value?.total || 16)))
const cells = computed(() => {
  const map = new Map((sess.value?.opened || []).map((o) => [o.i, o]))
  return Array.from({ length: sess.value?.total || 0 }, (_, i) => map.get(i) || null)
})
const showQuestion = computed(() => pending.value && !overlay.value)
const showResult = computed(() => finished.value && !overlay.value)
const timePct = computed(() => (pending.value ? Math.max(0, (timeLeft.value / pending.value.seconds) * 100) : 0))

onMounted(async () => {
  try {
    await loadActiveWeek()
    if (!state.week) return router.replace('/')
    const s = await rpc('my_session', { p_week: state.week.id, p_device: deviceId() })
    if (!s) return router.replace('/')
    sess.value = s
    startMusic()
  } catch (e) { error.value = e.message }
  loading.value = false
})
// Nhạc nền riêng của tuần (nếu có) tải riêng, nếu lỗi hoặc chưa có thì dùng nhạc tự tạo
async function startMusic() {
  let src = null
  if (state.week?.has_bgm) {
    try { src = await rpc('get_week_music', { p_week: state.week.id }) } catch { /* dùng nhạc tự tạo */ }
  }
  if (!gone) bgm.start(src)
}
let gone = false
onBeforeUnmount(() => {
  gone = true
  stopTimer()
  clearTimeout(overlayTimer)
  bgm.stop()
})

// Chạy đồng hồ mỗi khi có câu hỏi mới
watch(pending, (p, old) => {
  if (!p) return stopTimer()
  if (old && old.i === p.i) return
  textAnswer.value = ''
  picked.value = ''
  submitting = false
  lastTick = -1
  deadline = Date.now() + p.remaining * 1000
  stopTimer()
  tick()
  timer = setInterval(tick, 100)
})

// Hết game: tải bảng điểm (top 10) và hạng của chính mình
watch(showResult, async (v) => {
  if (!v) return
  sfx.finish()
  try {
    const [b, r] = await Promise.all([
      rpc('leaderboard', { p_week: sess.value.week_id, p_limit: 10 }),
      rpc('my_rank', { p_session: sess.value.id, p_device: deviceId() }),
    ])
    board.value = b
    myRank.value = r
  } catch { /* không quan trọng */ }
})

function stopTimer() { if (timer) clearInterval(timer); timer = null }
function tick() {
  const left = Math.max(0, (deadline - Date.now()) / 1000)
  timeLeft.value = left
  const sec = Math.ceil(left)
  if (sec <= 5 && sec > 0 && sec !== lastTick) { lastTick = sec; sfx.tick() }
  if (left <= 0) { stopTimer(); submit('') }
}

function showOverlay(o, ms = 1700) {
  clearTimeout(overlayTimer)
  overlay.value = o
  overlayTimer = setTimeout(closeOverlay, ms)
}
function closeOverlay() { clearTimeout(overlayTimer); overlay.value = null }

async function openCell(i) {
  if (busy.value || pending.value || overlay.value || finished.value || cells.value[i]) return
  busy.value = true
  error.value = ''
  sfx.open()
  try {
    const r = await rpc('open_cell', { p_session: sess.value.id, p_device: deviceId(), p_idx: i })
    sess.value = r.session
    if (r.kind === 'bonus') { sfx.bonus(); showOverlay({ kind: 'bonus', delta: r.delta }) }
    else if (r.kind === 'boom') { sfx.boom(); showOverlay({ kind: 'boom', delta: r.delta }) }
  } catch (e) { error.value = e.message } finally { busy.value = false }
}

async function submit(answer) {
  if (submitting || !pending.value) return
  submitting = true
  stopTimer()
  picked.value = answer
  if (answer) sfx.select()
  try {
    const r = await rpc('answer_question', { p_session: sess.value.id, p_device: deviceId(), p_answer: answer })
    sess.value = r.session
    if (!answer) sfx.timeout()
    if (showFeedback.value) {
      // chỉ hiện nhanh rồi tự quay lại bảng, không có bước "chọn ô tiếp theo"
      if (answer) (r.ok ? sfx.correct : sfx.wrong)()
      showOverlay({ kind: 'feedback', ok: r.ok, delta: r.delta, correct: r.correct_answer, timeout: !answer }, 1500)
    } else if (!answer) {
      notify.info('⏰ Hết giờ!')
    }
  } catch (e) {
    error.value = e.message
    submitting = false
  }
}
</script>

<template>
  <div v-if="loading" class="spinner" />
  <p v-else-if="error && !sess" class="msg err">{{ error }}</p>

  <template v-else-if="sess">
    <!-- Thanh trạng thái -->
    <div class="hud card">
      <div><span class="muted small">Người chơi</span><b>{{ sess.player_name }}</b></div>
      <div><span class="muted small">Lượt còn lại</span><b>{{ turnsLeft }}</b></div>
      <div><span class="muted small">Điểm</span><b class="score">{{ sess.score ?? '?' }}</b></div>
    </div>

    <p v-if="error" class="msg err">{{ error }}</p>

    <!-- Bảng ô -->
    <div class="grid" :style="{ gridTemplateColumns: `repeat(${cols}, 1fr)` }">
      <button
        v-for="(c, i) in cells"
        :key="i"
        class="cell"
        :class="{
          opened: c,
          good: c && (c.t === 'bonus' || c.ok === true),
          bad: c && (c.t === 'boom' || c.ok === false),
        }"
        :disabled="!!c || busy || finished"
        @click="openCell(i)"
      >
        <template v-if="!c">{{ emoji }}</template>
        <template v-else-if="c.t === 'bonus'">🎁<small>+{{ c.delta }}</small></template>
        <template v-else-if="c.t === 'boom'">💣<small>{{ c.delta }}</small></template>
        <template v-else-if="c.ok === true">✅<small>+{{ c.delta }}</small></template>
        <template v-else-if="c.ok === false">❌<small>0</small></template>
        <template v-else>📝<small>Đã trả lời</small></template>
      </button>
    </div>
    <p class="muted center small" v-if="!finished">Chạm vào một ô để mở. Ô đã mở không thể mở lại.</p>

    <!-- Câu hỏi -->
    <div v-if="showQuestion" class="modal">
      <div class="sheet">
        <div class="timebar"><i :style="{ width: timePct + '%' }" :class="{ low: timeLeft <= 5 }" /></div>
        <div class="between">
          <span class="badge" :class="{ text: pending.type === 'text' }">{{ pending.type === 'text' ? 'Nhập chữ' : 'Trắc nghiệm' }}</span>
          <b class="clock" :class="{ low: timeLeft <= 5 }">{{ Math.ceil(timeLeft) }}s</b>
        </div>
        <h2 class="qtext">{{ pending.content }}</h2>
        <img v-if="pending.image_url" :src="pending.image_url" class="qimg" alt="" />

        <div v-if="pending.type === 'mcq'" class="opts">
          <button
            v-for="(o, k) in pending.options"
            :key="o"
            class="opt"
            :class="{ picked: picked === o }"
            :disabled="!!picked"
            @click="submit(o)"
          >
            <span class="letter">{{ 'ABCD'[k] }}</span>{{ o }}
          </button>
        </div>

        <form v-else class="textform" @submit.prevent="submit(textAnswer)">
          <input v-model="textAnswer" placeholder="Nhập đáp án…" autocomplete="off" autofocus />
          <button class="btn block" :disabled="!textAnswer.trim() || !!picked">Gửi đáp án</button>
        </form>
      </div>
    </div>

    <!-- Kết quả nhanh (BONUS / BOOM / đúng-sai nếu tuần bật): tự đóng, chạm để đóng sớm -->
    <div v-if="overlay" class="modal" @click="closeOverlay">
      <div class="sheet pop center">
        <template v-if="overlay.kind === 'bonus'">
          <div class="big">🎁</div>
          <h2>BONUS! +{{ overlay.delta }}</h2>
          <p class="muted">{{ week?.bonus_msg }}</p>
        </template>
        <template v-else-if="overlay.kind === 'boom'">
          <div class="big">💣</div>
          <h2 style="color: var(--bad)">BOOM! {{ overlay.delta }}</h2>
          <p class="muted">{{ week?.boom_msg }}</p>
        </template>
        <template v-else>
          <div class="big">{{ overlay.ok ? '✅' : overlay.timeout ? '⏰' : '❌' }}</div>
          <h2 :style="{ color: overlay.ok ? 'var(--good)' : 'var(--bad)' }">
            {{ overlay.ok ? `Chính xác! +${overlay.delta}` : overlay.timeout ? 'Hết giờ!' : 'Chưa đúng rồi!' }}
          </h2>
          <p v-if="!overlay.ok" class="muted">Đáp án đúng: <b>{{ overlay.correct }}</b></p>
        </template>
      </div>
    </div>

    <!-- Kết thúc -->
    <div v-if="showResult" class="modal">
      <div class="sheet center">
        <div class="big">🏁</div>
        <h2>Hoàn thành, {{ sess.player_name }}!</h2>
        <p class="score-big">{{ sess.score }} <small>điểm</small></p>
        <p class="muted">{{ sess.correct_count }} câu đúng · {{ fmtDuration(sess.duration_ms) }}</p>
        <p v-if="myRank" class="rank">
          Hạng của bạn: <b>{{ medals[myRank.rank - 1] || '#' + myRank.rank }}</b> / {{ myRank.total }}
        </p>
        <Podium :rows="board" />
        <router-link to="/leaderboard" class="btn block">Xem bảng xếp hạng</router-link>
      </div>
    </div>
  </template>
</template>

<style scoped>
.hud { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 8px; padding: 12px 16px; max-width: 520px; margin: 0 auto 14px; }
@media (max-width: 380px) { .hud { padding: 10px 12px; } .hud .score { font-size: 1.2rem; } }
.hud div { display: flex; flex-direction: column; min-width: 0; }
.hud b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 1.05rem; }
.hud .score { color: var(--accent); font-size: 1.4rem; }

.grid { display: grid; gap: clamp(8px, 2.5vw, 14px); margin: 14px auto; max-width: 520px; }
.cell {
  aspect-ratio: 1; border-radius: 16px; border: 2px solid var(--line); background: var(--panel-2);
  font-size: clamp(1.8rem, 9vw, 3rem); display: flex; flex-direction: column; align-items: center; justify-content: center;
  cursor: pointer; transition: transform .12s, border-color .15s; color: var(--text); padding: 0;
}
.cell:not(:disabled):hover { transform: translateY(-3px) scale(1.04); border-color: var(--accent); }
.cell:not(:disabled):active { transform: scale(.95); }
.cell small { font-size: .8rem; font-weight: 800; }
.cell.opened { cursor: default; background: var(--panel); }
.cell.good { border-color: var(--good); }
.cell.bad { border-color: var(--bad); }
.cell:disabled { opacity: 1; }

.modal { position: fixed; inset: 0; background: rgba(0,0,0,.72); display: flex; align-items: flex-end; justify-content: center; z-index: 50; padding: 0; }
@media (min-width: 640px) { .modal { align-items: center; padding: 16px; } }
.sheet {
  background: var(--panel); border: 1px solid var(--line); width: 100%; max-width: 560px; max-height: 92vh; max-height: 92dvh; overflow-y: auto; overscroll-behavior: contain;
  border-radius: 22px 22px 0 0; padding: 20px 18px calc(20px + env(safe-area-inset-bottom));
}
@media (min-width: 640px) { .sheet { border-radius: 22px; } }
.pop { animation: pop .22s ease-out; }
@keyframes pop { from { transform: scale(.85); opacity: 0; } to { transform: scale(1); opacity: 1; } }
.big { font-size: 3.6rem; }
.between { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.clock { font-size: 1.4rem; font-variant-numeric: tabular-nums; }
.clock.low { color: var(--bad); }
.timebar { height: 6px; background: var(--panel-2); border-radius: 99px; overflow: hidden; margin-bottom: 12px; }
.timebar i { display: block; height: 100%; background: var(--accent); transition: width .1s linear; }
.timebar i.low { background: var(--bad); }
.qtext { font-size: 1.2rem; margin: 6px 0 12px; }
.qimg { width: 100%; max-height: 260px; object-fit: contain; border-radius: 12px; background: #000; margin-bottom: 12px; }
.opts { display: grid; gap: 8px; }
.opt {
  display: flex; align-items: center; gap: 12px; text-align: left; width: 100%;
  background: var(--panel-2); border: 2px solid var(--line); color: var(--text); font: inherit; font-weight: 600;
  padding: 13px 14px; border-radius: 12px; cursor: pointer;
}
.opt:not(:disabled):hover { border-color: var(--accent); }
.opt.picked { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 18%, var(--panel-2)); }
.letter { width: 28px; height: 28px; flex: none; border-radius: 8px; background: var(--line); display: grid; place-items: center; font-size: .85rem; }
.textform { display: grid; gap: 10px; }
.score-big { font-size: 3rem; font-weight: 800; color: var(--accent); margin: 4px 0; }
.score-big small { font-size: 1rem; color: var(--muted); font-weight: 600; }
.rank { margin: 0 0 8px; }
.sheet .btn { margin-top: 14px; }
</style>
