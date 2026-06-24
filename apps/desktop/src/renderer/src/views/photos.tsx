import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '../lib/cn'
import type { MediaItem } from '../types'

const palette = [
  '#86C9B0', '#8FBFD6', '#7FB7C9', '#E6B980', '#E0A38F', '#B3A6E0', '#AEB9C2', '#9BCF8E', '#8FB0D6', '#A0CBB4', '#C9B27F', '#7FC9B8',
]

const fmtSize = (b: number) =>
  b >= 1e9 ? `${(b / 1e9).toFixed(1)} GB` : b >= 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${(b / 1e3).toFixed(0)} KB`
const fmtDur = (s?: number) => (s == null ? '' : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`)

function AssetTile({
  item,
  color,
  selected,
  onClick,
  onDragStart,
}: {
  item: MediaItem
  color: string
  selected: boolean
  onClick: () => void
  onDragStart?: () => void
}) {
  const ref = useRef<HTMLButtonElement>(null)
  const [src, setSrc] = useState<string | null>(null)
  const [tried, setTried] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || tried) return
    let cancelled = false
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            io.disconnect()
            setTried(true)
            window.fp.media
              .thumb('photos', item.id)
              .then((s) => {
                if (!cancelled) setSrc(s as string | null)
              })
              .catch(() => undefined)
          }
        }
      },
      { rootMargin: '200px' },
    )
    io.observe(el)
    return () => {
      cancelled = true
      io.disconnect()
    }
  }, [item.id, tried])

  return (
    <button
      ref={ref}
      onClick={onClick}
      draggable
      onDragStart={(e) => {
        e.preventDefault()
        onDragStart?.()
      }}
      title={`${item.name}${item.sizeBytes ? ` · ${fmtSize(item.sizeBytes)}` : ''}`}
      className={cn(
        'relative aspect-square overflow-hidden rounded-md',
        selected && 'ring-2 ring-brand ring-offset-2 ring-offset-bg',
      )}
      style={src ? undefined : { background: color }}
    >
      {src && <img src={src} alt="" className="h-full w-full object-cover" />}
      {item.type === 'video' && (
        <span className="absolute bottom-1 right-1 rounded bg-black/55 px-1 text-[10px] text-white">
          {fmtDur(item.durationSec)}
        </span>
      )}
    </button>
  )
}

type SortKey = 'date' | 'size' | 'name'
type Filter = 'all' | 'photo' | 'video'

const chips: { k: Filter; label: string }[] = [
  { k: 'all', label: 'Tutti' },
  { k: 'photo', label: 'Foto' },
  { k: 'video', label: 'Video' },
]

export function Photos() {
  const [items, setItems] = useState<MediaItem[]>([])
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [dir, setDir] = useState<'asc' | 'desc'>('desc')
  const [filter, setFilter] = useState<Filter>('all')
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [caps, setCaps] = useState<{ afc: boolean; ffmpeg: boolean } | null>(null)
  const [mode, setMode] = useState<string | undefined>()
  const [exporting, setExporting] = useState(false)
  const [exportMsg, setExportMsg] = useState<string | null>(null)

  const loadItems = useCallback(() => {
    window.fp.device.list('photos').then((x) => setItems(x as MediaItem[]))
  }, [])

  useEffect(() => {
    loadItems()
    window.fp.device.status().then((s) => setMode((s as { mode?: string }).mode))
    window.fp.media.capabilities().then((c) => setCaps(c as { afc: boolean; ffmpeg: boolean }))
  }, [loadItems])

  const view = useMemo(() => {
    const filtered = items.filter((it) =>
      filter === 'all' ? true : filter === 'video' ? it.type === 'video' : it.type === 'photo',
    )
    return [...filtered].sort((a, b) => {
      let c = 0
      if (sortKey === 'date') c = a.date.localeCompare(b.date)
      else if (sortKey === 'size') c = a.sizeBytes - b.sizeBytes
      else c = a.name.localeCompare(b.name)
      return dir === 'asc' ? c : -c
    })
  }, [items, filter, sortKey, dir])

  function toggle(id: string) {
    setSel((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  async function doExport() {
    setExporting(true)
    setExportMsg(null)
    try {
      const r = await window.fp.transfer.export('photos', Array.from(sel))
      setExportMsg(r.ok ? `Esportati ${r.copied}/${r.total} in ${r.dir}` : r.message ?? 'Errore')
    } finally {
      setExporting(false)
    }
  }

  async function doRemove() {
    setExporting(true)
    setExportMsg(null)
    try {
      const r = await window.fp.transfer.remove('photos', Array.from(sel))
      if (r.ok) {
        setExportMsg(`Eliminati ${r.deleted}/${r.total} dall'iPhone`)
        setSel(new Set())
        loadItems()
      } else {
        setExportMsg(r.message ?? 'Errore')
      }
    } finally {
      setExporting(false)
    }
  }

  function doDrag(id: string) {
    window.fp.transfer.startDrag('photos', sel.has(id) ? Array.from(sel) : [id])
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-line p-4">
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <h1 className="text-xl font-semibold">Foto e video</h1>
            <p className="text-sm text-ink2">
              {view.length} elementi{sel.size > 0 ? ` · ${sel.size} selezionati` : ''}
            </p>
          </div>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm"
          >
            <option value="date">Data</option>
            <option value="size">Dimensione</option>
            <option value="name">Nome</option>
          </select>
          <button onClick={() => setDir((d) => (d === 'asc' ? 'desc' : 'asc'))} className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm">
            {dir === 'asc' ? 'Crescente' : 'Decrescente'}
          </button>
        </div>
        {mode === 'device' && caps && (!caps.afc || !caps.ffmpeg) && (
          <p className="mt-2 text-xs text-ink2">
            {!caps.afc && 'Per leggere i contenuti installa pymobiledevice3 in resources/bin. '}
            {!caps.ffmpeg && 'Per le anteprime HEIC/video installa ffmpeg in resources/bin.'}
          </p>
        )}
        <div className="mt-3 flex items-center gap-2">
          {chips.map((c) => (
            <button
              key={c.k}
              onClick={() => setFilter(c.k)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs transition-colors',
                filter === c.k ? 'border-transparent bg-brand text-white' : 'border-line text-ink2',
              )}
            >
              {c.label}
            </button>
          ))}
          {sel.size > 0 && (
            <div className="ml-auto flex gap-2">
              <button onClick={doExport} disabled={exporting} className="bg-grad rounded-full px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60">
                {exporting ? 'Esporto…' : 'Esporta selezione'}
              </button>
              <button onClick={doRemove} disabled={exporting} className="rounded-full border border-line px-3 py-1.5 text-xs hover:bg-bg disabled:opacity-60">
                Elimina
              </button>
              <button onClick={() => setSel(new Set())} className="rounded-full border border-line px-3 py-1.5 text-xs">
                Deseleziona
              </button>
            </div>
          )}
        </div>
        {exportMsg && <p className="mt-2 text-xs text-ink2">{exportMsg}</p>}
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
          {view.map((it, i) => (
            <AssetTile
              key={it.id}
              item={it}
              color={palette[i % palette.length]}
              selected={sel.has(it.id)}
              onClick={() => toggle(it.id)}
              onDragStart={() => doDrag(it.id)}
            />
          ))}
        </div>
        {view.length === 0 && (
          <p className="mt-2 text-sm text-ink2">
            Nessun elemento. Con l’iPhone collegato e autorizzato, la lettura richiede pymobiledevice3 in resources/bin.
            Anteprime e metadati arrivano nel passo successivo.
          </p>
        )}
      </div>
    </div>
  )
}
