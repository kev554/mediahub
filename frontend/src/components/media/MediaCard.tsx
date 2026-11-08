import { useEffect, useRef, useState } from 'react'
import type { Media } from '../../types/media'
import { useAuthenticatedMedia } from '../../hooks/useAuthenticatedMedia'
import { Heart, Play, Search } from 'lucide-react'
import { t } from '../../lib/i18n'

type MediaCardProps = {
  media: Media
  mediaList: Media[]

  onClick?: (
    media: Media,
    mediaList: Media[],
  ) => void

  onFavorite?: (
    media: Media,
  ) => void

  selectable?: boolean
  selected?: boolean

  onSelect?: (
    media: Media,
  ) => void
}

export function MediaCard({
  media,
  mediaList,
  onClick,
  onFavorite,
  selectable = false,
  selected = false,
  onSelect,
}: MediaCardProps) {
  const cardRef = useRef<HTMLElement>(null)
  const [nearViewport, setNearViewport] = useState(
    () => typeof IntersectionObserver === 'undefined',
  )

  const {
    url: thumbnailUrl,
    loading: thumbnailLoading,
  } = useAuthenticatedMedia(
    nearViewport ? media.thumbnail_url : null,
  )

  useEffect(() => {
    const card = cardRef.current
    if (!card || nearViewport) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setNearViewport(true)
          observer.disconnect()
        }
      },
      { rootMargin: '300px' },
    )
    observer.observe(card)

    return () => observer.disconnect()
  }, [nearViewport])

  const isVideo =
    media.media_type === 'video'

  const isFavorite =
    media.is_favorite

  const formattedDate =
    new Date(
      media.taken_at ||
        media.uploaded_at,
    ).toLocaleDateString(
      document.documentElement.lang === 'en'
        ? 'en-US'
        : 'fr-FR',
      {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      },
    )

  function handleCardClick() {
    if (selectable) {
      onSelect?.(media)
      return
    }

    onClick?.(
      media,
      mediaList,
    )
  }

  return (
    <article
      ref={cardRef}
      className={`media-card glass ${
        selected
          ? 'media-card-selected selected'
          : ''
      }`}
    >

      <div className="media-card-preview">
        <button
          type="button"
          className="media-card-preview-trigger"
          onClick={handleCardClick}
          aria-label={`${t(selectable ? (selected ? 'Désélectionner' : 'Sélectionner') : 'Ouvrir', selectable ? (selected ? 'Deselect' : 'Select') : 'Open')} ${media.original_name}`}
        >

        {thumbnailLoading ? (

          <div className="media-card-placeholder">
            <span>◌</span>
          </div>

        ) : thumbnailUrl ? (

          <img
            src={thumbnailUrl}
            alt={media.original_name}
            className="media-card-image"
          />

        ) : (

          <div className="media-card-placeholder">
            <span>📷</span>
          </div>

        )}

        <div className="media-card-overlay" />

        {isVideo && (
          <span className="media-video-play" aria-label="Lire la vidéo">
            <Play size={21} fill="currentColor" strokeWidth={1.5} aria-hidden="true" />
          </span>
        )}

        {!selectable && !isVideo && (
          <div className="media-card-open">
            <Search size={18} strokeWidth={1.8} aria-hidden="true" />
          </div>
        )}

        </button>

        {/* SÉLECTION */}

        {selectable && (
          <button
            type="button"
            className={`media-card-select ${
              selected
                ? 'active'
                : ''
            }`}
            aria-label={
              selected
                ? 'Désélectionner ce média'
                : 'Sélectionner ce média'
            }
            aria-pressed={selected}
            onClick={(event) => {
              event.stopPropagation()
              onSelect?.(media)
            }}
          >
            {selected ? '✓' : ''}
          </button>
        )}

        {/* FAVORI */}

        <button
          type="button"
          className={`media-card-favorite ${
            isFavorite
              ? 'active'
              : ''
          }`}
          aria-label={
            isFavorite
              ? 'Retirer des favoris'
              : 'Ajouter aux favoris'
          }
          aria-pressed={isFavorite}
          onClick={(event) => {
            event.stopPropagation()
            onFavorite?.(media)
          }}
        >
          <Heart
            size={17}
            fill={isFavorite ? 'currentColor' : 'none'}
            strokeWidth={1.8}
            aria-hidden="true"
          />
        </button>

      </div>

      <div className="media-card-info">

        <div className="media-card-title" title={media.original_name}>
          {media.original_name}
        </div>

        <div className="media-card-meta">

          <span>
            {formattedDate}
          </span>

          {media.file_size > 0 && (
            <>
              <span>
                •
              </span>

              <span>
                {formatFileSize(
                  media.file_size,
                )}
              </span>
            </>
          )}

        </div>

      </div>

    </article>
  )
}

function formatFileSize(
  bytes: number,
): string {

  if (
    !bytes ||
    bytes <= 0
  ) {
    return '0 B'
  }

  const units = [
    'B',
    'KB',
    'MB',
    'GB',
    'TB',
  ]

  const index =
    Math.floor(
      Math.log(bytes) /
        Math.log(1024),
    )

  const safeIndex =
    Math.min(
      index,
      units.length - 1,
    )

  const value =
    bytes /
    Math.pow(
      1024,
      safeIndex,
    )

  return `${value.toFixed(
    safeIndex === 0
      ? 0
      : 1,
  )} ${units[safeIndex]}`
}
