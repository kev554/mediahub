import { useState, type FormEvent } from 'react'

import type { RegisterData } from '../services/auth'

type RegisterProps = {
  onRegister: (
    data: RegisterData,
  ) => Promise<void>
  onLogin: () => void
}

export function Register({
  onRegister,
  onLogin,
}: RegisterProps) {
  const [form, setForm] =
    useState<RegisterData>({
      username: '',
      email: '',
      password: '',
      display_name: '',
    })

  const [loading, setLoading] =
    useState(false)

  const [confirmPassword, setConfirmPassword] =
    useState('')

  const [error, setError] =
    useState<string | null>(null)

  const updateField = (
    field: 'username' | 'email' | 'password' | 'display_name',
    value: string,
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()

    setError(null)
    if (form.password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)

    try {
      await onRegister(form)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible de créer le compte.',
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
        <h1>Create account</h1>

        <p className="text-secondary">
          Create your personal media library.
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="register-username">Username</label>
          <input
            id="register-username"
            className="glass-input"
            type="text"
            placeholder="Username"
            autoComplete="username"
            value={form.username}
            onChange={(event) =>
              updateField('username', event.target.value)
            }
            required
          />

          <label htmlFor="register-display-name">Display name</label>
          <input
            id="register-display-name"
            className="glass-input"
            type="text"
            autoComplete="name"
            value={form.display_name}
            onChange={(event) =>
              updateField('display_name', event.target.value)
            }
            required
          />

          <label htmlFor="register-email">Email</label>
          <input
            id="register-email"
            className="glass-input"
            type="email"
            placeholder="Email"
            autoComplete="email"
            value={form.email}
            onChange={(event) =>
              updateField('email', event.target.value)
            }
            required
          />

          <label htmlFor="register-password">Password</label>
          <input
            id="register-password"
            className="glass-input"
            type="password"
            placeholder="Password"
            autoComplete="new-password"
            minLength={8}
            value={form.password}
            onChange={(event) =>
              updateField('password', event.target.value)
            }
            required
          />

          <label htmlFor="register-confirm-password">Confirm password</label>
          <input
            id="register-confirm-password"
            className="glass-input"
            type="password"
            autoComplete="new-password"
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={(event) =>
              setConfirmPassword(event.target.value)
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
            {loading ? 'Creating account…' : 'Sign up'}
          </button>
        </form>

        <button
          type="button"
          className="glass-button auth-register"
          onClick={onLogin}
        >
          I already have an account
        </button>
      </section>
    </main>
  )
}
