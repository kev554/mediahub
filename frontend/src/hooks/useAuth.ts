import {
  useCallback,
  useEffect,
  useState,
} from 'react'

import {
  getCurrentUser,
  login as loginRequest,
  logout as logoutRequest,
  register as registerRequest,
} from '../services/auth'

import type { RegisterData } from '../services/auth'
import type { User } from '../types/user'

export function useAuth() {
  const [user, setUser] =
    useState<User | null>(null)

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState<string | null>(null)

  const loadUser = useCallback(
    async () => {
      const token =
        localStorage.getItem('access_token')

      if (!token) {
        setUser(null)
        setLoading(false)
        return
      }

      try {
        const currentUser =
          await getCurrentUser()

        setUser(currentUser)
      } catch {
        setUser(null)
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    void loadUser()
  }, [loadUser])

  const login = async (
    username: string,
    password: string,
  ) => {
    setError(null)

    try {
      await loginRequest(
        username,
        password,
      )

      const currentUser =
        await getCurrentUser()

      setUser(currentUser)
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Erreur de connexion.'

      setError(message)

      throw err
    }
  }

  const register = async (
    data: RegisterData,
  ) => {
    setError(null)

    try {
      await registerRequest(data)
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Erreur lors de l’inscription.'

      setError(message)

      throw err
    }
  }

  const logout = () => {
    logoutRequest()
    setUser(null)
  }

  return {
    user,
    loading,
    error,
    isAuthenticated: user !== null,
    login,
    register,
    logout,
    reload: loadUser,
  }
}
