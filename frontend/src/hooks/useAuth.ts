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
import { clearMediaCache } from '../services/media'
import { clearCachedUserPreferences } from '../services/users'
import {
  cacheOfflineUser,
  clearOfflineCache,
  getOfflineUser,
} from '../services/offlineCache'

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

      clearMediaCache()

      if (!token) {
        setUser(null)
        setLoading(false)
        return
      }

      try {
        const currentUser =
          await getCurrentUser()

        cacheOfflineUser(currentUser)
        setUser(currentUser)
      } catch (error) {
        const cachedUser = getOfflineUser()
        if (
          cachedUser &&
          (error instanceof TypeError || !navigator.onLine)
        ) {
          setUser(cachedUser)
        } else {
          setUser(null)
        }
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
      clearMediaCache()
      clearCachedUserPreferences()
      await clearOfflineCache()
      await loginRequest(
        username,
        password,
      )

      const currentUser =
        await getCurrentUser()

      cacheOfflineUser(currentUser)
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
    clearMediaCache()
    clearCachedUserPreferences()
    void clearOfflineCache()
    setUser(null)
  }

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser)
  }

  return {
    user,
    loading,
    error,
    isAuthenticated: user !== null,
    login,
    register,
    logout,
    updateUser,
    reload: loadUser,
  }
}
