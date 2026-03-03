<template>
  <div ref="viewerContainer" class="viewer-container">
    <div v-if="loading" class="overlay">
      <div class="overlay-card">
        <div class="progress-text">{{ $t('viewer.loading') }} {{ loadProgress }}%</div>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: loadProgress + '%' }"></div>
        </div>
        <div class="progress-hint" v-if="loadProgress < 100">Đang tải dữ liệu mô hình...</div>
      </div>
    </div>
    <div v-if="error" class="overlay">
      <div class="overlay-card error">
        <div>{{ $t('viewer.loadError') }}</div>
        <div class="error-message">{{ error }}</div>
        <button class="retry-btn" @click="retryLoad">Thử lại</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useViewerStore, type DisplayMode, type TreeNode } from '@/stores/viewer'
import { VIEWER_PARAMS, SPECKLE_SERVER } from '@/utils/speckleClient'

const props = defineProps<{
  streamId: string
  objectId: string
  authToken?: string
}>()

const emit = defineEmits<{
  (e: 'elementSelected', payload: Record<string, unknown>): void
  (e: 'treeReady', nodes: TreeNode[]): void
  (e: 'sectionToggled', enabled: boolean): void
  (e: 'measureToggled', active: boolean): void
}>()

const viewerStore = useViewerStore()

const viewerContainer = ref<HTMLDivElement | null>(null)
const loadingCount = ref(0)
const loading = computed(() => loadingCount.value > 0)
const loadProgress = ref(0)
const error = ref<string | null>(null)

let viewerInstance: any = null
let cameraControllerRef: any = null
let selectionExtRef: any = null
let filteringExtRef: any = null
let sectionToolRef: any = null
let measurementsExtRef: any = null
let resizeObserver: ResizeObserver | null = null
let ViewerEventRef: any = null
let SelectionExtensionRef: any = null
let FilteringExtensionRef: any = null

// Promise resolves khi viewer đã init xong — addModel sẽ await cái này
let resolveViewerReady: () => void
const viewerReady = new Promise<void>(r => { resolveViewerReady = r })

// Internal state cho toolbar
let currentDisplayMode: 'default' | 'wireframe' | 'ghost' = 'default'
let measureActive = false
let sectionActive = false

