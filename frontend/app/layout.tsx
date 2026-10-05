import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { DM_Sans, Instrument_Serif } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/layout/ThemeProvider'

const sans = DM_Sans({ subsets: ['latin'], variable: '--font-sans' })
const display = Instrument_Serif({ subsets: ['latin'], weight: '400', variable: '--font-display' })

export const metadata: Metadata = {
  title: 'StaleCheck | Live evidence for dated documents',
  description: 'Find outdated claims, see what changed, and keep a private evidence memory grounded in live search.',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#f5f4ed',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <body className={`${sans.variable} ${display.variable} antialiased`}>
        <ThemeProvider>{children}</ThemeProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
