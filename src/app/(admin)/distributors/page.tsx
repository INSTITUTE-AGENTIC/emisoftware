import Link from 'next/link'
import { supabaseServer } from '@/lib/supabase-server'

export default async function DistributorsPage() {
  const session = supabaseServer()
  const { data: distributors } = await session.from('distributors').select('*').order('created_at', { ascending: false })

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Distributors</h1>
        <Link href="/distributors/new" className="rounded bg-slate-900 px-4 py-2 text-sm text-white">
          + New distributor
        </Link>
      </div>
      <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">City</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Email</th>
            </tr>
          </thead>
          <tbody>
            {(distributors ?? []).map((d) => (
              <tr key={d.id} className="border-t">
                <td className="px-4 py-3 font-medium">{d.name}</td>
                <td className="px-4 py-3">{d.city ?? '—'}</td>
                <td className="px-4 py-3">{d.phone ?? '—'}</td>
                <td className="px-4 py-3">{d.email ?? '—'}</td>
              </tr>
            ))}
            {(distributors ?? []).length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-slate-400" colSpan={4}>
                  No distributors yet. Add one via POST /api/distributors.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
