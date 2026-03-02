<template>
  <div class="props-panel" @click="closeAllMenus">
    <div class="props-header">
      <div class="header-main">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" class="header-icon">
          <path d="M4 6h16M4 12h16M4 18h7" stroke-width="2" stroke-linecap="round"/>
        </svg>
        <span>Thuộc tính cấu kiện</span>
      </div>
    </div>

    <div v-if="!hasProperties" class="props-empty">
      <div class="empty-icon">🖱️</div>
      <p>Chọn một đối tượng 3D để xem thông tin chi tiết</p>
    </div>

    <div v-else class="props-content">
      <!-- Element Identity -->
      <div class="element-identity">
        <div class="id-row">
          <span class="id-label">GUID:</span>
          <span class="id-value" :title="guid">{{ guid }}</span>
          <button class="mini-action-btn" @click="copyToClipboard(guid)" title="Copy GUID">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" stroke-width="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke-width="2"></path></svg>
          </button>
        </div>
        <div class="type-badge" v-if="typeLabel">
          {{ typeLabel }}
        </div>
      </div>

      <!-- Pinned Properties Group (New) -->
      <div v-if="pinnedProperties.size > 0" class="props-group pinned">
        <div class="group-header pinned-header">
          <span class="group-title">📌 Thuộc tính đã ghim</span>
        </div>
        <div class="group-body">
           <div v-for="propKey in pinnedProperties" :key="propKey" class="prop-row">
              <div class="prop-key">{{ formatKey(propKey) }}</div>
              <div class="prop-value-container">
                <span class="prop-value">{{ formatValue(findPropValue(propKey)) }}</span>
                <div class="prop-actions">
                  <button class="action-trigger" @click.stop="toggleMenu(propKey, $event)">•••</button>
                </div>
              </div>
              <!-- Action Menu -->
              <div v-if="activeMenuId === propKey" class="action-menu" :style="menuStyle">
                <button @click="copyValue(propKey)">Copy value</button>
                <button @click="filterByValue(propKey)">Filter model by value</button>
                <button @click="togglePin(propKey)">Unpin property</button>
              </div>
           </div>
        </div>
      </div>

      <!-- All Other Groups -->
      <div v-for="(group, groupName) in groupedProperties" :key="groupName" class="props-group">
        <button 
          class="group-header" 
          @click="toggleGroup(groupName)"
          :class="{ 'is-collapsed': collapsedGroups.has(groupName) }"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" class="chevron">
            <path d="M6 9l6 6 6-6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span class="group-title">{{ groupName }}</span>
          <span class="group-count">{{ Object.keys(group).length }}</span>
        </button>

        <div v-if="!collapsedGroups.has(groupName)" class="group-body">
          <div v-for="(value, key) in group" :key="key" class="prop-row">
            <div class="prop-key">{{ formatKey(key) }}</div>
            <div class="prop-value-container">
              <div class="prop-value" :title="String(value)">{{ formatValue(value) }}</div>
              <div class="prop-actions">
                <button class="action-trigger" @click.stop="toggleMenu(key, $event)">•••</button>
              </div>
            </div>

            <!-- Action Menu -->
            <div v-if="activeMenuId === key" class="action-menu" :style="menuStyle">
              <button @click="copyValue(key, value)">Copy value</button>
              <button @click="filterByValue(key, value)">Filter model by value</button>
              <button @click="togglePin(key)">{{ pinnedProperties.has(key) ? 'Unpin' : 'Pin' }} property</button>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Toast for copy success -->
    <Transition name="fade">
      <div v-if="toastMsg" class="prop-toast">{{ toastMsg }}</div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, reactive, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  properties: Record<string, unknown> | null
}>()

const collapsedGroups = ref(new Set<string>())
const pinnedProperties = ref(new Set<string>())
const activeMenuId = ref<string | null>(null)
const toastMsg = ref('')
const menuStyle = reactive({ top: '0px', right: '0px' })

const hasProperties = computed(() => !!props.properties && Object.keys(props.properties).length > 0)

const guid = computed(() => {
  return (props.properties?.['ifcGuid'] ?? props.properties?.['GlobalId'] ?? props.properties?.['id'] ?? 'N/A') as string
})

