import { apiFetch } from './api'


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
