import { dialog } from 'electron'
import { join, basename } from 'node:path'
import { readSettings } from '../settings'
import { getExportUsage, recordExports, type ExportUsage } from '../license'
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

export type ProgressFn = (p: { op: 'export' | 'move' | 'remove' | 'import'; index: number; total: number; file: string }) => void

// Unità di trasferimento: una foto/video e — per le Live Photo — il MOV abbinato.
// Le coppie Live viaggiano insieme: non vanno mai spezzate (né orfane né mezza copia).
export interface TransferUnit {
  id: string
  mov?: string
}

export interface TransferPlan {
  files: string[]
  unitsIncluded: number
  limited: boolean
  usage: ExportUsage
}

// Espande le unità in file applicando il limite gratuito SENZA spezzare una coppia Live:
// se una coppia non entra nel budget residuo, ci si ferma prima (mai mezza coppia).
// Il budget è in numero di file (una Live conta 2), coerente con "50 file".
export function planTransfer(units: TransferUnit[]): TransferPlan {
  const usage = getExportUsage()
  let budget = usage.licensed || usage.remaining == null ? Number.POSITIVE_INFINITY : usage.remaining
  const files: string[] = []
  let unitsIncluded = 0
  let limited = false
  for (const u of units) {
    const uf = u.mov ? [u.id, u.mov] : [u.id]
    if (uf.length > budget) {
      limited = true
      break
    }
    files.push(...uf)
    budget -= uf.length
    unitsIncluded++
  }
  return { files, unitsIncluded, limited, usage }
}

// Esporta gli elementi selezionati in una cartella scelta dall'utente.
// I file vengono copiati grezzi via AFC: i metadati EXIF/QuickTime restano intatti.
export async function exportSelection(source: SourceKey, units: TransferUnit[], onProgress?: ProgressFn): Promise<ExportResult> {
  if (!units || units.length === 0) return { ok: false, message: 'Nessun elemento selezionato' }

  const res = await dialog.showOpenDialog({
    title: 'Scegli la cartella di destinazione',
    properties: ['openDirectory', 'createDirectory'],
  })
  if (res.canceled || !res.filePaths[0]) return { ok: false, message: 'Esportazione annullata' }
  const dir = res.filePaths[0]

  if (readSettings().demo) {
    return { ok: false, demo: true, dir, message: 'Modalità demo: nessun file reale da esportare. Disattiva la demo e collega il telefono.' }
  }

  const st = await agent.tryCall<AgentStatus | null>('status', {}, null, 15000)
  if (!st?.connected || !st.trusted) {
    return { ok: false, dir, message: 'Telefono non collegato o non autorizzato' }
  }

  // Limite versione gratuita: senza licenza si esportano al massimo N file in totale.
  const plan = planTransfer(units)
  if (!plan.usage.licensed && plan.files.length === 0) {
    return {
      ok: false,
      dir,
      message: `Versione gratuita: hai già esportato ${plan.usage.used} file (limite ${plan.usage.limit}). Attiva una licenza per esportare senza limiti.`,
    }
  }

  let copied = 0
  for (let i = 0; i < plan.files.length; i++) {
    const rel = plan.files[i]
    onProgress?.({ op: 'export', index: i, total: plan.files.length, file: basename(rel) })
    const remote = source === 'photos' ? `/DCIM/${rel}` : `/${rel}`
    const local = join(dir, basename(rel))
    const r = await agent.tryCall<{ path?: string } | null>('pull', { remote, dest: local }, null, 120000)
    if (r) copied++
  }
  onProgress?.({ op: 'export', index: plan.files.length, total: plan.files.length, file: '' })
  recordExports(copied)
  const message = plan.limited
    ? `Limite versione gratuita raggiunto: esportati ${copied} file. Attiva una licenza per esportare il resto.`
    : undefined
  return { ok: true, copied, total: plan.files.length, dir, message }
}