// ─── INIT VIEWER ─────────────────────────────────────────────────────────────
async function initViewer() {
  if (!viewerContainer.value) return

  const {
    Viewer,
    ViewerEvent,
    CameraController,
    SelectionExtension,
    FilteringExtension,
    MeasurementsExtension,
    SectionTool,
    SectionOutlines,
  } = await import('@speckle/viewer')

  // Cache refs for later use
  ViewerEventRef = ViewerEvent
  SelectionExtensionRef = SelectionExtension
  FilteringExtensionRef = FilteringExtension

  viewerInstance = new Viewer(viewerContainer.value, {
    ...VIEWER_PARAMS,
    verbose: false,
  })
  await viewerInstance.init()

  // ─── Lighting: sáng như phần mềm IFC (Revit/ArchiCAD) ───────────────────
  // indirectLightIntensity (ambient) cao → mặt khuất không đen
  // intensity (sun) vừa phải → có bóng mềm nhưng không quá tối
  viewerInstance.setLightConfiguration({
    enabled: true,
    castShadow: true,
    intensity: 5,                 // Sun intensity — vừa đủ
    color: 0xffffff,
    indirectLightIntensity: 4,   // Ambient light — sáng đều các mặt khuất
    elevation: 1.0,               // ~60° cao — ánh sáng từ trên xuống
    azimuth: 0.75,
    shadowcatcher: false,         // Tắt shadowcatcher để tránh nền tối
  })

  // Register extensions
  cameraControllerRef = viewerInstance.createExtension(CameraController)
  selectionExtRef     = viewerInstance.createExtension(SelectionExtension)
  filteringExtRef     = viewerInstance.createExtension(FilteringExtension)
  measurementsExtRef  = viewerInstance.createExtension(MeasurementsExtension)
  sectionToolRef      = viewerInstance.createExtension(SectionTool)
  viewerInstance.createExtension(SectionOutlines)

  // Disable section box + measurements by default
  if (sectionToolRef)    sectionToolRef.enabled = false
  if (measurementsExtRef) measurementsExtRef.enabled = false

  viewerInstance.resize()

  resizeObserver = new ResizeObserver(() => viewerInstance?.resize())
  resizeObserver.observe(viewerContainer.value!)

  // ─── LoadComplete: camera + populate tree ────────────────────────────────
  viewerInstance.on(ViewerEvent.LoadComplete, async (resourceURL: string) => {
    console.log('[SpeckleViewer] 🎨 LoadComplete:', resourceURL)
    loadProgress.value = 100
    // loading handled by addModel counters
    
    // Zoom to fit sau khi geometry settle
    setTimeout(() => {
      fitView()
      console.log('[SpeckleViewer] 📐 Auto zoom-to-fit after load')
    }, 500)

    // Retry zoom sau 2s nếu lần đầu chưa đủ data
    setTimeout(() => {
      fitView()
    }, 2000)

    // Populate model tree từ world tree
    setTimeout(() => {
      try {
        populateTreeFromWorldTree()
      } catch (e) {
        console.warn('Tree populate error:', e)
      }
    }, 1200)
  })

  // ─── LoadProgress ────────────────────────────────────────────────────────
  viewerInstance.on(ViewerEvent.LoadProgress, (args: { progress: number }) => {
    const pct = Math.round(args.progress * 100)
    loadProgress.value = Math.max(loadProgress.value, pct)
  })

  // ─── ObjectClicked (Viewer → Tree) ───────────────────────────────────────
  viewerInstance.on(ViewerEvent.ObjectClicked, (selInfo: any) => {
    if (!selInfo || !selInfo.hits?.length) {
      emit('elementSelected', {})
      return
    }
    const node = selInfo.hits[0]?.node
    const raw = node?.model?.raw ?? {}
    
    // Chỉ cập nhật store. Việc highlight/zoom sẽ được kích hoạt thông qua watcher do store thay đổi
    emit('elementSelected', raw)
  })

  console.log('[SpeckleViewer] ✅ Viewer initialized')
  resolveViewerReady() // Signal cho addModel() biết viewer đã sẵn sàng
}

// ─── CAMERA POSITIONING ──────────────────────────────────────────────────────
// Dùng zoomExtents của CameraController — hoạt động đúng với mọi kích thước model

/** Zoom camera to selected objects (by IDs) */
function zoomToSelection() {
  if (!viewerInstance || !cameraControllerRef) return
  try {
    // Lấy danh sách nodes đang được chọn từ SelectionExtension
    const selection = selectionExtRef?.getSelectedObjects?.()
    if (selection && selection.length > 0) {
      // Chuyển đổi từ nodes sang IDs (CHUẨN: setCameraView cần IDs)
      const ids = selection.map((o: any) => o.id || o.applicationId)
      cameraControllerRef.setCameraView(ids, true, 0.85)
      console.log('[SpeckleViewer] 🔍 Zoom to selection:', ids.length, 'objects')
    } else {
      // Nếu không có gì được chọn → zoom to fit all
      fitView()
    }
    viewerInstance.requestRender()
  } catch (e) {
    console.warn('zoomToSelection error:', e)
    fitView()
  }
}

