<template>
  <div class="upload-zone">
    <div
      class="drop-area"
      :class="{
        'is-dragging': isDragging,
        'is-uploading': activeJobs > 0,
        'is-done': activeJobs === 0 && completedCount > 0 && errorCount === 0,
        'is-error': activeJobs === 0 && errorCount > 0 && completedCount === 0,
      }"
      role="button"
      tabindex="0"
      aria-label="Kéo thả file IFC vào đây để upload"
      @dragover.prevent="isDragging = true"
      @dragleave="isDragging = false"
      @drop.prevent="handleDrop"
      @click="canUpload && fileInput?.click()"
      @keydown.enter.prevent="canUpload && fileInput?.click()"
    >
      <input
        ref="fileInput"
        type="file"
        accept=".ifc"
        multiple
        style="display: none"
        @change="onFileChange"
      />

      <!-- Idle state -->
      <template v-if="queue.length === 0 && completedCount === 0">
        <div class="upload-icon">
          <svg viewBox="0 0 40 40" fill="none" width="40" height="40">
            <rect width="40" height="40" rx="8" fill="rgba(99,102,241,0.1)"/>
            <path d="M20 28V16m0 0l-5 5m5-5l5 5" stroke="#6366f1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M12 30h16" stroke="#6366f1" stroke-width="1.5" stroke-linecap="round" opacity="0.5"/>
          </svg>
        </div>
        <p class="upload-title">Kéo thả file IFC vào đây</p>
        <p class="upload-sub">hoặc click để chọn file (nhiều file cùng lúc)</p>
        <p class="upload-hint">Tối đa 200MB/file • IFC 2x3, IFC 4</p>
      </template>

      <!-- Queue progress -->
      <template v-else>
        <div class="queue-list">
          <div
            v-for="item in queue"
            :key="item.id"
            class="queue-item"
            :class="'q-' + item.status"
          >
            <div class="q-icon">
              <svg v-if="item.status === 'done'" viewBox="0 0 16 16" fill="#10b981" width="14" height="14">
                <path d="M8 0a8 8 0 110 16A8 8 0 018 0zm3.5 5.5a.75.75 0 00-1.06-1.06L7 7.94 5.56 6.5A.75.75 0 004.5 7.56l2 2a.75.75 0 001.06 0l4-4z"/>
              </svg>
              <svg v-else-if="item.status === 'error'" viewBox="0 0 16 16" fill="#ef4444" width="14" height="14">
                <path d="M8 0a8 8 0 110 16A8 8 0 018 0zm-2.5 5a.5.5 0 00-.7.7L6.6 8 4.8 10.3a.5.5 0 00.7.7L8 8.4l2.3 2.6a.5.5 0 00.7-.7L8.4 8l1.8-2.3a.5.5 0 00-.7-.7L8 7.6 5.5 5z"/>
              </svg>
              <div v-else class="spinner" />
            </div>
            <div class="q-body">
              <div class="q-name">{{ item.name }}</div>
              <div class="q-bar" v-if="item.status === 'uploading' || item.status === 'converting'">
                <div class="q-fill" :style="{ width: item.progress + '%' }" />
              </div>
              <div class="q-msg">{{ item.message }}</div>
            </div>
            <div class="q-pct" v-if="item.status === 'uploading' || item.status === 'converting'">
              {{ item.progress }}%
            </div>
          </div>

          <!-- Summary + reset -->
          <div class="queue-summary" v-if="activeJobs === 0 && queue.length > 0">
            <span v-if="completedCount > 0" class="q-done-text">
              ✅ {{ completedCount }} file hoàn thành
            </span>
            <span v-if="errorCount > 0" class="q-err-text">
              ❌ {{ errorCount }} file lỗi
            </span>
            <button class="reset-btn" @click.stop="resetAll">Upload file khác</button>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const emit = defineEmits<{
  (e: 'model-ready', streamId: string, objectId: string): void
}>()

// ─── Config ──────────────────────────────────────────────────────────────────
const CONVERTER_URL = import.meta.env.VITE_CONVERTER_URL as string | undefined
const POLL_INTERVAL = 2000
const JOB_TIMEOUT   = 600000 // 10 phút
const MAX_CONCURRENT = 3     // Số file convert đồng thời tối đa

// ─── Types ───────────────────────────────────────────────────────────────────
interface QueueItem {
  id: string
  name: string
  file: File
  status: 'pending' | 'uploading' | 'converting' | 'done' | 'error'
  progress: number
  message: string
  jobId?: string
  streamId?: string
  objectId?: string
}

