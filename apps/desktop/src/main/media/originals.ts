import { app } from 'electron'
import { join, basename } from 'node:path'
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { run } from '../device/runner'
import { toolPath } from '../device/tools'
import type { SourceKey } from '../device/engine'

function originalsDir(): string {
  return join(app.getPath('userData'), 'originals')
}

// Garantisce che i file richiesti siano presenti in cache (scaricandoli via AFC),
// e ne restituisce i percorsi locali. Usato dal drag & drop verso Esplora risorse.
export async function ensureOriginals(udid: string, source: SourceKey, ids: string[]): Promise<string[]> {
  await mkdir(originalsDir(), { recursive: true }).catch(() => undefined)
  const paths: string[] = []
  for (const id of ids) {
    const local = join(originalsDir(), basename(id))
    if (!existsSync(local)) {
      const remote = source === 'photos' ? `/DCIM/${id}` : `/${id}`
      const r = await run(toolPath('pymobiledevice3'), ['afc', 'pull', remote, local, '--udid', udid], 60000)
      if (r.code !== 0) continue
    }
    paths.push(local)
  }
  return paths
}
