import {
  useState,
} from 'react'

import {
  updateProfile,
} from '../services/users'


type SettingsProps = {
  user?: {
    username?: string
    email?: string
    display_name?: string
  } | null

  onLogout: () => void
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

      <h2>
        Sécurité
      </h2>


      <div className="setting-form">


        <label>
          Mot de passe actuel
        </label>

        <input
          className="glass-input"
          type="password"
          value={currentPassword}
          onChange={(e) =>
            setCurrentPassword(e.target.value)
          }
        />


        <label>
          Nouveau mot de passe
        </label>

        <input
          className="glass-input"
          type="password"
          value={newPassword}
          onChange={(e) =>
            setNewPassword(e.target.value)
          }
        />


        <label>
          Confirmer le nouveau mot de passe
        </label>

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
          Changer le mot de passe
        </button>

        <button
          className="danger-button"
          onClick={onLogout}
        >
          🚪 Déconnexion
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
}: SettingsProps) {


  const [activeTab, setActiveTab] =
    useState('profile')


  const [username, setUsername] =
    useState(user?.username ?? '')

  const [email, setEmail] =
    useState(user?.email ?? '')

  const [displayName, setDisplayName] =
    useState(user?.display_name ?? '')


  const [message, setMessage] =
    useState('')


  async function handleSave() {

    try {

      await updateProfile({
        username,
        email,
        display_name: displayName,
      })


      setMessage(
        'Profil mis à jour avec succès ✅',
      )


    } catch {

      setMessage(
        'Erreur lors de la mise à jour ❌',
      )

    }

  }



  return (

    <section className="page-section">


      <h1>
        Paramètres
      </h1>


      <p className="text-secondary">
        Gère ton compte et les préférences de MediaHub.
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
            👤 Profil
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
            🔒 Sécurité
          </button>



          <button
            className={
              activeTab === 'appearance'
                ? 'active'
                : ''
            }
            onClick={() =>
              setActiveTab('appearance')
            }
          >
            🎨 Apparence
          </button>


        </aside>




        <div className="settings-content glass">



          {
            activeTab === 'profile' && (

              <div>

                <h2>
                  Modifier le profil
                </h2>



                <div className="setting-form">


                  <label>
                    Nom utilisateur
                  </label>

                  <input
                    className="glass-input"
                    value={username}
                    onChange={(e) =>
                      setUsername(e.target.value)
                    }
                  />



                  <label>
                    Nom affiché
                  </label>

                  <input
                    className="glass-input"
                    value={displayName}
                    onChange={(e) =>
                      setDisplayName(e.target.value)
                    }
                  />



                  <label>
                    Email
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
                    Sauvegarder
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
            activeTab === 'appearance' && (

              <div>

                <h2>
                  Apparence
                </h2>


                <p className="text-secondary">
                  Les thèmes seront disponibles prochainement.
                </p>


              </div>

            )
          }



        </div>


      </div>


    </section>

  )
}