// ─── State ───────────────────────────────────────────────────────────────────
const isDragging = ref(false)
const queue = ref<QueueItem[]>([])
const fileInput = ref<HTMLInputElement | null>(null)

const activeJobs = computed(() => queue.value.filter(q => q.status === 'uploading' || q.status === 'converting').length)
const completedCount = computed(() => queue.value.filter(q => q.status === 'done').length)
const errorCount = computed(() => queue.value.filter(q => q.status === 'error').length)
const canUpload = computed(() => activeJobs.value === 0 || queue.value.length === 0)

// ─── Event handlers ──────────────────────────────────────────────────────────
function handleDrop(e: DragEvent) {
  isDragging.value = false
  const files = e.dataTransfer?.files
  if (files && files.length > 0) {
    addFiles(Array.from(files))
  }
}

function onFileChange(e: Event) {
  const target = e.target as HTMLInputElement
  const files = target.files
  if (files && files.length > 0) {
    addFiles(Array.from(files))
    target.value = '' // Reset cho lần chọn tiếp
  }
}

function resetAll() {
  queue.value = []
}

// ─── Queue management ────────────────────────────────────────────────────────
function addFiles(files: File[]) {
  // Nếu queue đã có kết quả cũ → clear
  if (activeJobs.value === 0 && queue.value.length > 0) {
    queue.value = []
  }

  for (const file of files) {
    // Validate extension
    if (!file.name.toLowerCase().endsWith('.ifc')) {
      queue.value.push({
        id: crypto.randomUUID(),
        name: file.name,
        file,
        status: 'error',
        progress: 0,
        message: 'Chỉ chấp nhận file .ifc',
      })
      continue
    }

    // Validate size
    if (file.size > 200 * 1024 * 1024) {
      queue.value.push({
        id: crypto.randomUUID(),
        name: file.name,
        file,
        status: 'error',
        progress: 0,
        message: `Quá lớn: ${(file.size / (1024 * 1024)).toFixed(0)}MB (max 200MB)`,
      })
      continue
    }

    queue.value.push({
      id: crypto.randomUUID(),
      name: file.name,
      file,
      status: 'pending',
      progress: 0,
      message: 'Đang chờ...',
    })
  }

  // Bắt đầu xử lý queue
  processQueue()
}

async function processQueue() {
  // Lấy các item pending, giới hạn concurrent
  const pending = queue.value.filter(q => q.status === 'pending')
  const canStart = MAX_CONCURRENT - activeJobs.value

  for (let i = 0; i < Math.min(canStart, pending.length); i++) {
    processFile(pending[i]) // Không await — chạy song song
  }
}

// ─── Process single file ──────────────────────────────────────────────────────
async function processFile(item: QueueItem) {
  item.status = 'uploading'
  item.progress = 2
  item.message = `Đang upload...`

  if (!CONVERTER_URL) {
    // Mock mode
    await mockProcess(item)
    return
  }

  try {
    // Upload
    const formData = new FormData()
    formData.append('file', item.file)

    const uploadResp = await fetch(`${CONVERTER_URL}/api/upload-ifc`, {
      method: 'POST',
      body: formData,
    })

    if (!uploadResp.ok) {
      const err = await uploadResp.json().catch(() => ({ detail: uploadResp.statusText }))
      throw new Error(err.detail ?? `Upload lỗi: ${uploadResp.status}`)
    }

    const { job_id } = await uploadResp.json()
    item.jobId = job_id
    item.status = 'converting'
    item.progress = 5
    item.message = 'Đang convert...'

    // Poll job
    await pollJob(item, job_id)

  } catch (err) {
    item.status = 'error'
    item.message = err instanceof Error ? err.message : 'Lỗi không xác định'
  }

  // Khi 1 job xong → kiểm tra tiếp queue
  processQueue()
}

