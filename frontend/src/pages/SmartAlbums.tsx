import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import { getMedia } from '../services/media'

import type { Media } from '../types/media'

import { MediaCard } from '../components/media/MediaCard'
import { TimelineGroupCard } from '../components/timeline/TimelineGroupCard'
import { t } from '../lib/i18n'
import type { MediaSearchFilters } from '../types/mediaSearch'


type SmartAlbumsProps = {
  refreshKey?: number
  searchQuery?: string
  searchFilters: MediaSearchFilters
  onMediaClick?: (
    media: Media,
    mediaList: Media[],
  ) => void
}


type CollectionLevel =
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
    document.documentElement.lang || 'fr',
    {
      month: 'long',
    },
  )
}


export function SmartAlbums({
  refreshKey = 0,
  searchQuery = '',
  searchFilters,
  onMediaClick,
}: SmartAlbumsProps) {


  const [media, setMedia] =
    useState<Media[]>([])


  const [loading, setLoading] =
    useState(true)


  const [error, setError] =
    useState<string | null>(null)


  const [level, setLevel] =
    useState<CollectionLevel>('year')


  const [selectedYear, setSelectedYear] =
    useState<number | null>(null)


  const [selectedMonth, setSelectedMonth] =
    useState<number | null>(null)



  useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => {
      void load()
    }, searchQuery.trim() ? 250 : 0)

    async function load() {

      try {
        setLoading(true)
        setError(null)

        const data =
          await getMedia(false, {
            search: searchQuery.trim() || undefined,
            ...searchFilters,
          })

        if (active) {
          setMedia(data)
          setError(null)
        }

      } catch (err) {

        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : 'Erreur',
          )
        }

      } finally {

        if (active) {
          setLoading(false)
        }

      }

    }


    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [refreshKey, searchQuery, searchFilters])



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
            document.documentElement.lang || 'fr',
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
          {t('Albums intelligents', 'Smart albums')}
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
                  `${items.length} ${t('souvenirs', 'memories')}`
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
                  `${items.length} ${t('souvenirs', 'memories')}`
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
