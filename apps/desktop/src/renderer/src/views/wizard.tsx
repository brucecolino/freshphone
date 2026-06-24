import { useCallback, useEffect, useMemo, useState } from 'react'
import { cn } from '../lib/cn'
import { useDevice } from '../store/device'
import type { MediaItem } from '../types'

type Row = { id: string; bright?: number; std?: number; hash?: string }

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

const thumbCache = new Map<string, string>()
function Thumb({ id, selected, onClick }: { id: string; selected: boolean; onClick: () => void }) {
  const [src, setSrc] = useState<string | null>(() => thumbCache.get(id) ?? null)
  useEffect(() => {
    if (thumbCache.has(id)) return
    let alive = true
    window.fp.media.thumb('photos', id, 256).then((s) => {
      if (s) thumbCache.set(id, s as string)
      if (alive) setSrc((s as string | null) ?? null)
    })
    return () => {
      alive = false
    }
  }, [id])
  return (
    <button
      onClick={onClick}
      className={cn('relative block aspect-square w-full overflow-hidden rounded-md bg-line/60', selected && 'ring-2 ring-brand ring-offset-2 ring-offset-bg')}
    >
      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : <span className="block h-full w-full animate-pulse bg-line/50" />}
      {selected && <span className="absolute left-1 top-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-brand" />}
    </button>
  )
}

type Cat = 'dup' | 'dark' | 'old' | null

