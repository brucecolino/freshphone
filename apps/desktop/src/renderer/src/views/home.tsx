import { useEffect, useState } from 'react'
import { cn } from '../lib/cn'
import { useDevice } from '../store/device'
import { LinkIcon, SearchIcon, AlertIcon } from '../components/icons'
import type { NavKey } from '../components/sidebar'

const gb = (b?: number) => `${((b ?? 0) / 1_000_000_000).toFixed(1)} GB`

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl2 border border-line bg-surface p-5">
      <p className="text-xs text-ink2">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold">{value}</p>
    </div>
  )
}

function LogModal({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState('Caricamento…')
  useEffect(() => {
    let alive = true
    window.fp.log.get().then((t) => {
      if (alive) setText(t)
    })
    return () => {
      alive = false
    }
  }, [])
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6" onClick={onClose}>
      <div className="flex max-h-full w-full max-w-2xl flex-col rounded-xl2 border border-line bg-surface p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display font-semibold">Log diagnostico</h2>
          <div className="flex gap-2">
            <button onClick={() => navigator.clipboard.writeText(text)} className="rounded-lg border border-line px-3 py-1 text-sm hover:bg-bg">
              Copia
            </button>
            <button onClick={() => window.fp.log.open()} className="rounded-lg border border-line px-3 py-1 text-sm hover:bg-bg">
              Apri file
            </button>
            <button onClick={onClose} className="rounded-lg border border-line px-3 py-1 text-sm hover:bg-bg">
              Chiudi
            </button>
          </div>
        </div>
        <pre className="mt-3 max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-lg bg-bg p-3 text-xs text-ink2">{text}</pre>
      </div>
    </div>
  )
}

export function Home({ onNavigate }: { onNavigate: (k: NavKey) => void }) {
  const status = useDevice((s) => s.status)
  const refresh = useDevice((s) => s.refresh)
  const [pairing, setPairing] = useState(false)
  const [showLog, setShowLog] = useState(false)

  const state = status?.state ?? 'searching'
  const free = status?.usedBytes && status?.totalBytes ? status.totalBytes - status.usedBytes : undefined
  const ready = state === 'demo' || state === 'connected'

  async function authorize() {
    setPairing(true)
    try {
      await window.fp.device.pair()
    } finally {
      setPairing(false)
      void refresh()
    }
  }

  const ui = {
    demo: { icon: <LinkIcon />, color: 'text-brand', title: 'Modalità demo', sub: 'Dati di esempio, senza telefono' },
    connected: { icon: <LinkIcon />, color: 'text-brand', title: `${status?.name ?? 'Telefono'} collegato`, sub: 'Pronto all’uso' },
    untrusted: { icon: <AlertIcon />, color: 'text-amber-500', title: 'Autorizza il telefono', sub: 'Sblocca il telefono e tocca “Autorizza” / “Consenti”' },
    searching: { icon: <SearchIcon />, color: 'text-ink2', title: 'Ricerca telefono in corso…', sub: 'Collega il telefono con un cavo e sbloccalo' },
    error: { icon: <AlertIcon />, color: 'text-red-500', title: 'Problema di connessione', sub: 'Riprova a ricollegare il telefono. Se continua, apri il log.' },
  }[state]

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Home</h1>

      <div className="mt-4 flex items-center gap-3 rounded-xl2 border border-line bg-surface p-4">
        <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bg', ui.color, state === 'searching' && 'animate-pulse')}>
          {ui.icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium">{ui.title}</p>
          <p className="truncate text-sm text-ink2">{ui.sub}</p>
        </div>
        {state === 'untrusted' && (
          <button onClick={authorize} disabled={pairing} className="bg-grad shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60">
            {pairing ? 'Attendo…' : 'Autorizza'}
          </button>
        )}
        {state === 'error' && (
          <button onClick={() => setShowLog(true)} className="shrink-0 rounded-full border border-line px-4 py-1.5 text-xs font-semibold hover:bg-bg">
            Apri log
          </button>
        )}
      </div>

      {ready && (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <Card label="Spazio usato" value={gb(status?.usedBytes)} />
            <Card label="Spazio libero" value={gb(free)} />
            <Card label="Capacità" value={gb(status?.totalBytes)} />
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <button onClick={() => onNavigate('photos')} className="bg-grad rounded-full px-5 py-2.5 text-sm font-semibold text-white">
              Sfoglia foto e video
            </button>
            <button onClick={() => onNavigate('spazio')} className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold hover:bg-surface">
              Libera spazio
            </button>
          </div>
        </>
      )}

      {showLog && <LogModal onClose={() => setShowLog(false)} />}
    </div>
  )
}
