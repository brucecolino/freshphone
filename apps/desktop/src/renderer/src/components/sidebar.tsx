import { cn } from '../lib/cn'
import { useDevice } from '../store/device'

export type NavKey = 'home' | 'photos' | 'files' | 'spazio' | 'settings'

const items: { k: NavKey; label: string }[] = [
  { k: 'home', label: 'Home' },
  { k: 'photos', label: 'Foto e video' },
  { k: 'files', label: 'File' },
  { k: 'spazio', label: 'Spazio' },
  { k: 'settings', label: 'Impostazioni' },
]

const gb = (b?: number) => `${((b ?? 0) / 1_000_000_000).toFixed(1)} GB`

export function Sidebar({ active, onSelect }: { active: NavKey; onSelect: (k: NavKey) => void }) {
  const status = useDevice((s) => s.status)

  const pct =
    status?.usedBytes && status?.totalBytes ? Math.min(100, (status.usedBytes / status.totalBytes) * 100) : 0

  const title =
    status?.mode === 'demo'
      ? 'iPhone (demo)'
      : status?.connected
        ? status.name ?? 'iPhone'
        : status?.toolsOk === false
          ? 'Strumenti non installati'
          : 'Nessun iPhone'

  const subtitle =
    status?.mode === 'demo'
      ? 'Modalità demo attiva'
      : status?.connected && !status.trusted
        ? 'Autorizza sul telefono'
        : status?.toolsOk === false
          ? 'Vedi resources/bin'
          : 'Collega il dispositivo'

  return (
    <nav className="flex w-44 shrink-0 flex-col gap-1 border-r border-line bg-side p-3">
      {items.map((it) => (
        <button
          key={it.k}
          onClick={() => onSelect(it.k)}
          className={cn(
            'rounded-lg px-3 py-2 text-left text-sm transition-colors',
            active === it.k ? 'bg-pill font-medium text-pillt' : 'text-ink2 hover:bg-bg hover:text-ink',
          )}
        >
          {it.label}
        </button>
      ))}

      <div className="mt-auto rounded-lg border border-line p-3 text-xs">
        <p className="font-medium">{title}</p>
        {status?.connected && status.trusted && status.totalBytes ? (
          <>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
              <div className="bg-grad h-full" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-1 text-ink2">
              {gb(status.usedBytes)} / {gb(status.totalBytes)}
            </p>
          </>
        ) : (
          <p className="mt-1 text-ink2">{subtitle}</p>
        )}
      </div>
    </nav>
  )
}
