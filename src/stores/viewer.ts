import { defineStore } from 'pinia'

export type ProjectionMode = 'perspective' | 'orthographic'
export type DisplayMode = 'default' | 'wireframe' | 'ghost' | 'xray' | 'hidden-line' | 'shaded'

export interface LoadedFile {
  id: string          // UUID local
  name: string        // Tên file IFC
  streamId: string
  objectId: string
  visible: boolean
  tags: string[]
}

export interface TreeNode {
  id: string          // Speckle object ID (applicationId hoặc id)
  speckleId: string   // id trong Speckle world tree
  name: string
  type: string        // ifcType e.g. 'IFCBEAM'
  parentId?: string
  children?: TreeNode[]
}

interface ViewerState {
  currentStreamId: string | null
  currentObjectId: string | null
  loadedFiles: LoadedFile[]          // Danh sách các file đã load
  selectedElement: Record<string, unknown> | null
  selectedObjectId: string | null   // ID của object đang được chọn (sync 2 chiều)
  treeNodes: TreeNode[]             // Danh sách elements trong model tree
  projection: ProjectionMode
  displayMode: DisplayMode
  sectionEnabled: boolean
  modelLoaded: boolean

  // Settings
  zoomOnSelect: boolean

  // Active Color Filter
  activeColorFilter: { param: string; groups: Array<{ value: string; color: string; count: number; objectIds: string[] }> } | null
}

export const useViewerStore = defineStore('viewer', {
  state: (): ViewerState => ({
    currentStreamId: null,
    currentObjectId: null,
    loadedFiles: [],
    selectedElement: null,
    selectedObjectId: null,
    treeNodes: [],
    projection: 'perspective',
    displayMode: 'default',
    sectionEnabled: false,
    modelLoaded: false,
    zoomOnSelect: true, // Mặc định là bật zoom
    activeColorFilter: null,
  }),

  getters: {
    // Tìm node theo speckleId
    nodeById: (state) => (id: string) =>
      state.treeNodes.find(n => n.speckleId === id || n.id === id),
  },

  actions: {
    addFile(file: Omit<LoadedFile, 'id' | 'visible' | 'tags'>) {
      this.loadedFiles.push({
        ...file,
        id: crypto.randomUUID(),
        visible: true,
        tags: [],
      })
      // Nếu là file đầu tiên thì set làm current
      if (!this.currentStreamId) {
        this.currentStreamId = file.streamId
        this.currentObjectId = file.objectId
      }
    },
    removeFile(id: string) {
      this.loadedFiles = this.loadedFiles.filter(f => f.id !== id)
    },
    toggleFileVisibility(id: string) {
      const file = this.loadedFiles.find(f => f.id === id)
      if (file) {
        file.visible = !file.visible
        // Logic ẩn/hiện file thực tế sẽ nằm trong SpeckleViewer (watcher)
      }
    },
    addTagToFile(id: string, tag: string) {
      const file = this.loadedFiles.find(f => f.id === id)
      if (file && tag && !file.tags.includes(tag)) {
        file.tags.push(tag)
      }
    },
    removeTagFromFile(id: string, tag: string) {
      const file = this.loadedFiles.find(f => f.id === id)
      if (file) {
        file.tags = file.tags.filter(t => t !== tag)
      }
    },
    setZoomOnSelect(enabled: boolean) {
      this.zoomOnSelect = enabled
    },
    setModel(streamId: string, objectId: string) {
      this.currentStreamId = streamId
      this.currentObjectId = objectId
      // Không clear treeNodes ở đây vì multi-model append tree
    },
    clearModel() {
      this.currentStreamId = null
      this.currentObjectId = null
      this.selectedElement = null
      this.selectedObjectId = null
      this.treeNodes = []
      this.modelLoaded = false
      this.loadedFiles = []
    },

    // Gọi sau khi model load xong — viewer truyền danh sách nodes lên
    setTreeNodes(nodes: TreeNode[]) {
      this.treeNodes = nodes
      this.modelLoaded = nodes.length > 0
    },

    // Viewer click → cập nhật store (source of truth)
    setSelectedElement(payload: Record<string, unknown> | null) {
      this.selectedElement = payload
      if (payload && Object.keys(payload).length > 0) {
        // Lấy ID để sync highlight tree
        const sid = (payload['id'] ?? payload['applicationId'] ?? null) as string | null
        this.selectedObjectId = sid
      } else {
        this.selectedObjectId = null
      }
    },

    // Tree click → chỉ set ID, viewer sẽ watch và highlight
    selectByObjectId(id: string | null) {
      this.selectedObjectId = id
    },

    toggleSection() {
      this.sectionEnabled = !this.sectionEnabled
    },
    setDisplayMode(mode: DisplayMode) {
      this.displayMode = mode
    },
    setProjection(mode: ProjectionMode) {
      this.projection = mode
    },
    setActiveColorFilter(filter: ViewerState['activeColorFilter']) {
      this.activeColorFilter = filter
    },
    clearActiveColorFilter() {
      this.activeColorFilter = null
    },
  },
})
