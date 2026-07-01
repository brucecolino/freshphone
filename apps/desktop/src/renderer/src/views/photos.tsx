import { useEffect, useMemo, useState } from 'react'
import { cn } from '../lib/cn'
import { useDevice } from '../store/device'
import { useLibrary } from '../store/library'
import { MediaGrid } from '../components/MediaGrid'

const SORTS: { v: string; label: string }[] = [
  { v: 'date_desc', label: 'Data (più recenti)' },
  { v: 'date_asc', label: 'Data (meno recenti)' },
  { v: 'name_asc', label: 'Nome (A → Z)' },
  { v: 'name_desc', label: 'Nome (Z → A)' },
  { v: 'size_desc', label: 'Dimensione (più grandi)' },
  { v: 'size_asc', label: 'Dimensione (più piccole)' },
]

type Filter = 'all' | 'photo' | 'video'
const chips: { k: Filter; label: string }[] = [
  { k: 'all', label: 'Tutti' },
  { k: 'photo', label: 'Foto' },
  { k: 'video', label: 'Video' },
]

export function Photos() {
  const status = useDevice((s) => s.status)
  const ready = status?.mode === 'demo' || (status?.connected === true && status?.trusted === true)

  const items = useLibrary((s) => s.items)
  const loading = useLibrary((s) => s.loading)
  const ensureLib = useLibrary((s) => s.ensure)
  const [sort, setSort] = useState('date_desc')
  const [filter, setFilter] = useState<Filter>('all')
  const [byMonth, setByMonth] = useState(false)

  // La lista vive nello store condiviso: scansione UNA volta, persiste tra le schede.
  useEffect(() => {
    if (ready) ensureLib()
  }, [ready, ensureLib])

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

  if (!ready) {
    return <p className="p-6 text-sm text-ink2">Collega e sblocca il telefono per vedere foto e video.</p>
  }

  const controls = (
    <>
      <div className="inline-flex rounded-lg border border-line p-0.5">
        {chips.map((c) => (
          <button
            key={c.k}
            onClick={() => setFilter(c.k)}
            className={cn('rounded-md px-3 py-1 text-xs transition-colors', filter === c.k ? 'bg-pill font-medium text-pillt' : 'text-ink2 hover:text-ink')}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <button
          onClick={() => setByMonth((v) => !v)}
          className={cn('h-8 rounded-lg border px-3 text-xs transition-colors', byMonth ? 'border-brand text-brand' : 'border-line text-ink2 hover:text-ink')}
        >
          Dividi per mese
        </button>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="h-8 rounded-lg border border-line bg-surface px-2 text-xs outline-none focus:border-brand"
        >
          {SORTS.map((s) => (
            <option key={s.v} value={s.v}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
    </>
  )

  return (
    <MediaGrid
      items={view}
      byMonth={byMonth}
      heading="Foto e video"
      subtitle={loading ? 'Caricamento libreria…' : `${view.length} elementi`}
      controls={controls}
    />
  )
}
