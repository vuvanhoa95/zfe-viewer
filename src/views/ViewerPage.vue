<template>
  <div class="viewer-layout" :class="layoutClasses">
    <AppHeader
      class="layout-header"
      project-name="ZFENIX Hub"
      model-name="Model IFC Demo"
      user-name="Admin"
      :is-left-collapsed="sidebarLeftCollapsed"
      :is-right-collapsed="sidebarRightCollapsed"
      @toggle-left-sidebar="uiStore.toggleLeftSidebar()"
      @toggle-right-sidebar="uiStore.toggleRightSidebar()"
    />

    <div class="layout-main-area">
      <!-- ── NEW: Speckle-style vertical navigation ── -->
      <nav v-show="!sidebarLeftCollapsed" class="sidebar-nav">
        <button class="nav-tab" :class="{ active: activeLeftTab === 'model' }" @click="activeLeftTab = 'model'" title="Mô hình & File">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
        </button>
        <!-- Filter & Tree tabs removed: these are now natively inside the hub viewer iframe.
             Khi hub nâng cấp thêm tính năng, viewer tự động có theo mà không cần update code. -->
        <div class="nav-spacer"></div>
        <button class="nav-tab" @click="openHubNewTab" title="Mở trong Hub">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
        </button>
      </nav>

      <aside v-show="!sidebarLeftCollapsed" class="layout-sidebar-left">
        <!-- Tab: Upload & Mô hình -->
        <div class="tab-content">
          <UploadIFC @model-ready="handleModelReady" />
          <ModelList />

          <!-- Info: giải thích về iframe mode -->
          <div class="iframe-info-box">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#6366f1" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            <span>Viewer powered by <a href="https://hub.zfenix.com" target="_blank" rel="noopener">hub.zfenix.com</a> — tính năng tự đồng bộ khi hub nâng cấp.</span>
          </div>
        </div>
      </aside>

    <main class="layout-viewport">
      <div class="toolbar-row">
        <ViewerToolbar
          :mode="displayMode"
          :section-enabled="sectionEnabled"
          @fit-view="handleFitView"
          @zoom-to-selection="handleZoomToSelection"
          @toggle-fullscreen="handleToggleFullscreen"
          @toggle-section="handleToggleSection"
          @set-mode="handleSetMode"
          @activate-measure="handleActivateMeasure"
          :measure-active="measureActive"
        />
        <!-- FilterPanel remains here temporarily if not fully inline yet, but since we put it in sidebar, we hide it from toolbar -->
      </div>
      <SpeckleViewer
        ref="speckleRef"
      />
    </main>
    </div> <!-- Đóng thẻ layout-main-area TẠI ĐÂY -->

    <aside v-if="!sidebarRightCollapsed" class="layout-sidebar-right">
      <div class="hub-info-panel">
        <div class="hub-info-header">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#6366f1" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          <span>Hub Viewer Mode</span>
        </div>
        <p>Viewer đang chạy trực tiếp từ <strong>hub.zfenix.com</strong>.</p>
        <p>Mọi tính năng (Filter, Measure, Section, Properties...) đều có sẵn trong viewer bên trong.</p>
        <p>Khi hub nâng cấp, viewer này tự động được cập nhật theo.</p>
        <div class="hub-link-row" v-if="currentHubUrl">
          <a :href="currentHubUrl" target="_blank" rel="noopener" class="hub-open-btn">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
            Mở trong Hub
          </a>
        </div>
      </div>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import AppHeader from '@/components/AppHeader.vue'
import ModelList from '@/components/ModelList.vue'
import ViewerToolbar from '@/components/ViewerToolbar.vue'
import SpeckleViewer from '@/components/SpeckleViewer.vue'
import UploadIFC from '@/components/UploadIFC.vue'
import { useViewerStore } from '@/stores/viewer'
import { useUiStore } from '@/stores/ui'

