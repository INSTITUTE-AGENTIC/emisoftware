'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase-browser'

type Shopkeeper = { id: string; shop_name: string }

export default function NewDevicePage() {
  const router = useRouter()
  const [shopkeepers, setShopkeepers] = useState<Shopkeeper[]>([])
  const [consentFile, setConsentFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/shopkeepers')
      .then((r) => r.json())
      .then((d) => setShopkeepers(d.shopkeepers ?? []))
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (!consentFile) {
      setError('The signed consent document is required before a device can be financed.')
      return
    }

    setLoading(true)
    const supabase = supabaseBrowser()

    // 1. Upload the signed consent form to private storage first — the
    //    device row is refused server-side without this URL (see
    //    POST /api/devices), so there's no path to a device with
    //    undisclosed lock/tracking terms.
    const path = `${crypto.randomUUID()}-${consentFile.name}`
    const { error: uploadError } = await supabase.storage.from('consent-documents').upload(path, consentFile)

    if (uploadError) {
      setLoading(false)
      setError(`Consent upload failed: ${uploadError.message}`)
      return
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from('consent-documents').getPublicUrl(path)
    // Bucket is private — this "public" URL only resolves for a caller with
    // a valid session; it's stored as a reference, not a public link.

    const form = new FormData(e.currentTarget)
    const res = await fetch('/api/devices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shopkeeper_id: form.get('shopkeeper_id'),
        imei: form.get('imei'),
        model: form.get('model'),
        customer_name: form.get('customer_name'),
        customer_phone: form.get('customer_phone'),
        purchase_price: Number(form.get('purchase_price')),
        down_payment: Number(form.get('down_payment') || 0),
        emi_count: Number(form.get('emi_count')),
        start_date: form.get('start_date') || undefined,
        consent_document_url: publicUrl,
      }),
    })

    setLoading(false)
    if (!res.ok) {
      const { error } = await res.json()
      setError(error ?? 'Failed to register device')
      return
    }

    const { device } = await res.json()
    router.push(`/devices/${device.id}`)
    router.refresh()
  }

  return (
    <div className="max-w-lg">
      <h1 className="mb-6 text-2xl font-semibold">Finance a new device</h1>
      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border bg-white p-6 shadow-sm">
        {error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}

        <div>
          <label className="block text-sm font-medium">Shopkeeper</label>
          <select name="shopkeeper_id" required className="mt-1 w-full rounded border px-3 py-2">
            <option value="">Select a shopkeeper…</option>
            {shopkeepers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.shop_name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="IMEI" name="imei" required />
          <Field label="Model" name="model" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Customer name" name="customer_name" required />
          <Field label="Customer phone" name="customer_phone" required />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Price (₹)" name="purchase_price" type="number" required />
          <Field label="Down payment (₹)" name="down_payment" type="number" />
          <Field label="EMI count" name="emi_count" type="number" required />
        </div>

        <Field label="Start date" name="start_date" type="date" />

        <div>
          <label className="block text-sm font-medium">Signed consent document (PDF/image)</label>
          <input
            type="file"
            accept="application/pdf,image/*"
            required
            onChange={(e) => setConsentFile(e.target.files?.[0] ?? null)}
            className="mt-1 w-full rounded border px-3 py-2"
          />
          <p className="mt-1 text-xs text-slate-400">
            Must be the financing agreement the customer signed, disclosing device-lock and location
            tracking. Required — the device record can&apos;t be created without it.
          </p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
        >
          {loading ? 'Saving…' : 'Register device'}
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
