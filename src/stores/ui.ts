import { defineStore } from 'pinia'

interface UiState {
  sidebarLeftCollapsed: boolean
  sidebarRightCollapsed: boolean
  toolbarVisible: boolean
  theme: 'light' | 'dark'
}

export const useUiStore = defineStore('ui', {
  state: (): UiState => ({
    sidebarLeftCollapsed: false,
    sidebarRightCollapsed: false,
    toolbarVisible: true,
    theme: 'light'
  }),
  actions: {
    toggleLeftSidebar() {
      this.sidebarLeftCollapsed = !this.sidebarLeftCollapsed
    },
    toggleRightSidebar() {
      this.sidebarRightCollapsed = !this.sidebarRightCollapsed
    },
    setTheme(theme: UiState['theme']) {
      this.theme = theme
    }
  }
})

