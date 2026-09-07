import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import { MediaGrid } from '../components/media/MediaGrid'
import { getMedia } from '../services/media'

import type { Media } from '../types/media'


type PhotosProps = {
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


export function Photos({
  onUpload,
  refreshKey = 0,
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
              : 'Impossible de charger les médias.',
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


  const filteredMedia =
    useMemo(() => {

      let result =
        media.filter(
          (item) =>
            item.media_type === 'image',
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

    }, [media, filter])


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


  return (

    <div className="photos-page fade-in">

      {/* ==================================================
          EN-TÊTE
          ================================================== */}

      <section className="photos-header">

        <div>

          <span className="dashboard-eyebrow">
            BIBLIOTHÈQUE
          </span>

          <h1>
            Photos & vidéos
          </h1>

          <p className="text-secondary">
            Tous tes souvenirs dans un seul espace.
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


        {!loading && !error && (

          <div className="photos-count">

            {filteredMedia.length}{' '}

            {filteredMedia.length > 1
              ? 'médias'
              : 'média'}

            <span className="photos-count-detail">

              {' · '}

              {photoCount}
              {' photos'}

              {' · '}

              {videoCount}
              {' vidéos'}

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
            Chargement des médias...
          </h3>

          <p className="text-secondary">
            Récupération de ta galerie.
          </p>

        </div>

      ) : error ? (

        <div className="media-grid-empty glass">

          <div className="media-grid-empty-icon">
            !
          </div>

          <h3>
            Impossible de charger les médias
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
              ? 'Aucun favori'
              : 'Aucune photo'}

          </h3>

          <p className="text-secondary">

            {filter === 'favorites'
              ? 'Tes photos favorites apparaîtront ici.'
              : 'Importe ta première photo pour commencer.'}

          </p>


          {filter === 'all' &&
            onUpload && (

              <button
                type="button"
                className="accent-button"
                onClick={onUpload}
              >
                ＋ Importer une photo
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
        />

      )}

    </div>

  )
}
