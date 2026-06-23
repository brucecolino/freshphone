'use client'

import { useEffect, useState } from 'react'

export function ThemeToggle() {
  const [dark, setDark] = useState(false)

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'))
  }, [])

  function toggle() {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    try {
      localStorage.setItem('theme', next ? 'dark' : 'light')
    } catch {
      /* ignore */
    }
  }

  return (
    <button
      onClick={toggle}
      aria-label={dark ? 'Passa al tema chiaro' : 'Passa al tema scuro'}
      className="rounded-lg border border-line px-3 py-2 text-xs font-medium text-ink2 transition-colors hover:bg-bg hover:text-ink"
    >
      {dark ? 'Chiaro' : 'Scuro'}
    </button>
  )
}
