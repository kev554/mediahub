import {
  useEffect,
  useState,
} from 'react'

import { MediaGrid } from '../components/media/MediaGrid'
import {
  getSharedMedia,
  listMediaShares,
  revokeMediaShare,
  type ShareLink,
} from '../services/media'

import type { Media } from '../types/media'
import { t } from '../lib/i18n'


type SharesProps = {
  searchQuery?: string
  onMediaClick?: (
    media: Media,
    mediaList: Media[],
  ) => void
}


export function Shares({
  searchQuery = '',
  onMediaClick,
}: SharesProps) {

  const [media, setMedia] =
    useState<Media[]>([])
  const [links, setLinks] = useState<ShareLink[]>([])

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState<string | null>(null)


  async function loadShares(search = searchQuery) {

    try {

      setLoading(true)
      setError(null)

      const [result, userLinks] = await Promise.all([
        getSharedMedia(search),
        listMediaShares(),
      ])
      setMedia(result)
      setLinks(userLinks)

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

  async function handleRevoke(link: ShareLink) {
    try {
      await revokeMediaShare(link.id)
      setLinks((current) =>
        current.map((item) =>
          item.id === link.id ? { ...item, is_active: false } : item,
        ),
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible de révoquer ce lien.',
      )
    }
  }

  function getPublicUrl(link: ShareLink) {
    return `${window.location.origin}/share/${link.token}`
  }

  async function copyPublicUrl(link: ShareLink) {
    if (!navigator.clipboard) {
      setError('Le presse-papiers est indisponible sur cette page.')
      return
    }

    try {
      await navigator.clipboard.writeText(getPublicUrl(link))
      setError(null)
    } catch (err) {
      setError(
        err instanceof Error
          ? `Copie impossible : ${err.message}`
          : 'Copie impossible.',
      )
    }
  }


  useEffect(() => {
    const timer = window.setTimeout(
      () => void loadShares(searchQuery),
      searchQuery.trim() ? 250 : 0,
    )
    return () => window.clearTimeout(timer)
  }, [searchQuery])


  return (
    <div className="shares-page fade-in">

      <section className="photos-header">

        <div>

          <span className="dashboard-eyebrow">
            COLLABORATION
          </span>

          <h1>
            {t('Partages', 'Shares')}
          </h1>

          <p className="text-secondary">
            {t('Tes médias partagés avec tes groupes.', 'Media shared with your groups.')}
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
              void loadShares(searchQuery)
            }
          >
            Réessayer
          </button>

        </div>

      )}

      {!loading && !error && (
        <section className="share-links-section">
          <h2>{t('Liens publics créés', 'Public links')}</h2>
          {links.length === 0 ? (
            <p className="text-secondary">
              {t('Aucun lien public. Ouvre un média et choisis « Créer un lien ».', 'No public links. Open a media item and choose “Create link”.')}
            </p>
          ) : (
            <div className="glass trash-list">
              {links.map((link) => (
                <article className="trash-item" key={link.id}>
                  <div className="trash-item-info">
                    <strong>Média #{link.media_id}</strong>
                    <span className="text-secondary">
                      {link.is_active ? t('Actif', 'Active') : t('Révoqué', 'Revoked')}
                      {' · '}
                      {link.max_views === null
                        ? t('sans limite de vues', 'no view limit')
                        : `${link.views_used}/${link.max_views} ${t('vues', 'views')}`}
                      {link.expires_at
                        ? ` · expire le ${new Date(link.expires_at).toLocaleString()}`
                        : ''}
                    </span>
                    <a href={getPublicUrl(link)} target="_blank" rel="noreferrer">
                      {getPublicUrl(link)}
                    </a>
                  </div>
                  <div className="trash-item-actions">
                    <button
                      type="button"
                      className="glass-button"
                      onClick={() => void copyPublicUrl(link)}
                    >
                      {t('Copier le lien', 'Copy link')}
                    </button>
                    {link.is_active && (
                      <button
                        type="button"
                        className="glass-button danger"
                        onClick={() => void handleRevoke(link)}
                      >
                        {t('Révoquer', 'Revoke')}
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="share-links-section">
        <h2>{t('Médias partagés avec mes groupes', 'Media shared with my groups')}</h2>


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
      </section>

    </div>
  )
}
