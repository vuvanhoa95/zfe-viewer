<template>
  <div class="viewer-container">
    <!-- ── Idle: chưa có model nào ─────────────────────────────────────── -->
    <div v-if="!currentEmbedUrl" class="idle-screen">
      <div class="idle-card">
        <div class="idle-icon">
          <svg viewBox="0 0 64 64" fill="none" width="64" height="64">
            <rect width="64" height="64" rx="16" fill="rgba(99,102,241,0.1)" />
            <path d="M32 44V24m0 0l-8 8m8-8l8 8" stroke="#6366f1" stroke-width="2.5"
              stroke-linecap="round" stroke-linejoin="round" />
            <path d="M20 46h24" stroke="#6366f1" stroke-width="2" stroke-linecap="round" opacity="0.4" />
          </svg>
        </div>
        <p class="idle-title">Chưa có mô hình</p>
        <p class="idle-sub">Upload file IFC từ sidebar bên trái để bắt đầu xem mô hình 3D</p>
      </div>
    </div>

    <!-- ── Loading overlay ─────────────────────────────────────────────── -->
    <div v-if="currentEmbedUrl && isLoading" class="overlay">
      <div class="overlay-card">
        <div class="spinner-ring"></div>
        <div class="progress-text">Đang tải mô hình...</div>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: loadProgress + '%' }"></div>
        </div>
        <div class="progress-hint">Kết nối tới hub.zfenix.com</div>
      </div>
    </div>

    <!-- ── Embed iframe — chính là Speckle Viewer từ hub ──────────────── -->
    <!--
      🔑 LÝ DO dùng iframe thay vì @speckle/viewer npm package:
         Khi hub.zfenix.com upgrade Speckle version mới (tính năng, UI, bug fix),
         iframe này TỰ ĐỘNG inherit — không cần update code viewer.zfenix.com.
         "Auto-sync features with hub" theo yêu cầu Trường hợp B.
    -->
    <iframe
      v-if="currentEmbedUrl"
      ref="embedFrame"
      :src="currentEmbedUrl"
      class="embed-frame"
      :class="{ loaded: !isLoading }"
      frameborder="0"
      allowfullscreen
      allow="fullscreen; clipboard-write"
      title="ZFENIX BIM Viewer — Powered by hub.zfenix.com"
      @load="onIframeLoad"
    />

    <!-- ── Multi-model tab bar (khi có nhiều hơn 1 model) ─────────────── -->
    <div v-if="loadedModels.length > 1" class="model-tabs">
      <button
        v-for="(m, i) in loadedModels"
        :key="m.streamId"
        class="model-tab"
        :class="{ active: activeModelIndex === i }"
        @click="switchModel(i)"
        :title="m.name"
      >
        <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
          <path d="M8 1L1.5 4.5v7L8 15l6.5-3.5v-7L8 1zm0 1.79L13.23 6 8 8.5 2.77 6 8 2.79z"/>
        </svg>
        <span>{{ m.name }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useViewerStore } from '@/stores/viewer'

// ─── Props ───────────────────────────────────────────────────────────────────
// Giữ cùng interface với SpeckleViewer cũ để ViewerPage không cần đổi nhiều
defineProps<{
  streamId?: string
  objectId?: string
  authToken?: string
}>()

// ─── Emits (tương thích ngược với ViewerPage.vue) ───────────────────────────
const emit = defineEmits<{
  (e: 'elementSelected', payload: Record<string, unknown>): void
  (e: 'treeReady', nodes: any[]): void
  (e: 'sectionToggled', enabled: boolean): void
  (e: 'measureToggled', active: boolean): void
}>()

// ─── Constants ───────────────────────────────────────────────────────────────
// URL gốc của Speckle Hub — nguồn duy nhất của truth cho embed
const HUB_BASE = (import.meta.env.VITE_SPECKLE_SERVER_URL as string | undefined)
  || 'https://hub.zfenix.com'

// ─── State ───────────────────────────────────────────────────────────────────
const viewerStore = useViewerStore()
const embedFrame  = ref<HTMLIFrameElement | null>(null)
const isLoading   = ref(false)
const loadProgress = ref(0)

// Danh sách models đã load (theo thứ tự upload)
interface LoadedModel { streamId: string; name: string }
const loadedModels   = ref<LoadedModel[]>([])
const activeModelIndex = ref(0)

// ─── Computed: embed URL hiện tại ──────────────────────────────────────────
// Tạo URL embed tới hub.zfenix.com theo stream đang active.
// Format: https://hub.zfenix.com/embed?stream=<streamId>&transparent=true&autoload=true
const currentEmbedUrl = computed<string | null>(() => {
  const active = loadedModels.value[activeModelIndex.value]
  if (!active?.streamId) return null
  const params = new URLSearchParams({
    stream: active.streamId,
    transparent: 'true',
    autoload: 'true',
  })
  return `${HUB_BASE}/embed?${params.toString()}`
})

// ─── Load progress simulation (iframe không expose progress events) ─────────
let progressTimer: ReturnType<typeof setInterval> | null = null

function startLoadProgress() {
  isLoading.value = true
  loadProgress.value = 5
  if (progressTimer) clearInterval(progressTimer)
  progressTimer = setInterval(() => {
    if (loadProgress.value < 85) {
      loadProgress.value = Math.min(85, loadProgress.value + Math.random() * 12)
    }
  }, 400)
}

function onIframeLoad() {
  if (progressTimer) clearInterval(progressTimer)
  loadProgress.value = 100
  // Fade out loading overlay sau 600ms
  setTimeout(() => { isLoading.value = false }, 600)
  console.log('[SpeckleViewer] ✅ iframe loaded — hub embed active')
}

