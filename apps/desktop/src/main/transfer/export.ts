import { dialog } from 'electron'
import { join, basename } from 'node:path'
import { readSettings } from '../settings'
import { agent } from '../device/agent'
import type { SourceKey } from '../device/engine'

export interface ExportResult {
  ok: boolean
  copied?: number
  total?: number
  dir?: string
  demo?: boolean
  message?: string
}

interface AgentStatus {
  connected: boolean
  trusted: boolean
}

// Esporta gli elementi selezionati in una cartella scelta dall'utente.
// I file vengono copiati grezzi via AFC: i metadati EXIF/QuickTime restano intatti.
export async function exportSelection(source: SourceKey, ids: string[]): Promise<ExportResult> {
  if (!ids || ids.length === 0) return { ok: false, message: 'Nessun elemento selezionato' }

  const res = await dialog.showOpenDialog({
    title: 'Scegli la cartella di destinazione',
    properties: ['openDirectory', 'createDirectory'],
  })
  if (res.canceled || !res.filePaths[0]) return { ok: false, message: 'Esportazione annullata' }
  const dir = res.filePaths[0]

  if (readSettings().demo) {
    return { ok: false, demo: true, dir, message: 'Modalità demo: nessun file reale da esportare. Disattiva la demo e collega l’iPhone.' }
  }

  const st = await agent.tryCall<AgentStatus | null>('status', {}, null, 15000)
  if (!st?.connected || !st.trusted) {
    return { ok: false, dir, message: 'iPhone non collegato o non autorizzato' }
  }

  let copied = 0
  for (const id of ids) {
    const remote = source === 'photos' ? `/DCIM/${id}` : `/${id}`
    const local = join(dir, basename(id))
    const r = await agent.tryCall<{ path?: string } | null>('pull', { remote, dest: local }, null, 120000)
    if (r) copied++
  }
  return { ok: true, copied, total: ids.length, dir }
}
