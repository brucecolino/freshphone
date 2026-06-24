export interface DeviceStatus {
  mode?: 'demo' | 'device' | 'none'
  toolsOk?: boolean
  connected: boolean
  trusted?: boolean
  name?: string
  usedBytes?: number
  totalBytes?: number
}

export interface MediaItem {
  id: string
  name: string
  type: 'photo' | 'video' | 'file' | 'folder'
  sizeBytes: number
  date: string
  durationSec?: number
  kind?: string
  isDir?: boolean
}
