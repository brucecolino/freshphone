import { NextResponse } from 'next/server'
import { PLANS, isPaidPlan, type PlanId } from '@freshphone/shared'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { getStripe, isStripeConfigured } from '@/lib/stripe'
import { createPayPalOrder, isPayPalConfigured } from '@/lib/paypal'
import { sharedPlanToPrisma } from '@/lib/licensing'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { plan?: string; provider?: string }
  const plan = body.plan
  const provider = body.provider === 'paypal' ? 'paypal' : 'stripe'

  if (!plan || !(plan in PLANS) || !isPaidPlan(plan as PlanId)) {
    return NextResponse.json({ error: 'Piano non valido' }, { status: 400 })
  }

  const p = PLANS[plan as PlanId]
  const session = await auth()
  const email = session?.user?.email ?? undefined
  const userId = session?.user?.id
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin

  // Traccia il carrello (per il recupero degli abbandoni)
  const cart = await prisma.cart
    .create({ data: { plan: sharedPlanToPrisma(plan as PlanId), email, userId: userId ?? undefined } })
    .catch(() => null)

  if (provider === 'paypal') {
    if (!isPayPalConfigured()) {
      return NextResponse.json({ error: 'PayPal non ancora configurato.' }, { status: 503 })
    }
    try {
      const order = await createPayPalOrder({
        amountEur: p.priceEur,
        customId: `${plan}|${cart?.id ?? ''}|${userId ?? ''}`,
        description: `FreshPhone — piano ${p.name}`,
        returnUrl: `${site}/api/paypal/capture`,
        cancelUrl: `${site}/checkout?plan=${plan}&canceled=1`,
      })
      return NextResponse.json({ url: order.approveUrl })
    } catch (e) {
      console.error('paypal create error', e)
      return NextResponse.json({ error: 'Errore nella creazione del pagamento PayPal' }, { status: 500 })
    }
  }

  // Stripe
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: 'Pagamenti non ancora configurati. Riprova più tardi.' }, { status: 503 })
  }
  const isSub = p.interval !== 'once'
  const priceId = p.stripePriceEnv ? process.env[p.stripePriceEnv] : undefined
  if (isSub && !priceId) {
    return NextResponse.json({ error: `Prezzo Stripe mancante: configura ${p.stripePriceEnv}` }, { status: 503 })
  }

  try {
    const stripe = getStripe()
    const checkout = await stripe.checkout.sessions.create({
      mode: isSub ? 'subscription' : 'payment',
      line_items: priceId
        ? [{ price: priceId, quantity: 1 }]
        : [
            {
              price_data: {
                currency: 'eur',
                product_data: { name: `FreshPhone — piano ${p.name}` },
                unit_amount: Math.round(p.priceEur * 100),
              },
              quantity: 1,
            },
          ],
      customer_email: email,
      success_url: `${site}/account?purchase=success`,
      cancel_url: `${site}/checkout?plan=${plan}&canceled=1`,
      metadata: { plan, cartId: cart?.id ?? '', userId: userId ?? '' },
      ...(isSub ? { subscription_data: { metadata: { plan } } } : {}),
    })
    return NextResponse.json({ url: checkout.url })
  } catch (e) {
    console.error('checkout error', e)
    return NextResponse.json({ error: 'Errore nella creazione del pagamento' }, { status: 500 })
  }
}
