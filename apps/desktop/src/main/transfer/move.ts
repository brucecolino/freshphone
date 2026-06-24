import { dialog } from 'electron'
import { join, basename } from 'node:path'
import { readSettings } from '../settings'
import { agent } from '../device/agent'
import type { SourceKey } from '../device/engine'

export interface MoveResult {
  ok: boolean
  moved?: number
  total?: number
  dir?: string
  demo?: boolean
  message?: string
}

interface AgentStatus {
  connected: boolean
  trusted: boolean
}

// Sposta = copia nella cartella scelta e poi rimuove dall'iPhone.
export async function moveSelection(source: SourceKey, ids: string[]): Promise<MoveResult> {
  if (!ids || ids.length === 0) return { ok: false, message: 'Nessun elemento selezionato' }

  const res = await dialog.showOpenDialog({
    title: 'Sposta nel PC: scegli la cartella di destinazione',
    properties: ['openDirectory', 'createDirectory'],
  })
  if (res.canceled || !res.filePaths[0]) return { ok: false, message: 'Spostamento annullato' }
  const dir = res.filePaths[0]

  if (readSettings().demo) return { ok: false, demo: true, dir, message: 'Modalità demo: spostamento non disponibile.' }

  const st = await agent.tryCall<AgentStatus | null>('status', {}, null, 15000)
  if (!st?.connected || !st.trusted) return { ok: false, dir, message: 'iPhone non collegato o non autorizzato' }

  const confirm = await dialog.showMessageBox({
    type: 'warning',
    buttons: ['Annulla', 'Sposta'],
    defaultId: 0,
    cancelId: 0,
    message: `Spostare ${ids.length} element${ids.length === 1 ? 'o' : 'i'} nel PC?`,
    detail: 'I file vengono copiati nella cartella scelta e poi rimossi dall’iPhone. Operazione non reversibile.',
  })
  if (confirm.response !== 1) return { ok: false, dir, message: 'Annullato' }

  let moved = 0
  for (const id of ids) {
    const remote = source === 'photos' ? `/DCIM/${id}` : `/${id}`
    const local = join(dir, basename(id))
    const pulled = await agent.tryCall<{ path?: string } | null>('pull', { remote, dest: local }, null, 120000)
    if (!pulled) continue
    const removed = await agent.tryCall<{ ok?: boolean } | null>('rm', { remote }, null, 30000)
    if (removed) moved++
  }
  return { ok: true, moved, total: ids.length, dir }
}
