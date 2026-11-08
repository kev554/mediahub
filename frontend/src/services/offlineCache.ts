import type { Media } from '../types/media'
import type { User } from '../types/user'

const DATABASE_NAME = 'mediahub-offline'
const DATABASE_VERSION = 1
const MEDIA_STORE = 'media'
const ASSET_STORE = 'assets'
const OFFLINE_USER_KEY = 'mediahub_offline_user'
const MAX_CACHE_BYTES = 300 * 1024 * 1024
const MAX_ASSET_BYTES = 100 * 1024 * 1024

type OfflineMediaRecord = {
  userId: number
  items: Media[]
}

type OfflineAssetRecord = {
  key: string
  userId: number
  blob: Blob
  bytes: number
  lastUsed: number
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(MEDIA_STORE)) {
        database.createObjectStore(MEDIA_STORE, { keyPath: 'userId' })
      }
      if (!database.objectStoreNames.contains(ASSET_STORE)) {
        database.createObjectStore(ASSET_STORE, { keyPath: 'key' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export function cacheOfflineUser(user: User): void {
  try {
    localStorage.setItem(OFFLINE_USER_KEY, JSON.stringify(user))
  } catch (error) {
    console.warn('Unable to persist the offline account profile.', error)
  }
}

export function getOfflineUser(): User | null {
  try {
    const value = localStorage.getItem(OFFLINE_USER_KEY)
    if (!value) return null
    const user = JSON.parse(value) as User
    return Number.isInteger(user.id) ? user : null
  } catch (error) {
    console.warn('Unable to read the offline account profile.', error)
    return null
  }
}

export function getOfflineUserId(): number | null {
  return getOfflineUser()?.id ?? null
}

export async function saveOfflineMediaItems(
  userId: number | null,
  items: Media[],
): Promise<void> {
  if (!userId || items.length === 0 || !('indexedDB' in window)) return

  try {
    const database = await openDatabase()
    const transaction = database.transaction(MEDIA_STORE, 'readwrite')
    const store = transaction.objectStore(MEDIA_STORE)
    const request = store.get(userId) as IDBRequest<OfflineMediaRecord | undefined>

    request.onsuccess = () => {
      const existing = new Map(
        (request.result?.items ?? []).map((item) => [item.id, item]),
      )
      items.forEach((item) => existing.set(item.id, item))
      store.put({ userId, items: Array.from(existing.values()) } satisfies OfflineMediaRecord)
    }

    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error)
    })
    database.close()
  } catch (error) {
    console.warn('Unable to persist the offline media list.', error)
  }
}

export async function loadOfflineMediaItems(
  userId: number | null,
): Promise<Media[] | null> {
  if (!userId || !('indexedDB' in window)) return null

  try {
    const database = await openDatabase()
    const transaction = database.transaction(MEDIA_STORE, 'readonly')
    const request = transaction.objectStore(MEDIA_STORE).get(userId) as IDBRequest<OfflineMediaRecord | undefined>
    const record = await new Promise<OfflineMediaRecord | undefined>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    database.close()
    return record?.items ?? null
  } catch (error) {
    console.warn('Unable to read the offline media list.', error)
    return null
  }
}

export async function removeOfflineMediaItem(
  userId: number | null,
  mediaId: number,
): Promise<void> {
  const items = await loadOfflineMediaItems(userId)
  if (!items) return

  const remaining = items.filter((item) => item.id !== mediaId)
  if (!userId || !('indexedDB' in window)) return

  try {
    const database = await openDatabase()
    const transaction = database.transaction(MEDIA_STORE, 'readwrite')
    transaction.objectStore(MEDIA_STORE).put({
      userId,
      items: remaining,
    } satisfies OfflineMediaRecord)
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error)
    })
    database.close()
  } catch (error) {
    console.warn('Unable to remove the offline media record.', error)
  }
}

function assetKey(userId: number, mediaUrl: string) {
  return `${userId}:${mediaUrl}`
}

export async function loadOfflineAsset(
  userId: number | null,
  mediaUrl: string,
): Promise<Blob | null> {
  if (!userId || !('indexedDB' in window)) return null

  try {
    const database = await openDatabase()
    const transaction = database.transaction(ASSET_STORE, 'readwrite')
    const store = transaction.objectStore(ASSET_STORE)
    const request = store.get(assetKey(userId, mediaUrl)) as IDBRequest<OfflineAssetRecord | undefined>

    const blob = await new Promise<Blob | null>((resolve, reject) => {
      request.onsuccess = () => {
        const record = request.result
        if (!record) {
          resolve(null)
          return
        }
        record.lastUsed = Date.now()
        store.put(record)
        resolve(record.blob)
      }
      request.onerror = () => reject(request.error)
    })
    database.close()
    return blob
  } catch (error) {
    console.warn('Unable to read a cached offline media asset.', error)
    return null
  }
}

export async function saveOfflineAsset(
  userId: number | null,
  mediaUrl: string,
  blob: Blob,
): Promise<void> {
  if (!userId || !blob.size || blob.size > MAX_ASSET_BYTES || !('indexedDB' in window)) return

  try {
    const estimate = await navigator.storage?.estimate()
    const database = await openDatabase()
    const transaction = database.transaction(ASSET_STORE, 'readwrite')
    const store = transaction.objectStore(ASSET_STORE)
    const entries: OfflineAssetRecord[] = []
    const cursorRequest = store.openCursor()

    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result
      if (cursor) {
        entries.push(cursor.value as OfflineAssetRecord)
        cursor.continue()
        return
      }

      const key = assetKey(userId, mediaUrl)
      let totalBytes = entries.reduce((total, entry) => total + entry.bytes, 0)
      const existing = entries.find((entry) => entry.key === key)
      if (existing) totalBytes -= existing.bytes
      const otherStorageUsage = Math.max(
        0,
        (estimate?.usage ?? 0) - entries.reduce((total, entry) => total + entry.bytes, 0),
      )
      const availableCacheBytes = estimate?.quota
        ? Math.max(
            0,
            Math.min(
              MAX_CACHE_BYTES,
              estimate.quota * 0.85 - otherStorageUsage,
            ),
          )
        : MAX_CACHE_BYTES

      entries
        .filter((entry) => entry.key !== key)
        .sort((a, b) => a.lastUsed - b.lastUsed)
        .some((entry) => {
          if (totalBytes + blob.size <= availableCacheBytes) return true
          store.delete(entry.key)
          totalBytes -= entry.bytes
          return false
        })

      if (totalBytes + blob.size <= availableCacheBytes) {
        store.put({
          key,
          userId,
          blob,
          bytes: blob.size,
          lastUsed: Date.now(),
        } satisfies OfflineAssetRecord)
      }
    }

    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error)
    })
    database.close()
  } catch (error) {
    console.warn('Unable to cache media for offline use.', error)
  }
}

export async function clearOfflineCache(): Promise<void> {
  try {
    localStorage.removeItem(OFFLINE_USER_KEY)
  } catch (error) {
    console.warn('Unable to clear the offline account profile.', error)
  }
  if (!('indexedDB' in window)) return

  try {
    const database = await openDatabase()
    const transaction = database.transaction(
      [MEDIA_STORE, ASSET_STORE],
      'readwrite',
    )
    transaction.objectStore(MEDIA_STORE).clear()
    transaction.objectStore(ASSET_STORE).clear()
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error)
    })
    database.close()
  } catch (error) {
    console.warn('Unable to clear the offline media cache.', error)
  }
}
