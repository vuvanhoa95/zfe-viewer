<template>
  <div class="model-tree">
    <!-- Header + Search -->
    <div class="tree-header">
      <div class="header-top">
        <span class="tree-title">📁 {{ $t('layout.modelTree') }}</span>
        <button class="expand-all-btn" @click="expandAll = !expandAll">
           {{ expandAll ? 'Thu gọn' : 'Mở rộng hết' }}
        </button>
      </div>
      <input
        v-model="searchInput"
        :placeholder="$t('layout.searchPlaceholder')"
        class="tree-search"
      />
    </div>

    <!-- Nodes list -->
    <div class="tree-container" role="tree">
      <!-- Loading skeleton -->
      <template v-if="isModelLoading">
        <div class="skeleton-item" v-for="i in 8" :key="i"></div>
      </template>

      <!-- Empty state -->
      <div v-else-if="treeNodes.length === 0" class="empty-state">
        <div class="empty-icon">📂</div>
        <div>Chưa tải mô hình</div>
      </div>

      <!-- Recursive Tree Nodes -->
      <div v-else class="tree-items">
        <ModelTreeNode 
          v-for="rootNode in filteredTree" 
          :key="rootNode.speckleId" 
          :node="rootNode" 
          :depth="0"
          :selected-id="selectedObjectId"
          @select="(id) => viewerStore.selectByObjectId(id)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useViewerStore, type TreeNode } from '@/stores/viewer'
import ModelTreeNode from './ModelTreeNode.vue'

const viewerStore = useViewerStore()
const { treeNodes, selectedObjectId, modelLoaded } = storeToRefs(viewerStore)

// Local state
const searchInput = ref('')
const searchQuery = ref('')
const expandAll = ref(false)
let searchDebounce: ReturnType<typeof setTimeout> | undefined

// Debounce search
watch(searchInput, value => {
  clearTimeout(searchDebounce)
  searchDebounce = setTimeout(() => { searchQuery.value = value }, 200)
})

// Loading state
const isModelLoading = computed(() =>
  viewerStore.currentStreamId !== null && !modelLoaded.value
)

// Filtering recursively
const filteredTree = computed(() => {
  const q = searchQuery.value.toLowerCase()
  if (!q) return treeNodes.value

  const filterNode = (node: TreeNode): TreeNode | null => {
    const isMatched = 
      node.name.toLowerCase().includes(q) || 
      node.type.toLowerCase().includes(q)
    
    const filteredChildren = node.children
      ? node.children.map(filterNode).filter(Boolean) as TreeNode[]
      : []
    
    if (isMatched || filteredChildren.length > 0) {
      return { 
        ...node, 
        children: filteredChildren.length > 0 ? filteredChildren : undefined 
      }
    }
    return null
  }

  return treeNodes.value.map(filterNode).filter(Boolean) as TreeNode[]
})
</script>

<style scoped>
.model-tree {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
}

.tree-header {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 0 4px;
}

.header-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.tree-title {
  font-size: 13px;
  font-weight: 600;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.expand-all-btn {
  background: none;
  border: none;
  color: #6366f1;
  font-size: 11px;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
}
.expand-all-btn:hover {
  background: rgba(99, 102, 241, 0.1);
}

.tree-search {
  width: 100%;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid #1e293b;
  background: #0f172a;
  color: #e5e7eb;
  font-size: 13px;
  outline: none;
}
.tree-search:focus {
  border-color: #6366f1;
}

/* ── Container ─────────────────────────────────── */
.tree-container {
  flex: 1;
  overflow-y: auto;
  padding-right: 4px;
}

.tree-items {
  display: flex;
  flex-direction: column;
}

/* ── Skeleton ─────────────────────────────────── */
.skeleton-item {
  height: 32px;
  margin-bottom: 4px;
  border-radius: 6px;
  background: linear-gradient(90deg, #1e293b 25%, #273548 50%, #1e293b 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: #475569;
  text-align: center;
}

.empty-icon {
  font-size: 32px;
  margin-bottom: 12px;
  opacity: 0.4;
}

/* Custom scrollbar */
.tree-container::-webkit-scrollbar {
  width: 4px;
}
.tree-container::-webkit-scrollbar-thumb {
  background: #334155;
  border-radius: 10px;
}
</style>
