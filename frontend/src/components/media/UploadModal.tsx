import {
  useEffect,
  useState,
  type ChangeEvent,
} from 'react'

import { Modal } from '../ui/Modal'
import { uploadMedia } from '../../services/media'
import { getGroups } from '../../services/groups'
import type { Group } from '../../types/group'

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

  const [error, setError] =
    useState<string | null>(null)

  const [success, setSuccess] =
    useState(false)

  useEffect(() => {
    if (!open) {
      return
    }

    setError(null)
    setSuccess(false)

    async function loadGroups() {
      try {
        setLoadingGroups(true)

        const result =
          await getGroups()

        setGroups(result)
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Impossible de charger les groupes.',
        )
      } finally {
        setLoadingGroups(false)
      }
    }

    loadGroups()
  }, [open])

  const handleFileChange = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const selected =
      event.target.files
        ? Array.from(event.target.files)
        : []

      setFiles(selected)
      setError(null)
      setSuccess(false)
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

      for (const file of files) {
        await uploadMedia(
          file,
          visibility,
          groupId ?? undefined,
        )
       }    

      setSuccess(true)
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
      title="Importer un média"
      onClose={uploading ? () => {} : onClose}
    >
      <div className="upload-modal">
        <label className="upload-dropzone">
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
               ? `${files.length} fichier(s) sélectionné(s)`
               : 'Choisir une photo ou une vidéo'}
          </strong>

          <span className="text-secondary">
            Images et vidéos
          </span>
        </label>

        {files.length > 0 && (
  <         div className="upload-file-info glass">
              {files.map((file) => (
                <div key={file.name}>
                <strong>{file.name}</strong>

                <span className="text-secondary">
                  {formatFileSize(file.size)}
                </span>
            </div>
           ))}
         </div>
       )}

        <div className="upload-section">
          <span className="dashboard-eyebrow">
            VISIBILITÉ
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
                <strong>Privé</strong>
                <small>
                  Seulement toi
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
                <strong>Groupe</strong>
                <small>
                  Partager avec un groupe
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
              GROUPE
            </label>

            {loadingGroups ? (
              <div className="upload-loading">
                Chargement des groupes...
              </div>
            ) : groups.length === 0 ? (
              <div className="upload-no-groups">
                Tu n’as encore aucun groupe.
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
                  Sélectionner un groupe
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
            Média importé avec succès ✓
          </div>
        )}

        <div className="upload-actions">
          <button
            type="button"
            className="glass-button"
            onClick={onClose}
            disabled={uploading}
          >
            Annuler
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
              ? 'Importation...'
              : 'Importer'}
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
