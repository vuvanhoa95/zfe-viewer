<template>
  <div class="filter-panel" :class="{ 'is-open': isOpen }">
    <!-- Trigger Button (Hidden if inline) -->
    <button v-if="!inline" class="filter-trigger" @click="isOpen = !isOpen" :class="{ active: hasActiveFilter }" :title="hasActiveFilter ? 'Filter đang bật' : 'Filter theo Parameter'">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
      </svg>
      <span class="trigger-label">Color by</span>
      <span v-if="hasActiveFilter" class="active-dot"></span>
    </button>

    <!-- Dropdown Panel / Inline Panel -->
    <Transition name="panel-slide">
      <div v-show="inline || isOpen" class="filter-dropdown" :class="{ 'is-inline': inline }" @click.stop>
        <div class="panel-header">
          <span class="panel-title">🎨 Tô màu theo Thuộc tính</span>
          <button v-if="!inline" class="close-btn" @click="isOpen = false">✕</button>
        </div>

        <!-- Step 1: Pick Parameter -->
        <div class="panel-section">
          <label class="section-label">Chọn thuộc tính</label>
          <div class="search-box" :class="{ 'search-box--inline': inline }">
            <input
              v-model="paramSearch"
              placeholder="Tìm thuộc tính..."
              class="param-search"
              @focus="showParamList = true"
            />
            <div v-if="showParamList && filteredParams.length > 0" class="param-list" :class="{ 'param-list--inline': inline }">
              <button
                v-for="p in filteredParams.slice(0, 500)"
                :key="p"
                class="param-item"
                :class="{ selected: p === selectedParam }"
                @click="selectParam(p)"
              >
                <span class="param-name">{{ formatParamName(p) }}</span>
                <span class="param-path">{{ p }}</span>
              </button>
            </div>
          </div>
          <div v-if="selectedParam" class="selected-param-badge">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
            {{ formatParamName(selectedParam) }}
            <button @click="clearParam" class="badge-clear">✕</button>
          </div>
        </div>

        <!-- Controls: Áp dụng + Xóa filter + Auto màu -->
        <div class="panel-footer">
          <button
            class="btn-apply"
            :disabled="!selectedParam || paramValues.length === 0"
            @click="applyColorFilter"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
            Áp dụng
          </button>
          <button v-if="hasActiveFilter" class="btn-reset" @click="resetFilter">
            Xóa filter
          </button>
          <button class="auto-palette-btn" @click="autoAssignColors" title="Tự động gán màu">
            🎨 Auto màu
          </button>
        </div>

        <!-- Danh sách giá trị và màu -->
        <div v-if="selectedParam && paramValues.length > 0" class="panel-section">
          <div class="values-header">
            <label class="section-label">{{ paramValues.length }} giá trị</label>
          </div>
          <div class="values-list">
            <div v-for="pv in paramValues" :key="pv.value" class="value-row">
              <div class="color-swatch-wrapper">
                <input type="color" v-model="pv.color" class="color-swatch" :title="'Màu cho: ' + pv.value" />
              </div>
              <div class="value-info">
                <span class="value-label" :title="pv.value">{{ pv.value || '(trống)' }}</span>
                <span class="value-count">{{ pv.count }} đối tượng</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Đang quét -->
        <div v-else-if="selectedParam && isScanning" class="panel-section loading-state">
          <div class="spinner"></div>
          <span>Đang quét model...</span>
        </div>

        <!-- Không có giá trị -->
        <div v-else-if="selectedParam && paramValues.length === 0 && !isScanning" class="panel-section empty-values">
          Không tìm thấy giá trị nào cho thuộc tính này.
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useViewerStore } from '@/stores/viewer'

const props = defineProps<{
  viewerRef: any  // Ref to SpeckleViewer component
  inline?: boolean // Default false
}>()

const viewerStore = useViewerStore()

const isOpen = ref(false)
const paramSearch = ref('')
const showParamList = ref(false)
const selectedParam = ref('')
const paramValues = ref<Array<{ value: string; color: string; count: number; objectIds: string[] }>>([])
const isScanning = ref(false)
const hasActiveFilter = ref(false)

