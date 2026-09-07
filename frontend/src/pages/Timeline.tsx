import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import { getMedia } from '../services/media'

import type { Media } from '../types/media'

import { MediaCard } from '../components/media/MediaCard'
import { TimelineGroupCard } from '../components/timeline/TimelineGroupCard'


type TimelineProps = {
  onMediaClick?: (
    media: Media,
    mediaList: Media[],
  ) => void
}


type TimelineLevel =
  | 'year'
  | 'month'
  | 'day'


function getMediaDate(media: Media) {
  return new Date(
    media.taken_at ?? media.uploaded_at,
  )
}


function getMonthName(month: number) {
  return new Date(
    2026,
    month,
    1,
  ).toLocaleString(
    'fr-FR',
    {
      month: 'long',
    },
  )
}


export function Timeline({
  onMediaClick,
}: TimelineProps) {


  const [media, setMedia] =
    useState<Media[]>([])


  const [loading, setLoading] =
    useState(true)


  const [error, setError] =
    useState<string | null>(null)


  const [level, setLevel] =
    useState<TimelineLevel>('year')


  const [selectedYear, setSelectedYear] =
    useState<number | null>(null)


  const [selectedMonth, setSelectedMonth] =
    useState<number | null>(null)



  useEffect(() => {

    async function load() {

      try {

        const data =
          await getMedia()

        setMedia(data)

      } catch (err) {

        setError(
          err instanceof Error
            ? err.message
            : 'Erreur',
        )

      } finally {

        setLoading(false)

      }

    }


    void load()

  }, [])



  const years = useMemo(() => {

    const result:
      Record<number, Media[]> = {}


    media.forEach((item) => {

      const year =
        getMediaDate(item)
          .getFullYear()


      if (!result[year]) {
        result[year] = []
      }


      result[year].push(item)

    })


    return result

  }, [media])





  const months = useMemo(() => {

    if (selectedYear === null) {
      return {}
    }


    const result:
      Record<number, Media[]> = {}


    media
      .filter(
        (item) =>
          getMediaDate(item)
            .getFullYear()
          === selectedYear,
      )
      .forEach((item) => {

        const month =
          getMediaDate(item)
            .getMonth()


        if (!result[month]) {
          result[month] = []
        }


        result[month].push(item)

      })


    return result

  }, [
    media,
    selectedYear,
  ])





  const days = useMemo(() => {

    if (
      selectedYear === null ||
      selectedMonth === null
    ) {
      return {}
    }


    const result:
      Record<string, Media[]> = {}


    media
      .filter((item) => {

        const date =
          getMediaDate(item)


        return (
          date.getFullYear()
            === selectedYear
          &&
          date.getMonth()
            === selectedMonth
        )

      })
      .forEach((item) => {

        const date =
          getMediaDate(item)


        const key =
          date.toLocaleDateString(
            'fr-FR',
          )


        if (!result[key]) {
          result[key] = []
        }


        result[key].push(item)

      })


    return result

  }, [
    media,
    selectedYear,
    selectedMonth,
  ])





  function goBack() {

    if (level === 'day') {

      setLevel('month')
      return

    }


    if (level === 'month') {

      setLevel('year')
      setSelectedYear(null)
      return

    }

  }





  if (loading) {

    return (
      <section className="page-section">
        <div className="glass media-grid-empty">
          Chargement...
        </div>
      </section>
    )

  }




  if (error) {

    return (
      <section className="page-section">
        <div className="glass media-grid-empty">
          {error}
        </div>
      </section>
    )

  }





  return (

    <section className="page-section">


      <div className="page-section-header">

        <h1>
          Timeline
        </h1>


        {level !== 'year' && (

          <button
            type="button"
            className="glass-button"
            onClick={goBack}
          >
            ← Retour
          </button>

        )}

      </div>





      {level === 'year' && (

        Object.entries(years)
          .sort(
            ([a], [b]) =>
              Number(b) - Number(a),
          )
          .map(
            ([year, items]) => (

              <TimelineGroupCard

                key={year}

                title={year}

                media={items}

                subtitle={
                  `${items.length} souvenirs`
                }

                onClick={() => {

                  setSelectedYear(
                    Number(year),
                  )

                  setLevel('month')

                }}

              />

            ),
          )

      )}







      {level === 'month' && (

        Object.entries(months)
          .sort(
            ([a], [b]) =>
              Number(b) - Number(a),
          )
          .map(
            ([month, items]) => (

              <TimelineGroupCard

                key={month}

                title={
                  getMonthName(
                    Number(month),
                  )
                }

                media={items}

                subtitle={
                  `${items.length} souvenirs`
                }

                onClick={() => {

                  setSelectedMonth(
                    Number(month),
                  )

                  setLevel('day')

                }}

              />

            ),
          )

      )}







      {level === 'day' && (

        Object.entries(days)
          .map(
            ([day, items]) => (

              <article
                key={day}
                className="timeline-group"
              >

                <h2 className="timeline-title">
                  {day}
                </h2>


                <div className="media-grid">

                  {items.map((item) => (

                    <MediaCard

                      key={item.id}

                      media={item}

                      mediaList={media}

                      onClick={() =>
                        onMediaClick?.(
                          item,
                          media,
                        )
                      }

                    />

                  ))}

                </div>


              </article>

            ),
          )

      )}


    </section>

  )

}
