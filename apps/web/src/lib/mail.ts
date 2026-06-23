// Invio email: usa Resend se RESEND_API_KEY è configurata, altrimenti logga (stub),
// così il flusso funziona anche in dev/test senza provider.

interface MailInput {
  to: string
  subject: string
  html: string
  text?: string
}

export async function sendMail(input: MailInput): Promise<{ ok: boolean; stub?: boolean }> {
  const key = process.env.RESEND_API_KEY
  const from = process.env.MAIL_FROM ?? 'FreshPhone <noreply@freshphone.app>'

  if (!key) {
    console.log('[mail:stub] to=%s subject=%s', input.to, input.subject)
    return { ok: true, stub: true }
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: input.to, subject: input.subject, html: input.html, text: input.text }),
  })
  return { ok: res.ok }
}

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

export function licenseEmailHtml(opts: { key: string; planName: string }): string {
  return `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:520px;margin:auto;color:#16242c">
  <h2 style="font-weight:600">La tua licenza FreshPhone</h2>
  <p>Grazie per l'acquisto del piano <strong>${opts.planName}</strong>. Ecco la tua key:</p>
  <p style="font-size:20px;letter-spacing:1px;font-weight:700;padding:14px 18px;border:1px solid #e6ecf1;border-radius:10px;display:inline-block">${opts.key}</p>
  <p>Attivala con un clic dall'app oppure dalla tua <a href="${SITE}/account">area personale</a>.</p>
</div>`
}

export function newsletterConfirmHtml(opts: { confirmUrl: string }): string {
  return `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:520px;margin:auto;color:#16242c">
  <h2 style="font-weight:600">Conferma l'iscrizione</h2>
  <p>Confermi di volerti iscrivere alle offerte FreshPhone? Clicca qui sotto.</p>
  <p><a href="${opts.confirmUrl}" style="background:#1fa08c;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none">Conferma iscrizione</a></p>
  <p style="font-size:12px;color:#5a6b75">Se non sei stato tu, ignora questa email.</p>
</div>`
}

export function newsletterCampaignHtml(opts: { message: string; promoCode?: string; unsubUrl: string }): string {
  const body = opts.message.replace(/\n/g, '<br>')
  const promo = opts.promoCode
    ? `<p style="font-size:18px;font-weight:700;padding:12px 16px;border:1px solid #e6ecf1;border-radius:10px;display:inline-block">Codice: ${opts.promoCode}</p>`
    : ''
  return `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:auto;color:#16242c">
  <div>${body}</div>
  ${promo}
  <p style="margin-top:18px"><a href="${SITE}/pricing" style="background:#1fa08c;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none">Vai a FreshPhone</a></p>
  <hr style="border:none;border-top:1px solid #e6ecf1;margin:20px 0">
  <p style="font-size:12px;color:#5a6b75">Non vuoi più ricevere queste email? <a href="${opts.unsubUrl}">Disiscriviti</a>.</p>
</div>`
}
