import { useEffect, useState } from 'react'

import './App.css'
import './mediahub-design.css'

import { UploadModal } from './components/media/UploadModal'
import { MediaViewer } from './components/media/MediaViewer'
import { FavoriteCelebration } from './components/ui/FavoriteCelebration'

import { MainLayout } from './layouts/MainLayout'
import { useAuth } from './hooks/useAuth'

import { Albums } from './pages/Albums'
import { Dashboard } from './pages/Dashboard'
import { Duplicates } from './pages/Duplicates'
import { Favorites } from './pages/Favorites'
import { Groups } from './pages/Groups'
import { Login } from './pages/Login'
import { Photos } from './pages/Photos'
import { PublicShare } from './pages/PublicShare'
import { Register } from './pages/Register'
import { Settings } from './pages/Settings'
import { Shares } from './pages/Shares'
import { SmartAlbums } from './pages/SmartAlbums'
import { Trash } from './pages/Trash'
import { Videos } from './pages/Videos'
import { Camera } from './pages/Camera'

import type { Media } from './types/media'
import type { MediaSearchFilters } from './types/mediaSearch'
import { clearCachedUserPreferences, getUserPreferences } from './services/users'
import { clearMediaCache } from './services/media'
import { applyAuroraSettings, getAuroraSettings } from './lib/aurora'


type Page =
  | 'dashboard'
  | 'photos'
  | 'videos'
  | 'camera'
  | 'albums'
  | 'smart-albums'
  | 'favorites'
  | 'groups'
  | 'shares'
  | 'trash'
  | 'duplicates'
  | 'settings'


type AuthPage =
  | 'login'
  | 'register'


