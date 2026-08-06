import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'תאר אותי',
    short_name: 'תאר אותי',
    description: 'משחק תיאור במילה אחת וניחושים בזמן אמת',
    start_url: '/',
    scope: '/',
    display: 'fullscreen',
    orientation: 'portrait',
    background_color: '#14121F',
    theme_color: '#14121F',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
