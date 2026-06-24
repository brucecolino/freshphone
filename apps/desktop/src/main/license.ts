import { randomUUID } from 'node:crypto'
import { hostname } from 'node:os'
import { readSettings, writeSettings } from './settings'

// Base URL del sito (endpoint /api/license/activate). Override via env.
const API_BASE = process.env.FRESHPHONE_API_BASE || 'http://localhost:3000'

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