const typeLabel = computed(() => {
  const type = (props.properties?.['ifcType'] ?? props.properties?.['type'] ?? props.properties?.['speckle_type']) as string | undefined
  if (!type) return ''
  return type.split('.').pop()
})

const groupedProperties = computed(() => {
  if (!props.properties) return {}
  const result: Record<string, Record<string, unknown>> = {}
  const skipKeys = ['ifcType', 'type', 'id', 'applicationId', 'speckle_type', 'totalChildrenCount', 'ifcGuid', 'renderMaterial']

  for (const [key, value] of Object.entries(props.properties)) {
    if (skipKeys.includes(key)) continue
    if (key.startsWith('__')) continue

    let groupName = '📍 Thông tin chung'
    let displayKey = key
    let displayValue = value

    if (key.startsWith('pset_')) {
      groupName = '📋 ' + key.replace('pset_', '')
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        const subObj = value as Record<string, unknown>
        if (!result[groupName]) result[groupName] = {}
        for (const [sKey, sVal] of Object.entries(subObj)) {
            if (sKey === 'speckle_type') continue
            result[groupName][sKey] = sVal
        }
        continue
      }
    } else if (key === 'materials') {
      groupName = '🎨 Vật liệu'
      if (Array.isArray(value) && value.length > 0) {
        displayValue = value.map(m => m.name || m.Name || 'IFC Material').join(', ')
      }
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
       const subObj = value as Record<string, any>
       if (subObj.name || subObj.Name) displayValue = subObj.name || subObj.Name
       else {
         const subGroupName = '📦 ' + key
         if (!result[subGroupName]) result[subGroupName] = {}
         for (const [sKey, sVal] of Object.entries(subObj)) {
            if (sKey === 'speckle_type') continue
            result[subGroupName][sKey] = sVal
         }
         continue
       }
    }

    if (!result[groupName]) result[groupName] = {}
    result[groupName][displayKey] = displayValue
  }

  for (const g in result) {
    if (Object.keys(result[g]).length === 0) delete result[g]
  }
  return result
})

// Actions
function toggleMenu(id: string, event: MouseEvent) {
  if (activeMenuId.value === id) {
    activeMenuId.value = null
  } else {
    activeMenuId.value = id
    // Đảm bảo menu không bị khuất
    menuStyle.top = `${event.clientY - 10}px`
    // Do panel nằm bên phải, ta dùng fixed position cho menu
  }
}

function closeAllMenus() {
  activeMenuId.value = null
}

function copyValue(key: string, value?: any) {
  const val = value || findPropValue(key)
  copyToClipboard(String(val))
  closeAllMenus()
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text)
  toastMsg.value = 'Đã sao chép!'
  setTimeout(() => { toastMsg.value = '' }, 2000)
}

function filterByValue(key: string, value?: any) {
  // TODO: Emit sự kiện ra Viewer để lọc cấu kiện
  console.log('Filter model by:', key, value)
  toastMsg.value = 'Đang lọc model...'
  setTimeout(() => { toastMsg.value = '' }, 2000)
  closeAllMenus()
}

function togglePin(key: string) {
  if (pinnedProperties.value.has(key)) {
    pinnedProperties.value.delete(key)
  } else {
    pinnedProperties.value.add(key)
  }
  closeAllMenus()
}

function toggleGroup(name: string) {
  if (collapsedGroups.value.has(name)) {
    collapsedGroups.value.delete(name)
  } else {
    collapsedGroups.value.add(name)
  }
}

function findPropValue(key: string): any {
  if (!props.properties) return '-'
  // Khám phá sâu nếu cần (placeholder logic)
  if (props.properties[key]) return props.properties[key]
  // Kiểm tra trong Psets
  for (const v of Object.values(props.properties)) {
    if (typeof v === 'object' && v !== null && (v as any)[key] !== undefined) {
      return (v as any)[key]
    }
  }
  return '-'
}

function formatKey(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').replace(/^pset_/, '').trim()
}

function formatValue(value: unknown): string {
  if (value == null) return '-'
  if (typeof value === 'boolean') return value ? 'Đúng' : 'Sai'
  if (typeof value === 'number') {
    if (!Number.isInteger(value)) return value.toFixed(3)
    return value.toString()
  }
  return String(value)
}

