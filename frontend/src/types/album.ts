export type AlbumVisibility = 'private' | 'group'

export type Album = {
  id: number
  name: string
  description: string | null
  year: number
  cover_path: string | null
  visibility: AlbumVisibility
  owner_id: number
  group_id: number | null
  created_at: string
  media_count: number
}