export function Wizard() {
  const status = useDevice((s) => s.status)
  const ready = status?.mode === 'demo' || (status?.connected === true && status?.trusted === true)

  const [items, setItems] = useState<MediaItem[]>([])
  const [rows, setRows] = useState<Map<string, Row>>(new Map())
  const [analyzing, setAnalyzing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [cat, setCat] = useState<Cat>(null)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!ready) {
      setItems([])
      return
    }
    window.fp.device.list('photos').then((x) => setItems(x as MediaItem[]))
  }, [ready])

  const photos = useMemo(() => items.filter((it) => it.type === 'photo'), [items])

  const runAnalyze = useCallback(async () => {
    setAnalyzing(true)
    setProgress(0)
    const ids = photos.map((p) => p.id)
    const map = new Map(rows)
    const BATCH = 40
    for (let i = 0; i < ids.length; i += BATCH) {
      const res = await window.fp.device.analyze(ids.slice(i, i + BATCH))
      for (const r of res) map.set(r.id, r as Row)
      setProgress(Math.min(100, Math.round(((i + BATCH) / Math.max(1, ids.length)) * 100)))
    }
    setRows(new Map(map))
    setProgress(100)
    setAnalyzing(false)
  }, [photos, rows])

  const dupGroups = useMemo(() => {
    const withHash = photos.filter((p) => rows.get(p.id)?.hash)
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
  const darkItems = useMemo(
    () => photos.filter((p) => { const r = rows.get(p.id); return r && ((r.bright ?? 99) < 22 || (r.std ?? 99) < 7) }),
    [photos, rows],
  )
  const oldItems = useMemo(() => {
    const cut = new Date()
    cut.setFullYear(cut.getFullYear() - 3)
    return items.filter((it) => it.date && new Date(it.date) < cut)
  }, [items])

  const analyzed = rows.size > 0
  const current = cat === 'dup' ? dupItems : cat === 'dark' ? darkItems : cat === 'old' ? oldItems : []

  const selIds = () => Array.from(sel)
  function openCat(c: Cat) {
    setCat(c)
    setSel(new Set())
  }
  function toggle(id: string) {
    setSel((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }
  async function doExport() {
    setBusy(true)
    setMsg(null)
    try {
      const r = await window.fp.transfer.export('photos', selIds())
      setMsg(r.ok ? `Esportati ${r.copied}/${r.total} in ${r.dir}` : r.message ?? 'Errore')
    } finally {
      setBusy(false)
    }
  }
  async function doRemove() {
    setBusy(true)
    setMsg(null)
    try {
      const r = await window.fp.transfer.remove('photos', selIds())
      if (r.ok) {
        setMsg(`Eliminati ${r.deleted}/${r.total} dall'iPhone`)
        setSel(new Set())
        setItems((arr) => arr.filter((it) => !sel.has(it.id)))
      } else setMsg(r.message ?? 'Errore')
    } finally {
      setBusy(false)
    }
  }

  const cards: { k: Cat; title: string; sub: string; count: number }[] = [
    { k: 'dup', title: 'Duplicati e simili', sub: 'Foto quasi identiche da sfoltire', count: dupItems.length },
    { k: 'dark', title: 'Foto nere o vuote', sub: 'Scatti scuri o senza contenuto', count: darkItems.length },
    { k: 'old', title: 'Molto vecchie', sub: 'Più vecchie di 3 anni', count: oldItems.length },
  ]

  if (!ready) {
    return <div className="p-6 text-sm text-ink2">Collega e autorizza l’iPhone per usare il Wizard.</div>
  }

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
          {cat ? (
            <button onClick={() => setCat(null)} className="h-8 rounded-lg border border-line px-3 text-xs hover:bg-bg">
              ← Categorie
            </button>
          ) : (
            <button onClick={runAnalyze} disabled={analyzing || photos.length === 0} className="bg-grad h-8 rounded-lg px-4 text-xs font-semibold text-white disabled:opacity-60">
              {analyzed ? 'Rianalizza' : 'Analizza la libreria'}
            </button>
          )}
        </div>
        {analyzing && (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
            <div className="bg-grad h-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}
        {cat && sel.size > 0 && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-ink2">{sel.size} selezionati</span>
            <button onClick={doExport} disabled={busy} className="bg-grad ml-auto h-8 rounded-lg px-3 text-xs font-semibold text-white disabled:opacity-60">
              Esporta su PC
            </button>
            <button onClick={doRemove} disabled={busy} className="h-8 rounded-lg border border-line px-3 text-xs hover:bg-bg disabled:opacity-60">
              Elimina dall’iPhone
            </button>
            <button onClick={() => setSel(new Set(current.map((i) => i.id)))} className="h-8 rounded-lg border border-line px-3 text-xs hover:bg-bg">
              Tutti
            </button>
          </div>
        )}
        {msg && <p className="mt-2 text-xs text-ink2">{msg}</p>}
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4">
        {!cat ? (
          !analyzed ? (
            <div className="mx-auto max-w-md rounded-xl2 border border-line bg-surface p-6 text-center text-sm text-ink2">
              <p className="font-medium text-ink">Pulizia intelligente</p>
              <p className="mt-2">
                Analizzo le tue foto in locale (i file sull’iPhone non vengono modificati) per suggerirti duplicati,
                scatti neri o vuoti e foto molto vecchie da spostare sul PC o eliminare. Premi “Analizza la libreria”.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {cards.map((c) => (
                <button key={c.k} onClick={() => openCat(c.k)} disabled={c.count === 0} className="rounded-xl2 border border-line bg-surface p-5 text-left transition hover:border-brand disabled:opacity-50">
                  <p className="font-display text-2xl font-bold">{c.count}</p>
                  <p className="mt-1 font-medium">{c.title}</p>
                  <p className="text-xs text-ink2">{c.sub}</p>
                </button>
              ))}
              <div className="rounded-xl2 border border-dashed border-line p-5 text-xs text-ink2">
                In arrivo: raggruppamento per <strong>persone</strong> (volti) e <strong>tag</strong> con ricerca.
              </div>
            </div>
          )
        ) : current.length === 0 ? (
          <p className="text-sm text-ink2">Nessun elemento in questa categoria.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-7">
            {current.map((it) => (
              <Thumb key={it.id} id={it.id} selected={sel.has(it.id)} onClick={() => toggle(it.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
