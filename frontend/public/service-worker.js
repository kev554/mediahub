const CACHE_NAME = 'mediahub-shell-v1'
const RUNTIME_CACHE = 'mediahub-runtime-v1'

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME)
    const response = await fetch('/')
    if (response.ok) {
      await cache.put('/', response)
      const html = await response.clone().text()
      const assets = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css|svg))"/g)]
        .map((match) => match[1])
        .filter((url) => url.startsWith('/'))
      await Promise.all(assets.map(async (url) => {
        try {
          const assetResponse = await fetch(url)
          if (assetResponse.ok) await cache.put(url, assetResponse)
        } catch (error) {
          console.warn('Unable to precache an app asset.', error)
        }
      }))
    }
    await self.skipWaiting()
  })())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys()
    await Promise.all(
      cacheNames
        .filter((name) => name.startsWith('mediahub-') && ![CACHE_NAME, RUNTIME_CACHE].includes(name))
        .map((name) => caches.delete(name)),
    )
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)

  if (
    request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api/')
  ) {
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request)
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME)
          await cache.put('/', response.clone())
          return response
        }
        return (await caches.match('/')) || response
      } catch {
        return (await caches.match('/')) || Response.error()
      }
    })())
    return
  }

  const isAppAsset =
    request.destination !== '' ||
    url.pathname.startsWith('/src/') ||
    url.pathname.endsWith('.webmanifest')

  if (!isAppAsset) return

  event.respondWith((async () => {
    const cache = await caches.open(RUNTIME_CACHE)
    try {
      const response = await fetch(request)
      if (response.ok) await cache.put(request, response.clone())
      return response
    } catch {
      return (await cache.match(request)) || Response.error()
    }
  })())
})
