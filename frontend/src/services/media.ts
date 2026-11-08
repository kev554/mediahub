import type { Media } from '../types/media'
import type { MediaSearchFilters } from '../types/mediaSearch'
import {
  getOfflineUserId,
  loadOfflineMediaItems,
  removeOfflineMediaItem,
  saveOfflineMediaItems,
} from './offlineCache'

import {
  API_URL,
  apiFetch,
} from './api'

export type TrashItem = {
  id: number
  original_name: string
  media_type: 'image' | 'video'
  file_size: number
  deleted_at: string
  purge_after: string
}

export type TrashPage = {
  items: TrashItem[]
  total: number
  page: number
  limit: number
  has_next: boolean
  retention_days: number
}

export type DuplicateMediaGroup = {
  checksum: string
  file_size: number
  items: Media[]
}

export type ShareLink = {
  id: number
  media_id: number
  token: string
  note: string | null
  created_at: string
  expires_at: string | null
  max_views: number | null
  views_used: number
  is_active: boolean
  share_url: string
}

export type SharedMedia = {
  token: string
  media_id: number
  media_name: string
  media_type: 'image' | 'video'
  file_url: string
  expires_at: string | null
  max_views: number | null
  views_used: number
}

type ResumableUploadStatus = {
  upload_id: string
  offset: number
  file_size: number
  expires_at: string
  completed: boolean
}

class UploadRequestError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

const RESUMABLE_CHUNK_SIZE = 8 * 1024 * 1024

async function resumableRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers)
  const token = localStorage.getItem('access_token')

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  if (
    options.body &&
    !(options.body instanceof Blob) &&
    typeof options.body === 'string'
  ) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null) as {
      detail?: string
    } | null
    throw new UploadRequestError(
      body?.detail ?? `Upload failed: ${response.status}`,
      response.status,
    )
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

function resumableUploadStorageKey(file: File): string {
  return `mediahub_upload_${encodeURIComponent(
    `${file.name}:${file.size}:${file.lastModified}`,
  )}`
}

