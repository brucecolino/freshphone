import { readSettings } from '../settings'
import { mockEngine } from './mock'
import { agent } from './agent'
import { getThumb } from '../media/thumbs'
import { run } from './runner'
import { toolPath } from './tools'
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

interface AgentStatus {
  connected: boolean
  trusted: boolean
  udid?: string
  name?: string
  usedBytes?: number
  totalBytes?: number
  freeBytes?: number
}

export async function getState(): Promise<DeviceState> {
  if (readSettings().demo) {
    const s = await mockEngine.getStatus()
    return { mode: 'demo', toolsOk: true, connected: true, trusted: true, name: s.name, usedBytes: s.usedBytes, totalBytes: s.totalBytes }
  }

  const s = await agent.tryCall<AgentStatus | null>('status', {}, null, 15000)
  if (!s) return { mode: 'none', toolsOk: false, connected: false, trusted: false } // agent non avviabile
  if (!s.connected) return { mode: 'none', toolsOk: true, connected: false, trusted: false }
  return {
    mode: 'device',
    toolsOk: true,
    connected: true,
    trusted: s.trusted,
    name: s.name,
    usedBytes: s.usedBytes,
    totalBytes: s.totalBytes,
  }
}

export async function listItems(source: SourceKey): Promise<MediaItem[]> {
  if (readSettings().demo) return mockEngine.list(source)
  return agent.tryCall<MediaItem[]>('list', { source }, [], 60000)
}

export async function pair(): Promise<{ ok: boolean; message: string }> {
  if (readSettings().demo) return { ok: true, message: 'Modalità demo' }
  return agent.tryCall<{ ok: boolean; message: string }>(
    'pair',
    {},
    { ok: false, message: 'Strumenti dispositivo non disponibili' },
    30000,
  )
}

export async function thumb(source: SourceKey, id: string, size?: number): Promise<string | null> {
  if (readSettings().demo) return null
  return getThumb(source, id, size)
}

// Presenza degli strumenti (per spiegare anteprime mancanti).
export async function capabilities(): Promise<{ afc: boolean; ffmpeg: boolean }> {
  const ping = await agent.tryCall<{ pong?: boolean } | null>('ping', {}, null, 8000)
  const afc = ping != null
  const ffmpeg = (await run(toolPath('ffmpeg'), ['-version'])).code !== 127
  return { afc, ffmpeg }
}
