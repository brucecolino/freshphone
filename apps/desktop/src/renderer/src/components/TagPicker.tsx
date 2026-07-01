import { useState } from 'react'
import { cn } from '../lib/cn'
import { useTags, TAG_COLORS } from '../store/tags'

// Popover per creare tag (titolo + colore) e assegnarli/rimuoverli su uno o più
// file insieme. Lo stato del check riflette la selezione (tutti / alcuni / nessuno).
export function TagPicker({ fileIds, onClose, style }: { fileIds: string[]; onClose: () => void; style?: React.CSSProperties }) {
  const tags = useTags((s) => s.tags)
  const assign = useTags((s) => s.assign)
  const createTag = useTags((s) => s.createTag)
  const removeTag = useTags((s) => s.removeTag)
  const toggleAssign = useTags((s) => s.toggleAssign)
  const [label, setLabel] = useState('')
  const [color, setColor] = useState(TAG_COLORS[0])

  const stateFor = (tagId: string): 'none' | 'some' | 'all' => {
    const n = fileIds.filter((f) => (assign[f] ?? []).includes(tagId)).length
    return n === 0 ? 'none' : n === fileIds.length ? 'all' : 'some'
  }

  function create() {
    const t = createTag(label, color)
    if (t) toggleAssign(t.id, fileIds)
    setLabel('')
  }

  return (
    <div
      className="fixed z-50 w-64 rounded-lg border border-line bg-surface p-2 shadow-lg"
      style={style}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <p className="px-1 pb-1 text-xs font-medium text-ink2">Tag per {fileIds.length} file</p>
      <div className="max-h-44 overflow-auto">
        {tags.length === 0 && <p className="px-1 py-2 text-xs text-ink2">Nessun tag ancora. Creane uno qui sotto.</p>}
        {tags.map((t) => {
          const st = stateFor(t.id)
          return (
            <div key={t.id} className="group flex items-center gap-1 rounded-md hover:bg-bg">
              <button onClick={() => toggleAssign(t.id, fileIds)} className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left text-sm">
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: t.color }} />
                <span className="min-w-0 flex-1 truncate">{t.label}</span>
                <span className={cn('text-xs', st === 'all' ? 'text-brand' : 'text-ink2')}>{st === 'all' ? '✓' : st === 'some' ? '–' : '+'}</span>
              </button>
              <button onClick={() => removeTag(t.id)} title="Elimina tag" className="px-2 text-xs text-ink2 opacity-0 hover:text-red-500 group-hover:opacity-100">
                ✕
              </button>
            </div>
          )
        })}
      </div>
      <div className="mt-1 border-t border-line pt-2">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') create()
          }}
          placeholder="Nuovo tag…"
          className="h-8 w-full rounded-md border border-line bg-bg px-2 text-sm outline-none focus:border-brand"
        />
        <div className="mt-2 flex items-center gap-1.5">
          {TAG_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={cn('h-5 w-5 rounded-full', color === c && 'ring-2 ring-ink ring-offset-1 ring-offset-surface')}
              style={{ background: c }}
            />
          ))}
        </div>
        <div className="mt-2 flex justify-end gap-2">
          <button onClick={onClose} className="h-7 rounded-md border border-line px-3 text-xs hover:bg-bg">
            Chiudi
          </button>
          <button onClick={create} disabled={!label.trim()} className="bg-grad h-7 rounded-md px-3 text-xs font-semibold text-white disabled:opacity-50">
            Crea e assegna
          </button>
        </div>
      </div>
    </div>
  )
}
