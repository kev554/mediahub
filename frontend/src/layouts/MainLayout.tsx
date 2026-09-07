import type { ReactNode } from 'react'

import { Header } from '../components/layout/Header'
import { MobileNav } from '../components/layout/MobileNav'
import { Sidebar } from '../components/layout/Sidebar'

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
  children: ReactNode
  user?: UserInfo
}

export function MainLayout({
  activePage,
  onNavigate,
  onUpload,
  onSettings,
  onLogout,
  children,
  user,
}: MainLayoutProps) {
  return (
    <div className="mediahub-layout">
      <Sidebar
        activePage={activePage}
        onNavigate={onNavigate}
        user={user}
      />

      <div className="main-area">
        <Header
          onUpload={onUpload}
          onSettings={onSettings}
          onLogout={onLogout}
        />

        <main className="page-content fade-in">
          {children}
        </main>
      </div>

      <MobileNav
        activePage={activePage}
        onNavigate={onNavigate}
      />
    </div>
  )
}
