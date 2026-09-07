import {
  useEffect,
  useState,
} from 'react'

import { getMedia } from '../services/media'
import { getAlbums } from '../services/albums'
import { getGroups } from '../services/groups'

import { QuickActions } from '../components/dashboard/QuickActions'
import { RecentMedia } from '../components/dashboard/RecentMedia'
import { StatCard } from '../components/dashboard/StatCard'

import type { Media } from '../types/media'

type DashboardProps = {
  onNavigate: (page: string) => void
  onUpload: () => void
}

export function Dashboard({
  onNavigate,
  onUpload,
}: DashboardProps) {
  const [media, setMedia] = useState<Media[]>([])
  const [albumCount, setAlbumCount] = useState(0)
  const [groupCount, setGroupCount] = useState(0)

  const [mediaLoading, setMediaLoading] = useState(true)
  const [albumLoading, setAlbumLoading] = useState(true)
  const [groupLoading, setGroupLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function loadMedia() {
      try {
        const result = await getMedia()

        if (!cancelled) {
          setMedia(result)
        }
      } catch (error) {
        console.error(
          'Erreur chargement médias :',
          error,
        )
      } finally {
        if (!cancelled) {
          setMediaLoading(false)
        }
      }
    }

    async function loadAlbums() {
      try {
        const result = await getAlbums()

        if (!cancelled) {
          setAlbumCount(result.length)
        }
      } catch (error) {
        console.error(
          'Erreur chargement albums :',
          error,
        )
      } finally {
        if (!cancelled) {
          setAlbumLoading(false)
        }
      }
    }

    async function loadGroups() {
      try {
        const result = await getGroups()

        if (!cancelled) {
          setGroupCount(result.length)
        }
      } catch (error) {
        console.error(
          'Erreur chargement groupes :',
          error,
        )
      } finally {
        if (!cancelled) {
          setGroupLoading(false)
        }
      }
    }

    void loadMedia()
    void loadAlbums()
    void loadGroups()

    return () => {
      cancelled = true
    }
  }, [])

  const photoCount = media.filter(
    (item) => item.media_type === 'image',
  ).length

  const videoCount = media.filter(
    (item) => item.media_type === 'video',
  ).length

  return (
    <div className="dashboard-page">

      {/* =====================================================
          HERO
      ===================================================== */}

      <section className="dashboard-hero glass fade-in">

        <div className="dashboard-hero-content">

          <span className="dashboard-eyebrow">
            MEDIAHUB
          </span>

          <h1>
            Ton espace média,
            <br />
            <span>tout au même endroit.</span>
          </h1>

          <p className="text-secondary">
            Retrouve tes photos, vidéos, albums et
            souvenirs dans un espace personnel,
            moderne et sécurisé.
          </p>

          <div className="dashboard-actions">

            <button
              type="button"
              className="accent-button"
              onClick={onUpload}
            >
              <span>＋</span>
              <span>Importer un média</span>
            </button>

            <button
              type="button"
              className="glass-button"
              onClick={() => onNavigate('albums')}
            >
              Voir mes albums
            </button>

          </div>

        </div>

        <div className="dashboard-orb">
          <div className="dashboard-orb-inner">
            M
          </div>
        </div>

      </section>

      {/* =====================================================
          STATISTIQUES
      ===================================================== */}

      <section className="dashboard-stats">

        <StatCard
          icon="▧"
          value={mediaLoading ? '…' : photoCount}
          label="Photos"
          onClick={() => onNavigate('photos')}
        />

        <StatCard
          icon="▶"
          value={mediaLoading ? '…' : videoCount}
          label="Vidéos"
          onClick={() => onNavigate('videos')}
        />

        <StatCard
          icon="◇"
          value={albumLoading ? '…' : albumCount}
          label="Albums"
          onClick={() => onNavigate('albums')}
        />

        <StatCard
          icon="♧"
          value={groupLoading ? '…' : groupCount}
          label="Groupes"
          onClick={() => onNavigate('groups')}
        />

      </section>

      {/* =====================================================
          CONTENU PRINCIPAL
      ===================================================== */}

      <section className="dashboard-grid">

        <RecentMedia
          media={media}
          loading={mediaLoading}
          onNavigate={onNavigate}
          onUpload={onUpload}
        />

        <QuickActions
          onNavigate={onNavigate}
        />

      </section>

    </div>
  )
}
