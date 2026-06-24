import type { Metadata } from 'next'
import { PricingCards, FreeBanner } from '@/components/pricing-cards'
import { getDict } from '@/i18n/get-dict'

export const metadata: Metadata = {
  title: 'Prezzi — FreshPhone',
  description: 'Prova gratis e passa a un piano mensile, semestrale, annuale o a vita. Pagamenti con Stripe e PayPal.',
}

export default async function PricingPage() {
  const { t } = await getDict()
  return (
    <section className="container-x py-16 md:py-24">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-4xl font-bold sm:text-5xl">{t.pricingPage.title}</h1>
        <p className="mt-4 text-ink2">{t.pricingPage.sub}</p>
      </div>
      <div className="mx-auto mt-12 max-w-5xl">
        <FreeBanner />
        <div className="mt-6">
          <PricingCards />
        </div>
        <p className="mt-8 text-center text-xs text-ink2">{t.pricingPage.note}</p>
      </div>
    </section>
  )
}
