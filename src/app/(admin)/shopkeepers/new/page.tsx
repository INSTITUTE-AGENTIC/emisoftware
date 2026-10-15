'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type Distributor = { id: string; name: string }

export default function NewShopkeeperPage() {
  const router = useRouter()
  const [distributors, setDistributors] = useState<Distributor[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/distributors')
      .then((r) => r.json())
      .then((d) => setDistributors(d.distributors ?? []))
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const form = new FormData(e.currentTarget)
    const res = await fetch('/api/shopkeepers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        distributor_id: form.get('distributor_id'),
        shop_name: form.get('shop_name'),
        owner_name: form.get('owner_name'),
        phone: form.get('phone'),
        city: form.get('city'),
      }),
    })

    setLoading(false)
    if (!res.ok) {
      const { error } = await res.json()
      setError(error ?? 'Failed to create shopkeeper')
      return
    }
    router.push('/shopkeepers')
    router.refresh()
  }

  return (
    <div className="max-w-md">
      <h1 className="mb-6 text-2xl font-semibold">Add shopkeeper</h1>
      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border bg-white p-6 shadow-sm">
        {error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}

        <div>
          <label className="block text-sm font-medium">Distributor</label>
          <select name="distributor_id" required className="mt-1 w-full rounded border px-3 py-2">
            <option value="">Select a distributor…</option>
            {distributors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          {distributors.length === 0 && (
            <p className="mt-1 text-xs text-slate-400">No distributors yet — add one first.</p>
          )}
        </div>

        <Field label="Shop name" name="shop_name" required />
        <Field label="Owner name" name="owner_name" />
        <Field label="Phone" name="phone" />
        <Field label="City" name="city" />

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
        >
          {loading ? 'Saving…' : 'Save shopkeeper'}
        </button>
      </form>
    </div>
  )
}

function Field({
  label,
  name,
  required = false,
}: {
  label: string
  name: string
  required?: boolean
}) {
  return (
    <div>
      <label className="block text-sm font-medium">{label}</label>
      <input name={name} required={required} className="mt-1 w-full rounded border px-3 py-2" />
    </div>
  )
}
