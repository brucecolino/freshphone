// Client PayPal via REST (niente SDK, niente segreti al load: tutto lazy).
// Modalità one-time (Orders API) per qualsiasi piano: il prezzo viene pagato una
// volta e la licenza riceve la durata del piano (no rinnovo automatico via PayPal;
// i rinnovi ricorrenti restano su Stripe).

const ENV = process.env.PAYPAL_ENV === 'live' ? 'live' : 'sandbox'
const BASE = ENV === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com'

export function isPayPalConfigured(): boolean {
  return Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET)
}

async function accessToken(): Promise<string> {
  const id = process.env.PAYPAL_CLIENT_ID
  const secret = process.env.PAYPAL_CLIENT_SECRET
  if (!id || !secret) throw new Error('PayPal non configurato')
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })
  if (!res.ok) throw new Error('PayPal: autenticazione fallita')
  const json = (await res.json()) as { access_token: string }
  return json.access_token
}

interface PayPalLink {
  rel: string
  href: string
}

export async function createPayPalOrder(opts: {
  amountEur: number
  customId: string
  description: string
  returnUrl: string
  cancelUrl: string
}): Promise<{ id: string; approveUrl: string }> {
  const token = await accessToken()
  const res = await fetch(`${BASE}/v2/checkout/orders`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: { currency_code: 'EUR', value: opts.amountEur.toFixed(2) },
          custom_id: opts.customId,
          description: opts.description,
        },
      ],
      application_context: {
        brand_name: 'FreshPhone',
        user_action: 'PAY_NOW',
        shipping_preference: 'NO_SHIPPING',
        return_url: opts.returnUrl,
        cancel_url: opts.cancelUrl,
      },
    }),
  })
  const json = (await res.json()) as { id?: string; links?: PayPalLink[] }
  if (!res.ok || !json.id) throw new Error('PayPal: creazione ordine fallita')
  const approveUrl = json.links?.find((l) => l.rel === 'approve')?.href
  if (!approveUrl) throw new Error('PayPal: link di approvazione mancante')
  return { id: json.id, approveUrl }
}

interface PayPalCapture {
  status?: string
  payer?: { email_address?: string }
  purchase_units?: Array<{
    custom_id?: string
    payments?: { captures?: Array<{ custom_id?: string; amount?: { value?: string } }> }
  }>
}

export async function capturePayPalOrder(orderId: string): Promise<{ ok: boolean; data: PayPalCapture }> {
  const token = await accessToken()
  const res = await fetch(`${BASE}/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  })
  const data = (await res.json()) as PayPalCapture
  return { ok: res.ok, data }
}
