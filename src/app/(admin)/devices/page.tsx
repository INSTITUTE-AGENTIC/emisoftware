import Link from 'next/link'
import { supabaseServer } from '@/lib/supabase-server'

const statusColor: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  locked: 'bg-red-100 text-red-800',
  paid_off: 'bg-slate-100 text-slate-600',
}

export default async function DevicesPage() {
  const session = supabaseServer()
  const { data: devices } = await session
    .from('devices')
    .select('id, imei, model, customer_name, status, emi_amount, emi_count, last_location_at')
    .order('created_at', { ascending: false })

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Devices</h1>
      <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Model / IMEI</th>
              <th className="px-4 py-3">EMI</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Last seen</th>
            </tr>
          </thead>
          <tbody>
            {(devices ?? []).map((d) => (
              <tr key={d.id} className="border-t">
                <td className="px-4 py-3">
                  <Link className="font-medium text-slate-900 hover:underline" href={`/devices/${d.id}`}>
                    {d.customer_name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {d.model ?? '—'} · {d.imei}
                </td>
                <td className="px-4 py-3">
                  ₹{d.emi_amount} × {d.emi_count}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusColor[d.status] ?? ''}`}>
                    {d.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {d.last_location_at ? new Date(d.last_location_at).toLocaleString() : 'never'}
                </td>
              </tr>
            ))}
            {(devices ?? []).length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-slate-400" colSpan={5}>
                  No devices yet. Register one via POST /api/devices after the customer signs the
                  financing + consent form.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
