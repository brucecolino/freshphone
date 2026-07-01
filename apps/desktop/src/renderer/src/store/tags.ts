import { create } from 'zustand'

export interface Tag {
  id: string
  label: string
  color: string
}

// Tag personalizzati (titolo + colore) e assegnazioni file→tag. Persistiti su disco
// via IPC; vivono nello store così sono condivisi tra le schede.
interface TagsStore {
  tags: Tag[]
  assign: Record<string, string[]> // fileId -> tagId[]
  loaded: boolean
  ensure: () => void
  createTag: (label: string, color: string) => Tag | undefined
  removeTag: (id: string) => void
  toggleAssign: (tagId: string, fileIds: string[]) => void
}

let inFlight = false

export const useTags = create<TagsStore>((set, get) => {
  const persist = () => void window.fp.tags.set({ tags: get().tags, assign: get().assign })
  return {
    tags: [],
    assign: {},
    loaded: false,
    ensure: () => {
      if (get().loaded || inFlight) return
      inFlight = true
      window.fp.tags
        .get()
        .then((d) => set({ tags: d.tags ?? [], assign: d.assign ?? {}, loaded: true }))
        .catch(() => undefined)
        .finally(() => {
          inFlight = false
        })
    },
    createTag: (label, color) => {
      const t: Tag = { id: crypto.randomUUID(), label: label.trim(), color }
      if (!t.label) return undefined
      set({ tags: [...get().tags, t] })
      persist()
      return t
    },
    removeTag: (id) => {
      const assign: Record<string, string[]> = {}
      for (const [fid, ids] of Object.entries(get().assign)) {
        const kept = ids.filter((x) => x !== id)
        if (kept.length) assign[fid] = kept
      }
      set({ tags: get().tags.filter((t) => t.id !== id), assign })
      persist()
    },
    toggleAssign: (tagId, fileIds) => {
      if (fileIds.length === 0) return
      const assign = { ...get().assign }
      const allHave = fileIds.every((f) => (assign[f] ?? []).includes(tagId))
      for (const f of fileIds) {
        const cur = new Set(assign[f] ?? [])
        if (allHave) cur.delete(tagId)
        else cur.add(tagId)
        if (cur.size) assign[f] = Array.from(cur)
        else delete assign[f]
      }
      set({ assign })
      persist()
    },
  }
})

export const TAG_COLORS = ['#2C6E9C', '#29A99B', '#57C98A', '#C9A227', '#E2664E', '#9B5DE5', '#E0529C', '#5A6B75']
