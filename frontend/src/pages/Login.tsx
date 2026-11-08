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
    <main className="auth-page">
      <section className="auth-card glass">
        <div className="brand-mark" aria-hidden="true">M</div>
        <span className="dashboard-eyebrow">MEDIAHUB</span>
        <h1>Sign in</h1>
        <p className="text-secondary">
          Sign in to your personal media library.
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="login-username">Username</label>
          <input
            id="login-username"
            className="glass-input"
            type="text"
            placeholder="Username"
            autoComplete="username"
            value={username}
            onChange={(event) =>
              setUsername(event.target.value)
            }
            required
          />

          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            className="glass-input"
            type="password"
            placeholder="Password"
            autoComplete="current-password"
            value={password}
            onChange={(event) =>
              setPassword(event.target.value)
            }
            required
          />

          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="accent-button"
            disabled={loading}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <button
          type="button"
          className="glass-button auth-register"
          onClick={onRegister}
        >
          Create account
        </button>
      </section>
    </main>
  )
}
