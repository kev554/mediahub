import { useEffect, useState } from 'react'

import { API_URL } from '../services/api'
import { openMediaShare, type SharedMedia } from '../services/media'
import { t } from '../lib/i18n'

type PublicShareProps = {
  token: string
}

export function PublicShare({ token }: PublicShareProps) {
  const [media, setMedia] = useState<SharedMedia | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    void openMediaShare(token)
      .then((result) => {
        if (active) setMedia(result)
      })
      .catch((err: unknown) => {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : 'Ce lien de partage est indisponible.',
          )
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [token])

  const fileUrl = media
    ? media.file_url.startsWith('http://') || media.file_url.startsWith('https://')
      ? media.file_url
      : new URL(
          `${API_URL.replace(/\/$/, '')}${media.file_url.replace(/^\/api/, '')}`,
          window.location.origin,
        ).toString()
    : null

  return (
    <main className="public-share-page">
      <header>
        <a href="/">MediaHub</a>
        <h1>{t('Média partagé', 'Shared media')}</h1>
      </header>

      {loading && <p role="status">{t('Chargement du média…', 'Loading media…')}</p>}
      {error && <p role="alert">{error}</p>}

      {media && fileUrl && (
        <section>
          <h2>{media.media_name}</h2>
          {media.media_type === 'video' ? (
            <video controls playsInline preload="metadata" src={fileUrl}>
              {t('Votre navigateur ne peut pas lire cette vidéo.', 'Your browser cannot play this video.')}
            </video>
          ) : (
            <img src={fileUrl} alt={media.media_name} />
          )}
        </section>
      )}
    </main>
  )
}
