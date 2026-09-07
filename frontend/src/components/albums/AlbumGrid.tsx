import type { Album } from '../../types/album'
import { AlbumCard } from './AlbumCard'

type AlbumGridProps = {
  albums: Album[]
  onAlbumClick?: (album: Album) => void
  onDelete?: (album: Album) => void
}

export function AlbumGrid({
  albums,
  onAlbumClick,
  onDelete,
}: AlbumGridProps) {
  if (albums.length === 0) {
    return (
      <div className="media-grid-empty glass">
        <div className="media-grid-empty-icon">
          ◇
        </div>

        <h3>Aucun album</h3>

        <p className="text-secondary">
          Crée ton premier album pour organiser
          tes souvenirs.
        </p>
      </div>
    )
  }

  return (
    <div className="album-grid">
      {albums.map((album) => (
        <AlbumCard
          key={album.id}
          album={album}
          onClick={onAlbumClick}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}
