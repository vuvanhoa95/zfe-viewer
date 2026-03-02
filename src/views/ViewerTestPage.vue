<template>
  <div class="full-page">
    <SpeckleViewer
      :stream-id="testStreamId"
      :object-id="testObjectId"
      @element-selected="handleElementSelected"
    />
  </div>
</template>

<script setup lang="ts">
import SpeckleViewer from '@/components/SpeckleViewer.vue'

const testStreamId = import.meta.env.VITE_TEST_STREAM_ID ?? ''
const testObjectId = import.meta.env.VITE_TEST_OBJECT_ID ?? ''

function handleElementSelected(props: Record<string, unknown>) {
  // Tạm thời log ra console, Phase 1 chỉ cần vậy
  // eslint-disable-next-line no-console
  console.log('Selected element props:', props)
}
</script>

<style scoped>
.full-page {
  width: 100vw;
  height: 100vh;
}
</style>

