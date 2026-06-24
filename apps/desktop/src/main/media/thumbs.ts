import { app } from 'electron'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { run } from '../device/runner'
import { toolPath } from '../device/tools'
import { agent } from '../device/agent'
import type { SourceKey } from '../device/engine'

const VIDEO_EXT = new Set(['mov', 'mp4', 'm4v', 'avi'])

function cacheDir(): string {
  return join(app.getPath('userData'), 'thumbs')
}
function safe(id: string): string {
  return id.replace(/[^a-zA-Z0-9._-]/g, '_')
}

// Frame video con ffmpeg (decodifica MOV/MP4; gli HEIC li fa l'agent con pillow-heif).
async function videoThumb(localPath: string, size: number): Promise<Buffer | null> {
  const out = `${localPath}.thumb.jpg`
  const args = ['-y', '-ss', '1', '-i', localPath, '-frames:v', '1', '-vf', `scale=${size}:-2`, out]
  const r = await run(toolPath('ffmpeg'), args, 25000)
  if (r.code !== 0) return null
  try {
    return await readFile(out)
  } catch {
    return null
  } finally {
    rm(out, { force: true }).catch(() => undefined)
  }
}

// Ritorna un data URL JPEG della miniatura (size = lato lungo), o null.
export async function getThumb(source: SourceKey, id: string, size = 384): Promise<string | null> {
  await mkdir(cacheDir(), { recursive: true }).catch(() => undefined)
  const cached = join(cacheDir(), `${safe(id)}_${size}.jpg`)
  if (existsSync(cached)) {
    try {
      const b = await readFile(cached)
      return `data:image/jpeg;base64,${b.toString('base64')}`
    } catch {
      /* rigenera */
    }
  }

  const remote = source === 'photos' ? `/DCIM/${id}` : `/${id}`
  const ext = id.split('.').pop()?.toLowerCase() ?? ''
  const isVideo = VIDEO_EXT.has(ext)

  if (!isVideo) {
    // Immagini (HEIC/HEIF/JPG/PNG…): miniatura generata dall'agent.
    const r = await agent.tryCall<{ b64?: string } | null>('thumb', { remote, size }, null, 30000)
    if (!r?.b64) return null
    await writeFile(cached, Buffer.from(r.b64, 'base64')).catch(() => undefined)
    return `data:image/jpeg;base64,${r.b64}`
  }

  // Video: scarico il file e prendo un frame con ffmpeg.
  const local = join(tmpdir(), `fp_${safe(id)}`)
  const pulled = await agent.tryCall<{ path?: string } | null>('pull', { remote, dest: local }, null, 60000)
  if (!pulled) return null
  const buf = await videoThumb(local, size)
  await rm(local, { force: true }).catch(() => undefined)
  if (!buf) return null

  await writeFile(cached, buf).catch(() => undefined)
  return `data:image/jpeg;base64,${buf.toString('base64')}`
}
