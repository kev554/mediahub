import {
  useEffect,
  useState,
  type ChangeEvent,
  type DragEvent,
} from 'react'

import { Modal } from '../ui/Modal'
import { uploadMediaResumable } from '../../services/media'
import { getGroups } from '../../services/groups'
import { getUserPreferences } from '../../services/users'
import type { Group } from '../../types/group'
import { t } from '../../lib/i18n'

type UploadModalProps = {
  open: boolean
  onClose: () => void
  onUploaded?: () => void
}

type Visibility = 'private' | 'group'

export function UploadModal({
  open,
  onClose,
  onUploaded,
}: UploadModalProps) {
  const [files, setFiles] =
    useState<File[]>([])

  const [visibility, setVisibility] =
    useState<Visibility>('private')

  const [groupId, setGroupId] =
    useState<number | null>(null)

  const [groups, setGroups] =
    useState<Group[]>([])

  const [loadingGroups, setLoadingGroups] =
    useState(false)

  const [uploading, setUploading] =
    useState(false)

  const [uploadProgress, setUploadProgress] =
    useState(0)

  const [currentFile, setCurrentFile] =
    useState('')

  const [dragActive, setDragActive] =
    useState(false)

  const [error, setError] =
    useState<string | null>(null)

  const [success, setSuccess] =
    useState(false)

  useEffect(() => {
    if (!open) {
      return
    }

    let active = true

    setError(null)
    setSuccess(false)
    setLoadingGroups(true)

    async function loadGroups() {
      try {
        const result = await getGroups()
        if (!active) {
          return
        }
        setGroups(result)

        try {
          const preferences = await getUserPreferences()
          if (active) {
            setVisibility(preferences.default_visibility)
          }
        } catch (err) {
          if (active) {
            setError(
              err instanceof Error
                ? `Préférences indisponibles : ${err.message}`
                : 'Préférences indisponibles.',
            )
          }
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : 'Impossible de charger les groupes.',
          )
        }
      } finally {
        if (active) {
          setLoadingGroups(false)
        }
      }
    }

    void loadGroups()

    return () => {
      active = false
    }
  }, [open])

  const addFiles = (selected: File[]) => {
    const supported = selected.filter((file) =>
      file.type.startsWith('image/') ||
      file.type.startsWith('video/'),
    )

    if (supported.length !== selected.length) {
      setError(
        t(
          'Seuls les fichiers image et vidéo sont acceptés.',
          'Only image and video files are supported.',
        ),
      )
    } else {
      setError(null)
    }

    setFiles(supported)
    setSuccess(false)
  }

  const handleFileChange = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    addFiles(
      event.target.files
        ? Array.from(event.target.files)
        : [],
    )
    event.target.value = ''
  }

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    setDragActive(false)

    if (!uploading) {
      addFiles(Array.from(event.dataTransfer.files))
    }
  }

  const handleVisibilityChange = (
    value: Visibility,
  ) => {
    setVisibility(value)

    if (value === 'private') {
      setGroupId(null)
    }
  }

  const handleUpload = async () => {
    if (files.length === 0){
      setError(
        'Sélectionne un fichier avant de continuer.',
      )
      return
    }

    if (
      visibility === 'group' &&
      groupId === null
    ) {
      setError(
        'Sélectionne le groupe avec lequel partager le média.',
      )
      return
    }

    try {
      setUploading(true)
      setError(null)
      setSuccess(false)

      setUploadProgress(0)
      for (const [index, file] of files.entries()) {
        setCurrentFile(file.name)
        await uploadMediaResumable(
          file,
          visibility,
          groupId ?? undefined,
          (uploadedBytes, totalBytes) => {
            const fileProgress = totalBytes > 0
              ? uploadedBytes / totalBytes
              : 1
            setUploadProgress(
              Math.round(((index + fileProgress) / files.length) * 100),
            )
          },
        )
      }

      setSuccess(true)
      setUploadProgress(100)
      setCurrentFile('')
      setFiles([])
      setVisibility('private')
      setGroupId(null)

      onUploaded?.()

      setTimeout(() => {
        onClose()
      }, 700)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible d’importer le média.',
      )
    } finally {
      setUploading(false)
    }
  }

  return (
    <Modal
      open={open}
      title={t('Importer un média', 'Upload media')}
      onClose={uploading ? () => {} : onClose}
    >
      <div className="upload-modal">
        <label
          className={`upload-dropzone ${dragActive ? 'drag-active' : ''}`}
          onDragOver={(event) => {
            event.preventDefault()
            if (!uploading) {
              setDragActive(true)
            }
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
        >
          <input
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={handleFileChange}
            disabled={uploading}
          />

          <span className="upload-dropzone-icon">
            ↑
          </span>

          <strong>
            {files.length > 0
               ? t(`${files.length} fichier(s) sélectionné(s)`, `${files.length} file(s) selected`)
               : t('Choisir une photo ou une vidéo', 'Choose a photo or video')}
          </strong>

          <span className="text-secondary">
            {t('Images et vidéos · ou glisse-les ici', 'Images and videos · or drop them here')}
          </span>
        </label>

        {files.length > 0 && (
          <div className="upload-file-info glass" aria-live="polite">
            {files.map((file, index) => (
              <div
                key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
              >
                <strong title={file.name}>{file.name}</strong>
                <span className="text-secondary">
                  {formatFileSize(file.size)}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="upload-section">
          <span className="dashboard-eyebrow">
            {t('VISIBILITÉ', 'VISIBILITY')}
          </span>

          <div className="upload-visibility-options">
            <button
              type="button"
              className={
                visibility === 'private'
                  ? 'upload-visibility active'
                  : 'upload-visibility'
              }
              onClick={() =>
                handleVisibilityChange(
                  'private',
                )
              }
              disabled={uploading}
            >
              <span>🔒</span>

              <span>
                <strong>{t('Privé', 'Private')}</strong>
                <small>
                  {t('Seulement toi', 'Only you')}
                </small>
              </span>
            </button>

            <button
              type="button"
              className={
                visibility === 'group'
                  ? 'upload-visibility active'
                  : 'upload-visibility'
              }
              onClick={() =>
                handleVisibilityChange(
                  'group',
                )
              }
              disabled={uploading}
            >
              <span>👥</span>

              <span>
                <strong>{t('Groupe', 'Group')}</strong>
                <small>
                  {t('Partager avec un groupe', 'Share with a group')}
                </small>
              </span>
            </button>
          </div>
        </div>

        {visibility === 'group' && (
          <div className="upload-section">
            <label
              htmlFor="upload-group"
              className="dashboard-eyebrow"
            >
              {t('GROUPE', 'GROUP')}
            </label>

            {loadingGroups ? (
              <div className="upload-loading">
                {t('Chargement des groupes…', 'Loading groups…')}
              </div>
            ) : groups.length === 0 ? (
              <div className="upload-no-groups">
                {t('Tu n’as encore aucun groupe.', 'You are not in any groups yet.')}
              </div>
            ) : (
              <select
                id="upload-group"
                value={groupId ?? ''}
                onChange={(event) =>
                  setGroupId(
                    event.target.value
                      ? Number(
                          event.target.value,
                        )
                      : null,
                  )
                }
                disabled={uploading}
              >
                <option value="">
                  {t('Sélectionner un groupe', 'Select a group')}
                </option>

                {groups.map((group) => (
                  <option
                    key={group.id}
                    value={group.id}
                  >
                    {group.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {error && (
          <div className="upload-message error">
            {error}
          </div>
        )}

        {success && (
          <div className="upload-message success">
            {t('Média importé avec succès ✓', 'Media uploaded successfully ✓')}
          </div>
        )}

        {uploading && (
          <div className="upload-progress">
            <progress
              value={uploadProgress}
              max={100}
              aria-label={t('Progression de l’import', 'Upload progress')}
            />
            <span className="text-secondary">
              {currentFile
                ? `${t('Import en cours :', 'Uploading:')} ${currentFile} · `
                : `${t('Importation reprenable :', 'Resumable upload:')} `}
              {uploadProgress} %
            </span>
          </div>
        )}

        <div className="upload-actions">
          <button
            type="button"
            className="glass-button"
            onClick={onClose}
            disabled={uploading}
          >
            {t('Annuler', 'Cancel')}
          </button>

          <button
            type="button"
            className="accent-button"
            onClick={handleUpload}
            disabled={
              uploading ||
              files.length === 0 ||
              (visibility === 'group' &&
                groupId === null)
            }
          >
            {uploading
              ? t('Importation…', 'Uploading…')
              : t('Importer', 'Upload')}
          </button>
        </div>
      </div>
    </Modal>
  )
}

function formatFileSize(
  bytes: number,
): string {
  if (bytes < 1024) {
    return `${bytes} B`
  }

  if (bytes < 1024 * 1024) {
    return `${(
      bytes / 1024
    ).toFixed(1)} KB`
  }

  if (bytes < 1024 * 1024 * 1024) {
    return `${(
      bytes /
      (1024 * 1024)
    ).toFixed(1)} MB`
  }

  return `${(
    bytes /
    (1024 * 1024 * 1024)
  ).toFixed(1)} GB`
}