// ─── Available parameters from world tree ─────────────────────────────────────
const availableParams = ref<string[]>([])

// Scan world tree to collect all unique parameter names
function scanAvailableParams() {
  if (!props.viewerRef) return
  const viewer = props.viewerRef as any
  if (!viewer.getWorldTree) return
  
  // Fallback: use common IFC property names + known pset_ keys from loaded data
  const commonParams = [
    'ifcType', 'name', 'type',
    // Common IFC Psets
    'Pset_WallCommon.FireRating',
    'Pset_WallCommon.IsExternal', 
    'Pset_SlabCommon.IsExternal',
    'Pset_BeamCommon.FireRating',
    'Pset_ColumnCommon.FireRating',
    'Pset_BuildingStoreyCommon.AboveGround',
  ]

  // Try to extract from loaded objects
  const worldTree = viewer.getWorldTree ? viewer.getWorldTree() : null
  if (worldTree) {
    const paramSet = new Set<string>(['ifcType', 'name', 'type'])
    const scanNode = (node: any, depth = 0) => {
      if (depth > 20 || !node) return 
      
      const raw = node.model?.raw || {}
      
      // Bỏ qua các object rác không mang tính chất cấu kiện (như RenderMaterial)
      const speckleType = raw.speckle_type || ''
      if (!speckleType.includes('RenderMaterial') && !speckleType.includes('Chunk')) {
        
        for (const k of Object.keys(raw)) {
          // Bỏ qua các tham số kỹ thuật nội bộ của Speckle
          if (!k.startsWith('__') && !k.startsWith('@') && !['id', 'applicationId', 'speckle_type', 'units', 'displayValue', 'bbox', 'renderMaterial', 'totalChildrenCount'].includes(k)) {
            
            if (typeof raw[k] === 'object' && raw[k] !== null && !Array.isArray(raw[k])) {
               // Thuộc tính dạng nhóm (Psets, Qto, ..)
               for (const subk of Object.keys(raw[k])) {
                 if (subk !== 'speckle_type' && subk !== 'id') {
                   paramSet.add(`${k}.${subk}`)
                 }
               }
            } else {
               // Thuộc tính phẳng trực tiếp
               paramSet.add(k)
            }
          }
        }
      }
      
      if (node.children) {
        for (const c of node.children) scanNode(c, depth + 1)
      }
    }
    
    // Bắt đầu quét từ gốc
    if (worldTree.root?.children) {
      for (const child of worldTree.root.children) scanNode(child, 0)
    }
    
    // Convert to array and sort alphabetically
    availableParams.value = [...paramSet].sort((a, b) => a.localeCompare(b))
  } else {
    availableParams.value = commonParams
  }
}

// Re-scan when viewer has models
watch(() => viewerStore.treeNodes.length, (n) => {
  if (n > 0) scanAvailableParams()
}, { immediate: true })

watch(() => props.viewerRef, () => {
  if (viewerStore.treeNodes.length > 0) scanAvailableParams()
})

const filteredParams = computed(() => {
  const q = paramSearch.value.toLowerCase()
  const list = availableParams.value.length > 0
    ? availableParams.value
    : ['ifcType', 'name', 'type']
  return q ? list.filter(p => p.toLowerCase().includes(q)) : list
})

function formatParamName(key: string): string {
  if (key === 'ifcType') return 'IFC Type'
  if (key === 'name') return 'Tên'
  if (key === 'type') return 'Loại'
  return key.replace('pset_', '').replace(/_/g, ' ').replace(/\./g, ' › ')
}

function selectParam(p: string) {
  selectedParam.value = p
  paramSearch.value = ''
  showParamList.value = false
  scanParamValues(p)
}

function clearParam() {
  selectedParam.value = ''
  paramValues.value = []
  paramSearch.value = ''
}

// ─── Scan world tree for unique values of selected param ──────────────────────
function getNestedValue(raw: any, key: string): any {
  // Handle dotted keys like 'pset_Foo.Bar'
  const parts = key.split('.')
  let obj = raw
  for (const part of parts) {
    if (obj == null) return undefined
    obj = obj[part]
  }
  return obj
}

