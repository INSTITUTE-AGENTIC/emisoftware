'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function NewDistributorPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const form = new FormData(e.currentTarget)
    const res = await fetch('/api/distributors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.get('name'),
        phone: form.get('phone'),
        email: form.get('email'),
        city: form.get('city'),
      }),
    })

    setLoading(false)
    if (!res.ok) {
      const { error } = await res.json()
      setError(error ?? 'Failed to create distributor')
      return
    }
    router.push('/distributors')
    router.refresh()
  }

  return (
    <div className="max-w-md">
      <h1 className="mb-6 text-2xl font-semibold">Add distributor</h1>
      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border bg-white p-6 shadow-sm">
        {error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
        <Field label="Name" name="name" required />
        <Field label="Phone" name="phone" />
        <Field label="Email" name="email" type="email" />
        <Field label="City" name="city" />
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
        >
          {loading ? 'Saving…' : 'Save distributor'}
        </button>
      </form>
    </div>
  )
}

function Field({
  label,
  name,
  type = 'text',
  required = false,
}: {
  label: string
  name: string
  type?: string
  required?: boolean
}) {
  return (
    <div>
      <label className="block text-sm font-medium">{label}</label>
      <input name={name} type={type} required={required} className="mt-1 w-full rounded border px-3 py-2" />
    </div>
  )
}
