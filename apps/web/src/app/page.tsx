import Link from 'next/link'
import { AppPreview } from '@/components/app-preview'
import { PricingCards, FreeBanner } from '@/components/pricing-cards'
import { getDict } from '@/i18n/get-dict'

export default async function HomePage() {
  const { t } = await getDict()

  return (
    <>
      {/* ===== HERO ===== */}
      <section className="relative overflow-hidden">
        <div className="bg-grad-soft pointer-events-none absolute inset-0 -z-10" />
        <div className="container-x grid items-center gap-12 py-16 md:py-24 lg:grid-cols-2">
          <div className="animate-fade-up">
            <span className="inline-flex items-center rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-ink2">
              {t.hero.eyebrow}
            </span>
            <h1 className="mt-5 text-4xl font-bold sm:text-5xl lg:text-6xl">
              {t.hero.titleA} <span className="text-grad">{t.hero.titleB}</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-ink2">{t.hero.sub}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/download"
                className="bg-grad inline-flex items-center rounded-full px-6 py-3 text-sm font-semibold text-white transition-[filter] hover:brightness-110"
              >
                {t.hero.ctaPrimary}
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center rounded-full border border-line bg-surface px-6 py-3 text-sm font-semibold text-ink transition-colors hover:bg-bg"
              >
                {t.hero.ctaSecondary}
              </Link>
            </div>
            <p className="mt-5 text-xs text-ink2">{t.hero.trust}</p>
          </div>
          <div className="animate-fade-up [animation-delay:120ms]">
            <AppPreview />
          </div>
        </div>
      </section>

      {/* ===== FEATURES ===== */}
      <section id="funzioni" className="container-x py-16 md:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-semibold text-brand">{t.features.eyebrow}</span>
          <h2 className="mt-2 text-3xl font-bold sm:text-4xl">{t.features.title}</h2>
          <p className="mt-4 text-ink2">{t.features.sub}</p>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {t.features.items.map((f) => (
            <div key={f.title} className="rounded-xl2 border border-line bg-surface p-6 shadow-sm transition-transform hover:-translate-y-1">
              <div className="bg-grad h-1 w-9 rounded-full" />
              <h3 className="mt-4 font-display text-lg font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm text-ink2">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section id="come-funziona" className="bg-surface py-16 md:py-24">
        <div className="container-x">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-sm font-semibold text-brand">{t.how.eyebrow}</span>
            <h2 className="mt-2 text-3xl font-bold sm:text-4xl">{t.how.title}</h2>
          </div>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {t.how.steps.map((s) => (
              <div key={s.n}>
                <span className="text-grad font-display text-4xl font-bold">{s.n}</span>
                <h3 className="mt-3 font-display text-lg font-semibold">{s.title}</h3>
                <p className="mt-1.5 text-sm text-ink2">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== COMPARISON ===== */}
      <section className="container-x py-16 md:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold sm:text-4xl">{t.compare.title}</h2>
          <p className="mt-4 text-ink2">{t.compare.sub}</p>
        </div>
        <div className="mx-auto mt-12 grid max-w-4xl gap-5 md:grid-cols-2">
          <div className="rounded-xl2 border border-line bg-surface p-6">
            <h3 className="font-display text-lg font-semibold text-ink2">{t.compare.itunes}</h3>
            <ul className="mt-4 divide-y divide-line border-t border-line text-sm">
              {t.compare.itunesCons.map((c) => (
                <li key={c} className="py-3 text-ink2">
                  {c}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl2 border-2 border-brand bg-surface p-6">
            <h3 className="text-grad font-display text-lg font-bold">{t.compare.fp}</h3>
            <ul className="mt-4 divide-y divide-line border-t border-line text-sm">
              {t.compare.fpPros.map((c) => (
                <li key={c} className="py-3 font-medium">
                  {c}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ===== PRICING TEASER ===== */}
      <section className="bg-surface py-16 md:py-24">
        <div className="container-x">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-sm font-semibold text-brand">{t.pricing.eyebrow}</span>
            <h2 className="mt-2 text-3xl font-bold sm:text-4xl">{t.pricing.title}</h2>
            <p className="mt-4 text-ink2">{t.pricing.sub}</p>
          </div>
          <div className="mx-auto mt-12 max-w-5xl">
            <FreeBanner />
            <div className="mt-6">
              <PricingCards />
            </div>
            <p className="mt-6 text-center text-xs text-ink2">{t.pricing.secure}</p>
          </div>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section id="faq" className="container-x py-16 md:py-24">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center text-3xl font-bold sm:text-4xl">{t.faq.title}</h2>
          <div className="mt-10 divide-y divide-line border-y border-line">
            {t.faq.items.map((f) => (
              <details key={f.q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display font-semibold">
                  {f.q}
                  <span className="text-ink2 transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-sm text-ink2">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FINAL CTA ===== */}
      <section className="container-x pb-20">
        <div className="bg-grad rounded-xl2 px-8 py-14 text-center text-white">
          <h2 className="text-3xl font-bold sm:text-4xl">{t.finalCta.title}</h2>
          <p className="mx-auto mt-3 max-w-xl text-white/90">{t.finalCta.sub}</p>
          <Link
            href="/download"
            className="mt-7 inline-flex items-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-brand-deep transition-transform hover:scale-[1.03]"
          >
            {t.finalCta.button}
          </Link>
        </div>
      </section>
    </>
  )
}
