export type MediaType =
  | 'image'
  | 'video'

export type MediaVisibility =
  | 'private'
  | 'group'

export type Media = {
  id: number

  filename: string
  original_name: string

  media_type: MediaType
  mime_type: string

  file_size: number

  width: number | null
  height: number | null
  duration: number | null

  taken_at: string | null
  uploaded_at: string

  album_id: number | null

  visibility: MediaVisibility
  group_id: number | null

  is_favorite: boolean

  thumbnail_url: string | null
  file_url: string | null
}
