'use client'

import { useRouter } from 'next/navigation'
import { cn } from '@/lib/cn'

export function LanguageSwitcher({ locale }: { locale: 'it' | 'en' }) {
  const router = useRouter()

  function set(l: 'it' | 'en') {
    document.cookie = `locale=${l};path=/;max-age=31536000`
    router.refresh()
  }

  return (
    <div className="flex overflow-hidden rounded-lg border border-line text-xs">
      {(['it', 'en'] as const).map((l) => (
        <button
          key={l}
          onClick={() => set(l)}
          aria-label={l === 'it' ? 'Italiano' : 'English'}
          className={cn('px-2 py-1.5 font-medium uppercase transition-colors', locale === l ? 'text-brand' : 'text-ink2 hover:text-ink')}
        >
          {l}
        </button>
      ))}
    </div>
  )
}
