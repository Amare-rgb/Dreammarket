// app/manifest.ts
import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Dream More Affiliate Market',
    short_name: 'Dream More',
    description: 'Discover trusted products and great deals with Dream More Affiliate Market.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f7f8fa',
    theme_color: '#F47822',
    icons: [
      {
        src: '/banners/photo.jpg',
        sizes: '192x192',
        type: 'image/jpeg',
      },
      {
        src: '/banners/photo.jpg',
        sizes: '512x512',
        type: 'image/jpeg',
      },
    ],
  }
}