async function scanParamValues(param: string) {
  if (!props.viewerRef) return
  const viewer = props.viewerRef as any
  const worldTree = viewer.getWorldTree ? viewer.getWorldTree() : null
  if (!worldTree) return

  isScanning.value = true
  paramValues.value = []

  await new Promise(r => setTimeout(r, 50))  // Yield to UI

  const groups = new Map<string, { count: number; objectIds: string[] }>()

  const scanNode = (node: any, depth = 0) => {
    if (depth > 20 || !node) return 
    const raw = node.model?.raw || {}

    // Bỏ qua RenderMaterial và Chunk (không phải cấu kiện)
    const spType = raw.speckle_type || ''
    if (spType.includes('RenderMaterial') || spType.includes('Chunk')) return

    const val = getNestedValue(raw, param)

    if (val !== undefined && val !== null && String(val).trim() !== '') {
      const strVal = String(val)
      // Thu thập CẢ hai loại ID: Speckle hash (id) và IFC GUID (applicationId)
      // vì setUserObjectColors có thể dùng một trong hai
      const speckleId = raw.id
      const appId = raw.applicationId
      if (speckleId || appId) {
        if (!groups.has(strVal)) groups.set(strVal, { count: 0, objectIds: [] })
        const g = groups.get(strVal)!
        // Dùng Speckle id làm chính (World Tree sử dụng Speckle hash)
        const idToUse = speckleId || appId
        const sid = String(idToUse)
        if (sid && !g.objectIds.includes(sid)) {
          g.count++
          g.objectIds.push(sid)
        }
      }
    }
    if (node.children) for (const c of node.children) scanNode(c, depth + 1)
  }

  if (worldTree.root?.children) {
    for (const c of worldTree.root.children) scanNode(c)
  }

  // Build result list (không gán màu ngay, sẽ gán sau khi sort)
  for (const [value, { count, objectIds }] of groups.entries()) {
    paramValues.value.push({ value, count, objectIds, color: '#888888' })
  }

  // Sort by count desc
  paramValues.value.sort((a, b) => b.count - a.count)
  
  // Tự động gán màu sau khi đã sort
  const finalPalette = generatePalette(paramValues.value.length)
  paramValues.value.forEach((pv, i) => {
    pv.color = finalPalette[i] || '#888888'
  })
  
  isScanning.value = false
}

// ─── Color utilities ──────────────────────────────────────────────────────────
const PALETTE = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
  '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#fb7185', '#fb923c', '#facc15', '#4ade80',
]

