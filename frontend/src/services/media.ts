import type { Media } from '../types/media'

import {
  apiFetch,
  apiFetchBlob,
} from './api'


// ======================================================
// CACHE MÉDIA
// ======================================================

const MEDIA_CACHE_KEY =
  'mediahub_media_cache'

let mediaCache: Media[] | null = null

let mediaPromise: Promise<Media[]> | null = null


// ======================================================
// CHARGEMENT DU CACHE SESSION
// ======================================================

function loadMediaCache(): Media[] | null {

  if (mediaCache !== null) {
    return mediaCache
  }


  try {

    const stored =
      sessionStorage.getItem(
        MEDIA_CACHE_KEY,
      )


    if (!stored) {
      return null
    }


    const parsed =
      JSON.parse(stored)


    if (!Array.isArray(parsed)) {
      return null
    }


    mediaCache =
      parsed as Media[]


    return mediaCache

  } catch (error) {

    console.error(
      'Impossible de lire le cache média.',
      error,
    )

    sessionStorage.removeItem(
      MEDIA_CACHE_KEY,
    )

    return null

  }

}


// ======================================================
// SAUVEGARDE DU CACHE
// ======================================================

function saveMediaCache(
  media: Media[],
): void {

  mediaCache = media


  try {

    sessionStorage.setItem(
      MEDIA_CACHE_KEY,
      JSON.stringify(media),
    )

  } catch (error) {

    console.error(
      'Impossible de sauvegarder le cache média.',
      error,
    )

  }

}


// ======================================================
// LISTE DES MEDIAS
// ======================================================

export async function getMedia(
  forceRefresh = false,
): Promise<Media[]> {

  if (!forceRefresh) {

    const cached =
      loadMediaCache()


    if (cached !== null) {
      return cached
    }

  }


  if (
    !forceRefresh &&
    mediaPromise !== null
  ) {

    return mediaPromise

  }


  mediaPromise =
    apiFetch<{
      items: Media[]
      total: number
      page: number
      limit: number
      has_next: boolean
    }>(
      '/media',
    )
      .then((response) => {

        saveMediaCache(
          response.items,
        )

        return response.items

      })
      .finally(() => {

        mediaPromise = null

      })


  return mediaPromise

}


// ======================================================
// INVALIDATION DU CACHE
// ======================================================

export function clearMediaCache(): void {

  mediaCache = null

  mediaPromise = null


  try {

    sessionStorage.removeItem(
      MEDIA_CACHE_KEY,
    )

  } catch (error) {

    console.error(
      'Impossible de vider le cache média.',
      error,
    )

  }

}


// ======================================================
// AJOUT D'UN MEDIA AU CACHE
// ======================================================

export function addMediaToCache(
  media: Media,
): void {

  const cached =
    loadMediaCache()


  if (cached === null) {
    return
  }


  saveMediaCache([
    media,
    ...cached,
  ])

}


// ======================================================
// SUPPRESSION D'UN MEDIA DU CACHE
// ======================================================

export function removeMediaFromCache(
  mediaId: number,
): void {

  const cached =
    loadMediaCache()


  if (cached === null) {
    return
  }


  saveMediaCache(
    cached.filter(
      (item) =>
        item.id !== mediaId,
    ),
  )

}


// ======================================================
// MISE À JOUR D'UN MEDIA DANS LE CACHE
// ======================================================

export function updateMediaInCache(
  media: Media,
): void {

  const cached =
    loadMediaCache()


  if (cached === null) {
    return
  }


  saveMediaCache(
    cached.map(
      (item) =>
        item.id === media.id
          ? media
          : item,
    ),
  )

}


// ======================================================
// MEDIA PAR ID
// ======================================================

export async function getMediaById(
  id: number,
): Promise<Media> {

  return apiFetch<Media>(
    `/media/${id}`,
  )

}


// ======================================================
// UPLOAD
// ======================================================

export async function uploadMedia(
  file: File,
  visibility: 'private' | 'group',
  groupId?: number,
): Promise<Media> {

  const formData =
    new FormData()


  formData.append(
    'file',
    file,
  )


  formData.append(
    'visibility',
    visibility,
  )


  if (
    visibility === 'group' &&
    groupId !== undefined
  ) {

    formData.append(
      'group_id',
      String(groupId),
    )

  }


  const media =
    await apiFetch<Media>(
      '/media/upload',
      {
        method: 'POST',
        body: formData,
      },
    )


  addMediaToCache(
    media,
  )


  return media

}


// ======================================================
// SUPPRESSION
// ======================================================

export async function deleteMedia(
  id: number,
): Promise<void> {

  await apiFetch<void>(
    `/media/${id}`,
    {
      method: 'DELETE',
    },
  )


  removeMediaFromCache(
    id,
  )

}


// ======================================================
// SUPPRESSION MULTIPLE
// ======================================================

export async function deleteMultipleMedia(
  ids: number[],
): Promise<void> {

  await apiFetch<void>(
    '/media/bulk-delete',
    {
      method: 'DELETE',
      body: JSON.stringify(ids),
      headers: {
        'Content-Type': 'application/json',
      },
    },
  )

  ids.forEach(
    (id) =>
      removeMediaFromCache(id),
  )
}


// ======================================================
// FAVORITES
// ======================================================

export async function getFavoriteMedia(): Promise<Media[]> {

  const response =
    await apiFetch<{
      items: Media[]
      total: number
      page: number
      limit: number
      has_next: boolean
    }>(
      '/media?favorite=true&',
    )


  return response.items

}


export async function addToFavorites(
  id: number,
): Promise<Media> {

  const media =
    await apiFetch<Media>(
      `/media/${id}/favorite`,
      {
        method: 'POST',
      },
    )


  updateMediaInCache(
    media,
  )


  return media

}


export async function removeFromFavorites(
  id: number,
): Promise<Media> {

  const media =
    await apiFetch<Media>(
      `/media/${id}/favorite`,
      {
        method: 'DELETE',
      },
    )


  updateMediaInCache(
    media,
  )


  return media

}


// ======================================================
// PARTAGES
// ======================================================

export async function getSharedMedia(): Promise<Media[]> {

  return apiFetch<Media[]>(
    '/media/shared?limit=100',
  )

}

// ======================================================
// TÉLÉCHARGEMENT
// ======================================================

export async function downloadMedia(
  media: Media,
): Promise<void> {

  const blob =
    await apiFetchBlob(
      `/media/${media.id}/file`,
    )

  const url =
    URL.createObjectURL(blob)

  const link =
    document.createElement('a')

  link.href = url
  link.download =
    media.original_name ||
    media.filename

  document.body.appendChild(
    link,
  )

  link.click()

  link.remove()

  URL.revokeObjectURL(
    url,
  )
}


// ======================================================
// TÉLÉCHARGEMENT MULTIPLE
// ======================================================

export async function downloadMultipleMedia(
  mediaItems: Media[],
): Promise<void> {

  for (
    const media of mediaItems
  ) {

    await downloadMedia(
      media,
    )

    // Petite pause pour éviter
    // que le navigateur bloque
    // plusieurs téléchargements.
    await new Promise(
      (resolve) =>
        setTimeout(
          resolve,
          250,
        ),
    )

  }

}
// ======================================================
// TÉLÉCHARGEMENT
// ======================================================

