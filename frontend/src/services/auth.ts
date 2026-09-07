import type { User } from '../types/user'
import { API_URL } from './api'

export type LoginResponse = {
  access_token: string
  token_type: string
}

export type RegisterData = {
  username: string
  email: string
  password: string
  display_name: string
}

export async function login(
  username: string,
  password: string,
): Promise<LoginResponse> {
  const body = new URLSearchParams()

  body.append('username', username)
  body.append('password', password)

  const response = await fetch(
    `${API_URL}/auth/login`,
    {
      method: 'POST',
      headers: {
        'Content-Type':
          'application/x-www-form-urlencoded',
      },
      body,
    },
  )

  if (!response.ok) {
    const message = await response.text()

    throw new Error(
      message || 'Identifiants incorrects.',
    )
  }

  const data =
    (await response.json()) as LoginResponse

  localStorage.setItem(
    'access_token',
    data.access_token,
  )

  return data
}

export async function register(
  data: RegisterData,
): Promise<User> {
  const response = await fetch(
    `${API_URL}/auth/register`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    },
  )

  if (!response.ok) {
    const message = await response.text()

    throw new Error(
      message || 'Impossible de créer le compte.',
    )
  }

  return response.json() as Promise<User>
}

export async function getCurrentUser(): Promise<User> {
  const token =
    localStorage.getItem('access_token')

  if (!token) {
    throw new Error('Not authenticated')
  }

  const response = await fetch(
    `${API_URL}/auth/me`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  )

  if (!response.ok) {
    localStorage.removeItem('access_token')

    throw new Error(
      'Session invalide ou expirée.',
    )
  }

  return response.json() as Promise<User>
}

export function logout(): void {
  localStorage.removeItem('access_token')
}
