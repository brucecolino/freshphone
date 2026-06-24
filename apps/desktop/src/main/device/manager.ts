import { readSettings } from '../settings'
import { mockEngine } from './mock'
import { probe, afcList, pairDevice } from './libimobiledevice'
import { getThumb } from '../media/thumbs'
import type { MediaItem, SourceKey } from './engine'

export interface DeviceState {
  /** demo = dati di esempio; device = iPhone reale; none = nessun device/strumenti */
  mode: 'demo' | 'device' | 'none'
  toolsOk: boolean
  connected: boolean
  trusted: boolean
  name?: string
  usedBytes?: number
  totalBytes?: number
}

export async function getState(): Promise<DeviceState> {
  if (readSettings().demo) {
    const s = await mockEngine.getStatus()
    return {
      mode: 'demo',
      toolsOk: true,
      connected: true,
      trusted: true,
      name: s.name,
      usedBytes: s.usedBytes,
      totalBytes: s.totalBytes,
    }
  }

  const p = await probe()
  if (!p.connected) return { mode: 'none', toolsOk: p.toolsOk, connected: false, trusted: false }
  return {
    mode: 'device',
    toolsOk: true,
    connected: true,
    trusted: p.trusted,
    name: p.name,
    usedBytes: p.usedBytes,
    totalBytes: p.totalBytes,
  }
}

export async function listItems(source: SourceKey): Promise<MediaItem[]> {
  if (readSettings().demo) return mockEngine.list(source)
  const p = await probe()
  if (!p.connected || !p.trusted || !p.udid) return []
  const items = await afcList(p.udid, source)
  return items ?? []
}

export async function pair(): Promise<{ ok: boolean; message: string }> {
  const p = await probe()
  if (!p.udid) return { ok: false, message: 'Nessun dispositivo collegato' }
  return pairDevice(p.udid)
}

export async function thumb(source: SourceKey, id: string): Promise<string | null> {
  if (readSettings().demo) return null
  const p = await probe()
  if (!p.connected || !p.trusted || !p.udid) return null
  return getThumb(p.udid, source, id)
}
