import {
  useEffect,
  useState,
} from 'react'

import {
  createAlbum,
  deleteAlbum,
  getAlbumMedia,
  getAlbums,
} from '../services/albums'

import { AlbumGrid } from '../components/albums/AlbumGrid'
import { MediaGrid } from '../components/media/MediaGrid'

import type { Album } from '../types/album'
import type { Media } from '../types/media'

type AlbumsProps = {
  refreshKey?: number
  onMediaClick?: (
    media: Media,
    mediaList: Media[],
  ) => void
}

type AlbumMedia = {
  id: number
  original_name: string
  media_type: 'image' | 'video'
  mime_type: string
  file_size: number
  width: number | null
  height: number | null
  duration: number | null
  taken_at: string | null
  uploaded_at: string
  is_favorite: boolean
  thumbnail_url: string | null
  file_url: string | null
}

export function Albums({
  refreshKey = 0,
  onMediaClick,
}: AlbumsProps) {
  const [albums, setAlbums] =
    useState<Album[]>([])

  const [selectedAlbum, setSelectedAlbum] =
    useState<Album | null>(null)

  const [albumMedia, setAlbumMedia] =
    useState<Media[]>([])

  const [loading, setLoading] =
    useState(true)

  const [mediaLoading, setMediaLoading] =
    useState(false)

  const [error, setError] =
    useState<string | null>(null)

  const [modalOpen, setModalOpen] =
    useState(false)

  const [name, setName] =
    useState('')

  const [description, setDescription] =
    useState('')

  const [year, setYear] =
    useState(new Date().getFullYear())

  const [visibility, setVisibility] =
    useState<'private' | 'group'>('private')

  const [groupId, setGroupId] =
    useState('')

  const [creating, setCreating] =
    useState(false)

  // ==========================================================
  // CHARGEMENT DES ALBUMS
  // ==========================================================

  async function loadAlbums() {
    try {
      setLoading(true)
      setError(null)

      const result = await getAlbums()

      setAlbums(result)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible de charger les albums.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAlbums()
  }, [refreshKey])

  // ==========================================================
  // OUVRIR UN ALBUM
  // ==========================================================

  async function handleAlbumClick(
    album: Album,
  ) {
    try {
      setSelectedAlbum(album)
      setAlbumMedia([])
      setMediaLoading(true)
      setError(null)

      const result =
        await getAlbumMedia(album.id)

      const media: Media[] =
        (result as AlbumMedia[]).map(
          (item) => ({
            id: item.id,

            filename:
              item.original_name,

            original_name:
              item.original_name,

            media_type:
              item.media_type,

            mime_type:
              item.mime_type,

            file_size:
              item.file_size,

            width:
              item.width,

            height:
              item.height,

            duration:
              item.duration,

            taken_at:
              item.taken_at,

            uploaded_at:
              item.uploaded_at,

            album_id:
              album.id,

            visibility:
              album.visibility,

            group_id:
              album.group_id,

            is_favorite:
              item.is_favorite,

            thumbnail_url:
              item.thumbnail_url,

            file_url:
              item.file_url,
          }),
        )

      setAlbumMedia(media)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible de charger les médias de cet album.',
      )
    } finally {
      setMediaLoading(false)
    }
  }

  // ==========================================================
  // RETOUR
  // ==========================================================

  function handleBack() {
    setSelectedAlbum(null)
    setAlbumMedia([])
    setError(null)
  }

  // ==========================================================
  // CREATION
  // ==========================================================

  async function handleCreate(
    event: React.FormEvent,
  ) {
    event.preventDefault()

    if (!name.trim()) {
      return
    }

    if (
      visibility === 'group' &&
      !groupId.trim()
    ) {
      setError(
        'Indique l’identifiant du groupe.',
      )
      return
    }

    try {
      setCreating(true)
      setError(null)

      const album = await createAlbum({
        name: name.trim(),

        description:
          description.trim() || undefined,

        year,

        visibility,

        group_id:
          visibility === 'group'
            ? Number(groupId)
            : null,
      })

      setAlbums((current) => [
        album,
        ...current,
      ])

      resetCreateForm()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible de créer l’album.',
      )
    } finally {
      setCreating(false)
    }
  }

  function resetCreateForm() {
    setName('')
    setDescription('')
    setYear(new Date().getFullYear())
    setVisibility('private')
    setGroupId('')
    setModalOpen(false)
  }

  // ==========================================================
  // SUPPRESSION
  // ==========================================================

  async function handleDelete(
    album: Album,
  ) {
    const confirmed =
      window.confirm(
        `Supprimer l’album « ${album.name} » ?`,
      )

    if (!confirmed) {
      return
    }

    try {
      setError(null)

      await deleteAlbum(album.id)

      setAlbums((current) =>
        current.filter(
          (item) => item.id !== album.id,
        ),
      )

      if (
        selectedAlbum?.id === album.id
      ) {
        handleBack()
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible de supprimer l’album.',
      )
    }
  }

  // ==========================================================
  // DETAIL ALBUM
  // ==========================================================

  if (selectedAlbum) {
    return (
      <div className="albums-page fade-in">

        <section className="page-section-header">

          <div>

            <button
              type="button"
              className="glass-button"
              onClick={handleBack}
            >
              ← Retour aux albums
            </button>

            <div
              style={{
                marginTop: '1.5rem',
              }}
            >

              <span className="dashboard-eyebrow">
                ALBUM
              </span>

              <h1>
                {selectedAlbum.name}
              </h1>

              <p className="text-secondary">
                {selectedAlbum.description ||
                  'Aucune description.'}
              </p>

            </div>

          </div>

          <div className="album-detail-meta">

            <span>
              📅 {selectedAlbum.year}
            </span>

            <span>
              {selectedAlbum.visibility ===
              'group'
                ? '👥 Groupe'
                : '🔒 Privé'}
            </span>

            <span>
              {albumMedia.length}{' '}
              {albumMedia.length > 1
                ? 'médias'
                : 'média'}
            </span>

          </div>

        </section>

        {error && (
          <div className="glass album-error">
            {error}
          </div>
        )}

        {mediaLoading ? (
          <div className="media-grid-empty glass">

            <div className="media-grid-empty-icon">
              ◌
            </div>

            <h3>
              Chargement de l’album...
            </h3>

            <p className="text-secondary">
              Récupération des médias.
            </p>

          </div>
        ) : (
          <MediaGrid
            media={albumMedia}
            onMediaClick={onMediaClick}
          />
        )}

      </div>
    )
  }

  // ==========================================================
  // LISTE DES ALBUMS
  // ==========================================================

  return (
    <div className="albums-page fade-in">

      <section className="page-section-header">

        <div>

          <span className="dashboard-eyebrow">
            ORGANISATION
          </span>

          <h1>Albums</h1>

          <p className="text-secondary">
            Organise tes photos et vidéos
            par année et par événement.
          </p>

        </div>

        <button
          type="button"
          className="accent-button"
          onClick={() => {
            setError(null)
            setModalOpen(true)
          }}
        >
          <span>＋</span>
          <span>Créer un album</span>
        </button>

      </section>

      {error && (
        <div className="glass album-error">
          {error}
        </div>
      )}

      {loading ? (
        <div className="media-grid-empty glass">

          <div className="media-grid-empty-icon">
            ◌
          </div>

          <h3>
            Chargement des albums...
          </h3>

          <p className="text-secondary">
            Récupération de ta bibliothèque.
          </p>

        </div>
      ) : (
        <AlbumGrid
          albums={albums}
          onAlbumClick={
            handleAlbumClick
          }
          onDelete={handleDelete}
        />
      )}

      {/* ======================================================
          MODAL CREATION
      ====================================================== */}

      {modalOpen && (
        <div
          className="modal-backdrop"
          onClick={() =>
            !creating &&
            setModalOpen(false)
          }
        >

          <div
            className="glass album-create-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >

            <div className="modal-header">

              <div>

                <span className="dashboard-eyebrow">
                  NOUVEL ALBUM
                </span>

                <h2>
                  Créer un album
                </h2>

              </div>

              <button
                type="button"
                className="glass-button"
                onClick={() =>
                  !creating &&
                  setModalOpen(false)
                }
                disabled={creating}
              >
                ×
              </button>

            </div>

            <form
              onSubmit={handleCreate}
              className="album-form"
            >

              {/* NOM */}

              <label>
                Nom

                <input
                  value={name}
                  onChange={(event) =>
                    setName(
                      event.target.value,
                    )
                  }
                  placeholder="Ex. Vacances 2026"
                  maxLength={150}
                  required
                />
              </label>

              {/* DESCRIPTION */}

              <label>
                Description

                <textarea
                  value={description}
                  onChange={(event) =>
                    setDescription(
                      event.target.value,
                    )
                  }
                  placeholder="Description de l'album..."
                  maxLength={5000}
                  rows={4}
                />
              </label>

              {/* ANNEE */}

              <label>
                Année

                <input
                  type="number"
                  value={year}
                  onChange={(event) =>
                    setYear(
                      Number(
                        event.target.value,
                      ),
                    )
                  }
                  min={1900}
                  max={2100}
                  required
                />
              </label>

              {/* VISIBILITE */}

              <div className="album-visibility">

                <span>
                  Visibilité
                </span>

                <div className="album-visibility-options">

                  <button
                    type="button"
                    className={
                      visibility === 'private'
                        ? 'glass-button active'
                        : 'glass-button'
                    }
                    onClick={() =>
                      setVisibility(
                        'private',
                      )
                    }
                  >
                    🔒 Privé
                  </button>

                  <button
                    type="button"
                    className={
                      visibility === 'group'
                        ? 'glass-button active'
                        : 'glass-button'
                    }
                    onClick={() =>
                      setVisibility(
                        'group',
                      )
                    }
                  >
                    👥 Groupe
                  </button>

                </div>

              </div>

              {/* GROUPE */}

              {visibility === 'group' && (
                <label>

                  ID du groupe

                  <input
                    type="number"
                    value={groupId}
                    onChange={(event) =>
                      setGroupId(
                        event.target.value,
                      )
                    }
                    placeholder="Ex. 1"
                    min={1}
                    required
                  />

                  <small className="text-secondary">
                    Tu dois être membre du groupe
                    sélectionné.
                  </small>

                </label>
              )}

              {/* ACTIONS */}

              <div className="album-form-actions">

                <button
                  type="button"
                  className="glass-button"
                  onClick={resetCreateForm}
                  disabled={creating}
                >
                  Annuler
                </button>

                <button
                  type="submit"
                  className="accent-button"
                  disabled={
                    creating ||
                    !name.trim() ||
                    (
                      visibility === 'group' &&
                      !groupId.trim()
                    )
                  }
                >
                  {creating
                    ? 'Création...'
                    : 'Créer l’album'}
                </button>

              </div>

            </form>

          </div>

        </div>
      )}

    </div>
  )
}
