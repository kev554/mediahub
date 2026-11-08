import { useState } from 'react'
import { Copy, ScanSearch, Trash2 } from 'lucide-react'

import { MediaCard } from '../components/media/MediaCard'
import {
  deleteMedia,
  getDuplicateMedia,
} from '../services/media'
import type { DuplicateMediaGroup } from '../services/media'
import type { Media } from '../types/media'
import { t } from '../lib/i18n'

type DuplicatesProps = {
  onMediaClick?: (media: Media, mediaList: Media[]) => void
  onMediaDeleted?: () => void
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function Duplicates({ onMediaClick, onMediaDeleted }: DuplicatesProps) {
  const [groups, setGroups] = useState<DuplicateMediaGroup[]>([])
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [scanned, setScanned] = useState(false)

  async function scan() {
    try {
      setScanning(true)
      setError(null)
      setScanned(false)
      setGroups(await getDuplicateMedia())
      setScanned(true)
    } catch (scanError) {
      console.error('Unable to scan for duplicate media.', scanError)
      setError(
        scanError instanceof Error
          ? scanError.message
          : t('Analyse des doublons impossible.', 'Unable to scan for duplicates.'),
      )
    } finally {
      setScanning(false)
    }
  }

  async function moveToTrash(media: Media) {
    if (!window.confirm(t(
      `Mettre « ${media.original_name} » à la corbeille ?`,
      `Move "${media.original_name}" to trash?`,
    ))) return

    try {
      setDeletingId(media.id)
      await deleteMedia(media.id)
      setGroups((current) =>
        current
          .map((group) => ({
            ...group,
            items: group.items.filter((item) => item.id !== media.id),
          }))
          .filter((group) => group.items.length > 1),
      )
      onMediaDeleted?.()
    } catch (deleteError) {
      console.error('Unable to move duplicate media to trash.', deleteError)
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : t('Impossible de déplacer ce média vers la corbeille.', 'Unable to move media to trash.'),
      )
    } finally {
      setDeletingId(null)
    }
  }

  const duplicateCount = groups.reduce(
    (total, group) => total + group.items.length,
    0,
  )

  return (
    <section className="page-section duplicates-page">
      <header className="page-section-header">
        <div>
          <span className="dashboard-eyebrow">{t('ESPACE DE STOCKAGE', 'STORAGE')}</span>
          <h1>{t('Doublons', 'Duplicates')}</h1>
          <p>{t(
            'Recherche les fichiers strictement identiques dans tes médias personnels.',
            'Find byte-for-byte identical files in your personal media.',
          )}</p>
        </div>
        <button type="button" className="accent-button" onClick={() => void scan()} disabled={scanning}>
          <ScanSearch size={17} aria-hidden="true" />
          {scanning
            ? t('Analyse en cours…', 'Scanning…')
            : t('Analyser', 'Scan')}
        </button>
      </header>

      <p className="duplicates-notice">
        <Copy size={16} aria-hidden="true" />
        {t(
          'L’analyse peut prendre du temps si ta bibliothèque est volumineuse. Rien ne sera supprimé automatiquement : choisis toi-même les copies à mettre à la corbeille.',
          'Scanning may take time for a large library. Nothing is deleted automatically; choose which copies to move to trash.',
        )}
      </p>

      {error && <div className="duplicates-error" role="alert">{error}</div>}

      {scanned && groups.length === 0 && (
        <div className="glass media-grid-empty">
          {t('Aucun doublon exact trouvé.', 'No exact duplicates found.')}
        </div>
      )}

      {groups.length > 0 && (
        <p className="duplicates-summary">
          {t(
            `${groups.length} groupe(s), ${duplicateCount} fichiers concernés`,
            `${groups.length} group(s), ${duplicateCount} files`,
          )}
        </p>
      )}

      <div className="duplicates-groups">
        {groups.map((group, groupIndex) => (
          <article className="duplicates-group glass" key={group.checksum}>
            <header>
              <div>
                <h2>{t('Copies identiques', 'Identical copies')} {groupIndex + 1}</h2>
                <span>{group.items.length} {t('fichiers', 'files')} · {formatFileSize(group.file_size)}</span>
              </div>
            </header>
            <div className="media-grid">
              {group.items.map((media) => (
                <div className="duplicate-media-item" key={media.id}>
                  <MediaCard
                    media={media}
                    mediaList={group.items}
                    onClick={onMediaClick}
                  />
                  <button
                    type="button"
                    className="duplicate-trash-button"
                    disabled={deletingId === media.id}
                    onClick={() => void moveToTrash(media)}
                  >
                    <Trash2 size={15} aria-hidden="true" />
                    {deletingId === media.id
                      ? t('Déplacement…', 'Moving…')
                      : t('Mettre à la corbeille', 'Move to trash')}
                  </button>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
