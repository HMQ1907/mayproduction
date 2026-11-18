import { createApp } from 'vue'
import Vue3Toastify from 'vue3-toastify'
import 'vue3-toastify/dist/index.css'
import '@vuepic/vue-datepicker/dist/main.css'
import App from './App.vue'
import router from './router'
import './style.css'

createApp(App)
  .use(router)
  .use(Vue3Toastify, { theme: 'dark', position: 'top-center', autoClose: 3500, clearOnUrlChange: false })
  .mount('#app')
