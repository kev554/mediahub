import { apiFetch } from './api'

const USER_PREFERENCES_KEY = 'mediahub_user_preferences'

export function clearCachedUserPreferences(): void {
  localStorage.removeItem(USER_PREFERENCES_KEY)
}

export type UserSearchResult = {
  id: number
  username: string
  display_name: string
}


export type UserProfile = {
  id: number
  username: string
  email: string
  display_name: string
  is_active: boolean
  created_at: string
}


export type UserUpdateData = {
  username?: string
  email?: string
  display_name?: string
}

export type UserPreferences = {
  theme: 'light' | 'dark' | 'system'
  language: 'fr' | 'en'
  default_visibility: 'private' | 'group'
  media_sort: 'uploaded_at' | 'taken_at' | 'original_name'
}

export type StorageUsage = {
  used_bytes: number
  media_count: number
  quota_bytes: number | null
}

export async function getStorageUsage(): Promise<StorageUsage> {
  return apiFetch<StorageUsage>('/users/me/storage-usage')
}

export async function searchUsers(
  query = '',
): Promise<UserSearchResult[]> {

  const params = new URLSearchParams()

  if (query.trim()) {
    params.set('q', query.trim())
  }

  const suffix = params.toString()
    ? `?${params.toString()}`
    : ''

  return apiFetch<UserSearchResult[]>(
    `/users${suffix}`,
  )
}




export async function updateProfile(
  data: UserUpdateData,
): Promise<UserProfile> {

  return apiFetch<UserProfile>(
    '/users/me',
    {
      method: 'PUT',
      body: JSON.stringify(data),
    },
  )
}

export type PasswordChangeData = {
  current_password: string
  new_password: string
}


export async function changePassword(
  data: PasswordChangeData,
): Promise<{
  message: string
}> {

  return apiFetch<{
    message: string
  }>(
    '/users/me/password',
    {
      method: 'PUT',
      body: JSON.stringify(data),
    },
  )
}

export async function getUserPreferences(
): Promise<UserPreferences> {
  const preferences = await apiFetch<UserPreferences>(
    '/users/me/preferences',
  )
  localStorage.setItem(
    USER_PREFERENCES_KEY,
    JSON.stringify(preferences),
  )
  return preferences
}

export async function updateUserPreferences(
  data: Partial<UserPreferences>,
): Promise<UserPreferences> {
  const preferences = await apiFetch<UserPreferences>(
    '/users/me/preferences',
    {
      method: 'PUT',
      body: JSON.stringify(data),
    },
  )
  localStorage.setItem(
    USER_PREFERENCES_KEY,
    JSON.stringify(preferences),
  )
  return preferences
}
