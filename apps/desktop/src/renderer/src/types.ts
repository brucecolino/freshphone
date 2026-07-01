export interface DeviceStatus {
  mode?: 'demo' | 'device' | 'none'
  state?: 'demo' | 'connected' | 'untrusted' | 'searching' | 'error'
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
  live?: boolean // Live Photo (foto con MOV "motion" abbinato)
  liveMov?: string // percorso del MOV abbinato (gestito insieme nei trasferimenti)
}
