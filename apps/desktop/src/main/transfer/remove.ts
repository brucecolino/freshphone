import { dialog } from 'electron'
import { readSettings } from '../settings'
import { probe } from '../device/libimobiledevice'
import { run } from '../device/runner'
import { toolPath } from '../device/tools'
import type { SourceKey } from '../device/engine'

export interface RemoveResult {
  ok: boolean
  deleted?: number
  total?: number
  demo?: boolean
  message?: string
}

// Elimina gli elementi selezionati dall'iPhone, previa conferma.
// Nota: su iOS la rimozione via AFC può richiedere un reindex del DB Foto per
// liberare lo spazio del tutto (da validare on-device).
export async function removeSelection(source: SourceKey, ids: string[]): Promise<RemoveResult> {
  if (!ids || ids.length === 0) return { ok: false, message: 'Nessun elemento selezionato' }
  if (readSettings().demo) return { ok: false, demo: true, message: 'Modalità demo: eliminazione non disponibile.' }

  const p = await probe()
  if (!p.connected || !p.trusted || !p.udid) return { ok: false, message: 'iPhone non collegato o non autorizzato' }

  const confirm = await dialog.showMessageBox({
    type: 'warning',
    buttons: ['Annulla', 'Elimina'],
    defaultId: 0,
    cancelId: 0,
    message: `Eliminare ${ids.length} element${ids.length === 1 ? 'o' : 'i'} dall'iPhone?`,
    detail: 'L’operazione non è reversibile. Assicurati di aver già esportato i file che vuoi conservare.',
  })
  if (confirm.response !== 1) return { ok: false, message: 'Annullato' }

  let deleted = 0
  for (const id of ids) {
    const remote = source === 'photos' ? `/DCIM/${id}` : `/${id}`
    const r = await run(toolPath('pymobiledevice3'), ['afc', 'rm', remote, '--udid', p.udid], 30000)
    if (r.code === 0) deleted++
  }
  return { ok: true, deleted, total: ids.length }
}
