import type { Media } from '../../types/media'
import { useAuthenticatedMedia } from '../../hooks/useAuthenticatedMedia'


type TimelineGroupCardProps = {
  title: string
  media: Media[]
  subtitle?: string
  onClick: () => void
}


export function TimelineGroupCard({
  title,
  media,
  subtitle,
  onClick,
}: TimelineGroupCardProps) {


  const preview =
    media.slice(0, 6)


  return (

    <button
      type="button"
      className="timeline-year-card glass"
      onClick={onClick}
    >

      <div className="timeline-year-grid">

        {preview.map((item) => (

          <TimelineThumbnail
            key={item.id}
            media={item}
          />

        ))}

      </div>


      <div className="timeline-year-overlay">

        <h2>
          {title}
        </h2>


        <span>
          {subtitle ?? `${media.length} souvenirs`}
        </span>

      </div>


    </button>

  )
}




function TimelineThumbnail({
  media,
}: {
  media: Media
}) {


  const {
    url,
  } = useAuthenticatedMedia(
    media.thumbnail_url,
  )


  return (

    <div className="timeline-thumbnail">

      {url ? (

        <img
          src={url}
          alt=""
        />

      ) : (

        <span>
          📷
        </span>

      )}



      {media.media_type === 'video' && (

        <span className="timeline-video-badge">
          ▶
        </span>

      )}

    </div>

  )
}
