import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Peony Store - Dashboard',
    short_name: 'Peony Dashboard',
    description: 'Dashboard untuk mengelola Peony Store Bot dan WEB',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#0f1229',
    theme_color: '#5c63f2',
    icons: [
      {
        src: '/icons/favicon.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/icons/icon-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable'
      }
    ]
  }
}
