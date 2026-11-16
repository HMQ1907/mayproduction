<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { adminLogin } from '../../lib/admin'

const router = useRouter()
const username = ref('')
const password = ref('')
const error = ref('')
const busy = ref(false)

async function login() {
  error.value = ''
  busy.value = true
  try {
    await adminLogin(username.value, password.value)
    router.push('/admin')
  } catch (e) { error.value = e.message } finally { busy.value = false }
}
</script>

<template>
  <form class="card login" @submit.prevent="login">
    <h2>🔐 Đăng nhập Admin</h2>
    <div class="field"><label>Tên đăng nhập</label><input v-model="username" autocomplete="username" required /></div>
    <div class="field"><label>Mật khẩu</label><input v-model="password" type="password" autocomplete="current-password" required /></div>
    <p v-if="error" class="msg err">{{ error }}</p>
    <button class="btn block" :disabled="busy">{{ busy ? 'Đang đăng nhập…' : 'Đăng nhập' }}</button>
  </form>
</template>

<style scoped>
.login { max-width: 400px; margin: 40px auto; }
</style>
