import { useState } from 'react'

import './App.css'

import { UploadModal } from './components/media/UploadModal'
import { MediaViewer } from './components/media/MediaViewer'

import { MainLayout } from './layouts/MainLayout'
import { useAuth } from './hooks/useAuth'

import { Albums } from './pages/Albums'
import { Dashboard } from './pages/Dashboard'
import { Favorites } from './pages/Favorites'
import { Groups } from './pages/Groups'
import { Login } from './pages/Login'
import { Photos } from './pages/Photos'
import { Register } from './pages/Register'
import { Settings } from './pages/Settings'
import { Shares } from './pages/Shares'
import { Timeline } from './pages/Timeline'
import { Videos } from './pages/Videos'

import type { Media } from './types/media'


type Page =
  | 'dashboard'
  | 'photos'
  | 'videos'
  | 'albums'
  | 'timeline'
  | 'favorites'
  | 'groups'
  | 'shares'
  | 'settings'


type AuthPage =
  | 'login'
  | 'register'


function App() {

  const {
    isAuthenticated,
    loading,
    user,
    login,
    register,
    logout,
  } = useAuth()


  const [activePage, setActivePage] =
    useState<Page>('dashboard')


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

    setActivePage(
      page as Page,
    )

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
            onUpload={handleUpload}
          />
        )


      case 'photos':
        return (
          <Photos
            onUpload={handleUpload}
            refreshKey={mediaRefreshKey}
            onMediaClick={handleOpenMedia}
          />
        )


      case 'videos':
        return (
          <Videos
            onUpload={handleUpload}
            refreshKey={mediaRefreshKey}
            onMediaClick={handleOpenMedia}
          />
        )


      case 'albums':
        return (
          <Albums
            onMediaClick={handleOpenMedia}
          />
        )


      case 'timeline':
        return (
          <Timeline
            onMediaClick={handleOpenMedia}
          />
        )


      case 'favorites':
        return (
          <Favorites />
        )


      case 'groups':
        return (
          <Groups />
        )


      case 'shares':
        return (
          <Shares
            onMediaClick={handleOpenMedia}
          />
        )


      case 'settings':
        return (
          <Settings
            user={user}
            onLogout={logout}
          />
        )


      default:
        return (
          <Dashboard
            onNavigate={handleNavigate}
            onUpload={handleUpload}
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
      onSettings={() => setActivePage('settings')}
      onLogout={logout}
      user={user ?? undefined}
    >

      {renderPage()}


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

          onDelete={(item) => {

            console.log(
              'suppression média',
              item.id,
            )

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

