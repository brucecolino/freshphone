import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Area personale — FreshPhone',
}

export default function AccountPage() {
  return (
    <section className="container-x py-16 md:py-24">
      <div className="mx-auto max-w-md text-center">
        <h1 className="text-3xl font-bold">Area personale</h1>
        <p className="mt-3 text-ink2">Accedi per vedere i tuoi ordini, le licenze e attivare FreshPhone con un clic.</p>

        <div className="mt-8 rounded-xl2 border border-line bg-surface p-6">
          <button
            disabled
            className="w-full rounded-full border border-line px-4 py-3 text-sm font-semibold opacity-60"
          >
            Continua con Google
          </button>
          <p className="mt-4 text-xs text-ink2">Accesso con Google in arrivo. Apple e Facebook seguiranno.</p>
        </div>
      </div>
    </section>
  )
}
