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

  const [error, setError] =
    useState<string | null>(null)

  const updateField = (
    field: keyof RegisterData,
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
    <section className="page-section">
      <h1>Créer un compte</h1>

      <p className="text-secondary">
        Crée ton espace personnel MediaHub.
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
          value={form.username}
          onChange={(event) =>
            updateField(
              'username',
              event.target.value,
            )
          }
          required
        />

        <input
          type="text"
          placeholder="Nom affiché"
          value={form.display_name}
          onChange={(event) =>
            updateField(
              'display_name',
              event.target.value,
            )
          }
          required
          style={{ marginTop: '12px' }}
        />

        <input
          type="email"
          placeholder="Adresse email"
          value={form.email}
          onChange={(event) =>
            updateField(
              'email',
              event.target.value,
            )
          }
          required
          style={{ marginTop: '12px' }}
        />

        <input
          type="password"
          placeholder="Mot de passe"
          value={form.password}
          onChange={(event) =>
            updateField(
              'password',
              event.target.value,
            )
          }
          required
          minLength={8}
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
            ? 'Création...'
            : 'Créer mon compte'}
        </button>
      </form>

      <button
        type="button"
        className="glass-button"
        onClick={onLogin}
        style={{ marginTop: '12px' }}
      >
        J'ai déjà un compte
      </button>
    </section>
  )
}
