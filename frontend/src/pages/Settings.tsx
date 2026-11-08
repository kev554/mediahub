import {
  useEffect,
  useState,
} from 'react'

import {
  getUserPreferences,
  getStorageUsage,
  updateProfile,
  updateUserPreferences,
  type StorageUsage,
  type UserPreferences,
  type UserProfile,
} from '../services/users'
import { clearMediaCache } from '../services/media'
import { t } from '../lib/i18n'
import {
  getAuroraSettings,
  saveAuroraSettings,
  type AuroraSettings,
} from '../lib/aurora'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KiB', 'MiB', 'GiB', 'TiB']
  let value = bytes / 1024
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`
}

type SettingsProps = {
  user?: {
    username?: string
    email?: string
    display_name?: string
  } | null

  onLogout: () => void
  onPreferencesSaved?: () => void
  onProfileSaved?: (user: UserProfile) => void
}

function SecurityForm({
  onLogout,
}: {
  onLogout: () => void
}) {

  const [currentPassword, setCurrentPassword] =
    useState('')

  const [newPassword, setNewPassword] =
    useState('')

  const [confirmPassword, setConfirmPassword] =
    useState('')

  const [message, setMessage] =
    useState('')


  async function handleChangePassword() {

    if (newPassword !== confirmPassword) {

      setMessage(
        'Les mots de passe ne correspondent pas ❌',
      )

      return
    }


    try {

      const { changePassword } =
        await import('../services/users')


      await changePassword({

        current_password:
          currentPassword,

        new_password:
          newPassword,

      })


      setMessage(
        'Mot de passe modifié avec succès ✅',
      )


      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')


    } catch {

      setMessage(
        'Mot de passe actuel incorrect ❌',
      )

    }

  }



  return (

    <div>

      <h2>{t('Sécurité du compte', 'Account security')}</h2>


      <div className="setting-form">


        <label>{t('Mot de passe actuel', 'Current password')}</label>

        <input
          className="glass-input"
          type="password"
          value={currentPassword}
          onChange={(e) =>
            setCurrentPassword(e.target.value)
          }
        />


        <label>{t('Nouveau mot de passe', 'New password')}</label>

        <input
          className="glass-input"
          type="password"
          value={newPassword}
          onChange={(e) =>
            setNewPassword(e.target.value)
          }
        />


        <label>{t('Confirmer le nouveau mot de passe', 'Confirm new password')}</label>

        <input
          className="glass-input"
          type="password"
          value={confirmPassword}
          onChange={(e) =>
            setConfirmPassword(e.target.value)
          }
        />


        <button
          className="glass-button primary"
          onClick={handleChangePassword}
        >
          {t('Modifier le mot de passe', 'Update password')}
        </button>

        <button
          className="danger-button"
          onClick={onLogout}
        >
          {t('Déconnexion', 'Log out')}
        </button>
        {
          message && (
            <p className="text-secondary">
              {message}
            </p>
          )
        }


      </div>


    </div>

  )
}
export function Settings({
  user,
  onLogout,
  onPreferencesSaved,
  onProfileSaved,
}: SettingsProps) {


  const [activeTab, setActiveTab] =
    useState('profile')


  const [username, setUsername] =
    useState(user?.username ?? '')

  const [email, setEmail] =
    useState(user?.email ?? '')

  const [displayName, setDisplayName] =
    useState(user?.display_name ?? '')

  const [preferences, setPreferences] =
    useState<UserPreferences>({
      theme: 'dark',
      language: 'fr',
      default_visibility: 'private',
      media_sort: 'uploaded_at',
    })


  const [message, setMessage] =
    useState('')

  const [preferencesLoading, setPreferencesLoading] =
    useState(true)

  const [savingPreferences, setSavingPreferences] =
    useState(false)
  const [storageUsage, setStorageUsage] = useState<StorageUsage | null>(null)
  const [auroraSettings, setAuroraSettings] =
    useState<AuroraSettings>(() => getAuroraSettings())
  const [auroraMessage, setAuroraMessage] = useState('')

  const handleAuroraSettings = (next: AuroraSettings) => {
    try {
      saveAuroraSettings(next)
      setAuroraSettings(next)
      setAuroraMessage(t('Fond animé enregistré sur cet appareil.', 'Animated background saved on this device.'))
    } catch (error) {
      setAuroraMessage(error instanceof Error
        ? t(`Impossible d’enregistrer le fond animé : ${error.message}`, `Could not save animated background: ${error.message}`)
        : t('Impossible d’enregistrer le fond animé.', 'Could not save animated background.'))
    }
  }

  useEffect(() => {
    if (!user) {
      setPreferencesLoading(false)
      return
    }

    let active = true
    void Promise.allSettled([
      getUserPreferences(),
      getStorageUsage(),
    ]).then(([preferencesResult, usageResult]) => {
      if (!active) return

      if (preferencesResult.status === 'fulfilled') {
        setPreferences(preferencesResult.value)
      } else {
        setMessage(
          `Impossible de charger les préférences : ${preferencesResult.reason instanceof Error ? preferencesResult.reason.message : 'erreur inconnue'}`,
        )
      }

      if (usageResult.status === 'fulfilled') {
        setStorageUsage(usageResult.value)
      } else {
        setMessage(
          `Impossible de charger l’utilisation du stockage : ${usageResult.reason instanceof Error ? usageResult.reason.message : 'erreur inconnue'}`,
        )
      }
      setPreferencesLoading(false)
    })

    return () => {
      active = false
    }
  }, [user])


  async function handleSave() {

    try {

      const updatedUser = await updateProfile({
        username,
        email,
        display_name: displayName,
      })

      setUsername(updatedUser.username)
      setEmail(updatedUser.email)
      setDisplayName(updatedUser.display_name)
      onProfileSaved?.(updatedUser)

      setMessage(
        'Profil mis à jour avec succès ✅',
      )


    } catch (error) {

      setMessage(
        error instanceof Error
          ? `Erreur lors de la mise à jour : ${error.message}`
          : 'Erreur lors de la mise à jour ❌',
      )

    }

  }



  return (

    <section className="page-section">


      <h1>{t('Paramètres', 'Settings')}</h1>


      <p className="text-secondary">
        {t('Gérez votre profil, votre confidentialité et vos préférences.', 'Manage your profile, privacy, and preferences.')}
      </p>



      <div className="settings-layout">


        <aside className="settings-menu">


          <button
            className={
              activeTab === 'profile'
                ? 'active'
                : ''
            }
            onClick={() =>
              setActiveTab('profile')
            }
          >
            {t('Profil', 'Profile')}
          </button>



          <button
            className={
              activeTab === 'security'
                ? 'active'
                : ''
            }
            onClick={() =>
              setActiveTab('security')
            }
          >
            {t('Sécurité du compte', 'Account security')}
          </button>



          <button
            className={
              activeTab === 'preferences'
                ? 'active'
                : ''
            }
            onClick={() =>
              setActiveTab('preferences')
            }
          >
            {t('Préférences', 'Preferences')}
          </button>


        </aside>




        <div className="settings-content glass">



          {
            activeTab === 'profile' && (

              <div>

                <h2>{t('Profil', 'Profile')}</h2>



                <div className="setting-form">


                  <label>
                    {t('Nom d’utilisateur', 'Username')}
                  </label>

                  <input
                    className="glass-input"
                    value={username}
                    onChange={(e) =>
                      setUsername(e.target.value)
                    }
                  />



                  <label>
                    {t('Nom affiché', 'Display name')}
                  </label>

                  <input
                    className="glass-input"
                    value={displayName}
                    onChange={(e) =>
                      setDisplayName(e.target.value)
                    }
                  />



                  <label>
                    {t('Adresse e-mail', 'Email')}
                  </label>

                  <input
                    className="glass-input"
                    value={email}
                    onChange={(e) =>
                      setEmail(e.target.value)
                    }
                  />



                  <button
                    className="glass-button primary"
                    onClick={handleSave}
                  >
                    {t('Enregistrer le profil', 'Save profile')}
                  </button>



                  {
                    message && (
                      <p className="text-secondary">
                        {message}
                      </p>
                    )
                  }


                </div>


              </div>

            )
          }



          {activeTab === 'security' && (

             <SecurityForm
                 onLogout={onLogout}
               />

           )}




          {
            activeTab === 'preferences' && (

              <div>

                <h2>
                  {t('Préférences du compte', 'Account preferences')}
                </h2>

                <div className="setting-form">

                  <label>
                    Theme
                  </label>

                  <div className="settings-option-row">
                    <div>
                      <strong>                      {t('Mode sombre', 'Dark mode')}</strong>
                      <small>{t('Utiliser le thème sombre dans MediaHub.', 'Use the dark appearance across MediaHub.')}</small>
                    </div>
                    <button
                      type="button"
                      className={`toggle-switch ${preferences.theme === 'dark' ? 'is-on' : ''}`}
                      role="switch"
                      aria-checked={preferences.theme === 'dark'}
                      aria-label={t('Mode sombre', 'Dark mode')}
                      onClick={() =>
                        setPreferences((current) => ({
                          ...current,
                          theme: current.theme === 'dark' ? 'light' : 'dark',
                        }))
                      }
                    >
                      <span />
                    </button>
                  </div>

                  <button
                    type="button"
                    className="text-button settings-system-theme"
                    onClick={() =>
                      setPreferences((current) => ({
                        ...current,
                        theme: 'system',
                      }))
                    }
                  >
                    {t('Utiliser le thème du système', 'Use system theme')}
                  </button>

                  <label>
                    {t('Ambiance de l’application', 'App atmosphere')}
                  </label>

                  <div className="settings-option-row">
                    <div>
                      <strong>{t('Aurore animée', 'Animated aurora')}</strong>
                      <small>{t('Un halo coloré discret derrière les panneaux.', 'A subtle colored glow behind the panels.')}</small>
                    </div>
                    <button
                      type="button"
                      className={`toggle-switch ${auroraSettings.enabled ? 'is-on' : ''}`}
                      role="switch"
                      aria-checked={auroraSettings.enabled}
                      aria-label={t('Activer le fond aurore', 'Enable aurora background')}
                      onClick={() => handleAuroraSettings({
                        ...auroraSettings,
                        enabled: !auroraSettings.enabled,
                      })}
                    >
                      <span />
                    </button>
                  </div>

                  <label className="aurora-intensity-control">
                    <span>
                      {t('Intensité de l’aurore', 'Aurora intensity')}
                      <strong>{auroraSettings.intensity}%</strong>
                    </span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={auroraSettings.intensity}
                      onChange={(event) => handleAuroraSettings({
                        ...auroraSettings,
                        intensity: Number(event.target.value),
                      })}
                      disabled={!auroraSettings.enabled}
                      aria-label={t('Intensité du fond aurore', 'Aurora background intensity')}
                    />
                    <small>{t('L’animation est automatiquement réduite si ton appareil le demande.', 'Animation is automatically reduced if your device requests it.')}</small>
                  </label>
                  {auroraMessage && <p className="text-secondary" role="status">{auroraMessage}</p>}

                  <label>
                    {t('Langue', 'Language')}
                  </label>

                  <select
                    className="glass-input"
                    value={preferences.language}
                    onChange={(e) =>
                      setPreferences((current) => ({
                        ...current,
                        language: e.target.value as UserPreferences['language'],
                      }))
                    }
                  >
                    <option value="fr">Français</option>
                    <option value="en">English</option>
                  </select>

                  <label>
                    {t('Confidentialité', 'Privacy')}
                  </label>

                  <div className="settings-option-row">
                    <div>
                      <strong>{t('Partager mes nouveaux médias avec mon groupe', 'Share new uploads with my group')}</strong>
                      <small>{t('Les médias privés restent visibles uniquement par vous.', 'Private uploads stay visible only to you.')}</small>
                    </div>
                    <button
                      type="button"
                      className={`toggle-switch ${preferences.default_visibility === 'group' ? 'is-on' : ''}`}
                      role="switch"
                      aria-checked={preferences.default_visibility === 'group'}
                      aria-label={t('Partager les nouveaux médias avec mon groupe', 'Share new uploads with my group')}
                      onClick={() =>
                        setPreferences((current) => ({
                          ...current,
                          default_visibility: current.default_visibility === 'group' ? 'private' : 'group',
                        }))
                      }
                    >
                      <span />
                    </button>
                  </div>

                  <label>
                    {t('Tri par défaut des médias', 'Default media sorting')}
                  </label>

                  <select
                    className="glass-input"
                    value={preferences.media_sort}
                    onChange={(e) =>
                      setPreferences((current) => ({
                        ...current,
                        media_sort: e.target.value as UserPreferences['media_sort'],
                      }))
                    }
                  >
                    <option value="uploaded_at">{t('Date d’importation', 'Upload date')}</option>
                    <option value="taken_at">{t('Date de prise de vue', 'Date taken')}</option>
                    <option value="original_name">{t('Nom', 'Name')}</option>
                  </select>

                  <button
                    className="glass-button primary"
                    type="button"
                    disabled={preferencesLoading || savingPreferences}
                    onClick={async () => {
                      setSavingPreferences(true)
                      setMessage('')
                      try {
                        const saved = await updateUserPreferences(preferences)
                        setPreferences(saved)
                        clearMediaCache()
                        document.documentElement.lang = saved.language
                        const theme = saved.theme === 'system'
                          ? window.matchMedia('(prefers-color-scheme: dark)').matches
                            ? 'dark'
                            : 'light'
                          : saved.theme
                        document.documentElement.dataset.theme = theme
                        window.dispatchEvent(
                          new CustomEvent('mediahub:theme-change', {
                            detail: saved.theme,
                          }),
                        )
                        onPreferencesSaved?.()
                        setMessage(t('Préférences enregistrées.', 'Preferences saved.'))
                      } catch (error) {
                        setMessage(
                          error instanceof Error
                            ? `Impossible d’appliquer les préférences : ${error.message}`
                            : 'Impossible d’appliquer les préférences.',
                        )
                      } finally {
                        setSavingPreferences(false)
                      }
                    }}
                  >
                    {savingPreferences
                      ? t('Enregistrement…', 'Saving…')
                      : t('Enregistrer les préférences', 'Save preferences')}
                  </button>

                  <section className="storage-usage-card" aria-labelledby="storage-usage-title">
                    <div>
                      <strong id="storage-usage-title">{t('Stockage', 'Storage')}</strong>
                      <small>
                        {storageUsage
                          ? `${formatBytes(storageUsage.used_bytes)} · ${storageUsage.media_count} ${t('médias stockés', 'media stored')}`
                          : t('Utilisation indisponible.', 'Usage unavailable.')}
                      </small>
                    </div>
                    {storageUsage?.quota_bytes ? (
                      <>
                        <div className="storage-progress" role="progressbar"
                          aria-valuenow={Math.min(100, Math.round(
                            storageUsage.used_bytes / storageUsage.quota_bytes * 100,
                          ))}
                          aria-valuemin={0} aria-valuemax={100}>
                          <span style={{
                            width: `${Math.min(100, storageUsage.used_bytes / storageUsage.quota_bytes * 100)}%`,
                          }} />
                        </div>
                        <small>
                          {formatBytes(storageUsage.used_bytes)} / {formatBytes(storageUsage.quota_bytes)}
                        </small>
                      </>
                    ) : (
                      <small>{t('Aucun quota configuré.', 'No storage quota configured.')}</small>
                    )}
                  </section>

                  {preferencesLoading && (
                    <p className="text-secondary" role="status">
                      {t('Chargement des préférences…', 'Loading preferences…')}
                    </p>
                  )}

                  {message && (
                    <p className="text-secondary" role="status" aria-live="polite">
                      {message}
                    </p>
                  )}

                </div>

              </div>

            )
          }



        </div>


      </div>


    </section>

  )
}
