<script setup>
import { useRoute } from 'vue-router'
import { configured } from './lib/supabase'
const route = useRoute()
</script>

<template>
  <header class="topbar">
    <router-link to="/" class="brand">🎁 Mở Ô Bí Mật</router-link>
    <nav>
      <router-link to="/">Chơi</router-link>
      <router-link to="/leaderboard">Xếp hạng</router-link>
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
