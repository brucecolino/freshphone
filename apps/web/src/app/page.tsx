import Link from 'next/link'
import { AppPreview } from '@/components/app-preview'
import { PricingCards, FreeBanner } from '@/components/pricing-cards'

const features = [
  { title: 'Anteprime istantanee', text: 'Miniature reali per HEIC, Live Photo e video. Niente più nomi file anonimi.' },
  { title: 'Metadati intatti', text: 'Data di scatto, GPS ed EXIF restano identici. Copia grezza, mai ricompressa.' },
  { title: 'Drag & drop', text: 'Trascina dal telefono al PC e viceversa, come una cartella qualsiasi.' },
  { title: 'Ordina e filtra', text: 'Per data, dimensione, tipo — crescente o decrescente — in un clic.' },
  { title: 'Non solo foto', text: 'Sfoglia anche documenti e file del dispositivo e gestiscili allo stesso modo.' },
  { title: 'Libera spazio in sicurezza', text: 'Copia, verifica l’integrità, poi elimina dall’iPhone. Gigabyte recuperati.' },
]

const steps = [
  { n: '01', title: 'Collega l’iPhone', text: 'Driver e permessi configurati in automatico. Funziona con tutti gli iPhone.' },
  { n: '02', title: 'Scegli cosa spostare', text: 'Filtra e seleziona foto, video o file. Anche centinaia in un colpo solo.' },
  { n: '03', title: 'Sposta e fai spazio', text: 'Esporta sul PC con i metadati, poi cancella in sicurezza dal telefono.' },
]

const itunesCons = [
  'Sincronizzazione macchinosa e lenta',
  'Anteprime assenti o pessime',
  'Rischio di perdere metadati e date',
  'Niente filtri o ordinamento reali',
  'Cancellazione manuale e confusa',
]
const fpPros = [
  'Sposti i file in pochi clic',
  'Anteprime reali di foto e video',
  'Metadati ed EXIF sempre preservati',
  'Ordina e filtra come vuoi',
  'Liberi spazio in sicurezza, guidato',
]

const faqs = [
  { q: 'Funziona con tutti gli iPhone?', a: 'Sì. FreshPhone supporta tutti gli iPhone su Windows 10 e 11, senza jailbreak. I driver necessari vengono installati in automatico al primo avvio.' },
  { q: 'I metadati delle foto vengono mantenuti?', a: 'Sempre. I file vengono copiati grezzi, senza ricompressione: data di scatto, posizione GPS ed EXIF restano identici. Le Live Photo restano appaiate (HEIC + MOV).' },
  { q: 'I miei dati sono al sicuro?', a: 'FreshPhone lavora in locale tra il tuo iPhone e il tuo PC. Nessun file viene caricato su server esterni. Prima di cancellare qualcosa dal telefono, l’app verifica che la copia sul PC sia integra.' },
  { q: 'Posso provarlo gratis?', a: 'Sì. La versione gratuita permette di sfogliare, ordinare e visualizzare tutto, ed esportare fino a 50 file. Per export illimitati basta una licenza.' },
  { q: 'Come funziona la licenza?', a: 'Dopo l’acquisto ricevi una key nell’area personale. La attivi con un clic direttamente nell’app, oppure la inserisci manualmente. Le licenze a tempo hanno una scadenza, quella a vita no.' },
]

