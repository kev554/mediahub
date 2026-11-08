import {
  useEffect,
  useRef,
  useState,
} from 'react'

import { createPortal } from 'react-dom'
import type {
  CSSProperties,
  PointerEvent,
  WheelEvent,
} from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Heart,
  Info,
  Link2,
  Maximize2,
  Minimize2,
  Pause,
  PictureInPicture2,
  Play,
  RotateCcw,
  Trash2,
  X,
  Volume2,
  VolumeX,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'

import type { Media } from '../../types/media'

import {
  addToFavorites,
  createMediaShare,
  deleteMedia,
  downloadMedia,
  removeFromFavorites,
} from '../../services/media'
import { t } from '../../lib/i18n'
import {
  celebrateFavoriteAdded,
  prepareFavoriteSound,
} from '../../lib/favoriteCelebration'

import {
  useAuthenticatedMedia,
} from '../../hooks/useAuthenticatedMedia'
import { FavoriteCelebration } from '../ui/FavoriteCelebration'


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
  const isVideo = media?.media_type === 'video'

  const viewerRef =
    useRef<HTMLDivElement | null>(null)

  const videoRef =
    useRef<HTMLVideoElement | null>(null)

  const panStartRef =
    useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null)

  const suppressPhotoClickRef = useRef(false)

  const {
    url,
    loading,
    error,
  } = useAuthenticatedMedia(
    media?.file_url,
    isVideo,
  )

  const { url: thumbnailUrl } = useAuthenticatedMedia(
    media?.thumbnail_url,
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

  const [photoOnly, setPhotoOnly] =
    useState(false)

  const [infoOpen, setInfoOpen] =
    useState(false)

  const [zoom, setZoom] =
    useState(1)

  const [pan, setPan] =
    useState({ x: 0, y: 0 })

  const [videoPlaying, setVideoPlaying] =
    useState(false)

  const [videoTime, setVideoTime] =
    useState(0)

  const [videoDuration, setVideoDuration] =
    useState(0)

  const [videoVolume, setVideoVolume] =
    useState(1)

  const [videoMuted, setVideoMuted] =
    useState(false)

  const [playbackRate, setPlaybackRate] =
    useState(1)

  const [playbackError, setPlaybackError] =
    useState<string | null>(null)

  const [mediaRendered, setMediaRendered] =
    useState(false)

  const [mediaOrientation, setMediaOrientation] =
    useState<'landscape' | 'portrait'>(
      media?.width && media?.height && media.width < media.height
        ? 'portrait'
        : 'landscape',
    )

  const [downloading, setDownloading] = useState(false)
  const [creatingShare, setCreatingShare] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [shareError, setShareError] = useState<string | null>(null)


  useEffect(() => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
    setVideoPlaying(false)
    setVideoTime(0)
    setVideoDuration(0)
    setVideoVolume(1)
    setVideoMuted(false)
    setPlaybackRate(1)
    setPlaybackError(null)
    setInfoOpen(false)
    setPhotoOnly(false)
    setMediaRendered(false)
    setMediaOrientation(
      media?.width && media?.height && media.width < media.height
        ? 'portrait'
        : 'landscape',
    )
    setShareUrl(null)
    setShareError(null)
  }, [media?.id, media?.width, media?.height])


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

  function updateZoom(value: number) {
    const nextZoom = Math.min(4, Math.max(1, value))
    setZoom(nextZoom)
    if (nextZoom === 1) {
      setPan({ x: 0, y: 0 })
    }
  }


  function handlePhotoWheel(event: WheelEvent<HTMLDivElement>) {
    if (isVideo) return
    event.preventDefault()
    updateZoom(zoom + (event.deltaY < 0 ? 0.25 : -0.25))
  }


  function handlePhotoPointerDown(event: PointerEvent<HTMLImageElement>) {
    if (zoom <= 1) return
    event.currentTarget.setPointerCapture(event.pointerId)
    panStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      offsetX: pan.x,
      offsetY: pan.y,
    }
  }


  function handlePhotoPointerMove(event: PointerEvent<HTMLImageElement>) {
    if (!panStartRef.current || zoom <= 1) return
    setPan({
      x: panStartRef.current.offsetX + event.clientX - panStartRef.current.x,
      y: panStartRef.current.offsetY + event.clientY - panStartRef.current.y,
    })
  }


  function handlePhotoPointerUp() {
    panStartRef.current = null
  }


  async function toggleVideoPlayback() {
    const video = videoRef.current
    if (!video) return

    if (video.paused) {
      try {
        await video.play()
      } catch (error) {
        console.error('Unable to start media playback.', error)
        setVideoPlaying(false)
      }
    } else {
      video.pause()
    }
  }

  function setVideoVolumeLevel(value: number) {
    const video = videoRef.current
    const nextVolume = Math.min(1, Math.max(0, value))
    setVideoVolume(nextVolume)
    setVideoMuted(nextVolume === 0)
    if (video) {
      video.volume = nextVolume
      video.muted = nextVolume === 0
    }
  }

  function toggleVideoMute() {
    const video = videoRef.current
    if (!video) return

    const nextMuted = !video.muted
    video.muted = nextMuted
    setVideoMuted(nextMuted)
    if (!nextMuted && video.volume === 0) {
      video.volume = 1
      setVideoVolume(1)
    }
  }

  function changePlaybackRate(value: number) {
    const video = videoRef.current
    if (!video) return
    video.playbackRate = value
    setPlaybackRate(value)
  }

  async function togglePictureInPicture() {
    const video = videoRef.current
    if (!video || !document.pictureInPictureEnabled) return

    try {
      if (document.pictureInPictureElement === video) {
        await document.exitPictureInPicture()
      } else {
        await video.requestPictureInPicture()
      }
      setPlaybackError(null)
    } catch (error) {
      console.error('Unable to toggle picture-in-picture.', error)
      setPlaybackError(
        t('Le mode image dans l’image est indisponible.', 'Picture-in-picture is unavailable.'),
      )
    }
  }


  function formatTime(seconds: number) {
    if (!Number.isFinite(seconds)) return '0:00'
    const wholeSeconds = Math.floor(seconds)
    const hours = Math.floor(wholeSeconds / 3600)
    const minutes = Math.floor((wholeSeconds % 3600) / 60)
    const remainder = wholeSeconds % 60
    const paddedSeconds = String(remainder).padStart(2, '0')
    return hours > 0
      ? `${hours}:${String(minutes).padStart(2, '0')}:${paddedSeconds}`
      : `${minutes}:${paddedSeconds}`
  }


  function formatFileSize(bytes: number) {
    if (bytes < 1024 * 1024) {
      return `${Math.max(1, Math.round(bytes / 1024))} Ko`
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
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
        `Envoyer "${media.original_name}" dans la corbeille ?`,
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

  async function handleCreateShare() {
    if (!media) return

    try {
      setCreatingShare(true)
      setShareError(null)
      const link = await createMediaShare(media.id)
      setShareUrl(`${window.location.origin}/share/${link.token}`)
    } catch (error) {
      setShareError(
        error instanceof Error
          ? error.message
          : 'Impossible de créer le lien de partage.',
      )
    } finally {
      setCreatingShare(false)
    }
  }

  async function handleCopyShareUrl() {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setShareError(null)
    } catch (error) {
      setShareError(
        error instanceof Error
          ? `Copie impossible : ${error.message}`
          : 'Copie impossible. Sélectionne le lien pour le copier.',
      )
    }
  }

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

    const playFavoriteSound = favorite
      ? undefined
      : prepareFavoriteSound()

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
        celebrateFavoriteAdded()
        playFavoriteSound?.()

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
        if (photoOnly) {
          setPhotoOnly(false)
          return
        }
        onClose()
        return
      }

      if (
        event.target instanceof HTMLElement &&
        (
          ['INPUT', 'BUTTON', 'TEXTAREA'].includes(event.target.tagName) ||
          event.target.isContentEditable
        )
      ) {
        return
      }

      if (event.key === 'ArrowLeft') {
        showPrevious()
        return
      }

      if (event.key === 'ArrowRight') {
        showNext()
        return
      }

      if (event.code === 'Space' && isVideo) {
        event.preventDefault()
        void toggleVideoPlayback()
      } else if (event.key.toLowerCase() === 'm' && isVideo) {
        toggleVideoMute()
      } else if (event.key.toLowerCase() === 'i') {
        setInfoOpen((open) => !open)
      } else if (event.key.toLowerCase() === 'f') {
        void toggleFullscreen()
      } else if (!isVideo && (event.key === '+' || event.key === '=')) {
        updateZoom(zoom + 0.25)
      } else if (!isVideo && event.key === '-') {
        updateZoom(zoom - 0.25)
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
    isVideo,
    photoOnly,
    zoom,
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
      suppressPhotoClickRef.current = true
      window.setTimeout(() => {
        suppressPhotoClickRef.current = false
      }, 500)

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

  const previewBackdropUrl =
    thumbnailUrl ?? (!isVideo ? url : null)

  function updateMediaOrientation(width: number, height: number) {
    if (width > 0 && height > 0) {
      setMediaOrientation(width >= height ? 'landscape' : 'portrait')
    }
  }


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
      }${photoOnly ? ' media-viewer-photo-only' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Lecteur média"
      onClick={handleClose}
    >

      <FavoriteCelebration portalToBody={false} />

      <div
        className="media-viewer-content"
        onClick={(event) =>
          event.stopPropagation()
        }
        onTouchStart={zoom > 1 ? undefined : handleTouchStart}
        onTouchEnd={zoom > 1 ? undefined : handleTouchEnd}
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
              className={`media-viewer-action ${infoOpen ? 'active' : ''}`}
              onClick={() => setInfoOpen((open) => !open)}
              aria-label={t('Afficher les informations du fichier', 'Show file information')}
              aria-expanded={infoOpen}
              aria-controls="media-viewer-info-panel"
              title={t('Informations', 'Information')}
            >
              <Info size={18} />
            </button>

            <button
              type="button"
              className="media-viewer-action"
              onClick={toggleFullscreen}
              aria-label={
                isFullscreen
                  ? 'Quitter le plein écran'
                  : 'Plein écran'
              }
              title={isFullscreen ? t('Quitter le plein écran', 'Exit fullscreen') : t('Plein écran', 'Fullscreen')}
            >
              {isFullscreen
                ? <Minimize2 size={18} />
                : <Maximize2 size={18} />}
            </button>


            <button
              type="button"
              className="media-viewer-action media-viewer-close"
              onClick={handleClose}
              aria-label="Fermer"
              title={t('Fermer', 'Close')}
            >
              <X size={18} />
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
            title={t('Média précédent', 'Previous media')}
          >
            <ChevronLeft size={28} />
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
            title={t('Média suivant', 'Next media')}
          >
            <ChevronRight size={28} />
          </button>

        )}


        {/* ------------------------------------------------ */}
        {/* MÉDIA */}
        {/* ------------------------------------------------ */}

        <div
          className={`media-viewer-preview ${isVideo ? 'is-video' : 'is-photo'} is-${mediaOrientation}${previewBackdropUrl ? ' has-media-backdrop' : ''}`}
          style={previewBackdropUrl
            ? { '--media-preview-image': `url("${previewBackdropUrl.replace(/["\\\n\r]/g, '\\$&')}")` } as CSSProperties
            : undefined}
          onWheel={handlePhotoWheel}
        >

          {!isVideo && thumbnailUrl && !mediaRendered && (
            <img
              className="media-viewer-thumbnail"
              src={thumbnailUrl}
              alt=""
              aria-hidden="true"
              decoding="async"
            />
          )}

          {(loading || (!error && url && !mediaRendered)) && (

            <div className="media-viewer-status media-viewer-loading-overlay">
              <div className="media-viewer-spinner" />
              <span>{t('Chargement du média…', 'Loading media…')}</span>
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
                  ref={videoRef}
                  key={media.id}
                  src={url}
                  poster={thumbnailUrl ?? undefined}
                  aria-label={media.original_name}
                  playsInline
                  preload="metadata"
                  onError={() => {
                    setPlaybackError(
                      t('Impossible de lire cette vidéo.', 'Unable to play this video.'),
                    )
                  }}
                  onLoadedData={(event) => {
                    setMediaRendered(true)
                    updateMediaOrientation(
                      event.currentTarget.videoWidth,
                      event.currentTarget.videoHeight,
                    )
                  }}
                  onPlay={() => setVideoPlaying(true)}
                  onPause={() => setVideoPlaying(false)}
                  onClick={() => void toggleVideoPlayback()}
                  onTimeUpdate={(event) =>
                    setVideoTime(event.currentTarget.currentTime)
                  }
                  onLoadedMetadata={(event) =>
                    {
                      setVideoDuration(event.currentTarget.duration)
                      updateMediaOrientation(
                        event.currentTarget.videoWidth,
                        event.currentTarget.videoHeight,
                      )
                      event.currentTarget.volume = videoVolume
                      event.currentTarget.muted = videoMuted
                      event.currentTarget.playbackRate = playbackRate
                    }
                  }
                  onVolumeChange={(event) => {
                    setVideoVolume(event.currentTarget.volume)
                    setVideoMuted(event.currentTarget.muted)
                  }}
                  onDurationChange={(event) =>
                    setVideoDuration(event.currentTarget.duration)
                  }
                  onEnded={() => setVideoPlaying(false)}
                />

              ) : (

                <img
                  key={media.id}
                  className={`media-viewer-photo ${mediaRendered ? 'is-ready' : ''} ${zoom > 1 ? 'is-zoomed' : ''}`}
                  src={url}
                  alt={media.original_name}
                  draggable={false}
                  decoding="async"
                  fetchPriority="high"
                  role="button"
                  tabIndex={0}
                  aria-pressed={photoOnly}
                  aria-label={photoOnly
                    ? t('Quitter le mode photo seule', 'Exit photo-only mode')
                    : t('Afficher la photo seule en plein écran', 'Show photo only in fullscreen')}
                  title={photoOnly
                    ? t('Quitter le mode photo seule', 'Exit photo-only mode')
                    : t('Afficher la photo seule', 'Show photo only')}
                  onClick={() => {
                    if (suppressPhotoClickRef.current) {
                      suppressPhotoClickRef.current = false
                      return
                    }
                    setPhotoOnly((active) => !active)
                    setZoom(1)
                    setPan({ x: 0, y: 0 })
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      setPhotoOnly((active) => !active)
                      setZoom(1)
                      setPan({ x: 0, y: 0 })
                    }
                  }}
                  onLoad={(event) => {
                    setMediaRendered(true)
                    updateMediaOrientation(
                      event.currentTarget.naturalWidth,
                      event.currentTarget.naturalHeight,
                    )
                  }}
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  }}
                  onPointerDown={handlePhotoPointerDown}
                  onPointerMove={handlePhotoPointerMove}
                  onPointerUp={handlePhotoPointerUp}
                  onPointerCancel={handlePhotoPointerUp}
                />

              )

            )}

          {!loading && !error && url && isVideo && (
            <div
              className="media-viewer-video-controls"
              onTouchStart={(event) => event.stopPropagation()}
              onTouchEnd={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className="media-viewer-play"
                onClick={() => void toggleVideoPlayback()}
                aria-label={videoPlaying ? 'Mettre en pause' : 'Lire la vidéo'}
                title={videoPlaying ? t('Mettre en pause', 'Pause') : t('Lire la vidéo', 'Play')}
              >
                {videoPlaying ? <Pause size={19} /> : <Play size={19} />}
              </button>
              <span className="media-viewer-time">{formatTime(videoTime)}</span>
              <input
                className="media-viewer-seek"
                type="range"
                min="0"
                max={videoDuration || 0}
                step="0.1"
                value={Math.min(videoTime, videoDuration || 0)}
                onChange={(event) => {
                  const nextTime = Number(event.target.value)
                  if (videoRef.current) {
                    videoRef.current.currentTime = nextTime
                  }
                  setVideoTime(nextTime)
                }}
                aria-label="Position dans la vidéo"
                style={{
                  '--video-progress': videoDuration
                    ? `${(videoTime / videoDuration) * 100}%`
                    : '0%',
                } as CSSProperties}
              />
              <span className="media-viewer-time">{formatTime(videoDuration)}</span>
              <button
                type="button"
                className="media-viewer-control"
                onClick={toggleVideoMute}
                aria-label={videoMuted ? t('Activer le son', 'Unmute') : t('Couper le son', 'Mute')}
                title={videoMuted ? t('Activer le son', 'Unmute') : t('Couper le son', 'Mute')}
              >
                {videoMuted ? <VolumeX size={17} /> : <Volume2 size={17} />}
              </button>
              <input
                className="media-viewer-volume"
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={videoMuted ? 0 : videoVolume}
                onChange={(event) => setVideoVolumeLevel(Number(event.target.value))}
                aria-label={t('Volume', 'Volume')}
              />
              <select
                className="media-viewer-speed"
                value={playbackRate}
                onChange={(event) => changePlaybackRate(Number(event.target.value))}
                aria-label={t('Vitesse de lecture', 'Playback speed')}
                title={t('Vitesse de lecture', 'Playback speed')}
              >
                {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                  <option key={rate} value={rate}>
                    {rate === 1 ? t('Normale', 'Normal') : `${rate}×`}
                  </option>
                ))}
              </select>
              {document.pictureInPictureEnabled && (
                <button
                  type="button"
                  className="media-viewer-control media-viewer-pip"
                  onClick={() => void togglePictureInPicture()}
                  aria-label={t('Image dans l’image', 'Picture in picture')}
                  title={t('Image dans l’image', 'Picture in picture')}
                >
                  <PictureInPicture2 size={17} />
                </button>
              )}
            </div>
          )}

          {playbackError && (
            <p className="media-viewer-playback-error" role="alert">
              {playbackError}
            </p>
          )}

          {!loading && !error && url && !isVideo && (
            <div className="media-viewer-zoom-controls" aria-label="Commandes de zoom">
              <button
                type="button"
                className="media-viewer-action"
                onClick={() => updateZoom(zoom - 0.25)}
                aria-label="Réduire le zoom"
                title={t('Réduire le zoom', 'Zoom out')}
                disabled={zoom <= 1}
              >
                <ZoomOut size={17} />
              </button>
              <span>{Math.round(zoom * 100)}%</span>
              <button
                type="button"
                className="media-viewer-action"
                onClick={() => updateZoom(zoom + 0.25)}
                aria-label="Agrandir"
                title={t('Agrandir', 'Zoom in')}
                disabled={zoom >= 4}
              >
                <ZoomIn size={17} />
              </button>
              {zoom > 1 && (
                <button
                  type="button"
                  className="media-viewer-action"
                  onClick={() => updateZoom(1)}
                  aria-label="Réinitialiser le zoom"
                  title={t('Réinitialiser le zoom', 'Reset zoom')}
                >
                  <RotateCcw size={16} />
                </button>
              )}
            </div>
          )}

        </div>


        {/* ------------------------------------------------ */}
        {/* INFORMATIONS */}
        {/* ------------------------------------------------ */}

        {infoOpen && (
          <aside
            id="media-viewer-info-panel"
            className="media-viewer-info-panel"
            aria-label={t('Informations du fichier', 'File information')}
          >
            <span className="dashboard-eyebrow">
              {isVideo ? t('VIDÉO', 'VIDEO') : t('PHOTO', 'PHOTO')}
            </span>
            <h2 title={media.original_name}>{media.original_name}</h2>
            <dl>
              {media.width && media.height && (
                <div>
                  <dt>{t('Dimensions', 'Dimensions')}</dt>
                  <dd>{media.width} × {media.height}</dd>
                </div>
              )}
              <div>
                <dt>{t('Taille', 'Size')}</dt>
                <dd>{formatFileSize(media.file_size)}</dd>
              </div>
              {isVideo && (media.duration || videoDuration) > 0 && (
                <div>
                  <dt>{t('Durée', 'Duration')}</dt>
                  <dd>{formatTime(media.duration ?? videoDuration)}</dd>
                </div>
              )}
              <div>
                <dt>{t('Date', 'Date')}</dt>
                <dd>
                  {new Date(media.taken_at ?? media.uploaded_at).toLocaleDateString(
                    document.documentElement.lang || 'fr',
                  )}
                </dd>
              </div>
            </dl>
          </aside>
        )}

        <div className="media-viewer-actions-bar">
          <button
            type="button"
            className="media-viewer-action"
            onClick={() => void handleDownload()}
            disabled={downloading}
            aria-label={downloading ? t('Téléchargement en cours', 'Downloading') : t('Télécharger', 'Download')}
            title={downloading ? t('Téléchargement en cours', 'Downloading') : t('Télécharger', 'Download')}
          >
            <Download size={17} />
          </button>

          <button
            type="button"
            className="media-viewer-action"
            onClick={() => void handleCreateShare()}
            disabled={creatingShare}
            aria-label={creatingShare ? t('Création du lien', 'Creating link') : t('Créer un lien', 'Create share link')}
            title={creatingShare ? t('Création du lien', 'Creating link') : t('Créer un lien', 'Create share link')}
          >
            <Link2 size={17} />
          </button>

          <button
            type="button"
            className={`media-viewer-action ${favorite ? 'active' : ''}`}
            onClick={() => void handleFavorite()}
            disabled={updatingFavorite}
            aria-label={favorite ? t('Retirer des favoris', 'Remove from favorites') : t('Ajouter aux favoris', 'Add to favorites')}
            aria-pressed={favorite}
            title={favorite ? t('Retirer des favoris', 'Remove from favorites') : t('Ajouter aux favoris', 'Add to favorites')}
          >
            <Heart size={17} fill={favorite ? 'currentColor' : 'none'} />
          </button>

          <button
            type="button"
            className="media-viewer-action media-viewer-delete"
            onClick={() => void handleDelete()}
            disabled={deleting}
            aria-label={deleting ? t('Suppression en cours', 'Deleting') : t('Mettre à la corbeille', 'Move to trash')}
            title={deleting ? t('Suppression en cours', 'Deleting') : t('Mettre à la corbeille', 'Move to trash')}
          >
            <Trash2 size={17} />
          </button>
        </div>

        {shareUrl && (
          <div className="share-link-result">
            <label htmlFor="media-share-url">{t('Lien valable 7 jours ou 10 vues', 'Link valid for 7 days or 10 views')}</label>
            <div>
              <input id="media-share-url" className="glass-input" readOnly value={shareUrl} />
              <button
                type="button"
                className="glass-button"
                onClick={() => void handleCopyShareUrl()}
                aria-label={t('Copier le lien', 'Copy link')}
                title={t('Copier le lien', 'Copy link')}
              >
                <Copy size={15} />
              </button>
            </div>
          </div>
        )}
        {shareError && <p className="text-secondary" role="alert">{shareError}</p>}

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
