import { useCallback, useEffect, useMemo, useState } from 'react'
import { cn } from '../lib/cn'
import { useDevice } from '../store/device'
import { useLibrary } from '../store/library'
import { useTags } from '../store/tags'
import { MediaGrid } from '../components/MediaGrid'
import type { MediaItem } from '../types'

function popcount(n: bigint): number {
  let c = 0
  while (n) {
    c += Number(n & 1n)
    n >>= 1n
  }
  return c
}
function hamming(a: string, b: string): number {
  try {
    return popcount(BigInt('0x' + a) ^ BigInt('0x' + b))
  } catch {
    return 64
  }
}

// Embedding volto: base64 di float32 (L2-normalizzato) → Float32Array; il prodotto
// scalare di due vettori normalizzati è la similarità coseno.
function decodeEmb(b64: string): Float32Array {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Float32Array(bytes.buffer)
}
function dot(a: Float32Array, b: Float32Array): number {
  let s = 0
  for (let i = 0; i < a.length; i++) s += a[i] * b[i]
  return s
}

const personThumbCache = new Map<string, string>()
function PersonTile({ id, count, onClick }: { id: string; count: number; onClick: () => void }) {
  const [src, setSrc] = useState<string | null>(() => personThumbCache.get(id) ?? null)
  useEffect(() => {
    if (personThumbCache.has(id)) return
    let alive = true
    window.fp.media.thumb('photos', id, 256).then((s) => {
      if (s) personThumbCache.set(id, s as string)
      if (alive) setSrc((s as string | null) ?? null)
    })
    return () => {
      alive = false
    }
  }, [id])
  return (
    <button onClick={onClick} className="flex w-24 flex-col items-center gap-1.5">
      <span className="block h-20 w-20 overflow-hidden rounded-full border border-line bg-line transition hover:ring-2 hover:ring-brand">
        {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : <span className="block h-full w-full animate-pulse bg-ink2/25" />}
      </span>
      <span className="text-xs text-ink2">{count} foto</span>
    </button>
  )
}

type Cat = 'dup' | 'dark' | 'old' | null