// ─── ModelTree, FilterPanel, PropertiesPanel đã được bỏ ———————————————───
// Trong iframe mode, những chức năng này được xử lý bên trong hub.zfenix.com viewer.
// Khi hub nâng cấp (filter mới, properties panel mới, v.v.), viewer.zfenix.com
// tự động có theo mà không cần sửa code.

const HUB_BASE = (import.meta.env.VITE_SPECKLE_SERVER_URL as string | undefined) || 'https://hub.zfenix.com'

const viewerStore = useViewerStore()
const uiStore = useUiStore()

const speckleRef = ref<InstanceType<typeof SpeckleViewer> | null>(null)
const measureActive = ref(false)
const loadedModels = ref<Array<{streamId: string, objectId: string}>>([])
const activeLeftTab = ref<'model'>('model')

// ─── Hub URL (link to full Speckle UI) ───────────────────────────────────────────
const currentStreamId = computed(() => viewerStore.currentStreamId)
const currentHubUrl = computed(() => {
  if (!currentStreamId.value) return null
  return `${HUB_BASE}/streams/${currentStreamId.value}`
})

function openHubNewTab() {
  if (currentHubUrl.value) window.open(currentHubUrl.value, '_blank', 'noopener')
}

// ─── Init from env ────────────────────────────────────────────────────────────
// Vô hiệu hóa auto-load để tránh "đọc file cũ" theo yêu cầu user
/*
const env = (import.meta as any).env as any
if (!viewerStore.currentStreamId && env?.VITE_TEST_STREAM_ID) {
  viewerStore.setModel(env.VITE_TEST_STREAM_ID, env.VITE_TEST_OBJECT_ID ?? '')
}
*/

// ─── Store state ─────────────────────────────────────────────────────
const { sidebarLeftCollapsed, sidebarRightCollapsed } = storeToRefs(uiStore)

// ─── Upload handler (vẫn giữ — UploadIFC vẫn hoạt động) ──────────────────
async function handleModelReady(newStreamId: string, newObjectId: string) {
  // Thêm model vào SpeckleViewer (sẽ tạo embed URL mới)
  speckleRef.value?.addModel?.(newStreamId, newObjectId)

  // Track trong store
  viewerStore.setModel(newStreamId, newObjectId)
  loadedModels.value.push({ streamId: newStreamId, objectId: newObjectId })
  console.log(`[ViewerPage] 📦 Model ready: ${newStreamId}`)
}

// ─── Toolbar handlers (tiếp tục tương thích) ───────────────────────────
function handleFitView() {
  speckleRef.value?.fitView?.()
}

function handleZoomToSelection() {
  speckleRef.value?.zoomToSelection?.()
}

const displayMode = ref<'default' | 'wireframe' | 'ghost'>('default')
const sectionEnabled = ref(false)

function handleToggleSection() {
  sectionEnabled.value = !sectionEnabled.value
  speckleRef.value?.toggleSection?.(sectionEnabled.value)
}

function handleSetMode(mode: 'default' | 'wireframe' | 'ghost') {
  displayMode.value = mode
  speckleRef.value?.setDisplayMode?.(mode)
}

async function handleToggleFullscreen() {
  if (!document.fullscreenElement) {
    await document.documentElement.requestFullscreen()
  } else {
    await document.exitFullscreen()
  }
}

function handleActivateMeasure() {
  speckleRef.value?.activateMeasure?.()
}

function handleScreenshot() {
  speckleRef.value?.takeScreenshot?.()
}

// ─── Layout ───────────────────────────────────────────────────────────────────
const layoutClasses = computed(() => ({
  'sidebar-left-collapsed': sidebarLeftCollapsed.value,
  'sidebar-right-collapsed': sidebarRightCollapsed.value,
}))
</script>

<style scoped>
.viewer-layout {
  display: grid;
  grid-template-rows: 56px 1fr;
  grid-template-columns: 1fr 320px;
  grid-template-areas:
    'header  header'
    'main    props';
  height: 100vh;
  background: #f3f4f6;
  transition: grid-template-columns 0.3s ease;
}

