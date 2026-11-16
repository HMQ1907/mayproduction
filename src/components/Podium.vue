<script setup>
import { fmtDuration, medals } from '../lib/format'
defineProps({ rows: { type: Array, default: () => [] } })
</script>

<template>
  <div v-if="rows.length" class="podium">
    <div v-for="r in rows.slice(0, 3)" :key="r.rank" class="slot" :class="'p' + r.rank">
      <div class="medal">{{ medals[r.rank - 1] }}</div>
      <div class="pname">{{ r.player_name }}</div>
      <div class="pscore">{{ r.score }} điểm</div>
      <div class="ptime">{{ fmtDuration(r.duration_ms) }}</div>
    </div>
  </div>
</template>

<style scoped>
.podium { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; align-items: end; margin: 6px 0 16px; }
.slot { background: var(--panel-2); border: 1px solid var(--line); border-radius: 14px; padding: 12px 8px; text-align: center; min-width: 0; }
.p1 { order: 2; padding-top: 22px; padding-bottom: 22px; border-color: #eab308; background: linear-gradient(#3a2f12, var(--panel-2)); }
.p2 { order: 1; }
.p3 { order: 3; }
.medal { font-size: 2rem; }
.p1 .medal { font-size: 2.6rem; }
.pname { font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pscore { color: var(--accent); font-weight: 800; }
.ptime { color: var(--muted); font-size: .8rem; }
</style>