// ─── POPULATE MODEL TREE FROM WORLD TREE ─────────────────────────────────────
function populateTreeFromWorldTree() {
  if (!viewerInstance) return

  const wt = viewerInstance.getWorldTree()
  if (!wt) return

  // Helper function to build tree recursively
  const buildTree = (node: any, depth = 0): TreeNode | null => {
    if (!node || !node.model) return null
    const raw = node.model.raw || {}
    
    // Kiểm tra đây có phải là element thật không (có ID hoặc Type)
    const id = raw.id || raw.applicationId || node.model.id
    if (!id) return null

    const type = (raw.type || raw.speckle_type || 'Unknown').split('.').pop()
    const name = raw.name || raw.Name || raw.category || type || 'Untitled'

    // Build children
    const children: TreeNode[] = []
    if (depth < 6 && node.children) { // Giới hạn độ sâu để tránh quá tải
      for (const child of node.children) {
        const mapped = buildTree(child, depth + 1)
        if (mapped) children.push(mapped)
      }
    }

    return {
      id: raw.applicationId || id,
      speckleId: id,
      name: String(name),
      type: String(type).toUpperCase(),
      children: children.length > 0 ? children : undefined
    }
  }

  try {
    const rootNodes: TreeNode[] = []
    const root = wt.root
    
    // Mỗi child của root là một model được load (resource)
    if (root?.children) {
      for (const modelBranch of root.children) {
        // Thumbnail/Header level node
        const modelTree = buildTree(modelBranch, 0)
        if (modelTree) {
          // Gán tên file từ store nếu đây là root node
          const loadedFile = viewerStore.loadedFiles.find(f => f.objectId === modelTree.speckleId)
          if (loadedFile) modelTree.name = loadedFile.name
          rootNodes.push(modelTree)
        }
      }
    }

    console.log('[SpeckleViewer] 🌳 Tree built, roots:', rootNodes.length)
    viewerStore.setTreeNodes(rootNodes)
  } catch (e) {
    console.warn('[SpeckleViewer] Tree build error:', e)
    viewerStore.setTreeNodes([])
  }
}

// ─── LOAD MODEL (DEPRECATED for multi-file, use addModel) ─────────────────────
async function loadModel(streamId: string, objectId: string) {
  return addModel(streamId, objectId)
}

function retryLoad() {
  error.value = null
  if (props.streamId && props.objectId) {
    addModel(props.streamId, props.objectId)
  }
}

/**
 * Load thêm model vào viewer (KHÔNG unload models cũ).
 * Chờ viewer init xong trước khi load. Dùng cho mọi file upload.
 */
async function addModel(streamId: string, objectId: string) {
  if (!streamId || !objectId) return

  // Chờ viewer init xong (nếu addModel được gọi trước khi onMounted hoàn tất)
  await viewerReady
  if (!viewerInstance) return

  const token = props.authToken
  console.log('[SpeckleViewer] ➕ Adding model:', objectId.slice(0, 8))

  loadingCount.value++
  // Chỉ set progress về thấp nếu chưa có model nào load xong trước đó
  if (loadProgress.value >= 100) loadProgress.value = 5

  try {
    const { SpeckleLoader } = await import('@speckle/viewer')
    const objectUrl = `${SPECKLE_SERVER}/streams/${streamId}/objects/${objectId}`

    const loader = new SpeckleLoader(viewerInstance.getWorldTree(), objectUrl, token)
    await viewerInstance.loadObject(loader, true)

    console.log('[SpeckleViewer] ✅ Model added:', objectId.slice(0, 8))
  } catch (err) {
    console.error('[SpeckleViewer] ❌ Add model error:', err)
    error.value = String(err)
  } finally {
    loadingCount.value--
    if (loadingCount.value === 0) loadProgress.value = 100
  }
}

// ─── EXPOSED API ─────────────────────────────────────────────────────────────

/** Fit camera to all loaded objects */
function fitView() {
  if (!cameraControllerRef) return
  try {
    cameraControllerRef.zoomExtents(0.95, true)
  } catch (e) {
    console.warn('fitView error:', e)
  }
}

/**
 * Select + zoom to specific objects by their Speckle IDs
 * Called from ModelTree when user clicks a node
 */
async function selectObjects(ids: string[]) {
  if (!viewerInstance || !cameraControllerRef) return
  try {
    // Highlight via SelectionExtension
    if (selectionExtRef && ids.length > 0) {
      selectionExtRef.selectObjects(ids)
    } else if (selectionExtRef) {
      selectionExtRef.clearSelection()
    }

    // Zoom camera to selected objects (chỉ khi được phép auto-zoom)
    if (ids.length > 0 && viewerStore.zoomOnSelect) {
      cameraControllerRef.setCameraView(ids, true, 0.85)
    }
  } catch (e) {
    console.warn('selectObjects error:', e)
  }
}