export function Wizard() {
  const status = useDevice((s) => s.status)
  const ready = status?.mode === 'demo' || (status?.connected === true && status?.trusted === true)

  const items = useLibrary((s) => s.items)
  const rows = useLibrary((s) => s.analysis)
  const ensureLib = useLibrary((s) => s.ensure)
  const ensureAnalysis = useLibrary((s) => s.ensureAnalysis)
  const mergeAnalysis = useLibrary((s) => s.mergeAnalysis)
  const ensureTags = useTags((s) => s.ensure)
  const customTags = useTags((s) => s.tags)
  const tagAssign = useTags((s) => s.assign)
  const facesData = useLibrary((s) => s.faces)
  const ensureFaces = useLibrary((s) => s.ensureFaces)
  const mergeFaces = useLibrary((s) => s.mergeFaces)
  const [analyzing, setAnalyzing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [cat, setCat] = useState<Cat>(null)
  const [query, setQuery] = useState('')
  const [tag, setTag] = useState<string | null>(null)
  const [facesBusy, setFacesBusy] = useState(false)
  const [facesProgress, setFacesProgress] = useState(0)
  const [peopleOpen, setPeopleOpen] = useState(false)
  const [personId, setPersonId] = useState<string | null>(null)

  // Lista file e risultati d'analisi vivono nello store condiviso: scansione UNA
  // volta, persistono tra le schede (Foto/Wizard) — niente riscansione cambiando sezione.
  useEffect(() => {
    if (ready) ensureLib()
  }, [ready, ensureLib])
  useEffect(() => {
    ensureAnalysis()
  }, [ensureAnalysis])
  useEffect(() => {
    ensureTags()
  }, [ensureTags])
  useEffect(() => {
    ensureFaces()
  }, [ensureFaces])

  const photos = useMemo(() => items.filter((it) => it.type === 'photo'), [items])

  const runAnalyze = useCallback(async () => {
    setAnalyzing(true)
    setProgress(0)
    try {
      const have = new Set(rows.keys())
      const todo = photos.map((p) => p.id).filter((id) => !have.has(id)) // incrementale
      const total = todo.length
      if (total === 0) {
        setProgress(100)
        return
      }
      const BATCH = 12
      for (let i = 0; i < todo.length; i += BATCH) {
        const res = await window.fp.device.analyze(todo.slice(i, i + BATCH))
        const good = res.filter((r) => r.hash) // solo i risultati validi (i falliti si riprovano)
        if (good.length) {
          mergeAnalysis(good) // aggiorna lo store (persistente tra le schede)
          await window.fp.wizard.cacheMerge(good) // persiste su disco (scritture serializzate, no race)
        }
        setProgress(Math.min(99, Math.round(((i + BATCH) / total) * 100)))
      }
    } finally {
      setProgress(100)
      setAnalyzing(false)
    }
  }, [photos, rows, mergeAnalysis])

  const runFaces = useCallback(async () => {
    setFacesBusy(true)
    setFacesProgress(0)
    try {
      const done = new Set(Object.keys(facesData))
      const todo = photos.map((p) => p.id).filter((id) => !done.has(id)) // incrementale
      const total = todo.length
      if (total === 0) {
        setFacesProgress(100)
        return
      }
      const BATCH = 6 // i volti sono più lenti dell'analisi
      for (let i = 0; i < todo.length; i += BATCH) {
        const res = await window.fp.device.faces(todo.slice(i, i + BATCH))
        if (res.length) {
          mergeFaces(res)
          await window.fp.faces.cacheMerge(res)
        }
        setFacesProgress(Math.min(99, Math.round(((i + BATCH) / total) * 100)))
      }
    } finally {
      setFacesProgress(100)
      setFacesBusy(false)
    }
  }, [photos, facesData, mergeFaces])

  // Clustering greedy degli embedding: raggruppa i volti simili in "persone".
  const persons = useMemo(() => {
    const THRESH = 0.35 // similarità coseno minima per la stessa persona (buffalo_sc)
    type C = { centroid: Float32Array; n: number; photoIds: Set<string>; rep: string; repScore: number }
    const clusters: C[] = []
    for (const it of items) {
      const fs = facesData[it.id]
      if (!fs || !fs.length) continue
      for (const f of fs) {
        const e = decodeEmb(f.emb)
        if (e.length === 0) continue
        let best = -1
        let bi = -1
        for (let i = 0; i < clusters.length; i++) {
          const sim = dot(e, clusters[i].centroid)
          if (sim > best) {
            best = sim
            bi = i
          }
        }
        if (best >= THRESH && bi >= 0) {
          const c = clusters[bi]
          for (let k = 0; k < e.length; k++) c.centroid[k] = (c.centroid[k] * c.n + e[k]) / (c.n + 1)
          let norm = 0
          for (let k = 0; k < c.centroid.length; k++) norm += c.centroid[k] * c.centroid[k]
          norm = Math.sqrt(norm) || 1
          for (let k = 0; k < c.centroid.length; k++) c.centroid[k] /= norm
          c.n++
          c.photoIds.add(it.id)
          if (f.score > c.repScore) {
            c.rep = it.id
            c.repScore = f.score
          }
        } else {
          clusters.push({ centroid: e.slice(), n: 1, photoIds: new Set([it.id]), rep: it.id, repScore: f.score })
        }
      }
    }
    return clusters
      .map((c, i) => ({ id: 'p' + i, photoIds: Array.from(c.photoIds), rep: c.rep, count: c.photoIds.size }))
      .filter((c) => c.count >= 2) // persone ricorrenti (≥2 foto)
      .sort((a, b) => b.count - a.count)
  }, [items, facesData])

  const dupGroups = useMemo(() => {
    // Solo foto con sufficiente dettaglio: le immagini quasi-uniformi (nere/vuote)
    // hanno hash percettivi quasi identici e formerebbero falsi gruppi di "duplicati".
    const withHash = photos.filter((p) => {
      const r = rows.get(p.id)
      return r?.hash && (r.std ?? 0) >= 12
    })
    const used = new Set<string>()
    const groups: MediaItem[][] = []
    for (let i = 0; i < withHash.length; i++) {
      const a = withHash[i]
      if (used.has(a.id)) continue
      const ha = rows.get(a.id)!.hash!
      const g = [a]
      used.add(a.id)
      for (let j = i + 1; j < withHash.length; j++) {
        const b = withHash[j]
        if (used.has(b.id)) continue
        if (hamming(ha, rows.get(b.id)!.hash!) <= 6) {
          g.push(b)
          used.add(b.id)
        }
      }
      if (g.length > 1) groups.push(g)
    }
    return groups
  }, [photos, rows])

  const dupItems = useMemo(() => dupGroups.flat(), [dupGroups])
  // Doppioni da eliminare tenendo la foto più recente (data max) di ogni gruppo.
  const redundantDupIds = useMemo(() => {
    const out: string[] = []
    for (const g of dupGroups) {
      const sorted = [...g].sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      out.push(...sorted.slice(1).map((it) => it.id))
    }
    return out
  }, [dupGroups])
  const darkItems = useMemo(
    () => photos.filter((p) => { const r = rows.get(p.id); return r && ((r.bright ?? 99) < 22 || (r.std ?? 99) < 7) }),
    [photos, rows],
  )
  const oldItems = useMemo(() => {
    const cut = new Date()
    cut.setFullYear(cut.getFullYear() - 3)
    return items.filter((it) => it.date && new Date(it.date) < cut)
  }, [items])

  // Tag rapidi derivati dai metadati (nessun ML): tipo, anno, formato.
  const tags = useMemo(() => {
    const years = new Set<string>()
    const fmts = new Set<string>()
    let vids = 0
    for (const it of items) {
      if (it.date) {
        const y = new Date(it.date).getFullYear()
        if (!isNaN(y)) years.add(String(y))
      }
      if (it.kind && it.kind !== 'video') fmts.add(it.kind)
      if (it.type === 'video') vids++
    }
    const list: { k: string; label: string }[] = [{ k: 'type:photo', label: 'Foto' }]
    if (vids) list.push({ k: 'type:video', label: 'Video' })
    Array.from(years).sort((a, b) => Number(b) - Number(a)).forEach((y) => list.push({ k: 'year:' + y, label: y }))
    Array.from(fmts).sort().forEach((f) => list.push({ k: 'fmt:' + f, label: f }))
    return list
  }, [items])

  const searchActive = query.trim().length > 0 || tag !== null
  const searchItems = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((it) => {
      if (tag) {
        const [k, v] = tag.split(':')
        if (k === 'type' && it.type !== v) return false
        if (k === 'year' && !(it.date && String(new Date(it.date).getFullYear()) === v)) return false
        if (k === 'fmt' && (it.kind || '') !== v) return false
        if (k === 'ctag' && !(tagAssign[it.id] ?? []).includes(v)) return false
      }
      if (q && !(it.name.toLowerCase().includes(q) || (it.kind || '').toLowerCase().includes(q) || (it.date || '').slice(0, 10).includes(q))) return false
      return true
    })
  }, [items, query, tag, tagAssign])

  const analyzed = rows.size > 0
  const current = cat === 'dup' ? dupItems : cat === 'dark' ? darkItems : cat === 'old' ? oldItems : searchActive ? searchItems : []

  function openCat(c: Cat) {
    setCat(c)
    setQuery('')
    setTag(null)
    setPeopleOpen(false)
    setPersonId(null)
  }
  function backToCategories() {
    setCat(null)
    setQuery('')
    setTag(null)
    setPeopleOpen(false)
    setPersonId(null)
  }
  function openTag(k: string) {
    setTag(k)
    setQuery('')
    setCat(null)
    setPeopleOpen(false)
    setPersonId(null)
  }

  const cards: { k: Cat; title: string; sub: string; count: number }[] = [
    { k: 'dup', title: 'Duplicati e simili', sub: 'Foto quasi identiche da sfoltire', count: dupItems.length },
    { k: 'dark', title: 'Foto nere o vuote', sub: 'Scatti scuri o senza contenuto', count: darkItems.length },
    { k: 'old', title: 'Molto vecchie', sub: 'Più vecchie di 3 anni', count: oldItems.length },
  ]

  // Chip dei tag personalizzati (titolo + colore), assegnati dai file via il menu "Tag".
  const customChips = () =>
    customTags.map((t) => (
      <button
        key={t.id}
        onClick={() => openTag('ctag:' + t.id)}
        className={cn('flex h-7 items-center gap-1.5 rounded-full border px-3 text-xs hover:border-brand hover:bg-bg', tag === 'ctag:' + t.id ? 'border-brand bg-bg' : 'border-line')}
      >
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: t.color }} />
        {t.label}
      </button>
    ))

  if (!ready) {
    return <div className="p-6 text-sm text-ink2">Collega e sblocca il telefono per usare il Wizard.</div>
  }

  // Foto di una persona: stessa griglia e controlli di "Foto e video".
  if (personId) {
    const p = persons.find((x) => x.id === personId)
    const ids = new Set(p?.photoIds ?? [])
    const pics = items.filter((it) => ids.has(it.id))
    return <MediaGrid items={pics} heading="Persona" subtitle={`${pics.length} foto`} onBack={() => setPersonId(null)} emptyText="Nessuna foto." />
  }

  // Elenco persone (raggruppamento per volti simili).
  if (peopleOpen) {
    const analyzedFaces = Object.keys(facesData).length
    return (
      <div className="flex h-full flex-col">
        <div className="border-b border-line px-4 py-3">
          <div className="flex items-center gap-3">
            <button onClick={() => setPeopleOpen(false)} className="h-8 shrink-0 rounded-lg border border-line px-3 text-xs hover:bg-bg">
              ← Indietro
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-semibold leading-tight">Persone</h1>
              <p className="text-xs text-ink2">
                {facesBusy ? `Ricerca volti… ${facesProgress}%` : persons.length ? `${persons.length} persone` : analyzedFaces ? 'Nessun gruppo trovato' : 'Volti non ancora cercati'}
              </p>
            </div>
            <button onClick={runFaces} disabled={facesBusy || photos.length === 0} className="bg-grad h-8 rounded-lg px-4 text-xs font-semibold text-white disabled:opacity-60">
              {analyzedFaces ? 'Aggiorna' : 'Trova persone'}
            </button>
          </div>
          {facesBusy && (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
              <div className="bg-grad h-full transition-all" style={{ width: `${facesProgress}%` }} />
            </div>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4">
          {persons.length === 0 ? (
            <div className="mx-auto max-w-md rounded-xl2 border border-line bg-surface p-6 text-center text-sm text-ink2">
              {facesBusy
                ? 'Analisi dei volti in corso… puoi cambiare scheda, continua in background.'
                : 'Premi “Trova persone”: analizzo i volti in locale (i file sul telefono non vengono modificati) e raggruppo le foto della stessa persona. È una-tantum.'}
            </div>
          ) : (
            <div className="flex flex-wrap gap-5">
              {persons.map((p) => (
                <PersonTile key={p.id} id={p.rep} count={p.count} onClick={() => setPersonId(p.id)} />
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // Risultati: stessa griglia e stessi controlli di "Foto e video" (selezione,
  // doppio click, tasto destro, rotella), sui file rilevati dal Wizard.
  if (cat || searchActive) {
    const heading =
      cat === 'dup'
        ? 'Duplicati e simili'
        : cat === 'dark'
          ? 'Foto nere o vuote'
          : cat === 'old'
            ? 'Molto vecchie'
            : tag
              ? tag.startsWith('ctag:')
                ? (customTags.find((t) => 'ctag:' + t.id === tag)?.label ?? 'Tag')
                : (tags.find((t) => t.k === tag)?.label ?? 'Ricerca')
              : 'Ricerca'
    return (
      <MediaGrid
        items={current}
        heading={heading}
        subtitle={`${current.length} elementi`}
        onBack={backToCategories}
        emptyText="Nessun elemento trovato."
        autoDeleteAction={
          cat === 'dup' && redundantDupIds.length > 0
            ? { label: `Elimina ${redundantDupIds.length} doppioni (tieni la più recente)`, ids: () => redundantDupIds }
            : undefined
        }
        controls={
          !cat ? (
            <>
              <input
                value={query}
                autoFocus
                onChange={(e) => {
                  setTag(null)
                  setQuery(e.target.value)
                }}
                placeholder="Cerca per nome, formato, data…"
                className="h-8 w-56 rounded-lg border border-line bg-bg px-3 text-xs outline-none focus:border-brand"
              />
              {tags.map((t) => (
                <button
                  key={t.k}
                  onClick={() => openTag(t.k)}
                  className={cn('h-7 rounded-full border px-3 text-xs hover:border-brand hover:bg-bg', tag === t.k ? 'border-brand bg-bg' : 'border-line')}
                >
                  {t.label}
                </button>
              ))}
              {customChips()}
            </>
          ) : undefined
        }
      />
    )
  }

  // Schermata categorie + ricerca + tag.
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-line px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold leading-tight">Wizard — Pulizia intelligente</h1>
            <p className="text-xs text-ink2">
              {analyzing ? `Analisi in corso… ${progress}%` : analyzed ? `${photos.length} foto analizzate` : `${photos.length} foto pronte all’analisi`}
            </p>
          </div>
          {items.length > 0 && (
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cerca per nome, formato, data…"
              className="h-8 w-56 rounded-lg border border-line bg-bg px-3 text-xs outline-none focus:border-brand"
            />
          )}
          <button onClick={runAnalyze} disabled={analyzing || photos.length === 0} className="bg-grad h-8 rounded-lg px-4 text-xs font-semibold text-white disabled:opacity-60">
            {analyzed ? 'Rianalizza' : 'Analizza la libreria'}
          </button>
        </div>
        {analyzing && (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
            <div className="bg-grad h-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4">
        {!analyzed ? (
          <div className="mx-auto max-w-md rounded-xl2 border border-line bg-surface p-6 text-center text-sm text-ink2">
            <p className="font-medium text-ink">Pulizia intelligente</p>
            <p className="mt-2">
              Analizzo le tue foto in locale (i file sul telefono non vengono modificati) per suggerirti duplicati,
              scatti neri o vuoti e foto molto vecchie da spostare sul PC o eliminare. Premi “Analizza la libreria”.
            </p>
            {tags.length > 0 && (
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {tags.map((t) => (
                  <button key={t.k} onClick={() => openTag(t.k)} className="h-7 rounded-full border border-line px-3 text-xs hover:border-brand hover:bg-bg">
                    {t.label}
                  </button>
                ))}
                {customChips()}
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {cards.map((c) => (
                <button key={c.k} onClick={() => openCat(c.k)} disabled={c.count === 0} className="rounded-xl2 border border-line bg-surface p-5 text-left transition hover:border-brand disabled:opacity-50">
                  <p className="font-display text-2xl font-bold">{c.count}</p>
                  <p className="mt-1 font-medium">{c.title}</p>
                  <p className="text-xs text-ink2">{c.sub}</p>
                </button>
              ))}
              <button onClick={() => setPeopleOpen(true)} className="rounded-xl2 border border-line bg-surface p-5 text-left transition hover:border-brand">
                <p className="font-display text-2xl font-bold">{persons.length || (Object.keys(facesData).length ? 0 : '—')}</p>
                <p className="mt-1 font-medium">Persone</p>
                <p className="text-xs text-ink2">Raggruppa per volti simili</p>
              </button>
            </div>
            {(tags.length > 0 || customTags.length > 0) && (
              <div className="mt-5">
                <p className="mb-2 text-xs font-medium text-ink2">Tag e categorie</p>
                <div className="flex flex-wrap gap-2">
                  {tags.map((t) => (
                    <button
                      key={t.k}
                      onClick={() => openTag(t.k)}
                      className={cn('h-7 rounded-full border px-3 text-xs hover:border-brand hover:bg-bg', tag === t.k ? 'border-brand bg-bg' : 'border-line')}
                    >
                      {t.label}
                    </button>
                  ))}
                  {customChips()}
                </div>
                <p className="mt-2 text-xs text-ink2">
                  Crea tag dai file: selezionali in una categoria o in “Foto e video” e premi <strong>Tag</strong>.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
