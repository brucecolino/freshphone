// Template email FreshPhone — sorgente unica, usata sia dall'app (mail.ts) sia
// dallo script di invio campioni. Layout coerente per ogni tipo di email.
// Vincolo: nessuna icona/emoji. Tabelle e stili inline per i client di posta.

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://freshphone.it'
const LOGO = `${SITE}/freshphone-logo.png`
const GRAD = 'linear-gradient(90deg,#2c6e9c,#29a99b,#57c98a)'

const C = {
  bg: '#f6f8fa',
  surface: '#ffffff',
  ink: '#16242c',
  ink2: '#5a6b75',
  line: '#e6ecf1',
  brand: '#1fa08c',
  deep: '#1d5a77',
}
const FONT = 'Segoe UI, -apple-system, BlinkMacSystemFont, Arial, sans-serif'
const MONO = "'SFMono-Regular', Consolas, Menlo, monospace"

function formatEur(v) {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v)
}

function button(href, label) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:10px 0 4px;"><tr>
    <td align="center" style="border-radius:999px;background:${C.brand};background-image:${GRAD};">
      <a href="${href}" style="display:inline-block;padding:12px 28px;font-family:${FONT};font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:999px;">${label}</a>
    </td></tr></table>`
}

function keyBox(text) {
  return `<div style="font-family:${MONO};font-size:20px;font-weight:700;letter-spacing:1px;color:${C.ink};background:${C.bg};border:1px solid ${C.line};border-radius:10px;padding:15px 18px;text-align:center;margin:8px 0 16px;">${text}</div>`
}

function row(label, value) {
  return `<tr>
    <td style="padding:9px 0;border-bottom:1px solid ${C.line};font-family:${FONT};font-size:14px;color:${C.ink2};">${label}</td>
    <td style="padding:9px 0;border-bottom:1px solid ${C.line};font-family:${FONT};font-size:14px;color:${C.ink};text-align:right;font-weight:600;">${value}</td>
  </tr>`
}

function shell({ preheader = '', heading = '', intro = '', body = '', showUnsub = false, unsubUrl = '' }) {
  return `<!doctype html>
<html lang="it"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
</head>
<body style="margin:0;padding:0;background:${C.bg};">
<span style="display:none;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${C.bg};">${preheader}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.bg};">
  <tr><td align="center" style="padding:28px 12px;">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px;max-width:100%;background:${C.surface};border:1px solid ${C.line};border-radius:14px;overflow:hidden;">
      <tr><td style="height:6px;line-height:6px;font-size:0;background:#29a99b;background-image:${GRAD};">&nbsp;</td></tr>
      <tr><td align="center" style="padding:26px 28px 14px;background:#ffffff;">
        <img src="${LOGO}" width="196" alt="FreshPhone" style="display:block;width:196px;max-width:72%;height:auto;border:0;outline:none;text-decoration:none;">
      </td></tr>
      <tr><td style="padding:28px 28px 6px;">
        ${heading ? `<h1 style="margin:0 0 10px;font-family:${FONT};font-size:21px;font-weight:700;color:${C.deep};">${heading}</h1>` : ''}
        ${intro ? `<p style="margin:0 0 18px;font-family:${FONT};font-size:15px;line-height:1.55;color:${C.ink2};">${intro}</p>` : ''}
        ${body}
      </td></tr>
      <tr><td style="padding:22px 28px 28px;">
        <hr style="border:none;border-top:1px solid ${C.line};margin:0 0 16px;">
        <p style="margin:0;font-family:${FONT};font-size:12px;line-height:1.7;color:${C.ink2};">
          Serve aiuto? Scrivi a <a href="mailto:support@freshphone.it" style="color:${C.brand};text-decoration:none;">support@freshphone.it</a>.<br>
          FreshPhone — <a href="${SITE}" style="color:${C.brand};text-decoration:none;">freshphone.it</a>${showUnsub ? ` — <a href="${unsubUrl}" style="color:${C.ink2};text-decoration:underline;">disiscriviti</a>` : ''}
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`
}

export function orderEmailHtml(opts) {
  const providerLabel = opts.provider === 'PAYPAL' ? 'PayPal' : 'Carta di credito'
  const body = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;">
      ${row('Numero ordine', `<span style="font-family:${MONO};">${opts.orderNumber}</span>`)}
      ${row('Piano', opts.planName)}
      ${row('Importo', formatEur(opts.amountEur))}
      ${row('Metodo di pagamento', providerLabel)}
      ${row('Data', opts.dateStr)}
    </table>
    <p style="margin:0 0 4px;font-family:${FONT};font-size:14px;color:${C.ink2};">La tua chiave di licenza</p>
    ${keyBox(opts.key)}
    <p style="margin:0 0 16px;font-family:${FONT};font-size:15px;line-height:1.55;color:${C.ink};">Attivala con un clic dall'area personale, oppure inseriscila nell'app desktop in <strong>Impostazioni &rarr; Licenza</strong>.</p>
    ${button(`${SITE}/account`, 'Vai all&rsquo;area personale')}
  `
  return shell({
    preheader: `Ordine ${opts.orderNumber} confermato. Ecco la tua licenza FreshPhone.`,
    heading: 'Ordine confermato',
    intro: `Grazie per aver scelto FreshPhone. L'ordine <strong>${opts.orderNumber}</strong> &egrave; stato registrato correttamente.`,
    body,
  })
}

