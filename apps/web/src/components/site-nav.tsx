'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Logo } from './logo'
import { ThemeToggle } from './theme-toggle'
import { LanguageSwitcher } from './language-switcher'
import type { Dict } from '@/i18n/dictionaries'

export function SiteNav({ nav, locale }: { nav: Dict['nav']; locale: 'it' | 'en' }) {
  const [open, setOpen] = useState(false)

  const links = [
    { href: '/#funzioni', label: nav.features },
    { href: '/#come-funziona', label: nav.how },
    { href: '/pricing', label: nav.pricing },
    { href: '/#faq', label: nav.faq },
  ]

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-bg/80 backdrop-blur-md">
      <nav className="container-x flex h-16 items-center justify-between gap-4">
        <Link href="/" aria-label="FreshPhone — home">
          <Logo />
        </Link>

        <div className="hidden items-center gap-7 md:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="text-sm text-ink2 transition-colors hover:text-ink">
              {l.label}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-2.5 md:flex">
          <LanguageSwitcher locale={locale} />
          <ThemeToggle />
          <Link href="/account" className="px-2 text-sm text-ink2 transition-colors hover:text-ink">
            {nav.signin}
          </Link>
          <Link
            href="/download"
            className="bg-grad inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold text-white transition-[filter] hover:brightness-110"
          >
            {nav.download}
          </Link>
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <LanguageSwitcher locale={locale} />
          <ThemeToggle />
          <button
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            className="rounded-lg border border-line px-3 py-2 text-xs font-medium text-ink"
          >
            {open ? (locale === 'it' ? 'Chiudi' : 'Close') : 'Menu'}
          </button>
        </div>
      </nav>

      {open && (
        <div className="border-t border-line bg-surface md:hidden">
          <div className="container-x flex flex-col gap-1 py-3">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-2.5 text-sm text-ink2 hover:bg-bg"
              >
                {l.label}
              </Link>
            ))}
            <Link href="/account" onClick={() => setOpen(false)} className="rounded-lg px-2 py-2.5 text-sm text-ink2 hover:bg-bg">
              {nav.signin}
            </Link>
            <Link
              href="/download"
              onClick={() => setOpen(false)}
              className="bg-grad mt-1 rounded-full px-4 py-2.5 text-center text-sm font-semibold text-white"
            >
              {nav.download}
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}
