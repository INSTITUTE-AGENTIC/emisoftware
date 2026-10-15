import { notFound } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase-server'
import DeviceControls from './device-controls'
import PaymentLinkButton from './payment-link-button'

export default async function DeviceDetailPage({ params }: { params: { id: string } }) {
  const session = supabaseServer()

  const [{ data: device }, { data: schedule }, { data: commands }] = await Promise.all([
    session.from('devices').select('*, shopkeepers(shop_name)').eq('id', params.id).single(),
    session.from('emi_schedule').select('*').eq('device_id', params.id).order('installment_no'),
    session
      .from('device_commands')
      .select('*')
      .eq('device_id', params.id)
      .order('issued_at', { ascending: false })
      .limit(10),
  ])

  if (!device) notFound()

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{device.customer_name}</h1>
          <p className="text-sm text-slate-500">
            {device.model} · IMEI {device.imei} · Sold by {device.shopkeepers?.shop_name ?? '—'}
          </p>
        </div>
        <DeviceControls deviceId={device.id} status={device.status} />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Status" value={device.status} />
        <Stat label="EMI" value={`₹${device.emi_amount} × ${device.emi_count}`} />
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">Last location</p>
          {device.last_lat ? (
            <a
              href={`https://www.google.com/maps?q=${device.last_lat},${device.last_lng}`}
              target="_blank"
              rel="noreferrer"
              className="mt-1 block font-medium text-blue-700 hover:underline"
            >
              {device.last_lat.toFixed(4)}, {device.last_lng.toFixed(4)}
            </a>
          ) : (
            <p className="mt-1 font-medium">No ping yet</p>
          )}
        </div>
        <Stat
          label="Last seen"
          value={device.last_location_at ? new Date(device.last_location_at).toLocaleString() : 'never'}
        />
      </div>

      <div>
        <h2 className="mb-2 text-lg font-semibold">EMI schedule</h2>
        <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-2">#</th>
                <th className="px-4 py-2">Due</th>
                <th className="px-4 py-2">Amount</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Paid</th>
                <th className="px-4 py-2">Collect</th>
              </tr>
            </thead>
            <tbody>
              {(schedule ?? []).map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="px-4 py-2">{s.installment_no}</td>
                  <td className="px-4 py-2">{s.due_date}</td>
                  <td className="px-4 py-2">₹{s.amount}</td>
                  <td className="px-4 py-2 capitalize">{s.status}</td>
                  <td className="px-4 py-2">{s.paid_at ? new Date(s.paid_at).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-2">
                    {s.status !== 'paid' && (
                      <PaymentLinkButton
                        deviceId={device.id}
                        installmentNo={s.installment_no}
                        customerPhone={device.customer_phone}
                        existingUrl={s.razorpay_payment_link_url}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-lg font-semibold">Recent commands</h2>
        <ul className="space-y-1 text-sm text-slate-600">
          {(commands ?? []).map((c) => (
            <li key={c.id}>
              {new Date(c.issued_at).toLocaleString()} — <span className="font-medium">{c.command}</span> (
              {c.reason}) {c.delivered ? '✓ delivered' : '… pending'}
            </li>
          ))}
          {(commands ?? []).length === 0 && <li className="text-slate-400">No commands issued yet.</li>}
        </ul>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 font-medium capitalize">{value}</p>
    </div>
  )
}
