<template>
  <div class="tree-node-wrapper">
    <div 
      class="tree-node"
      :class="{ 
        'is-selected': isSelected,
        'has-children': node.children && node.children.length > 0
      }"
      :style="{ paddingLeft: `${depth * 16}px` }"
      @click="handleClick"
    >
      <div 
        v-if="node.children && node.children.length > 0" 
        class="expand-icon"
        :class="{ 'is-expanded': expanded }"
        @click.stop="expanded = !expanded"
      >
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor">
          <path d="M9 5l7 7-7 7" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <div v-else class="expand-spacer"></div>

      <div class="node-icon">
        <span v-if="depth === 0">📦</span>
        <span v-else-if="node.children && node.children.length > 0">📁</span>
        <span v-else>📄</span>
      </div>

      <div class="node-content">
        <span class="node-name" :title="node.name">{{ node.name }}</span>
        <span class="node-type">{{ node.type }}</span>
      </div>

      <div class="node-actions" v-if="depth === 0">
        <!-- Visibility toggle could go here -->
      </div>
    </div>

    <div v-if="expanded && node.children" class="node-children">
      <ModelTreeNode 
        v-for="child in node.children" 
        :key="child.speckleId" 
        :node="child" 
        :depth="depth + 1"
        :selected-id="selectedId"
        @select="(id) => $emit('select', id)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { TreeNode } from '@/stores/viewer'

const props = defineProps<{
  node: TreeNode
  depth: number
  selectedId: string | null
}>()

const emit = defineEmits<{
  (e: 'select', id: string): void
}>()

const expanded = ref(props.depth < 1) // Tự động mở level 0 (Model name)

const isSelected = computed(() => 
  props.selectedId === props.node.speckleId || props.selectedId === props.node.id
)

function handleClick() {
  emit('select', props.node.speckleId)
}
</script>

<style scoped>
.tree-node {
  display: flex;
  align-items: center;
  padding: 4px 8px;
  cursor: pointer;
  border-radius: 4px;
  margin: 1px 0;
  transition: background 0.15s;
  user-select: none;
}

.tree-node:hover {
  background: rgba(255, 255, 255, 0.05);
}

.tree-node.is-selected {
  background: rgba(99, 102, 241, 0.15);
  border-left: 2px solid #6366f1;
}

.expand-icon {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #64748b;
  transition: transform 0.2s;
  margin-right: 2px;
}

.expand-icon.is-expanded {
  transform: rotate(90deg);
}

.expand-spacer {
  width: 22px;
}

.node-icon {
  font-size: 14px;
  margin-right: 8px;
  opacity: 0.8;
}

.node-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.node-name {
  font-size: 12px;
  color: #e2e8f0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.node-type {
  font-size: 10px;
  color: #64748b;
  text-transform: lowercase;
}

.node-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
}

.tree-node:hover .node-actions {
  opacity: 1;
}

.node-children {
  border-left: 1px solid #1e293b;
  margin-left: 10px;
}
</style>
