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
        <button class="nav-tab" :class="{ active: activeLeftTab === 'filter', 'has-filter': hasActiveFilter }" @click="activeLeftTab = 'filter'" title="Filter (Color by)">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
        </button>
        <button class="nav-tab" :class="{ active: activeLeftTab === 'issue' }" @click="activeLeftTab = 'issue'" title="Issues / Bình luận">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
        </button>
        <div class="nav-spacer"></div>
        <button class="nav-tab screenshot-btn" @click="handleScreenshot" title="Chụp màn hình">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
        </button>
      </nav>

      <aside v-show="!sidebarLeftCollapsed" class="layout-sidebar-left">
        <!-- Tab 1: Mô hình -->
        <div v-show="activeLeftTab === 'model'" class="tab-content">
          <UploadIFC @model-ready="handleModelReady" />
          <ModelList />
          <div class="sidebar-scroll">
            <ModelTree />
          </div>
        </div>
        
        <!-- Tab 2: Filter (Color by) -->
        <div v-show="activeLeftTab === 'filter'" class="tab-content filter-tab-wrap">
          <!-- Sẽ chuyển FilterPanel vào đây để full chiều cao -->
          <FilterPanel :viewer-ref="speckleRef" :inline="true" />
        </div>

        <!-- Tab 3: Issues -->
        <div v-show="activeLeftTab === 'issue'" class="tab-content issue-tab-wrap">
          <div class="empty-state">
            <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="#64748b" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
            <p>Tính năng Issue đang được phát triển</p>
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
        :stream-id="currentStreamId ?? ''"
        :object-id="currentObjectId ?? ''"
        :auth-token="speckleToken"
        @element-selected="handleElementSelected"
        @tree-ready="handleTreeReady"
        @section-toggled="(v) => viewerStore.sectionEnabled = v"
        @measure-toggled="(v) => measureActive = v"
      />
    </main>
    </div> <!-- Đóng thẻ layout-main-area TẠI ĐÂY -->

    <aside class="layout-sidebar-right">
      <PropertiesPanel :properties="selectedElement" />
    </aside>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import AppHeader from '@/components/AppHeader.vue'
import ModelTree from '@/components/ModelTree.vue'
import PropertiesPanel from '@/components/PropertiesPanel.vue'
import ViewerToolbar from '@/components/ViewerToolbar.vue'
import SpeckleViewer from '@/components/SpeckleViewer.vue'
import UploadIFC from '@/components/UploadIFC.vue'
import ModelList from '@/components/ModelList.vue'
import { useViewerStore, type TreeNode } from '@/stores/viewer'
import { useUiStore } from '@/stores/ui'
import { registerTempStream } from '@/utils/tempStreamManager'
import FilterPanel from '@/components/FilterPanel.vue'

const viewerStore = useViewerStore()
const uiStore = useUiStore()
const speckleToken = import.meta.env.VITE_SPECKLE_TOKEN as string | undefined

const speckleRef = ref<InstanceType<typeof SpeckleViewer> | null>(null)
const measureActive = ref(false)
const loadedModels = ref<Array<{streamId: string, objectId: string}>>([])
const activeLeftTab = ref<'model'|'filter'|'issue'>('model')

const hasActiveFilter = computed(() => viewerStore.activeColorFilter !== null)

// ─── Init from env ────────────────────────────────────────────────────────────
// Vô hiệu hóa auto-load để tránh "đọc file cũ" theo yêu cầu user
/*
const env = (import.meta as any).env as any
if (!viewerStore.currentStreamId && env?.VITE_TEST_STREAM_ID) {
  viewerStore.setModel(env.VITE_TEST_STREAM_ID, env.VITE_TEST_OBJECT_ID ?? '')
}
*/

// ─── Store state ─────────────────────────────────────────────────────────────
const {
  currentStreamId,
  currentObjectId,
  selectedElement,
  displayMode,
  sectionEnabled,
  selectedObjectId,
} = storeToRefs(viewerStore)

const { sidebarLeftCollapsed, sidebarRightCollapsed } = storeToRefs(uiStore)

// ─── Viewer → Tree sync ───────────────────────────────────────────────────────
/** Khi user click element trong 3D viewport */
function handleElementSelected(props: Record<string, unknown>) {
  viewerStore.setSelectedElement(Object.keys(props).length ? props : null)
}

/** Khi viewer load xong và build được tree nodes */
function handleTreeReady(nodes: TreeNode[]) {
  viewerStore.setTreeNodes(nodes)
  console.log(`[ViewerPage] 🌳 Tree ready: ${nodes.length} nodes`)
}

// ─── Tree → Viewer sync ───────────────────────────────────────────────────────
/** Watch selectedObjectId từ store (set bởi ModelTree click) → gọi viewer */
watch(selectedObjectId, (newId) => {
  if (!speckleRef.value) return
  if (newId) {
    speckleRef.value.selectObjects([newId])
  } else {
    speckleRef.value.clearSelection()
  }
})

// ─── Other handlers ───────────────────────────────────────────────────────────
async function handleModelReady(newStreamId: string, newObjectId: string) {
  // Đăng ký temp stream để cleanup khi đóng browser
  registerTempStream(newStreamId)

  // Luôn dùng addModel cho MỌI file — addModel tự chờ viewer init xong
  speckleRef.value?.addModel?.(newStreamId, newObjectId)

  // Track metadata trong store
  viewerStore.setModel(newStreamId, newObjectId)
  
  // Lấy tên file tạm (Speckle API thực tế có thể trả về tên file thật nếu sync kịp)
  const fileName = `IFC Model ${loadedModels.value.length + 1}`
  viewerStore.addFile({
    name: fileName,
    streamId: newStreamId,
    objectId: newObjectId,
  })

  loadedModels.value.push({ streamId: newStreamId, objectId: newObjectId })
  console.log(`[ViewerPage] 📦 Models loaded: ${loadedModels.value.length}`)
}

function handleFitView() {
  speckleRef.value?.fitView?.()
}

function handleZoomToSelection() {
  speckleRef.value?.zoomToSelection?.()
}

function handleToggleSection() {
  viewerStore.toggleSection()
  speckleRef.value?.toggleSection?.(sectionEnabled.value)
}

function handleSetMode(mode: 'default' | 'wireframe' | 'ghost') {
  viewerStore.setDisplayMode(mode)
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
.screenshot-btn:hover { color: #10b981; background: rgba(16, 185, 129, 0.1); }

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
.filter-tab-wrap { padding: 12px; background: #0f172a; overflow-y: auto; }
.issue-tab-wrap { padding: 12px; background: #0f172a; }

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
</style>
