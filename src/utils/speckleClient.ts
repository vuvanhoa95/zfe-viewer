import type { DefaultViewerParams } from '@speckle/viewer'

export const VIEWER_PARAMS: DefaultViewerParams = {
  showStats: false,
  verbose: false
}

export const SPECKLE_SERVER = import.meta.env.VITE_SPECKLE_SERVER_URL as string

export function getObjectUrl(streamId: string, objectId: string): string {
  return `${SPECKLE_SERVER}/streams/${streamId}/objects/${objectId}`
}