/** Always return valid #RRGGBB hex colors (required for <input type=color>) */
function generatePalette(count: number): string[] {
  if (count <= PALETTE.length) return PALETTE.slice(0, count)
  // Sinh màu HSL và chuyển sang hex thực sự (input[type=color] không chấp nhận hsl())
  return Array.from({ length: count }, (_, i) => {
    const hue = (i * 137.508) % 360
    const sat = 0.65
    const lig = 0.55
    const [r, g, b] = hslToRgb(hue, sat, lig)
    return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`
  })
}

function autoAssignColors() {
  const palette = generatePalette(paramValues.value.length)
  paramValues.value.forEach((pv, i) => {
    pv.color = palette[i] || '#888888'
  })
}

function hexToInt(hex: string): number {
  // Convert #rgb or hsl() to int ARGB for Speckle
  let h = hex.trim()
  if (h.startsWith('hsl')) {
    // Parse hsl and convert to hex-ish (simplified)
    const m = h.match(/hsl\((\d+\.?\d*),\s*(\d+)%,\s*(\d+)%\)/)
    if (m) {
      const [hue, sat, lig] = [parseFloat(m[1]), parseInt(m[2])/100, parseInt(m[3])/100]
      const rgb = hslToRgb(hue, sat, lig)
      const val = (0xFF << 24) | (rgb[0] << 16) | (rgb[1] << 8) | rgb[2]
      return val > 0x7FFFFFFF ? val - 0x100000000 : val
    }
  }
  const r = parseInt(h.slice(1, 3), 16)
  const g = parseInt(h.slice(3, 5), 16)
  const b = parseInt(h.slice(5, 7), 16)
  const val = (0xFF << 24) | (r << 16) | (g << 8) | b
  return val > 0x7FFFFFFF ? val - 0x100000000 : val
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = h / 360
  let r, g, b
  if (s === 0) { r = g = b = l }
  else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1/3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1/3)
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]
}

function hue2rgb(p: number, q: number, t: number): number {
  if (t < 0) t += 1; if (t > 1) t -= 1
  if (t < 1/6) return p + (q - p) * 6 * t
  if (t < 1/2) return q
  if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
  return p
}

// ─── Apply / Reset filter ─────────────────────────────────────────────────────
function applyColorFilter() {
  if (!props.viewerRef || paramValues.value.length === 0) return
  const viewer = props.viewerRef as any

  // Build color groups theo đúng format của Speckle API:
  // setUserObjectColors(groups: {objectIds: string[], color: string}[])
  // color phải là hex string như '#ff0000', KHÔNG phải ARGB int
  const colorGroups = paramValues.value
    .filter(pv => pv.objectIds.length > 0)
    .map(pv => ({
      objectIds: pv.objectIds,
      color: pv.color, // hex string trực tiếp, ví dụ: '#ef4444'
    }))

  console.log('[FilterPanel] 🎨 Applying color groups:', colorGroups.length, colorGroups)

  if (viewer.applyColorFilter) {
    viewer.applyColorFilter(colorGroups)
    hasActiveFilter.value = true
    viewerStore.setActiveColorFilter({ param: selectedParam.value, groups: paramValues.value.map(pv => ({ ...pv })) })
  }
}

function resetFilter() {
  if (!props.viewerRef) return
  const viewer = props.viewerRef as any
  if (viewer.clearColorFilter) {
    viewer.clearColorFilter()
    hasActiveFilter.value = false
    viewerStore.clearActiveColorFilter()
  }
}
</script>

<style scoped>
.filter-panel {
  position: relative;
}

/* Trigger Button */
.filter-trigger {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #94a3b8;
  border-radius: 8px;
  padding: 6px 12px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.2s;
  position: relative;
}

.filter-trigger:hover, .filter-trigger.active {
  background: rgba(99, 102, 241, 0.15);
  border-color: rgba(99, 102, 241, 0.4);
  color: #a5b4fc;
}

.active-dot {
  width: 7px; height: 7px;
  background: #6366f1;
  border-radius: 50%;
  position: absolute;
  top: -2px; right: -2px;
  box-shadow: 0 0 6px #6366f1;
}

/* Dropdown & Inline Layout */
.filter-dropdown {
  background: #1e293b;
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.filter-dropdown:not(.is-inline) {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  width: 320px;
  border: 1px solid #334155;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.6);
  z-index: 1000;
}

.filter-dropdown.is-inline {
  position: relative;
  width: 100%;
  flex: 1;
  background: transparent;
  border-radius: 0;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px 10px;
  background: rgba(99, 102, 241, 0.08);
  border-bottom: 1px solid #334155;
}

.panel-title {
  font-size: 13px;
  font-weight: 600;
  color: #e2e8f0;
}

.close-btn {
  background: none; border: none; color: #64748b; cursor: pointer;
  font-size: 14px; padding: 2px 6px; border-radius: 4px;
}
.close-btn:hover { color: #e2e8f0; background: rgba(255,255,255,0.05); }

.panel-section {
  padding: 14px 16px;
  border-bottom: 1px solid #1e293b;
}

.section-label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 8px;
}

/* Param search */
.search-box { position: relative; }

.param-search {
  width: 100%;
  padding: 8px 12px;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 8px;
  color: #e2e8f0;
  font-size: 13px;
  outline: none;
  box-sizing: border-box;
}
.param-search:focus { border-color: #6366f1; }

.param-list {
  position: absolute;
  top: calc(100% + 4px);
  left: 0; right: 0;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 8px;
  max-height: 400px;
  overflow-y: auto;
  z-index: 100;
  box-shadow: 0 8px 24px rgba(0,0,0,0.4);
}

/* Khi ở chế độ inline (trong sidebar), chuyển sang flow tự nhiên để tránh bị cắt bởi overflow:hidden */
.param-list--inline {
  position: relative;
  top: 4px;
  max-height: calc(100vh - 320px);
  border-radius: 8px;
  z-index: 10;
}

.filter-dropdown.is-inline .param-list {
  max-height: calc(100vh - 300px);
}

.param-item {
  display: flex;
  flex-direction: column;
  padding: 8px 12px;
  background: none;
  border: none;
  color: #cbd5e1;
  cursor: pointer;
  width: 100%;
  text-align: left;
}
.param-item:hover, .param-item.selected { background: rgba(99,102,241,0.12); }
.param-name { font-size: 13px; font-weight: 500; }
.param-path { font-size: 10px; color: #64748b; }

.selected-param-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(99, 102, 241, 0.15);
  border: 1px solid rgba(99, 102, 241, 0.3);
  color: #a5b4fc;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 12px;
  margin-top: 8px;
}
.badge-clear { background: none; border: none; color: #6366f1; cursor: pointer; padding: 0; font-size: 11px; }

/* Values list */
.values-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.auto-palette-btn {
  background: rgba(99,102,241,0.1);
  border: 1px solid rgba(99,102,241,0.2);
  color: #818cf8;
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 6px;
  cursor: pointer;
}
.auto-palette-btn:hover { background: rgba(99,102,241,0.2); }

.values-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-bottom: 8px;
}

.filter-dropdown:not(.is-inline) .values-list {
  max-height: 220px;
}

.value-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  background: rgba(0,0,0,0.2);
  border-radius: 6px;
  border: 1px solid #1e293b;
  transition: background 0.15s;
}
.value-row:hover { background: rgba(99,102,241,0.05); }

.color-swatch-wrapper {
  flex-shrink: 0;
  width: 28px; height: 28px;
  border-radius: 6px;
  overflow: hidden;
  border: 2px solid #334155;
}
.color-swatch {
  width: 100%; height: 100%;
  border: none;
  padding: 0;
  cursor: pointer;
  background: none;
}

.value-info { flex: 1; min-width: 0; }
.value-label {
  display: block;
  font-size: 12px;
  color: #e2e8f0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.value-count { font-size: 10px; color: #64748b; }

/* Footer */
.panel-footer {
  padding: 12px 16px;
  display: flex;
  gap: 8px;
  background: #1e293b;
  border-top: 1px solid #334155;
}

.filter-dropdown.is-inline .panel-footer {
  background: transparent;
  border-top: none;
  padding: 12px 0 0 0;
}

.btn-apply {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 9px 0;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  border: none;
  border-radius: 8px;
  color: white;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}
.btn-apply:hover:not(:disabled) { opacity: 0.9; }
.btn-apply:disabled { opacity: 0.4; cursor: not-allowed; }

.btn-reset {
  padding: 9px 14px;
  background: rgba(239,68,68,0.1);
  border: 1px solid rgba(239,68,68,0.3);
  color: #fca5a5;
  border-radius: 8px;
  font-size: 12px;
  cursor: pointer;
}
.btn-reset:hover { background: rgba(239,68,68,0.2); }

/* Loading */
.loading-state {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #64748b;
  font-size: 13px;
}
.spinner {
  width: 16px; height: 16px;
  border: 2px solid #334155;
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.empty-values {
  font-size: 12px;
  color: #64748b;
  text-align: center;
}

/* Scrollbar */
.values-list::-webkit-scrollbar, .param-list::-webkit-scrollbar { width: 4px; }
.values-list::-webkit-scrollbar-thumb, .param-list::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }

/* Transitions */
.panel-slide-enter-active, .panel-slide-leave-active { transition: opacity 0.2s, transform 0.2s; }
.panel-slide-enter-from, .panel-slide-leave-to { opacity: 0; transform: translateY(-8px); }
</style>
