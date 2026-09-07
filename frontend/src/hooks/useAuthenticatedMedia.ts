import {
  useEffect,
  useState,
} from 'react'

import { getMediaUrl } from '../services/mediaUrl'

export function useAuthenticatedMedia(
  url: string | null | undefined,
) {
  const [blobUrl, setBlobUrl] =
    useState<string | null>(null)

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let objectUrl: string | null = null

    async function load() {
      if (!url) {
        setBlobUrl(null)
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)

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

        const response = await fetch(
          mediaUrl,
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

        const blob =
          await response.blob()

        objectUrl =
          URL.createObjectURL(blob)

        if (!cancelled) {
          setBlobUrl(objectUrl)
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Impossible de charger le média.',
          )
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

      if (objectUrl) {
        URL.revokeObjectURL(
          objectUrl,
        )
      }
    }
  }, [url])

  return {
    url: blobUrl,
    loading,
    error,
  }
}
