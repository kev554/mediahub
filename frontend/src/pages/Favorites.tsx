import {
  useEffect,
  useState,
} from 'react'

import { MediaGrid } from '../components/media/MediaGrid'
import {
  getFavoriteMedia,
  removeFromFavorites,
} from '../services/media'

import type { Media } from '../types/media'

type FavoritesProps = {
  onMediaClick?: (
    media: Media,
    mediaList: Media[],
  ) => void
}

export function Favorites({
  onMediaClick,
}: FavoritesProps) {
  const [media, setMedia] = useState<Media[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] =
    useState<string | null>(null)


  async function loadFavorites() {
    try {
      setLoading(true)
      setError(null)

      const result =
        await getFavoriteMedia()

      setMedia(result)

    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible de charger les favoris.',
      )
    } finally {
      setLoading(false)
    }
  }


  useEffect(() => {
    void loadFavorites()
  }, [])


  async function handleFavorite(item: Media) {
    try {
      await removeFromFavorites(
        item.id,
      )

      setMedia((current) =>
        current.filter(
          (media) =>
            media.id !== item.id,
        ),
      )

    } catch (err) {
      console.error(
        'Erreur suppression favori:',
        err,
      )
    }
  }


  return (
    <div className="favorites-page fade-in">

      <section className="photos-header">
        <div>
          <span className="dashboard-eyebrow">
            COLLECTION
          </span>

          <h1>
            Favoris
          </h1>

          <p className="text-secondary">
            Tes photos et vidéos préférées.
          </p>
        </div>
      </section>


      {loading ? (

        <div className="media-grid-empty glass">

          <div className="media-grid-empty-icon">
            ◌
          </div>

          <h3>
            Chargement des favoris...
          </h3>

          <p className="text-secondary">
            Récupération de tes médias favoris.
          </p>

        </div>


      ) : error ? (

        <div className="media-grid-empty glass">

          <div className="media-grid-empty-icon">
            !
          </div>

          <h3>
            Impossible de charger les favoris
          </h3>

          <p className="text-secondary">
            {error}
          </p>

          <button
            type="button"
            className="accent-button"
            onClick={() =>
              void loadFavorites()
            }
          >
            Réessayer
          </button>

        </div>


      ) : media.length === 0 ? (

        <div className="media-grid-empty glass">

          <div className="media-grid-empty-icon">
            ♡
          </div>

          <h3>
            Aucun favori
          </h3>

          <p className="text-secondary">
            Ajoute des médias aux favoris pour les retrouver ici.
          </p>

        </div>


      ) : (

        <MediaGrid
          media={media}
          onMediaClick={onMediaClick}
          onFavorite={handleFavorite}
        />

      )}

    </div>
  )
}
