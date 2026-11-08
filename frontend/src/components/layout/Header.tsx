import { useEffect, useRef, useState } from 'react'
import {
  CalendarDays,
  Filter,
  WifiOff,
  Search,
  LogOut,
  UserRound,
} from 'lucide-react'
import { t } from '../../lib/i18n'
import { getAlbums } from '../../services/albums'
import type { Album } from '../../types/album'
import type { MediaSearchFilters } from '../../types/mediaSearch'

type HeaderProps = {
  onUpload: () => void
  onSettings?: () => void
  onLogout?: () => void
  searchQuery: string
  onSearchChange: (value: string) => void
  onSearchSubmit: () => void
  searchFilters: MediaSearchFilters
  onSearchFiltersChange: (filters: MediaSearchFilters) => void
  user?: {
    username?: string
    display_name?: string
    email?: string
  }
}

export function Header({
  onUpload,
  onSettings,
  onLogout,
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  searchFilters,
  onSearchFiltersChange,
  user,
}: HeaderProps) {
  const [accountMenuOpen, setAccountMenuOpen] =
    useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [albums, setAlbums] = useState<Album[]>([])
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  const accountMenuRef =
    useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const displayName = user?.display_name ?? user?.username ?? t('Compte', 'Account')
  const userInitial = displayName.charAt(0).toUpperCase()

  useEffect(() => {
    function handleSearchShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchInputRef.current?.focus()
      }
    }

    window.addEventListener('keydown', handleSearchShortcut)
    return () => window.removeEventListener('keydown', handleSearchShortcut)
  }, [])

  useEffect(() => {
    const updateOnlineState = () => setIsOnline(navigator.onLine)
    window.addEventListener('online', updateOnlineState)
    window.addEventListener('offline', updateOnlineState)
    return () => {
      window.removeEventListener('online', updateOnlineState)
      window.removeEventListener('offline', updateOnlineState)
    }
  }, [])

  useEffect(() => {
    let active = true
    void getAlbums()
      .then((items) => {
        if (active) setAlbums(items)
      })
      .catch((error: unknown) => {
        console.error('Unable to load albums for search filters.', error)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        accountMenuRef.current &&
        !accountMenuRef.current.contains(
          event.target as Node,
        )
      ) {
        setAccountMenuOpen(false)
      }
    }

    document.addEventListener(
      'mousedown',
      handleClickOutside,
    )

    return () => {
      document.removeEventListener(
        'mousedown',
        handleClickOutside,
      )
    }
  }, [])

  function handleSettings() {
    setAccountMenuOpen(false)
    onSettings?.()
  }

  function handleLogout() {
    setAccountMenuOpen(false)
    onLogout?.()
  }

  return (
    <header className="topbar">
      <form
        className="search-box glass"
        role="search"
        onSubmit={(event) => {
          event.preventDefault()
          onSearchSubmit()
        }}
      >
        <span className="search-icon">
          <Search size={17} strokeWidth={1.8} aria-hidden="true" />
        </span>

        <input
          ref={searchInputRef}
          type="search"
          placeholder={t('Rechercher dans ma bibliothèque…', 'Search your library…')}
          aria-label={t('Rechercher', 'Search')}
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
        />

        <button
          type="button"
          className={`advanced-search-toggle ${filtersOpen ? 'active' : ''}`}
          aria-label={t('Filtres avancés', 'Advanced filters')}
          aria-expanded={filtersOpen}
          onClick={() => setFiltersOpen((open) => !open)}
        >
          <Filter size={17} aria-hidden="true" />
          <span>{t('Filtres', 'Filters')}</span>
        </button>

        {filtersOpen && (
          <div className="advanced-search-panel" role="group" aria-label={t('Filtres avancés', 'Advanced filters')}>
            <label>
              <span>{t('Type de média', 'Media type')}</span>
              <select
                value={searchFilters.media_type ?? ''}
                onChange={(event) => onSearchFiltersChange({
                  ...searchFilters,
                  media_type: event.target.value
                    ? event.target.value as 'image' | 'video'
                    : undefined,
                })}
              >
                <option value="">{t('Tous les types', 'All types')}</option>
                <option value="image">{t('Photos', 'Photos')}</option>
                <option value="video">{t('Vidéos', 'Videos')}</option>
              </select>
            </label>

            <label>
              <span>{t('Album', 'Album')}</span>
              <select
                value={searchFilters.album_id ?? ''}
                onChange={(event) => onSearchFiltersChange({
                  ...searchFilters,
                  album_id: event.target.value ? Number(event.target.value) : undefined,
                })}
              >
                <option value="">{t('Tous les albums', 'All albums')}</option>
                {albums.map((album) => (
                  <option key={album.id} value={album.id}>{album.name}</option>
                ))}
              </select>
            </label>

            <label>
              <span>{t('Du', 'From')}</span>
              <span className="advanced-search-date">
                <CalendarDays size={15} aria-hidden="true" />
                <input
                  type="date"
                  value={searchFilters.start_date ?? ''}
                  max={searchFilters.end_date}
                  onChange={(event) => onSearchFiltersChange({
                    ...searchFilters,
                    start_date: event.target.value || undefined,
                  })}
                />
              </span>
            </label>

            <label>
              <span>{t('Au', 'To')}</span>
              <span className="advanced-search-date">
                <CalendarDays size={15} aria-hidden="true" />
                <input
                  type="date"
                  value={searchFilters.end_date ?? ''}
                  min={searchFilters.start_date}
                  onChange={(event) => onSearchFiltersChange({
                    ...searchFilters,
                    end_date: event.target.value || undefined,
                  })}
                />
              </span>
            </label>

            <label className="advanced-search-favorite">
              <input
                type="checkbox"
                checked={searchFilters.favorite === true}
                onChange={(event) => onSearchFiltersChange({
                  ...searchFilters,
                  favorite: event.target.checked ? true : undefined,
                })}
              />
              <span>{t('Favoris uniquement', 'Favorites only')}</span>
            </label>

            <button
              type="button"
              className="advanced-search-clear"
              onClick={() => onSearchFiltersChange({})}
            >
              {t('Effacer les filtres', 'Clear filters')}
            </button>
          </div>
        )}

        <kbd>Ctrl K</kbd>
      </form>

      <div className="topbar-actions">
        {!isOnline && (
          <span className="offline-status" role="status">
            <WifiOff size={15} aria-hidden="true" />
            {t('Hors ligne', 'Offline')}
          </span>
        )}
        <button
          type="button"
          className="upload-button"
          onClick={onUpload}
        >
          <span>＋</span>
          <span>{t('Importer', 'Upload')}</span>
        </button>

        <div
          className="header-account"
          ref={accountMenuRef}
        >
          <button
            type="button"
            className={
              accountMenuOpen
                ? 'header-avatar active'
                : 'header-avatar'
            }
            aria-label={t('Ouvrir le menu du compte', 'Open account menu')}
            aria-haspopup="menu"
            aria-expanded={accountMenuOpen}
            onClick={() =>
              setAccountMenuOpen(
                (current) => !current,
              )
            }
          >
            {userInitial}
          </button>

          {accountMenuOpen && (
            <div
              className="account-menu glass"
              role="menu"
            >
              <div className="account-menu-header">
                <div className="account-menu-avatar">
                  {userInitial}
                </div>

                <div className="account-menu-user">
                  <strong>
                    {displayName}
                  </strong>

                  {user?.email && <span>{user.email}</span>}
                </div>
              </div>

              <div className="account-menu-divider" />

              <button
                type="button"
                className="account-menu-item"
                role="menuitem"
                onClick={handleSettings}
              >
                <span className="account-menu-icon">
                  <UserRound size={16} strokeWidth={1.8} aria-hidden="true" />
                </span>

                <span>{t('Mon compte', 'My account')}</span>
              </button>

              <div className="account-menu-divider" />

              <button
                type="button"
                className="account-menu-item account-menu-logout"
                role="menuitem"
                onClick={handleLogout}
              >
                <span className="account-menu-icon">
                  <LogOut size={16} strokeWidth={1.8} aria-hidden="true" />
                </span>

                <span>{t('Déconnexion', 'Log out')}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
