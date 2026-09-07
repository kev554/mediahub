import {
  useEffect,
  useState,
} from 'react'

import { MediaGrid } from '../components/media/MediaGrid'
import { getSharedMedia } from '../services/media'

import type { Media } from '../types/media'


type SharesProps = {
  onMediaClick?: (
    media: Media,
    mediaList: Media[],
  ) => void
}


export function Shares({
  onMediaClick,
}: SharesProps) {

  const [media, setMedia] =
    useState<Media[]>([])

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState<string | null>(null)


  async function loadShares() {

    try {

      setLoading(true)
      setError(null)

      const result =
        await getSharedMedia()

      setMedia(result)

    } catch (err) {

      setError(
        err instanceof Error
          ? err.message
          : 'Impossible de charger les partages.',
      )

    } finally {

      setLoading(false)

    }
  }


  useEffect(() => {
    void loadShares()
  }, [])


  return (
    <div className="shares-page fade-in">

      <section className="photos-header">

        <div>

          <span className="dashboard-eyebrow">
            COLLABORATION
          </span>

          <h1>
            Partages
          </h1>

          <p className="text-secondary">
            Tes médias partagés avec tes groupes.
          </p>

        </div>

      </section>


      {loading && (

        <div className="media-grid-empty glass">

          <h3>
            Chargement des partages...
          </h3>

        </div>

      )}


      {!loading && error && (

        <div className="media-grid-empty glass">

          <h3>
            Erreur
          </h3>

          <p className="text-secondary">
            {error}
          </p>

          <button
            type="button"
            className="accent-button"
            onClick={() =>
              void loadShares()
            }
          >
            Réessayer
          </button>

        </div>

      )}


      {!loading &&
        !error &&
        media.length === 0 && (

        <div className="media-grid-empty glass">

          <h3>
            Aucun partage
          </h3>

          <p className="text-secondary">
            Les médias partagés avec tes groupes apparaîtront ici.
          </p>

        </div>

      )}


      {!loading &&
        !error &&
        media.length > 0 && (

        <MediaGrid
          media={media}
          onMediaClick={onMediaClick}
        />

      )}

    </div>
  )
}
