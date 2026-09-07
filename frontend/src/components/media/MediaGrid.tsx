import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import type { Media } from '../../types/media'

import {
  deleteMultipleMedia,
  downloadMedia,
  downloadMultipleMedia,
} from '../../services/media'

import { MediaCard } from './MediaCard'


type MediaGridProps = {
  media: Media[]

  onMediaClick?: (
    media: Media,
    mediaList: Media[],
  ) => void

  onFavorite?: (
    media: Media,
  ) => void
}


export function MediaGrid({
  media,
  onMediaClick,
  onFavorite,
}: MediaGridProps) {

  const [
    selectionMode,
    setSelectionMode,
  ] = useState(false)

  const [
    selectedIds,
    setSelectedIds,
  ] = useState<Set<number>>(
    new Set(),
  )

  const [
    hiddenIds,
    setHiddenIds,
  ] = useState<Set<number>>(
    new Set(),
  )

  const [
    processing,
    setProcessing,
  ] = useState(false)


  // ------------------------------------------------------
  // Nettoyage de la sélection lorsque la liste change
  // ------------------------------------------------------

  useEffect(() => {

    setSelectedIds(
      (current) => {

        const availableIds =
          new Set(
            media.map(
              (item) =>
                item.id,
            ),
          )

        const next =
          new Set<number>()

        current.forEach(
          (id) => {

            if (
              availableIds.has(
                id,
              )
            ) {
              next.add(id)
            }

          },
        )

        return next
      },
    )

  }, [media])


  // ------------------------------------------------------
  // Médias visibles
  // ------------------------------------------------------

  const visibleMedia =
    useMemo(
      () =>
        media.filter(
          (item) =>
            !hiddenIds.has(
              item.id,
            ),
        ),
      [
        media,
        hiddenIds,
      ],
    )


  // ------------------------------------------------------
  // Médias sélectionnés
  // ------------------------------------------------------

  const selectedMedia =
    useMemo(
      () =>
        visibleMedia.filter(
          (item) =>
            selectedIds.has(
              item.id,
            ),
        ),
      [
        visibleMedia,
        selectedIds,
      ],
    )


  // ------------------------------------------------------
  // Sélection d'un média
  // ------------------------------------------------------

  function toggleSelection(
    item: Media,
  ) {

    setSelectedIds(
      (current) => {

        const next =
          new Set(current)

        if (
          next.has(
            item.id,
          )
        ) {

          next.delete(
            item.id,
          )

        } else {

          next.add(
            item.id,
          )

        }

        return next
      },
    )

  }


  // ------------------------------------------------------
  // Tout sélectionner
  // ------------------------------------------------------

  function selectAll() {

    setSelectedIds(
      new Set(
        visibleMedia.map(
          (item) =>
            item.id,
        ),
      ),
    )

  }


  // ------------------------------------------------------
  // Tout désélectionner
  // ------------------------------------------------------

  function clearSelection() {

    setSelectedIds(
      new Set(),
    )

  }


  // ------------------------------------------------------
  // Quitter le mode sélection
  // ------------------------------------------------------

  function exitSelectionMode() {

    setSelectionMode(
      false,
    )

    clearSelection()

  }


  // ------------------------------------------------------
  // Télécharger un média
  // ------------------------------------------------------

  async function handleDownload(
    item: Media,
  ) {

    try {

      await downloadMedia(
        item,
      )

    } catch (error) {

      console.error(
        'Erreur téléchargement média:',
        error,
      )

      window.alert(
        'Impossible de télécharger ce média.',
      )

    }

  }


  // ------------------------------------------------------
  // Télécharger la sélection
  // ------------------------------------------------------

  async function handleDownloadSelected() {

    if (
      selectedMedia.length === 0 ||
      processing
    ) {
      return
    }

    setProcessing(
      true,
    )

    try {

      await downloadMultipleMedia(
        selectedMedia,
      )

    } catch (error) {

      console.error(
        'Erreur téléchargement multiple:',
        error,
      )

      window.alert(
        'Impossible de télécharger un ou plusieurs médias.',
      )

    } finally {

      setProcessing(
        false,
      )

    }

  }


  // ------------------------------------------------------
  // Supprimer la sélection
  // ------------------------------------------------------

  async function handleDeleteSelected() {

    if (
      selectedMedia.length === 0 ||
      processing
    ) {
      return
    }

    const confirmed =
      window.confirm(
        `Supprimer ${selectedMedia.length} média${
          selectedMedia.length > 1
            ? 's'
            : ''
        } ?\n\nCette action est définitive.`,
      )

    if (!confirmed) {
      return
    }

    setProcessing(
      true,
    )

    const ids =
      selectedMedia.map(
        (item) =>
          item.id,
      )

    try {

      await deleteMultipleMedia(
        ids,
      )

      // Retirer immédiatement
      // les médias de la grille.
      setHiddenIds(
        (current) => {

          const next =
            new Set(current)

          ids.forEach(
            (id) =>
              next.add(id),
          )

          return next
        },
      )

      clearSelection()

      setSelectionMode(
        false,
      )

    } catch (error) {

      console.error(
        'Erreur suppression multiple:',
        error,
      )

      window.alert(
        'Impossible de supprimer les médias sélectionnés.',
      )

    } finally {

      setProcessing(
        false,
      )

    }

  }


  // ------------------------------------------------------
  // Aucun média
  // ------------------------------------------------------

  if (
    visibleMedia.length === 0
  ) {

    return (
      <div className="media-grid-empty glass">

        <h3>
          Aucun média
        </h3>

        <p className="text-secondary">
          Aucun fichier à afficher.
        </p>

      </div>
    )

  }


  return (
    <div>

      {/* ================================================
          BARRE D'ACTIONS
      ================================================ */}

      <div className="media-selection-toolbar glass">

        {!selectionMode ? (

          <>
            <button
              type="button"
              className="button-secondary"
              onClick={() =>
                setSelectionMode(
                  true,
                )
              }
            >
              ☑ Sélectionner
            </button>

          </>

        ) : (

          <>

            <div className="media-selection-info">

              <strong>
                {selectedMedia.length}
              </strong>

              <span>
                média
                {selectedMedia.length > 1
                  ? 's'
                  : ''}{' '}
                sélectionné
                {selectedMedia.length > 1
                  ? 's'
                  : ''}
              </span>

            </div>


            <div className="media-selection-actions">

              <button
                type="button"
                className="button-secondary"
                onClick={
                  selectedMedia.length ===
                  visibleMedia.length
                    ? clearSelection
                    : selectAll
                }
                disabled={
                  processing
                }
              >
                {selectedMedia.length ===
                visibleMedia.length
                  ? '☐ Tout désélectionner'
                  : '☑ Tout sélectionner'}
              </button>


              <button
                type="button"
                className="button-secondary"
                disabled={
                  selectedMedia.length ===
                    0 ||
                  processing
                }
                onClick={
                  handleDownloadSelected
                }
              >
                {processing
                  ? '⏳'
                  : '📥'}{' '}
                Télécharger
              </button>


              <button
                type="button"
                className="button-danger"
                disabled={
                  selectedMedia.length ===
                    0 ||
                  processing
                }
                onClick={
                  handleDeleteSelected
                }
              >
                {processing
                  ? '⏳'
                  : '🗑️'}{' '}
                Supprimer
              </button>


              <button
                type="button"
                className="button-secondary"
                disabled={
                  processing
                }
                onClick={
                  exitSelectionMode
                }
              >
                Annuler
              </button>

            </div>

          </>

        )}

      </div>


      {/* ================================================
          GRILLE
      ================================================ */}

      <div className="media-grid">

        {visibleMedia.map(
          (item) => (

            <div
              key={item.id}
              className="media-grid-item"
            >

              <MediaCard
                media={item}
                mediaList={visibleMedia}

                onClick={() =>
                  onMediaClick?.(
                    item,
                    visibleMedia,
                  )
                }

                onFavorite={
                  onFavorite
                }

                selectable={
                  selectionMode
                }

                selected={
                  selectedIds.has(
                    item.id,
                  )
                }

                onSelect={
                  toggleSelection
                }
              />


              {!selectionMode && (

                <button
                  type="button"
                  className="media-card-download"
                  aria-label={`Télécharger ${item.original_name}`}
                  title="Télécharger"
                  onClick={(event) => {

                    event.stopPropagation()

                    void handleDownload(
                      item,
                    )

                  }}
                >
                  📥
                </button>

              )}

            </div>

          ),
        )}

      </div>

    </div>
  )
}
