import { app } from 'electron'
import { join } from 'node:path'
import { readFile, writeFile } from 'node:fs/promises'

// Cache su PC dei risultati d'analisi del wizard (così l'analisi è una-tantum
// e incrementale: rianalizziamo solo le foto nuove).
interface Row {
  bright?: number
  std?: number
  hash?: string
}

function cachePath(): string {
  return join(app.getPath('userData'), 'wizard-analysis.json')
}

// Cache in memoria + catena di scrittura serializzata: le merge concorrenti NON
// si sovrascrivono più a vicenda (prima il read-modify-write in parallelo perdeva
// metà dei risultati). Ogni batch d'analisi viene così conservato per davvero.
let mem: Record<string, Row> | null = null
let writeChain: Promise<void> = Promise.resolve()

export async function getAnalysisCache(): Promise<Record<string, Row>> {
  if (mem) return mem
  try {
    mem = JSON.parse(await readFile(cachePath(), 'utf8')) as Record<string, Row>
  } catch {
    mem = {}
  }
  return mem
}

export function mergeAnalysisCache(rows: { id: string; bright?: number; std?: number; hash?: string }[]): Promise<void> {
  // serializza le scritture: nessuna race, ogni merge attende la precedente
  writeChain = writeChain.then(async () => {
    const cur = await getAnalysisCache()
    for (const r of rows) cur[r.id] = { bright: r.bright, std: r.std, hash: r.hash }
    await writeFile(cachePath(), JSON.stringify(cur))
  }).catch(() => {
    /* una scrittura fallita non blocca le successive */
  })
  return writeChain
}

// Cache dei volti rilevati: per ogni foto la lista di impronte (embedding) dei volti.
interface FaceEntry {
  emb: string
  score: number
}
function facesCachePath(): string {
  return join(app.getPath('userData'), 'faces.json')
}
let facesMem: Record<string, FaceEntry[]> | null = null
let facesChain: Promise<void> = Promise.resolve()

export async function getFacesCache(): Promise<Record<string, FaceEntry[]>> {
  if (facesMem) return facesMem
  try {
    facesMem = JSON.parse(await readFile(facesCachePath(), 'utf8')) as Record<string, FaceEntry[]>
  } catch {
    facesMem = {}
  }
  return facesMem
}

export function mergeFacesCache(rows: { id: string; faces: FaceEntry[] }[]): Promise<void> {
  facesChain = facesChain.then(async () => {
    const cur = await getFacesCache()
    for (const r of rows) cur[r.id] = r.faces
    await writeFile(facesCachePath(), JSON.stringify(cur))
  }).catch(() => {
    /* noop */
  })
  return facesChain
}