export function supportEmailHtml(opts) {
  const quoted = opts.message
    ? `<div style="margin:0 0 18px;padding:12px 16px;background:${C.bg};border:1px solid ${C.line};border-left:3px solid ${C.brand};border-radius:8px;font-family:${FONT};font-size:14px;line-height:1.55;color:${C.ink2};">${opts.message.replace(/\n/g, '<br>')}</div>`
    : ''
  const answer = opts.answerHtml
    ? `<div style="margin:0 0 16px;font-family:${FONT};font-size:15px;line-height:1.6;color:${C.ink};">${opts.answerHtml}</div>`
    : `<p style="margin:0 0 16px;font-family:${FONT};font-size:15px;line-height:1.6;color:${C.ink};">Abbiamo ricevuto la tua richiesta e ti risponderemo al pi&ugrave; presto, di norma entro 24 ore lavorative.</p>`
  const body = `
    ${opts.refId ? `<p style="margin:0 0 14px;font-family:${FONT};font-size:14px;color:${C.ink2};">Riferimento richiesta: <strong style="color:${C.ink};font-family:${MONO};">${opts.refId}</strong></p>` : ''}
    ${answer}
    ${quoted}
    ${button(`${SITE}/account`, 'Apri l&rsquo;area personale')}
  `
  return shell({
    preheader: 'Abbiamo ricevuto la tua richiesta di assistenza.',
    heading: 'Assistenza FreshPhone',
    intro: 'Siamo qui per aiutarti: ecco il riepilogo della tua richiesta.',
    body,
  })
}

export function announcementEmailHtml(opts) {
  const body = `
    <div style="font-family:${FONT};font-size:15px;line-height:1.65;color:${C.ink};">${opts.bodyHtml}</div>
    ${opts.cta ? button(opts.cta.href, opts.cta.label) : ''}
  `
  return shell({
    preheader: opts.preheader ?? opts.title,
    heading: opts.title,
    body,
  })
}

export function newsletterCampaignHtml(opts) {
  const body = `
    <div style="font-family:${FONT};font-size:15px;line-height:1.65;color:${C.ink};">${opts.message.replace(/\n/g, '<br>')}</div>
    ${opts.promoCode ? `<p style="margin:18px 0 4px;font-family:${FONT};font-size:13px;color:${C.ink2};">Il tuo codice sconto</p>${keyBox(opts.promoCode)}` : ''}
    ${button(`${SITE}/pricing`, 'Scopri FreshPhone')}
  `
  return shell({
    preheader: 'Novit&agrave; e offerte da FreshPhone.',
    heading: opts.heading || 'Novità da FreshPhone',
    body,
    showUnsub: true,
    unsubUrl: opts.unsubUrl,
  })
}

export function newsletterConfirmHtml(opts) {
  const body = `
    <p style="margin:0 0 16px;font-family:${FONT};font-size:15px;line-height:1.6;color:${C.ink};">Confermi di volerti iscrivere alle offerte e alle novit&agrave; di FreshPhone? Ti basta un clic.</p>
    ${button(opts.confirmUrl, 'Conferma iscrizione')}
    <p style="margin:12px 0 0;font-family:${FONT};font-size:12px;color:${C.ink2};">Se non sei stato tu, ignora questa email: nessuna iscrizione verr&agrave; attivata.</p>
  `
  return shell({
    preheader: 'Conferma la tua iscrizione a FreshPhone.',
    heading: "Conferma l'iscrizione",
    body,
  })
}