// ─── Public API (expose cho ViewerPage compat) ──────────────────────────────
// Các hàm này giữ cùng tên để ViewerPage.vue không cần sửa
// Với iframe-based viewer, các lệnh này được gửi vào hub qua postMessage khi cần

function fitView() {
  // Gửi postMessage tới iframe để zoom-to-fit (nếu hub hỗ trợ)
  embedFrame.value?.contentWindow?.postMessage({ type: 'viewer:fitToScene' }, HUB_BASE)
}

function zoomToSelection() {
  embedFrame.value?.contentWindow?.postMessage({ type: 'viewer:isolateObjects' }, HUB_BASE)
}

function addModel(streamId: string, objectId: string) {
  const name = `IFC Model ${loadedModels.value.length + 1}`
  // Kiểm tra trùng
  if (loadedModels.value.some(m => m.streamId === streamId)) return
  loadedModels.value.push({ streamId, name })
  activeModelIndex.value = loadedModels.value.length - 1
  startLoadProgress()
  console.log('[SpeckleViewer] ➕ Model added (iframe mode):', streamId)
}

function switchModel(index: number) {
  if (index !== activeModelIndex.value) {
    activeModelIndex.value = index
    startLoadProgress()
  }
}

function selectObjects(_ids: string[]) {
  // In iframe mode: selection is handled natively inside hub's viewer
  // This is a no-op stub to maintain API compatibility
}

function clearSelection() {
  // no-op stub for API compat
}

function setDisplayMode(_mode: string) {
  // no-op — display mode controlled inside hub viewer UI
}

function toggleSection(_enabled: boolean) {
  // no-op — section tool controlled inside hub viewer UI
}

function activateMeasure() {
  // no-op — measure tool controlled inside hub viewer UI
}

async function takeScreenshot(): Promise<string | undefined> {
  // Gửi postMessage để hub chụp màn hình (nếu hub hỗ trợ)
  embedFrame.value?.contentWindow?.postMessage({ type: 'viewer:screenshot' }, HUB_BASE)
  return undefined
}

function getWorldTree() {
  return null // Không available trong iframe mode
}

function applyColorFilter(_groups: Array<{ objectIds: string[], color: string }>) {
  // no-op — FilterPanel sẽ không hoạt động với iframe mode
  // Color filter là tính năng bên trong hub viewer
}

function clearColorFilter() {
  // no-op
}

// ─── Watch embed URL để trigger loading overlay ───────────────────────────
watch(currentEmbedUrl, (url) => {
  if (url) startLoadProgress()
})

// ─── Expose ──────────────────────────────────────────────────────────────────
defineExpose({
  fitView,
  zoomToSelection,
  addModel,
  selectObjects,
  clearSelection,
  setDisplayMode,
  toggleSection,
  activateMeasure,
  takeScreenshot,
  getWorldTree,
  applyColorFilter,
  clearColorFilter,
})
</script>

<style scoped>
/* ─── Container ─────────────────────────────────────────────────────────── */
.viewer-container {
  width: 100%;
  height: 100%;
  position: relative;
  background: #0d1117;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* ─── Idle screen ───────────────────────────────────────────────────────── */
.idle-screen {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(ellipse at 50% 60%, rgba(99,102,241,0.06) 0%, transparent 70%);
}

.idle-card {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 40px;
}

.idle-icon {
  width: 64px;
  height: 64px;
  animation: float 4s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}

.idle-title {
  font-size: 16px;
  font-weight: 600;
  color: #e2e8f0;
  margin: 0;
}

.idle-sub {
  font-size: 13px;
  color: #64748b;
  margin: 0;
  max-width: 260px;
  line-height: 1.5;
}

/* ─── Loading overlay ───────────────────────────────────────────────────── */
.overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(10, 15, 35, 0.85);
  backdrop-filter: blur(4px);
  z-index: 20;
}

.overlay-card {
  padding: 24px 32px;
  border-radius: 14px;
  background: rgba(15, 23, 42, 0.98);
  color: #f1f5f9;
  font-size: 14px;
  min-width: 260px;
  text-align: center;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.7);
  border: 1px solid rgba(99, 102, 241, 0.3);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.spinner-ring {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(99, 102, 241, 0.2);
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.progress-text {
  font-weight: 500;
  color: #e2e8f0;
}

.progress-bar {
  width: 100%;
  height: 4px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #6366f1, #8b5cf6);
  border-radius: 2px;
  transition: width 0.4s ease;
}

.progress-hint {
  font-size: 11px;
  color: #64748b;
}

/* ─── iframe embed ──────────────────────────────────────────────────────── */
.embed-frame {
  flex: 1;
  width: 100%;
  border: none;
  background: #0d1117;
  opacity: 0;
  transition: opacity 0.5s ease;
}

.embed-frame.loaded {
  opacity: 1;
}

/* ─── Multi-model tabs ──────────────────────────────────────────────────── */
.model-tabs {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  background: rgba(11, 17, 33, 0.95);
  border-top: 1px solid #1e293b;
  flex-shrink: 0;
  overflow-x: auto;
}

.model-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 6px;
  border: 1px solid transparent;
  background: transparent;
  color: #64748b;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
  max-width: 160px;
}

.model-tab span {
  overflow: hidden;
  text-overflow: ellipsis;
}

.model-tab:hover {
  color: #a5b4fc;
  background: rgba(99, 102, 241, 0.08);
  border-color: rgba(99, 102, 241, 0.2);
}

.model-tab.active {
  color: #fff;
  background: rgba(99, 102, 241, 0.2);
  border-color: rgba(99, 102, 241, 0.5);
}
</style>
