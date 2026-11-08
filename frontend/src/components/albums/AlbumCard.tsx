import type { Album } from '../../types/album'
import { t } from '../../lib/i18n'


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
            ? `👥 ${t('Groupe', 'Group')}`
            : `🔒 ${t('Privé', 'Private')}`
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
            t('Aucune description', 'No description')
          }

        </p>



        <div className="album-footer">


          <span>

            {(album.media_count ?? 0)}{' '}
            {t(
              (album.media_count ?? 0) === 1 ? 'média' : 'médias',
              (album.media_count ?? 0) === 1 ? 'item' : 'items',
            )}

          </span>



          <button
            type="button"
            className="glass-button danger"
            onClick={(event)=>{

              event.stopPropagation()

              onDelete?.(album)

            }}
          >

            {t('Supprimer', 'Delete')}

          </button>


        </div>


      </div>


    </article>
  )
}
