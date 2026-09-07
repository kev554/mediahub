import type { Media } from '../../types/media'
import { useAuthenticatedMedia } from '../../hooks/useAuthenticatedMedia'

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

  const {
    url: thumbnailUrl,
    loading: thumbnailLoading,
  } = useAuthenticatedMedia(
    media.thumbnail_url,
  )

  const isVideo =
    media.media_type === 'video'

  const isFavorite =
    media.is_favorite

  const formattedDate =
    new Date(
      media.taken_at ||
        media.uploaded_at,
    ).toLocaleDateString(
      'fr-FR',
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
      className={`media-card glass ${
        selected
          ? 'media-card-selected'
          : ''
      }`}
      onClick={handleCardClick}
    >

      <div className="media-card-preview">

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
          <span className="media-card-type">
            ▶ Vidéo
          </span>
        )}

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
          onClick={(event) => {
            event.stopPropagation()
            onFavorite?.(media)
          }}
        >
          {isFavorite
            ? '♥'
            : '♡'}
        </button>

        {/* OUVERTURE */}

        {!selectable && (
          <div className="media-card-open">
            <span>⌕</span>
          </div>
        )}

      </div>

      <div className="media-card-info">

        <div className="media-card-title">
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
