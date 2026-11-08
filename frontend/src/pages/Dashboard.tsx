import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  addToFavorites,
  getMedia,
  removeFromFavorites,
} from '../services/media'
import { getAlbums } from '../services/albums'
import { getGroups } from '../services/groups'

import { MediaGrid } from '../components/media/MediaGrid'
import { StatCard } from '../components/dashboard/StatCard'

import type { Media } from '../types/media'
import { t } from '../lib/i18n'
import {
  celebrateFavoriteAdded,
  prepareFavoriteSound,
} from '../lib/favoriteCelebration'
import type { MediaSearchFilters } from '../types/mediaSearch'

type DashboardProps = {
  onNavigate: (page: string) => void
  refreshKey?: number
  searchQuery?: string
  searchFilters: MediaSearchFilters
  onMediaClick?: (media: Media, mediaList: Media[]) => void
}

type GalleryFilter = 'all' | 'photos' | 'videos' | 'favorites'

export function Dashboard({
  onNavigate,
  refreshKey = 0,
  searchQuery = '',
  searchFilters,
  onMediaClick,
}: DashboardProps) {
  const [media, setMedia] = useState<Media[]>([])
  const [galleryFilter, setGalleryFilter] =
    useState<GalleryFilter>('all')
  const [albumCount, setAlbumCount] = useState(0)
  const [groupCount, setGroupCount] = useState(0)

  const [mediaError, setMediaError] = useState<string | null>(null)
  const [mediaLoading, setMediaLoading] = useState(true)
  const [albumLoading, setAlbumLoading] = useState(true)
  const [groupLoading, setGroupLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(() => {
      void loadDashboardData()
    }, searchQuery.trim() ? 250 : 0)

    async function loadDashboardData() {
      setMediaLoading(true)
      try {
        setMediaError(null)
        const result = await getMedia(false, {
          search: searchQuery.trim() || undefined,
          ...searchFilters,
        })

        if (!cancelled) {
          setMedia(result)
        }
      } catch (error) {
        if (!cancelled) {
          setMediaError(
            error instanceof Error
              ? error.message
              : 'Impossible de charger la galerie.',
          )
        }
        console.error(
          'Erreur chargement médias :',
          error,
        )
      } finally {
        if (!cancelled) {
          setMediaLoading(false)
        }
      }
    }

    async function loadAlbums() {
      try {
        const result = await getAlbums()

        if (!cancelled) {
          setAlbumCount(result.length)
        }
      } catch (error) {
        console.error(
          'Erreur chargement albums :',
          error,
        )
      } finally {
        if (!cancelled) {
          setAlbumLoading(false)
        }
      }
    }

    async function loadGroups() {
      try {
        const result = await getGroups()

        if (!cancelled) {
          setGroupCount(result.length)
        }
      } catch (error) {
        console.error(
          'Erreur chargement groupes :',
          error,
        )
      } finally {
        if (!cancelled) {
          setGroupLoading(false)
        }
      }
    }

    void loadAlbums()
    void loadGroups()

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [refreshKey, searchQuery, searchFilters])

  const photoCount = media.filter(
    (item) => item.media_type === 'image',
  ).length

  const videoCount = media.filter(
    (item) => item.media_type === 'video',
  ).length
  const sortedMedia = useMemo(() => {
    const result = [...media].sort(
      (a, b) =>
        new Date(b.uploaded_at).getTime() -
        new Date(a.uploaded_at).getTime(),
    )

    if (galleryFilter === 'photos') {
      return result.filter((item) => item.media_type === 'image')
    }

    if (galleryFilter === 'videos') {
      return result.filter((item) => item.media_type === 'video')
    }

    if (galleryFilter === 'favorites') {
      return result.filter((item) => item.is_favorite)
    }

    return result
  }, [galleryFilter, media])

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
    } catch (error) {
      console.error('Unable to update media favorite state.', error)
      window.alert('Unable to update favorite.')
    }
  }

  return (
    <div className="dashboard-page">
      <header className="gallery-page-header">
        <div>
          <span className="dashboard-eyebrow">{t('MA GALERIE', 'MY LIBRARY')}</span>
          <h1>{t('Mes souvenirs', 'My memories')}</h1>
          <p className="text-secondary">
            {t('Photos et vidéos, rassemblées au même endroit.', 'Photos and videos, all in one place.')}
          </p>
        </div>
      </header>

      <section className="home-gallery">
        <div className="home-gallery-heading">
          <div>
            <span className="dashboard-eyebrow">{t('BIBLIOTHÈQUE', 'LIBRARY')}</span>
            <h2>{t('Galerie', 'Gallery')}</h2>
          </div>
          {!mediaLoading && !mediaError && (
            <span className="gallery-result-count">
              {sortedMedia.length} {t('média', 'item')}{sortedMedia.length === 1 ? '' : 's'}
            </span>
          )}
        </div>

        <div className="gallery-filters" role="group" aria-label={t('Filtrer la galerie', 'Filter gallery')}>
          {([
            ['all', t('Tout', 'All')],
            ['photos', t('Photos', 'Photos')],
            ['videos', t('Vidéos', 'Videos')],
            ['favorites', t('Favoris', 'Favorites')],
          ] as const).map(([filter, label]) => (
            <button
              key={filter}
              type="button"
              className={`gallery-filter${galleryFilter === filter ? ' active' : ''}`}
              aria-pressed={galleryFilter === filter}
              onClick={() => setGalleryFilter(filter)}
            >
              {label}
            </button>
          ))}
        </div>

        {mediaLoading ? (
          <div className="media-grid-empty glass" role="status">
            <p className="text-secondary">{t('Chargement de la galerie…', 'Loading gallery…')}</p>
          </div>
        ) : mediaError ? (
          <div className="media-grid-empty glass" role="alert">
            <h3>{t('Galerie indisponible', 'Gallery unavailable')}</h3>
            <p className="text-secondary">{mediaError}</p>
          </div>
        ) : (
          <MediaGrid
            media={sortedMedia}
            onMediaClick={onMediaClick}
            onFavorite={handleFavorite}
          />
        )}
      </section>

      <section className="dashboard-stats" aria-label="Accès rapide">
        <StatCard
          icon="▧"
          value={mediaLoading ? '…' : photoCount}
          label={t('Photos', 'Photos')}
          onClick={() => onNavigate('photos')}
        />
        <StatCard
          icon="▶"
          value={mediaLoading ? '…' : videoCount}
          label={t('Vidéos', 'Videos')}
          onClick={() => onNavigate('videos')}
        />
        <StatCard
          icon="◇"
          value={albumLoading ? '…' : albumCount}
          label={t('Albums', 'Albums')}
          onClick={() => onNavigate('albums')}
        />
        <StatCard
          icon="♧"
          value={groupLoading ? '…' : groupCount}
          label={t('Groupes', 'Groups')}
          onClick={() => onNavigate('groups')}
        />
      </section>
    </div>
  )
}
