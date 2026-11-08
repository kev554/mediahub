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


type PhotosProps = {
  onUpload?: () => void
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


export function Photos({
  onUpload,
  refreshKey = 0,
  searchQuery = '',
  searchFilters,
  onMediaClick,
}: PhotosProps) {

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
            media_type: searchFilters.media_type ?? 'image',
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
              : 'Impossible de charger les médias.',
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


  const filteredMedia =
    useMemo(() => {

      let result =
        media.filter(
          (item) =>
            item.media_type === (searchFilters.media_type ?? 'image'),
        )

      if (filter === 'favorites') {

        result =
          result.filter(
            (item) =>
              item.is_favorite,
          )

      }

      if (filter === 'recent') {

        result =
          [...result].sort(
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


  const photoCount =
    media.filter(
      (item) =>
        item.media_type === 'image',
    ).length


  const videoCount =
    media.filter(
      (item) =>
        item.media_type === 'video',
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

      {/* ==================================================
          EN-TÊTE
          ================================================== */}

      <section className="photos-header">

        <div>

          <span className="dashboard-eyebrow">MA GALERIE</span>

          <h1>{t('Photos', 'Photos')}</h1>

          <p className="text-secondary">
            {t('Parcours, retrouve et organise tes photos.', 'Browse, find, and organize your photos.')}
          </p>

        </div>


      </section>


      {/* ==================================================
          FILTRES
          ================================================== */}

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


        {!loading && !error && (

          <div className="photos-count">

            {filteredMedia.length}{' '}

            {filteredMedia.length !== 1
              ? t('éléments', 'items')
              : t('élément', 'item')}

            <span className="photos-count-detail">

              {' · '}

              {photoCount}
              {' '}{t('photos', 'photos')}

              {' · '}

              {videoCount}
              {' '}{t('vidéos', 'videos')}

            </span>

          </div>

        )}

      </section>


      {/* ==================================================
          CONTENU
          ================================================== */}

      {loading ? (

        <div className="media-grid-empty glass">

          <div className="media-grid-empty-icon">
            ◌
          </div>

          <h3>
            Chargement des photos...
          </h3>

          <p className="text-secondary">
            {t('Chargement de ta galerie.', 'Loading your library.')}
          </p>

        </div>

      ) : error ? (

        <div className="media-grid-empty glass">

          <div className="media-grid-empty-icon">
            !
          </div>

          <h3>
            {t('Impossible de charger les photos', 'Unable to load photos')}
          </h3>

          <p className="text-secondary">
            {error}
          </p>

          <button
            type="button"
            className="accent-button"
            onClick={() =>
              window.location.reload()
            }
          >
            Réessayer
          </button>

        </div>

      ) : filteredMedia.length === 0 ? (

        <div className="media-grid-empty glass">

          <div className="media-grid-empty-icon">
            ▧
          </div>

          <h3>

            {filter === 'favorites'
              ? t('Aucun favori pour le moment', 'No favorites yet')
              : t('Aucune photo pour le moment', 'No photos yet')}

          </h3>

          <p className="text-secondary">

            {filter === 'favorites'
              ? t('Tes photos favorites apparaîtront ici.', 'Your favorite photos will appear here.')
              : t('Importe ta première photo pour commencer.', 'Upload your first photo to get started.')}

          </p>


          {filter === 'all' &&
            onUpload && (

              <button
                type="button"
                className="accent-button"
                onClick={onUpload}
              >
                ＋ {t('Importer une photo', 'Upload a photo')}
              </button>

            )}

        </div>

      ) : (

        /*
         * MediaGrid possède maintenant sa propre gestion
         * de sélection multiple, téléchargement et suppression.
         */

        <MediaGrid
          media={filteredMedia}
          onMediaClick={onMediaClick}
          onFavorite={handleFavorite}
        />
      )}

    </div>

  )
}
