import { API_URL } from './api'

export function getMediaUrl(
  url: string | null | undefined,
): string | null {
  if (!url) {
    return null
  }

  if (
    url.startsWith('http://') ||
    url.startsWith('https://')
  ) {
    return url
  }

  return `${API_URL}${url.replace(/^\/api/, '')}`
}
