import { PLANS, type PlanId } from '@freshphone/shared'
import { capturePayPalOrder } from '@/lib/paypal'
import { fulfillOrder } from '@/lib/fulfillment'

export const runtime = 'nodejs'

// PayPal reindirizza qui dopo l'approvazione (?token=ORDER_ID). Catturiamo il
// pagamento ed emettiamo la licenza (fulfillOrder è idempotente sull'order id).
export async function GET(req: Request) {
  const url = new URL(req.url)
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? url.origin
  const orderId = url.searchParams.get('token')

  if (!orderId) return Response.redirect(`${site}/checkout?error=1`, 303)

  try {
    const { ok, data } = await capturePayPalOrder(orderId)
    if (!ok || data.status !== 'COMPLETED') {
      return Response.redirect(`${site}/checkout?error=1`, 303)
    }
    const pu = data.purchase_units?.[0]
    const cap = pu?.payments?.captures?.[0]
    const custom = pu?.custom_id ?? cap?.custom_id ?? ''
    const [plan, cartId, userId] = custom.split('|')
    const email = data.payer?.email_address ?? ''
    const amountCents = Math.round(parseFloat(cap?.amount?.value ?? '0') * 100)

    if (plan && plan in PLANS && email) {
      await fulfillOrder({
        provider: 'PAYPAL',
        providerCheckoutId: orderId,
        plan: plan as PlanId,
        email,
        userId: userId || null,
        amountCents,
        cartId: cartId || null,
      })
    }
    return Response.redirect(`${site}/account?purchase=success`, 303)
  } catch (e) {
    console.error('paypal capture error', e)
    return Response.redirect(`${site}/checkout?error=1`, 303)
  }
}
