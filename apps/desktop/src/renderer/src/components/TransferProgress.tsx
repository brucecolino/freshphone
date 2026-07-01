const OP_TITLE: Record<string, string> = {
  export: 'Esportazione su PC',
  move: 'Spostamento nel PC',
  remove: 'Eliminazione dal telefono',
  import: 'Importazione sul telefono',
}

function fmtTime(s: number): string {
  if (!isFinite(s) || s <= 0) return '0s'
  const m = Math.floor(s / 60)
  const sec = Math.round(s % 60)
  return m > 0 ? `${m} min ${String(sec).padStart(2, '0')}s` : `${sec}s`
}

// Overlay di avanzamento per copia/sposta/elimina/importa: barra, conteggio file,
// nome del file in corso e tempo rimanente stimato.
export function TransferProgress({ op, index, total, file, startedAt }: { op: string; index: number; total: number; file: string; startedAt: number }) {
  const done = total > 0 && index >= total
  const pct = total ? Math.min(100, Math.round((index / total) * 100)) : 0
  const elapsed = (Date.now() - startedAt) / 1000
  const rate = index > 0 ? index / elapsed : 0
  const remaining = rate > 0 ? (total - index) / rate : Infinity
  const shown = done ? total : Math.min(index + 1, total)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl2 border border-line bg-surface p-5 shadow-lg">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">{OP_TITLE[op] ?? 'Operazione in corso'}</h2>
          <span className="shrink-0 text-xs text-ink2">
            {shown} / {total} file
          </span>
        </div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-line">
          <div className="bg-grad h-full transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 truncate text-xs text-ink2">{done ? 'Completato' : file ? `In corso: ${file}` : 'Preparazione…'}</p>
        <p className="mt-1 text-xs text-ink2">Tempo rimanente stimato: {done ? '0s' : isFinite(remaining) ? fmtTime(remaining) : 'calcolo…'}</p>
      </div>
    </div>
  )
}
