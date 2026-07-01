import type { Metadata } from 'next'
import { getDict } from '@/i18n/get-dict'
import { DownloadButtons } from '@/components/download-buttons'

export const metadata: Metadata = {
  title: 'Download — FreshPhone',
  description: 'Scarica FreshPhone per Windows 10 e 11. Gratis, con export fino a 50 file.',
}

export default async function DownloadPage() {
  const { t } = await getDict()
  const d = t.download
  return (
    <section className="container-x py-16 md:py-24">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-4xl font-bold sm:text-5xl">{d.title}</h1>
        <p className="mt-4 text-ink2">{d.sub}</p>
        <div className="mt-8 flex flex-col items-center gap-3">
          <DownloadButtons winLabel={d.button} />
          <span className="text-xs text-ink2">{d.note}</span>
        </div>
      </div>

      <div className="mx-auto mt-14 max-w-xl rounded-xl2 border border-line bg-surface p-6">
        <h2 className="font-display text-lg font-semibold">{d.reqsTitle}</h2>
        <ul className="mt-4 divide-y divide-line border-t border-line text-sm">
          {d.reqs.map((r) => (
            <li key={r} className="py-3 text-ink2">
              {r}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
