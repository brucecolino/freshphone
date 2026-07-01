import { app } from 'electron'
import { join } from 'node:path'
import { readFile, writeFile } from 'node:fs/promises'

// Tag personalizzati dell'utente + assegnazioni file→tag, persistiti su disco.
export interface TagsData {
  tags: { id: string; label: string; color: string }[]
  assign: Record<string, string[]> // fileId -> tagId[]
}

function tagsPath(): string {
  return join(app.getPath('userData'), 'tags.json')
}

let mem: TagsData | null = null
let writeChain: Promise<void> = Promise.resolve()

export async function getTags(): Promise<TagsData> {
  if (mem) return mem
  try {
    mem = JSON.parse(await readFile(tagsPath(), 'utf8')) as TagsData
  } catch {
    mem = { tags: [], assign: {} }
  }
  return mem
}

export function saveTags(data: TagsData): Promise<void> {
  mem = data
  // scritture serializzate: niente race
  writeChain = writeChain.then(() => writeFile(tagsPath(), JSON.stringify(data))).catch(() => {
    /* riprova al prossimo salvataggio */
  })
  return writeChain
}
