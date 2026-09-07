import { useState, type FormEvent } from 'react'

type LoginProps = {
  onLogin: (
    username: string,
    password: string,
  ) => Promise<void>
  onRegister: () => void
}

export function Login({
  onLogin,
  onRegister,
}: LoginProps) {
  const [username, setUsername] =
    useState('')

  const [password, setPassword] =
    useState('')

  const [loading, setLoading] =
    useState(false)

  const [error, setError] =
    useState<string | null>(null)

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()

    setError(null)
    setLoading(true)

    try {
      await onLogin(
        username,
        password,
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible de se connecter.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="page-section">
      <h1>Connexion</h1>

      <p className="text-secondary">
        Connecte-toi à ton espace MediaHub.
      </p>

      <form
        onSubmit={handleSubmit}
        style={{
          maxWidth: '420px',
          marginTop: '24px',
        }}
      >
        <input
          type="text"
          placeholder="Nom d'utilisateur"
          value={username}
          onChange={(event) =>
            setUsername(event.target.value)
          }
          required
        />

        <input
          type="password"
          placeholder="Mot de passe"
          value={password}
          onChange={(event) =>
            setPassword(event.target.value)
          }
          required
          style={{ marginTop: '12px' }}
        />

        {error && (
          <p
            style={{
              marginTop: '12px',
              color: '#e63946',
            }}
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          className="accent-button"
          disabled={loading}
          style={{ marginTop: '18px' }}
        >
          {loading
            ? 'Connexion...'
            : 'Se connecter'}
        </button>
      </form>

      <button
        type="button"
        className="glass-button"
        onClick={onRegister}
        style={{ marginTop: '12px' }}
      >
        Créer un compte
      </button>
    </section>
  )
}
