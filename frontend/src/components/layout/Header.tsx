import { useEffect, useRef, useState } from 'react'

type HeaderProps = {
  onUpload: () => void
  onSettings?: () => void
  onLogout?: () => void
}

export function Header({
  onUpload,
  onSettings,
  onLogout,
}: HeaderProps) {
  const [accountMenuOpen, setAccountMenuOpen] =
    useState(false)

  const accountMenuRef =
    useRef<HTMLDivElement>(null)

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
      <div className="search-box glass">
        <span className="search-icon">
          ⌕
        </span>

        <input
          type="search"
          placeholder="Rechercher dans MediaHub..."
          aria-label="Rechercher"
        />

        <kbd>⌘ K</kbd>
      </div>

      <div className="topbar-actions">
        <button
          type="button"
          className="upload-button"
          onClick={onUpload}
        >
          <span>＋</span>
          <span>Importer</span>
        </button>

        <button
          type="button"
          className="icon-button glass"
          aria-label="Notifications"
        >
          ♢
          <span className="notification-dot" />
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
            aria-label="Ouvrir le menu du compte"
            aria-haspopup="menu"
            aria-expanded={accountMenuOpen}
            onClick={() =>
              setAccountMenuOpen(
                (current) => !current,
              )
            }
          >
            K
          </button>

          {accountMenuOpen && (
            <div
              className="account-menu glass"
              role="menu"
            >
              <div className="account-menu-header">
                <div className="account-menu-avatar">
                  K
                </div>

                <div className="account-menu-user">
                  <strong>
                    Mon compte
                  </strong>

                  <span>
                    MediaHub
                  </span>
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
                  ⚙
                </span>

                <span>
                  Paramètres du compte
                </span>
              </button>

              <button
                type="button"
                className="account-menu-item"
                role="menuitem"
                onClick={handleSettings}
              >
                <span className="account-menu-icon">
                  🔒
                </span>

                <span>
                  Sécurité
                </span>
              </button>

              <div className="account-menu-divider" />

              <button
                type="button"
                className="account-menu-item account-menu-logout"
                role="menuitem"
                onClick={handleLogout}
              >
                <span className="account-menu-icon">
                  ↪
                </span>

                <span>
                  Déconnexion
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
