<template>
  <div class="viewer-toolbar">
    <!-- Group 1: View -->
    <div class="tb-group">
      <button
        type="button"
        class="tb-btn"
        title="Zoom vừa màn hình (F)"
        aria-label="Zoom vừa màn hình"
        @click="$emit('fitView')"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="18" height="18" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 14v4h4" /><path d="M4 10V6h4" /><path d="M20 14v4h-4" /><path d="M20 10V6h-4" />
        </svg>
      </button>
      <button
        type="button"
        class="tb-btn"
        title="Zoom đến vùng chọn (Z)"
        aria-label="Zoom đến vùng chọn"
        @click="$emit('zoomToSelection')"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="18" height="18" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 10V6a2 2 0 0 1 2-2h4"/><path d="M21 14v4a2 2 0 0 1-2 2h-4"/><path d="M21 10V6a2 2 0 0 0-2-2h-4"/><path d="M3 14v4a2 2 0 0 0 2 2h4"/><circle cx="12" cy="12" r="3"/><line x1="14.5" y1="14.5" x2="19" y2="19"/>
        </svg>
      </button>
      
      <!-- Auto Zoom Toggle -->
      <button
        type="button"
        :class="['tb-btn', { 'tb-btn--active': viewerStore.zoomOnSelect }]"
        :title="viewerStore.zoomOnSelect ? 'Tắt Tự động Zoom' : 'Bật Tự động Zoom'"
        @click="viewerStore.setZoomOnSelect(!viewerStore.zoomOnSelect)"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="18" height="18" stroke-width="2">
           <circle cx="11" cy="11" r="8"></circle>
           <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
           <path v-if="viewerStore.zoomOnSelect" d="M11 8v6M8 11h6" stroke-linecap="round"/>
        </svg>
      </button>

      <button
        type="button"
        class="tb-btn"
        :class="{ 'tb-btn--active': isFullscreen }"
        title="Toàn màn hình (F11)"
        aria-label="Toàn màn hình"
        @click="handleFullscreen"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="18" height="18" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path v-if="!isFullscreen" d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
          <path v-else d="M8 3v3h-3M16 3v3h3M8 21v-3h-3M16 21v-3h3"/>
        </svg>
      </button>
    </div>

    <div class="sep" />

    <!-- Group 2: Section -->
    <div class="tb-group">
      <button
        type="button"
        :class="['tb-btn', { 'tb-btn--active': sectionEnabled }]"
        title="Mặt cắt (X)"
        aria-label="Mặt cắt"
        :aria-pressed="sectionEnabled"
        @click="$emit('toggleSection')"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="18" height="18" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 12H4 M8 4 l-4 8 4 8 M16 4 l4 8 -4 8" />
        </svg>
      </button>
    </div>

    <div class="sep" />

    <!-- Group 3: Display modes -->
    <div class="tb-group" role="group" aria-label="Chế độ hiển thị">
      <button
        type="button"
        :class="['tb-btn', { 'tb-btn--active': mode === 'default' }]"
        title="Màu sắc thật"
        @click="$emit('setMode', 'default')"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="18" height="18" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/>
          <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>
        </svg>
      </button>
      <button
        type="button"
        :class="['tb-btn', { 'tb-btn--active': mode === 'shaded' }]"
        title="Đổi bóng (Box Mode)"
        @click="$emit('setMode', 'shaded')"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="18" height="18" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line>
        </svg>
      </button>
      <button
        type="button"
        :class="['tb-btn', { 'tb-btn--active': mode === 'ghost' }]"
        title="Trong suốt"
        @click="$emit('setMode', 'ghost')"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="18" height="18" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 10h.01"/><path d="M15 10h.01"/><path d="M12 2a8 8 0 0 0-8 8v12l3-3 2.5 2.5L12 19l2.5 2.5L17 19l3 3V10a8 8 0 0 0-8-8z"/>
        </svg>
      </button>
      <button
        type="button"
        :class="['tb-btn', { 'tb-btn--active': mode === 'xray' }]"
        title="X-Ray (Wireframe)"
        @click="$emit('setMode', 'xray')"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="18" height="18" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><path d="M3 9h18"/><path d="M9 21V9"/>
        </svg>
      </button>
      <button
        type="button"
        :class="['tb-btn', { 'tb-btn--active': mode === 'hidden-line' }]"
        title="Hidden Line"
        @click="$emit('setMode', 'hidden-line')"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="18" height="18" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
        </svg>
      </button>
    </div>

    <div class="sep" />

    <!-- Group 4: Tools -->
    <div class="tb-group">
      <button
        type="button"
        :class="['tb-btn', { 'tb-btn--active': measureActive }]"
        :title="measureActive ? 'Tắt đo khoảng cách' : 'Đo khoảng cách (M)'"
        aria-label="Đo khoảng cách"
        :aria-pressed="measureActive"
        @click="$emit('activateMeasure')"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="18" height="18" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21.3 15.3l-7.6-7.6a2 2 0 0 0-2.8 0l-7.6 7.6a2 2 0 0 0 0 2.8l7.6 7.6a2 2 0 0 0 2.8 0l7.6-7.6a2 2 0 0 0 0-2.8z"/><path d="M14.5 11.5l2 2"/><path d="M11.5 14.5l2 2"/><path d="M8.5 17.5l2 2"/>
        </svg>
      </button>
    </div>

    <!-- Toast notification -->
    <Transition name="toast">
      <div v-if="toastMsg" class="toast">{{ toastMsg }}</div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useViewerStore, type DisplayMode } from '@/stores/viewer'

