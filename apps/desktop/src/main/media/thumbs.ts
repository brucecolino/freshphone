import { app, nativeImage } from 'electron'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { run } from '../device/runner'
import { toolPath } from '../device/tools'
import type { SourceKey } from '../device/engine'

const VIDEO_EXT = new Set(['mov', 'mp4', 'm4v', 'avi'])
const BROWSER_IMG = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'])

function cacheDir(): string {
  return join(app.getPath('userData'), 'thumbs')
}
function safe(id: string): string {
  return id.replace(/[^a-zA-Z0-9._-]/g, '_')
}

// JPEG/PNG -> nativeImage (incluso in Electron). HEIC/HEIF/video -> ffmpeg (se presente).
async function makeThumb(localPath: string, isVideo: boolean, ext: string): Promise<Buffer | null> {
  if (!isVideo && BROWSER_IMG.has(ext)) {
    const img = nativeImage.createFromPath(localPath)
    if (!img.isEmpty()) return img.resize({ width: 256 }).toJPEG(72)
  }
  const out = `${localPath}.thumb.jpg`
  const args = isVideo
    ? ['-y', '-ss', '1', '-i', localPath, '-frames:v', '1', '-vf', 'scale=256:-2', out]
    : ['-y', '-i', localPath, '-frames:v', '1', '-vf', 'scale=256:-2', out]
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

// Ritorna un data URL JPEG della miniatura, oppure null se non generabile.
export async function getThumb(udid: string, source: SourceKey, id: string): Promise<string | null> {
  await mkdir(cacheDir(), { recursive: true }).catch(() => undefined)
  const cached = join(cacheDir(), `${safe(id)}.jpg`)
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

  const local = join(tmpdir(), `fp_${safe(id)}`)
  const pull = await run(toolPath('pymobiledevice3'), ['afc', 'pull', remote, local, '--udid', udid], 30000)
  if (pull.code !== 0) return null

  const buf = await makeThumb(local, isVideo, ext)
  await rm(local, { force: true }).catch(() => undefined)
  if (!buf) return null

  await writeFile(cached, buf).catch(() => undefined)
  return `data:image/jpeg;base64,${buf.toString('base64')}`
}
