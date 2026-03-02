<template>
  <div class="model-list">
    <div class="list-header">
      <h3 class="title">Danh sách IFC Models</h3>
      <span class="count">{{ loadedFiles.length }} file</span>
    </div>

    <div v-if="loadedFiles.length === 0" class="empty-state">
      Chưa có file nào được nạp.
    </div>

    <div class="items">
      <div 
        v-for="file in loadedFiles" 
        :key="file.id" 
        class="file-item"
        :class="{ 'is-hidden': !file.visible }"
      >
        <div class="item-main">
          <button 
            class="visibility-btn" 
            @click="viewerStore.toggleFileVisibility(file.id)"
            :title="file.visible ? 'Ẩn' : 'Hiện'"
          >
            <!-- Mắt -- hiện -->
            <svg v-if="file.visible" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke-width="2" />
              <circle cx="12" cy="12" r="3" stroke-width="2" />
            </svg>
            <!-- Mắt gạch -- ẩn -->
            <svg v-else viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" stroke-width="2" />
              <line x1="1" y1="1" x2="23" y2="23" stroke-width="2" />
            </svg>
          </button>

          <div class="file-info">
            <span class="file-name" :title="file.name">{{ file.name }}</span>
            <div class="tags-container">
              <span v-for="tag in file.tags" :key="tag" class="tag">
                {{ tag }}
                <button @click="viewerStore.removeTagFromFile(file.id, tag)" class="remove-tag">×</button>
              </span>
              <button 
                v-if="!showAddTagId || showAddTagId !== file.id" 
                @click="showAddTagId = file.id" 
                class="add-tag-btn"
              >
                +
              </button>
              <input 
                v-else 
                v-model="newTagValue" 
                @blur="handleAddTag(file.id)"
                @keyup.enter="handleAddTag(file.id)"
                placeholder="..."
                class="tag-input"
                ref="tagInput"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch } from 'vue'
import { useViewerStore } from '@/stores/viewer'
import { storeToRefs } from 'pinia'

const viewerStore = useViewerStore()
const { loadedFiles } = storeToRefs(viewerStore)

const showAddTagId = ref<string | null>(null)
const newTagValue = ref('')
const tagInput = ref<HTMLInputElement | null>(null)

async function handleAddTag(fileId: string) {
  if (newTagValue.value.trim()) {
    viewerStore.addTagToFile(fileId, newTagValue.value.trim())
  }
  newTagValue.value = ''
  showAddTagId.value = null
}

// Focus input khi click +
watch(showAddTagId, async (val) => {
  if (val) {
    await nextTick()
    // Lưu ý: tagInput.value là array vì nó nằm trong v-for
    const input = Array.isArray(tagInput.value) ? tagInput.value[0] : tagInput.value
    input?.focus()
  }
})
</script>

<style scoped>
.model-list {
  padding: 12px;
  border-bottom: 1px solid #1e293b;
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.title {
  font-size: 13px;
  font-weight: 600;
  color: #94a3b8;
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.count {
  font-size: 11px;
  background: rgba(99, 102, 241, 0.15);
  color: #818cf8;
  padding: 2px 6px;
  border-radius: 4px;
}

.empty-state {
  font-size: 12px;
  color: #475569;
  text-align: center;
  padding: 10px 0;
  border: 1px dashed #334155;
  border-radius: 6px;
}

.items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.file-item {
  background: rgba(30, 41, 59, 0.4);
  border: 1px solid #1e293b;
  border-radius: 8px;
  padding: 8px;
  transition: opacity 0.2s, background 0.2s;
}

.file-item.is-hidden {
  opacity: 0.6;
}

.item-main {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

.visibility-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  color: #64748b;
  border-radius: 4px;
  transition: background 0.15s, color 0.15s;
}

.visibility-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #cbd5e1;
}

.item-main .visibility-btn svg {
  display: block;
}

.file-info {
  flex: 1;
  min-width: 0;
}

.file-name {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: #e2e8f0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 4px;
}

.tags-container {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}

.tag {
  background: #334155;
  color: #cbd5e1;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 3px;
}

.remove-tag {
  background: none;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  padding: 0;
  font-size: 11px;
}

.remove-tag:hover {
  color: #ef4444;
}

.add-tag-btn {
  background: rgba(99, 102, 241, 0.1);
  border: 1px solid rgba(99, 102, 241, 0.2);
  color: #818cf8;
  font-size: 11px;
  width: 16px;
  height: 16px;
  line-height: 14px;
  border-radius: 4px;
  cursor: pointer;
}

.add-tag-btn:hover {
  background: rgba(99, 102, 241, 0.2);
}

.tag-input {
  background: #0f172a;
  border: 1px solid #334155;
  color: #f1f5f9;
  font-size: 10px;
  padding: 1px 4px;
  width: 50px;
  border-radius: 3px;
  outline: none;
}
</style>
