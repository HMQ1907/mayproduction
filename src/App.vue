<script setup>
import { watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import { configured } from './lib/supabase'
import { soundOn, musicOn, toggleSound, toggleMusic } from './lib/sound'
const route = useRoute()
// trang admin luôn dùng nền mặc định, không dùng ảnh nền của tuần
watchEffect(() => document.documentElement.classList.toggle('no-bg', route.path.startsWith('/admin')))
</script>

<template>
  <header class="topbar">
    <router-link to="/" class="brand">🎁 Mở Ô Bí Mật</router-link>
    <nav>
      <router-link to="/">Chơi</router-link>
      <router-link to="/leaderboard">Xếp hạng</router-link>
      <button class="snd" :class="{ off: !musicOn }" :title="musicOn ? 'Tắt nhạc nền' : 'Bật nhạc nền'" :aria-label="musicOn ? 'Tắt nhạc nền' : 'Bật nhạc nền'" @click="toggleMusic">
        {{ musicOn ? '🎵' : '🔕' }}
      </button>
      <button class="snd" :class="{ off: !soundOn }" :title="soundOn ? 'Tắt hiệu ứng' : 'Bật hiệu ứng'" :aria-label="soundOn ? 'Tắt hiệu ứng' : 'Bật hiệu ứng'" @click="toggleSound">
        {{ soundOn ? '🔊' : '🔇' }}
      </button>
    </nav>
  </header>
  <main class="container" :class="{ wide: route.path.startsWith('/admin') || route.path === '/leaderboard' }" :key="route.path">
    <div v-if="!configured" class="card warn">
      <h2>Chưa cấu hình Supabase</h2>
      <p>Tạo file <code>.env</code> (copy từ <code>.env.example</code>) và điền <code>VITE_SUPABASE_URL</code>, <code>VITE_SUPABASE_ANON_KEY</code>, rồi chạy lại <code>npm run dev</code>.</p>
    </div>
    <router-view v-else />
  </main>
</template>