// Global click to close menu
onMounted(() => {
  window.addEventListener('scroll', closeAllMenus, true)
})
onUnmounted(() => {
  window.removeEventListener('scroll', closeAllMenus, true)
})
</script>

<style scoped>
.props-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #0f172a;
  color: #f1f5f9;
  position: relative;
}

.props-header {
  padding: 12px 16px;
  background: #1e293b;
  border-bottom: 1px solid #334155;
}

.header-main {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #94a3b8;
}

.header-icon {
  color: #6366f1;
}

.props-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

/* Element Identity */
.element-identity {
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid #1e293b;
}

.id-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  margin-bottom: 8px;
}

.id-label { color: #475569; }
.id-value { color: #94a3b8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.mini-action-btn {
  background: none; border: none; color: #475569; cursor: pointer; padding: 2px; border-radius: 4px;
}
.mini-action-btn:hover { color: #818cf8; background: rgba(99,102,241,0.1); }

.type-badge {
  display: inline-block; padding: 4px 12px; background: rgba(99, 102, 241, 0.15);
  border: 1px solid rgba(99, 102, 241, 0.3); color: #818cf8; border-radius: 6px;
  font-size: 12px; font-weight: 600;
}

/* Groups */
.props-group { margin-bottom: 4px; }
.props-group.pinned { margin-bottom: 20px; border: 1px dashed rgba(99,102,241,0.3); border-radius: 8px; overflow: hidden; }
.pinned-header { background: rgba(99,102,241,0.1) !important; color: #818cf8 !important; pointer-events: none; }

.group-header {
  width: 100%; display: flex; align-items: center; gap: 8px; background: #1e293b; border: none;
  border-radius: 6px; padding: 8px 12px; cursor: pointer; color: #cbd5e1; transition: background 0.2s;
}
.group-header:hover { background: #334155; }
.chevron { transition: transform 0.2s; color: #64748b; }
.group-header.is-collapsed .chevron { transform: rotate(-90deg); }
.group-title { flex: 1; text-align: left; font-size: 12px; font-weight: 600; }
.group-count { font-size: 10px; background: rgba(0,0,0,0.2); padding: 1px 6px; border-radius: 4px; color: #64748b; }
.group-body { padding: 4px 8px 12px; }

/* Prop Rows */
.prop-row {
  display: flex; align-items: flex-start; padding: 6px 4px; border-bottom: 1px solid rgba(255,255,255,0.03);
  font-size: 12px; position: relative;
}
.prop-row:hover { background: rgba(255,255,255,0.02); }

.prop-key { flex: 1; color: #64748b; padding-right: 8px; word-break: break-word; }

.prop-value-container {
  flex: 1.5; display: flex; align-items: center; justify-content: flex-end; gap: 8px; min-width: 0;
}
.prop-value { color: #e2e8f0; word-break: break-all; text-align: right; }

/* Action Buttons */
.prop-actions { opacity: 0; transition: opacity 0.2s; }
.prop-row:hover .prop-actions { opacity: 1; }

.action-trigger {
  background: #334155; border: none; color: #cbd5e1; border-radius: 4px; padding: 0 4px;
  cursor: pointer; font-weight: bold; line-height: 1.2;
}
.action-trigger:hover { background: #475569; color: white; }

/* Action Menu Overlay */
.action-menu {
  position: fixed; z-index: 1000; background: #1e293b; border: 1px solid #334155;
  border-radius: 8px; padding: 4px; box-shadow: 0 8px 24px rgba(0,0,0,0.5);
  display: flex; flex-direction: column; min-width: 140px; transform: translateX(-100%);
}
.action-menu button {
  background: none; border: none; padding: 8px 12px; text-align: left; color: #cbd5e1;
  font-size: 12px; cursor: pointer; border-radius: 4px;
}
.action-menu button:hover { background: #334155; color: white; }

/* Toast */
.prop-toast {
  position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%);
  background: #6366f1; color: white; padding: 6px 16px; border-radius: 20px;
  font-size: 12px; box-shadow: 0 4px 12px rgba(99,102,241,0.4); pointer-events: none;
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.3s, transform 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; transform: translate(-50%, 10px); }

/* Scrollbar */
.props-content::-webkit-scrollbar { width: 4px; }
.props-content::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
</style>