function App() {
  const publicShareToken =
    window.location.pathname.match(/^\/share\/([a-zA-Z0-9_-]+)\/?$/)?.[1]

  const {
    isAuthenticated,
    loading,
    user,
    login,
    register,
    logout,
    updateUser,
  } = useAuth()


  const [activePage, setActivePage] =
    useState<Page>('dashboard')

  const [searchQuery, setSearchQuery] = useState('')
  const [searchFilters, setSearchFilters] =
    useState<MediaSearchFilters>({})

  const [authPage, setAuthPage] =
    useState<AuthPage>('login')


  const [uploadOpen, setUploadOpen] =
    useState(false)


  const [mediaRefreshKey, setMediaRefreshKey] =
    useState(0)


  const [selectedMedia, setSelectedMedia] =
    useState<Media | null>(null)


  const [viewerMediaList, setViewerMediaList] =
    useState<Media[]>([])

  useEffect(() => {
    applyAuroraSettings(getAuroraSettings())
  }, [])

  useEffect(() => {
    let active = true
    const colorScheme = window.matchMedia('(prefers-color-scheme: dark)')
    let selectedTheme: 'light' | 'dark' | 'system' = 'dark'

    const applyTheme = () => {
      if (!active) {
        return
      }

      const resolved =
        selectedTheme === 'system'
          ? colorScheme.matches
            ? 'dark'
            : 'light'
          : selectedTheme

      document.documentElement.dataset.theme = resolved
    }

    const handleSystemThemeChange = () => {
      if (selectedTheme === 'system') {
        applyTheme()
      }
    }

    colorScheme.addEventListener('change', handleSystemThemeChange)

    if (!isAuthenticated) {
      document.documentElement.lang = 'fr'
      applyTheme()
    } else {
      void getUserPreferences()
        .then((preferences) => {
          selectedTheme = preferences.theme
        document.documentElement.lang = preferences.language
        applyTheme()
          clearMediaCache()
          setMediaRefreshKey((value) => value + 1)
        })
        .catch(() => {
          clearCachedUserPreferences()
          selectedTheme = 'system'
          applyTheme()
        })
    }

    const handleThemePreference = (event: Event) => {
      const preferenceEvent =
        event as CustomEvent<'light' | 'dark' | 'system'>
      selectedTheme = preferenceEvent.detail
      applyTheme()
    }

    window.addEventListener(
      'mediahub:theme-change',
      handleThemePreference,
    )

    return () => {
      active = false
      colorScheme.removeEventListener('change', handleSystemThemeChange)
      window.removeEventListener(
        'mediahub:theme-change',
        handleThemePreference,
      )
    }
  }, [isAuthenticated, user?.id])

  if (publicShareToken) {
    return <PublicShare token={publicShareToken} />
  }

  /*
   * ========================================================
   * CHARGEMENT DE LA SESSION
   * ========================================================
   */

  if (loading) {
    return (
      <div className="auth-loading">

        <div className="auth-loading-card glass">

          <div className="brand-mark">
            M
          </div>

          <h2>
            MediaHub
          </h2>

          <p className="text-secondary">
            Vérification de la session...
          </p>

        </div>

      </div>
    )
  }


  /*
   * ========================================================
   * AUTHENTIFICATION
   * ========================================================
   */

  if (!isAuthenticated) {

    if (authPage === 'login') {

      return (
        <Login
          onRegister={() =>
            setAuthPage('register')
          }
          onLogin={login}
        />
      )
    }


    return (
      <Register
        onLogin={() =>
          setAuthPage('login')
        }
        onRegister={register}
      />
    )
  }


  /*
   * ========================================================
   * NAVIGATION
   * ========================================================
   */

  const handleNavigate = (
    page: string,
  ) => {

    setUploadOpen(false)
    setActivePage(
      page as Page,
    )

  }

  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
  }

  const handleSearchFiltersChange = (filters: MediaSearchFilters) => {
    setSearchFilters(filters)
    if (Object.values(filters).some((value) => value !== undefined)) {
      setActivePage('dashboard')
    }
  }

  const handleSearchSubmit = () => {
    if (
      searchQuery.trim() ||
      Object.values(searchFilters).some((value) => value !== undefined)
    ) {
      setActivePage('dashboard')
    }
  }


  /*
   * ========================================================
   * UPLOAD
   * ========================================================
   */

  const handleUpload = () => {

    setUploadOpen(true)

  }


  /*
   * ========================================================
   * OUVERTURE D'UN MEDIA
   * ========================================================
   */

  const handleOpenMedia = (
    media: Media,
    mediaList: Media[],
  ) => {

    setViewerMediaList(
      mediaList,
    )

    setSelectedMedia(
      media,
    )

  }


  /*
   * ========================================================
   * RENDU DES PAGES
   * ========================================================
   */

  const renderPage = () => {

    switch (activePage) {

      case 'dashboard':
        return (
          <Dashboard
            onNavigate={handleNavigate}
            refreshKey={mediaRefreshKey}
            searchQuery={searchQuery}
            searchFilters={searchFilters}
            onMediaClick={handleOpenMedia}
          />
        )


      case 'photos':
        return (
          <Photos
            onUpload={handleUpload}
            refreshKey={mediaRefreshKey}
            searchQuery={searchQuery}
            searchFilters={searchFilters}
            onMediaClick={handleOpenMedia}
          />
        )


      case 'videos':
        return (
          <Videos
            refreshKey={mediaRefreshKey}
            searchQuery={searchQuery}
            searchFilters={searchFilters}
            onMediaClick={handleOpenMedia}
          />
        )

      case 'camera':
        return (
          <Camera
            onExit={() => handleNavigate('dashboard')}
            onUploaded={() => setMediaRefreshKey((value) => value + 1)}
          />
        )


      case 'albums':
        return (
          <Albums
            onMediaClick={handleOpenMedia}
          />
        )


      case 'smart-albums':
        return (
          <SmartAlbums
            refreshKey={mediaRefreshKey}
            searchQuery={searchQuery}
            searchFilters={searchFilters}
            onMediaClick={handleOpenMedia}
          />
        )


      case 'favorites':
        return (
          <Favorites
            searchQuery={searchQuery}
            searchFilters={searchFilters}
            onMediaClick={handleOpenMedia}
          />
        )


      case 'groups':
        return (
          <Groups />
        )


      case 'shares':
        return (
          <Shares
            searchQuery={searchQuery}
            onMediaClick={handleOpenMedia}
          />
        )

      case 'trash':
        return <Trash />

      case 'duplicates':
        return (
          <Duplicates
            onMediaClick={handleOpenMedia}
            onMediaDeleted={() =>
              setMediaRefreshKey((value) => value + 1)
            }
          />
        )


      case 'settings':
        return (
          <Settings
            user={user}
            onLogout={logout}
            onProfileSaved={updateUser}
            onPreferencesSaved={() =>
              setMediaRefreshKey((value) => value + 1)
            }
          />
        )


      default:
        return (
          <Dashboard
            onNavigate={handleNavigate}
            refreshKey={mediaRefreshKey}
            searchFilters={searchFilters}
            onMediaClick={handleOpenMedia}
          />
        )
    }
  }


  /*
   * ========================================================
   * APPLICATION
   * ========================================================
   */

  return (
    <MainLayout
      activePage={activePage}
      onNavigate={handleNavigate}
      onUpload={handleUpload}
      onSettings={() => handleNavigate('settings')}
      onLogout={logout}
      searchQuery={searchQuery}
      onSearchChange={handleSearchChange}
      onSearchSubmit={handleSearchSubmit}
      searchFilters={searchFilters}
      onSearchFiltersChange={handleSearchFiltersChange}
      user={user ?? undefined}
    >

      {renderPage()}
      {!selectedMedia && <FavoriteCelebration />}


      {/* ==================================================
          UPLOAD MODAL
      ================================================== */}

      {uploadOpen && (
        <UploadModal
          open={uploadOpen}

          onClose={() =>
            setUploadOpen(false)
          }

          onUploaded={() => {

            setUploadOpen(false)

            setMediaRefreshKey(
              (value) =>
                value + 1,
            )

          }}
        />
      )}


      {/* ==================================================
          MEDIA VIEWER
      ================================================== */}

      {selectedMedia && (
        <MediaViewer
          media={selectedMedia}
          mediaList={viewerMediaList}
          onChange={setSelectedMedia}

          onDelete={() => {
            setMediaRefreshKey((value) => value + 1)
          }}

          onClose={() => {

            setSelectedMedia(null)

            setViewerMediaList([])

          }}
        />
      )}

    </MainLayout>
  )
}


export default App
