import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import { MediaGrid } from '../components/media/MediaGrid'
import {
  addToFavorites,
  getMedia,
  removeFromFavorites,
} from '../services/media'

import type { Media } from '../types/media'
import { t } from '../lib/i18n'
import {
  celebrateFavoriteAdded,
  prepareFavoriteSound,
} from '../lib/favoriteCelebration'
import type { MediaSearchFilters } from '../types/mediaSearch'

type VideosProps = {
  refreshKey?: number
  searchQuery?: string
  searchFilters: MediaSearchFilters
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
  refreshKey = 0,
  searchQuery = '',
  searchFilters,
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
    const timer = window.setTimeout(() => {
      void loadMedia()
    }, searchQuery.trim() ? 250 : 0)

    async function loadMedia() {
      try {
        setLoading(true)
        setError(null)

        const result =
          await getMedia(false, {
            media_type: searchFilters.media_type ?? 'video',
            search: searchQuery.trim() || undefined,
            ...searchFilters,
          })

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

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [refreshKey, searchQuery, searchFilters])

  const filteredMedia = useMemo(() => {
    // La page Vidéos affiche uniquement les vidéos.
    let result = media.filter(
      (item) => item.media_type === (searchFilters.media_type ?? 'video'),
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
  }, [media, filter, searchFilters.media_type])

  const videoCount = media.filter(
    (item) => item.media_type === 'video',
  ).length

  async function handleFavorite(item: Media) {
    const playFavoriteSound = item.is_favorite
      ? undefined
      : prepareFavoriteSound()
    try {
      const updated = item.is_favorite
        ? await removeFromFavorites(item.id)
        : await addToFavorites(item.id)
      if (!item.is_favorite) {
        celebrateFavoriteAdded()
        playFavoriteSound?.()
      }
      setMedia((current) =>
        current.map((mediaItem) =>
          mediaItem.id === updated.id ? updated : mediaItem,
        ),
      )
    } catch (err) {
      console.error('Unable to update media favorite state.', err)
      window.alert('Unable to update favorite.')
    }
  }

  return (
    <div className="photos-page fade-in">

      <section className="photos-header">
        <div>
          <span className="dashboard-eyebrow">
            {t('BIBLIOTHÈQUE', 'LIBRARY')}
          </span>

          <h1>Vidéos</h1>

          <p className="text-secondary">
            {t('Toutes tes vidéos au même endroit.', 'Your videos, all in one place.')}
          </p>
        </div>

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
            {t('Toutes', 'All')}
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
            {t('Récentes', 'Recent')}
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
            ♡ {t('Favoris', 'Favorites')}
          </button>

        </div>

        <div className="photos-count">
          <span>{videoCount}</span>
          <span>
            {videoCount === 1
              ? t('vidéo', 'video')
              : t('vidéos', 'videos')}
          </span>
        </div>
      </section>

      {loading && (
        <div className="media-grid-empty glass">
          <div className="media-grid-empty-icon">
            ◌
          </div>

          <h3>{t('Chargement des vidéos…', 'Loading videos…')}</h3>

          <p className="text-secondary">
            {t('Chargement de ta galerie.', 'Loading your library.')}
          </p>
        </div>
      )}

      {!loading && error && (
        <div className="media-grid-empty glass">
          <div className="media-grid-empty-icon">
            !
          </div>

          <h3>{t('Impossible de charger les vidéos', 'Unable to load videos')}</h3>

          <p className="text-secondary">
            {error}
          </p>
        </div>
      )}

      {!loading && !error && (
        <MediaGrid
          media={filteredMedia}
          onMediaClick={onMediaClick}
          onFavorite={handleFavorite}
        />
      )}

    </div>
  )
}
