import type { Album } from '../../types/album'


type AlbumCardProps = {
  album: Album
  onClick?: (album: Album) => void
  onDelete?: (album: Album) => void
}


export function AlbumCard({
  album,
  onClick,
  onDelete,
}: AlbumCardProps) {


  return (
    <article
      className="album-card glass"
      onClick={() => onClick?.(album)}
    >

      <div className="album-cover">

        <div className="album-cover-icon">
          📷
        </div>


        <span className="album-visibility">

          {
            album.visibility === 'group'
            ? '👥 Groupe'
            : '🔒 Privé'
          }

        </span>


      </div>



      <div className="album-content">


        <div className="album-year">

          {album.year}

        </div>


        <h3>

          {album.name}

        </h3>


        <p>

          {
            album.description ||
            'Aucune description'
          }

        </p>



        <div className="album-footer">


          <span>

            {album.media_count ?? 0} média
            {
              (album.media_count ?? 0) > 1
              ? 's'
              : ''
            }

          </span>



          <button
            type="button"
            className="glass-button danger"
            onClick={(event)=>{

              event.stopPropagation()

              onDelete?.(album)

            }}
          >

            Supprimer

          </button>


        </div>


      </div>


    </article>
  )
}
