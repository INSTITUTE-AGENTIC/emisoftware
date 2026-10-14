import Link from 'next/link'
import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase-server'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = supabaseServer()
  const {
    data: { user },
  } = await session.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r bg-white p-4">
        <p className="mb-6 text-lg font-semibold">EMI Lock Admin</p>
        <nav className="space-y-1 text-sm">
          <Link className="block rounded px-3 py-2 hover:bg-slate-100" href="/dashboard">
            Dashboard
          </Link>
          <Link className="block rounded px-3 py-2 hover:bg-slate-100" href="/distributors">
            Distributors
          </Link>
          <Link className="block rounded px-3 py-2 hover:bg-slate-100" href="/shopkeepers">
            Shopkeepers
          </Link>
          <Link className="block rounded px-3 py-2 hover:bg-slate-100" href="/devices">
            Devices
          </Link>
        </nav>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  )
}
