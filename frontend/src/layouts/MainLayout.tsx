import type { ReactNode } from 'react'

import { Header } from '../components/layout/Header'
import { MobileNav } from '../components/layout/MobileNav'
import { Sidebar } from '../components/layout/Sidebar'
import type { MediaSearchFilters } from '../types/mediaSearch'

type UserInfo = {
  username?: string
  email?: string
  display_name?: string
}

type MainLayoutProps = {
  activePage: string
  onNavigate: (page: string) => void
  onUpload: () => void
  onSettings: () => void
  onLogout: () => void
  searchQuery: string
  onSearchChange: (value: string) => void
  onSearchSubmit: () => void
  searchFilters: MediaSearchFilters
  onSearchFiltersChange: (filters: MediaSearchFilters) => void
  children: ReactNode
  user?: UserInfo
}

export function MainLayout({
  activePage,
  onNavigate,
  onUpload,
  onSettings,
  onLogout,
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  searchFilters,
  onSearchFiltersChange,
  children,
  user,
}: MainLayoutProps) {
  const cameraMode = activePage === 'camera'

  return (
    <div className={`mediahub-layout ${cameraMode ? 'mediahub-layout-camera' : ''}`}>
      {!cameraMode && (
        <Sidebar
          activePage={activePage}
          onNavigate={onNavigate}
          onUpload={onUpload}
          user={user}
        />
      )}

      <div className="main-area">
        {!cameraMode && (
          <Header
            onUpload={onUpload}
            onSettings={onSettings}
            onLogout={onLogout}
            searchQuery={searchQuery}
            onSearchChange={onSearchChange}
            onSearchSubmit={onSearchSubmit}
            searchFilters={searchFilters}
            onSearchFiltersChange={onSearchFiltersChange}
            user={user}
          />
        )}

        <main className={`page-content fade-in ${cameraMode ? 'camera-page-content' : ''}`}>
          {children}
        </main>
      </div>

      {!cameraMode && (
        <MobileNav
          activePage={activePage}
          onNavigate={onNavigate}
        />
      )}
    </div>
  )
}