export async function uploadMediaResumable(
  file: File,
  visibility: 'private' | 'group',
  groupId: number | undefined,
  onProgress?: (uploadedBytes: number, totalBytes: number) => void,
): Promise<Media> {
  const storageKey = resumableUploadStorageKey(file)
  let uploadId = localStorage.getItem(storageKey)
  let status: ResumableUploadStatus | null = null

  if (uploadId) {
    try {
      status = await resumableRequest<ResumableUploadStatus>(
        `/media/upload/resumable/${uploadId}`,
      )
    } catch (error) {
      if (
        !(error instanceof UploadRequestError) ||
        ![404, 410].includes(error.status)
      ) {
        throw error
      }
      localStorage.removeItem(storageKey)
      uploadId = null
    }
  }

  if (!uploadId || !status) {
    status = await resumableRequest<ResumableUploadStatus>(
      '/media/upload/resumable',
      {
        method: 'POST',
        body: JSON.stringify({
          filename: file.name,
          file_size: file.size,
          mime_type: file.type,
          visibility,
          group_id: groupId ?? null,
        }),
      },
    )
    uploadId = status.upload_id
    localStorage.setItem(storageKey, uploadId)
  }

  if (status.completed) {
    const media = await resumableRequest<Media>(
      `/media/upload/resumable/${uploadId}/complete`,
      { method: 'POST' },
    )
    localStorage.removeItem(storageKey)
    addMediaToCache(media)
    return media
  }

  if (status.file_size !== file.size || status.offset > file.size) {
    localStorage.removeItem(storageKey)
    throw new Error('Le fichier sélectionné ne correspond pas à l’import reprenable.')
  }

  let offset = status.offset
  onProgress?.(offset, file.size)

  while (offset < file.size) {
    const nextOffset = Math.min(
      offset + RESUMABLE_CHUNK_SIZE,
      file.size,
    )
    const chunk = file.slice(offset, nextOffset)
    const result = await resumableRequest<{ offset: number }>(
      `/media/upload/resumable/${uploadId}/chunk?offset=${offset}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/octet-stream',
        },
        body: chunk,
      },
    )
    offset = result.offset
    onProgress?.(offset, file.size)
  }

  const media = await resumableRequest<Media>(
    `/media/upload/resumable/${uploadId}/complete`,
    { method: 'POST' },
  )
  localStorage.removeItem(storageKey)
  addMediaToCache(media)
  return media
}

// ======================================================
// CACHE MÉDIA
// ======================================================

const MEDIA_CACHE_KEY =
  'mediahub_media_cache'

let mediaCache: Media[] | null = null

let mediaPromise: Promise<Media[]> | null = null

function getSavedMediaSort():
  | 'uploaded_at'
  | 'taken_at'
  | 'original_name'
  | undefined {
  try {
    const saved = localStorage.getItem('mediahub_user_preferences')
    if (!saved) {
      return undefined
    }

    const preferences = JSON.parse(saved) as {
      media_sort?: string
    }
    if (
      preferences.media_sort === 'uploaded_at' ||
      preferences.media_sort === 'taken_at' ||
      preferences.media_sort === 'original_name'
    ) {
      return preferences.media_sort
    }

    return undefined
  } catch (error) {
    console.error(
      'Impossible de lire le tri des préférences utilisateur.',
      error,
    )
    return undefined
  }
}


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

export async function createMediaShare(
  mediaId: number,
  payload: {
    expires_in_hours?: number | null
    max_views?: number | null
    note?: string | null
  } = {},
): Promise<ShareLink> {
  return apiFetch<ShareLink>(
    `/shares/media/${mediaId}`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  )
}

export async function listMediaShares(): Promise<ShareLink[]> {
  return apiFetch<ShareLink[]>('/shares')
}

export async function revokeMediaShare(
  shareId: number,
): Promise<void> {
  await apiFetch<void>(`/shares/${shareId}`, {
    method: 'DELETE',
  })
}

export async function openMediaShare(
  token: string,
): Promise<SharedMedia> {
  return apiFetch<SharedMedia>(`/shares/open/${token}`)
}

export async function getMedia(
  forceRefresh = false,
  filters: {
    search?: string
    media_type?: 'image' | 'video'
    favorite?: boolean
    year?: number
    visibility?: 'private' | 'group'
    group_id?: number
    album_id?: number
    sort?: 'uploaded_at' | 'taken_at' | 'original_name'
    direction?: 'asc' | 'desc'
  } & MediaSearchFilters = {},
): Promise<Media[]> {
  const hasFilters = Object.values(filters).some(
    (value) => value !== undefined && value !== '',
  )
  const requestedFilters = {
    ...filters,
    sort: filters.sort ?? getSavedMediaSort(),
  }

  if (!forceRefresh && !hasFilters) {

    const cached =
      loadMediaCache()


    if (cached !== null) {
      return cached
    }

  }


  if (
    !forceRefresh &&
    !hasFilters &&
    mediaPromise !== null
  ) {

    return mediaPromise

  }


  const params =
    new URLSearchParams()

  if (filters.search) {
    params.set('search', filters.search)
  }

  if (filters.media_type) {
    params.set('media_type', filters.media_type)
  }

  if (filters.favorite !== undefined) {
    params.set('favorite', String(filters.favorite))
  }

  if (filters.year) {
    params.set('year', String(filters.year))
  }

  if (filters.start_date) {
    params.set('start_date', filters.start_date)
  }

  if (filters.end_date) {
    params.set('end_date', filters.end_date)
  }

  if (filters.visibility) {
    params.set('visibility', filters.visibility)
  }

  if (filters.group_id) {
    params.set('group_id', String(filters.group_id))
  }

  if (filters.album_id) {
    params.set('album_id', String(filters.album_id))
  }

  if (requestedFilters.sort) {
    params.set('sort', requestedFilters.sort)
  }

  if (requestedFilters.direction) {
    params.set('direction', requestedFilters.direction)
  }

  const queryString =
    params.toString()

  const request = apiFetch<{
      items: Media[]
      total: number
      page: number
      limit: number
      has_next: boolean
    }>(
      `/media${queryString ? `?${queryString}` : ''}`,
    )
      .then((response) => {

        if (!hasFilters) {
          saveMediaCache(response.items)
        }

        void saveOfflineMediaItems(
          getOfflineUserId(),
          response.items,
        )

        return response.items

      })
      .catch(async (error: unknown) => {
        if (navigator.onLine && !(error instanceof TypeError)) {
          throw error
        }
        const offlineItems = await loadOfflineMediaItems(getOfflineUserId())
        if (!offlineItems) throw error
        return filterOfflineMedia(offlineItems, filters, requestedFilters)
      })
      .finally(() => {

        if (!hasFilters) {
          mediaPromise = null
        }

      })


  if (!hasFilters) {
    mediaPromise = request
  }

  return request

}

function filterOfflineMedia(
  items: Media[],
  filters: Parameters<typeof getMedia>[1],
  sortOptions: {
    sort?: 'uploaded_at' | 'taken_at' | 'original_name'
    direction?: 'asc' | 'desc'
  },
): Media[] {
  const search = filters?.search?.trim().toLocaleLowerCase()
  const filtered = items.filter((item) => {
    const date = new Date(item.taken_at ?? item.uploaded_at)
    const dateKey = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-')

    return (
      (!search || [
        item.original_name,
        item.filename,
        item.mime_type,
      ].some((value) => value.toLocaleLowerCase().includes(search))) &&
      (!filters?.media_type || item.media_type === filters.media_type) &&
      (filters?.favorite !== true || item.is_favorite) &&
      (filters?.album_id === undefined || item.album_id === filters.album_id) &&
      (filters?.group_id === undefined || item.group_id === filters.group_id) &&
      (!filters?.visibility || item.visibility === filters.visibility) &&
      (!filters?.year || date.getFullYear() === filters.year) &&
      (!filters?.start_date || dateKey >= filters.start_date) &&
      (!filters?.end_date || dateKey <= filters.end_date)
    )
  })

  if (!sortOptions.sort && !sortOptions.direction) return filtered

  return filtered.sort((a, b) => {
    const order = sortOptions.direction === 'asc' ? 1 : -1
    if (sortOptions.sort === 'original_name') {
      return a.original_name.localeCompare(b.original_name) * order
    }

    const aDate = new Date(
      sortOptions.sort === 'taken_at'
        ? a.taken_at ?? a.uploaded_at
        : a.uploaded_at,
    ).getTime()
    const bDate = new Date(
      sortOptions.sort === 'taken_at'
        ? b.taken_at ?? b.uploaded_at
        : b.uploaded_at,
    ).getTime()
    return (aDate - bDate) * order
  })
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
  void saveOfflineMediaItems(getOfflineUserId(), [media])

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
  void removeOfflineMediaItem(getOfflineUserId(), mediaId)

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
  void saveOfflineMediaItems(getOfflineUserId(), [media])

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

export async function getTrash(
  page = 1,
  limit = 50,
): Promise<TrashPage> {
  return apiFetch<TrashPage>(
    `/trash?page=${page}&limit=${limit}`,
  )
}

export async function restoreTrashedMedia(
  id: number,
): Promise<void> {
  await apiFetch<void>(
    `/trash/${id}/restore`,
    { method: 'POST' },
  )
  clearMediaCache()
}

export async function permanentlyDeleteTrashedMedia(
  id: number,
): Promise<void> {
  await apiFetch<void>(
    `/trash/${id}`,
    { method: 'DELETE' },
  )
}

export async function emptyTrash(): Promise<void> {
  await apiFetch<void>(
    '/trash',
    { method: 'DELETE' },
  )
}


// ======================================================
// FAVORITES
// ======================================================

export async function getFavoriteMedia(
  search?: string,
  filters: MediaSearchFilters = {},
): Promise<Media[]> {
  return getMedia(false, {
    favorite: true,
    search: search?.trim() || undefined,
    ...filters,
  })
}

export async function getDuplicateMedia(): Promise<DuplicateMediaGroup[]> {
  return apiFetch<DuplicateMediaGroup[]>('/media/duplicates')
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

export async function getSharedMedia(search?: string): Promise<Media[]> {
  const params = new URLSearchParams()
  if (search?.trim()) params.set('search', search.trim())
  const query = params.size > 0 ? `?${params.toString()}` : ''
  return apiFetch<Media[]>(`/media/shared${query}`)
}

// ======================================================
// TÉLÉCHARGEMENT
// ======================================================

export async function downloadMedia(
  media: Media,
): Promise<void> {
  const result = await apiFetch<{ url: string }>(
    `/media/${media.id}/stream-url?download=true`,
  )

  const filename = media.original_name || media.filename
  const isTouchDevice = navigator.maxTouchPoints > 0

  if (
    isTouchDevice &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function'
  ) {
    const response = await fetch(result.url)
    if (!response.ok) {
      throw new Error(`Unable to download media (${response.status}).`)
    }

    const blob = await response.blob()
    const file = new File(
      [blob],
      filename,
      { type: blob.type || media.mime_type },
    )

    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: filename })
        return
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }

        if (!(error instanceof DOMException && error.name === 'NotAllowedError')) {
          throw error
        }
      }
    }

    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = objectUrl
    link.rel = 'noopener'
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
    return
  }

  const link = document.createElement('a')
  link.href = result.url
  link.rel = 'noopener'
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
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
