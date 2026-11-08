import type { Media } from '../types/media'
import { t } from './i18n'

export type SmartAlbumGroup = {
  id: string
  title: string
  media: Media[]
  sortYear: number
  sortPart: number
}

const locale = () => document.documentElement.lang || 'fr'

const holidayDefinitions = [
  {
    id: 'cameroon-new-year',
    title: ['Nouvel An · Cameroun', 'New Year · Cameroon'],
    country: 'CM',
    dates: ['01-01'],
  },
  {
    id: 'cameroon-youth-day',
    title: ['Fête de la Jeunesse · Cameroun', 'Youth Day · Cameroon'],
    country: 'CM',
    dates: ['02-11'],
  },
  {
    id: 'cameroon-labour-day',
    title: ['Fête du Travail · Cameroun', 'Labour Day · Cameroon'],
    country: 'CM',
    dates: ['05-01'],
  },
  {
    id: 'cameroon-national-day',
    title: ['Fête nationale · Cameroun', 'National Day · Cameroon'],
    country: 'CM',
    dates: ['05-20'],
  },
  {
    id: 'cameroon-christmas',
    title: ['Noël · Cameroun', 'Christmas · Cameroon'],
    country: 'CM',
    dates: ['12-24', '12-25', '12-26'],
  },
  {
    id: 'russia-new-year',
    title: ['Vacances du Nouvel An · Russie', 'New Year holidays · Russia'],
    country: 'RU',
    dates: ['01-01', '01-02', '01-03', '01-04', '01-05', '01-06', '01-07', '01-08'],
  },
  {
    id: 'russia-christmas',
    title: ['Noël orthodoxe · Russie', 'Orthodox Christmas · Russia'],
    country: 'RU',
    dates: ['01-06', '01-07', '01-08'],
  },
  {
    id: 'russia-defender-day',
    title: ['Fête du Défenseur de la patrie · Russie', 'Defender of the Fatherland Day · Russia'],
    country: 'RU',
    dates: ['02-23'],
  },
  {
    id: 'russia-womens-day',
    title: ['Journée des femmes · Russie', "Women's Day · Russia"],
    country: 'RU',
    dates: ['03-08'],
  },
  {
    id: 'russia-labour-day',
    title: ['Fête du Travail · Russie', 'Spring and Labour Day · Russia'],
    country: 'RU',
    dates: ['05-01'],
  },
  {
    id: 'russia-victory-day',
    title: ['Jour de la Victoire · Russie', 'Victory Day · Russia'],
    country: 'RU',
    dates: ['05-09'],
  },
  {
    id: 'russia-day',
    title: ['Jour de la Russie', 'Russia Day'],
    country: 'RU',
    dates: ['06-12'],
  },
  {
    id: 'russia-unity-day',
    title: ['Jour de l’Unité nationale · Russie', 'Unity Day · Russia'],
    country: 'RU',
    dates: ['11-04'],
  },
]

function mediaDate(media: Media): Date | null {
  const date = new Date(media.taken_at ?? media.uploaded_at)
  return Number.isNaN(date.getTime()) ? null : date
}

function createGroups(
  media: Media[],
  getGroup: (media: Media, date: Date) => Omit<SmartAlbumGroup, 'media'> | null,
): SmartAlbumGroup[] {
  const groups = new Map<string, SmartAlbumGroup>()
  for (const item of media) {
    const date = mediaDate(item)
    if (!date) continue
    const group = getGroup(item, date)
    if (!group) continue
    const existing = groups.get(group.id)
    if (existing) existing.media.push(item)
    else groups.set(group.id, { ...group, media: [item] })
  }
  return Array.from(groups.values()).sort(
    (a, b) => b.sortYear - a.sortYear || b.sortPart - a.sortPart,
  )
}

export function createMonthlySmartAlbums(media: Media[]): SmartAlbumGroup[] {
  return createGroups(media, (_item, date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const id = `month-${year}-${String(month + 1).padStart(2, '0')}`
    return {
      id,
      title: date.toLocaleDateString(locale(), { month: 'long', year: 'numeric' }),
      sortYear: year,
      sortPart: month,
    }
  })
}

export function createSeasonSmartAlbums(media: Media[]): SmartAlbumGroup[] {
  return createGroups(media, (_item, date) => {
    const month = date.getMonth()
    const year = date.getFullYear()
    const season =
      month >= 2 && month <= 4
        ? { key: 'spring', name: t('Printemps', 'Spring'), start: year, part: 0 }
        : month >= 5 && month <= 7
          ? { key: 'summer', name: t('Été', 'Summer'), start: year, part: 1 }
          : month >= 8 && month <= 10
            ? { key: 'autumn', name: t('Automne', 'Autumn'), start: year, part: 2 }
            : { key: 'winter', name: t('Hiver', 'Winter'), start: month === 11 ? year : year - 1, part: 3 }
    const endYear = season.key === 'winter'
      ? season.start + 1
      : season.start
    return {
      id: `season-${season.key}-${season.start}`,
      title: season.key === 'winter'
        ? `${season.name} ${season.start}–${endYear}`
        : `${season.name} ${season.start}`,
      sortYear: season.start,
      sortPart: season.part,
    }
  })
}

export function createHolidaySmartAlbums(media: Media[]): SmartAlbumGroup[] {
  const groups = new Map<string, SmartAlbumGroup>()

  for (const item of media) {
    const date = mediaDate(item)
    if (!date) continue
    const monthDay = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

    for (const holiday of holidayDefinitions) {
      if (!holiday.dates.includes(monthDay)) continue
      const id = `${holiday.id}-${date.getFullYear()}`
      const existing = groups.get(id)
      if (existing) {
        existing.media.push(item)
      } else {
        groups.set(id, {
          id,
          title: `${t(holiday.title[0], holiday.title[1])} ${date.getFullYear()}`,
          media: [item],
          sortYear: date.getFullYear(),
          sortPart: date.getMonth(),
        })
      }
    }
  }

  return Array.from(groups.values()).sort(
    (a, b) => b.sortYear - a.sortYear || b.sortPart - a.sortPart || a.title.localeCompare(b.title),
  )
}
