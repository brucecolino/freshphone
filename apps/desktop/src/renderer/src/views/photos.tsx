import { forwardRef, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { VirtuosoGrid } from 'react-virtuoso'
import { cn } from '../lib/cn'
import { useDevice } from '../store/device'
import type { MediaItem } from '../types'

// ===== cache anteprime (evita refetch quando i tile rientrano in vista) =====
const thumbCache = new Map<string, string>()
const inflight = new Map<string, Promise<string | null>>()
function loadThumb(id: string): Promise<string | null> {
  if (thumbCache.has(id)) return Promise.resolve(thumbCache.get(id) ?? null)
  const existing = inflight.get(id)
  if (existing) return existing
  const p = window.fp.media
    .thumb('photos', id, 384)
    .then((s) => {
      inflight.delete(id)
      if (s) thumbCache.set(id, s as string)
      return (s as string | null) ?? null
    })
    .catch(() => {
      inflight.delete(id)
      return null
    })
  inflight.set(id, p)
  return p
}

const fmtSize = (b: number) =>
  b >= 1e9 ? `${(b / 1e9).toFixed(2)} GB` : b >= 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`
const fmtDate = (s: string) => {
  const d = new Date(s)
  return isNaN(d.getTime()) ? '—' : d.toLocaleString('it-IT', { dateStyle: 'medium', timeStyle: 'short' })
}

const SORTS: { v: string; label: string }[] = [
  { v: 'date_desc', label: 'Data (più recenti)' },
  { v: 'date_asc', label: 'Data (meno recenti)' },
  { v: 'name_asc', label: 'Nome (A → Z)' },
  { v: 'name_desc', label: 'Nome (Z → A)' },
  { v: 'size_desc', label: 'Dimensione (più grandi)' },
  { v: 'size_asc', label: 'Dimensione (più piccole)' },
]
const CELL = [92, 124, 168, 230] // piccolissime → grandi

type Filter = 'all' | 'photo' | 'video'
const chips: { k: Filter; label: string }[] = [
  { k: 'all', label: 'Tutti' },
  { k: 'photo', label: 'Foto' },
  { k: 'video', label: 'Video' },
]

const GridList = forwardRef<HTMLDivElement, { style?: CSSProperties; children?: ReactNode }>(function GridList(
  { style, children, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      {...props}
      style={{
        ...style,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(var(--cell, 150px), 1fr))',
        gap: 8,
        padding: 12,
      }}
    >
      {children}
    </div>
  )
})
const GridItem = ({ children, ...props }: { children?: ReactNode }) => <div {...props}>{children}</div>

function Tile({
  item,
  selected,
  onClick,
  onContextMenu,
  onDoubleClick,
  onDragStart,
}: {
  item: MediaItem
  selected: boolean
  onClick: (e: React.MouseEvent) => void
  onContextMenu: (e: React.MouseEvent) => void
  onDoubleClick: () => void
  onDragStart: () => void
}) {
  const [src, setSrc] = useState<string | null>(() => thumbCache.get(item.id) ?? null)

  useEffect(() => {
    if (src) return
    let alive = true
    loadThumb(item.id).then((s) => {
      if (alive) setSrc(s)
    })
    return () => {
      alive = false
    }
  }, [item.id, src])

  return (
    <button
      onClick={onClick}
      onContextMenu={onContextMenu}
      onDoubleClick={onDoubleClick}
      draggable
      onDragStart={(e) => {
        e.preventDefault()
        onDragStart()
      }}
      title={`${item.name} · ${fmtSize(item.sizeBytes)} · ${fmtDate(item.date)}`}
      className={cn(
        'relative block aspect-square w-full overflow-hidden rounded-md bg-line/60',
        selected && 'ring-2 ring-brand ring-offset-2 ring-offset-bg',
      )}
    >
      {src ? <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" /> : <span className="block h-full w-full animate-pulse bg-line/50" />}
      {item.type === 'video' && (
        <span className="absolute bottom-1 right-1 rounded bg-black/55 px-1 text-[10px] font-medium text-white">video</span>
      )}
      {selected && (
        <span className="absolute left-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-brand text-[10px] font-bold text-white">
          ✓
        </span>
      )}
    </button>
  )
}

function PropertiesModal({ item, onClose }: { item: MediaItem; onClose: () => void }) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    window.fp.media.thumb('photos', item.id, 1024).then((s) => {
      if (alive) setSrc(s as string | null)
    })
    return () => {
      alive = false
    }
  }, [item.id])
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6" onClick={onClose}>
      <div className="max-h-full w-full max-w-3xl overflow-auto rounded-xl2 border border-line bg-surface p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <h2 className="font-display text-lg font-semibold">{item.name}</h2>
          <button onClick={onClose} className="rounded-lg border border-line px-3 py-1 text-sm hover:bg-bg">
            Chiudi
          </button>
        </div>
        <div className="mt-4 flex min-h-[200px] items-center justify-center rounded-lg bg-bg p-2">
          {src ? <img src={src} alt="" className="max-h-[60vh] w-auto rounded" /> : <span className="text-sm text-ink2">Anteprima in caricamento…</span>}
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <dt className="text-ink2">Tipo</dt>
          <dd>{item.type === 'video' ? 'Video' : 'Foto'} · {item.kind}</dd>
          <dt className="text-ink2">Dimensione</dt>
          <dd>{fmtSize(item.sizeBytes)}</dd>
          <dt className="text-ink2">Data</dt>
          <dd>{fmtDate(item.date)}</dd>
          <dt className="text-ink2">Nome file</dt>
          <dd className="truncate">{item.name}</dd>
        </dl>
        <div className="mt-4">
          <button
            onClick={() => window.fp.media.open('photos', item.id)}
            className="bg-grad rounded-full px-5 py-2 text-sm font-semibold text-white"
          >
            Apri nel visualizzatore di Windows
          </button>
        </div>
      </div>
    </div>
  )
}

export function Photos() {
  const status = useDevice((s) => s.status)
  const ready = status?.mode === 'demo' || (status?.connected === true && status?.trusted === true)

  const [items, setItems] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(false)
  const [sort, setSort] = useState('date_desc')
  const [filter, setFilter] = useState<Filter>('all')
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [lastIndex, setLastIndex] = useState<number | null>(null)
  const [zoom, setZoom] = useState(1)
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const [props, setProps] = useState<MediaItem | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const loadItems = useCallback(() => {
    if (!ready) {
      setItems([])
      return
    }
    setLoading(true)
    window.fp.device
      .list('photos')
      .then((x) => setItems(x as MediaItem[]))
      .finally(() => setLoading(false))
  }, [ready])

  useEffect(() => {
    loadItems()
  }, [loadItems])

  // Ctrl + rotellina = ridimensiona anteprime (e blocca lo zoom della pagina).
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return
      e.preventDefault()
      setZoom((z) => Math.min(CELL.length - 1, Math.max(0, z + (e.deltaY < 0 ? 1 : -1))))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const view = useMemo(() => {
    const filtered = items.filter((it) => (filter === 'all' ? true : filter === 'video' ? it.type === 'video' : it.type === 'photo'))
    const [key, dir] = sort.split('_')
    const sorted = [...filtered].sort((a, b) => {
      let c = 0
      if (key === 'date') c = (a.date || '').localeCompare(b.date || '')
      else if (key === 'size') c = a.sizeBytes - b.sizeBytes
      else c = a.name.localeCompare(b.name)
      return dir === 'asc' ? c : -c
    })
    return sorted
  }, [items, filter, sort])

  function clickTile(e: React.MouseEvent, index: number, id: string) {
    if (e.shiftKey && lastIndex != null) {
      const [a, b] = [Math.min(lastIndex, index), Math.max(lastIndex, index)]
      const range = view.slice(a, b + 1).map((it) => it.id)
      setSel((s) => new Set([...s, ...range]))
    } else {
      setSel((s) => {
        const n = new Set(s)
        if (n.has(id)) n.delete(id)
        else n.add(id)
        return n
      })
      setLastIndex(index)
    }
  }

  function contextTile(e: React.MouseEvent, index: number, id: string) {
    e.preventDefault()
    if (!sel.has(id)) {
      setSel(new Set([id]))
      setLastIndex(index)
    }
    setMenu({ x: e.clientX, y: e.clientY })
  }

  const selIds = () => Array.from(sel)
  function selectAll() {
    setSel(new Set(view.map((it) => it.id)))
  }
  function clearSel() {
    setSel(new Set())
  }

  async function doExport(ids: string[]) {
    setBusy(true)
    setMsg(null)
    try {
      const r = await window.fp.transfer.export('photos', ids)
      setMsg(r.ok ? `Esportati ${r.copied}/${r.total} in ${r.dir}` : r.message ?? 'Errore')
    } finally {
      setBusy(false)
    }
  }
  async function doMove(ids: string[]) {
    setBusy(true)
    setMsg(null)
    try {
      const r = await window.fp.transfer.move('photos', ids)
      if (r.ok) {
        setMsg(`Spostati ${r.moved}/${r.total} in ${r.dir}`)
        clearSel()
        loadItems()
      } else setMsg(r.message ?? 'Errore')
    } finally {
      setBusy(false)
    }
  }
  async function doRemove(ids: string[]) {
    setBusy(true)
    setMsg(null)
    try {
      const r = await window.fp.transfer.remove('photos', ids)
      if (r.ok) {
        setMsg(`Eliminati ${r.deleted}/${r.total} dall'iPhone`)
        clearSel()
        loadItems()
      } else setMsg(r.message ?? 'Errore')
    } finally {
      setBusy(false)
    }
  }
  async function doOpen(id: string) {
    const r = await window.fp.media.open('photos', id)
    if (!r.ok) setMsg(r.message ?? 'Impossibile aprire il file')
  }

  const menuItems = (() => {
    const ids = selIds()
    const one = ids.length === 1 ? ids[0] : null
    return [
      { label: 'Apri', disabled: !one, run: () => one && doOpen(one) },
      { label: 'Proprietà', disabled: !one, run: () => one && setProps(view.find((it) => it.id === one) ?? null) },
      { sep: true },
      { label: `Esporta in cartella… (${ids.length})`, run: () => doExport(ids) },
      { label: `Sposta nel PC… (${ids.length})`, run: () => doMove(ids) },
      { sep: true, danger: true },
      { label: `Elimina dall'iPhone (${ids.length})`, danger: true, run: () => doRemove(ids) },
    ] as { label?: string; sep?: boolean; danger?: boolean; disabled?: boolean; run?: () => void }[]
  })()

  return (
    <div ref={wrapRef} className="flex h-full flex-col">
      <div className="border-b border-line p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1">
            <h1 className="text-xl font-semibold">Foto e video</h1>
            <p className="text-sm text-ink2">
              {loading ? 'Caricamento libreria…' : `${view.length} elementi`}
              {sel.size > 0 ? ` · ${sel.size} selezionati` : ''}
            </p>
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm outline-none focus:border-brand"
          >
            {SORTS.map((s) => (
              <option key={s.v} value={s.v}>
                {s.label}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-1 rounded-lg border border-line p-0.5">
            <button onClick={() => setZoom((z) => Math.max(0, z - 1))} className="rounded px-2 py-1 text-sm hover:bg-bg" title="Anteprime più piccole">
              −
            </button>
            <button onClick={() => setZoom((z) => Math.min(CELL.length - 1, z + 1))} className="rounded px-2 py-1 text-sm hover:bg-bg" title="Anteprime più grandi (anche Ctrl+rotellina)">
              +
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
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
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {sel.size > 0 ? (
              <>
                <button onClick={() => doExport(selIds())} disabled={busy} className="bg-grad rounded-full px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60">
                  Esporta
                </button>
                <button onClick={() => doMove(selIds())} disabled={busy} className="rounded-full border border-line px-3 py-1.5 text-xs hover:bg-bg disabled:opacity-60">
                  Sposta
                </button>
                <button onClick={() => doRemove(selIds())} disabled={busy} className="rounded-full border border-line px-3 py-1.5 text-xs hover:bg-bg disabled:opacity-60">
                  Elimina
                </button>
                <button onClick={clearSel} className="rounded-full border border-line px-3 py-1.5 text-xs">
                  Deseleziona
                </button>
              </>
            ) : (
              <button onClick={selectAll} disabled={view.length === 0} className="rounded-full border border-line px-3 py-1.5 text-xs hover:bg-bg disabled:opacity-50">
                Seleziona tutto
              </button>
            )}
          </div>
        </div>
        {msg && <p className="mt-2 text-xs text-ink2">{msg}</p>}
      </div>

      <div className="min-h-0 flex-1" style={{ ['--cell' as string]: `${CELL[zoom]}px` }}>
        {!ready ? (
          <p className="p-6 text-sm text-ink2">Collega e autorizza l’iPhone per vedere foto e video.</p>
        ) : view.length === 0 && !loading ? (
          <p className="p-6 text-sm text-ink2">Nessun elemento.</p>
        ) : (
          <VirtuosoGrid
            data={view}
            components={{ List: GridList, Item: GridItem }}
            itemContent={(index, item) => (
              <Tile
                item={item}
                selected={sel.has(item.id)}
                onClick={(e) => clickTile(e, index, item.id)}
                onContextMenu={(e) => contextTile(e, index, item.id)}
                onDoubleClick={() => doOpen(item.id)}
                onDragStart={() => window.fp.transfer.startDrag('photos', sel.has(item.id) ? selIds() : [item.id])}
              />
            )}
            style={{ height: '100%' }}
          />
        )}
      </div>

      {menu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenu(null)} onContextMenu={(e) => { e.preventDefault(); setMenu(null) }} />
          <div
            className="fixed z-50 min-w-48 overflow-hidden rounded-lg border border-line bg-surface py-1 shadow-lg"
            style={{ left: Math.min(menu.x, window.innerWidth - 220), top: Math.min(menu.y, window.innerHeight - 240) }}
          >
            {menuItems.map((m, i) =>
              m.sep ? (
                <div key={i} className="my-1 border-t border-line" />
              ) : (
                <button
                  key={i}
                  disabled={m.disabled}
                  onClick={() => {
                    setMenu(null)
                    m.run?.()
                  }}
                  className={cn(
                    'block w-full px-3 py-1.5 text-left text-sm hover:bg-bg disabled:opacity-40',
                    m.danger && 'text-red-500',
                  )}
                >
                  {m.label}
                </button>
              ),
            )}
          </div>
        </>
      )}

      {props && <PropertiesModal item={props} onClose={() => setProps(null)} />}
    </div>
  )
}
