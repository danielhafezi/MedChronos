import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Image from 'next/image'
import Link from 'next/link'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'MedChronos',
  description: 'Medical imaging timeline and AI-powered insights',
  icons: {
    icon: '/images/logo.png', // Path to your logo in the public directory
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-50 min-h-screen flex flex-col`}>
        <header className="bg-white shadow-md py-4 px-6">
          <div className="container mx-auto flex items-center">
            <Link href="/" className="flex items-center space-x-2">
              <Image
                src="/images/logo.png"
                alt="MedChronos Logo"
                width={40}
                height={40}
                priority
              />
              <span className="text-2xl font-semibold text-medical-primary">MedChronos</span>
            </Link>
          </div>
        </header>
        <main className="flex-grow container mx-auto p-6">
          {children}
        </main>
        <footer className="bg-gray-100 text-center py-4 text-sm text-gray-600">
          © {new Date().getFullYear()} MedChronos. All rights reserved.
        </footer>
      </body>
    </html>
  )
}
