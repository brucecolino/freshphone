import { dialog } from 'electron'
import { join, basename } from 'node:path'
import { readSettings } from '../settings'
import { recordExports } from '../license'
import { agent } from '../device/agent'
import { planTransfer, type ProgressFn, type TransferUnit } from './export'
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

// Sposta = copia nella cartella scelta e poi rimuove dal telefono.
export async function moveSelection(source: SourceKey, units: TransferUnit[], onProgress?: ProgressFn): Promise<MoveResult> {
  if (!units || units.length === 0) return { ok: false, message: 'Nessun elemento selezionato' }

  const res = await dialog.showOpenDialog({
    title: 'Sposta nel PC: scegli la cartella di destinazione',
    properties: ['openDirectory', 'createDirectory'],
  })
  if (res.canceled || !res.filePaths[0]) return { ok: false, message: 'Spostamento annullato' }
  const dir = res.filePaths[0]

  if (readSettings().demo) return { ok: false, demo: true, dir, message: 'Modalità demo: spostamento non disponibile.' }

  const st = await agent.tryCall<AgentStatus | null>('status', {}, null, 15000)
  if (!st?.connected || !st.trusted) return { ok: false, dir, message: 'Telefono non collegato o non autorizzato' }

  // Limite versione gratuita: anche lo spostamento (copia + rimozione) conta verso il totale.
  // Il piano non spezza mai una coppia Live: si sposta/elimina la coppia intera o niente.
  const plan = planTransfer(units)
  if (!plan.usage.licensed && plan.files.length === 0) {
    return {
      ok: false,
      dir,
      message: `Versione gratuita: hai già trasferito ${plan.usage.used} file (limite ${plan.usage.limit}). Attiva una licenza per continuare.`,
    }
  }

  const confirm = await dialog.showMessageBox({
    type: 'warning',
    buttons: ['Annulla', 'Sposta'],
    defaultId: 0,
    cancelId: 0,
    message: `Spostare ${plan.unitsIncluded} element${plan.unitsIncluded === 1 ? 'o' : 'i'} nel PC?`,
    detail: 'I file vengono copiati nella cartella scelta e poi rimossi dal telefono. Operazione non reversibile. Lo spazio si libererà dopo aver riavviato il telefono.',
  })
  if (confirm.response !== 1) return { ok: false, dir, message: 'Annullato' }

  let moved = 0
  for (let i = 0; i < plan.files.length; i++) {
    const rel = plan.files[i]
    onProgress?.({ op: 'move', index: i, total: plan.files.length, file: basename(rel) })
    const remote = source === 'photos' ? `/DCIM/${rel}` : `/${rel}`
    const local = join(dir, basename(rel))
    const pulled = await agent.tryCall<{ path?: string } | null>('pull', { remote, dest: local }, null, 120000)
    if (!pulled) continue
    const removed = await agent.tryCall<{ ok?: boolean } | null>('rm', { remote }, null, 30000)
    if (removed) moved++
  }
  onProgress?.({ op: 'move', index: plan.files.length, total: plan.files.length, file: '' })
  recordExports(moved)
  const message = plan.limited
    ? `Limite versione gratuita raggiunto: spostati ${moved} file. Attiva una licenza per il resto.`
    : undefined
  return { ok: true, moved, total: plan.files.length, dir, message }
}
