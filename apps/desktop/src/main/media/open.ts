import { app, shell } from 'electron'
import { join, basename } from 'node:path'
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { agent } from '../device/agent'
import type { SourceKey } from '../device/engine'

function openDir(): string {
  return join(app.getPath('userData'), 'open')
}

// Apre un file con l'app predefinita di Windows (scaricandolo in cache se serve).
export async function openItem(source: SourceKey, id: string): Promise<{ ok: boolean; message?: string }> {
  await mkdir(openDir(), { recursive: true }).catch(() => undefined)
  const local = join(openDir(), basename(id))
  if (!existsSync(local)) {
    const remote = source === 'photos' ? `/DCIM/${id}` : `/${id}`
    const r = await agent.tryCall<{ path?: string } | null>('pull', { remote, dest: local }, null, 120000)
    if (!r) return { ok: false, message: 'Impossibile scaricare il file dal dispositivo.' }
  }
  const err = await shell.openPath(local)
  if (err) return { ok: false, message: `Windows non riesce ad aprire questo file (${err}). Per gli HEIC potrebbe servire l'estensione immagini HEIF.` }
  return { ok: true }
}