/** Clear all selection */
function clearSelection() {
  try {
    selectionExtRef?.clearSelection()
  } catch (e) { /* ignore */ }
}

/**
 * Display modes: default | wireframe | ghost
 * - default  → reset tất cả filters
 * - ghost    → isolate không có gì (= tất cả objects trở thành ghost)
 * - wireframe → hiện tại dùng ghost + custom overlay (Speckle không có native wireframe)
 */
function setDisplayMode(mode: DisplayMode) {
  if (!viewerInstance || !filteringExtRef) return
  currentDisplayMode = mode
  try {
    if (mode === 'default') {
      filteringExtRef.resetFilters()
    } else if (mode === 'ghost') {
      filteringExtRef.resetFilters()
      const allIds = getAllObjectIds()
      if (allIds.length > 0) {
        filteringExtRef.hideObjects(allIds, 'displayMode', false, true)
      }
    } else if (mode === 'wireframe') {
      filteringExtRef.resetFilters()
      const allIds = getAllObjectIds()
      if (allIds.length > 0) {
        filteringExtRef.hideObjects(allIds, 'displayMode', false, true)
      }
    }
    viewerInstance.requestRender()
  } catch (e) {
    console.warn('setDisplayMode error:', e)
  }
}

/** Helper: lấy tất cả object IDs có trong world tree */
function getAllObjectIds(): string[] {
  try {
    const wt = viewerInstance?.getWorldTree()
    if (!wt) return []
    const ids: string[] = []
    const walk = (node: any) => {
      const id = node?.model?.id ?? node?.model?.raw?.id
      if (id) ids.push(id)
      if (node?.children) {
        for (const c of node.children) walk(c)
      }
    }
    walk(wt.root)
    return ids
  } catch {
    return []
  }
}

/**
 * Section tool: toggle on/off section box
 * Khi bật, fit section box vào world bounding box
 */
function toggleSection(enabled: boolean) {
  if (!sectionToolRef || !viewerInstance) return
  try {
    if (enabled) {
      sectionToolRef.enabled = true
      const world = (viewerInstance as any).World
      if (world?.worldBox) {
        sectionToolRef.setBox(world.worldBox, 0.05)
      }
    } else {
      sectionToolRef.enabled = false
    }
    sectionActive = enabled
    emit('sectionToggled', enabled)
    viewerInstance.requestRender()
  } catch (e) {
    console.warn('toggleSection error:', e)
  }
}

/**
 * Measure tool: toggle bật/tắt đo khoảng cách
 */
function activateMeasure() {
  if (!measurementsExtRef) return
  try {
    measureActive = !measureActive
    measurementsExtRef.enabled = measureActive
    emit('measureToggled', measureActive)
    viewerInstance?.requestRender()
    console.log('[SpeckleViewer] 📏 Measure', measureActive ? 'ON' : 'OFF')
  } catch (e) {
    console.warn('activateMeasure error:', e)
  }
}

async function takeScreenshot(): Promise<string | undefined> {
  if (!viewerInstance) return
  try {
    const dataUrl: string = await viewerInstance.screenshot()
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `zfenix-viewer-${Date.now()}.png`
    a.click()
    return dataUrl
  } catch (e) {
    console.warn('screenshot error:', e)
  }
}

/**
 * Expose WorldTree for FilterPanel to scan available parameters
 */
function getWorldTree() {
  return viewerInstance?.getWorldTree?.()
}

/**
 * Apply color overrides by objectId groups.
 * Speckle's setUserObjectColors cần IDs c\u1ee7a WorldTree nodes, kh\u00f4ng ph\u1ea3i applicationId.
 */
