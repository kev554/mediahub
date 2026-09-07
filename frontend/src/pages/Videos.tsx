import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import { MediaGrid } from '../components/media/MediaGrid'
import { getMedia } from '../services/media'

import type { Media } from '../types/media'

type VideosProps = {
  onUpload?: () => void
  refreshKey?: number
  onMediaClick?: (
    media: Media,
    mediaList: Media[],
  ) => void
}

type Filter =
  | 'all'
  | 'favorites'
  | 'recent'

export function Videos({
  onUpload,
  refreshKey = 0,
  onMediaClick,
}: VideosProps) {
  const [media, setMedia] =
    useState<Media[]>([])

  const [filter, setFilter] =
    useState<Filter>('all')

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadMedia() {
      try {
        setLoading(true)
        setError(null)

        const result =
          await getMedia()

        if (!cancelled) {
          setMedia(result)
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Impossible de charger les vidéos.',
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadMedia()

    return () => {
      cancelled = true
    }
  }, [refreshKey])

  const filteredMedia = useMemo(() => {
    // La page Vidéos affiche uniquement les vidéos.
    let result = media.filter(
      (item) => item.media_type === 'video',
    )

    if (filter === 'favorites') {
      result = result.filter(
        (item) => item.is_favorite,
      )
    }

    if (filter === 'recent') {
      result = [...result].sort(
        (a, b) =>
          new Date(
            b.uploaded_at,
          ).getTime() -
          new Date(
            a.uploaded_at,
          ).getTime(),
      )
    }

    return result
  }, [media, filter])

  const videoCount = media.filter(
    (item) => item.media_type === 'video',
  ).length

  return (
    <div className="photos-page fade-in">

      <section className="photos-header">
        <div>
          <span className="dashboard-eyebrow">
            BIBLIOTHÈQUE
          </span>

          <h1>Vidéos</h1>

          <p className="text-secondary">
            Toutes tes vidéos dans un seul espace.
          </p>
        </div>

        {onUpload && (
          <button
            type="button"
            className="accent-button"
            onClick={onUpload}
          >
            <span>＋</span>
            <span>Importer</span>
          </button>
        )}
      </section>

      <section className="photos-toolbar glass">
        <div className="photos-filters">

          <button
            type="button"
            className={
              filter === 'all'
                ? 'photos-filter active'
                : 'photos-filter'
            }
            onClick={() =>
              setFilter('all')
            }
          >
            Toutes
          </button>

          <button
            type="button"
            className={
              filter === 'recent'
                ? 'photos-filter active'
                : 'photos-filter'
            }
            onClick={() =>
              setFilter('recent')
            }
          >
            Récentes
          </button>

          <button
            type="button"
            className={
              filter === 'favorites'
                ? 'photos-filter active'
                : 'photos-filter'
            }
            onClick={() =>
              setFilter('favorites')
            }
          >
            ♡ Favoris
          </button>

        </div>

        <div className="photos-count">
          <span>{videoCount}</span>
          <span>
            {videoCount === 1
              ? 'vidéo'
              : 'vidéos'}
          </span>
        </div>
      </section>

      {loading && (
        <div className="media-grid-empty glass">
          <div className="media-grid-empty-icon">
            ◌
          </div>

          <h3>Chargement des vidéos...</h3>

          <p className="text-secondary">
            Récupération de ta bibliothèque.
          </p>
        </div>
      )}

      {!loading && error && (
        <div className="media-grid-empty glass">
          <div className="media-grid-empty-icon">
            !
          </div>

          <h3>Impossible de charger les vidéos</h3>

          <p className="text-secondary">
            {error}
          </p>
        </div>
      )}

      {!loading && !error && (
        <MediaGrid
          media={filteredMedia}
          onMediaClick={onMediaClick}
        />
      )}

    </div>
  )
}
