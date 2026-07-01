import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import type { PlanId } from '@freshphone/shared'
import { getStripe } from '@/lib/stripe'
import { fulfillOrder } from '@/lib/fulfillment'
import { syncSubscriptionState } from '@/lib/licensing'

export const runtime = 'nodejs'

// current_period_end è cambiato di posizione tra le versioni dell'API Stripe
// (subscription vs subscription item): leggiamo entrambe le forme.
function currentPeriodEnd(sub: Stripe.Subscription): number | null {
  const s = sub as unknown as {
    current_period_end?: number
    items?: { data?: { current_period_end?: number }[] }
  }
  if (typeof s.current_period_end === 'number') return s.current_period_end
  const item = s.items?.data?.[0]?.current_period_end
  return typeof item === 'number' ? item : null
}

// L'id abbonamento sulla fattura può stare in `subscription` (vecchio) o
// `parent.subscription_details.subscription` (nuovo).
function invoiceSubscriptionId(inv: Stripe.Invoice): string | null {
  const i = inv as unknown as {
    subscription?: string | { id?: string } | null
    parent?: { subscription_details?: { subscription?: string | { id?: string } | null } | null } | null
  }
  const s = i.subscription ?? i.parent?.subscription_details?.subscription ?? null
  if (!s) return null
  return typeof s === 'string' ? s : (s.id ?? null)
}

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) return NextResponse.json({ error: 'webhook non configurato' }, { status: 503 })

  const sig = req.headers.get('stripe-signature')
  if (!sig) return NextResponse.json({ error: 'firma mancante' }, { status: 400 })

  const raw = await req.text()
  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(raw, sig, secret)
  } catch {
    return NextResponse.json({ error: 'firma non valida' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object as Stripe.Checkout.Session
        const plan = (s.metadata?.plan ?? '') as PlanId
        const email = s.customer_details?.email ?? s.customer_email ?? ''
        if (plan && email) {
          await fulfillOrder({
            provider: 'STRIPE',
            providerCheckoutId: s.id,
            providerSubscriptionId: typeof s.subscription === 'string' ? s.subscription : null,
            plan,
            email,
            userId: s.metadata?.userId || null,
            amountCents: s.amount_total ?? 0,
            cartId: s.metadata?.cartId || null,
            promoCodeId: s.metadata?.promoCodeId || null,
          })
        }
        break
      }
      // Rinnovo riuscito (o primo pagamento): allinea la scadenza al periodo pagato.
      case 'invoice.paid':
      case 'invoice.payment_succeeded': {
        const inv = event.data.object as Stripe.Invoice
        const subId = invoiceSubscriptionId(inv)
        if (subId) {
          const sub = await getStripe().subscriptions.retrieve(subId)
          await syncSubscriptionState({ subscriptionId: subId, stripeStatus: sub.status, currentPeriodEnd: currentPeriodEnd(sub) })
        }
        break
      }
      // Pagamento fallito: PAST_DUE. Stripe ritenta; la licenza resta valida finché
      // non passa la scadenza. Se i retry si esauriscono arriva subscription.updated/deleted.
      case 'invoice.payment_failed': {
        const inv = event.data.object as Stripe.Invoice
        const subId = invoiceSubscriptionId(inv)
        if (subId) await syncSubscriptionState({ subscriptionId: subId, stripeStatus: 'past_due' })
        break
      }
      case 'customer.subscription.updated': {
        const snap = event.data.object as Stripe.Subscription
        // Rileggi lo stato più recente: gli eventi Stripe possono arrivare fuori ordine
        // e lo snapshot dell'evento potrebbe portare un period_end/stato non aggiornato.
        const sub = await getStripe().subscriptions.retrieve(snap.id)
        await syncSubscriptionState({ subscriptionId: sub.id, stripeStatus: sub.status, currentPeriodEnd: currentPeriodEnd(sub) })
        break
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        await syncSubscriptionState({ subscriptionId: sub.id, stripeStatus: 'canceled', currentPeriodEnd: currentPeriodEnd(sub) })
        break
      }
      default:
        break
    }
  } catch (e) {
    console.error('stripe webhook handler error', e)
    return NextResponse.json({ error: 'handler error' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