async function applyColorFilter(colorGroups: Array<{ objectIds: string[], color: string }>) {
  if (!viewerInstance || !filteringExtRef) return
  try {
    const wt = viewerInstance.getWorldTree?.()
    
    // Build a lookup map: both raw.id and raw.applicationId → node's \u0022canonical\u0022 id
    // Speckle uses raw.id as the key for filtering
    const resolvedGroups = colorGroups.map(group => ({
      color: group.color,
      objectIds: group.objectIds // Pass as-is first, they should be raw.id values
    }))

    console.log('[SpeckleViewer] \ud83c\udfa8 applyColorFilter groups:', resolvedGroups.length)
    if (resolvedGroups.length > 0) {
      console.log('[SpeckleViewer] Sample objectIds:', resolvedGroups[0].objectIds.slice(0, 3), 'color:', resolvedGroups[0].color)
    }

    filteringExtRef.setUserObjectColors(resolvedGroups)
    viewerInstance.requestRender()
    console.log('[SpeckleViewer] \u2705 setUserObjectColors done')
  } catch (e) {
    console.error('[SpeckleViewer] applyColorFilter error:', e)
  }
}

/**
 * Clear all color overrides and return to original material colors
 */
function clearColorFilter() {
  if (!viewerInstance || !filteringExtRef) return
  try {
    filteringExtRef.setUserObjectColors([])
    filteringExtRef.resetFilters()
    viewerInstance.requestRender()
    console.log('[SpeckleViewer] 🗑️ Color filter cleared')
  } catch (e) {
    console.warn('clearColorFilter error:', e)
  }
}

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

// ─── LIFECYCLE ────────────────────────────────────────────────────────────────
onMounted(async () => {
  await nextTick()
  await new Promise(resolve => setTimeout(resolve, 150))
  await initViewer()
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  viewerInstance?.dispose()
  viewerInstance = null
})

// Watcher cho ẩn/hiện file (Visibility)
watch(
  () => viewerStore.loadedFiles.map(f => f.visible),
  async () => {
    const { FilteringExtension } = await import('@speckle/viewer')
    const filtering = viewerInstance?.getExtension(FilteringExtension)
    if (!filtering) return

    const hiddenObjectIds = viewerStore.loadedFiles
      .filter(f => !f.visible)
      .map(f => f.objectId)

    if (hiddenObjectIds.length > 0) {
      filtering.hideObjects(hiddenObjectIds, undefined, true)
    } else {
      filtering.showObjects(viewerStore.loadedFiles.map(f => f.objectId), undefined, true)
      filtering.resetFilters()
    }
  }
)

// Watcher cho selection (Store -> Viewer)
watch(
  () => viewerStore.selectedObjectId,
  (sid) => {
    if (sid) {
      selectObjects([sid])
    } else {
      clearSelection()
    }
  }
)
</script>

<style scoped>
.viewer-container {
  width: 100%;
  height: 100%;
  position: relative;
  background: #0f1729;
}

.overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(10, 15, 35, 0.8);
  z-index: 10;
}

.overlay-card {
  padding: 16px 24px;
  border-radius: 10px;
  background: rgba(15, 23, 42, 0.97);
  color: #f9fafb;
  font-size: 14px;
  min-width: 220px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6);
  border: 1px solid rgba(99, 102, 241, 0.3);
}

.overlay-card.error {
  border-color: #ef4444;
}

.progress-text {
  margin-bottom: 10px;
  font-weight: 500;
}

.progress-bar {
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #6366f1, #8b5cf6);
  border-radius: 2px;
  transition: width 0.3s ease;
}

.progress-hint {
  margin-top: 8px;
  font-size: 11px;
  color: #9ca3af;
}

.error-message {
  margin-top: 6px;
  font-size: 12px;
  color: #fca5a5;
  word-break: break-all;
}

.retry-btn {
  margin-top: 12px;
  padding: 6px 14px;
  border-radius: 6px;
  border: 1px solid #6366f1;
  background: transparent;
  color: #a5b4fc;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.15s;
}
.retry-btn:hover {
  background: rgba(99, 102, 241, 0.15);
}
</style>
