import { create } from 'zustand'
import type { MediaItem } from '../types'

export type AnalysisRow = { bright?: number; std?: number; hash?: string }
export type FaceEntry = { emb: string; score: number }

// Store condiviso della libreria: la lista file del device e i risultati d'analisi
// vivono QUI, fuori dai componenti. Così la scansione avviene UNA volta e i risultati
// restano quando si passa tra le schede (Foto e video / Wizard) — niente riscansione.
// Gli spostamenti/eliminazioni rimuovono gli elementi dalla lista.
interface LibraryStore {
  items: MediaItem[]
  loaded: boolean
  loading: boolean
  analysis: Map<string, AnalysisRow>
  analysisLoaded: boolean
  faces: Record<string, FaceEntry[]>
  facesLoaded: boolean
  ensure: () => void
  refresh: () => Promise<void>
  removeIds: (ids: Iterable<string>) => void
  ensureAnalysis: () => void
  mergeAnalysis: (rows: { id: string; bright?: number; std?: number; hash?: string }[]) => void
  ensureFaces: () => void
  mergeFaces: (rows: { id: string; faces: FaceEntry[] }[]) => void
}

let listInFlight = false
let analysisInFlight = false
let facesInFlight = false

export const useLibrary = create<LibraryStore>((set, get) => ({
  items: [],
  loaded: false,
  loading: false,
  analysis: new Map(),
  analysisLoaded: false,
  faces: {},
  facesLoaded: false,

  // Scansione una-tantum (no-op se già caricata o in corso).
  ensure: () => {
    if (get().loaded || listInFlight) return
    listInFlight = true
    set({ loading: true })
    window.fp.device
      .list('photos')
      .then((x) => set({ items: x as MediaItem[], loaded: true }))
      .catch(() => undefined)
      .finally(() => {
        listInFlight = false
        set({ loading: false })
      })
  },

  // Nuova scansione forzata (es. pulsante "Aggiorna").
  refresh: async () => {
    if (listInFlight) return
    listInFlight = true
    set({ loading: true })
    try {
      const x = await window.fp.device.list('photos')
      set({ items: x as MediaItem[], loaded: true })
    } catch {
      /* riprova al prossimo refresh */
    } finally {
      listInFlight = false
      set({ loading: false })
    }
  },

  removeIds: (ids) => {
    const s = ids instanceof Set ? (ids as Set<string>) : new Set(ids)
    set({ items: get().items.filter((it) => !s.has(it.id)) })
  },

  // Carica la cache d'analisi dal disco una sola volta.
  ensureAnalysis: () => {
    if (get().analysisLoaded || analysisInFlight) return
    analysisInFlight = true
    window.fp.wizard
      .cacheGet()
      .then((c) => set({ analysis: new Map(Object.entries(c)), analysisLoaded: true }))
      .catch(() => undefined)
      .finally(() => {
        analysisInFlight = false
      })
  },

  mergeAnalysis: (rows) => {
    const m = new Map(get().analysis)
    for (const r of rows) m.set(r.id, { bright: r.bright, std: r.std, hash: r.hash })
    set({ analysis: m, analysisLoaded: true })
  },

  ensureFaces: () => {
    if (get().facesLoaded || facesInFlight) return
    facesInFlight = true
    window.fp.faces
      .cacheGet()
      .then((c) => set({ faces: c ?? {}, facesLoaded: true }))
      .catch(() => undefined)
      .finally(() => {
        facesInFlight = false
      })
  },
  mergeFaces: (rows) => {
    const f = { ...get().faces }
    for (const r of rows) f[r.id] = r.faces
    set({ faces: f, facesLoaded: true })
  },
}))
