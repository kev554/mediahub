import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  createAlbum,
  deleteAlbum,
  getAlbumMedia,
  getAlbums,
} from '../services/albums'
import { getMedia } from '../services/media'
import { getGroups } from '../services/groups'

import { AlbumGrid } from '../components/albums/AlbumGrid'
import { MediaGrid } from '../components/media/MediaGrid'
import { TimelineGroupCard } from '../components/timeline/TimelineGroupCard'
import {
  createHolidaySmartAlbums,
  createMonthlySmartAlbums,
  createSeasonSmartAlbums,
  type SmartAlbumGroup,
} from '../lib/smartAlbums'

import type { Album } from '../types/album'
import type { Media } from '../types/media'
import type { Group } from '../types/group'
import { t } from '../lib/i18n'

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

  const [libraryMedia, setLibraryMedia] =
    useState<Media[]>([])

  const [selectedAlbum, setSelectedAlbum] =
    useState<Album | null>(null)

  const [selectedSmartAlbum, setSelectedSmartAlbum] =
    useState<(SmartAlbumGroup & { category: string }) | null>(null)

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

  const [groups, setGroups] =
    useState<Group[]>([])

  const [groupsLoading, setGroupsLoading] =
    useState(false)

  const [groupsError, setGroupsError] =
    useState<string | null>(null)

  const [creating, setCreating] =
    useState(false)

  // ==========================================================
  // CHARGEMENT DES ALBUMS
  // ==========================================================

  async function loadAlbums() {
    try {
      setLoading(true)
      setError(null)

      const albumResult = await getAlbums()
      setAlbums(albumResult)

      try {
        setLibraryMedia(await getMedia(true))
      } catch (mediaError) {
        console.error('Unable to load media for smart albums.', mediaError)
        setError(
          mediaError instanceof Error
            ? mediaError.message
            : t('Impossible de charger les médias des albums automatiques.', 'Unable to load media for smart albums.'),
        )
      }
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

  const monthlyAlbums = useMemo(
    () => createMonthlySmartAlbums(libraryMedia),
    [libraryMedia],
  )
  const seasonalAlbums = useMemo(
    () => createSeasonSmartAlbums(libraryMedia),
    [libraryMedia],
  )
  const holidayAlbums = useMemo(
    () => createHolidaySmartAlbums(libraryMedia),
    [libraryMedia],
  )
  function openSmartAlbum(album: SmartAlbumGroup, category: string) {
    setSelectedSmartAlbum({ ...album, category })
  }

  useEffect(() => {
    if (!modalOpen) {
      return
    }

    let active = true

    void getGroups()
      .then((result) => {
        if (active) {
          setGroups(result)
        }
      })
      .catch((err: unknown) => {
        if (active) {
          setGroupsError(
            err instanceof Error
              ? err.message
              : t('Impossible de charger les groupes.', 'Unable to load groups.'),
          )
        }
      })
      .finally(() => {
        if (active) {
          setGroupsLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [modalOpen])

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
    setSelectedSmartAlbum(null)
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
    setGroupsError(null)
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
              ← {t('Retour aux albums', 'Back to albums')}
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
                  t('Aucune description.', 'No description.')}
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
                ? `👥 ${t('Groupe', 'Group')}`
                : `🔒 ${t('Privé', 'Private')}`}
            </span>

            <span>
              {albumMedia.length}{' '}
              {albumMedia.length > 1
                ? t('médias', 'items')
                : t('média', 'item')}
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
              {t('Chargement de l’album…', 'Loading album…')}
            </h3>

            <p className="text-secondary">
              {t('Récupération des médias.', 'Loading media.')}
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

  if (selectedSmartAlbum) {
    return (
      <div className="albums-page fade-in">
        <section className="page-section-header">
          <div>
            <button type="button" className="glass-button" onClick={handleBack}>
              ← {t('Retour aux albums', 'Back to albums')}
            </button>
            <div style={{ marginTop: '1.5rem' }}>
              <span className="dashboard-eyebrow">
                {selectedSmartAlbum.category}
              </span>
              <h1>{selectedSmartAlbum.title}</h1>
              <p className="text-secondary">
                {t(
                  'Cet album se met à jour automatiquement selon les dates de tes médias.',
                  'This album updates automatically from your media dates.',
                )}
              </p>
            </div>
          </div>
          <div className="album-detail-meta">
            <span>
              {selectedSmartAlbum.media.length}{' '}
              {t('médias', 'items')}
            </span>
          </div>
        </section>
        <MediaGrid
          media={selectedSmartAlbum.media}
          onMediaClick={onMediaClick}
        />
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
            {t('ORGANISATION', 'ORGANIZATION')}
          </span>

          <h1>{t('Albums', 'Albums')}</h1>

          <p className="text-secondary">
            {t('Organise tes photos et vidéos par année et par événement.', 'Organize your photos and videos by year and event.')}
          </p>

        </div>

        <button
          type="button"
          className="accent-button"
          onClick={() => {
            setError(null)
            setGroups([])
            setGroupsError(null)
            setGroupsLoading(true)
            setModalOpen(true)
          }}
        >
          <span>＋</span>
          <span>{t('Créer un album', 'Create album')}</span>
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
            {t('Chargement des albums…', 'Loading albums…')}
          </h3>

          <p className="text-secondary">
            {t('Récupération de ta bibliothèque.', 'Loading your library.')}
          </p>

        </div>
      ) : (
        <>
          <section className="smart-albums-section">
            <div className="smart-albums-heading">
              <div>
                <span className="dashboard-eyebrow">
                  {t('PÉRIODES DE L’ANNÉE', 'SEASONS')}
                </span>
                <h2>{t('Albums par saison', 'Seasonal albums')}</h2>
              </div>
            </div>
            {seasonalAlbums.length > 0 ? (
              <div className="timeline-years">
                {seasonalAlbums.map((smartAlbum) => (
                  <TimelineGroupCard
                    key={smartAlbum.id}
                    title={smartAlbum.title}
                    media={smartAlbum.media}
                    subtitle={`${smartAlbum.media.length} ${t('souvenirs', 'memories')}`}
                    onClick={() => openSmartAlbum(
                      smartAlbum,
                      t('ALBUM SAISONNIER', 'SEASONAL ALBUM'),
                    )}
                  />
                ))}
              </div>
            ) : <p className="text-secondary">{t('Les albums saisonniers apparaîtront avec tes médias.', 'Seasonal albums will appear as you add media.')}</p>}
          </section>

          <section className="smart-albums-section">
            <div className="smart-albums-heading">
              <div>
                <span className="dashboard-eyebrow">
                  {t('CALENDRIERS CAMEROUNAIS ET RUSSES', 'CAMEROONIAN AND RUSSIAN CALENDARS')}
                </span>
                <h2>{t('Fêtes et jours marquants', 'Holidays and special days')}</h2>
              </div>
            </div>
            {holidayAlbums.length > 0 ? (
              <div className="timeline-years">
                {holidayAlbums.map((smartAlbum) => (
                  <TimelineGroupCard
                    key={smartAlbum.id}
                    title={smartAlbum.title}
                    media={smartAlbum.media}
                    subtitle={`${smartAlbum.media.length} ${t('souvenirs', 'memories')}`}
                    onClick={() => openSmartAlbum(
                      smartAlbum,
                      t('ALBUM DE FÊTE', 'HOLIDAY ALBUM'),
                    )}
                  />
                ))}
              </div>
            ) : <p className="text-secondary">{t('Aucun média trouvé pour ces jours de fête.', 'No media found for these holidays yet.')}</p>}
          </section>

          <section className="smart-albums-section">
            <div className="smart-albums-heading">
              <div>
                <span className="dashboard-eyebrow">
                  {t('DATES', 'DATES')}
                </span>
                <h2>{t('Albums par mois', 'Albums by month')}</h2>
              </div>
            </div>
            {monthlyAlbums.length > 0 ? (
              <div className="timeline-years">
                {monthlyAlbums.map((smartAlbum) => (
                  <TimelineGroupCard
                    key={smartAlbum.id}
                    title={smartAlbum.title}
                    media={smartAlbum.media}
                    subtitle={`${smartAlbum.media.length} ${t('souvenirs', 'memories')}`}
                    onClick={() => openSmartAlbum(
                      smartAlbum,
                      t('ALBUM MENSUEL', 'MONTHLY ALBUM'),
                    )}
                  />
                ))}
              </div>
            ) : (
              <div className="glass media-grid-empty">
                {t(
                  'Ajoute des médias pour créer automatiquement tes premiers albums.',
                  'Add media to automatically create your first albums.',
                )}
              </div>
            )}
          </section>

          <section className="manual-albums-section">
            <div className="smart-albums-heading">
              <div>
                <span className="dashboard-eyebrow">
                  {t('PERSONNALISÉS', 'CUSTOM')}
                </span>
                <h2>{t('Albums manuels', 'Manual albums')}</h2>
              </div>
            </div>
            {albums.length > 0 ? (
              <AlbumGrid
                albums={albums}
                onAlbumClick={handleAlbumClick}
                onDelete={handleDelete}
              />
            ) : (
              <p className="text-secondary">
                {t(
                  'Aucun album manuel pour le moment. Tu peux en créer un avec le bouton ci-dessus.',
                  'No manual albums yet. Use the button above to create one.',
                )}
              </p>
            )}
          </section>
        </>
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
                  {t('NOUVEL ALBUM', 'NEW ALBUM')}
                </span>

                <h2>
                  {t('Créer un album', 'Create album')}
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
                {t('Nom', 'Name')}

                <input
                  value={name}
                  onChange={(event) =>
                    setName(
                      event.target.value,
                    )
                  }
                  placeholder={t('Ex. Vacances 2026', 'e.g. Summer trip 2026')}
                  maxLength={150}
                  required
                />
              </label>

              {/* DESCRIPTION */}

              <label>
                {t('Description', 'Description')}

                <textarea
                  value={description}
                  onChange={(event) =>
                    setDescription(
                      event.target.value,
                    )
                  }
                  placeholder={t('Description de l’album…', 'Album description…')}
                  maxLength={5000}
                  rows={4}
                />
              </label>

              {/* ANNEE */}

              <label>
                {t('Année', 'Year')}

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
                  {t('Visibilité', 'Visibility')}
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
                    🔒 {t('Privé', 'Private')}
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
                    👥 {t('Groupe', 'Group')}
                  </button>

                </div>

              </div>

              {/* GROUPE */}

              {visibility === 'group' && (
                <label>

                  {t('Groupe', 'Group')}

                  <select
                    value={groupId}
                    onChange={(event) =>
                      setGroupId(
                        event.target.value,
                      )
                    }
                    disabled={groupsLoading || groups.length === 0}
                    required
                  >
                    <option value="">
                      {groupsLoading
                        ? t('Chargement des groupes…', 'Loading groups…')
                        : t('Sélectionner un groupe', 'Select a group')}
                    </option>
                    {groups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                  </select>

                  <small className="text-secondary">
                    {groupsError ||
                      (groupsLoading
                        ? t('Récupération des groupes disponibles.', 'Loading available groups.')
                        : groups.length === 0
                          ? t('Aucun groupe disponible. Crée ou rejoins un groupe avant de partager cet album.', 'No groups available. Create or join a group before sharing this album.')
                          : t('Choisis le groupe avec lequel partager cet album.', 'Choose the group to share this album with.'))}
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
                  {t('Annuler', 'Cancel')}
                </button>

                <button
                  type="submit"
                  className="accent-button"
                  disabled={
                    creating ||
                    !name.trim() ||
                    (
                      visibility === 'group' &&
                      (!groupId.trim() || groupsLoading || groups.length === 0)
                    )
                  }
                >
                  {creating
                    ? t('Création…', 'Creating…')
                    : t('Créer l’album', 'Create album')}
                </button>

              </div>

            </form>

          </div>

        </div>
      )}

    </div>
  )
}
