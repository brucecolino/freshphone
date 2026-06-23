import { revalidatePath, revalidateTag } from 'next/cache'
import { getPromoBanner, setPromoBanner } from '@/lib/settings'
import { requireAdmin } from '@/lib/admin'

export const dynamic = 'force-dynamic'

export default async function AdminSettingsPage() {
  const banner = await getPromoBanner()

  async function save(formData: FormData) {
    'use server'
    await requireAdmin()
    await setPromoBanner({
      enabled: formData.get('enabled') === 'on',
      text: String(formData.get('text') ?? '').trim(),
      href: String(formData.get('href') ?? '').trim() || undefined,
    })
    revalidateTag('site-settings')
    revalidatePath('/admin/settings')
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold">Impostazioni sito</h1>

      <form action={save} className="mt-6 space-y-4 rounded-xl2 border border-line bg-surface p-5">
        <h2 className="font-display font-semibold">Banner promozionale</h2>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="enabled" defaultChecked={banner.enabled} />
          Mostra il banner in cima al sito
        </label>
        <div>
          <label className="text-sm text-ink2">Testo</label>
          <input
            name="text"
            defaultValue={banner.text}
            placeholder="Es. -20% sul piano annuale con il codice ESTATE"
            className="mt-1 w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-brand"
          />
        </div>
        <div>
          <label className="text-sm text-ink2">Link (opzionale)</label>
          <input
            name="href"
            defaultValue={banner.href ?? ''}
            placeholder="/pricing"
            className="mt-1 w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-brand"
          />
        </div>
        <button className="bg-grad rounded-full px-5 py-2.5 text-sm font-semibold text-white">Salva</button>
      </form>
    </div>
  )
}
