import { app } from 'electron'
import { join, basename } from 'node:path'
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { agent } from '../device/agent'
import type { SourceKey } from '../device/engine'

function originalsDir(): string {
  return join(app.getPath('userData'), 'originals')
}

// Garantisce che i file richiesti siano presenti in cache (scaricandoli via AFC
// attraverso l'agent), e ne restituisce i percorsi locali. Usato dal drag & drop.
export async function ensureOriginals(source: SourceKey, ids: string[]): Promise<string[]> {
  await mkdir(originalsDir(), { recursive: true }).catch(() => undefined)
  const paths: string[] = []
  for (const id of ids) {
    const local = join(originalsDir(), basename(id))
    if (!existsSync(local)) {
      const remote = source === 'photos' ? `/DCIM/${id}` : `/${id}`
      const r = await agent.tryCall<{ path?: string } | null>('pull', { remote, dest: local }, null, 60000)
      if (!r) continue
    }
    paths.push(local)
  }
  return paths
}