const viewerStore = useViewerStore()

const props = defineProps<{
  mode: DisplayMode
  sectionEnabled: boolean
  measureActive?: boolean
}>()

const emit = defineEmits<{
  (e: 'fitView'): void
  (e: 'zoomToSelection'): void
  (e: 'toggleFullscreen'): void
  (e: 'toggleSection'): void
  (e: 'setMode', mode: DisplayMode): void
  (e: 'activateMeasure'): void
  (e: 'screenshot'): void
}>()

const isFullscreen = ref(false)
const toastMsg = ref('')
let toastTimer: ReturnType<typeof setTimeout> | undefined

// Fullscreen built vào toolbar để react với document state
function handleFullscreen() {
  emit('toggleFullscreen')
  setTimeout(() => {
    isFullscreen.value = !!document.fullscreenElement
  }, 100)
}

// Keyboard shortcuts
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
    if (e.key === 'f' || e.key === 'F') emit('fitView')
    if (e.key === 'z' || e.key === 'Z') emit('zoomToSelection')
    if (e.key === 'x' || e.key === 'X') emit('toggleSection')
    if (e.key === 'm' || e.key === 'M') emit('activateMeasure')
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault()
      emit('screenshot')
      showToast('Đã chụp màn hình!')
    }
  })
  document.addEventListener('fullscreenchange', () => {
    isFullscreen.value = !!document.fullscreenElement
  })
}

function showToast(msg: string) {
  toastMsg.value = msg
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toastMsg.value = '' }, 2500)
}
</script>

<style scoped>
.viewer-toolbar {
  position: absolute;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(15, 23, 42, 0.85);
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 12px;
  padding: 6px 12px;
  backdrop-filter: blur(16px);
  z-index: 10;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
  user-select: none;
}

.tb-group {
  display: flex;
  align-items: center;
  gap: 1px;
}

.tb-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: transparent;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  border-radius: 6px;
  transition: background 0.12s, color 0.12s, box-shadow 0.12s;
  flex-shrink: 0;
  font-size: 14px;
}

.tb-btn:hover {
  background: rgba(148, 163, 184, 0.12);
  color: #e2e8f0;
}

.tb-btn:active {
  background: rgba(99, 102, 241, 0.15);
  transform: scale(0.95);
}

.tb-btn--active {
  background: rgba(99, 102, 241, 0.25);
  color: #a5b4fc;
  box-shadow: 0 0 0 1px rgba(99, 102, 241, 0.5) inset;
}

.tb-btn--active:hover {
  background: rgba(99, 102, 241, 0.35);
}

.sep {
  width: 1px;
  height: 22px;
  background: rgba(148, 163, 184, 0.15);
  margin: 0 3px;
  flex-shrink: 0;
}

/* Toast notification */
.toast {
  position: absolute;
  top: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  background: rgba(15, 23, 42, 0.95);
  border: 1px solid rgba(99, 102, 241, 0.4);
  color: #a5b4fc;
  font-size: 12px;
  padding: 5px 12px;
  border-radius: 6px;
  white-space: nowrap;
  box-shadow: 0 4px 16px rgba(0,0,0,0.4);
  pointer-events: none;
}

.toast-enter-active, .toast-leave-active {
  transition: opacity 0.2s, transform 0.2s;
}
.toast-enter-from, .toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-4px);
}
</style>
