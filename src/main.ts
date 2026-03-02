import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import App from './App.vue'
import router from './router'
import vi from './locales/vi.json'
import './styles.css'

const app = createApp(App)

const pinia = createPinia()
app.use(pinia)

const i18n = createI18n({
  legacy: false,
  locale: 'vi',
  messages: { vi }
})
app.use(i18n)

app.use(router)

app.mount('#app')

