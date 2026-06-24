import { useEffect, useMemo, useState } from 'react'
import { useDevice } from '../store/device'
import type { MediaItem } from '../types'

type SortKey = 'name' | 'date' | 'size'

const fmtSize = (b: number) =>
  b >= 1e9 ? `${(b / 1e9).toFixed(1)} GB` : b >= 1e6 ? `${(b / 1e6).toFixed(1)} MB` : b > 0 ? `${Math.round(b / 1e3)} KB` : '—'
const fmtDate = (s: string) => {
  const d = new Date(s)
  return isNaN(d.getTime()) ? '—' : new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium' }).format(d)
}

export function Files() {
  const status = useDevice((s) => s.status)
  const ready = status?.mode === 'demo' || (status?.connected === true && status?.trusted === true)
  const [items, setItems] = useState<MediaItem[]>([])
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [dir, setDir] = useState<'asc' | 'desc'>('asc')

  useEffect(() => {
    if (!ready) {
      setItems([])
      return
    }
    window.fp.device.list('files').then((x) => setItems(x as MediaItem[]))
  }, [ready])

  const view = useMemo(() => {
    return [...items].sort((a, b) => {
      const af = a.type === 'folder'
      const bf = b.type === 'folder'
      if (af !== bf) return af ? -1 : 1 // cartelle prima
      let c = 0
      if (sortKey === 'date') c = (a.date || '').localeCompare(b.date || '')
      else if (sortKey === 'size') c = a.sizeBytes - b.sizeBytes
      else c = a.name.localeCompare(b.name)
      return dir === 'asc' ? c : -c
    })
  }, [items, sortKey, dir])

  return (
    <div className="p-4">
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <h1 className="text-xl font-semibold">File</h1>
          <p className="text-sm text-ink2">{ready ? `${view.length} elementi` : 'iPhone non collegato'}</p>
        </div>
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm"
        >
          <option value="name">Nome</option>
          <option value="date">Data</option>
          <option value="size">Dimensione</option>
        </select>
        <button onClick={() => setDir((d) => (d === 'asc' ? 'desc' : 'asc'))} className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm">
          {dir === 'asc' ? 'Crescente' : 'Decrescente'}
        </button>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl2 border border-line bg-surface">
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-2 border-b border-line px-4 py-2.5 text-xs font-medium text-ink2">
          <span>Nome</span>
          <span>Tipo</span>
          <span>Dimensione</span>
          <span>Data</span>
        </div>
        {view.map((it) => (
          <div key={it.id} className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-2 border-b border-line px-4 py-2.5 text-sm last:border-0">
            <span className={it.type === 'folder' ? 'truncate font-medium' : 'truncate'}>{it.name}</span>
            <span className="text-ink2">{it.type === 'folder' ? 'Cartella' : it.kind || 'File'}</span>
            <span className="text-ink2">{it.type === 'folder' ? '—' : fmtSize(it.sizeBytes)}</span>
            <span className="text-ink2">{fmtDate(it.date)}</span>
          </div>
        ))}
      </div>
      {ready && view.length === 0 && <p className="mt-3 text-sm text-ink2">Nessun file.</p>}
      <p className="mt-3 text-xs text-ink2">La navigazione dentro le cartelle e le operazioni sui file arrivano nel prossimo aggiornamento.</p>
    </div>
  )
}
