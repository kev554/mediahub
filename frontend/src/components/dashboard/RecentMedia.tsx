import type { Media } from '../../types/media'
import { useAuthenticatedMedia } from '../../hooks/useAuthenticatedMedia'

type RecentMediaProps = {
  media: Media[]
  loading: boolean
  onNavigate: (page: string) => void
  onUpload: () => void
}

type RecentMediaItemProps = {
  media: Media
  onNavigate: (page: string) => void
}

function RecentMediaItem({
  media,
  onNavigate,
}: RecentMediaItemProps) {

  const {
    url: thumbnailUrl,
    loading: thumbnailLoading,
  } = useAuthenticatedMedia(
    media.thumbnail_url,
  )

  const isVideo =
    media.media_type === 'video'

  return (
    <button
      type="button"
      className="dashboard-recent-item"
      onClick={() =>
        onNavigate(
          isVideo
            ? 'videos'
            : 'photos',
        )
      }
    >

      <div className="dashboard-recent-preview">

        {thumbnailLoading ? (
          <div className="dashboard-recent-placeholder">
            ◌
          </div>
        ) : thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={media.original_name}
            loading="lazy"
          />
        ) : (
          <div className="dashboard-recent-placeholder">
            {isVideo ? '▶' : '▧'}
          </div>
        )}

        {isVideo && (
          <span className="dashboard-video-badge">
            ▶
          </span>
        )}

      </div>


      <div className="dashboard-recent-info">

        <strong>
          {media.original_name}
        </strong>

        <small>
          {new Date(
            media.uploaded_at,
          ).toLocaleDateString()}
        </small>

      </div>

    </button>
  )
}


function getPeriodLabel(date: string) {

  const mediaDate =
    new Date(date)

  const today =
    new Date()

  const diff =
    today.getTime() -
    mediaDate.getTime()

  const days =
    diff /
    (1000 * 60 * 60 * 24)


  if (days < 1) {
    return "Aujourd'hui"
  }

  if (days < 7) {
    return "Cette semaine"
  }

  return mediaDate.toLocaleDateString(
    'fr-FR',
    {
      month: 'long',
      year: 'numeric',
    },
  )
}


export function RecentMedia({
  media,
  loading,
  onNavigate,
  onUpload,
}: RecentMediaProps) {


  const recentMedia =
    [...media]
      .sort(
        (a, b) =>
          new Date(
            b.uploaded_at,
          ).getTime()
          -
          new Date(
            a.uploaded_at,
          ).getTime(),
      )
      .slice(0, 6)


  const grouped =
    recentMedia.reduce(
      (
        groups,
        item,
      ) => {

        const label =
          getPeriodLabel(
            item.uploaded_at,
          )


        if (!groups[label]) {
          groups[label] = []
        }

        groups[label].push(item)

        return groups

      },
      {} as Record<string, Media[]>,
    )


  return (

    <article className="glass dashboard-panel recent-media">


      <div className="dashboard-panel-header">

        <div>

          <span className="dashboard-eyebrow">
            COLLECTION
          </span>


          <h2>
            Timeline récente
          </h2>

        </div>


        <button
          type="button"
          className="glass-button small-button"
          onClick={() =>
            onNavigate('timeline')
          }
        >
          Voir tout
        </button>


      </div>



      {loading ? (

        <div className="dashboard-empty">

          <div className="empty-icon">
            ◌
          </div>

          <h3>
            Chargement...
          </h3>

          <p className="text-secondary">
            Récupération de tes médias.
          </p>

        </div>


      ) : recentMedia.length === 0 ? (


        <div className="dashboard-empty">

          <div className="empty-icon">
            ▧
          </div>


          <h3>
            Aucun média pour le moment
          </h3>


          <p className="text-secondary">
            Commence par importer tes premières photos ou vidéos.
          </p>


          <button
            type="button"
            className="accent-button"
            onClick={onUpload}
          >
            ＋ Importer maintenant
          </button>


        </div>


      ) : (


        <div>

          {Object.entries(grouped).map(
            ([label, items]) => (

              <div
                key={label}
                style={{
                  marginBottom: '18px',
                }}
              >

                <h3
                  style={{
                    marginBottom: '10px',
                    fontSize: '13px',
                  }}
                >
                  {label}
                </h3>


                <div className="dashboard-recent-grid">

                  {items.map(
                    (item) => (

                      <RecentMediaItem
                        key={item.id}
                        media={item}
                        onNavigate={onNavigate}
                      />

                    ),
                  )}

                </div>


              </div>

            ),
          )}

        </div>


      )}


    </article>

  )
}
