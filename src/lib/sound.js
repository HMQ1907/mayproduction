// Âm thanh: tiếng hiệu ứng (Web Audio, tự tạo) + nhạc nền (file mp3/ogg của tuần, hoặc nhạc tự tạo nếu chưa có).
// Hai công tắc riêng: soundOn = hiệu ứng, musicOn = nhạc nền.
import { ref } from 'vue'

const K_SFX = 'mobm_sound'
const K_MUSIC = 'mobm_music'
const read = (k) => { try { return localStorage.getItem(k) !== 'off' } catch { return true } }
const write = (k, v) => { try { localStorage.setItem(k, v ? 'on' : 'off') } catch { /* ignore */ } }

export const soundOn = ref(read(K_SFX))
export const musicOn = ref(read(K_MUSIC))

let ctx = null
let master = null
let synthTimer = null
let audioEl = null
let bgmWanted = false
let step = 0

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = 0.55
    master.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

// Trình duyệt chỉ cho phát âm thanh sau cú chạm đầu tiên
if (typeof window !== 'undefined') {
  const unlock = () => { ensure(); if (bgmWanted) startMusic() }
  window.addEventListener('pointerdown', unlock, { passive: true })
  window.addEventListener('keydown', unlock)
}

function tone(freq, { at = 0, dur = 0.15, type = 'sine', vol = 0.25, to = null, music = false } = {}) {
  const c = ensure()
  if (!c || !(music ? musicOn.value : soundOn.value)) return
  const t0 = c.currentTime + at
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, t0)
  if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur)
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  o.connect(g)
  g.connect(master)
  o.start(t0)
  o.stop(t0 + dur + 0.03)
}

function noise({ at = 0, dur = 0.5, vol = 0.4 } = {}) {
  const c = ensure()
  if (!c || !soundOn.value) return
  const len = Math.floor(c.sampleRate * dur)
  const buf = c.createBuffer(1, len, c.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len)
  const src = c.createBufferSource()
  src.buffer = buf
  const f = c.createBiquadFilter()
  f.type = 'lowpass'
  f.frequency.value = 900
  const g = c.createGain()
  g.gain.value = vol
  src.connect(f)
  f.connect(g)
  g.connect(master)
  src.start(c.currentTime + at)
}

export const sfx = {
  start: () => { tone(523, { dur: 0.12, type: 'triangle' }); tone(784, { at: 0.12, dur: 0.2, type: 'triangle' }) },
  open: () => tone(420, { dur: 0.12, type: 'triangle', to: 840, vol: 0.28 }),
  select: () => tone(660, { dur: 0.09, type: 'triangle', vol: 0.2 }),
  tick: () => tone(1100, { dur: 0.05, type: 'square', vol: 0.08 }),
  correct: () => [523, 659, 784].forEach((f, i) => tone(f, { at: i * 0.09, dur: 0.22, type: 'triangle', vol: 0.28 })),
  wrong: () => tone(300, { dur: 0.35, type: 'sawtooth', to: 140, vol: 0.18 }),
  timeout: () => { tone(330, { dur: 0.18, type: 'square', vol: 0.12 }); tone(247, { at: 0.2, dur: 0.3, type: 'square', vol: 0.12 }) },
  bonus: () => [659, 784, 988, 1319].forEach((f, i) => tone(f, { at: i * 0.07, dur: 0.25, type: 'sine', vol: 0.3 })),
  boom: () => { noise({ dur: 0.6, vol: 0.55 }); tone(180, { dur: 0.5, type: 'sine', to: 40, vol: 0.5 }) },
  finish: () => [523, 523, 523, 784, 659, 784, 1047].forEach((f, i) => tone(f, { at: i * 0.13, dur: 0.3, type: 'triangle', vol: 0.3 })),
}

// ---- Nhạc nền
// Nhạc tự tạo (dùng khi tuần chưa có file): giai điệu pentatonic nhẹ lặp lại
const MELODY = [523, 587, 659, 784, 659, 587, 523, 440, 392, 440, 523, 587, 523, 440, 392, 330]
const BASS = [131, 131, 110, 110, 98, 98, 110, 110]

function playStep() {
  if (!ctx || ctx.state !== 'running' || !musicOn.value) return
  tone(MELODY[step % MELODY.length], { dur: 0.38, type: 'sine', vol: 0.05, music: true })
  if (step % 2 === 0) tone(BASS[(step / 2) % BASS.length], { dur: 0.7, type: 'triangle', vol: 0.07, music: true })
  step++
}

function startMusic() {
  if (!musicOn.value) return
  if (audioEl) {
    audioEl.play().catch(() => {}) // bị chặn tới khi người chơi chạm lần đầu, sẽ thử lại
  } else if (!synthTimer) {
    synthTimer = setInterval(playStep, 430)
  }
}
function stopMusic() {
  clearInterval(synthTimer)
  synthTimer = null
  if (audioEl) audioEl.pause()
}

export const bgm = {
  /** src = data URL / link file nhạc của tuần; bỏ trống = nhạc tự tạo */
  start(src = null) {
    bgm.stop()
    bgmWanted = true
    ensure()
    if (src) {
      audioEl = new Audio(src)
      audioEl.loop = true
      audioEl.volume = 0.4
    }
    startMusic()
  },
  stop() {
    bgmWanted = false
    stopMusic()
    audioEl = null
  },
}

export function toggleSound() {
  soundOn.value = !soundOn.value
  write(K_SFX, soundOn.value)
  if (soundOn.value) { ensure(); sfx.select() }
}

export function toggleMusic() {
  musicOn.value = !musicOn.value
  write(K_MUSIC, musicOn.value)
  if (musicOn.value) { ensure(); if (bgmWanted) startMusic() } else stopMusic()
}
