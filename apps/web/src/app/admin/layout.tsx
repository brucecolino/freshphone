import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'

export const dynamic = 'force-dynamic'

const nav: { href: string; label: string; ready: boolean }[] = [
  { href: '/admin', label: 'Dashboard', ready: true },
  { href: '/admin/orders', label: 'Ordini', ready: true },
  { href: '/admin/licenses', label: 'Licenze', ready: true },
  { href: '/admin/carts', label: 'Carrelli', ready: true },
  { href: '/admin/promos', label: 'Codici promo', ready: true },
  { href: '/admin/newsletter', label: 'Newsletter', ready: true },
  { href: '/admin/settings', label: 'Impostazioni', ready: true },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect('/account')
  if (session.user.role !== 'ADMIN') redirect('/')

  return (
    <div className="container-x grid gap-8 py-10 md:grid-cols-[200px_1fr]">
      <aside>
        <p className="text-xs font-semibold uppercase tracking-wide text-ink2">Admin</p>
        <nav className="mt-3 flex flex-col gap-0.5 text-sm">
          {nav.map((n) =>
            n.ready ? (
              <Link key={n.href} href={n.href} className="rounded-lg px-3 py-2 text-ink2 transition-colors hover:bg-bg hover:text-ink">
                {n.label}
              </Link>
            ) : (
              <span key={n.href} className="rounded-lg px-3 py-2 text-ink2/50">
                {n.label} <span className="text-xs">(presto)</span>
              </span>
            ),
          )}
        </nav>
      </aside>
      <div>{children}</div>
    </div>
  )
}
