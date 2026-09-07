const API_URL =
  import.meta.env.VITE_API_URL ||
  '/api'


export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {

  const token =
    localStorage.getItem(
      'access_token',
    )

  const headers =
    new Headers(
      options.headers,
    )

  if (
    !(options.body instanceof FormData)
  ) {

    headers.set(
      'Content-Type',
      'application/json',
    )

  }

  if (token) {

    headers.set(
      'Authorization',
      `Bearer ${token}`,
    )

  }

  const response =
    await fetch(
      `${API_URL}${endpoint}`,
      {
        ...options,
        headers,
      },
    )

  if (!response.ok) {

    const message =
      await response.text()

    throw new Error(
      message ||
        `API error: ${response.status}`,
    )

  }

  if (
    response.status === 204
  ) {

    return undefined as T

  }

  return response.json() as Promise<T>
}


// ======================================================
// FETCH FICHIER AUTHENTIFIÉ
// ======================================================

export async function apiFetchBlob(
  endpoint: string,
): Promise<Blob> {

  const token =
    localStorage.getItem(
      'access_token',
    )

  const headers =
    new Headers()

  if (token) {

    headers.set(
      'Authorization',
      `Bearer ${token}`,
    )

  }

  const response =
    await fetch(
      `${API_URL}${endpoint}`,
      {
        method: 'GET',
        headers,
      },
    )

  if (!response.ok) {

    const message =
      await response.text()

    throw new Error(
      message ||
        `API error: ${response.status}`,
    )

  }

  return response.blob()
}


export { API_URL }
