import { useTheme } from '../store/theme'
import { Logo } from './logo'
import { SunIcon, MoonIcon } from './icons'

export function Header() {
  const resolved = useTheme((s) => s.resolved)
  const setSource = useTheme((s) => s.setSource)
  const isDark = resolved === 'dark'

  return (
    <header className="flex items-center gap-3 border-b border-line bg-surface px-4 py-2.5">
      <Logo />
      <span className="hidden text-sm text-ink2 sm:inline">Smart Phone File Manager</span>
      <button
        onClick={() => void setSource(isDark ? 'light' : 'dark')}
        title={isDark ? 'Passa al tema chiaro' : 'Passa al tema scuro'}
        aria-label="Cambia tema"
        className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ink2 transition-colors hover:border-brand hover:text-brand"
      >
        {isDark ? <MoonIcon /> : <SunIcon />}
      </button>
    </header>
  )
}
