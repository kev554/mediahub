import {
  useEffect,
  useRef,
  useState,
} from 'react'

import { createPortal } from 'react-dom'

import type { Media } from '../../types/media'

import {
  addToFavorites,
  deleteMedia,
  downloadMedia,
  removeFromFavorites,
} from '../../services/media'

import {
  useAuthenticatedMedia,
} from '../../hooks/useAuthenticatedMedia'


type MediaViewerProps = {
  media: Media | null
  mediaList: Media[]
  onClose: () => void
  onChange: (media: Media) => void
  onDelete?: (media: Media) => void
}


export function MediaViewer({
  media,
  mediaList,
  onClose,
  onChange,
  onDelete,
}: MediaViewerProps) {

  const viewerRef =
    useRef<HTMLDivElement | null>(null)

  const {
    url,
    loading,
    error,
  } = useAuthenticatedMedia(
    media?.file_url,
  )

  const [touchStartX, setTouchStartX] =
    useState<number | null>(null)

  const [deleting, setDeleting] =
    useState(false)

  const [favorite, setFavorite] =
    useState(
      media?.is_favorite ?? false,
    )

  const [updatingFavorite, setUpdatingFavorite] =
    useState(false)

  const [isFullscreen, setIsFullscreen] =
    useState(false)


  /*
   * --------------------------------------------------------
   * FAVORI
   * --------------------------------------------------------
   */

  useEffect(() => {
    setFavorite(
      media?.is_favorite ?? false,
    )
  }, [media])


  /*
   * --------------------------------------------------------
   * NAVIGATION
   * --------------------------------------------------------
   */

  const currentIndex =
    media
      ? mediaList.findIndex(
          (item) =>
            item.id === media.id,
        )
      : -1

  const canGoPrevious =
    currentIndex > 0

  const canGoNext =
    currentIndex >= 0 &&
    currentIndex <
      mediaList.length - 1


  function showPrevious() {
    if (!canGoPrevious) return

    onChange(
      mediaList[currentIndex - 1],
    )
  }


  function showNext() {
    if (!canGoNext) return

    onChange(
      mediaList[currentIndex + 1],
    )
  }


  /*
   * --------------------------------------------------------
   * PLEIN ÉCRAN
   * --------------------------------------------------------
   */

  async function toggleFullscreen() {
    if (!viewerRef.current) return

    try {

      if (!document.fullscreenElement) {

        await viewerRef.current.requestFullscreen()

        setIsFullscreen(true)

      } else {

        await document.exitFullscreen()

        setIsFullscreen(false)

      }

    } catch (error) {

      console.error(
        'Fullscreen error:',
        error,
      )

    }
  }


  useEffect(() => {

    function handleFullscreenChange() {

      setIsFullscreen(
        document.fullscreenElement ===
          viewerRef.current,
      )

    }

    document.addEventListener(
      'fullscreenchange',
      handleFullscreenChange,
    )

    return () => {
      document.removeEventListener(
        'fullscreenchange',
        handleFullscreenChange,
      )
    }

  }, [])


  /*
   * --------------------------------------------------------
   * SUPPRESSION
   * --------------------------------------------------------
   */

  async function handleDelete() {

    if (!media) return

    if (
      !window.confirm(
        `Supprimer "${media.original_name}" ?`,
      )
    ) {
      return
    }

    try {

      setDeleting(true)

      await deleteMedia(
        media.id,
      )

      onDelete?.(media)

      if (document.fullscreenElement) {
        await document.exitFullscreen()
      }

      onClose()

    } catch (error) {

      console.error(error)

      alert(
        'Impossible de supprimer ce média',
      )

    } finally {

      setDeleting(false)

    }
  }
  /*
   * --------------------------------------------------------
   * TÉLÉCHARGEMENT
   * --------------------------------------------------------
   */

  const [downloading, setDownloading] =
    useState(false)


  async function handleDownload() {

    if (!media) return

    try {

      setDownloading(true)

      await downloadMedia(
        media,
      )

    } catch (error) {

      console.error(
        'Download error:',
        error,
      )

      alert(
        'Impossible de télécharger ce média.',
      )

    } finally {

      setDownloading(false)

    }
  }

  /*
   * --------------------------------------------------------
   * FAVORI
   * --------------------------------------------------------
   */

  async function handleFavorite() {

    if (!media) return

    try {

      setUpdatingFavorite(true)

      if (favorite) {

        await removeFromFavorites(
          media.id,
        )

        setFavorite(false)

      } else {

        await addToFavorites(
          media.id,
        )

        setFavorite(true)

      }

    } catch (error) {

      console.error(error)

      alert(
        'Impossible de modifier le favori',
      )

    } finally {

      setUpdatingFavorite(false)

    }
  }


  /*
   * --------------------------------------------------------
   * CLAVIER + SCROLL
   * --------------------------------------------------------
   */

  useEffect(() => {

    if (!media) return

    const previousOverflow =
      document.body.style.overflow

    document.body.style.overflow =
      'hidden'


    function handleKeyDown(
      event: KeyboardEvent,
    ) {

      if (event.key === 'Escape') {
        onClose()
        return
      }

      if (event.key === 'ArrowLeft') {
        showPrevious()
        return
      }

      if (event.key === 'ArrowRight') {
        showNext()
      }
    }


    window.addEventListener(
      'keydown',
      handleKeyDown,
    )


    return () => {

      document.body.style.overflow =
        previousOverflow

      window.removeEventListener(
        'keydown',
        handleKeyDown,
      )

    }

  }, [
    media,
    currentIndex,
  ])


  /*
   * --------------------------------------------------------
   * FERMETURE
   * --------------------------------------------------------
   */

  async function handleClose() {

    try {

      if (document.fullscreenElement) {
        await document.exitFullscreen()
      }

    } catch {
      // Rien à faire
    }

    setIsFullscreen(false)

    onClose()
  }


  /*
   * --------------------------------------------------------
   * TOUCH / SWIPE
   * --------------------------------------------------------
   */

  function handleTouchStart(
    event: React.TouchEvent,
  ) {

    setTouchStartX(
      event.touches[0].clientX,
    )
  }


  function handleTouchEnd(
    event: React.TouchEvent,
  ) {

    if (touchStartX === null) {
      return
    }

    const distance =
      touchStartX -
      event.changedTouches[0].clientX


    if (
      Math.abs(distance) > 60
    ) {

      if (distance > 0) {
        showNext()
      } else {
        showPrevious()
      }

    }

    setTouchStartX(null)
  }


  /*
   * --------------------------------------------------------
   * PAS DE MÉDIA
   * --------------------------------------------------------
   */

  if (!media) {
    return null
  }


  const isVideo =
    media.media_type === 'video'


  /*
   * --------------------------------------------------------
   * VIEWER
   * --------------------------------------------------------
   */

  const viewer = (

    <div
      ref={viewerRef}
      className={`media-viewer ${
        isFullscreen
          ? 'media-viewer-fullscreen'
          : ''
      }`}
      role="dialog"
      aria-modal="true"
      aria-label="Lecteur média"
      onClick={handleClose}
    >

      <div
        className="media-viewer-content"
        onClick={(event) =>
          event.stopPropagation()
        }
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >

        {/* ------------------------------------------------ */}
        {/* BARRE SUPÉRIEURE */}
        {/* ------------------------------------------------ */}

        <div className="media-viewer-topbar">

          <div className="media-viewer-counter">
            {currentIndex + 1}
            {' / '}
            {mediaList.length}
          </div>


          <div className="media-viewer-actions">

            <button
              type="button"
              className="media-viewer-action"
              onClick={toggleFullscreen}
              aria-label={
                isFullscreen
                  ? 'Quitter le plein écran'
                  : 'Plein écran'
              }
            >
              {isFullscreen
                ? '⛶'
                : '⛶'}
            </button>


            <button
              type="button"
              className="media-viewer-action media-viewer-close"
              onClick={handleClose}
              aria-label="Fermer"
            >
              ×
            </button>

          </div>

        </div>


        {/* ------------------------------------------------ */}
        {/* NAVIGATION GAUCHE */}
        {/* ------------------------------------------------ */}

        {canGoPrevious && (

          <button
            type="button"
            className="media-viewer-prev"
            onClick={showPrevious}
            aria-label="Média précédent"
          >
            ‹
          </button>

        )}


        {/* ------------------------------------------------ */}
        {/* NAVIGATION DROITE */}
        {/* ------------------------------------------------ */}

        {canGoNext && (

          <button
            type="button"
            className="media-viewer-next"
            onClick={showNext}
            aria-label="Média suivant"
          >
            ›
          </button>

        )}


        {/* ------------------------------------------------ */}
        {/* MÉDIA */}
        {/* ------------------------------------------------ */}

        <div className="media-viewer-preview">

          {loading && (

            <div className="media-viewer-status">
              <div className="media-viewer-spinner" />
              <span>Chargement...</span>
            </div>

          )}


          {error && (

            <div className="media-viewer-status media-viewer-error">
              <strong>Impossible d'afficher ce média</strong>
              <span>{error}</span>
            </div>

          )}


          {!loading &&
            !error &&
            url && (

              isVideo ? (

                <video
                  key={media.id}
                  src={url}
                  controls
                  playsInline
                  preload="metadata"
                />

              ) : (

                <img
                  key={media.id}
                  src={url}
                  alt={media.original_name}
                  draggable={false}
                />

              )

            )}

        </div>


        {/* ------------------------------------------------ */}
        {/* INFORMATIONS */}
        {/* ------------------------------------------------ */}

        <div className="media-viewer-info">

          <div className="media-viewer-details">

            <span className="dashboard-eyebrow">
              {isVideo
                ? 'VIDÉO'
                : 'PHOTO'}
            </span>


            <h2>
              {media.original_name}
            </h2>


            <small>
              📅{' '}
              {new Date(
                media.taken_at ??
                media.uploaded_at,
              ).toLocaleDateString(
                'fr-FR',
              )}
            </small>

          </div>


          <div className="media-viewer-buttons">

  <button
    type="button"
    className="glass-button"
    onClick={handleDownload}
    disabled={downloading}
  >
    {downloading
      ? 'Téléchargement...'
      : '⬇ Télécharger'}
  </button>


  <button
    type="button"
    className="glass-button"
    onClick={handleFavorite}
    disabled={
      updatingFavorite
    }
  >
    {favorite
      ? '⭐ Favori'
      : '☆ Ajouter'}
  </button>


  <button
    type="button"
    className="danger-button"
    onClick={handleDelete}
    disabled={deleting}
  >
    {deleting
      ? 'Suppression...'
      : '🗑 Supprimer'}
  </button>

</div>

        </div>

      </div>

    </div>

  )


  /*
   * --------------------------------------------------------
   * PORTAL
   * --------------------------------------------------------
   */

  return createPortal(
    viewer,
    document.body,
  )
}
