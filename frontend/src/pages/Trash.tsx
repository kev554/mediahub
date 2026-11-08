import { useCallback, useEffect, useState } from 'react'

import {
  emptyTrash,
  getTrash,
  permanentlyDeleteTrashedMedia,
  restoreTrashedMedia,
  type TrashItem,
} from '../services/media'
import { t } from '../lib/i18n'

const PAGE_SIZE = 50

export function Trash() {
  const [items, setItems] = useState<TrashItem[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [hasNext, setHasNext] = useState(false)
  const [retentionDays, setRetentionDays] = useState(30)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [processingId, setProcessingId] = useState<number | null>(null)
  const [emptying, setEmptying] = useState(false)

  const loadTrash = useCallback(async (requestedPage: number) => {
    try {
      setError(null)
      const result = await getTrash(requestedPage, PAGE_SIZE)
      setItems(result.items)
      setTotal(result.total)
      setPage(result.page)
      setHasNext(result.has_next)
      setRetentionDays(result.retention_days)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible de charger la corbeille.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadTrash(page)
  }, [loadTrash, page])

  async function handleRestore(item: TrashItem) {
    try {
      setProcessingId(item.id)
      setLoading(true)
      setError(null)
      await restoreTrashedMedia(item.id)
      await loadTrash(page)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible de restaurer ce média.',
      )
    } finally {
      setProcessingId(null)
    }
  }

  async function handlePermanentDelete(item: TrashItem) {
    if (!window.confirm(`Supprimer définitivement « ${item.original_name} » ? Cette action est irréversible.`)) {
      return
    }

    try {
      setProcessingId(item.id)
      setLoading(true)
      setError(null)
      await permanentlyDeleteTrashedMedia(item.id)
      await loadTrash(page)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible de supprimer définitivement ce média.',
      )
    } finally {
      setProcessingId(null)
    }
  }

  async function handleEmptyTrash() {
    if (!window.confirm(`Supprimer définitivement les ${total} éléments de la corbeille ? Cette action est irréversible.`)) {
      return
    }

    try {
      setEmptying(true)
      setLoading(true)
      setError(null)
      await emptyTrash()
      setPage(1)
      await loadTrash(1)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible de vider la corbeille.',
      )
    } finally {
      setEmptying(false)
    }
  }

  return (
    <section className="page-section trash-page">
      <div className="page-header">
        <div>
          <span className="dashboard-eyebrow">{t('BIBLIOTHÈQUE', 'LIBRARY')}</span>
          <h1>{t('Corbeille', 'Trash')}</h1>
          <p className="text-secondary">
          {t('Les médias supprimés sont conservés pendant', 'Deleted media is kept for')} {retentionDays} {t('jours avant leur suppression définitive.', 'days before permanent deletion.')}
          </p>
        </div>
        {total > 0 && (
          <button
            type="button"
            className="glass-button danger"
            disabled={emptying}
            onClick={() => void handleEmptyTrash()}
          >
            {emptying ? t('Suppression…', 'Deleting…') : t('Vider la corbeille', 'Empty trash')}
          </button>
        )}
      </div>

      {error && (
        <div className="glass groups-error" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <div className="glass groups-loading" role="status">
          {t('Chargement de la corbeille…', 'Loading trash…')}
        </div>
      ) : items.length === 0 ? (
        <div className="glass groups-empty">
          <h2>{t('La corbeille est vide', 'Trash is empty')}</h2>
          <p className="text-secondary">
            {t('Les médias supprimés apparaîtront ici.', 'Deleted media will appear here.')}
          </p>
        </div>
      ) : (
        <>
          <div className="glass trash-list">
            {items.map((item) => (
              <article className="trash-item" key={item.id}>
                <div className="trash-item-info">
                  <strong>{item.original_name}</strong>
                  <span className="text-secondary">
                    {item.media_type === 'image' ? t('Photo', 'Photo') : t('Vidéo', 'Video')}
                    {' · '}
                    {t('Supprimé le', 'Deleted')}{' '}
                    {new Date(item.deleted_at).toLocaleDateString(document.documentElement.lang || 'fr')}
                    {' · '}
                    {t('Suppression prévue le', 'Scheduled for')}{' '}
                    {new Date(item.purge_after).toLocaleDateString(document.documentElement.lang || 'fr')}
                  </span>
                </div>
                <div className="trash-item-actions">
                  <button
                    type="button"
                    className="glass-button"
                    disabled={processingId === item.id}
                    onClick={() => void handleRestore(item)}
                  >
                    {t('Restaurer', 'Restore')}
                  </button>
                  <button
                    type="button"
                    className="glass-button danger"
                    disabled={processingId === item.id}
                    onClick={() => void handlePermanentDelete(item)}
                  >
                    {t('Supprimer définitivement', 'Delete permanently')}
                  </button>
                </div>
              </article>
            ))}
          </div>

          <div className="trash-pagination">
            <span className="text-secondary">
              {t('Page', 'Page')} {page} · {total} {t('élément', 'item')}{total === 1 ? '' : 's'}
            </span>
            <div>
              <button
                type="button"
                className="glass-button"
                disabled={page <= 1 || loading}
                onClick={() => setPage((current) => current - 1)}
              >
                {t('Précédent', 'Previous')}
              </button>
              <button
                type="button"
                className="glass-button"
                disabled={!hasNext || loading}
                onClick={() => setPage((current) => current + 1)}
              >
                {t('Suivant', 'Next')}
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  )
}
