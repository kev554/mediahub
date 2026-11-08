import type { MediaType } from './media'

export type MediaSearchFilters = {
  media_type?: MediaType
  start_date?: string
  end_date?: string
  favorite?: boolean
  album_id?: number
}
