import {
  useEffect,
  useState,
} from 'react'

import { getMediaUrl } from '../services/mediaUrl'
import {
  getOfflineUserId,
  loadOfflineAsset,
  saveOfflineAsset,
} from '../services/offlineCache'

export function useAuthenticatedMedia(
  url: string | null | undefined,
  stream = false,
) {
  const [blobUrl, setBlobUrl] =
    useState<string | null>(null)

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const objectUrls: string[] = []

    async function load() {
      if (!url) {
        setBlobUrl(null)
        setLoading(false)
        return
      }

      let hasCachedBlob = false

      try {
        setLoading(true)
        setError(null)
        const userId = getOfflineUserId()
        const cachedBlob = await loadOfflineAsset(userId, url)
        if (cancelled) return

        if (cachedBlob) {
          hasCachedBlob = true
          const cachedUrl = URL.createObjectURL(cachedBlob)
          objectUrls.push(cachedUrl)
          setBlobUrl(cachedUrl)
          if (!navigator.onLine) {
            setLoading(false)
            return
          }
          if (!stream) {
            setLoading(false)
            return
          }
        } else if (!navigator.onLine) {
          throw new Error('Ce média n’est pas encore disponible hors ligne.')
        }

        const token =
          localStorage.getItem(
            'access_token',
          )

        if (!token) {
          throw new Error(
            'Session non authentifiée.',
          )
        }

        const mediaUrl =
          getMediaUrl(url)

        if (!mediaUrl) {
          throw new Error(
            'URL du média invalide.',
          )
        }

        const requestUrl = stream
          ? mediaUrl.replace(/\/file$/, '/stream-url')
          : mediaUrl
        const response = await fetch(
          requestUrl,
          {
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          },
        )

        if (!response.ok) {
          throw new Error(
            `Impossible de charger le média (${response.status}).`,
          )
        }

        if (stream) {
          const result = await response.json() as { url?: string }
          if (!result.url) {
            throw new Error('URL de lecture invalide.')
          }
          if (!cancelled) {
            setBlobUrl(result.url)
          }
          if (!cachedBlob && userId) {
            void cacheVideoForOffline(mediaUrl, url, token, userId)
          }
          return
        }

        const blob =
          await response.blob()

        await saveOfflineAsset(userId, url, blob)
        const objectUrl = URL.createObjectURL(blob)
        objectUrls.push(objectUrl)

        if (!cancelled) {
          setBlobUrl(objectUrl)
        }
      } catch (err) {
        if (!cancelled) {
          if (!hasCachedBlob) {
            setError(
              err instanceof Error
                ? err.message
                : 'Impossible de charger le média.',
            )
          }
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true

      objectUrls.forEach((objectUrl) => URL.revokeObjectURL(objectUrl))
    }
  }, [stream, url])

  return {
    url: blobUrl,
    loading,
    error,
  }
}

async function cacheVideoForOffline(
  mediaUrl: string,
  cacheKey: string,
  token: string,
  userId: number,
) {
  const mediaId = mediaUrl.match(/\/media\/(\d+)\/file(?:$|\?)/)?.[1]
  if (!mediaId) return

  try {
    const response = await fetch(
      mediaUrl,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    if (!response.ok || !response.body) return

    const declaredSize = Number(response.headers.get('content-length'))
    if (declaredSize > 100 * 1024 * 1024) {
      await response.body.cancel()
      return
    }

    const reader = response.body.getReader()
    const chunks: BlobPart[] = []
    let totalBytes = 0

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      totalBytes += value.byteLength
      if (totalBytes > 100 * 1024 * 1024) {
        await reader.cancel()
        return
      }
      chunks.push(value)
    }

    await saveOfflineAsset(
      userId,
      cacheKey,
      new Blob(chunks, {
        type: response.headers.get('content-type') ?? 'video/mp4',
      }),
    )
  } catch (error) {
    console.warn('Unable to cache the video for offline playback.', error)
  }
}