async function pollJob(item: QueueItem, jobId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      clearInterval(poll)
      item.status = 'error'
      item.message = 'Timeout (>10 phút)'
      reject(new Error('timeout'))
    }, JOB_TIMEOUT)

    const poll = setInterval(async () => {
      try {
        const resp = await fetch(`${CONVERTER_URL}/api/job-status/${jobId}`)
        if (!resp.ok) return

        const job = await resp.json()
        item.progress = job.progress ?? item.progress
        item.message = job.message ?? item.message

        if (job.status === 'done') {
          clearInterval(poll)
          clearTimeout(timeout)
          item.status = 'done'
          item.streamId = job.stream_id
          item.objectId = job.object_id
          item.message = job.message ?? '✅ Hoàn thành!'
          emit('model-ready', job.stream_id, job.object_id)
          resolve()
        } else if (job.status === 'error') {
          clearInterval(poll)
          clearTimeout(timeout)
          item.status = 'error'
          item.message = job.message ?? 'Convert thất bại'
          reject(new Error(job.error))
        }
      } catch {
        // Poll error — sẽ thử lại lần sau
      }
    }, POLL_INTERVAL)
  })
}

// ─── Mock ─────────────────────────────────────────────────────────────────────
function mockProcess(item: QueueItem): Promise<void> {
  return new Promise(resolve => {
    let step = 0
    const t = setInterval(() => {
      step++
      item.progress = Math.min(100, step * 5)
      item.message = `Mock convert... ${item.progress}%`
      if (step >= 20) {
        clearInterval(t)
        item.status = 'done'
        item.message = '✅ Hoàn thành (mock)'
        resolve()
      }
    }, 150)
  })
}
</script>

<style scoped>
.upload-zone {
  padding: 12px;
  border-bottom: 1px solid #1e293b;
}

.drop-area {
  border: 1.5px dashed #334155;
  border-radius: 10px;
  padding: 16px 12px;
  text-align: center;
  background: rgba(15, 23, 42, 0.7);
  color: #94a3b8;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
  min-height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.drop-area:hover {
  border-color: #6366f1;
  background: rgba(99, 102, 241, 0.06);
}

.drop-area.is-dragging {
  border-color: #6366f1;
  background: rgba(99, 102, 241, 0.12);
}

.drop-area.is-uploading {
  cursor: default;
  border-color: #6366f1;
}

.drop-area.is-done {
  cursor: default;
  border-color: #10b981;
}

.drop-area.is-error {
  cursor: default;
  border-color: #ef4444;
}

/* Idle state */
.upload-icon {
  margin-bottom: 8px;
}

.upload-title {
  font-size: 13px;
  font-weight: 500;
  color: #cbd5e1;
  margin: 4px 0 2px;
}

.upload-sub {
  font-size: 12px;
  color: #64748b;
  margin: 0 0 4px;
}

.upload-hint {
  font-size: 11px;
  color: #475569;
  margin: 0;
}

/* ─── Queue list ───────────────────────────────────────────── */
.queue-list {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 6px;
  text-align: left;
}

.queue-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  background: rgba(15, 23, 42, 0.5);
  border: 1px solid rgba(99, 102, 241, 0.1);
  transition: border-color 0.2s;
}

.queue-item.q-uploading,
.queue-item.q-converting {
  border-color: rgba(99, 102, 241, 0.3);
}

.queue-item.q-done {
  border-color: rgba(16, 185, 129, 0.3);
}

.queue-item.q-error {
  border-color: rgba(239, 68, 68, 0.3);
}

.q-icon {
  flex-shrink: 0;
  width: 14px;
  height: 14px;
  margin-top: 2px;
}

.q-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.q-name {
  font-size: 11px;
  font-weight: 500;
  color: #cbd5e1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.q-bar {
  height: 4px;
  border-radius: 999px;
  background: #1e293b;
  overflow: hidden;
}

.q-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #6366f1, #8b5cf6);
  transition: width 0.3s ease;
}

.q-msg {
  font-size: 10px;
  color: #64748b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.q-pct {
  flex-shrink: 0;
  font-size: 10px;
  color: #6366f1;
  font-weight: 600;
  margin-top: 2px;
}

.queue-summary {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 4px;
  font-size: 11px;
  flex-wrap: wrap;
}

.q-done-text {
  color: #10b981;
}

.q-err-text {
  color: #ef4444;
}

/* ─── Spinner ──────────────────────────────────────────────── */
.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid #334155;
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ─── Reset button ─────────────────────────────────────────── */
.reset-btn {
  margin-left: auto;
  padding: 3px 10px;
  border-radius: 5px;
  border: 1px solid #475569;
  background: transparent;
  color: #94a3b8;
  font-size: 10px;
  cursor: pointer;
  transition: background 0.15s;
}

.reset-btn:hover {
  background: rgba(255, 255, 255, 0.08);
}
</style>
