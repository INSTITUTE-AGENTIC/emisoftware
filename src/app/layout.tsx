import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'EMI Lock Admin',
  description: 'Distributor, shopkeeper and device management for EMI-financed phones',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
