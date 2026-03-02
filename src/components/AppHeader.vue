<template>
  <header class="app-header">
    <div class="header-left">
      <div class="logo-mark">ZF</div>
      <div class="logo-text">
        <div class="brand">ZFENIX</div>
        <div class="sub">BIM Viewer</div>
      </div>
    </div>

    <div class="header-center">
      <span class="crumb">{{ projectName }}</span>
      <span class="sep">›</span>
      <span class="crumb muted">{{ modelName }}</span>
    </div>

    <div class="header-right">
      <button
        type="button"
        class="icon-btn"
        :title="$t('viewer.screenshot')"
        :aria-label="$t('viewer.screenshot')"
      >
        📸
      </button>
      <button
        type="button"
        class="icon-btn"
        :title="$t('viewer.fullscreen')"
        :aria-label="$t('viewer.fullscreen')"
      >
        ⛶
      </button>
      <button
        type="button"
        class="icon-btn"
        :aria-pressed="isLeftCollapsed"
        aria-label="Ẩn/hiện cây mô hình"
        title="Ẩn/hiện cây mô hình"
        @click="$emit('toggleLeftSidebar')"
      >
        🧱
      </button>
      <button
        type="button"
        class="icon-btn"
        :aria-pressed="isRightCollapsed"
        aria-label="Ẩn/hiện bảng thuộc tính"
        title="Ẩn/hiện bảng thuộc tính"
        @click="$emit('toggleRightSidebar')"
      >
        ℹ️
      </button>
      <span class="user-pill">{{ userName }}</span>
    </div>
  </header>
</template>

<script setup lang="ts">
defineProps<{
  projectName: string
  modelName: string
  userName: string
  isLeftCollapsed?: boolean
  isRightCollapsed?: boolean
}>()

defineEmits<{
  (e: 'toggleLeftSidebar'): void
  (e: 'toggleRightSidebar'): void
}>()
</script>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #1a2e44;
  padding: 0 16px;
  border-bottom: 2px solid #1a56a0;
  color: #ffffff;
  height: 56px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.logo-mark {
  width: 32px;
  height: 32px;
  border-radius: 999px;
  background: radial-gradient(circle at 30% 30%, #38bdf8, #1a56a0);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
}

.logo-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.brand {
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.06em;
}

.sub {
  font-size: 12px;
  color: #90caf9;
}

.header-center {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.sep {
  color: #6b7280;
}

.crumb.muted {
  color: #9ca3af;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.icon-btn {
  background: none;
  border: none;
  color: #e5e7eb;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 16px;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.icon-btn:hover {
  background: rgba(255, 255, 255, 0.08);
}

.user-pill {
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.9);
  border: 1px solid #1f2937;
  font-size: 13px;
}
</style>

