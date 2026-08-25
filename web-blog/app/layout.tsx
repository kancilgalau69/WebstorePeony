import type { Metadata } from 'next'
import Link from 'next/link'
import './globals.css'
import { getSiteUrl, getStoreUrl } from '@/lib/urls'

const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || 'Rain Store Blog'

export function generateMetadata(): Metadata {
  return {
    title: { default: SITE_NAME, template: `%s • ${SITE_NAME}` },
    description: 'Tips, panduan, dan informasi seputar produk digital',
    metadataBase: new URL(getSiteUrl()),
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const storeUrl = getStoreUrl()

  return (
    <html lang="id">
      <head>
        {/* FontAwesome (consistent with user web store) */}
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"
        />
      </head>
      <body className="bg-gray-50">
        <header className="bg-white border-b border-gray-100 sticky top-0 z-30 shadow-sm">
          <div className="container mx-auto px-4 max-w-5xl flex items-center justify-between h-14 md:h-16">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary-500 to-primary-400 text-white flex items-center justify-center shadow-lg shadow-primary-500/20">
                <i className="fa-solid fa-newspaper text-base"></i>
              </span>
              <div>
                <div className="font-extrabold leading-tight text-gray-900 text-sm md:text-base">{SITE_NAME}</div>
                <div className="text-[10px] text-gray-500 -mt-0.5">Blog & Artikel</div>
              </div>
            </Link>
            <nav className="flex items-center gap-1 sm:gap-2">
              <Link
                href="/"
                className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-primary-600 transition-colors"
              >
                Semua
              </Link>
              {storeUrl && (
                <a
                  href={storeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-1 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 text-white text-sm font-semibold shadow-md hover:shadow-lg transition-all"
                >
                  <i className="fa-solid fa-bag-shopping text-xs"></i>
                  Toko
                </a>
              )}
            </nav>
          </div>
        </header>

        <main className="min-h-[calc(100vh-128px)]">{children}</main>

        <footer className="bg-white border-t border-gray-100 py-6 mt-8">
          <div className="container mx-auto px-4 max-w-5xl flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-gray-500">
            <p>
              &copy; {new Date().getFullYear()} <span className="font-semibold text-gray-700">{SITE_NAME}</span>. All rights reserved.
            </p>
            {storeUrl && (
              <a
                href={storeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-600 hover:underline font-medium"
              >
                <i className="fa-solid fa-arrow-up-right-from-square text-xs mr-1"></i>
                Kunjungi Toko
              </a>
            )}
          </div>
        </footer>
      </body>
    </html>
  )
}
