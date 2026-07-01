import { randomUUID } from 'node:crypto'
import { hostname } from 'node:os'
import { readSettings, writeSettings } from './settings'

// Base URL del sito (endpoint /api/license/activate). Override via env.
const API_BASE = process.env.FRESHPHONE_API_BASE || 'https://freshphone.it'

// Limite di file esportabili senza licenza (versione gratuita).
// Deve coincidere con PLANS.free.exportLimit in packages/shared.
const FREE_EXPORT_LIMIT = 50

const KEY_RE = /^FP-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/

export interface LicenseStatus {
  state: 'active' | 'expired' | 'none'
  key?: string
  plan?: string
  expiresAt?: string | null
}

function machineId(): string {
  const s = readSettings()
  if (s.machineId) return s.machineId
  const id = randomUUID()
  writeSettings({ ...s, machineId: id })
  return id
}

export function getLicenseStatus(): LicenseStatus {
  const lic = readSettings().license
  if (!lic) return { state: 'none' }
  const expired = lic.expiresAt != null && new Date(lic.expiresAt).getTime() < Date.now()
  return { state: expired ? 'expired' : 'active', key: lic.key, plan: lic.plan, expiresAt: lic.expiresAt }
}

export async function activate(key: string): Promise<{ ok: boolean; message: string; status?: LicenseStatus }> {
  const k = (key || '').trim().toUpperCase()
  if (!KEY_RE.test(k)) return { ok: false, message: 'Key non valida' }

  try {
    const res = await fetch(`${API_BASE}/api/license/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: k, machineId: machineId(), machineName: hostname() }),
    })
    const data = (await res.json()) as { token?: string; plan?: string; expiresAt?: string | null; error?: string }
    if (!res.ok || !data.token) return { ok: false, message: data.error ?? 'Attivazione non riuscita' }

    const s = readSettings()
    writeSettings({
      ...s,
      license: { key: k, plan: data.plan ?? 'unknown', expiresAt: data.expiresAt ?? null, token: data.token },
    })
    return { ok: true, message: 'Licenza attivata', status: getLicenseStatus() }
  } catch {
    return { ok: false, message: 'Impossibile contattare il server. Verifica la connessione.' }
  }
}

export function deactivate(): void {
  const s = readSettings()
  delete s.license
  writeSettings(s)
}

export interface ExportUsage {
  licensed: boolean
  /** null = illimitato (licenza attiva) */
  limit: number | null
  used: number
  /** null = illimitato */
  remaining: number | null
}

/** Stato del limite di export della versione gratuita. */
export function getExportUsage(): ExportUsage {
  if (getLicenseStatus().state === 'active') return { licensed: true, limit: null, used: 0, remaining: null }
  const used = readSettings().freeExportsUsed ?? 0
  return { licensed: false, limit: FREE_EXPORT_LIMIT, used, remaining: Math.max(0, FREE_EXPORT_LIMIT - used) }
}

/** Conta n file esportati verso il limite gratuito (ignorato se licenza attiva). */
export function recordExports(n: number): void {
  if (n <= 0) return
  if (getLicenseStatus().state === 'active') return
  const s = readSettings()
  writeSettings({ ...s, freeExportsUsed: (s.freeExportsUsed ?? 0) + n })
}

/**
 * Ricontrolla silenziosamente la licenza col server: recepisce rinnovi (scadenza
 * estesa) e revoche/scadenze degli abbonamenti non pagati. Offline: nessuna modifica.
 */
export async function revalidate(): Promise<LicenseStatus> {
  const lic = readSettings().license
  if (!lic?.key) return getLicenseStatus()
  try {
    const res = await fetch(`${API_BASE}/api/license/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: lic.key, machineId: machineId(), machineName: hostname() }),
    })
    const data = (await res.json().catch(() => ({}))) as { token?: string; plan?: string; expiresAt?: string | null; error?: string }
    if (res.ok && data.token) {
      writeSettings({
        ...readSettings(),
        license: { key: lic.key, plan: data.plan ?? lic.plan, expiresAt: data.expiresAt ?? null, token: data.token },
      })
    } else if (res.status === 403 && /scadut|non attiva|revoc/i.test(data.error ?? '')) {
      // Solo scadenza/revoca ESPLICITA dal server: rifletti lo stato (scaduta) mantenendo
      // la key visibile. NON declassiamo su 403 per limite postazioni o errori transitori.
      writeSettings({
        ...readSettings(),
        license: { ...lic, expiresAt: new Date(0).toISOString(), token: undefined },
      })
    }
    // Altri casi (rete/500/403 non conclusivi): mantieni lo stato locale (grace offline).
  } catch {
    /* offline: nessuna modifica */
  }
  return getLicenseStatus()
}