export default function HomePage() {
  return (
    <>
      {/* ===== HERO ===== */}
      <section className="relative overflow-hidden">
        <div className="bg-grad-soft pointer-events-none absolute inset-0 -z-10" />
        <div className="container-x grid items-center gap-12 py-16 md:py-24 lg:grid-cols-2">
          <div className="animate-fade-up">
            <span className="inline-flex items-center rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-ink2">
              Gestore file iPhone per Windows
            </span>
            <h1 className="mt-5 text-4xl font-bold sm:text-5xl lg:text-6xl">
              Libera spazio sul tuo iPhone. <span className="text-grad">Senza iTunes.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-ink2">
              FreshPhone trova, organizza e sposta foto, video e file dal tuo iPhone al PC in pochi clic —
              conservando ogni metadato. Poi cancella in sicurezza e recupera gigabyte.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/download"
                className="bg-grad inline-flex items-center rounded-full px-6 py-3 text-sm font-semibold text-white transition-[filter] hover:brightness-110"
              >
                Scarica gratis
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center rounded-full border border-line bg-surface px-6 py-3 text-sm font-semibold text-ink transition-colors hover:bg-bg"
              >
                Vedi i prezzi
              </Link>
            </div>
            <p className="mt-5 text-xs text-ink2">Compatibile con tutti gli iPhone · Windows 10/11 · Nessun jailbreak</p>
          </div>
          <div className="animate-fade-up [animation-delay:120ms]">
            <AppPreview />
          </div>
        </div>
      </section>

      {/* ===== FEATURES ===== */}
      <section id="funzioni" className="container-x py-16 md:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-semibold text-brand">Tutto quello che serve</span>
          <h2 className="mt-2 text-3xl font-bold sm:text-4xl">Un’app semplice, ma completa</h2>
          <p className="mt-4 text-ink2">Pensata per fare una cosa benissimo: organizzare il tuo iPhone e liberare spazio.</p>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
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
            <span className="text-sm font-semibold text-brand">In tre passi</span>
            <h2 className="mt-2 text-3xl font-bold sm:text-4xl">Dal caos al pulito in due minuti</h2>
          </div>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {steps.map((s) => (
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
          <h2 className="text-3xl font-bold sm:text-4xl">FreshPhone vs. iTunes</h2>
          <p className="mt-4 text-ink2">La differenza tra combattere col telefono e gestirlo davvero.</p>
        </div>
        <div className="mx-auto mt-12 grid max-w-4xl gap-5 md:grid-cols-2">
          <div className="rounded-xl2 border border-line bg-surface p-6">
            <h3 className="font-display text-lg font-semibold text-ink2">iTunes / Esplora risorse</h3>
            <ul className="mt-4 divide-y divide-line border-t border-line text-sm">
              {itunesCons.map((c) => (
                <li key={c} className="py-3 text-ink2">
                  {c}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl2 border-2 border-brand bg-surface p-6">
            <h3 className="text-grad font-display text-lg font-bold">FreshPhone</h3>
            <ul className="mt-4 divide-y divide-line border-t border-line text-sm">
              {fpPros.map((c) => (
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
            <span className="text-sm font-semibold text-brand">Prezzi semplici</span>
            <h2 className="mt-2 text-3xl font-bold sm:text-4xl">Scegli come preferisci</h2>
            <p className="mt-4 text-ink2">Prova gratis, poi passa a un piano a tempo o a vita. Disdici quando vuoi.</p>
          </div>
          <div className="mx-auto mt-12 max-w-5xl">
            <FreeBanner />
            <div className="mt-6">
              <PricingCards />
            </div>
            <p className="mt-6 text-center text-xs text-ink2">Pagamenti sicuri con Stripe e PayPal · IVA inclusa dove applicabile</p>
          </div>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section id="faq" className="container-x py-16 md:py-24">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center text-3xl font-bold sm:text-4xl">Domande frequenti</h2>
          <div className="mt-10 divide-y divide-line border-y border-line">
            {faqs.map((f) => (
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
          <h2 className="text-3xl font-bold sm:text-4xl">Il tuo iPhone, finalmente in ordine</h2>
          <p className="mx-auto mt-3 max-w-xl text-white/90">Scaricalo gratis e libera i primi gigabyte oggi stesso.</p>
          <Link
            href="/download"
            className="mt-7 inline-flex items-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-brand-deep transition-transform hover:scale-[1.03]"
          >
            Scarica FreshPhone
          </Link>
        </div>
      </section>
    </>
  )
}