.viewer-layout.sidebar-right-collapsed {
  grid-template-columns: 1fr 0;
}

.layout-header {
  grid-area: header;
  z-index: 100;
}

.layout-main-area {
  grid-area: main;
  display: flex;
  height: 100%;
  overflow: hidden;
}

/* ── MỚI: Sidebar Nav (Vertical Toolbar) ── */
.sidebar-nav {
  width: 50px;
  background: #0b1121;
  border-right: 1px solid #1e293b;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 0;
  gap: 12px;
  z-index: 40;
}

.nav-tab {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid transparent;
  color: #64748b;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
}
.nav-tab:hover {
  color: #a5b4fc;
  background: rgba(99, 102, 241, 0.1);
}
.nav-tab.active {
  color: #fff;
  background: #6366f1;
  border-color: #818cf8;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
}
.nav-tab.has-filter::after {
  content: '';
  position: absolute;
  top: 2px;
  right: 2px;
  width: 6px;
  height: 6px;
  background: #ef4444;
  border-radius: 50%;
}
.nav-spacer { flex: 1; }

/* ── Khung nội dung Sidebar (thay vì grid column) ── */
.layout-sidebar-left {
  width: 320px;
  border-right: 1px solid #1e293b;
  display: flex;
  flex-direction: column;
  background: #0f172a;
  overflow: hidden;
  transition: width 0.3s ease;
  flex-shrink: 0;
}

.tab-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}


.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #64748b;
  font-size: 13px;
  gap: 12px;
  text-align: center;
}

.sidebar-scroll {
  padding: 12px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.layout-viewport {
  flex: 1;
  position: relative;
  background: #0f1729;
  overflow: hidden;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.toolbar-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  padding-right: 8px;
  background: rgba(15, 20, 40, 0.95);
  border-bottom: 1px solid #1e293b;
  position: relative;
  z-index: 50;
}

.layout-sidebar-right {
  grid-area: props;
  overflow-y: auto;
  background: #0f172a;
  border-left: 1px solid #1e293b;
  overflow: hidden;
  transition: width 0.3s ease;
}

@media (max-width: 1279px) {
  .viewer-layout {
    grid-template-columns: 1fr;
    grid-template-areas:
      'header'
      'main';
  }
  .layout-sidebar-right {
    position: absolute;
    right: 0; top: 56px; bottom: 0;
    width: 320px;
    z-index: 100;
  }
}

@media (max-width: 1023px) {
  .layout-sidebar-left { width: 250px; }
}

/* ── Hub Info Panel (right sidebar) ── */
.hub-info-panel {
  padding: 20px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.hub-info-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #e2e8f0;
  padding-bottom: 10px;
  border-bottom: 1px solid #1e293b;
}

.hub-info-panel p {
  font-size: 12px;
  color: #64748b;
  line-height: 1.6;
  margin: 0;
}

.hub-link-row {
  margin-top: 8px;
}

.hub-open-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 6px;
  background: rgba(99, 102, 241, 0.15);
  border: 1px solid rgba(99, 102, 241, 0.3);
  color: #a5b4fc;
  font-size: 12px;
  text-decoration: none;
  transition: all 0.2s;
}

.hub-open-btn:hover {
  background: rgba(99, 102, 241, 0.25);
  border-color: rgba(99, 102, 241, 0.5);
  color: #c7d2fe;
}

/* ── Iframe Info Box (left sidebar notice) ── */
.iframe-info-box {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  margin: 8px 12px;
  border-radius: 8px;
  background: rgba(99, 102, 241, 0.06);
  border: 1px solid rgba(99, 102, 241, 0.15);
}

.iframe-info-box span {
  font-size: 11px;
  color: #64748b;
  line-height: 1.5;
}

.iframe-info-box a {
  color: #818cf8;
  text-decoration: none;
}

.iframe-info-box a:hover {
  text-decoration: underline;
}
</style>
