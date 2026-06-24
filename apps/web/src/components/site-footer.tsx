import Link from 'next/link'
import { Logo } from './logo'
import { NewsletterForm } from './newsletter-form'
import { getDict } from '@/i18n/get-dict'

export async function SiteFooter() {
  const { locale, t } = await getDict()
  const f = t.footer

  const cols = [
    {
      title: f.product,
      links: [
        { href: '/#funzioni', label: f.links.features },
        { href: '/pricing', label: f.links.pricing },
        { href: '/download', label: f.links.download },
        { href: '/account', label: f.links.account },
      ],
    },
    {
      title: f.resources,
      links: [
        { href: '/#faq', label: f.links.faq },
        { href: '/#come-funziona', label: f.links.how },
        { href: 'mailto:support@freshphone.app', label: f.links.support },
      ],
    },
    {
      title: f.legal,
      links: [
        { href: '/privacy', label: f.links.privacy },
        { href: '/terms', label: f.links.terms },
        { href: '/refund', label: f.links.refund },
      ],
    },
  ]

  const nl =
    locale === 'it'
      ? { title: 'Offerte e codici sconto', text: 'Iscriviti per ricevere promo e novità. Niente spam, disiscrizione con un clic.' }
      : { title: 'Deals and discount codes', text: 'Subscribe for promos and news. No spam, one-click unsubscribe.' }

  return (
    <footer className="border-t border-line bg-surface">
      <div className="container-x border-b border-line py-10">
        <div className="grid gap-6 md:grid-cols-2 md:items-center">
          <div>
            <h3 className="font-display text-lg font-semibold">{nl.title}</h3>
            <p className="mt-1 text-sm text-ink2">{nl.text}</p>
          </div>
          <NewsletterForm locale={locale} />
        </div>
      </div>
      <div className="container-x grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-sm text-ink2">{f.tagline}</p>
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <h3 className="font-display text-sm font-semibold text-ink">{c.title}</h3>
            <ul className="mt-3 space-y-2">
              {c.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-ink2 transition-colors hover:text-ink">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line">
        <div className="container-x flex flex-col items-center justify-between gap-2 py-5 text-xs text-ink2 sm:flex-row">
          <span>© {new Date().getFullYear()} FreshPhone. {f.rights}</span>
          <span>{f.disclaimer}</span>
        </div>
      </div>
    </footer>
  )
}
