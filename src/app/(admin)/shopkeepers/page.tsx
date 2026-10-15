import Link from 'next/link'
import { supabaseServer } from '@/lib/supabase-server'

export default async function ShopkeepersPage() {
  const session = supabaseServer()
  const { data: shopkeepers } = await session
    .from('shopkeepers')
    .select('*, distributors(name)')
    .order('created_at', { ascending: false })

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Shopkeepers</h1>
        <Link href="/shopkeepers/new" className="rounded bg-slate-900 px-4 py-2 text-sm text-white">
          + New shopkeeper
        </Link>
      </div>
      <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3">Shop</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Distributor</th>
              <th className="px-4 py-3">Phone</th>
            </tr>
          </thead>
          <tbody>
            {(shopkeepers ?? []).map((s: any) => (
              <tr key={s.id} className="border-t">
                <td className="px-4 py-3 font-medium">{s.shop_name}</td>
                <td className="px-4 py-3">{s.owner_name ?? '—'}</td>
                <td className="px-4 py-3">{s.distributors?.name ?? '—'}</td>
                <td className="px-4 py-3">{s.phone ?? '—'}</td>
              </tr>
            ))}
            {(shopkeepers ?? []).length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-slate-400" colSpan={4}>
                  No shopkeepers yet. Add one via POST /api/shopkeepers.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
